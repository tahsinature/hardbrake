#!/usr/bin/env bun
/**
 * HardBrake Bridge — sidecar process for the Tauri GUI.
 *
 * Usage:
 *   hardbrake-core check-binaries
 *   hardbrake-core get-presets
 *   hardbrake-core compress-video <json>
 *   hardbrake-core compress-audio <json>
 *   hardbrake-core install-dep <name>     (HandBrakeCLI | ffmpeg)
 *
 * Each command writes one JSON object per line to stdout.
 * Progress events:  {"type":"progress","file":"...","percent":45.2,"eta":"0h02m30s"}
 * File done events: {"type":"file_done","fileName":"...","success":true,...}
 * Final result:     {"type":"done"}
 * Errors:           {"type":"error","message":"..."}
 */

import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

// ─── Fix PATH for bundled app context ──────────────────────────────
// Desktop app bundles (macOS .app, Linux AppImage, Windows .exe) may
// get a minimal PATH. Prepend common locations for each platform.
const HOME = os.homedir();
const IS_WINDOWS = process.platform === "win32";
const PATH_SEP = IS_WINDOWS ? ";" : ":";

const HARDBRAKE_BIN_DIR = path.join(HOME, ".hardbrake", "bin");

const EXTRA_PATHS: string[] = IS_WINDOWS
  ? [
      HARDBRAKE_BIN_DIR,
      // Windows: common install locations
      path.join(HOME, "AppData", "Local", "Programs", "HandBrake"),
      path.join(HOME, "AppData", "Local", "Microsoft", "WinGet", "Packages"),
      "C:\\Program Files\\HandBrake",
      "C:\\Program Files\\ffmpeg\\bin",
      "C:\\ProgramData\\chocolatey\\bin",
      path.join(HOME, "scoop", "shims"),
    ]
  : process.platform === "darwin"
    ? [
        HARDBRAKE_BIN_DIR,
        // macOS: Homebrew + common user locations
        "/opt/homebrew/bin",
        "/opt/homebrew/sbin",
        "/usr/local/bin",
        "/usr/local/sbin",
        path.join(HOME, ".bin"),
        path.join(HOME, ".local/bin"),
      ]
    : [
        HARDBRAKE_BIN_DIR,
        // Linux: standard + Flatpak/Snap/Linuxbrew
        "/usr/local/bin",
        "/usr/bin",
        "/snap/bin",
        path.join(HOME, ".local/bin"),
        path.join(HOME, ".linuxbrew/bin"),
        "/home/linuxbrew/.linuxbrew/bin",
      ];

process.env.PATH = [...EXTRA_PATHS, process.env.PATH].join(PATH_SEP);

import { File } from "./blueprints";
import { compressVideo, compressAudio } from "./engine";
import { getPresets, checkIfBinaryExists, findBinaryPath } from "./utils";

const emit = (event: Record<string, unknown>) => {
  process.stdout.write(JSON.stringify(event) + "\n");
};

const args = process.argv.slice(2);
const command = args[0];

/** Download HandBrakeCLI directly from GitHub releases → ~/.hardbrake/bin/ */
const downloadHandBrakeCLI = async (): Promise<void> => {
  emit({ type: "install_start", dep: "HandBrakeCLI", desc: "HandBrakeCLI (from handbrake.fr)", pm: "direct" });

  // 1. Get the latest release from GitHub API
  emit({ type: "install_log", dep: "HandBrakeCLI", line: "Fetching latest HandBrake release info..." });
  const releaseRes = await fetch("https://api.github.com/repos/HandBrake/HandBrake/releases/latest", {
    headers: { "User-Agent": "HardBrake-App" },
  });
  if (!releaseRes.ok) throw new Error(`GitHub API error: ${releaseRes.status} ${releaseRes.statusText}`);
  const release = (await releaseRes.json()) as { tag_name: string; assets: { name: string; browser_download_url: string }[] };
  emit({ type: "install_log", dep: "HandBrakeCLI", line: `Latest release: ${release.tag_name}` });

  // 2. Find the right CLI asset for this platform
  let assetPattern: RegExp;
  if (IS_WINDOWS) {
    assetPattern = /HandBrakeCLI.*win.*x86_64\.zip$/i;
  } else if (process.platform === "darwin") {
    assetPattern = /HandBrakeCLI.*mac.*\.zip$/i;
  } else {
    // Linux — no official CLI zip; instruct user to use flatpak
    throw new Error("HandBrakeCLI is not available as a direct download for Linux. Install via: flatpak install fr.handbrake.ghb");
  }

  const asset = release.assets.find((a) => assetPattern.test(a.name));
  if (!asset) {
    // Fallback: list available assets for debugging
    const names = release.assets.map((a) => a.name).join(", ");
    throw new Error(`Could not find HandBrakeCLI download for this platform. Available: ${names}`);
  }

  emit({ type: "install_log", dep: "HandBrakeCLI", line: `Downloading ${asset.name}...` });

  // 3. Download the zip
  const zipRes = await fetch(asset.browser_download_url, {
    headers: { "User-Agent": "HardBrake-App" },
  });
  if (!zipRes.ok) throw new Error(`Download failed: ${zipRes.status}`);

  const tmpDir = path.join(os.tmpdir(), `hardbrake_install_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  const zipPath = path.join(tmpDir, asset.name);

  const arrayBuf = await zipRes.arrayBuffer();
  fs.writeFileSync(zipPath, new Uint8Array(arrayBuf));
  emit({ type: "install_log", dep: "HandBrakeCLI", line: `Downloaded ${(arrayBuf.byteLength / 1024 / 1024).toFixed(1)} MB` });

  // 4. Extract the zip
  emit({ type: "install_log", dep: "HandBrakeCLI", line: "Extracting..." });
  const extractDir = path.join(tmpDir, "extracted");
  fs.mkdirSync(extractDir, { recursive: true });

  await new Promise<void>((res, rej) => {
    let cmd: string;
    let args: string[];
    if (IS_WINDOWS) {
      cmd = "powershell";
      args = ["-NoProfile", "-Command", `Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force`];
    } else {
      cmd = "unzip";
      args = ["-o", zipPath, "-d", extractDir];
    }
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    child.on("close", (code) => (code === 0 ? res() : rej(new Error(`Extraction failed (exit ${code})`))));
    child.on("error", rej);
  });

  // 5. Find the HandBrakeCLI binary in the extracted files
  const binaryName = IS_WINDOWS ? "HandBrakeCLI.exe" : "HandBrakeCLI";
  let foundBinary: string | null = null;

  const searchDir = (dir: string) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) searchDir(full);
      else if (ent.name === binaryName) foundBinary = full;
    }
  };
  searchDir(extractDir);

  if (!foundBinary) throw new Error(`${binaryName} not found in downloaded archive`);

  // 6. Copy to ~/.hardbrake/bin/
  fs.mkdirSync(HARDBRAKE_BIN_DIR, { recursive: true });
  const dest = path.join(HARDBRAKE_BIN_DIR, binaryName);
  fs.copyFileSync(foundBinary, dest);
  if (!IS_WINDOWS) fs.chmodSync(dest, 0o755);

  emit({ type: "install_log", dep: "HandBrakeCLI", line: `Installed to ${dest}` });

  // 7. Cleanup temp files
  fs.rmSync(tmpDir, { recursive: true, force: true });

  emit({ type: "install_done", dep: "HandBrakeCLI", success: true });
};

/** Install a dependency, streaming output as log events. */
const installDep = async (depName: string): Promise<void> => {
  // ─── HandBrakeCLI: always download directly from GitHub ───
  if (depName === "HandBrakeCLI") {
    return downloadHandBrakeCLI();
  }

  // ─── ffmpeg: use package managers ───
  return new Promise((resolve, reject) => {
    // ─── Determine package manager and install args per platform ───
    type PkgInfo = { bin: string; args: string[]; desc: string };
    type PkgMap = Record<string, PkgInfo>;

    const brewMap: PkgMap = {
      ffmpeg: { bin: "brew", args: ["install", "ffmpeg"], desc: "ffmpeg" },
    };

    const wingetMap: PkgMap = {
      ffmpeg: { bin: "winget", args: ["install", "--id", "Gyan.FFmpeg", "-e", "--accept-source-agreements", "--accept-package-agreements"], desc: "ffmpeg" },
    };

    const chocoMap: PkgMap = {
      ffmpeg: { bin: "choco", args: ["install", "ffmpeg", "-y"], desc: "ffmpeg" },
    };

    const aptMap: PkgMap = {
      ffmpeg: { bin: "sudo", args: ["apt", "install", "-y", "ffmpeg"], desc: "ffmpeg" },
    };

    // Find the best available package manager
    let entry: PkgInfo | undefined;
    let pmName = "";

    if (IS_WINDOWS) {
      // Try winget first, then choco
      if (findBinaryPath("winget")) {
        entry = wingetMap[depName];
        pmName = "winget";
      } else if (findBinaryPath("choco")) {
        entry = chocoMap[depName];
        pmName = "choco";
      }
    } else if (process.platform === "darwin") {
      if (findBinaryPath("brew")) {
        entry = brewMap[depName];
        pmName = "brew";
      }
    } else {
      // Linux: try brew first (linuxbrew), then apt
      if (findBinaryPath("brew")) {
        entry = brewMap[depName];
        pmName = "brew";
      } else if (findBinaryPath("apt")) {
        entry = aptMap[depName];
        pmName = "apt";
      }
    }

    if (!entry) {
      const hints = IS_WINDOWS
        ? "Please install winget (built into Windows 10/11) or Chocolatey, then reopen HardBrake."
        : process.platform === "darwin"
          ? "Please install Homebrew from https://brew.sh and then reopen HardBrake."
          : "No supported package manager found (brew, apt). Please install the dependency manually.";
      reject(new Error(`Cannot auto-install ${depName}. ${hints}`));
      return;
    }

    const tryInstall = (info: PkgInfo, pm: string): Promise<void> => {
      return new Promise((res, rej) => {
        const bp = findBinaryPath(info.bin);
        if (!bp && info.bin !== "sudo") {
          rej(new Error(`Package manager '${pm}' not found in PATH.`));
          return;
        }
        emit({ type: "install_start", dep: depName, desc: info.desc, pm });

        const child = spawn(bp ?? info.bin, info.args, {
          env: { ...process.env },
          stdio: ["ignore", "pipe", "pipe"],
        });

        child.stdout.on("data", (data: Buffer) => {
          const lines = data.toString().split("\n").filter(Boolean);
          for (const line of lines) {
            emit({ type: "install_log", dep: depName, line });
          }
        });

        child.stderr.on("data", (data: Buffer) => {
          const lines = data.toString().split("\n").filter(Boolean);
          for (const line of lines) {
            emit({ type: "install_log", dep: depName, line });
          }
        });

        child.on("close", (code) => {
          if (code === 0) {
            res();
          } else {
            rej(new Error(`${pm} exited with code ${code}`));
          }
        });
      });
    };

    // On Windows: try winget first, fallback to choco if winget fails
    if (IS_WINDOWS && pmName === "winget" && findBinaryPath("choco")) {
      tryInstall(entry, pmName)
        .then(() => {
          emit({ type: "install_done", dep: depName, success: true });
          resolve();
        })
        .catch((wingetErr) => {
          emit({ type: "install_log", dep: depName, line: `winget failed (${wingetErr.message}), trying Chocolatey...` });
          const chocoEntry = chocoMap[depName];
          if (!chocoEntry) {
            emit({ type: "install_done", dep: depName, success: false, error: wingetErr.message });
            reject(wingetErr);
            return;
          }
          tryInstall(chocoEntry, "choco")
            .then(() => {
              emit({ type: "install_done", dep: depName, success: true });
              resolve();
            })
            .catch((chocoErr) => {
              emit({ type: "install_done", dep: depName, success: false, error: `winget and choco both failed` });
              reject(new Error(`winget failed (${wingetErr.message}), choco failed (${chocoErr.message})`));
            });
        });
      return;
    }

    tryInstall(entry, pmName)
      .then(() => {
        emit({ type: "install_done", dep: depName, success: true });
        resolve();
      })
      .catch((err) => {
        emit({ type: "install_done", dep: depName, success: false, error: err.message });
        reject(err);
      });
  });
};

async function main() {
  try {
    switch (command) {
      case "check-binaries": {
        const data: Record<string, boolean | string> = {};
        for (const bin of ["HandBrakeCLI", "ffmpeg"]) {
          data[bin] = checkIfBinaryExists(bin);
        }
        // Report available package manager for ffmpeg install
        if (IS_WINDOWS) {
          data["pm"] = checkIfBinaryExists("winget") ? "winget" : checkIfBinaryExists("choco") ? "choco" : "";
        } else if (process.platform === "darwin") {
          data["pm"] = checkIfBinaryExists("brew") ? "brew" : "";
        } else {
          data["pm"] = checkIfBinaryExists("brew") ? "brew" : checkIfBinaryExists("apt") ? "apt" : "";
        }
        // HandBrakeCLI can always be installed via direct download
        data["canInstallHandBrakeCLI"] = true;
        emit({ type: "result", data });
        break;
      }

      case "get-presets": {
        const data = await getPresets();
        emit({ type: "result", data });
        break;
      }

      case "compress-video": {
        const payload = JSON.parse(args[1]);
        const {
          files: filePaths,
          preset,
          keepAudio,
        } = payload as {
          files: string[];
          preset: string;
          keepAudio: boolean;
        };

        const files = filePaths.map((p: string) => new File(p));

        await compressVideo(files, preset, {
          keepAudio,
          onProgress: (percent, fileName, eta) => {
            emit({ type: "progress", file: fileName, percent, eta: eta ?? "" });
          },
          onFileDone: (result) => {
            emit({ type: "file_done", ...result });
          },
        });

        emit({ type: "done" });
        break;
      }

      case "compress-audio": {
        const payload = JSON.parse(args[1]);
        const {
          files: filePaths,
          bitrate,
          splitByMB,
        } = payload as {
          files: string[];
          bitrate: string;
          splitByMB?: number;
        };

        const files = filePaths.map((p: string) => new File(p));

        await compressAudio(files, bitrate, {
          ...(splitByMB ? { splitByMB } : {}),
          onProgress: (percent, fileName) => {
            emit({ type: "progress", file: fileName, percent });
          },
          onFileDone: (result) => {
            emit({ type: "file_done", ...result });
          },
        });

        emit({ type: "done" });
        break;
      }

      case "install-dep": {
        const depName = args[1];
        if (!depName) {
          emit({ type: "error", message: "Missing dependency name. Usage: install-dep <HandBrakeCLI|ffmpeg>" });
          process.exit(1);
        }
        await installDep(depName);
        break;
      }

      default:
        emit({ type: "error", message: `Unknown command: ${command}` });
        process.exit(1);
    }
  } catch (err: any) {
    emit({ type: "error", message: err?.message ?? String(err) });
    process.exit(1);
  }
}

await main();

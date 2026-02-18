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
import os from "os";
import path from "path";

// ─── Fix PATH for bundled app context ──────────────────────────────
// Desktop app bundles (macOS .app, Linux AppImage, Windows .exe) may
// get a minimal PATH. Prepend common locations for each platform.
const HOME = os.homedir();
const IS_WINDOWS = process.platform === "win32";
const PATH_SEP = IS_WINDOWS ? ";" : ":";

const EXTRA_PATHS: string[] = IS_WINDOWS
  ? [
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
        // macOS: Homebrew + common user locations
        "/opt/homebrew/bin",
        "/opt/homebrew/sbin",
        "/usr/local/bin",
        "/usr/local/sbin",
        path.join(HOME, ".bin"),
        path.join(HOME, ".local/bin"),
      ]
    : [
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

/** Install a dependency via the platform's package manager, streaming output as log events. */
const installDep = (depName: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // ─── Determine package manager and install args per platform ───
    type PkgInfo = { bin: string; args: string[]; desc: string };
    type PkgMap = Record<string, PkgInfo>;

    const brewMap: PkgMap = {
      HandBrakeCLI: { bin: "brew", args: ["install", "handbrake"], desc: "HandBrake (provides HandBrakeCLI)" },
      ffmpeg: { bin: "brew", args: ["install", "ffmpeg"], desc: "ffmpeg" },
    };

    const wingetMap: PkgMap = {
      HandBrakeCLI: { bin: "winget", args: ["install", "--id", "HandBrake.HandBrakeCLI", "-e", "--accept-source-agreements", "--accept-package-agreements"], desc: "HandBrakeCLI" },
      ffmpeg: { bin: "winget", args: ["install", "--id", "Gyan.FFmpeg", "-e", "--accept-source-agreements", "--accept-package-agreements"], desc: "ffmpeg" },
    };

    const chocoMap: PkgMap = {
      HandBrakeCLI: { bin: "choco", args: ["install", "handbrake.install", "-y"], desc: "HandBrake (provides HandBrakeCLI)" },
      ffmpeg: { bin: "choco", args: ["install", "ffmpeg", "-y"], desc: "ffmpeg" },
    };

    const aptMap: PkgMap = {
      HandBrakeCLI: { bin: "sudo", args: ["apt", "install", "-y", "handbrake-cli"], desc: "HandBrake CLI" },
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

    // Resolve the binary path
    const binPath = findBinaryPath(entry.bin);
    if (!binPath && entry.bin !== "sudo") {
      reject(new Error(`Package manager '${pmName}' not found in PATH.`));
      return;
    }

    emit({ type: "install_start", dep: depName, desc: entry.desc, pm: pmName });

    const child = spawn(binPath ?? entry.bin, entry.args, {
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
        emit({ type: "install_done", dep: depName, success: true });
        resolve();
      } else {
        emit({ type: "install_done", dep: depName, success: false, error: `${pmName} exited with code ${code}` });
        reject(new Error(`${pmName} install failed with code ${code}`));
      }
    });

    child.on("error", (err) => {
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
        // Report available package manager for install capability
        if (IS_WINDOWS) {
          data["pm"] = checkIfBinaryExists("winget") ? "winget" : checkIfBinaryExists("choco") ? "choco" : "";
        } else if (process.platform === "darwin") {
          data["pm"] = checkIfBinaryExists("brew") ? "brew" : "";
        } else {
          data["pm"] = checkIfBinaryExists("brew") ? "brew" : checkIfBinaryExists("apt") ? "apt" : "";
        }
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

import fs from "fs";
import readline from "readline";
import path from "path";
import { spawn, spawnSync } from "child_process";

export const IS_WINDOWS = process.platform === "win32";
export const IS_MAC = process.platform === "darwin";
export const IS_LINUX = process.platform === "linux";
export const PATH_SEP = IS_WINDOWS ? ";" : ":";

export const runShellCommandAndReturnLine = (command: string, handleNewLine: (line: string) => void): Promise<void> => {
  return new Promise((resolve) => {
    // Spawn the command as a child process
    const child = spawn(command, { shell: true });

    // Create an interface to handle the logs from stdout and stderr
    const stdoutInterface = readline.createInterface({ input: child.stdout });
    const stderrInterface = readline.createInterface({ input: child.stderr });

    // Handle stdout logs & stderr
    stdoutInterface.on("line", handleNewLine);
    stderrInterface.on("line", handleNewLine);

    child.on("exit", resolve);
  });
};

export const runShellCommandSimple = (cmd: string) => {
  spawnSync(cmd, { shell: true, stdio: ["inherit", "inherit", "inherit"] });
};

export const runShellCommandAndReturnOutput = (cmd: string) => {
  const { stdout } = spawnSync(cmd, { shell: true, stdio: ["inherit", "pipe", "inherit"] });

  return stdout
    .toString()
    .split("\n")
    .filter((x) => x);
};

export const getPresets = async () => {
  const lines: string[] = [];
  await runShellCommandAndReturnLine("HandBrakeCLI -z", (line) => {
    lines.push(line);
  });

  const presetMap: Record<string, string[]> = {};

  let category = "";

  for (const line of lines) {
    const numOfSpacesInTheBeginning = line.length - line.trimStart().length;
    const isCategory = line.includes("/");
    const isPreset = numOfSpacesInTheBeginning === 4;

    if (isCategory) {
      category = line.trim().replace("/", "");
      presetMap[category] = [];
    }

    if (category && isPreset) {
      presetMap[category].push(line.trim());
    }
  }

  return presetMap;
};

/**
 * escape any special characters in the path like spaces, quotes, etc.
 */
export const escapePath = (path: string) => {
  return path.replace(/(["\s'$`\\])/g, "\\$1");
};

export const createDirOvewriteRecursive = (dir: string) => {
  fs.existsSync(dir) && fs.rmdirSync(dir, { recursive: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

export const checkIfBinaryExists = (binary: string) => {
  return !!findBinaryPath(binary);
};

/**
 * Find the full path of a binary by checking PATH directories.
 * Works even in macOS .app bundle context where `which` may fail
 * because PATH is minimal.
 */
export const findBinaryPath = (binary: string): string | null => {
  // On Windows, try `where`; on Unix, try `which`
  const lookupCmd = IS_WINDOWS ? "where" : "which";
  try {
    const { stdout, status } = spawnSync(lookupCmd, [binary], {
      stdio: ["ignore", "pipe", "ignore"],
      env: process.env,
    });
    if (status === 0) {
      // `where` on Windows can return multiple lines; take the first
      const p = stdout.toString().trim().split(/\r?\n/)[0];
      if (p) return p;
    }
  } catch {
    // ignore
  }

  // Fallback: check PATH directories manually (for .app/.exe bundle context)
  const pathDirs = (process.env.PATH ?? "").split(PATH_SEP);
  for (const dir of pathDirs) {
    // On Windows, binaries may have .exe, .cmd, .bat suffixes
    const candidates = IS_WINDOWS ? [`${binary}.exe`, `${binary}.cmd`, `${binary}.bat`, binary] : [binary];
    for (const candidate of candidates) {
      const fullPath = path.join(dir, candidate);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) return fullPath;
      } catch {
        // not found in this dir
      }
    }
  }

  return null;
};

export const getFileSizeInMB = (filePath: string): number => {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const longNum = fs.statSync(filePath).size / 1024 / 1024;
  return parseFloat(longNum.toFixed(2));
};

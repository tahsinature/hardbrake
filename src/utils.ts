import fs from "fs";
import readline from "readline";
import { spawn, spawnSync } from "child_process";

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
  if (!dir) return;

  fs.existsSync(dir) &&
    fs.rmdirSync(dir, {
      recursive: true,
    });

  fs.mkdirSync(dir, { recursive: true });
};

export const checkIfBinaryExists = (binary: string) => {
  const lines = runShellCommandAndReturnOutput(`which ${binary}`);
  return lines.length > 0;
};

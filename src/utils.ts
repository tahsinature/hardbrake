import { spawn } from "child_process";
import readline from "readline";

export const runShellCommand = async (cmd: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    var out = spawn(cmd, {
      stdio: ["inherit", "pipe", "inherit"],
      shell: true,
    });

    out.stdout.setEncoding("utf-8");
    out.stdout.on("readable", () => resolve(out.stdout.read()));
  });
};

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

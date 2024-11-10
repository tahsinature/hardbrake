import path from "path";
import type { File } from "./blueprints";
import { ProgressBar } from "./progress";
import { runShellCommandAndReturnLine } from "./utils";

const getProgressAndRemainingTime = (line: string) => {
  const progressMatch = line.match(/Encoding: task 1 of 1, (\d+\.\d+) %/);
  const progress = progressMatch ? parseFloat(progressMatch[1]) : null;

  const remainingTimeMatch = line.match(/ETA (\d+h\d+m\d+s)/);
  const remainingTime = remainingTimeMatch ? remainingTimeMatch[1] : null;

  return { progress, remainingTime };
};

export const main = async (files: File[], preset: string) => {
  for (const file of files) {
    const outputFileName = `${file.fileNameWithoutExtension}__HandBraked__${preset}.mp4`;
    file.outputFullPath = path.resolve(file.dir, outputFileName);
    file.cmd = `HandBrakeCLI -i '${file.originalFullPath}' -o '${file.outputFullPath}' -Z '${preset}'`;
  }

  const progressBar = new ProgressBar(files.length);

  for (const file of files) {
    if (!file.cmd) throw new Error(`Command not found for file: ${file.originalFullPath}`);

    await runShellCommandAndReturnLine(file.cmd, (line) => {
      const { progress, remainingTime } = getProgressAndRemainingTime(line);
      if (progress && remainingTime) {
        progressBar.handleNewLine(progress, remainingTime, file.fileNameWithoutExtension);
      }
    });

    progressBar.handleOneFileDone();
  }

  progressBar.stop();
};

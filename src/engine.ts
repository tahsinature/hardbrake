import os from "os";
import path from "path";
import fs from "fs";
import type { File } from "./blueprints";
import { ProgressBar } from "./progress";
import { createDirOvewriteRecursive, getFileSizeInMB, runShellCommandAndReturnLine, runShellCommandSimple } from "./utils";
import { askInteger } from "./prompts";
import ffmpeg, { FfmpegCommand } from "fluent-ffmpeg";
import splitFile from "split-file";

const compressAudioAsync = async (command: FfmpegCommand) => {
  return new Promise<void>((resolve, reject) => {
    command.on("end", () => resolve());
    command.on("error", (error) => reject(error));
    command.run();
  });
};

const getProgressAndRemainingTime = (line: string) => {
  const progressMatch = line.match(/Encoding: task 1 of 1, (\d+\.\d+) %/);
  const progress = progressMatch ? parseFloat(progressMatch[1]) : null;

  const remainingTimeMatch = line.match(/ETA (\d+h\d+m\d+s)/);
  const remainingTime = remainingTimeMatch ? remainingTimeMatch[1] : null;

  return { progress, remainingTime };
};

export const compressAudio = async (files: File[], bitrate: string) => {
  const splitByMB = askInteger("Max file size in MB", 4);
  const progressBar = new ProgressBar(files.length);

  for (const file of files) {
    const command = ffmpeg();
    command.input(file.originalFullPath);

    const outputFileName = `${file.alias}.mp3`;
    const labDir = file.createLabDir();
    const outputFullPathTemp = path.resolve(labDir, outputFileName);

    command.audioBitrate(bitrate);
    command.output(outputFullPathTemp);

    command.on("progress", (progress) => {
      const percent = parseInt(progress.percent as any);
      progressBar.handleNewLine(percent, file.baseName);
    });

    await compressAudioAsync(command);

    const outputSize = getFileSizeInMB(outputFullPathTemp);
    if (outputSize > splitByMB) {
      const outputDir = path.join(file.dir, `${file.baseName}_split`);
      createDirOvewriteRecursive(outputDir);
      const parts = await splitFile.splitFileBySize(outputFullPathTemp, splitByMB * 1024 * 1024);

      for (const part of parts) {
        const command = ffmpeg();
        command.input(part);
        command.audioCodec("copy");
        const partName = part.split(".mp3.")[1];
        const outputFileName = path.join(outputDir, `${partName}.mp3`);
        command.output(outputFileName);
        await compressAudioAsync(command);
      }
    } else {
      const newLoc = path.resolve(file.dir, `${file.baseName}_${bitrate}.mp3`);
      fs.renameSync(outputFullPathTemp, newLoc);
    }

    if (fs.existsSync(labDir)) fs.rmdirSync(labDir, { recursive: true });

    progressBar.handleOneFileDone();
  }

  progressBar.stop();
};

export const compressVideo = async (files: File[], preset: string, { keepAudio = true }) => {
  const audioFlag = keepAudio ? "" : "-a none";

  for (const file of files) {
    const outputFileName = `${file.baseName}__HandBraked__${preset}.mp4`;
    file.outputFullPath = path.resolve(file.dir, outputFileName);
    file.cmd = `HandBrakeCLI -i '${file.originalFullPath}' ${audioFlag} -o '${file.outputFullPath}' -Z '${preset}'`;
  }

  const progressBar = new ProgressBar(files.length);

  for (const file of files) {
    if (!file.cmd) throw new Error(`Command not found for file: ${file.originalFullPath}`);

    await runShellCommandAndReturnLine(file.cmd, (line) => {
      const { progress } = getProgressAndRemainingTime(line);
      if (progress) {
        progressBar.handleNewLine(progress, file.baseName);
      }
    });

    progressBar.handleOneFileDone();
  }

  progressBar.stop();
};

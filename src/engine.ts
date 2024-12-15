import os from "os";
import path from "path";
import fs from "fs";
import type { File } from "./blueprints";
import { ProgressBar } from "./progress";
import { createDirOvewriteRecursive, escapePath, runShellCommandAndReturnLine, runShellCommandSimple } from "./utils";
import { askBoolean, askInteger } from "./prompts";

const getProgressAndRemainingTime = (line: string) => {
  const progressMatch = line.match(/Encoding: task 1 of 1, (\d+\.\d+) %/);
  const progress = progressMatch ? parseFloat(progressMatch[1]) : null;

  const remainingTimeMatch = line.match(/ETA (\d+h\d+m\d+s)/);
  const remainingTime = remainingTimeMatch ? remainingTimeMatch[1] : null;

  return { progress, remainingTime };
};

export const compressVideo = async (files: File[], preset: string, { keepAudio = true }) => {
  const audioFlag = keepAudio ? "" : "-a none";

  for (const file of files) {
    const outputFileName = `${file.fileNameWithoutExtension}__HandBraked__${preset}.mp4`;
    file.outputFullPath = path.resolve(file.dir, outputFileName);
    file.cmd = `HandBrakeCLI -i '${file.originalFullPath}' ${audioFlag} -o '${file.outputFullPath}' -Z '${preset}'`;
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

const splitToPart = (filePath: string, maxMb: number) => {
  const tempDir = escapePath(os.tmpdir());
  const uuid = crypto.randomUUID();
  const dateNow = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const partDir = path.join(tempDir, `${dateNow}__${uuid}`);
  fs.mkdirSync(partDir);
  const partPath = path.join(partDir, `rec_part_`);
  const splitCmd = `split -b ${maxMb}M ${escapePath(filePath)} "${partPath}"`;
  runShellCommandSimple(splitCmd);

  return partDir;
};

const convertPartToMp3 = (partDir: string) => {
  const files = fs.readdirSync(partDir);

  for (const file of files) {
    const fullFilePath = path.join(partDir, file);
    const mp3Loc = `${escapePath(fullFilePath)}.mp3`;
    const cmd = `ffmpeg -i ${escapePath(fullFilePath)} -c:a copy ${mp3Loc}`;
    runShellCommandSimple(cmd);
  }
};

export const compressAudio = async (file: File, bitrate: string) => {
  const outputFileName = `${file.fileNameWithoutExtension}_compressed_${bitrate}.mp3`;
  file.outputFullPath = path.resolve(file.dir, outputFileName);
  file.cmd = `ffmpeg -i ${escapePath(file.originalFullPath)} -map 0:a:0 -b:a ${bitrate} ${escapePath(file.outputFullPath)} -y`;

  if (!file.cmd) throw new Error(`Command not found for file: ${file.originalFullPath}`);
  runShellCommandSimple(file.cmd);

  const outputSize = file.getOutputFileSizeInMB();
  const shouldSplit = await askBoolean(`Converted size: ${outputSize.toFixed(2)} MB. Do you want to split the file?`, outputSize > 4 ? "true" : "false");
  if (shouldSplit) {
    const dirName = `${file.fileNameWithoutExtension}_split`;
    const dirLoc = path.resolve(file.dir, dirName);
    createDirOvewriteRecursive(dirLoc);

    const splitByMB = await askInteger("Input size in MB", 4);
    const partDir = splitToPart(file.outputFullPath, splitByMB);
    convertPartToMp3(partDir);

    const mp3Files = fs.readdirSync(partDir).filter((f) => f.endsWith(".mp3"));
    for (const mp3File of mp3Files) {
      const mp3FileLoc = path.join(partDir, mp3File);
      const newLoc = path.resolve(dirLoc, mp3File);
      fs.renameSync(mp3FileLoc, newLoc);
    }

    fs.rmdirSync(partDir, { recursive: true });
  }
};

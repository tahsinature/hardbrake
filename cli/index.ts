import { Operations, type CliOptions } from "./types";
import { askBoolean, askChoose, askFilter, askInteger, askPreset, showErrorAndExit, showNotice } from "./prompts";
import { compressVideo, compressAudio } from "./engine";
import { checkRequiredBinaries } from "./check";
import { File } from "./blueprints";
import { selectFiles } from "./file-selection";
import upgrade from "./upgrade";
import { ProgressBar } from "./progress";

process.on("uncaughtException", (error) => {
  // console.log(error.stack);
  showErrorAndExit([error.message]);
});

process.on("unhandledRejection", (error) => {
  // console.log(error);
  showErrorAndExit([error as string]);
});

const audioCompress = async (cliOpt: CliOptions) => {
  checkRequiredBinaries(Operations.AUDIO_COMPRESS);

  let files = cliOpt.filePaths.map((path) => new File(path));
  if (files.length === 0) files = selectFiles(File.exts.audio);

  const bitrate = askFilter("Select a bitrate", ["16k", "32k", "64k", "128k", "256k", "320k"], { limit: 1, min: 1 });
  const splitByMB = askInteger("Max file size in MB", 4);

  const progressBar = new ProgressBar(files.length);

  await compressAudio(files, bitrate[0], {
    splitByMB,
    onProgress: (percent, fileName) => {
      progressBar.handleNewLine(percent, fileName);
    },
    onFileDone: () => {
      progressBar.handleOneFileDone();
    },
  });

  progressBar.stop();
};

const videoCompress = async (cliOpt: CliOptions) => {
  checkRequiredBinaries(Operations.VIDEO_COMPRESS);

  let files = cliOpt.filePaths.map((path) => new File(path));
  if (files.length === 0) files = selectFiles(File.exts.video);

  const preset = askPreset();
  const keepAudio = askBoolean("Do you want to keep the audio?", "true");

  const progressBar = new ProgressBar(files.length);

  await compressVideo(files, preset, {
    keepAudio,
    onProgress: (percent, fileName) => {
      progressBar.handleNewLine(percent, fileName);
    },
    onFileDone: () => {
      progressBar.handleOneFileDone();
    },
  });

  progressBar.stop();

  const happyWithResults = askBoolean("Are you happy with the results?", "true");
  if (!happyWithResults) {
    for (const file of files) await file.deleteOutput();
    showNotice(["Deleted all the output files."], true);
  }

  const deleteOriginalFiles = askBoolean("Do you want to delete the original files?", "false");
  if (deleteOriginalFiles) {
    for (const file of files) await file.deleteOriginal();
    showNotice(["Deleted all the original files."]);
  }
};

const fnMap: Record<string, (cliOpt: CliOptions) => Promise<void>> = {
  "Audio Compress": audioCompress,
  "Video Compress": videoCompress,
  Upgrade: (cliOpt: CliOptions) => upgrade(cliOpt.version),
};

const root = async (cliOpt: CliOptions) => {
  checkRequiredBinaries(Operations.GENERAL);
  const choice = askChoose("Select an operation", Object.keys(fnMap));
  const op = choice[0];
  if (!op || !fnMap[op]) throw new Error("No operation selected. Exiting.");

  await fnMap[op](cliOpt);
};

export default root;

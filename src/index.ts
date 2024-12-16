import { Operations } from "./types";
import { askBoolean, askChoose, askFilter, askPreset, showErrorAndExit, showNotice } from "./prompts";
import { compressVideo, compressAudio } from "./engine";
import { checkRequiredBinaries } from "./check";
import { File } from "./blueprints";
import { selectFiles } from "./file-selection";

process.on("uncaughtException", (error) => {
  // console.log(error.stack);
  showErrorAndExit([error.message]);
});

process.on("unhandledRejection", (error) => {
  // console.log(error);
  showErrorAndExit([error as string]);
});

const audioCompress = async () => {
  checkRequiredBinaries(Operations.AUDIO_COMPRESS);

  const files = selectFiles(File.exts.audio);
  const bitrate = askFilter("Select a bitrate", ["16k", "32k", "64k", "128k", "256k", "320k"], { limit: 1, min: 1 });

  await compressAudio(files, bitrate[0]);
};

const videoCompress = async () => {
  checkRequiredBinaries(Operations.VIDEO_COMPRESS);

  const files = selectFiles(File.exts.video);
  const preset = askPreset();
  const keepAudio = askBoolean("Do you want to keep the audio?", "true");

  await compressVideo(files, preset, { keepAudio });

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

const fnMap: Record<string, () => Promise<void>> = {
  "Audio Compress": audioCompress,
  "Video Compress": videoCompress,
};

const root = async () => {
  checkRequiredBinaries(Operations.GENERAL);

  const choice = askChoose("Select an operation", Object.keys(fnMap));
  const op = choice[0];
  if (!op || !fnMap[op]) throw new Error("No operation selected. Exiting.");

  await fnMap[op]();
};

export default root;

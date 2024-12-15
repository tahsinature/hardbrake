import { Operations } from "./types";
import { askBoolean, askChoose, askFiles, askFilter, askPreset, showErrorAndExit } from "./prompts";
import { compressVideo, compressAudio } from "./engine";
import { checkRequiredBinaries } from "./check";

process.on("uncaughtException", (error) => {
  const stackFirstLine = error.stack?.split("\n")[1] as string;
  showErrorAndExit([error.message, stackFirstLine]);
});

process.on("unhandledRejection", (error) => {
  showErrorAndExit([error as string]);
});

const videoCompress = async () => {
  checkRequiredBinaries(Operations.VIDEO_COMPRESS);

  const files = await askFiles(["mp4", "mkv", "avi", "mov", "flv", "wmv", "webm", "m4v", "lrf"]);
  const preset = await askPreset();
  const keepAudio = await askBoolean("Do you want to keep the audio?", "true");

  await compressVideo(files, preset, { keepAudio });

  const happyWithResults = await askBoolean("Are you happy with the results?", "true");
  if (!happyWithResults) {
    for (const file of files) await file.deleteOutput();
    console.log("Deleted all the output files.");
    process.exit(0);
  }

  const deleteOriginalFiles = await askBoolean("Do you want to delete the original files?", "false");
  if (deleteOriginalFiles) {
    for (const file of files) await file.deleteOriginal();
    console.log("Deleted all the original files.");
  }
};

const audioCompress = async () => {
  checkRequiredBinaries(Operations.AUDIO_COMPRESS);

  const files = await askFiles(["mp3", "wav", "flac", "m4a", "aac", "ogg", "wma", "aiff", "alac"]);
  const bitrate = await askFilter("Select a bitrate", ["16k", "32k", "64k", "128k", "256k", "320k"], { limit: 1, min: 1 });

  for (const file of files) {
    await compressAudio(file, bitrate[0]);
  }
};

const fnMap: Record<any, () => Promise<void>> = {
  [Operations.VIDEO_COMPRESS]: videoCompress,
  [Operations.AUDIO_COMPRESS]: audioCompress,
};

const root = async () => {
  checkRequiredBinaries(Operations.GENERAL);

  const choice = await askChoose("Select an operation", Object.values(Operations));
  const op = choice[0] as Operations;
  if (!op) throw new Error("No operation selected. Exiting.");

  await fnMap[op]();
};

export default root;

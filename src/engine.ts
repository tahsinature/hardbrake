import path from "path";
import fs from "fs";
import type { File } from "./blueprints";
import { createDirOvewriteRecursive, getFileSizeInMB, runShellCommandAndReturnLine, findBinaryPath, IS_WINDOWS } from "./utils";
import ffmpeg, { FfmpegCommand } from "fluent-ffmpeg";

// ─── Ensure fluent-ffmpeg can find the ffmpeg/ffprobe binaries ──────
// In bundled app context, fluent-ffmpeg's internal lookup may fail.
const ffmpegBin = findBinaryPath("ffmpeg");
const ffprobeBin = findBinaryPath("ffprobe");
if (ffmpegBin) ffmpeg.setFfmpegPath(ffmpegBin);
if (ffprobeBin) ffmpeg.setFfprobePath(ffprobeBin);

export interface FileResult {
  fileName: string;
  success: boolean;
  originalSizeMB: number;
  outputSizeMB: number;
  outputPath: string;
  error?: string;
}

export interface CompressionCallbacks {
  onProgress?: (percent: number, fileName: string, eta?: string) => void;
  onFileDone?: (result: FileResult) => void;
}

const compressAudioAsync = async (command: FfmpegCommand) => {
  return new Promise<void>((resolve, reject) => {
    command.on("end", () => resolve());
    command.on("error", (error) => {
      // Provide a more helpful message for common system-level crashes
      const msg = error?.message ?? String(error);
      if (msg.includes("SIGABRT") || msg.includes("SIGKILL")) {
        const fixHint = IS_WINDOWS
          ? "Try reinstalling ffmpeg: winget install Gyan.FFmpeg"
          : process.platform === "darwin"
            ? "Try running: brew reinstall ffmpeg"
            : "Try reinstalling ffmpeg via your package manager";
        reject(new Error(`ffmpeg crashed (${msg.includes("SIGABRT") ? "SIGABRT" : "SIGKILL"}). ` + `This usually means ffmpeg has broken library dependencies. ` + fixHint));
      } else {
        reject(error);
      }
    });
    command.run();
  });
};

/** Get audio duration in seconds using ffprobe */
const getAudioDuration = (filePath: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration ?? 0);
    });
  });
};

/** Parse a bitrate string like "128k" → 128000 (bits per second) */
const parseBitrateToBps = (bitrate: string): number => {
  const match = bitrate.match(/^(\d+)k$/i);
  if (match) return parseInt(match[1]) * 1000;
  return parseInt(bitrate);
};

const getProgressAndRemainingTime = (line: string) => {
  const progressMatch = line.match(/Encoding: task 1 of 1, (\d+\.\d+) %/);
  const progress = progressMatch ? parseFloat(progressMatch[1]) : null;

  const remainingTimeMatch = line.match(/ETA (\d+h\d+m\d+s)/);
  const remainingTime = remainingTimeMatch ? remainingTimeMatch[1] : null;

  return { progress, remainingTime };
};

export const compressAudio = async (files: File[], bitrate: string, options: { splitByMB?: number } & CompressionCallbacks = {}) => {
  const { splitByMB, onProgress, onFileDone } = options;

  for (const file of files) {
    const originalSizeMB = getFileSizeInMB(file.originalFullPath);
    const command = ffmpeg();
    command.input(file.originalFullPath);

    const outputFileName = `${file.alias}.mp3`;
    const labDir = file.createLabDir();
    const outputFullPathTemp = path.resolve(labDir, outputFileName);

    command.audioBitrate(bitrate);
    command.output(outputFullPathTemp);

    command.on("progress", (progress) => {
      const percent = parseInt(progress.percent as any);
      onProgress?.(percent, file.baseName);
    });

    await compressAudioAsync(command);

    let finalOutputPath = outputFullPathTemp;
    const outputSize = getFileSizeInMB(outputFullPathTemp);

    if (splitByMB && outputSize > splitByMB) {
      // ─── Time-based splitting using ffmpeg ─────────────────
      // Calculate how many seconds of audio fit in splitByMB at the given bitrate.
      const outputDir = path.join(file.dir, `${file.baseName}_split`);
      createDirOvewriteRecursive(outputDir);

      const totalDuration = await getAudioDuration(outputFullPathTemp);
      const bps = parseBitrateToBps(bitrate);
      // Max duration per chunk: (maxSizeBytes * 8) / bitsPerSecond
      // Use 95% of theoretical max to account for container overhead
      const maxChunkDurationSec = Math.floor((splitByMB * 1024 * 1024 * 8 * 0.95) / bps);
      const numChunks = Math.ceil(totalDuration / maxChunkDurationSec);

      for (let i = 0; i < numChunks; i++) {
        const startSec = i * maxChunkDurationSec;
        const partOutputPath = path.join(outputDir, `HardBraked__part${String(i + 1).padStart(3, "0")}.mp3`);

        const splitCmd = ffmpeg();
        splitCmd.input(outputFullPathTemp);
        splitCmd.setStartTime(startSec);
        splitCmd.setDuration(maxChunkDurationSec);
        splitCmd.audioCodec("copy"); // no re-encoding needed — already compressed
        splitCmd.output(partOutputPath);
        await compressAudioAsync(splitCmd);
      }

      // Clean up the full compressed file
      if (fs.existsSync(outputFullPathTemp)) fs.unlinkSync(outputFullPathTemp);
      finalOutputPath = outputDir;
    } else {
      const newLoc = path.resolve(file.dir, `${file.baseName}__HardBraked__${bitrate}.mp3`);
      fs.renameSync(outputFullPathTemp, newLoc);
      finalOutputPath = newLoc;
    }

    if (fs.existsSync(labDir)) fs.rmdirSync(labDir, { recursive: true });

    onFileDone?.({
      fileName: file.baseName,
      success: true,
      originalSizeMB,
      outputSizeMB: outputSize,
      outputPath: finalOutputPath,
    });
  }
};

/** Quote a file path for shell usage. Windows uses double quotes, Unix uses single quotes. */
const shellQuote = (p: string): string => {
  if (IS_WINDOWS) {
    // Double-quote and escape internal double-quotes
    return `"${p.replace(/"/g, '\\"')}"`;
  }
  // Unix: single-quote (escape embedded single quotes)
  return `'${p.replace(/'/g, "'\\''")}' `;
};

export const compressVideo = async (files: File[], preset: string, options: { keepAudio?: boolean } & CompressionCallbacks = {}) => {
  const { keepAudio = true, onProgress, onFileDone } = options;
  const audioFlag = keepAudio ? "" : "-a none";

  for (const file of files) {
    const outputFileName = `${file.baseName}__HardBraked__${preset}.mp4`;
    file.outputFullPath = path.resolve(file.dir, outputFileName);
    file.cmd = `HandBrakeCLI -i ${shellQuote(file.originalFullPath)} ${audioFlag} -o ${shellQuote(file.outputFullPath)} -Z ${shellQuote(preset)}`.trim();
  }

  for (const file of files) {
    if (!file.cmd) throw new Error(`Command not found for file: ${file.originalFullPath}`);

    const originalSizeMB = getFileSizeInMB(file.originalFullPath);

    await runShellCommandAndReturnLine(file.cmd, (line) => {
      const { progress, remainingTime } = getProgressAndRemainingTime(line);
      if (progress) {
        onProgress?.(progress, file.baseName, remainingTime ?? undefined);
      }
    });

    const outputSizeMB = file.outputFullPath ? getFileSizeInMB(file.outputFullPath) : 0;

    onFileDone?.({
      fileName: file.baseName,
      success: true,
      originalSizeMB,
      outputSizeMB,
      outputPath: file.outputFullPath!,
    });
  }
};

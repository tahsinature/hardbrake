import path from "path";
import fs from "fs";
import moment from "moment";
import os from "os";
import { createDirOvewriteRecursive, getFileSizeInMB } from "./utils";

export class File {
  dir: string;
  originalFullPath: string;
  baseName: string; // file name without extension
  alias: string | null = null;
  cmd = null as string | null;
  outputFullPath = null as string | null;

  static exts = {
    video: ["mp4", "mkv", "avi", "mov", "flv", "wmv", "webm", "m4v", "lrf"],
    audio: ["mp3", "wav", "flac", "m4a", "aac", "ogg", "wma", "aiff", "alac"],
  };

  constructor(fullPath: string) {
    this.originalFullPath = fullPath;
    this.dir = path.dirname(fullPath);
    this.baseName = path.basename(fullPath, path.extname(fullPath));
    const timeNow = new Date().toISOString();
    const type = this.getType();
    this.alias = `${type}_${timeNow}_${crypto.randomUUID()}`;
  }

  async deleteOriginal() {
    await fs.promises.unlink(this.originalFullPath);
  }

  async deleteOutput() {
    if (this.outputFullPath) await fs.promises.unlink(this.outputFullPath);
    else console.error(`Output file not found for ${this.originalFullPath}`);
  }

  getOutputFileSizeInMB() {
    if (!this.outputFullPath) throw new Error("Output file not found");
    return getFileSizeInMB(this.outputFullPath);
  }

  getType() {
    const ext = path.extname(this.originalFullPath).slice(1);
    if (File.exts.video.includes(ext)) return "video";
    if (File.exts.audio.includes(ext)) return "audio";
    return "unknown";
  }

  createLabDir() {
    const tmpDir = os.tmpdir();
    const dirName = `hardbrake_${this.alias}`;
    const labDir = path.join(tmpDir, dirName);

    return createDirOvewriteRecursive(labDir);
  }
}

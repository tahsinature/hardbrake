import path from "path";
import fs from "fs";

export class File {
  dir: string;
  originalFullPath: string;
  fileNameWithoutExtension: string;
  cmd = null as string | null;
  outputFullPath = null as string | null;

  constructor(fullPath: string) {
    this.originalFullPath = fullPath;
    this.dir = path.dirname(fullPath);
    this.fileNameWithoutExtension = path.basename(fullPath, path.extname(fullPath));
  }

  async deleteOriginal() {
    return fs.promises.unlink(this.originalFullPath);
  }

  async deleteOutput() {
    if (this.outputFullPath) fs.promises.unlink(this.outputFullPath);
    else console.error(`Output file not found for ${this.originalFullPath}`);
  }

  getOutputFileSizeInMB() {
    if (!this.outputFullPath) throw new Error("Output file not found");
    return fs.statSync(this.outputFullPath).size / 1024 / 1024;
  }
}

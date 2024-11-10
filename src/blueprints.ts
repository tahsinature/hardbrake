import path from "path";
import fs from "fs";

export class File {
  dir: string;
  fullPath: string;
  fileNameWithoutExtension: string;

  constructor(fullPath: string) {
    this.fullPath = fullPath;
    this.dir = path.dirname(fullPath);
    this.fileNameWithoutExtension = path.basename(fullPath, path.extname(fullPath));
  }

  async delete() {
    return fs.promises.unlink(this.fullPath);
  }
}

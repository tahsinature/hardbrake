import fs from "fs";
import path from "path";
import { File } from "./blueprints";
import { askChoose, askFilter } from "./prompts";
import { checkIfBinaryExists, runShellCommandAndReturnOutput } from "./utils";

const pickerMap: Record<string, (supportedExtensions: string[]) => File[]> = {
  xplr: (supportedExtensions: string[]) => {
    const isInstalled = checkIfBinaryExists("xplr");
    if (!isInstalled) throw new Error("xplr is not installed. Choose another file picker");

    const paths = runShellCommandAndReturnOutput(`xplr --read-only`);
    return paths.map((path: string) => new File(path));
  },
  nnn: (supportedExtensions: string[]) => {
    throw new Error("Not implemented");
  },
  manual: (supportedExtensions: string[]) => {
    const dir = process.cwd();
    const fileNames = fs.readdirSync(dir);
    const supportedFiles = fileNames.filter((file) => supportedExtensions.includes(file.split(".").pop() || ""));
    if (supportedFiles.length === 0) throw new Error("No files found in the folder");
    const selectedFiles = askFilter("Choose videos", supportedFiles, { min: 1 });
    if (selectedFiles.length === 0) throw new Error("No files selected");

    return selectedFiles.map((file) => new File(path.join(dir, file)));
  },
};

let selectedFilePicker: string = null as any;

export const selectFiles = (supportedExtensions: string[]) => {
  const choice = askChoose("Select a file manager", Object.keys(pickerMap));
  selectedFilePicker = choice[0];

  let files = pickerMap[selectedFilePicker](supportedExtensions);
  if (files.length === 0) throw new Error("No files selected");

  files = files.filter((file) => file.isSupported(supportedExtensions));
  if (files.length === 0) throw new Error("No supported files found");

  return files;
};

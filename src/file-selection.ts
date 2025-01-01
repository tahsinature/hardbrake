import fs from "fs";
import path from "path";
import { File } from "./blueprints";
import { askChoose, askFilter } from "./prompts";
import { checkIfBinaryExists, runShellCommandAndReturnOutput } from "./utils";

const getSupportedFilesFromCurrentDir = (supportedExtensions: string[]) => {
  const fileNames = fs.readdirSync(process.cwd());
  const supportedFiles = fileNames.filter((fileName) => supportedExtensions.includes(fileName.split(".").pop()?.toLowerCase() || ""));

  if (supportedFiles.length === 0) throw new Error("No files found in the folder");

  return supportedFiles;
};

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
    const supportedFiles = getSupportedFilesFromCurrentDir(supportedExtensions);

    const selectedFiles = askFilter("Choose videos", supportedFiles, { min: 1 });
    if (selectedFiles.length === 0) throw new Error("No files selected");

    return selectedFiles.map((file) => new File(path.join(process.cwd(), file)));
  },
  non_hardbraked: (supportedExtensions: string[]) => {
    const possible = ["hardbraked", "handbraked"];
    const nonHardBrakedSupportedFiles = getSupportedFilesFromCurrentDir(supportedExtensions).filter((path) => {
      return !possible.some((word) => path.toLowerCase().includes(word));
    });

    if (nonHardBrakedSupportedFiles.length === 0) throw new Error("No non-hardbraked files found");
    const selectedFiles = askFilter("Choose videos", nonHardBrakedSupportedFiles, { min: 1 });
    if (selectedFiles.length === 0) throw new Error("No files selected");

    return selectedFiles.map((file) => new File(path.join(process.cwd(), file)));

    return null as any;
  },
};

let selectedFilePicker: string = null as any;

export const selectFiles = (supportedExtensions: string[]) => {
  const choice = askChoose("Select a file manager", Object.keys(pickerMap));
  selectedFilePicker = choice[0];
  if (!selectedFilePicker) throw new Error("No file picker selected");

  let files = pickerMap[selectedFilePicker](supportedExtensions);
  if (files.length === 0) throw new Error("No files selected");

  files = files.filter((file) => file.isSupported(supportedExtensions));
  if (files.length === 0) throw new Error("No supported files found");

  return files;
};

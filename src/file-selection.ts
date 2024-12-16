import { File } from "./blueprints";
import fs from "fs";
import { askChoose, askFilter } from "./prompts";
import { checkIfBinaryExists, runShellCommandAndReturnOutput } from "./utils";
import path from "path";

const options = ["xplr", "nnn"];

const pickerMap: Record<string, () => File[]> = {
  xplr: () => {
    const paths = runShellCommandAndReturnOutput(`xplr --read-only`);
    return paths.map((path: string) => new File(path));
  },
  nnn: () => {
    throw new Error("Not implemented");
  },
};

let selectedFilePicker: string = null as any;

export const selectFiles = (supportedExtensions: string[]) => {
  let files = [] as File[];
  const available = options.filter((option) => checkIfBinaryExists(option));
  if (available.length) {
    const choice = askChoose("Select a file manager", available);
    selectedFilePicker = choice[0];
    files = pickerMap[selectedFilePicker]();
  } else {
    const dir = process.cwd();
    const fileNames = fs.readdirSync(dir);
    const supportedFiles = fileNames.filter((file) => supportedExtensions.includes(file.split(".").pop() || ""));
    if (supportedFiles.length === 0) throw new Error("No files found in the folder");
    const selectedFiles = askFilter("Choose videos", supportedFiles, { min: 1 });
    if (selectedFiles.length === 0) throw new Error("No files selected");

    files = selectedFiles.map((file) => new File(path.join(dir, file)));
  }

  if (files.length === 0) throw new Error("No files selected");
  files = files.filter((file) => supportedExtensions.includes(file.getExtension()));
  if (files.length === 0) throw new Error("No supported files found");
  return files;
};

import path from "path";
import fs from "fs";
import { getPresets, runShellCommandAndReturnOutput } from "./utils";
import { File } from "./blueprints";

export const askFiles = async (supportedExtensions: string[]) => {
  const dir = await askFolderPath();
  const files = fs.readdirSync(dir);
  const videos = files.filter((file) => supportedExtensions.includes(file.split(".").pop() || ""));
  if (videos.length === 0) throw new Error("No files found in the folder");
  const selectedVids = await askFilter("Choose videos", videos, { min: 1 });
  if (selectedVids.length === 0) throw new Error("No files selected");

  return selectedVids.map((file) => new File(path.join(dir, file)));
};

export const askFolderPath = async () => {
  console.log("Select a directory or, a file. If a file is selected, the parent directory will be used.");

  const command = `gum file --all --directory .`;
  const result = runShellCommandAndReturnOutput(command);
  if (result.length === 0) throw new Error("Nothing selected");
  let dirPath = result[0];

  const isDir = fs.lstatSync(dirPath).isDirectory();
  if (!isDir) dirPath = path.dirname(dirPath);
  return dirPath;
};

export const askChoose = async (message: string, choices: string[], { limit = 1 }: { limit?: number } = {}) => {
  try {
    const gumChoices = choices.join(",");
    let command = `gum choose {${gumChoices}}`;

    if (limit) command += ` --limit ${limit}`;
    else command += " --no-limit";

    return runShellCommandAndReturnOutput(command);
  } catch (error: any) {
    console.error(error.message);
    process.exit(1);
  }
};

export const askFilter = async (message: string, choices: string[], { limit = 0, min = 0 }: { limit?: number; min?: number } = {}) => {
  try {
    const gumChoices = choices.join("\n");
    let command = `echo "${gumChoices}" | gum filter`;

    if (limit) command += ` --limit ${limit}`;
    else command += " --no-limit";

    const selected = runShellCommandAndReturnOutput(command);
    if (selected.length < min) throw new Error("Minimum number of choices not selected");
    return selected;
  } catch (error: any) {
    console.error(error.message);
    process.exit(1);
  }
};

const fullPresetList = await getPresets();
const categories = Object.keys(fullPresetList);

export const askPreset = async () => {
  const category = await askFilter("Select a category", categories, { limit: 1, min: 1 });
  const presets = fullPresetList[category[0]];
  const preset = await askFilter("Select a preset", presets, { limit: 1, min: 1 });

  return preset[0];
};

export const askBoolean = async (message: string, initial?: "true" | "false") => {
  const defaultFlag = initial ? `--default=${initial}` : "";
  const command = `gum confirm ${defaultFlag} "${message}" && echo "true" || echo "false"`;
  const response = runShellCommandAndReturnOutput(command);
  return response[0] === "true";
};

export const askInteger = async (message: string, initial?: number) => {
  const initialFlag = initial ? `--value=${initial}` : "";
  const command = `gum input --placeholder="${message}" ${initialFlag}`;
  const response = runShellCommandAndReturnOutput(command);
  const nm = parseInt(response[0]);
  if (isNaN(nm)) throw new Error("Invalid number");

  return nm;
};

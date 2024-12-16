import path from "path";
import fs from "fs";
import { getPresets, runShellCommandAndReturnOutput, runShellCommandSimple } from "./utils";

export const askFolderPath = () => {
  console.log("Select a directory or, a file. If a file is selected, the parent directory will be used.");

  const command = `gum file --all --directory .`;
  const result = runShellCommandAndReturnOutput(command);
  if (result.length === 0) throw new Error("Nothing selected");
  let dirPath = result[0];

  const isDir = fs.lstatSync(dirPath).isDirectory();
  if (!isDir) dirPath = path.dirname(dirPath);
  return dirPath;
};

export const askChoose = (message: string, choices: string[], { limit = 1 }: { limit?: number } = {}) => {
  const formattedChoices = choices.map((choice) => choice.replace(/ /g, "\\ "));
  const gumChoices = formattedChoices.join(",");
  let command = `gum choose {${gumChoices}}`;

  if (limit) command += ` --limit ${limit}`;
  else command += " --no-limit";

  return runShellCommandAndReturnOutput(command);
};

export const askFilter = (message: string, choices: string[], { limit = 0, min = 0 }: { limit?: number; min?: number } = {}) => {
  const gumChoices = choices.join("\n");
  let command = `echo "${gumChoices}" | gum filter`;

  if (limit) command += ` --limit ${limit}`;
  else command += " --no-limit";

  const selected = runShellCommandAndReturnOutput(command);
  if (selected.length < min) throw new Error("Minimum number of choices not selected");
  return selected;
};

const fullPresetList = await getPresets();
const categories = Object.keys(fullPresetList);

export const askPreset = () => {
  const category = askFilter("Select a category", categories, { limit: 1, min: 1 });
  const presets = fullPresetList[category[0]];
  const preset = askFilter("Select a preset", presets, { limit: 1, min: 1 });

  return preset[0];
};

export const askBoolean = (message: string, initial?: "true" | "false") => {
  const defaultFlag = initial ? `--default=${initial}` : "";
  const command = `gum confirm ${defaultFlag} "${message}" && echo "true" || echo "false"`;
  const response = runShellCommandAndReturnOutput(command);
  return response[0] === "true";
};

export const askInteger = (message: string, initial?: number) => {
  const initialFlag = initial ? `--value=${initial}` : "";
  const command = `gum input --placeholder="${message}" ${initialFlag}`;
  const response = runShellCommandAndReturnOutput(command);
  const nm = parseInt(response[0]);
  if (isNaN(nm)) throw new Error("Invalid number");

  return nm;
};

export const showNotice = (messages: string[], shouldExit = false) => {
  const lines = messages.map((message) => `'${message}'`).join(" ");

  runShellCommandSimple(`gum style \
    --foreground 212 --border-foreground 212 --border double \
    --align center --margin "1 2" --padding "2 4" \
    ${lines}`);

  if (shouldExit) process.exit(0);
};

export const showErrorAndExit = (messages: string[]) => {
  const lines = messages.map((message) => `'${message}'`).join(" ");
  runShellCommandSimple(`gum style \
    --foreground 196 --border-foreground 196 --border double \
    --align center --margin "1 2" --padding "2 4" \
    ${lines}`);

  process.exit(1);
};

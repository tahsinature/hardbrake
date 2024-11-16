import prompts from "prompts";
import path from "path";
import { getPresets, runShellCommand } from "./utils";
import { File } from "./blueprints";

function promptsWithOnCancel<T extends string = string>(questions: prompts.PromptObject<T> | Array<prompts.PromptObject<T>>) {
  return prompts(questions, {
    onCancel: () => {
      process.exit(0);
    },
  });
}

export const askFiles = async () => {
  const supportedExt = ["mp4", "mkv", "avi", "mov", "flv", "wmv", "webm", "m4v", "lrf"];
  const extentionsFlags = supportedExt.map((ext) => `-e ${ext}`).join(" ");
  const command = `fd ${extentionsFlags} -t f --max-depth 1 --absolute-path . | fzf --multi --bind ctrl-space:toggle-all`;

  const files = await runShellCommand(command);
  if (!files) return [];

  const filtered = files.split("\n").filter(Boolean);
  return filtered.map((file) => path.resolve(file)).map((file) => new File(file));
};

const askAutoComplete = async (message: string, choices: string[]) => {
  const response = await promptsWithOnCancel({
    type: "autocomplete",
    name: "value",
    message,
    choices: choices.map((choice) => ({ title: choice, value: choice })),
  });

  return response.value;
};

const fullPresetList = await getPresets();
const categories = Object.keys(fullPresetList);

export const askPreset = async () => {
  const category = await askAutoComplete("Select a category", categories);
  const presets = fullPresetList[category];
  const preset = await askAutoComplete("Select a preset", presets);

  return preset;
};

export const askBoolean = async (message: string) => {
  const response = await promptsWithOnCancel({
    type: "confirm",
    name: "answer",
    message,
  });

  return response.answer;
};

export const askToggle = async (message: string, { initial = false } = {}) => {
  const response = await promptsWithOnCancel({
    type: "toggle",
    name: "value",
    message,
    initial,
    active: "yes",
    inactive: "no",
  });

  return response.value;
};

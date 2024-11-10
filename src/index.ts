import { askFiles, askPreset, askToggle } from "./prompts";
import { main } from "./engine";
import { checkRequiredBinaries } from "./check";

await checkRequiredBinaries();
const files = await askFiles();
const preset = await askPreset();

await main(files, preset);

const deleteOriginalFiles = await askToggle("Do you want to delete the original files?");
if (deleteOriginalFiles) for (const file of files) await file.delete();

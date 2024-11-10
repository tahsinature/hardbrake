import { askFiles, askPreset, askToggle } from "./prompts";
import { main } from "./engine";
import { checkRequiredBinaries } from "./check";

await checkRequiredBinaries();

const files = await askFiles();
if (files.length === 0) {
  console.log("No files selected. Exiting.");
  process.exit(0);
}

const preset = await askPreset();

await main(files, preset);

const happyWithResults = await askToggle("Are you happy with the results?");
if (!happyWithResults) {
  for (const file of files) await file.deleteOutput();
  console.log("Deleted all the output files.");
  process.exit(0);
}

const deleteOriginalFiles = await askToggle("Do you want to delete the original files?");
if (deleteOriginalFiles) {
  for (const file of files) await file.deleteOriginal();
  console.log("Deleted all the original files.");
}

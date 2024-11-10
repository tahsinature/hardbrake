import { runShellCommandAndReturnLine } from "./utils";

const checkIfBinaryExists = async (binary: string) => {
  const lines: string[] = [];
  await runShellCommandAndReturnLine(`which ${binary}`, (l) => l && lines.push(l));
  return lines.length > 0;
};

const requiredBinaries = [
  {
    name: "HandBrakeCLI",
    purpose: "HandBrake Command Line Version to encode videos.",
    howTo: `Download HandBrake Command Line Version from: https://handbrake.fr/downloads.php`,
  },
  {
    name: "fzf",
    purpose: "Fuzzy Finder to select multiple files.",
    howTo: `Install fzf from: https://github.com/junegunn/fzf#installation`,
  },
  {
    name: "fd",
    purpose: "To find and filter files.",
    howTo: `Install fd from: https://github.com/sharkdp/fd#installation`,
  },
];

export const checkRequiredBinaries = async () => {
  const missing = [];

  for (const binary of requiredBinaries) {
    const isFound = await checkIfBinaryExists(binary.name);
    if (!isFound) missing.push(binary);
  }

  if (missing.length) {
    console.error(`The following binaries are required to run this program:
----------`);
    for (const binary of missing) {
      console.error(`- ${binary.name}: ${binary.purpose}`);
      console.error(binary.howTo);
    }
    process.exit(1);
  }
};

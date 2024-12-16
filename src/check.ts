import { Operations, type Binary } from "./types";
import { checkIfBinaryExists } from "./utils";

export const commonRequiredBinaries: Binary[] = [
  {
    name: "gum",
    purpose: "Gum is a CLI tool to interact with the terminal.",
    howTo: `Install gum from: https://github.com/charmbracelet/gum`,
  },
];

const requiredBinariesForVideo: Binary[] = [
  ...commonRequiredBinaries,
  {
    name: "HandBrakeCLI",
    purpose: "HandBrake Command Line Version to encode videos.",
    howTo: `Download HandBrake Command Line Version from: https://handbrake.fr/downloads.php`,
  },
];

const requiredBinariesForAudio: Binary[] = [
  ...commonRequiredBinaries,
  {
    name: "ffmpeg",
    purpose: "FFmpeg to encode audio files.",
    howTo: `See github: https://github.com/FFmpeg/FFmpeg and find installation instructions for your OS.`,
  },
];

const mappedByOp = {
  [Operations.VIDEO_COMPRESS]: requiredBinariesForVideo,
  [Operations.AUDIO_COMPRESS]: requiredBinariesForAudio,
  [Operations.GENERAL]: commonRequiredBinaries,
};

export const checkRequiredBinaries = (op: Operations) => {
  const requiredBinaries = mappedByOp[op] as { name: string; purpose: string; howTo: string }[];

  checkBinaries(requiredBinaries);
};

export const checkBinaries = (binaries: Binary[]) => {
  const missing = [];

  for (const binary of binaries) {
    const isFound = checkIfBinaryExists(binary.name);
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

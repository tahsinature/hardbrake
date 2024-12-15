import { Operations } from "./types";
import { runShellCommandAndReturnLine } from "./utils";

const checkIfBinaryExists = async (binary: string) => {
  const lines: string[] = [];
  await runShellCommandAndReturnLine(`which ${binary}`, (l) => l && lines.push(l));
  return lines.length > 0;
};

const commonRequiredBinaries = [
  {
    name: "gum",
    purpose: "To convert audio files to mp3.",
    howTo: `Install gum from: https://github.com/charmbracelet/gum`,
  },
];

const requiredBinariesForVideo = [
  ...commonRequiredBinaries,
  {
    name: "HandBrakeCLI",
    purpose: "HandBrake Command Line Version to encode videos.",
    howTo: `Download HandBrake Command Line Version from: https://handbrake.fr/downloads.php`,
  },
];

const requiredBinariesForAudio = [
  ...commonRequiredBinaries,
  {
    name: "ffmpeg",
    purpose: "FFmpeg to encode audio files.",
    howTo: `See github: https://github.com/FFmpeg/FFmpeg and find installation instructions for your OS.`,
  },
  {
    name: "split",
    purpose: "To split files.",
    howTo: `Search google and install split for your OS.`,
  },
];

const mappedByOp = {
  [Operations.VIDEO_COMPRESS]: requiredBinariesForVideo,
  [Operations.AUDIO_COMPRESS]: requiredBinariesForAudio,
};

export const checkRequiredBinaries = async (op: Operations) => {
  const missing = [];
  const requiredBinaries = mappedByOp[op] as { name: string; purpose: string; howTo: string }[];

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

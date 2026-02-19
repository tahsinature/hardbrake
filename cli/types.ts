export enum Operations {
  AUDIO_COMPRESS = "AUDIO_COMPRESS",
  VIDEO_COMPRESS = "VIDEO_COMPRESS",
  GENERAL = "GENERAL",
}

export type Binary = {
  name: string;
  purpose: string;
  howTo: string;
};

export type CliOptions = {
  version: string;
  filePaths: string[];
};

import cliProgress from "cli-progress";

export class ProgressBar {
  multibar = new cliProgress.MultiBar(
    {
      clearOnComplete: false,
      hideCursor: true,
      format: "{context} {bar} | {percent} | ETA: {eta}s | {filename}",
    },
    cliProgress.Presets.shades_grey
  );

  b1 = this.multibar.create(100, 0, {
    context: "Current",
  });

  b2 = this.multibar.create(0, 0, {
    context: "  Total",
    percent: "-",
    filename: "-",
  });

  constructor(totalFiles: number) {
    this.b2.setTotal(totalFiles);
  }

  handleNewLine(percent: number, filename: string) {
    this.b1.update(percent, {
      filename,
      percent: `${percent}%`,
    });
  }

  handleOneFileDone() {
    this.b1.update(100, {
      percent: "100%",
    });
    this.b2.increment();
  }

  stop() {
    this.multibar.stop();
    this.b1.stop();
    this.b2.stop();
  }
}

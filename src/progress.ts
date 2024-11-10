import cliProgress from "cli-progress";

export class ProgressBar {
  multibar = new cliProgress.MultiBar(
    {
      clearOnComplete: false,
      hideCursor: true,
      format: "{context} {bar} | {percent} | ETA: {eta}s | ETA HB: {etaHB} | {filename}",
    },
    cliProgress.Presets.shades_grey
  );

  b1 = this.multibar.create(100, 0, {
    context: "Current",
  });

  b2 = this.multibar.create(0, 0, {
    context: "  Total",
    percent: "-",
    etaHB: "-",
    filename: "-",
  });

  constructor(totalFiles: number) {
    this.b2.setTotal(totalFiles);
  }

  handleNewLine(percent: number, eta: string, filename: string) {
    this.b1.update(percent, {
      filename,
      percent: `${percent}%`,
      etaHB: eta,
    });
  }

  handleOneFileDone() {
    this.b1.update(100, {
      percent: "100%",
      etaHB: "0s",
    });
    this.b2.increment();
  }

  stop() {
    this.multibar.stop();
    this.b1.stop();
    this.b2.stop();
  }
}

// const files = ["file1.mp4", "file2.mp4", "file3.mp4", "file4.mp4", "file5.mp4"];

// const progress = new ProgressBar(files.length);
// for (const file of files) {
//   for (let i = 0; i <= 97; i++) {
//     progress.handleNewLine(i, "10s", file);
//     await sleep(10);
//   }

//   progress.handleOneFileDone();
// }

// await sleep(1000);
// progress.stop();

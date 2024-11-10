import { execSync, spawn } from "child_process";
import blessed from "blessed";
import contrib, { Widgets } from "blessed-contrib";

const ping = (server: string, log: Widgets.LogElement) => {
  const command = `ping ${server}`;
  // console.log current ping
  // on each ping, update the console.log. no new lines

  var out = spawn(command, { stdio: ["inherit", "pipe", "inherit"], shell: true, argv0: "node" });

  out.stdout.setEncoding("utf-8");
  out.stdout.on("readable", () => {
    const data = out.stdout.read();
    log.log(data);
  });
};

export const main = async () => {
  const screen = blessed.screen();

  screen.key(["escape", "q", "C-c"], function (ch, key) {
    screen.destroy();
    // screen.removeAllListeners();
    // return process.exit(0);
  });
  const grid = new contrib.grid({ rows: 2, cols: 1, screen });

  const log1 = grid.set(0, 0, 1, 1, contrib.log, { fg: "green", selectedFg: "green", label: "Google Log", height: 2 });
  const log2 = grid.set(1, 0, 1, 1, contrib.log, { fg: "green", selectedFg: "green", label: "Yahoo Log", height: "100%" });

  ping("google.com", log1);
  ping("yahoo.com", log2);

  // const runShellCommand = async (cmd: string): Promise<string> => {
  //   return new Promise((resolve, reject) => {
  //     var out = spawn(cmd, {
  //       stdio: ["inherit", "pipe", "inherit"],
  //       shell: true,
  //       argv0: "node",
  //     });

  //     out.stdout.setEncoding("utf-8");
  //     out.stdout.on("readable", () => resolve(out.stdout.read()));
  //   });
  // };

  // const askFiles = async () => {
  //   const files = await runShellCommand("fzf --multi");
  //   const filtered = files.split("\n").filter(Boolean);
  //   return filtered.map((file) => path.resolve(file));
  // };

  // const printHandBrakeCLIVersion = async () => {
  //   const o = execSync("HandBrakeCLI --version", { stdio: ["inherit", "pipe"] });
  //   const out = o.toString().split("\n").filter(Boolean);

  //   console.log(out[0]);
  // };

  // printHandBrakeCLIVersion();

  // const files = await askFiles();

  // for (const file of files) {
  //   console.log(file);
  //   // const cmd = `hardbrake -i ${file} -o ${file}.mp4`;
  //   // console.log(cmd);
  //   // await runShellCommand(cmd);
  // }

  // function clearLine() {
  //   readline.cursorTo(process.stdout, 0, 0);
  //   readline.clearLine(process.stdout, 0);
  // }

  // var log = contrib.log({ fg: "green", selectedFg: "green", label: "Server Log" });

  // log.log("Starting server...");

  const displayCurrentTask = async () => {
    const command = `ping facebook.com.com`;
    // console.log current ping
    // on each ping, update the console.log. no new lines

    var out = spawn(command, { stdio: ["inherit", "pipe", "inherit"], shell: true, argv0: "node" });

    out.stdout.setEncoding("utf-8");
    out.stdout.on("readable", () => {
      const data = out.stdout.read();
      log1.log(data);
      // clearLine();
      // process.stdout.write(data);
    });
  };

  displayCurrentTask();

  screen.append(log1);
  screen.append(log2);
  screen.render();
};

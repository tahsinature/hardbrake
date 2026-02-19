import { askBoolean, showNotice } from "./prompts";
import { runShellCommandSimple } from "./utils";

const upgrade = async (currentVersion: string) => {
  const url = "https://registry.npmjs.org/hardbrake";

  const response = await fetch(url);
  const data = await response.json();
  const latestVersion = data["dist-tags"].latest;
  const isLatest = latestVersion === currentVersion;

  console.log(`Current: HardBrake v${currentVersion}`);

  if (isLatest) showNotice(["You are already using the latest version", `Version: ${latestVersion}`]);
  else {
    const cmd = `bun add -g hardbrake@${latestVersion}`;
    const msg = `A new version ${latestVersion} is available. Do you want to upgrade now?`;
    const shouldUpgradeNow = askBoolean(msg, "true");
    if (shouldUpgradeNow) {
      console.log(`🚀 Upgrading to version ${latestVersion}...`);
      console.log("Cleaning cache...");
      runShellCommandSimple("bun pm -g cache rm");
      console.log(`👨🏻‍💻 Running: ${cmd}`);
      runShellCommandSimple(cmd);
      showNotice([`Upgrade to version ${latestVersion} successful.`, "Please restart the CLI."], true);
    } else {
      showNotice(["Upgrade later by running: ", cmd], true);
    }
  }
};

export default upgrade;

#!/usr/bin/env node
/**
 * Syncs the version from package.json into:
 *   - src-tauri/tauri.conf.json
 *   - src-tauri/Cargo.toml
 *
 * Called automatically by semantic-release via the @semantic-release/exec plugin,
 * or manually if needed.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = pkg.version;

// ── tauri.conf.json ──
const tauriConfPath = path.join(root, "src-tauri", "tauri.conf.json");
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf8"));
tauriConf.version = version;
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n");
console.log(`  tauri.conf.json → ${version}`);

// ── Cargo.toml ──
const cargoPath = path.join(root, "src-tauri", "Cargo.toml");
let cargo = fs.readFileSync(cargoPath, "utf8");
cargo = cargo.replace(/^version\s*=\s*".*"/m, `version = "${version}"`);
fs.writeFileSync(cargoPath, cargo);
console.log(`  Cargo.toml      → ${version}`);

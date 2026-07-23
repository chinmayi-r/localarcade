import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("R1 runner has no HTTP client, socket, or updater crates", async () => {
  const cargo = await readFile(new URL("../runner/src-tauri/Cargo.toml", import.meta.url), "utf8");
  for (const forbidden of ["reqwest", "hyper", "ureq", "curl", "tokio-tungstenite", "tauri-plugin-updater", "tauri-plugin-http"]) {
    assert.doesNotMatch(cargo, new RegExp(`^\\s*"?${forbidden}"?\\s*=`, "m"), `${forbidden} must not be a runner dependency in R1`);
  }
});

test("R1 capabilities grant core IPC only", async () => {
  const capability = JSON.parse(await readFile(new URL("../runner/src-tauri/capabilities/default.json", import.meta.url), "utf8"));
  assert.deepEqual(capability.permissions, ["core:default"]);
});

test("R1 config has a strict CSP and no updater or plugin section", async () => {
  const conf = JSON.parse(await readFile(new URL("../runner/src-tauri/tauri.conf.json", import.meta.url), "utf8"));
  assert.ok(conf.app.security.csp && conf.app.security.csp.includes("default-src 'self'"), "CSP must be strict, not null");
  assert.equal(conf.plugins, undefined, "no plugins may be configured in R1");
  assert.equal(conf.identifier, "org.localarcade.runner");
});

test("R3 scan module contains no write APIs at all", async () => {
  const source = await readFile(new URL("../runner/src-tauri/src/model_store.rs", import.meta.url), "utf8");
  for (const forbidden of ["fs::write", "File::create", "OpenOptions", "create_dir", "remove_file", "remove_dir", "set_len", "fs::copy", "fs::rename", "hard_link", "symlink"]) {
    assert.ok(!source.includes(forbidden), `${forbidden} must not appear in the read-only scan module`);
  }
});

test("R4 benchmark module spawns exactly llama-bench and nothing else", async () => {
  const source = await readFile(new URL("../runner/src-tauri/src/benchmark.rs", import.meta.url), "utf8");
  const spawnSites = source.match(/Command::new\(([^)]*)\)/g) ?? [];
  assert.equal(spawnSites.length, 1, "exactly one spawn site is allowed");
  assert.match(source, /const BENCH_EXECUTABLE: &str = "llama-bench";/);
  assert.ok(spawnSites[0].includes("&executable"), "the spawn site must use the checked llama-bench path");
  for (const forbidden of ["reqwest", "TcpStream", "UdpSocket", "fs::write", "File::create"]) {
    assert.ok(!source.includes(forbidden), `${forbidden} must not appear in the benchmark module`);
  }
});

test("M-J verification adapter has no IPC, network, download, update, upload, or child-isolation claim", async () => {
  const source = await readFile(new URL("../runner/src-tauri/src/verification.rs", import.meta.url), "utf8");
  for (const forbidden of [
    /#\[tauri::command\]/,
    /Command::new/,
    /TcpStream|UdpSocket|reqwest|hyper|ureq|fetch\s*\(/,
    /tauri_plugin_(?:http|updater)|download_file|upload_file/i,
    /AppContainer|CreateRestrictedToken|JobObject/i,
    /File::create|OpenOptions|fs::write|remove_file|remove_dir/,
  ]) assert.doesNotMatch(source, forbidden);
  assert.match(source, /SideEffects\s*\{[\s\S]*?executes_local_process:\s*true,[\s\S]*?loads_model:\s*true,[\s\S]*?writes_model_store:\s*false,[\s\S]*?network:\s*false,[\s\S]*?upload:\s*false,[\s\S]*?\}/);
  assert.match(source, /child-isolation-not-enforced/);
});

test("R1 frontend makes no external requests", async () => {
  const main = await readFile(new URL("../runner/src/main.ts", import.meta.url), "utf8");
  const html = await readFile(new URL("../runner/index.html", import.meta.url), "utf8");
  for (const source of [main, html]) {
    assert.doesNotMatch(source, /https?:\/\//, "no external URLs in the R1 runner frontend");
    assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket/, "no request APIs in the R1 runner frontend");
  }
});

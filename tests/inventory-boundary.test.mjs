import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("M-I adapter is read-only, local, and does not change the IPC boundary", async () => {
  const adapter = await readFile(new URL("../runner/src-tauri/src/model_store/inventory.rs", import.meta.url), "utf8");
  const modelStore = await readFile(new URL("../runner/src-tauri/src/model_store.rs", import.meta.url), "utf8");
  const runner = await readFile(new URL("../runner/src-tauri/src/lib.rs", import.meta.url), "utf8");

  assert.match(modelStore, /pub mod inventory;/);
  assert.doesNotMatch(runner, /adapt_scan_report|inventory_result|inventory::/);
  for (const forbidden of [
    "std::fs", "fs::write", "File::create", "OpenOptions", "Command::new",
    "reqwest", "TcpStream", "UdpSocket", "fetch(", "download", "upload",
  ]) {
    assert.ok(!adapter.includes(forbidden), `${forbidden} must not enter the M-I adapter`);
  }
  assert.doesNotMatch(adapter, /use sha2|Sha256::new|std::fs::read|read_to_end/, "M-I must not hash every discovered file");
});

test("M-I owns lifecycle reconciliation without changing generated registry data", async () => {
  const adapter = await readFile(new URL("../runner/src-tauri/src/model_store/inventory.rs", import.meta.url), "utf8");
  assert.match(adapter, /RegistryLifecycle::Promoted/);
  assert.match(adapter, /registry\.artifact-not-promoted/);
  assert.match(adapter, /snapshot\.quarantine/);
  assert.match(adapter, /is_known_quarantine_code/);
  assert.match(adapter, /registry\.snapshot-not-fresh/);
  assert.match(adapter, /inventory\.hash-size-mismatch/);
});

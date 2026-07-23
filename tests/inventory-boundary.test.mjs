import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("M-I adapter is local and hashes only one explicit retained selection", async () => {
  const adapter = await readFile(new URL("../runner/src-tauri/src/model_store/inventory.rs", import.meta.url), "utf8");
  const modelStore = await readFile(new URL("../runner/src-tauri/src/model_store.rs", import.meta.url), "utf8");
  const runner = await readFile(new URL("../runner/src-tauri/src/lib.rs", import.meta.url), "utf8");
  const preview = await readFile(new URL("../runner/src-tauri/src/preview_adapter.rs", import.meta.url), "utf8");

  assert.match(modelStore, /pub mod inventory;/);
  for (const forbidden of [
    "fs::write", "File::create", ".write_all(", "remove_file", "rename(",
    "Command::new",
    "reqwest", "TcpStream", "UdpSocket", "fetch(", "download", "upload",
  ]) {
    assert.ok(!adapter.includes(forbidden), `${forbidden} must not enter the M-I adapter`);
  }
  assert.match(adapter, /pub trait SelectedFileHashBoundary/);
  assert.match(adapter, /promote_selected_file_with_boundary/);
  assert.match(adapter, /selected_path/);
  assert.match(adapter, /CandidateBySize/);
  assert.match(adapter, /before != after/);
  assert.match(adapter, /FILE_SHARE_READ/);
  assert.doesNotMatch(adapter, /std::fs::read|read_to_end/);
  assert.match(runner, /hash_selected_inventory_file_preview/);
  assert.match(preview, /hash_and_select_inventory_path/);
  assert.match(preview, /preview_only: true/);
  assert.match(preview, /grants_execution_authorization: false/);
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

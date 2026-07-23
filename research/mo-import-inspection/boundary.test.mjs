import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("runner import inspection has no UI, port, filesystem, process or network dependency", () => {
  const source = [
    "runner-import.ts",
    "runner-import-types.ts",
  ].map((file) => readFileSync(
    new URL(`../../lib/orchestrator/${file}`, import.meta.url),
    "utf8",
  )).join("\n");
  for (const forbidden of [
    "node:fs",
    "node:child_process",
    "node:http",
    "node:https",
    "@tauri-apps",
    "fetch(",
    "app/",
    "runner/src",
    "scanModelStores",
    "execute(",
    "download",
    "upload",
  ]) {
    assert.equal(source.includes(forbidden), false, `forbidden import/use: ${forbidden}`);
  }
});

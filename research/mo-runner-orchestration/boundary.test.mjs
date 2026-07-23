import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("M-O runner orchestration has no UI, filesystem, process or network dependency", () => {
  const source = [
    "runner.ts",
    "runner-types.ts",
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
    "../model_store",
    "../verification",
  ]) {
    assert.equal(source.includes(forbidden), false, `forbidden import/use: ${forbidden}`);
  }
});

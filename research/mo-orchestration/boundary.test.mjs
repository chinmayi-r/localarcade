import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("M-O is a pure composition boundary", () => {
  const source = readFileSync(
    new URL("../../lib/orchestrator/index.ts", import.meta.url),
    "utf8",
  );
  for (const forbidden of [
    "../recommendation",
    "../registry",
    "../assessment",
    "../evidence",
    "node:fs",
    "node:child_process",
    "node:http",
    "node:https",
    "@tauri-apps",
    "fetch(",
    "app/",
    "runner/",
  ]) {
    assert.equal(source.includes(forbidden), false, `forbidden import/use: ${forbidden}`);
  }
});

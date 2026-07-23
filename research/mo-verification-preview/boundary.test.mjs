import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("verification preview exposes preparation only and has no execution or I/O dependency", () => {
  const sources = [
    "verification-preview.ts",
    "verification-preview-types.ts",
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
    "executeVerification",
    "runVerification",
    "startVerification",
    "stopVerification",
    "download",
    "runner/src",
    "app/",
  ]) {
    assert.equal(sources.includes(forbidden), false, `forbidden capability: ${forbidden}`);
  }
  assert.equal(sources.includes("prepareVerificationPlan("), true);
  assert.equal(sources.includes("grantsExecutionAuthorization: false"), true);
});

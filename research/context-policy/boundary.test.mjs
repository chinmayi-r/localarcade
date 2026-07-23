import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sources = await Promise.all([
  readFile(new URL("../../lib/context-policy/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../../lib/context-policy/types.ts", import.meta.url), "utf8"),
]);

test("task-context policy has no UI, orchestration, I/O, or product-algorithm imports", () => {
  const source = sources.join("\n");
  for (const forbidden of [
    "lib/orchestrator",
    "../orchestrator",
    "lib/portfolio",
    "../portfolio",
    "lib/recommendation",
    "../recommendation",
    "node:fs",
    "node:child_process",
    "node:http",
    "node:https",
    "fetch(",
    "app/",
    "react",
  ]) {
    assert.equal(source.includes(forbidden), false, `forbidden dependency: ${forbidden}`);
  }
});

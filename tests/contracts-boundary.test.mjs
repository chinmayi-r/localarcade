import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../lib/contracts/", import.meta.url);

test("M-A core has no dependency on recommendation, UI, runner, registry, or network modules", async () => {
  for (const file of ["types.ts", "canonical.ts", "validator.ts", "index.ts"]) {
    const source = await readFile(new URL(file, root), "utf8");
    assert.doesNotMatch(source, /from ["'][^"']*(recommendation|registry|app\/|runner)[^"']*["']/);
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket|node:(?:fs|http|https|net)/);
  }
});

test("legacy recommendation imports are isolated to the explicit adapter", async () => {
  const adapter = await readFile(new URL("adapters/recommendation.ts", root), "utf8");
  assert.match(adapter, /recommendation\/types/);
  assert.doesNotMatch(adapter, /candidate-evaluation|presentation|catalog|fetch\(/);
});

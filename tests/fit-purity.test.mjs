import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the M2 fit module has no I/O or environment imports", async () => {
  for (const file of ["fit.ts", "types.ts", "index.ts"]) {
    const source = await readFile(new URL(`../lib/fit/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /node:(?:fs|path|http|https|net|os|child_process)|process\.(?:env|cwd)|\bfetch\s*\(/);
  }
});

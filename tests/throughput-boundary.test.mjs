import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("M3 priors are not wired into the website or prototype ranking before M4", async () => {
  for (const file of [
    "../app/arena-app.tsx",
    "../lib/recommendation/engine.ts",
    "../lib/recommendation/eligibility/memory.ts",
  ]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /lib\/priors|from ["'][^"']*priors/);
  }
});

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("comparison research does not import production or M-A packages", async () => {
  const here = new URL("./", import.meta.url);
  const files = (await readdir(here)).filter((file) => file.endsWith(".ts") && file !== "boundary.test.ts");
  for (const file of files) {
    const source = await readFile(new URL(file, here), "utf8");
    assert.doesNotMatch(source, /from\s+["'][^"']*(?:app|lib|runner)\//, `${file} imports a production path`);
    assert.doesNotMatch(source, /from\s+["'][^"']*lib\/contracts/, `${file} imports M-A`);
    assert.doesNotMatch(source, /\bfetch\s*\(|node:https|node:http|node:net/, `${file} adds an external-ingestion path`);
  }
});

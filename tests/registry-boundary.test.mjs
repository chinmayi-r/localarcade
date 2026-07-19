import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production prototype catalog does not import generated registry data before M4", async () => {
  const source = await readFile(new URL("../lib/recommendation/catalog/demo-artifacts.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /registry\/generated|generated\/artifacts/);
});

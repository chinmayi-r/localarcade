import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("M4 production imports real registry data and the demo catalog is gone", async () => {
  const source = await readFile(new URL("../lib/recommendation/catalog/real-candidates.ts", import.meta.url), "utf8");
  assert.match(source, /registry\/generated\/artifacts\.json/);
  await assert.rejects(access(new URL("../lib/recommendation/catalog/demo-artifacts.ts", import.meta.url)));
  const engine = await readFile(new URL("../lib/recommendation/engine.ts", import.meta.url), "utf8");
  assert.doesNotMatch(engine, /demo-artifacts|baselineTokensPerSecond|taskScores/);
});

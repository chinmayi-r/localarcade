import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("M4 wires priors through the engine without reimplementing evidence lookup in UI", async () => {
  const engine = await readFile(new URL("../lib/recommendation/engine.ts", import.meta.url), "utf8");
  assert.match(engine, /from "\.\.\/priors"/);
  assert.match(engine, /estimateThroughput/);
  const app = await readFile(new URL("../app/arena-app.tsx", import.meta.url), "utf8");
  const cards = await readFile(new URL("../app/components/finder/recommendation-list.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(app + cards, /estimateThroughput|throughputPriors/);
});

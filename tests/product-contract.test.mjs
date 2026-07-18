import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the product states what is real and what is example data", async () => {
  const app = await read("../app/arena-app.tsx");
  assert.match(app, /PROTOTYPE DATA · NOT A PUBLISHED LEADERBOARD/);
  assert.match(app, /Recommendation evidence/);
  assert.match(app, /isolated prototype catalog/);
});

test("the contribution promise requires explicit user control", async () => {
  const app = await read("../app/arena-app.tsx");
  assert.match(app, /NO ACCOUNT · NO TELEMETRY · NO DOWNLOAD/);
  assert.match(app, /Runner · planned/);
});

test("interactive controls expose accessible semantics", async () => {
  const app = await read("../app/arena-app.tsx");
  assert.match(app, /aria-label=/);
  assert.match(app, /aria-label=/);
  assert.match(app, /<ConfigurationPanel/);
});

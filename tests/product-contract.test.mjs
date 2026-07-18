import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the product states what is real and what is example data", async () => {
  const app = await read("../app/arena-app.tsx");
  assert.match(app, /illustrative fit and speed estimates · no production claims/);
  assert.match(app, /ESTIMATED · LOW CONFIDENCE/);
  assert.match(app, /A measurement on your machine or a claim that rank #1 is objectively best/);
});

test("the contribution promise requires explicit user control", async () => {
  const app = await read("../app/arena-app.tsx");
  assert.match(app, /No account\. No runner\. No telemetry/);
  assert.match(app, /choose whether to verify/);
  assert.match(app, /Optional contribution/i);
});

test("interactive controls expose accessible semantics", async () => {
  const app = await read("../app/arena-app.tsx");
  assert.match(app, /aria-label=/);
  assert.match(app, /aria-live="polite"/);
  assert.match(app, /<legend>/);
});

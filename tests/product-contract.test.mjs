import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the product states what is real and what is example data", async () => {
  const app = await read("../app/arena-app.tsx");
  assert.match(app, /Example data · not a published claim/);
  assert.match(app, /Vote recorded locally for this demo/);
  assert.match(app, /Self-reported context is labeled separately/);
});

test("the contribution promise requires explicit user control", async () => {
  const app = await read("../app/arena-app.tsx");
  assert.match(app, /never downloads a model or starts a job without your approval/i);
  for (const control of ["storage", "bandwidth", "schedule", "power"]) {
    assert.match(app.toLowerCase(), new RegExp(control));
  }
});

test("interactive controls expose accessible semantics", async () => {
  const app = await read("../app/arena-app.tsx");
  assert.match(app, /aria-pressed=/);
  assert.match(app, /aria-label=/);
  assert.match(app, /role="status"/);
  assert.match(app, /htmlFor="email"/);
});

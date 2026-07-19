import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the product states what is sourced and what remains unavailable", async () => {
  const app = await read("../app/arena-app.tsx");
  assert.match(app, /CURRENT COVERAGE: CPU · LLAMA\.CPP · LLAMA 3\.2 1B/);
  assert.match(app, /Ranking evidence/);
  assert.match(app, /Results remain unranked/);
});

test("the contribution promise requires explicit user control", async () => {
  const app = await read("../app/arena-app.tsx");
  assert.match(app, /NO ACCOUNT · NO TELEMETRY · NO DOWNLOAD/);
  assert.match(app, /Runner · planned/);
});

test("the website describes multi-product support without conflating apps and engines", async () => {
  const app = await read("../app/arena-app.tsx");
  assert.match(app, /llama\.cpp, Ollama, LM Studio, Jan, MLX LM and vLLM/);
  assert.match(app, /Apps and engines stay separate/);
});

test("interactive controls expose accessible semantics", async () => {
  const app = await read("../app/arena-app.tsx");
  assert.match(app, /aria-label=/);
  assert.match(app, /aria-label=/);
  assert.match(app, /<ConfigurationPanel/);
});

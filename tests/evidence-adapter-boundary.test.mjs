import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../lib/evidence/adapters.ts", import.meta.url), "utf8");

test("M-G adapters remain pure and outside UI, ranking, storage, registry data and public contribution boundaries", () => {
  for (const forbidden of [
    /from ["']node:fs["']/,
    /\bfetch\s*\(/,
    /\bprocess\.(?:env|cwd|platform)\b/,
    /from ["'][^"']*\/recommendation(?:\/|["'])/,
    /from ["'][^"']*\/app(?:\/|["'])/,
    /registry\/generated/,
    /registry\/evidence/,
    /\bupload\b/i,
    /\bpublish(?:ed|ing)?\b/i,
    /\bprototype\b/i,
  ]) {
    assert.doesNotMatch(source, forbidden);
  }
});

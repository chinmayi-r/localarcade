import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import test from "node:test";

const files = globSync("lib/assessment/**/*.{ts,tsx,mts,mjs}", {
  cwd: new URL("../..", import.meta.url),
});

test("M-F is an isolated pure boundary with no UI, ranking or side-effect imports", () => {
  assert.ok(files.length > 0, "the M-F implementation directory must exist");
  const forbidden = [
    /\bfrom\s+["'][^"']*(?:app|components|ranking|recommendation|battles|runner|worker)[^"']*["']/i,
    /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/,
    /\b(?:child_process|node:net|node:http|node:https|node:fs|node:process)\b/,
    /\bprocess\s*\.\s*env\b/,
    /\bimport\s*\(\s*["']node:/,
    /\brequire\s*\(/,
    /\b(?:localStorage|sessionStorage|indexedDB|sendBeacon)\b/,
    /\b(?:from\s+|import\s*\()\s*["'][^"']*(?:registry[\\/](?:generated|evidence)|evidence[\\/][^"']*\.json|\.json)["']/i,
    /\b(?:spawn|exec|writeFile|appendFile|unlink|rm)\s*\(/,
  ];
  for (const file of files) {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    for (const pattern of forbidden) {
      assert.doesNotMatch(source, pattern, `${file} must remain pure`);
    }
  }
});

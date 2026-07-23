import assert from "node:assert/strict";
import { globSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../..", import.meta.url);
const files = globSync("lib/portfolio/**/*.{ts,tsx,mts,mjs}", { cwd: root });

test("M-H remains a pure domain boundary", () => {
  assert.ok(files.length > 0, "lib/portfolio must contain the M-H implementation");
  const forbidden = [
    /\bfrom\s+["'][^"']*(?:app|components|runner|worker|research)[^"']*["']/i,
    /\bfrom\s+["'][^"']*(?:registry[\\/](?:generated|evidence)|catalog)[^"']*["']/i,
    /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|localStorage|indexedDB|sendBeacon)\b/,
    /\b(?:process\s*\.\s*env|child_process|node:net|node:http|node:https|node:fs|node:process)\b/,
    /\b(?:spawn|exec|writeFile|appendFile|unlink|rm)\s*\(/,
    /\b(?:from\s+|import\s*\()\s*["'][^"']*\.json["']/i,
  ];
  for (const file of files) {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    for (const pattern of forbidden) assert.doesNotMatch(source, pattern, file);
  }
});

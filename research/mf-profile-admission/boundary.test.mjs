import assert from "node:assert/strict";
import { globSync, readFileSync } from "node:fs";
import test from "node:test";

const files = globSync("lib/assessment/**/*.{ts,tsx,mts,mjs}", {
  cwd: new URL("../..", import.meta.url),
});

test("profile admission remains pure and does not read registry or evidence data directly", () => {
  assert.ok(files.length > 0);
  const forbidden = [
    /\bfrom\s+["'][^"']*(?:app|components|ranking|recommendation|runner|worker)[^"']*["']/i,
    /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|localStorage|indexedDB|sendBeacon)\b/,
    /\b(?:process\s*\.\s*env|child_process|node:net|node:http|node:https|node:fs|node:process)\b/,
    /\b(?:spawn|exec|writeFile|appendFile|unlink|rm)\s*\(/,
    /\b(?:from\s+|import\s*\()\s*["'][^"']*(?:registry[\\/](?:generated|evidence)|evidence[\\/][^"']*\.json|\.json)["']/i,
  ];
  for (const file of files) {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    for (const pattern of forbidden) assert.doesNotMatch(source, pattern, file);
  }
});

import assert from "node:assert/strict";
import { globSync, readFileSync } from "node:fs";
import test from "node:test";

const files = globSync(
  "research/mf-profile-collection/{types,validator,derive,policy-sweep,readiness}.ts",
  { cwd: new URL("../..", import.meta.url) },
);

test("collection research stays pure, local and outside production imports", () => {
  assert.equal(files.length, 5);
  const forbidden = [
    /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|localStorage|indexedDB|sendBeacon)\b/,
    /\b(?:child_process|node:net|node:http|node:https|node:fs|node:process)\b/,
    /\b(?:spawn|exec|writeFile|appendFile|unlink|rm)\s*\(/,
    /\bfrom\s+["'][^"']*(?:app|components|runner|worker|registry)[^"']*["']/i,
    /\b(?:reviewed|owner-approved)\s+as\s+const\b/,
  ];
  for (const file of files) {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    for (const pattern of forbidden) assert.doesNotMatch(source, pattern, file);
  }
});

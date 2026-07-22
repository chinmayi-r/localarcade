import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = [
  readFileSync(new URL("../lib/runtime/candidate-builder.ts", import.meta.url), "utf8"),
  readFileSync(new URL("../lib/runtime/compatibility.ts", import.meta.url), "utf8"),
].join("\n");

test("M-E remains a pure adapter with no serving-config, fit, ranking, download or process boundary", () => {
  for (const forbidden of [
    /from ["']node:fs["']/,
    /from ["']node:child_process["']/,
    /\bfetch\s*\(/,
    /\bprocess\.(?:env|cwd|platform)\b/,
    /from ["'][^"']*\/fit(?:\/|["'])/,
    /from ["'][^"']*\/recommendation(?:\/|["'])/,
    /serving[-_]config/i,
    /\bdownload/i,
  ]) {
    assert.doesNotMatch(source, forbidden);
  }
});

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function sourceFiles(dirUrl) {
  const files = [];
  for (const entry of await readdir(dirUrl, { withFileTypes: true })) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dirUrl);
    if (entry.isDirectory()) files.push(...(await sourceFiles(child)));
    else if (/\.(ts|tsx|mjs|js|jsx)$/.test(entry.name)) files.push(child);
  }
  return files;
}

test("M9 battles stay dark: nothing under app/ imports lib/battles", async () => {
  const files = await sourceFiles(new URL("../app/", import.meta.url));
  const offenders = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (/["'](?:@\/)?(?:\.\.\/)*lib\/battles/.test(source)) offenders.push(file.pathname);
  }
  assert.deepEqual(offenders, []);
});

test("M9 feature flag is off in source", async () => {
  const flag = await readFile(new URL("../lib/battles/flag.ts", import.meta.url), "utf8");
  assert.match(flag, /export const battlesEnabled = false as const;/);
});

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("the research baseline has no production imports or side-effect APIs", async () => {
  const directory = dirname(fileURLToPath(import.meta.url));
  const files = (await readdir(directory)).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));
  for (const file of files) {
    const source = await readFile(join(directory, file), "utf8");
    assert.doesNotMatch(source, /(?:from|import\()["'](?:@\/|\.\.\/\.\.\/(?:app|lib)|\.\.\/\.\.\/runner)/, file);
    assert.doesNotMatch(source, /node:(?:fs|http|https|net|child_process)|\bfetch\s*\(/, file);
  }
  for (const productionDirectory of ["app", "lib"]) {
    const root = join(directory, "..", "..", productionDirectory);
    const pending = [root];
    while (pending.length) {
      const current = pending.pop()!;
      for (const entry of await readdir(current, { withFileTypes: true })) {
        const path = join(current, entry.name);
        if (entry.isDirectory()) pending.push(path);
        else if (/\.[cm]?[jt]sx?$/.test(entry.name)) assert.doesNotMatch(await readFile(path, "utf8"), /research[\\/]ranking/, path);
      }
    }
  }
});

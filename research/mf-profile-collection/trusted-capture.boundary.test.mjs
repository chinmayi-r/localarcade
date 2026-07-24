import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("trusted capture validation stays independent of UI, runner process, storage and network implementations", async () => {
  const source = await readFile(
    new URL("../../lib/assessment/runner-fit-profile-capture.ts", import.meta.url),
    "utf8",
  );
  for (const forbidden of [
    "../../app/",
    "../../runner/",
    "fetch(",
    "node:fs",
    "localStorage",
    "child_process",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

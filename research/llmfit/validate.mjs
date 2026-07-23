import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("./provider-audit/", import.meta.url);
const pinnedVersion = "v1.1.6";
const pinnedCommit = "aaa2bc179cec214ccdc44501c853b98fba0b343b";

function readJson(name) {
  return JSON.parse(
    readFileSync(new URL(name, root), "utf8").replace(/^\uFEFF/, ""),
  );
}

function sha256(name) {
  return createHash("sha256")
    .update(readFileSync(new URL(name, root)))
    .digest("hex");
}

const pin = readJson("pin.json");
assert.equal(pin.release, pinnedVersion);
assert.equal(pin.releaseCommit, pinnedCommit);

const exits = readJson("raw-exit-codes.json");
for (const [command, exitCode] of Object.entries(exits)) {
  assert.equal(exitCode, 0, `${command} must have exited 0`);
}
assert.equal(readJson("raw-invalid-enums-exit.json").exitCode, 0);

const sourceHashes = readJson("raw-source-hashes.json");
assert.ok(Array.isArray(sourceHashes) && sourceHashes.length === 5);
for (const entry of sourceHashes) {
  assert.equal(typeof entry.path, "string");
  assert.equal(typeof entry.sha256, "string");
  assert.match(entry.sha256, /^[a-f0-9]{64}$/);
  assert.equal(entry.path.includes(":"), false, "source hash paths must be relative");
  assert.equal(entry.path.includes("\\"), false, "source hash paths use portable separators");
}
const licenseEntry = sourceHashes.find((entry) => entry.path === "LICENSE");
assert.ok(licenseEntry, "source hash ledger must contain LICENSE");
assert.equal(sha256("UPSTREAM-LICENSE.txt"), licenseEntry.sha256);

for (const scratchName of [".probe-source", ".probe-target", ".probe-home"]) {
  assert.equal(
    existsSync(new URL(`${scratchName}/`, root)),
    false,
    `${scratchName} must not remain after the probe`,
  );
}

console.log(
  `llmfit research evidence validated: ${pinnedVersion} ${pinnedCommit}, zero exits, relative source ledger, retained MIT hash`,
);
console.log(`provider audit: ${fileURLToPath(root)}`);

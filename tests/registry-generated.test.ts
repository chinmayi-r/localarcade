import assert from "node:assert/strict";
import test from "node:test";
import snapshotJson from "../registry/generated/artifacts.json";
import { validateRegistrySnapshot } from "../lib/registry";
import type { RegistrySnapshot } from "../lib/registry";

const snapshot = snapshotJson as RegistrySnapshot;

test("generated registry clears M1 scale and provenance gates", () => {
  assert.deepEqual(validateRegistrySnapshot(snapshot), []);
  assert.ok(snapshot.artifacts.length >= 40);
  assert.ok(new Set(snapshot.artifacts.map((artifact) => artifact.family)).size >= 8);
  assert.ok(snapshot.artifacts.every((artifact) => Object.keys(artifact.provenance).length === 15));
  assert.ok(snapshot.artifacts.every((artifact) => artifact.status === "promoted"));
  assert.ok(snapshot.lastIngestSucceededAt);
});

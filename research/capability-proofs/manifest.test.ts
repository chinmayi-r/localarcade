import assert from "node:assert/strict";
import test from "node:test";
import { loadCapabilityManifest, validateCapabilityManifest } from "./manifest";

test("capability manifest is complete, evidence-backed and excludes tools", async () => {
  const manifest = await loadCapabilityManifest();
  assert.deepEqual(await validateCapabilityManifest(manifest), []);
  assert.ok(manifest.productBoundary.doesNotHandle.includes("tool calling"));
  assert.match(manifest.productBoundary.independentScenarioRule, /independently/);
  assert.deepEqual(
    manifest.capabilities.map((capability) => capability.architectureRef),
    ["M-A", "M-B", "M-C", "M-D", "M-E", "M-F", "M-G", "M-H", "M-I", "M-J", "M-K", "M-L", "M-M", "M-N", "M-O", "M-P"],
  );
});

test("no missing or partial gate can omit its gap", async () => {
  const manifest = await loadCapabilityManifest();
  for (const capability of manifest.capabilities) {
    for (const gate of Object.values(capability.gates)) {
      if (gate.status === "missing" || gate.status === "partial") assert.ok(gate.gap);
    }
  }
});

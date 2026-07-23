import assert from "node:assert/strict";
import test from "node:test";
import snapshotJson from "../registry/generated/artifacts.json";
import { validateRegistrySnapshot } from "../lib/registry";
import type { RegistrySnapshot } from "../lib/registry";
import { selectRequiredArtifactRepository } from "../lib/registry/discovery/hugging-face";

const snapshot = snapshotJson as RegistrySnapshot;

test("generated registry clears M1 scale and provenance gates", () => {
  assert.deepEqual(validateRegistrySnapshot(snapshot), []);
  assert.ok(snapshot.artifacts.length >= 40);
  assert.ok(new Set(snapshot.artifacts.map((artifact) => artifact.family)).size >= 8);
  assert.ok(snapshot.artifacts.every((artifact) => Object.keys(artifact.provenance).length === 15));
  assert.ok(snapshot.artifacts.every((artifact) => artifact.status === "promoted"));
  assert.ok(snapshot.lastIngestSucceededAt);
});

test("explicit artifact discovery remains exact and trust-gated without requiring publisher pipeline metadata", () => {
  const policy = {
    schemaVersion: 1 as const,
    publishers: [{ id: "trusted", kind: "trusted-quantizer" as const, maxRepositories: 1 }],
    requiredTag: "gguf" as const,
    pipelineTag: "text-generation" as const,
    excludeNamePatterns: ["embed"],
    minimumArtifacts: 40,
    minimumFamilies: 8,
  };
  const selected = selectRequiredArtifactRepository(policy.publishers[0], policy, {
    id: "trusted/model-GGUF",
    sha: "a".repeat(40),
    private: false,
    gated: false,
    tags: ["gguf", "base_model:org/model"],
  }, "model-Q4_K_M.gguf");
  assert.deepEqual(selected.allowedFiles, ["model-Q4_K_M.gguf"]);
  assert.throws(() => selectRequiredArtifactRepository(policy.publishers[0], policy, {
    id: "trusted/embed-GGUF", sha: "a".repeat(40), tags: ["gguf"],
  }, "embed.gguf"), /trust policy/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { validateAcceleratorRegistryRecord, validateArtifactRegistryRecord, validateRegistrySnapshot } from "../lib/registry/index";
import type { AcceleratorRegistryRecord, ArtifactRegistryRecord, RegistrySnapshot } from "../lib/registry/index";

const artifact: ArtifactRegistryRecord = {
  id: "publisher/repository/model-q4.gguf@abc",
  publisher: "publisher",
  repository: "repository",
  revision: "a".repeat(40),
  fileName: "model-q4.gguf",
  sha256: "b".repeat(64),
  family: "Example family",
  model: "Example model",
  format: "GGUF",
  quantization: "Q4_K_M",
  fileSizeBytes: 4_000_000_000,
  maxContextTokens: 32_768,
  license: { id: "apache-2.0", sourceUrl: "https://example.com/license" },
  source: { url: "https://example.com/artifact", retrievedAt: "2026-07-18T20:00:00.000Z" },
};

const accelerator: AcceleratorRegistryRecord = {
  id: "vendor-product",
  vendor: "nvidia",
  canonicalName: "Vendor Product",
  aliases: ["Product"],
  variants: [{ id: "desktop-24gb", label: "Desktop 24 GB", memoryBytes: 24 * 1024 ** 3, formFactor: "desktop", sourceUrl: "https://example.com/specs" }],
  supportedBackends: ["CUDA"],
  source: { url: "https://example.com/specs", retrievedAt: "2026-07-18T20:00:00.000Z" },
};

test("complete sourced registry records pass admission", () => {
  assert.deepEqual(validateArtifactRegistryRecord(artifact), []);
  assert.deepEqual(validateAcceleratorRegistryRecord(accelerator), []);
});

test("artifact admission rejects mutable identity and missing provenance", () => {
  const issues = validateArtifactRegistryRecord({ ...artifact, revision: "main", sha256: "unknown" }).join(" ");
  assert.match(issues, /immutable/);
  assert.match(issues, /full 64-character hash/);
});

test("accelerator admission never infers memory from an ambiguous product name", () => {
  const issues = validateAcceleratorRegistryRecord({ ...accelerator, variants: [] }).join(" ");
  assert.match(issues, /explicit memory variant/);
});

test("snapshot validation rejects duplicate identities", () => {
  const snapshot: RegistrySnapshot = {
    schemaVersion: 2,
    snapshotId: "registry-2026-07-18",
    generatedAt: "2026-07-18T20:00:00.000Z",
    artifacts: [artifact, artifact],
    accelerators: [accelerator, accelerator],
    compatibilityAssertions: [],
  };
  const issues = validateRegistrySnapshot(snapshot).join(" ");
  assert.match(issues, /Duplicate artifact id/);
  assert.match(issues, /Duplicate accelerator id/);
});

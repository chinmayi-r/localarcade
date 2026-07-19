import assert from "node:assert/strict";
import test from "node:test";
import { buildRegistrySnapshot, validateAcceleratorRegistryRecord, validateArtifactRegistryRecord, validateRegistrySnapshot } from "../lib/registry/index";
import type { AcceleratorRegistryRecord, ArtifactRegistryRecord, FieldProvenance, RegistrySnapshot } from "../lib/registry/index";

const provenance = (kind: FieldProvenance["kind"] = "hub-api"): FieldProvenance => ({ sourceUrl: "https://example.com/source", retrievedAt: "2026-07-18T20:00:00.000Z", kind });
const artifact: ArtifactRegistryRecord = {
  id: "publisher/repository/model-Q4_K_M.gguf@abc",
  publisher: "publisher",
  repository: "repository",
  revision: "a".repeat(40),
  fileName: "model-Q4_K_M.gguf",
  sha256: "b".repeat(64),
  family: "publisher/Example-family",
  baseModel: "publisher/Example-family",
  model: "Example-family",
  format: "GGUF",
  quantization: "Q4_K_M",
  fileSizeBytes: 4_000_000_000,
  maxContextTokens: 32_768,
  chatTemplate: "{{ messages }}",
  license: { id: "apache-2.0", sourceUrl: "https://example.com/license" },
  provenance: {
    id: provenance("identity-derivation"), publisher: provenance(), repository: provenance(), revision: provenance(),
    fileName: provenance("hub-lfs"), sha256: provenance("hub-lfs"), fileSizeBytes: provenance("hub-lfs"), format: provenance("schema-constant"),
    quantization: provenance("filename-derivation"), baseModel: provenance("model-card"), family: provenance("base-model-derivation"), model: provenance("base-model-derivation"),
    license: provenance("model-card"), maxContextTokens: provenance("gguf-metadata"), chatTemplate: provenance("gguf-metadata"),
  },
};

const accelerator: AcceleratorRegistryRecord = {
  id: "vendor-product",
  vendor: "nvidia",
  canonicalName: "Vendor Product",
  aliases: ["Product"],
  variants: [{ id: "desktop-24gb", label: "Desktop 24 GB", memoryBytes: 24 * 1024 ** 3, formFactor: "desktop", sourceUrl: "https://example.com/specs" }],
  supportedBackends: ["CUDA"],
  source: provenance(),
};

test("complete sourced registry records pass admission", () => {
  assert.deepEqual(validateArtifactRegistryRecord(artifact), []);
  assert.deepEqual(validateAcceleratorRegistryRecord(accelerator), []);
});

test("artifact admission rejects mutable identity, missing hashes, licenses and provenance", () => {
  const invalid = { ...artifact, revision: "main", sha256: "unknown", license: { id: "", sourceUrl: "" }, provenance: { ...artifact.provenance, sha256: undefined } } as unknown as ArtifactRegistryRecord;
  const issues = validateArtifactRegistryRecord(invalid).join(" ");
  assert.match(issues, /immutable/);
  assert.match(issues, /full 64-character hash/);
  assert.match(issues, /License id and source URL/);
  assert.match(issues, /sha256 provenance is required/);
});

test("accelerator admission never infers memory from an ambiguous product name", () => {
  assert.match(validateAcceleratorRegistryRecord({ ...accelerator, variants: [] }).join(" "), /explicit memory variant/);
});

test("snapshot validation rejects duplicate identities", () => {
  const snapshot: RegistrySnapshot = { schemaVersion: 3, snapshotId: "registry-2026-07-18", generatedAt: "2026-07-18T20:00:00.000Z", artifacts: [artifact, artifact], quarantine: [], accelerators: [accelerator, accelerator], compatibilityAssertions: [] };
  const issues = validateRegistrySnapshot(snapshot).join(" ");
  assert.match(issues, /Duplicate artifact id/);
  assert.match(issues, /Duplicate accelerator id/);
});

test("snapshot generation is deterministic for the same lock timestamp and records", () => {
  assert.deepEqual(buildRegistrySnapshot("2026-07-18T20:00:00.000Z", [artifact], []), buildRegistrySnapshot("2026-07-18T20:00:00.000Z", [artifact], []));
});

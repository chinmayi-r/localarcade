import assert from "node:assert/strict";
import test from "node:test";
import golden from "./fixtures/inventory-mc-identity-v1.golden.json";
import { toRegistryArtifactIdentity } from "../lib/registry";
import type { ArtifactFieldProvenance, ArtifactRegistryRecord } from "../lib/registry";

const fields = [
  "id", "publisher", "repository", "revision", "fileName", "sha256",
  "fileSizeBytes", "format", "quantization", "baseModel", "family", "model",
  "maxContextTokens", "license", "chatTemplate",
] as const satisfies ReadonlyArray<keyof ArtifactFieldProvenance>;

const id = "publisher/repository/model-Q4_K_M.gguf@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const provenance = Object.fromEntries(fields.map((field) => [field, {
  sourceUrl: `https://example.invalid/${field}`,
  retrievedAt: "2026-07-19T12:00:00.000Z",
  kind: "hub-api",
}])) as ArtifactFieldProvenance;

const record: ArtifactRegistryRecord = {
  id,
  publisher: "publisher",
  repository: "repository",
  revision: "a".repeat(40),
  fileName: "model-Q4_K_M.gguf",
  sha256: "a".repeat(64),
  fileSizeBytes: 4_000,
  format: "GGUF",
  quantization: "Q4_K_M",
  baseModel: "publisher/base-model",
  family: "publisher/base-model",
  model: "base-model",
  maxContextTokens: 32_768,
  chatTemplate: "{{ messages }}",
  status: "promoted",
  license: { id: "apache-2.0", sourceUrl: "https://example.invalid/license" },
  provenance,
};

test("M-C and M-I serialize the same promoted identity projection", () => {
  const mapped = toRegistryArtifactIdentity(record);
  assert.equal(mapped.kind, "ok");
  if (mapped.kind !== "ok") return;

  const projection = {
    modelFamily: mapped.value.modelFamily,
    artifact: mapped.value.artifact,
    provenanceRecordRefs: mapped.value.provenance.map((item) => item.rawSourceRecordRef),
    registryMetadata: {
      publisher: mapped.value.registryMetadata.publisher,
      baseModel: mapped.value.registryMetadata.baseModel,
      model: mapped.value.registryMetadata.model,
      maxContextTokens: mapped.value.registryMetadata.maxContextTokens,
      chatTemplate: mapped.value.registryMetadata.chatTemplate,
      licenseSourceUrl: mapped.value.registryMetadata.licenseSourceUrl,
      fieldProvenanceKeys: Object.keys(mapped.value.registryMetadata.fieldProvenance).sort(),
    },
  };
  assert.deepEqual(projection, golden);
});

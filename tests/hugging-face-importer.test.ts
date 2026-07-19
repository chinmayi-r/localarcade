import assert from "node:assert/strict";
import test from "node:test";
import { admitHuggingFaceRepository, quantizationFromFilename } from "../lib/registry/index";
import type { DiscoveredRepository, HuggingFaceModelResponse } from "../lib/registry/index";

const revision = "a".repeat(40);
const source: DiscoveredRepository = {
  repoId: "publisher/repository",
  revision,
  publisher: "publisher",
  publisherKind: "trusted-quantizer",
  baseModelHint: "publisher/Model-Instruct",
};
const response: HuggingFaceModelResponse = {
  id: source.repoId,
  sha: revision,
  cardData: { license: "apache-2.0", base_model: "publisher/Model-Instruct" },
  gguf: { context_length: 32_768, chat_template: "{{ messages }}" },
  siblings: [
    { rfilename: "LICENSE", size: 1_000 },
    { rfilename: "model-Q4_K_M.gguf", size: 4_000_000_000, lfs: { sha256: "b".repeat(64), size: 4_000_000_000 } },
    { rfilename: "model-Q8_0.gguf", size: 7_000_000_000, lfs: { sha256: "c".repeat(64), size: 7_000_000_000 } },
  ],
};

test("bulk admission creates immutable records with field-level provenance", () => {
  const result = admitHuggingFaceRepository(source, response, "2026-07-19T00:00:00.000Z");
  assert.equal(result.artifacts.length, 2);
  assert.equal(result.quarantine.length, 0);
  const artifact = result.artifacts[0];
  assert.equal(artifact.revision, revision);
  assert.equal(artifact.sha256, "b".repeat(64));
  assert.equal(artifact.fileSizeBytes, 4_000_000_000);
  assert.equal(artifact.maxContextTokens, 32_768);
  assert.equal(artifact.chatTemplate, "{{ messages }}");
  assert.match(artifact.license.sourceUrl, new RegExp(revision));
  assert.equal(Object.keys(artifact.provenance).length, 15);
  assert.equal(artifact.provenance.sha256.kind, "hub-lfs");
});

test("the importer rejects a moving or mismatched revision", () => {
  assert.throws(() => admitHuggingFaceRepository(source, { ...response, sha: "c".repeat(40) }, "2026-07-19T00:00:00.000Z"), /Expected pinned revision/);
});

test("admission quarantines individual files without discarding valid siblings", () => {
  const siblings = response.siblings?.map((file) => file.rfilename === "model-Q4_K_M.gguf" ? { ...file, lfs: undefined } : file);
  const result = admitHuggingFaceRepository(source, { ...response, siblings }, "2026-07-19T00:00:00.000Z");
  assert.equal(result.artifacts.length, 1);
  assert.equal(result.quarantine[0]?.code, "missing-sha256");
});

test("admission quarantines records without license or chat-template evidence", () => {
  const noLicense = admitHuggingFaceRepository(source, { ...response, cardData: {}, siblings: response.siblings?.filter((file) => file.rfilename !== "LICENSE") }, "2026-07-19T00:00:00.000Z");
  assert.ok(noLicense.quarantine.every((record) => record.code === "missing-license"));
  const noTemplate = admitHuggingFaceRepository(source, { ...response, gguf: { context_length: 32_768 } }, "2026-07-19T00:00:00.000Z");
  assert.ok(noTemplate.quarantine.every((record) => record.code === "missing-chat-template"));
});

test("quantization derivation is strict and filename based", () => {
  assert.equal(quantizationFromFilename("model-Q4_K_M.gguf"), "Q4_K_M");
  assert.equal(quantizationFromFilename("model-IQ3_XXS.gguf"), "IQ3_XXS");
  assert.equal(quantizationFromFilename("model.gguf"), undefined);
});

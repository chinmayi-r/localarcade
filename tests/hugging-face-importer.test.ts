import assert from "node:assert/strict";
import test from "node:test";
import { artifactFromHuggingFace } from "../lib/registry/index";
import type { HuggingFaceArtifactSource, HuggingFaceModelResponse } from "../lib/registry/index";

const revision = "a".repeat(40);
const source: HuggingFaceArtifactSource = {
  repoId: "publisher/repository",
  revision,
  fileName: "model-Q4_K_M.gguf",
  family: "Model",
  model: "Model Instruct",
  quantization: "Q4_K_M",
  runtimeCompatibility: [{ runtime: "llama.cpp", sourceUrl: `https://huggingface.co/publisher/repository/blob/${revision}/README.md` }],
};
const response: HuggingFaceModelResponse = {
  id: source.repoId,
  sha: revision,
  cardData: { license: "apache-2.0" },
  gguf: { context_length: 32_768 },
  siblings: [
    { rfilename: "LICENSE", size: 1_000 },
    { rfilename: source.fileName, size: 4_000_000_000, lfs: { sha256: "b".repeat(64), size: 4_000_000_000 } },
  ],
};

test("the importer creates immutable artifact identity from pinned Hub metadata", () => {
  const artifact = artifactFromHuggingFace(source, response, "2026-07-19T00:00:00.000Z");
  assert.equal(artifact.revision, revision);
  assert.equal(artifact.sha256, "b".repeat(64));
  assert.equal(artifact.fileSizeBytes, 4_000_000_000);
  assert.equal(artifact.maxContextTokens, 32_768);
  assert.match(artifact.license.sourceUrl, new RegExp(revision));
});

test("the importer rejects a moving or mismatched revision", () => {
  assert.throws(() => artifactFromHuggingFace(source, { ...response, sha: "c".repeat(40) }, "2026-07-19T00:00:00.000Z"), /Expected pinned revision/);
});

test("the importer rejects files without a downloadable SHA-256", () => {
  const siblings = response.siblings?.map((file) => file.rfilename === source.fileName ? { ...file, lfs: undefined } : file);
  assert.throws(() => artifactFromHuggingFace(source, { ...response, siblings }, "2026-07-19T00:00:00.000Z"), /lacks an LFS SHA-256/);
});

test("the importer rejects repositories without pinned license evidence", () => {
  const siblings = response.siblings?.filter((file) => file.rfilename !== "LICENSE");
  assert.throws(() => artifactFromHuggingFace(source, { ...response, siblings }, "2026-07-19T00:00:00.000Z"), /LICENSE file/);
});

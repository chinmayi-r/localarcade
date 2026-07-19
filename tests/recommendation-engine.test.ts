import assert from "node:assert/strict";
import test from "node:test";
import { recommend, strategyOptions } from "../lib/recommendation/index";
import type { Artifact, RecommendationQuery, StrategyId } from "../lib/recommendation/types";
import type { ArtifactRegistryRecord, FieldProvenance } from "../lib/registry";

const baseQuery: RecommendationQuery = {
  hardware: { platform: "nvidia", availableMemoryGb: 24 },
  task: "coding",
  desiredContextK: 32,
  strategy: "balanced",
};

test("every visible strategy is implemented and returns bounded results", () => {
  for (const strategy of strategyOptions) {
    const results = recommend({ ...baseQuery, strategy: strategy.id });
    assert.ok(results.length > 0, strategy.id);
    assert.ok(results.length <= 5, strategy.id);
    assert.deepEqual(results.map((result) => result.rank), results.map((_, index) => index + 1));
  }
});

test("recommendations never exceed the configured memory safety envelope", () => {
  for (const memory of [4, 8, 12, 16, 24, 32, 64, 128]) {
    const results = recommend({ ...baseQuery, hardware: { ...baseQuery.hardware, availableMemoryGb: memory } });
    for (const result of results) assert.ok(result.requiredMemoryGb <= memory * 0.86, `${result.artifact.id} at ${memory} GB`);
  }
});

test("recommendations satisfy desired context", () => {
  for (const desiredContextK of [8, 16, 32, 64]) {
    const results = recommend({ ...baseQuery, desiredContextK });
    for (const result of results) {
      assert.ok(result.artifact.maxContextK >= desiredContextK);
      assert.equal(result.configuration.contextK, desiredContextK);
      assert.equal(result.configuration.engine, result.artifact.engine);
    }
  }
});

test("one model family cannot occupy multiple top-five slots", () => {
  const results = recommend(baseQuery);
  const families = results.map((result) => result.artifact.family);
  assert.equal(new Set(families).size, families.length);
});

test("strategy changes can change ordering without changing eligibility", () => {
  const order = (strategy: StrategyId) => recommend({ ...baseQuery, strategy }).map((result) => result.artifact.id);
  assert.notDeepEqual(order("quality"), order("speed"));
  assert.notDeepEqual(order("long-context"), order("lightest"));
});

test("unknown strategies fail closed", () => {
  assert.throws(() => recommend({ ...baseQuery, strategy: "mystery" as StrategyId }), /Unknown ranking strategy/);
});

test("a sourced artifact keeps immutable identity attached to its recommendation", () => {
  const source = (kind: FieldProvenance["kind"]): FieldProvenance => ({ sourceUrl: "https://example.com/source", retrievedAt: "2026-07-19T00:00:00.000Z", kind });
  const identity: ArtifactRegistryRecord = {
    id: "Qwen/Qwen3-0.6B-GGUF/model-Q8_0.gguf@revision", publisher: "Qwen", repository: "Qwen3-0.6B-GGUF", revision: "a".repeat(40), fileName: "model-Q8_0.gguf", sha256: "b".repeat(64), fileSizeBytes: 800_000_000, format: "GGUF", quantization: "Q8_0", baseModel: "Qwen/Qwen3-0.6B", family: "Qwen/Qwen3-0.6B", model: "Qwen3-0.6B", maxContextTokens: 32_768, chatTemplate: "{{ messages }}", license: { id: "apache-2.0", sourceUrl: "https://example.com/license" },
    provenance: { id: source("identity-derivation"), publisher: source("hub-api"), repository: source("hub-api"), revision: source("hub-api"), fileName: source("hub-lfs"), sha256: source("hub-lfs"), fileSizeBytes: source("hub-lfs"), format: source("schema-constant"), quantization: source("filename-derivation"), baseModel: source("model-card"), family: source("base-model-derivation"), model: source("base-model-derivation"), license: source("model-card"), maxContextTokens: source("gguf-metadata"), chatTemplate: source("gguf-metadata") },
  };
  const artifact: Artifact = { id: "sourced", family: "Qwen3", model: "Qwen3 0.6B", quantization: "Q8_0", format: "GGUF", engine: "llama.cpp", weightSizeGb: 0.8, kvCacheGbPer8K: 0.08, maxContextK: 32, baselineTokensPerSecond: 98, stabilityScore: 0.76, taskScores: { coding: 42, general: 48, writing: 44, extraction: 62 }, evidenceLevel: "prototype", identity };
  const result = recommend({ ...baseQuery, hardware: { platform: "nvidia", availableMemoryGb: 2 }, desiredContextK: 8 }, [artifact])[0];
  assert.ok(result);
  assert.equal(result.configuration.artifactRepository, "Qwen/Qwen3-0.6B-GGUF");
  assert.equal(result.configuration.artifactRevision?.length, 40);
  assert.equal(result.configuration.artifactSha256?.length, 64);
  assert.equal(result.configuration.licenseId, "apache-2.0");
});

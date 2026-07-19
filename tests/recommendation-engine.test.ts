import assert from "node:assert/strict";
import test from "node:test";
import registryJson from "../registry/generated/artifacts.json";
import { recommend } from "../lib/recommendation";
import type { RecommendationCandidate, RecommendationQuery } from "../lib/recommendation";
import type { ArtifactSizeBand, ThroughputPrior } from "../lib/priors";
import type { RegistrySnapshot } from "../lib/registry";
import goldens from "./fixtures/recommendation-engine-goldens.json";

const artifact = (registryJson as RegistrySnapshot).artifacts[0];
const baseQuery: RecommendationQuery = { hardware: { platform: "cpu", availableMemoryGb: 32 }, task: "coding", desiredContextK: 8, strategy: "long-context" };

function candidate(id: string, family: string, options: { maxContextK?: number; weightGb?: number; runtimeGb?: number; kvMibPer8K?: number; hardwareKinds?: RecommendationCandidate["hardwareKinds"]; quality?: number; sizeBand?: ArtifactSizeBand } = {}): RecommendationCandidate {
  const maxContextK = options.maxContextK ?? 32;
  return {
    id,
    artifact: { ...artifact, id: `${id}@revision`, family, model: id, fileSizeBytes: Math.round((options.weightGb ?? 1) * 1024 ** 3), maxContextTokens: maxContextK * 1024 },
    fitArtifact: {
      id,
      weightBytes: Math.round((options.weightGb ?? 1) * 1024 ** 3),
      maxContextTokens: maxContextK * 1024,
      runtimeComputeBufferBytes: Math.round((options.runtimeGb ?? 0.5) * 1024 ** 3),
      kvCache: {
        key: [{ quantization: "f16", referenceContextTokens: 8 * 1024, bytesAtReferenceContext: (options.kvMibPer8K ?? 128) * 1024 ** 2 }],
        value: [{ quantization: "f16", referenceContextTokens: 8 * 1024, bytesAtReferenceContext: (options.kvMibPer8K ?? 128) * 1024 ** 2 }],
      },
    },
    fitProfileSourceUrl: "https://example.com/test-profile",
    hardwareKinds: options.hardwareKinds ?? ["cpu"],
    sizeBand: options.sizeBand ?? "tiny-1b",
    runtime: { product: "llama-cpp", engine: "llama.cpp", build: "test-build", backend: options.hardwareKinds?.includes("gpu") ? "cuda" : "cpu", kvCache: "f16", gpuLayers: options.hardwareKinds?.includes("gpu") ? "all" : 0, batchSize: 512 },
    comparativeQuality: options.quality === undefined ? undefined : { coding: { value: options.quality, sourceUrl: "https://example.com/test-quality" } },
  };
}

const testPriors: ThroughputPrior[] = (["tiny-1b", "small-8b", "medium-14b"] as ArtifactSizeBand[]).map((sizeBand, index) => ({
  id: `test-${sizeBand}`,
  accelerator: { id: "test-cpu", family: "test-cpu-family", kind: "cpu", memoryGb: 32 },
  artifact: { family: `test-${sizeBand}`, sizeBand, parameterCountBillion: index + 1, quantization: "Q4_K_M" },
  runtime: { product: "llama-cpp", engine: "llama.cpp", version: "test", commit: "a".repeat(40), backend: "cpu" },
  conditions: { operatingSystem: "test", architecture: "x86_64", protocol: "test" },
  ranges: { promptTokensPerSecond: { min: 10 + index, max: 20 + index }, generationTokensPerSecond: { min: 5 + index * 5, max: 7 + index * 5 }, timeToFirstTokenMs: { min: 50, max: 100 } },
  sampleCount: 2,
  evidenceTier: "tier-1",
  sourceUrl: "https://example.com/test-prior",
  observedAt: "2026-07-19T00:00:00.000Z",
  retrievedAt: "2026-07-19T00:00:00.000Z",
}));

test("M4 golden outcomes cover every honest ranking leaf", () => {
  const cases = {
    unknownGpu: recommend({ ...baseQuery, hardware: { platform: "nvidia", availableMemoryGb: 24 }, strategy: "speed" }, [candidate("gpu", "gpu-family", { hardwareKinds: ["gpu"] })]),
    nothingFits: recommend({ ...baseQuery, hardware: { platform: "cpu", availableMemoryGb: 4 } }, [candidate("huge", "huge-family", { runtimeGb: 20 })]),
    contradictory: recommend({ ...baseQuery, desiredContextK: 64 }, [candidate("context-bound", "context-family", { maxContextK: 128, kvMibPer8K: 2_000 })]),
    tie: recommend(baseQuery, [candidate("tie-a", "tie-a", { maxContextK: 32 }), candidate("tie-b", "tie-b", { maxContextK: 32 })]),
    shortlist: recommend({ ...baseQuery, strategy: "quality" }, [candidate("short-a", "short-a"), candidate("short-b", "short-b", { maxContextK: 64 })]),
  };
  for (const [name, result] of Object.entries(cases)) assert.equal(result.kind, goldens[name as keyof typeof goldens].kind, name);
  assert.equal(cases.unknownGpu.items[0].throughput.kind, "unavailable");
  assert.match(cases.contradictory.message, /conflicts|silently dropped/);
  assert.match(cases.tie.message, /tied|range/);
});

test("family variants nest and cannot occupy multiple slots", () => {
  const result = recommend(baseQuery, [
    candidate("family-a-heavy", "family-a", { weightGb: 2, maxContextK: 64 }),
    candidate("family-a-light", "family-a", { weightGb: 1, maxContextK: 64 }),
    candidate("family-b", "family-b", { maxContextK: 32 }),
  ]);
  assert.equal(result.items.length, 2);
  assert.equal(new Set(result.items.map((item) => item.candidate.artifact.family)).size, 2);
  assert.equal(result.items.find((item) => item.candidate.artifact.family === "family-a")?.alternatives.length, 1);
});

test("an evidence-supported top five is role labelled and family deduped", () => {
  const query = { ...baseQuery, hardware: { ...baseQuery.hardware, acceleratorId: "test-cpu" } };
  const bands: ArtifactSizeBand[] = ["tiny-1b", "small-8b", "medium-14b", "tiny-1b", "small-8b"];
  const result = recommend(query, [16, 32, 48, 64, 96].map((context, index) => candidate(`model-${index}`, `family-${index}`, { maxContextK: context, weightGb: index + 1, quality: 50 + index, sizeBand: bands[index] })), 5, testPriors);
  assert.equal(result.kind, "ranked");
  assert.equal(result.items.length, 5);
  assert.equal(new Set(result.items.map((item) => item.candidate.artifact.family)).size, 5);
  assert.deepEqual(result.items.map((item) => item.role), ["primary-match", "quality-option", "fast-option", "long-context-option", "memory-efficient-option"]);
});

test("unknown strategies fail closed", () => {
  assert.throws(() => recommend({ ...baseQuery, strategy: "mystery" as RecommendationQuery["strategy"] }, []), /Unknown ranking strategy/);
});

test("production recommendations retain real registry identity and explicit runtime configuration", () => {
  const result = recommend({ ...baseQuery, hardware: { platform: "cpu", availableMemoryGb: 32 }, strategy: "balanced" });
  assert.equal(result.kind, "unranked");
  const item = result.items[0];
  assert.ok(item.candidate.artifact.sha256.length === 64);
  assert.equal(item.candidate.runtime.product, "llama-cpp");
  assert.equal(item.candidate.runtime.engine, "llama.cpp");
  assert.equal(item.throughput.kind, "unavailable", "llamafile priors must not cross into direct llama.cpp");
});

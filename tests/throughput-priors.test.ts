import assert from "node:assert/strict";
import test from "node:test";
import { estimateThroughput, throughputPriors, throughputPriorSnapshot, validateThroughputPrior, validateThroughputPriorSnapshot } from "../lib/priors";
import type { ThroughputQuery } from "../lib/priors";
import unknownGoldenJson from "./fixtures/unknown-throughput-golden.json";

test("every throughput prior is fully scoped and sourced", () => {
  assert.deepEqual(validateThroughputPriorSnapshot(throughputPriorSnapshot), []);
  assert.equal(throughputPriors.length, 5);
  for (const prior of throughputPriors) {
    assert.match(prior.sourceUrl, /^https:\/\/www\.localscore\.ai\/result\/\d+$/);
    assert.equal(prior.evidenceTier, "tier-1");
    assert.ok(prior.runtime.version && prior.runtime.commit && prior.runtime.backend);
    assert.equal(prior.sampleCount, 9);
  }
});

test("an exact accelerator match preserves the observed range", () => {
  const result = estimateThroughput({ acceleratorId: "intel-core-i5-1240p-cpu", acceleratorKind: "cpu", sizeBand: "medium-14b", product: "llamafile", engine: "llama.cpp" }, throughputPriors);
  assert.equal(result.kind, "range");
  if (result.kind !== "range") return;
  assert.equal(result.hardwareMatch, "exact");
  assert.equal(result.confidence, "medium");
  assert.deepEqual(result.ranges.generationTokensPerSecond, { min: 3.8, max: 5 });
});

test("a family match widens across every compatible family member", () => {
  const result = estimateThroughput({ acceleratorFamily: "intel-alder-lake-mobile-cpu", acceleratorKind: "cpu", sizeBand: "tiny-1b", product: "llamafile", engine: "llama.cpp" }, throughputPriors);
  assert.equal(result.kind, "range");
  if (result.kind !== "range") return;
  assert.equal(result.hardwareMatch, "family");
  assert.equal(result.confidence, "low");
  assert.deepEqual(result.ranges.promptTokensPerSecond, { min: 28, max: 190 });
  assert.equal(result.sampleCount, 18);
});

test("unknown GPU does not inherit CPU evidence", () => {
  const fixture = unknownGoldenJson as { query: ThroughputQuery; expected: unknown };
  const result = estimateThroughput(fixture.query, throughputPriors);
  assert.deepEqual(result, fixture.expected);
  assert.ok(!("pointEstimate" in result));
});

test("an unsupported engine and size combination returns no estimate", () => {
  assert.deepEqual(estimateThroughput({ acceleratorId: "unknown", acceleratorKind: "gpu", sizeBand: "medium-14b", product: "vllm", engine: "vllm-native" }, throughputPriors), {
    kind: "unavailable",
    confidence: "none",
    reason: "No sourced prior covers this hardware kind, artifact-size band, product, and engine.",
  });
});

test("invalid source records fail validation", () => {
  const invalid = { ...throughputPriors[0], sourceUrl: "", sampleCount: 1 };
  const issues = validateThroughputPrior(invalid).join(" ");
  assert.match(issues, /at least two samples/);
  assert.match(issues, /Source URL/);
});

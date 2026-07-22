import assert from "node:assert/strict";
import test from "node:test";
import { adaptEvidenceRecord, adaptLocalFitResult, adaptThroughputPrior } from "../lib/evidence";
import type { EvidenceRecord, ExactConfigurationIdentity } from "../lib/evidence";
import { throughputPriors } from "../lib/priors";

const configuration: ExactConfigurationIdentity = {
  artifactSha256: "a".repeat(64),
  runtimeBuild: "llama.cpp-b1234",
  settingsFingerprint: "settings-v1",
};

function record(change: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id: "observation-1",
    metric: "generation-throughput",
    method: "measurement",
    source: "personal",
    hardwareMatch: "exact",
    configurationMatch: "exact",
    interval: { lower: 18, upper: 22, unit: "tokens-per-second", confidenceLevel: 0.95 },
    sampleCount: 5,
    observedAt: "2026-07-18T20:00:00.000Z",
    provenanceLinks: ["local://run/observation-1"],
    configuration,
    hardwareFingerprint: "machine-fingerprint",
    ...change,
  };
}

const exactContext = {
  candidateId: "candidate-1",
  hardwareTargetId: "hardware-1",
  configuration,
  hardwareFingerprint: "machine-fingerprint",
};

test("M-G maps a valid exact personal measurement without upgrading or dropping its claim", () => {
  const result = adaptEvidenceRecord(record(), exactContext);
  assert.equal(result.kind, "exact");
  if (result.kind !== "exact") return;
  assert.equal(result.value.claim, "verified");
  assert.equal(result.value.candidateId, "candidate-1");
  assert.equal(result.value.hardwareTargetId, "hardware-1");
  assert.deepEqual(result.value.provenance[0], {
    source: { id: "legacy-evidence.personal", version: null, revision: null, url: "local://run/observation-1" },
    retrievedAt: null,
    observedAt: "2026-07-18T20:00:00.000Z",
    method: "measurement",
    hardwareMatch: "exact",
    configurationMatch: "exact",
    scope: { taskFamily: null, taskPackId: null, promptId: null, harnessId: null },
    sampleCount: 5,
    measurement: { unit: "tokens-per-second", interval: { lower: 18, upper: 22 }, confidence: 0.95, eligible: true, eligibilityReasons: [] },
    rawSourceRecordRef: "legacy-evidence:observation-1",
  });
});

test("M-G exposes schema projection losses and rejects invalid or mismatched evidence", () => {
  const grouped = adaptEvidenceRecord(record({
    source: "community",
    hardwareMatch: "coarse-bucket",
    hardwareFingerprint: undefined,
    hardwareGroupId: "gpu-24gb",
    taskPackId: "coding-pack",
    taskPackVersion: "2",
  }), { ...exactContext, hardwareFingerprint: undefined, hardwareGroupId: "gpu-24gb" });
  assert.equal(grouped.kind, "lossy");
  if (grouped.kind === "lossy") {
    assert.equal(grouped.value.claim, "community");
    assert.match(grouped.reasons.join(" "), /taskPackVersion/);
    assert.match(grouped.reasons.join(" "), /hardwareGroupId/);
  }

  const mismatch = adaptEvidenceRecord(record(), { ...exactContext, hardwareFingerprint: "different" });
  assert.equal(mismatch.kind, "unsupported");
  if (mismatch.kind === "unsupported") assert.match(mismatch.reasons.join(" "), /does not match/);

  const invalid = adaptEvidenceRecord(record({ provenanceLinks: [] }), exactContext);
  assert.equal(invalid.kind, "unsupported");
  if (invalid.kind === "unsupported") assert.match(invalid.reasons.join(" "), /provenance link/);
});

test("M-G maps sourced throughput ranges as estimates, never target measurements", () => {
  const prior = throughputPriors[0];
  const context = {
    candidateId: "candidate-1",
    hardwareTargetId: "hardware-1",
    hardwareMatch: "exact" as const,
    configurationMatch: "family-proxy" as const,
    target: {
      acceleratorId: prior.accelerator.id,
      artifactFamily: prior.artifact.family,
      sizeBand: prior.artifact.sizeBand,
      quantization: prior.artifact.quantization,
      runtime: { product: prior.runtime.product, engine: prior.runtime.engine, build: prior.runtime.commit, backend: prior.runtime.backend },
    },
  };
  const result = adaptThroughputPrior(prior, context);
  assert.equal(result.kind, "lossy");
  if (result.kind !== "lossy") return;
  assert.equal(result.value.claim, "estimated");
  assert.deepEqual(result.value.performance.promptTokensPerSecond, {
    low: throughputPriors[0].ranges.promptTokensPerSecond.min,
    high: throughputPriors[0].ranges.promptTokensPerSecond.max,
  });
  for (const evidence of Object.values(result.value.evidence).flat()) {
    assert.equal(evidence.method, "estimate");
    assert.equal(evidence.configurationMatch, "family-proxy");
    assert.equal(evidence.measurement?.confidence, null);
  }
  assert.match(result.reasons.join(" "), /immutable target artifact/);

  const mismatched = adaptThroughputPrior(prior, { ...context, target: { ...context.target, acceleratorId: "different" } });
  assert.equal(mismatched.kind, "unsupported");
  if (mismatched.kind === "unsupported") assert.match(mismatched.reasons.join(" "), /same accelerator id/);

  const invalid = adaptThroughputPrior({ ...prior, sourceUrl: "" }, context);
  assert.equal(invalid.kind, "unsupported");
  if (invalid.kind === "unsupported") assert.match(invalid.reasons.join(" "), /Source URL/);
});

test("M-G maps a consistent CPU fit result without inventing fit policy", () => {
  const result = adaptLocalFitResult({
    fits: true,
    requiredBytes: 100,
    physicalMemoryBytes: 200,
    breakdown: {
      weightsBytes: 40,
      kvCacheBytes: 20,
      runtimeComputeBufferBytes: 10,
      osReserveBytes: 10,
      displayReserveBytes: 5,
      safetyMarginBytes: 15,
    },
    reasons: [],
  }, {
    candidateId: "candidate-1",
    hardwareTargetId: "hardware-1",
    runPath: "cpu",
    sourceUrl: "https://example.invalid/allocation-log",
    rawSourceRecordRef: "fit-profile:fixture",
  });
  assert.equal(result.kind, "lossy");
  if (result.kind !== "lossy") return;
  assert.equal(result.value.legacyFits, true);
  assert.deepEqual(result.value.memoryPools.host, {
    modelBytes: 40,
    contextBytes: 20,
    computeBytes: 10,
    reserveBytes: 15,
    marginBytes: 15,
    requiredBytes: 100,
    availableBytes: 200,
  });
  assert.equal(result.value.evidence.fit[0].method, "estimate");
  assert.match(result.reasons.join(" "), /M-F owns/);
});

test("M-G blocks dishonest pool splitting and contradictory fit records", () => {
  const base = {
    fits: true,
    requiredBytes: 10,
    physicalMemoryBytes: 20,
    breakdown: { weightsBytes: 10, kvCacheBytes: 0, runtimeComputeBufferBytes: 0, osReserveBytes: 0, displayReserveBytes: 0, safetyMarginBytes: 0 },
    reasons: [],
  };
  const context = { candidateId: "candidate-1", hardwareTargetId: "hardware-1", runPath: "gpu" as const, sourceUrl: "https://example.invalid", rawSourceRecordRef: "fixture" };
  const gpu = adaptLocalFitResult(base, context);
  assert.equal(gpu.kind, "unsupported");
  if (gpu.kind === "unsupported") assert.match(gpu.reasons.join(" "), /cannot be split honestly/);

  const contradictory = adaptLocalFitResult({ ...base, fits: false }, { ...context, runPath: "cpu" });
  assert.equal(contradictory.kind, "unsupported");
  if (contradictory.kind === "unsupported") assert.match(contradictory.reasons.join(" "), /contradicts/);
});

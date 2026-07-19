import assert from "node:assert/strict";
import test from "node:test";
import {
  claimForEvidence,
  mayPoolAcrossHardware,
  metricKinds,
  metricPolicies,
  validateEvidenceRecord,
  type EvidenceRecord,
} from "../lib/evidence/index";

const exactConfiguration = {
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
    configuration: exactConfiguration,
    hardwareFingerprint: "machine-fingerprint",
    ...change,
  };
}

test("every declared metric has exactly one scope policy", () => {
  assert.deepEqual(Object.keys(metricPolicies).sort(), [...metricKinds].sort());
});

test("response and task evidence pool across hardware while experience evidence does not", () => {
  assert.equal(mayPoolAcrossHardware("response-preference"), true);
  assert.equal(mayPoolAcrossHardware("task-success"), true);
  assert.equal(mayPoolAcrossHardware("operator-intervention-rate"), true);
  assert.equal(mayPoolAcrossHardware("experience-preference"), false);
  assert.equal(mayPoolAcrossHardware("generation-throughput"), false);
  assert.equal(mayPoolAcrossHardware("stability"), false);
});

test("exact personal measurements derive a verified claim", () => {
  assert.deepEqual(validateEvidenceRecord(record()), []);
  assert.equal(claimForEvidence(record()), "verified");
});

test("community measurements retain their community claim and match level", () => {
  const community = record({
    source: "community",
    hardwareMatch: "calibrated-neighbor",
    hardwareFingerprint: undefined,
    hardwareGroupId: "nvidia-24gb-bandwidth-900",
  });
  assert.deepEqual(validateEvidenceRecord(community), []);
  assert.equal(claimForEvidence(community), "community");
});

test("response preference rejects hardware partitioning", () => {
  const preference = record({
    metric: "response-preference",
    method: "preference",
    source: "community",
    hardwareMatch: "coarse-bucket",
    hardwareGroupId: "nvidia-24gb",
    interval: { lower: 0.53, upper: 0.61, unit: "probability", confidenceLevel: 0.95 },
    sampleCount: 120,
  });
  assert.match(validateEvidenceRecord(preference).join(" "), /must not be partitioned by hardware/);
});

test("experience preference requires hardware evidence", () => {
  const preference = record({
    metric: "experience-preference",
    method: "preference",
    source: "community",
    hardwareMatch: "not-applicable",
    interval: { lower: 0.53, upper: 0.61, unit: "probability" },
    sampleCount: 120,
  });
  assert.match(validateEvidenceRecord(preference).join(" "), /requires hardware-match evidence/);
});

test("estimates cannot masquerade as precise measurements", () => {
  const estimate = record({
    method: "estimate",
    source: "catalog",
    hardwareMatch: "coarse-bucket",
    hardwareFingerprint: undefined,
    hardwareGroupId: "nvidia-24gb",
    interval: { lower: 20, upper: 20, unit: "tokens-per-second" },
    sampleCount: 0,
  });
  assert.match(validateEvidenceRecord(estimate).join(" "), /range, not a point value/);
});

test("exact evidence fails closed without immutable identity", () => {
  const invalid = record({ configuration: undefined });
  assert.match(validateEvidenceRecord(invalid).join(" "), /immutable configuration identity/);
});

test("metric methods and units are enforced centrally", () => {
  const invalid = record({
    metric: "energy-per-task",
    method: "estimate",
    interval: { lower: 10, upper: 20, unit: "milliseconds" },
  });
  const issues = validateEvidenceRecord(invalid).join(" ");
  assert.match(issues, /does not allow method estimate/);
  assert.match(issues, /requires unit joules/);
});

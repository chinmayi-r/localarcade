import { metricKinds, type EvidenceClaim, type EvidenceRecord, type MetricKind } from "./types";
import { policyForMetric } from "./scope-policy";

const SHA256 = /^[a-f0-9]{64}$/i;

export function validateEvidenceRecord(record: EvidenceRecord): string[] {
  const issues: string[] = [];

  if (!metricKinds.includes(record.metric as MetricKind)) {
    return [`Unknown metric: ${String(record.metric)}`];
  }

  const policy = policyForMetric(record.metric);
  if (!policy.allowedMethods.includes(record.method)) {
    issues.push(`${record.metric} does not allow method ${record.method}.`);
  }
  if (record.interval.unit !== policy.unit) {
    issues.push(`${record.metric} requires unit ${policy.unit}.`);
  }

  const { lower, upper, confidenceLevel } = record.interval;
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower > upper) {
    issues.push("Evidence interval must contain finite, ordered bounds.");
  }
  if (record.method === "estimate" && lower === upper) {
    issues.push("Estimated evidence must be a range, not a point value.");
  }
  if (confidenceLevel !== undefined && (confidenceLevel <= 0 || confidenceLevel >= 1)) {
    issues.push("Confidence level must be between 0 and 1.");
  }
  if (record.interval.unit === "probability" && (lower < 0 || upper > 1)) {
    issues.push("Probability evidence must stay between 0 and 1.");
  }

  if (!Number.isInteger(record.sampleCount) || record.sampleCount < 0) {
    issues.push("Sample count must be a non-negative integer.");
  }
  if (record.method !== "estimate" && record.sampleCount === 0) {
    issues.push("Measured and preference evidence require at least one sample.");
  }
  if (!record.observedAt || Number.isNaN(Date.parse(record.observedAt))) {
    issues.push("Observed-at must be a valid timestamp.");
  }
  if (record.provenanceLinks.length === 0) {
    issues.push("At least one provenance link is required.");
  }

  const hardwareConditioned = policy.conditioning === "configuration-and-hardware";
  if (hardwareConditioned && record.hardwareMatch === "not-applicable") {
    issues.push(`${record.metric} requires hardware-match evidence.`);
  }
  if (!hardwareConditioned && record.hardwareMatch !== "not-applicable") {
    issues.push(`${record.metric} must not be partitioned by hardware.`);
  }
  if (record.hardwareMatch === "exact" && !record.hardwareFingerprint) {
    issues.push("Exact hardware evidence requires a hardware fingerprint.");
  }
  if (["calibrated-neighbor", "coarse-bucket"].includes(record.hardwareMatch) && !record.hardwareGroupId) {
    issues.push("Grouped hardware evidence requires a hardware group id.");
  }

  if (record.configurationMatch === "exact") {
    if (!record.configuration) {
      issues.push("Exact configuration evidence requires immutable configuration identity.");
    } else {
      if (!SHA256.test(record.configuration.artifactSha256)) issues.push("Artifact identity must be a full SHA-256 hash.");
      if (!record.configuration.runtimeBuild.trim()) issues.push("Runtime build is required.");
      if (!record.configuration.settingsFingerprint.trim()) issues.push("Settings fingerprint is required.");
    }
  }

  return issues;
}

export function assertValidEvidenceRecord(record: EvidenceRecord): EvidenceRecord {
  const issues = validateEvidenceRecord(record);
  if (issues.length) throw new TypeError(issues.join(" "));
  return record;
}

export function claimForEvidence(record: EvidenceRecord): EvidenceClaim {
  assertValidEvidenceRecord(record);
  if (record.method === "estimate") return "estimated";
  if (record.method === "preference") return "preference";
  if (record.source === "personal" && record.hardwareMatch === "exact" && record.configurationMatch === "exact") {
    return "verified";
  }
  if (record.source === "community") return "community";
  return "measured";
}

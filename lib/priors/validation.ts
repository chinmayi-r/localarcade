import type { NumericRange, ThroughputPrior, ThroughputPriorSnapshot } from "./types";

export function validateThroughputPrior(prior: ThroughputPrior): string[] {
  const issues: string[] = [];
  if (!prior.id.trim()) issues.push("Prior id is required.");
  if (!prior.accelerator.id.trim() || !prior.accelerator.family.trim()) issues.push("Accelerator identity and family are required.");
  if (!(prior.accelerator.memoryGb > 0)) issues.push("Accelerator memory must be positive.");
  if (!prior.artifact.family.trim() || !(prior.artifact.parameterCountBillion > 0) || !prior.artifact.quantization.trim()) issues.push("Artifact scope is incomplete.");
  if (!prior.runtime.product.trim() || !prior.runtime.engine.trim() || !prior.runtime.version.trim() || !prior.runtime.commit.trim() || !prior.runtime.backend.trim()) issues.push("Runtime scope is incomplete.");
  if (!prior.conditions.operatingSystem.trim() || !prior.conditions.architecture.trim() || !prior.conditions.protocol.trim()) issues.push("Measurement conditions are incomplete.");
  for (const [metric, range] of Object.entries(prior.ranges)) issues.push(...validateRange(range, metric));
  if (!Number.isInteger(prior.sampleCount) || prior.sampleCount < 2) issues.push("A range prior requires at least two samples.");
  if (prior.evidenceTier !== "tier-1" && prior.evidenceTier !== "tier-2") issues.push("Evidence tier is required.");
  if (!isHttpUrl(prior.sourceUrl)) issues.push("Source URL must be HTTP(S).");
  if (!isTimestamp(prior.observedAt) || !isTimestamp(prior.retrievedAt)) issues.push("Observation and retrieval timestamps are required.");
  return issues;
}

export function validateThroughputPriorSnapshot(snapshot: ThroughputPriorSnapshot): string[] {
  const issues: string[] = [];
  if (snapshot.schemaVersion !== 1) issues.push("Unsupported throughput-prior schema.");
  if (!isTimestamp(snapshot.generatedAt)) issues.push("Snapshot generation timestamp is required.");
  const ids = new Set<string>();
  for (const prior of snapshot.priors) {
    if (ids.has(prior.id)) issues.push(`Duplicate prior id: ${prior.id}.`);
    ids.add(prior.id);
    issues.push(...validateThroughputPrior(prior).map((issue) => `${prior.id}: ${issue}`));
  }
  return issues;
}

function validateRange(range: NumericRange, label: string) {
  const issues: string[] = [];
  if (!Number.isFinite(range.min) || !Number.isFinite(range.max) || range.min <= 0 || range.max < range.min) issues.push(`${label} must be a positive ordered range.`);
  return issues;
}

function isTimestamp(value: string) {
  return Boolean(value) && !Number.isNaN(Date.parse(value));
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

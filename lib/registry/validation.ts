import type { AcceleratorRegistryRecord, ArtifactRegistryRecord, RegistrySnapshot } from "./types";

const SHA256 = /^[a-f0-9]{64}$/i;
const IMMUTABLE_REVISION = /^[a-f0-9]{40,64}$/i;

export function validateArtifactRegistryRecord(record: ArtifactRegistryRecord): string[] {
  const issues: string[] = [];
  if (!record.id.trim()) issues.push("Artifact id is required.");
  if (!record.publisher.trim() || !record.repository.trim()) issues.push("Publisher and repository are required.");
  if (!IMMUTABLE_REVISION.test(record.revision)) issues.push("Artifact revision must be an immutable 40–64 character commit hash.");
  if (!record.fileName.trim()) issues.push("Artifact file name is required.");
  if (!SHA256.test(record.sha256)) issues.push("Artifact SHA-256 must be a full 64-character hash.");
  if (!Number.isInteger(record.fileSizeBytes) || record.fileSizeBytes <= 0) issues.push("Artifact file size must be a positive integer.");
  if (!Number.isInteger(record.maxContextTokens) || record.maxContextTokens <= 0) issues.push("Maximum context must be a positive integer.");
  if (!record.license.id.trim() || !isHttpUrl(record.license.sourceUrl)) issues.push("License id and source URL are required.");
  if (record.runtimeCompatibility.length === 0) issues.push("At least one sourced runtime compatibility claim is required.");
  for (const claim of record.runtimeCompatibility) {
    if (!isHttpUrl(claim.sourceUrl)) issues.push(`Runtime ${claim.runtime} requires a source URL.`);
  }
  issues.push(...validateSource(record.source.url, record.source.retrievedAt, "Artifact"));
  return issues;
}

export function validateAcceleratorRegistryRecord(record: AcceleratorRegistryRecord): string[] {
  const issues: string[] = [];
  if (!record.id.trim() || !record.canonicalName.trim()) issues.push("Accelerator id and canonical name are required.");
  if (record.variants.length === 0) issues.push("An accelerator requires at least one explicit memory variant.");
  const variantIds = new Set<string>();
  for (const variant of record.variants) {
    if (!variant.id.trim() || variantIds.has(variant.id)) issues.push("Accelerator variant ids must be present and unique.");
    variantIds.add(variant.id);
    if (!Number.isInteger(variant.memoryBytes) || variant.memoryBytes <= 0) issues.push(`Variant ${variant.id || "<missing>"} requires positive memory bytes.`);
    if (!isHttpUrl(variant.sourceUrl)) issues.push(`Variant ${variant.id || "<missing>"} requires a source URL.`);
  }
  if (record.supportedBackends.length === 0) issues.push("At least one supported backend is required.");
  issues.push(...validateSource(record.source.url, record.source.retrievedAt, "Accelerator"));
  return issues;
}

export function validateRegistrySnapshot(snapshot: RegistrySnapshot): string[] {
  const issues: string[] = [];
  if (snapshot.schemaVersion !== 1) issues.push(`Unsupported registry schema: ${String(snapshot.schemaVersion)}.`);
  if (!snapshot.snapshotId.trim()) issues.push("Snapshot id is required.");
  if (!isTimestamp(snapshot.generatedAt)) issues.push("Snapshot generated-at must be a valid timestamp.");
  issues.push(...duplicates(snapshot.artifacts.map((record) => record.id), "artifact id"));
  issues.push(...duplicates(snapshot.accelerators.map((record) => record.id), "accelerator id"));
  for (const record of snapshot.artifacts) issues.push(...validateArtifactRegistryRecord(record).map((issue) => `${record.id}: ${issue}`));
  for (const record of snapshot.accelerators) issues.push(...validateAcceleratorRegistryRecord(record).map((issue) => `${record.id}: ${issue}`));
  return issues;
}

function validateSource(url: string, retrievedAt: string, label: string) {
  const issues: string[] = [];
  if (!isHttpUrl(url)) issues.push(`${label} source must be an HTTP(S) URL.`);
  if (!isTimestamp(retrievedAt)) issues.push(`${label} retrieval time must be a valid timestamp.`);
  return issues;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isTimestamp(value: string) {
  return Boolean(value) && !Number.isNaN(Date.parse(value));
}

function duplicates(values: string[], label: string) {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].map((value) => `Duplicate ${label}: ${value}.`);
}

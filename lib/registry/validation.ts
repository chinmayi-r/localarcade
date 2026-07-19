import { quarantineCodes, type AcceleratorRegistryRecord, type ArtifactRegistryRecord, type FieldProvenance, type RegistrySnapshot } from "./types";

const SHA256 = /^[a-f0-9]{64}$/i;
const IMMUTABLE_REVISION = /^[a-f0-9]{40,64}$/i;

export function validateArtifactRegistryRecord(record: ArtifactRegistryRecord): string[] {
  const issues: string[] = [];
  if (!record.id.trim()) issues.push("Artifact id is required.");
  if (!record.publisher.trim() || !record.repository.trim()) issues.push("Publisher and repository are required.");
  if (!IMMUTABLE_REVISION.test(record.revision)) issues.push("Artifact revision must be an immutable 40–64 character commit hash.");
  if (!record.fileName.toLowerCase().endsWith(".gguf")) issues.push("Artifact file must be GGUF.");
  if (!SHA256.test(record.sha256)) issues.push("Artifact SHA-256 must be a full 64-character hash.");
  if (!Number.isInteger(record.fileSizeBytes) || record.fileSizeBytes <= 0) issues.push("Artifact file size must be a positive integer.");
  if (!record.quantization.trim()) issues.push("Quantization is required.");
  if (!record.baseModel.trim() || !record.family.trim() || !record.model.trim()) issues.push("Base model, family and model are required.");
  if (!Number.isInteger(record.maxContextTokens) || record.maxContextTokens <= 0) issues.push("Maximum context must be a positive integer.");
  if (!record.chatTemplate.trim()) issues.push("Chat template is required.");
  if (record.status !== "triage" && record.status !== "promoted") issues.push("Artifact status must be triage or promoted.");
  if (!record.license.id.trim() || !isHttpUrl(record.license.sourceUrl)) issues.push("License id and source URL are required.");
  for (const field of ["id", "publisher", "repository", "revision", "fileName", "sha256", "fileSizeBytes", "format", "quantization", "baseModel", "family", "model", "maxContextTokens", "license", "chatTemplate"] as const) {
    const provenance = record.provenance[field];
    if (!provenance) issues.push(`Artifact ${field} provenance is required.`);
    else issues.push(...validateProvenance(provenance, `Artifact ${field}`));
  }
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
  issues.push(...validateProvenance(record.source, "Accelerator"));
  return issues;
}

export function validateRegistrySnapshot(snapshot: RegistrySnapshot): string[] {
  const issues: string[] = [];
  if (snapshot.schemaVersion !== 4) issues.push(`Unsupported registry schema: ${String(snapshot.schemaVersion)}.`);
  if (!snapshot.snapshotId.trim()) issues.push("Snapshot id is required.");
  if (!isTimestamp(snapshot.generatedAt)) issues.push("Snapshot generated-at must be a valid timestamp.");
  if (!isTimestamp(snapshot.lastIngestSucceededAt)) issues.push("Snapshot last-ingest-succeeded-at must be a valid timestamp.");
  issues.push(...duplicates(snapshot.artifacts.map((record) => record.id), "artifact id"));
  issues.push(...duplicates(snapshot.accelerators.map((record) => record.id), "accelerator id"));
  for (const record of snapshot.artifacts) issues.push(...validateArtifactRegistryRecord(record).map((issue) => `${record.id}: ${issue}`));
  for (const record of snapshot.accelerators) issues.push(...validateAcceleratorRegistryRecord(record).map((issue) => `${record.id}: ${issue}`));
  for (const record of snapshot.quarantine) {
    if (!quarantineCodes.includes(record.code)) issues.push(`${record.repository}: Unknown quarantine code.`);
    if (!IMMUTABLE_REVISION.test(record.revision)) issues.push(`${record.repository}: Quarantine revision must be immutable.`);
    if (!record.reason.trim() || !isHttpUrl(record.sourceUrl) || !isTimestamp(record.recordedAt)) issues.push(`${record.repository}: Quarantine provenance is incomplete.`);
  }
  return issues;
}

function validateProvenance(value: FieldProvenance, label: string) {
  const issues: string[] = [];
  if (!isHttpUrl(value.sourceUrl)) issues.push(`${label} source must be an HTTP(S) URL.`);
  if (!isTimestamp(value.retrievedAt)) issues.push(`${label} retrieval time must be a valid timestamp.`);
  if (!value.kind) issues.push(`${label} provenance kind is required.`);
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

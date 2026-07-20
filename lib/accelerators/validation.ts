import type { AcceleratorEntry, AcceleratorSnapshot } from "./types";

export function validateAcceleratorEntry(entry: AcceleratorEntry): string[] {
  const issues: string[] = [];
  if (!entry.id.trim()) issues.push("Accelerator id is required.");
  if (entry.vendor !== "nvidia" && entry.vendor !== "apple") issues.push(`Unknown vendor: ${String(entry.vendor)}.`);
  if (!entry.marketingName.trim()) issues.push("Marketing name is required.");
  if (entry.kind !== "gpu" && entry.kind !== "integrated") issues.push(`Unknown kind: ${String(entry.kind)}.`);
  if (!entry.family.trim()) issues.push("Family is required.");
  if (!entry.memoryVariants.length) issues.push("At least one sourced memory variant is required.");
  const seen = new Set<number>();
  for (const variant of entry.memoryVariants) {
    if (!(variant.memoryGb > 0)) issues.push(`Memory variant must be positive, got ${variant.memoryGb}.`);
    if (seen.has(variant.memoryGb)) issues.push(`Duplicate memory variant: ${variant.memoryGb} GB.`);
    seen.add(variant.memoryGb);
  }
  if (entry.memoryBandwidthGBps !== undefined && !(entry.memoryBandwidthGBps > 0)) issues.push("Bandwidth, when present, must be positive.");
  if (!isHttpsUrl(entry.sourceUrl)) issues.push("Source URL must be HTTPS.");
  if (!entry.retrievedAt || Number.isNaN(Date.parse(entry.retrievedAt))) issues.push("Retrieval timestamp is required.");
  return issues;
}

export function validateAcceleratorSnapshot(snapshot: AcceleratorSnapshot): string[] {
  const issues: string[] = [];
  if (snapshot.schemaVersion !== 1) issues.push("Unsupported accelerator schema version.");
  if (!snapshot.generatedAt || Number.isNaN(Date.parse(snapshot.generatedAt))) issues.push("Snapshot generation timestamp is required.");
  const ids = new Set<string>();
  for (const entry of snapshot.accelerators) {
    if (ids.has(entry.id)) issues.push(`Duplicate accelerator id: ${entry.id}.`);
    ids.add(entry.id);
    issues.push(...validateAcceleratorEntry(entry).map((issue) => `${entry.id}: ${issue}`));
  }
  return issues;
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

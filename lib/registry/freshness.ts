import type { ArtifactRegistryRecord } from "./types";

export const REGISTRY_MAX_AGE_DAYS = 7;
export const REGISTRY_MAX_AGE_MS = REGISTRY_MAX_AGE_DAYS * 24 * 60 * 60 * 1_000;

export type RegistryFreshness =
  | { fresh: true; ageMs: number }
  | { fresh: false; ageMs?: number; reason: string };

export function assessRegistryFreshness(lastIngestSucceededAt: string, now = Date.now(), maxAgeMs = REGISTRY_MAX_AGE_MS): RegistryFreshness {
  const succeededAt = Date.parse(lastIngestSucceededAt);
  if (!Number.isFinite(succeededAt)) return { fresh: false, reason: "Registry last-success timestamp is invalid." };
  const ageMs = now - succeededAt;
  if (ageMs < -5 * 60 * 1_000) return { fresh: false, ageMs, reason: "Registry last-success timestamp is in the future." };
  if (ageMs > maxAgeMs) return { fresh: false, ageMs, reason: `Registry is older than ${REGISTRY_MAX_AGE_DAYS} days.` };
  return { fresh: true, ageMs: Math.max(0, ageMs) };
}

export function isRecommendableArtifact(artifact: ArtifactRegistryRecord) {
  return artifact.status === "promoted";
}

export function assertRegistryFresh(lastIngestSucceededAt: string, now = Date.now()) {
  const freshness = assessRegistryFreshness(lastIngestSucceededAt, now);
  if (!freshness.fresh) throw new Error(freshness.reason);
  return freshness;
}

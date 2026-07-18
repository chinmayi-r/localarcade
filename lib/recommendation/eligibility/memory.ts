import type { Artifact, Eligibility, RecommendationQuery } from "../types";

const PLATFORM_SAFETY_FACTOR = {
  nvidia: 0.86,
  amd: 0.84,
  apple: 0.72,
  cpu: 0.7,
} as const;

const RUNTIME_OVERHEAD_GB = 0.7;

export function evaluateMemoryFit(artifact: Artifact, query: RecommendationQuery): Eligibility {
  const usableMemoryGb = query.hardware.availableMemoryGb * PLATFORM_SAFETY_FACTOR[query.hardware.platform];
  const kvCacheGb = artifact.kvCacheGbPer8K * (query.desiredContextK / 8);
  const requiredMemoryGb = artifact.weightSizeGb + kvCacheGb + RUNTIME_OVERHEAD_GB;
  const reasons: string[] = [];

  if (query.desiredContextK > artifact.maxContextK) {
    reasons.push(`Requested ${query.desiredContextK}K context exceeds the artifact's ${artifact.maxContextK}K catalog limit.`);
  }
  if (requiredMemoryGb > usableMemoryGb) {
    reasons.push(`Estimated ${requiredMemoryGb.toFixed(1)} GB requirement exceeds the ${usableMemoryGb.toFixed(1)} GB safety envelope.`);
  }

  return {
    eligible: reasons.length === 0,
    requiredMemoryGb,
    usableMemoryGb,
    reasons,
  };
}


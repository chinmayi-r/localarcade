import { demoArtifacts } from "./catalog/demo-artifacts";
import { evaluateMemoryFit } from "./eligibility/memory";
import { rankingStrategies } from "./strategies";
import type { Artifact, Recommendation, RecommendationQuery } from "./types";

const PLATFORM_SPEED_FACTOR = {
  nvidia: 1,
  amd: 0.82,
  apple: 0.72,
  cpu: 0.18,
} as const;

export function recommend(
  query: RecommendationQuery,
  artifacts: Artifact[] = demoArtifacts,
  limit = 5,
): Recommendation[] {
  const strategy = rankingStrategies[query.strategy];
  if (!strategy) throw new Error(`Unknown ranking strategy: ${query.strategy}`);

  const scored = artifacts.flatMap((artifact) => {
    const eligibility = evaluateMemoryFit(artifact, query);
    if (!eligibility.eligible) return [];

    const estimatedSpeed = estimateSpeed(artifact, query);
    const score = strategy.score({ artifact, eligibility, query, estimatedSpeed });
    const explanation = [
      `${eligibility.requiredMemoryGb.toFixed(1)} GB estimated use inside a ${eligibility.usableMemoryGb.toFixed(1)} GB safety envelope.`,
      `${artifact.taskScores[query.task]}/100 seeded ${query.task} score; not a published benchmark.`,
      `${strategy.shortLabel} strategy selected.`,
    ];

    return [{ artifact, score, eligibility, estimatedSpeed, explanation }];
  });

  // Avoid filling the list with many quantizations of one model family.
  const bestPerFamily = new Map<string, (typeof scored)[number]>();
  for (const item of scored.sort((a, b) => b.score - a.score)) {
    if (!bestPerFamily.has(item.artifact.family)) bestPerFamily.set(item.artifact.family, item);
  }

  return [...bestPerFamily.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item, index) => ({
      artifact: item.artifact,
      rank: index + 1,
      score: item.score,
      estimatedTokensPerSecond: [Math.max(1, Math.round(item.estimatedSpeed * 0.88)), Math.max(2, Math.round(item.estimatedSpeed * 1.12))],
      requiredMemoryGb: item.eligibility.requiredMemoryGb,
      configuration: {
        contextK: query.desiredContextK,
        runtime: item.artifact.runtime,
      },
      explanation: item.explanation,
    }));
}

function estimateSpeed(artifact: Artifact, query: RecommendationQuery) {
  const memoryScale = (24 / Math.max(query.hardware.availableMemoryGb, 4)) ** 0.16;
  return artifact.baselineTokensPerSecond * PLATFORM_SPEED_FACTOR[query.hardware.platform] * memoryScale;
}

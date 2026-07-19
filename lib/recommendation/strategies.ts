import type { RecommendationItem, StrategyId, TaskId } from "./types";

export type RankingStrategy = {
  id: StrategyId;
  label: string;
  description: string;
  score(item: RecommendationItem, all: RecommendationItem[], task: TaskId): number | undefined;
};

const rangeMidpoint = (item: RecommendationItem) => item.throughput.kind === "range"
  ? (item.throughput.ranges.generationTokensPerSecond.min + item.throughput.ranges.generationTokensPerSecond.max) / 2
  : undefined;
const quality = (item: RecommendationItem, task: TaskId) => item.candidate.comparativeQuality?.[task]?.value;
const memoryHeadroom = (item: RecommendationItem) => 1 - item.fit.requiredBytes / item.fit.physicalMemoryBytes;
const normalize = (value: number, values: number[]) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? 0.5 : (value - min) / (max - min);
};

export const rankingStrategies: Record<StrategyId, RankingStrategy> = {
  balanced: {
    id: "balanced", label: "Balanced",
    description: "Uses comparable task, speed, context and memory evidence; otherwise results stay unranked.",
    score(item, all, task) {
      const q = quality(item, task); const s = rangeMidpoint(item);
      if (q === undefined || s === undefined) return undefined;
      const qs = all.map((candidate) => quality(candidate, task)).filter((value): value is number => value !== undefined);
      const ss = all.map(rangeMidpoint).filter((value): value is number => value !== undefined);
      return 0.45 * normalize(q, qs) + 0.25 * normalize(s, ss) + 0.15 * normalize(item.candidate.artifact.maxContextTokens, all.map((x) => x.candidate.artifact.maxContextTokens)) + 0.15 * memoryHeadroom(item);
    },
  },
  quality: {
    id: "quality", label: "Highest quality",
    description: "Requires comparable task evidence for the selected use.",
    score: (item, _all, task) => quality(item, task),
  },
  speed: {
    id: "speed", label: "Fastest response",
    description: "Uses sourced generation-throughput ranges for the same hardware kind, product and engine.",
    score: (item) => rangeMidpoint(item),
  },
  "long-context": {
    id: "long-context", label: "Longest context",
    description: "Uses the sourced artifact context limit after the requested fit check.",
    score: (item) => item.candidate.artifact.maxContextTokens,
  },
  lightest: {
    id: "lightest", label: "Lowest memory",
    description: "Uses the explicit fit calculation for the selected context.",
    score: (item) => -item.fit.requiredBytes,
  },
};

export function strategyScore(strategy: StrategyId, task: string, item: RecommendationItem, all: RecommendationItem[]) {
  return rankingStrategies[strategy].score(item, all, task as TaskId);
}

export const strategyOptions = Object.values(rankingStrategies);

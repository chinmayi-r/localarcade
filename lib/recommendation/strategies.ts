import type { Artifact, Eligibility, RecommendationQuery, StrategyId } from "./types";

export type ScoreInputs = {
  artifact: Artifact;
  eligibility: Eligibility;
  query: RecommendationQuery;
  estimatedSpeed: number;
};

export type RankingStrategy = {
  id: StrategyId;
  label: string;
  shortLabel: string;
  description: string;
  score(inputs: ScoreInputs): number;
};

const quality = ({ artifact, query }: ScoreInputs) => artifact.taskScores[query.task] / 100;
const speed = ({ estimatedSpeed }: ScoreInputs) => Math.min(estimatedSpeed / 80, 1);
const context = ({ artifact }: ScoreInputs) => Math.min(artifact.maxContextK / 128, 1);
const headroom = ({ eligibility }: ScoreInputs) => Math.max(0, 1 - eligibility.requiredMemoryGb / eligibility.usableMemoryGb);
const stability = ({ artifact }: ScoreInputs) => artifact.stabilityScore;

function weighted(parts: Array<[number, (inputs: ScoreInputs) => number]>) {
  return (inputs: ScoreInputs) => parts.reduce((total, [weight, metric]) => total + weight * metric(inputs), 0);
}

/** Add, remove or tune user-selectable sorting methods here. */
export const rankingStrategies: Record<StrategyId, RankingStrategy> = {
  balanced: {
    id: "balanced",
    label: "Balanced",
    shortLabel: "Balanced",
    description: "A compromise between task quality, speed, context, stability and memory headroom.",
    score: weighted([[0.43, quality], [0.2, speed], [0.12, context], [0.12, stability], [0.13, headroom]]),
  },
  quality: {
    id: "quality",
    label: "Highest quality",
    shortLabel: "Quality",
    description: "Prioritizes seeded task evidence while retaining minimum stability and fit headroom.",
    score: weighted([[0.72, quality], [0.08, speed], [0.06, context], [0.09, stability], [0.05, headroom]]),
  },
  speed: {
    id: "speed",
    label: "Fastest response",
    shortLabel: "Fastest",
    description: "Prioritizes predicted generation speed without ignoring task usefulness.",
    score: weighted([[0.25, quality], [0.58, speed], [0.03, context], [0.07, stability], [0.07, headroom]]),
  },
  "long-context": {
    id: "long-context",
    label: "Longest context",
    shortLabel: "Long context",
    description: "Rewards context capacity and the memory headroom needed to use it safely.",
    score: weighted([[0.25, quality], [0.08, speed], [0.47, context], [0.08, stability], [0.12, headroom]]),
  },
  lightest: {
    id: "lightest",
    label: "Lowest memory",
    shortLabel: "Lightest",
    description: "Favors small memory requirements, leaving room for other applications.",
    score: weighted([[0.22, quality], [0.16, speed], [0.03, context], [0.09, stability], [0.5, headroom]]),
  },
};

export const strategyOptions = Object.values(rankingStrategies);


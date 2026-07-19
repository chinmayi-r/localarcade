import { recommendationPolicy } from "./policy";
import type { RecommendationItem, RecommendationQuery, RecommendationRole } from "./types";

export type ScoredItem = { item: RecommendationItem; score: number | undefined };

/** Tree A6: keep one configuration per family and nest its alternatives. */
export function dedupeByFamily(items: RecommendationItem[]) {
  const families = new Map<string, RecommendationItem>();
  for (const item of items) {
    const current = families.get(item.candidate.artifact.family);
    if (!current) families.set(item.candidate.artifact.family, item);
    else if (item.fit.requiredBytes < current.fit.requiredBytes) {
      item.alternatives.push(current.candidate, ...current.alternatives);
      families.set(item.candidate.artifact.family, item);
    } else current.alternatives.push(item.candidate);
  }
  return [...families.values()];
}

/** A6X: overlapping speed ranges and exact score ties cannot be ordered. */
export function hasUnsupportedTie(query: RecommendationQuery, ordered: ScoredItem[]) {
  if (ordered.length < 2) return false;
  if (query.strategy === "speed") {
    const [a, b] = ordered.map(({ item }) => item.throughput);
    if (a.kind !== "range" || b.kind !== "range") return true;
    return a.ranges.generationTokensPerSecond.min <= b.ranges.generationTokensPerSecond.max
      && b.ranges.generationTokensPerSecond.min <= a.ranges.generationTokensPerSecond.max;
  }
  return Math.abs((ordered[0].score ?? 0) - (ordered[1].score ?? 0)) <= recommendationPolicy.scoreTieEpsilon;
}

/** Selects distinct, evidence-supported reasons for each top-five slot. */
export function buildRolePortfolio(query: RecommendationQuery, ordered: RecommendationItem[], limit: number) {
  if (ordered.length < limit) return ordered.map((item, index) => index === 0 ? { ...item, role: recommendationPolicy.roles[0] } : item);
  if (ordered.some((item) => item.candidate.comparativeQuality?.[query.task]?.value === undefined || item.throughput.kind !== "range")) return undefined;
  const remaining = [...ordered];
  const selected: RecommendationItem[] = [];
  const take = (role: RecommendationRole, compare: (a: RecommendationItem, b: RecommendationItem) => number) => {
    remaining.sort(compare);
    const item = remaining.shift();
    if (item) selected.push({ ...item, role });
  };
  take("primary-match", (a, b) => ordered.indexOf(a) - ordered.indexOf(b));
  take("quality-option", (a, b) => (b.candidate.comparativeQuality?.[query.task]?.value ?? 0) - (a.candidate.comparativeQuality?.[query.task]?.value ?? 0));
  take("fast-option", (a, b) => throughputMidpoint(b) - throughputMidpoint(a));
  take("long-context-option", (a, b) => b.maxFeasibleContextTokens - a.maxFeasibleContextTokens);
  take("memory-efficient-option", (a, b) => a.fit.requiredBytes - b.fit.requiredBytes);
  return selected.slice(0, limit);
}

function throughputMidpoint(item: RecommendationItem) {
  return item.throughput.kind === "range" ? (item.throughput.ranges.generationTokensPerSecond.min + item.throughput.ranges.generationTokensPerSecond.max) / 2 : Number.NEGATIVE_INFINITY;
}

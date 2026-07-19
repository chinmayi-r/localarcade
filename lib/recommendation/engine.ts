import { fit } from "../fit";
import { estimateThroughput, throughputPriors } from "../priors";
import type { ThroughputPrior } from "../priors";
import { realCandidates } from "./catalog/real-candidates";
import { rankingStrategies, strategyScore } from "./strategies";
import type { AcceleratorKind, RecommendationCandidate, RecommendationItem, RecommendationOutcome, RecommendationQuery, RecommendationRole } from "./types";

const GB = 1024 ** 3;
const ROLES: RecommendationRole[] = ["primary-match", "quality-option", "fast-option", "long-context-option", "memory-efficient-option"];

/** Tree A4-A6: fit first; rank only when the selected metric has comparable evidence. */
export function recommend(query: RecommendationQuery, candidates: RecommendationCandidate[] = realCandidates, limit = 5, priors: ThroughputPrior[] = throughputPriors): RecommendationOutcome {
  if (!rankingStrategies[query.strategy]) throw new Error(`Unknown ranking strategy: ${query.strategy}`);
  const contextTokens = query.desiredContextK * 1024;
  const compatible = evaluate(query, candidates, contextTokens, priors);

  if (!compatible.length) {
    const reducedContext = Math.min(8 * 1024, contextTokens);
    const reduced = contextTokens > reducedContext ? evaluate(query, candidates, reducedContext, priors) : [];
    if (reduced.length) return {
      kind: "contradictory",
      items: dedupe(reduced).slice(0, limit),
      message: `The requested ${query.desiredContextK}K context conflicts with the available memory. These fit only at 8K; no constraint was silently dropped.`,
    };
    return { kind: "nothing-fits", items: [], message: "No configuration with a sourced fit profile fits the selected hardware and context." };
  }

  const unique = dedupe(compatible);
  const scored = unique.map((item) => ({ item, score: strategyScore(query.strategy, query.task, item, unique) }));
  if (scored.some(({ score }) => score === undefined)) return {
    kind: "unranked",
    items: unique.slice(0, limit),
    message: "These configurations fit, but the available evidence cannot support an honest ordering for this preference.",
  };

  const ordered = scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  if (hasTieOrOverlappingSpeed(query, ordered)) return {
    kind: "unranked",
    items: ordered.map(({ item }) => item).slice(0, limit),
    message: "These configurations are tied or within the observed range, so no rank order is claimed.",
  };

  const portfolio = buildPortfolio(query, ordered.map(({ item }) => item), limit);
  if (!portfolio) return {
    kind: "unranked",
    items: ordered.map(({ item }) => item).slice(0, limit),
    message: "The selected metric can order these fits, but the evidence cannot support distinct top-five roles yet.",
  };
  return {
    kind: "ranked",
    items: portfolio,
    message: `${Math.min(limit, ordered.length)} evidence-backed family matches for the selected preference.`,
  };
}

function evaluate(query: RecommendationQuery, candidates: RecommendationCandidate[], contextTokens: number, priors: ThroughputPrior[]): RecommendationItem[] {
  const acceleratorKind = hardwareKind(query);
  return candidates.flatMap((candidate) => {
    if (!candidate.hardwareKinds.includes(acceleratorKind)) return [];
    let result;
    try {
      result = fit(candidate.fitArtifact, {
        physicalMemoryBytes: Math.round(query.hardware.availableMemoryGb * GB),
        osReserveBytes: 0,
        displayReserveBytes: 0,
        safetyMarginBps: 1_000,
      }, contextTokens, candidate.runtime.kvCache);
    } catch {
      return [];
    }
    if (!result.fits) return [];
    const throughput = estimateThroughput({
      acceleratorId: query.hardware.acceleratorId,
      acceleratorFamily: query.hardware.acceleratorFamily,
      acceleratorKind,
      sizeBand: candidate.sizeBand,
      product: candidate.runtime.product,
      engine: candidate.runtime.engine,
    }, priors);
    return [{ candidate, fit: result, throughput, contextTokens, alternatives: [] }];
  });
}

function buildPortfolio(query: RecommendationQuery, ordered: RecommendationItem[], limit: number) {
  if (ordered.length < limit) return ordered.map((item, index) => index === 0 ? { ...item, role: ROLES[0] } : item);
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
  take("long-context-option", (a, b) => b.candidate.artifact.maxContextTokens - a.candidate.artifact.maxContextTokens);
  take("memory-efficient-option", (a, b) => a.fit.requiredBytes - b.fit.requiredBytes);
  return selected.slice(0, limit);
}

function throughputMidpoint(item: RecommendationItem) {
  return item.throughput.kind === "range" ? (item.throughput.ranges.generationTokensPerSecond.min + item.throughput.ranges.generationTokensPerSecond.max) / 2 : Number.NEGATIVE_INFINITY;
}

function dedupe(items: RecommendationItem[]) {
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

function hasTieOrOverlappingSpeed(query: RecommendationQuery, ordered: Array<{ item: RecommendationItem; score: number | undefined }>) {
  if (ordered.length < 2) return false;
  if (query.strategy === "speed") {
    const [a, b] = ordered.map(({ item }) => item.throughput);
    if (a.kind !== "range" || b.kind !== "range") return true;
    return a.ranges.generationTokensPerSecond.min <= b.ranges.generationTokensPerSecond.max
      && b.ranges.generationTokensPerSecond.min <= a.ranges.generationTokensPerSecond.max;
  }
  return Math.abs((ordered[0].score ?? 0) - (ordered[1].score ?? 0)) < Number.EPSILON;
}

function hardwareKind(query: RecommendationQuery): AcceleratorKind {
  if (query.hardware.platform === "cpu") return "cpu";
  if (query.hardware.platform === "apple") return "integrated";
  return "gpu";
}

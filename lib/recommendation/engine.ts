import { throughputPriors } from "../priors";
import type { ThroughputPrior } from "../priors";
import { evaluateCandidates } from "./candidate-evaluation";
import { realCandidates } from "./catalog/real-candidates";
import { recommendationPolicy } from "./policy";
import { buildRolePortfolio, dedupeByFamily, hasUnsupportedTie } from "./ranking";
import { rankingStrategies, strategyScore } from "./strategies";
import type { RecommendationCandidate, RecommendationOutcome, RecommendationQuery } from "./types";

/** Tree A4-A6: fit first; rank only when the selected metric has comparable evidence. */
export function recommend(query: RecommendationQuery, candidates: RecommendationCandidate[] = realCandidates, limit = recommendationPolicy.resultLimit, priors: ThroughputPrior[] = throughputPriors): RecommendationOutcome {
  if (!rankingStrategies[query.strategy]) throw new Error(`Unknown ranking strategy: ${query.strategy}`);
  const contextTokens = query.desiredContextK * recommendationPolicy.tokensPerContextK;
  const compatible = evaluateCandidates(query, candidates, contextTokens, priors);

  if (!compatible.length) {
    const reducedContext = Math.min(recommendationPolicy.reducedContextTokens, contextTokens);
    const reduced = contextTokens > reducedContext ? evaluateCandidates(query, candidates, reducedContext, priors) : [];
    if (reduced.length) return {
      kind: "contradictory",
      items: dedupeByFamily(reduced).slice(0, limit),
      message: `The requested ${query.desiredContextK}K context conflicts with the available memory. These fit only at ${reducedContext / recommendationPolicy.tokensPerContextK}K; no constraint was silently dropped.`,
    };
    return { kind: "nothing-fits", items: [], message: "No configuration with a sourced fit profile fits the selected hardware and context." };
  }

  const unique = dedupeByFamily(compatible);
  const scored = unique.map((item) => ({ item, score: strategyScore(query.strategy, query.task, item, unique) }));
  if (scored.some(({ score }) => score === undefined)) return unranked(unique, limit, "These configurations fit, but the available evidence cannot support an honest ordering for this preference.");

  const ordered = scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  if (hasUnsupportedTie(query, ordered)) return unranked(ordered.map(({ item }) => item), limit, "These configurations are tied or within the observed range, so no rank order is claimed.");

  const portfolio = buildRolePortfolio(query, ordered.map(({ item }) => item), limit);
  if (!portfolio) return unranked(ordered.map(({ item }) => item), limit, "The selected metric can order these fits, but the evidence cannot support distinct top-five roles yet.");
  return { kind: "ranked", items: portfolio, message: `${Math.min(limit, ordered.length)} evidence-backed family matches for the selected preference.` };
}

function unranked(items: RecommendationOutcome["items"], limit: number, message: string): RecommendationOutcome {
  return { kind: "unranked", items: items.slice(0, limit), message };
}

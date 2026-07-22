import type { NeutralCandidate, Rejection, StageResult } from "./types";

export type Relevance = { candidateId: string; value: number; scope: string; sourceIds: string[] };
export type DiversitySelection = { candidate: NeutralCandidate; marginalScore: number; relevance: number; maximumSimilarity: number };

function similarity(a: NeutralCandidate, b: NeutralCandidate, dimensions: string[]): number {
  if (dimensions.length === 0) return 0;
  return dimensions.filter((dimension) => a.diversity[dimension] === b.diversity[dimension]).length / dimensions.length;
}

export function selectDiverseTopK(candidates: NeutralCandidate[], relevance: Relevance[], options: { limit: number; tradeoff: number; scope: string; dimensions: string[] }): StageResult<DiversitySelection> {
  if (!Number.isInteger(options.limit) || options.limit < 0) throw new RangeError("limit must be a non-negative integer");
  if (!Number.isFinite(options.tradeoff) || options.tradeoff < 0 || options.tradeoff > 1) throw new RangeError("tradeoff must be in [0, 1]");
  const rejected: Rejection[] = [];
  const relevanceCounts = relevance.reduce((counts, entry) => counts.set(entry.candidateId, (counts.get(entry.candidateId) ?? 0) + 1), new Map<string, number>());
  const relevanceByCandidate = new Map(relevance.map((entry) => [entry.candidateId, entry]));
  const remaining = candidates.filter((candidate) => {
    const score = relevanceByCandidate.get(candidate.id);
    if (!score || relevanceCounts.get(candidate.id) !== 1 || !Number.isFinite(score.value) || score.value < 0 || score.value > 1 || score.sourceIds.length === 0) {
      rejected.push({ candidateId: candidate.id, stage: "diversity", code: "invalid-observation", detail: "exactly one sourced [0, 1] relevance value is required" });
      return false;
    }
    if (score.scope !== options.scope) {
      rejected.push({ candidateId: candidate.id, stage: "diversity", code: "incomparable-scope", detail: `relevance scope ${score.scope} does not match ${options.scope}` });
      return false;
    }
    const missing = options.dimensions.find((dimension) => !candidate.diversity[dimension]);
    if (missing) {
      rejected.push({ candidateId: candidate.id, stage: "diversity", code: "missing-diversity-dimension", detail: `missing ${missing}` });
      return false;
    }
    return true;
  });
  const eligible: DiversitySelection[] = [];
  while (remaining.length > 0 && eligible.length < options.limit) {
    const scored = remaining.map((candidate) => {
      const relevanceValue = relevanceByCandidate.get(candidate.id)!.value;
      const maximumSimilarity = eligible.length === 0 ? 0 : Math.max(...eligible.map((selected) => similarity(candidate, selected.candidate, options.dimensions)));
      return { candidate, relevance: relevanceValue, maximumSimilarity, marginalScore: options.tradeoff * relevanceValue - (1 - options.tradeoff) * maximumSimilarity };
    });
    scored.sort((a, b) => b.marginalScore - a.marginalScore || a.candidate.id.localeCompare(b.candidate.id));
    const chosen = scored[0];
    eligible.push(chosen);
    remaining.splice(remaining.findIndex((candidate) => candidate.id === chosen.candidate.id), 1);
  }
  return { eligible, rejected };
}

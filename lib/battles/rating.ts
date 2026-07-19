import type { BattleKind, BattlePair, BucketRatingTable, RatingEntry, RatingPolicy, Vote } from "./types";
import { validateBattlePair, validateVote } from "./validation";

type WeightedRecord = { wins: Map<string, Map<string, number>>; ties: Map<string, number>; configs: Set<string> };

/**
 * Bucket- and kind-scoped preference rating.
 *
 * - Only `accepted` votes on valid pairs from the requested bucket and kind count.
 *   Response and experience votes are computed by separate calls and never pooled.
 * - Vote weights come from policy (prompter vs third-party).
 * - `tie` splits its weight half to each side; `both-bad` is recorded but adds no
 *   preference signal.
 * - Strengths are Bradley–Terry, solved with the standard MM iteration
 *   (Hunter 2004; the methodology behind Chatbot Arena rankings,
 *   arXiv:2403.04132), normalized to mean 1 within the bucket.
 * - Confidence bands come from a seeded, deterministic bootstrap over votes.
 * - Below the policy vote threshold the table is `collecting` and its entries
 *   are explicitly provisional (I2: no displayed ordering without evidence).
 */
export function computeBucketRating(
  pairs: BattlePair[],
  votes: Vote[],
  scope: { bucketId: string; kind: BattleKind },
  policy: RatingPolicy,
): BucketRatingTable {
  const scopedPairs = pairs.filter((pair) => pair.bucketId === scope.bucketId && pair.kind === scope.kind && validateBattlePair(pair).length === 0);
  const pairsById = new Map(scopedPairs.map((pair) => [pair.id, pair]));
  const usable = votes.filter(
    (vote) => vote.integrity === "accepted" && vote.kind === scope.kind && pairsById.has(vote.pairId) && validateVote(vote, pairsById).length === 0,
  );
  if (!usable.length) return { status: "unavailable", bucketId: scope.bucketId, kind: scope.kind, reason: "No accepted votes exist for this bucket and battle kind." };

  const preferenceVotes = usable.filter((vote) => vote.choice !== "both-bad");
  const bothBadVotes = usable.length - preferenceVotes.length;
  const effectiveVotes = preferenceVotes.reduce((total, vote) => total + policy.voteWeights[vote.voterClass], 0);

  const record = tally(preferenceVotes, pairsById, policy);
  const strengths = solveBradleyTerry(record, policy);
  const bands = bootstrapBands(preferenceVotes, pairsById, policy, record.configs);
  const entries = buildEntries(record, strengths, bands);

  const base = { bucketId: scope.bucketId, kind: scope.kind, effectiveVotes, requiredVotes: policy.minEffectiveVotesForLive, bothBadVotes };
  return effectiveVotes >= policy.minEffectiveVotesForLive
    ? { status: "live", ...base, entries }
    : { status: "collecting", ...base, provisionalEntries: entries };
}

function tally(votes: Vote[], pairsById: Map<string, BattlePair>, policy: RatingPolicy): WeightedRecord {
  const wins = new Map<string, Map<string, number>>();
  const ties = new Map<string, number>();
  const configs = new Set<string>();
  const add = (winner: string, loser: string, weight: number) => {
    const row = wins.get(winner) ?? new Map<string, number>();
    row.set(loser, (row.get(loser) ?? 0) + weight);
    wins.set(winner, row);
  };
  for (const vote of votes) {
    const pair = pairsById.get(vote.pairId)!;
    const weight = policy.voteWeights[vote.voterClass];
    configs.add(pair.a.configurationId).add(pair.b.configurationId);
    if (vote.choice === "a") add(pair.a.configurationId, pair.b.configurationId, weight);
    else if (vote.choice === "b") add(pair.b.configurationId, pair.a.configurationId, weight);
    else {
      // Ties enter the Bradley–Terry math as half-wins for each side and are
      // additionally counted separately so reporting doesn't lose them.
      add(pair.a.configurationId, pair.b.configurationId, weight / 2);
      add(pair.b.configurationId, pair.a.configurationId, weight / 2);
      ties.set(pair.a.configurationId, (ties.get(pair.a.configurationId) ?? 0) + weight);
      ties.set(pair.b.configurationId, (ties.get(pair.b.configurationId) ?? 0) + weight);
    }
  }
  return { wins, ties, configs };
}

/** Hunter's MM algorithm for Bradley–Terry maximum likelihood, with an epsilon floor so zero-win configurations stay finite. */
function solveBradleyTerry(record: WeightedRecord, policy: RatingPolicy): Map<string, number> {
  const ids = [...record.configs].sort();
  const winsOf = (i: string, j: string) => record.wins.get(i)?.get(j) ?? 0;
  let strengths = new Map(ids.map((id) => [id, 1]));
  for (let iteration = 0; iteration < policy.solver.maxIterations; iteration += 1) {
    const next = new Map<string, number>();
    let maxDelta = 0;
    for (const i of ids) {
      let totalWins = 0;
      let denominator = 0;
      for (const j of ids) {
        if (i === j) continue;
        const nIj = winsOf(i, j) + winsOf(j, i);
        if (!nIj) continue;
        totalWins += winsOf(i, j);
        denominator += nIj / (strengths.get(i)! + strengths.get(j)!);
      }
      const updated = denominator ? Math.max(totalWins / denominator, 1e-9) : strengths.get(i)!;
      next.set(i, updated);
      maxDelta = Math.max(maxDelta, Math.abs(updated - strengths.get(i)!));
    }
    strengths = normalize(next);
    if (maxDelta < policy.solver.tolerance) break;
  }
  return strengths;
}

function normalize(strengths: Map<string, number>): Map<string, number> {
  const mean = [...strengths.values()].reduce((a, b) => a + b, 0) / strengths.size;
  return new Map([...strengths].map(([id, value]) => [id, value / mean]));
}

/** Deterministic percentile bootstrap: resample votes with replacement using a seeded PRNG, re-solve, take the 2.5%/97.5% band. */
function bootstrapBands(
  votes: Vote[],
  pairsById: Map<string, BattlePair>,
  policy: RatingPolicy,
  configs: Set<string>,
): Map<string, { lower: number; upper: number }> {
  const random = mulberry32(policy.bootstrap.seed);
  const samples = new Map<string, number[]>([...configs].map((id) => [id, []]));
  for (let resample = 0; resample < policy.bootstrap.resamples; resample += 1) {
    const drawn = Array.from({ length: votes.length }, () => votes[Math.floor(random() * votes.length)]);
    const strengths = solveBradleyTerry(tally(drawn, pairsById, policy), policy);
    for (const id of configs) samples.get(id)!.push(strengths.get(id) ?? 0);
  }
  return new Map(
    [...samples].map(([id, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return [id, { lower: percentile(sorted, 0.025), upper: percentile(sorted, 0.975) }];
    }),
  );
}

function percentile(sorted: number[], fraction: number): number {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round(fraction * (sorted.length - 1))));
  return sorted[index];
}

function buildEntries(record: WeightedRecord, strengths: Map<string, number>, bands: Map<string, { lower: number; upper: number }>): RatingEntry[] {
  return [...record.configs]
    .sort()
    .map((id) => {
      const weightedTies = record.ties.get(id) ?? 0;
      let weightedWins = 0;
      let weightedLosses = 0;
      for (const other of record.configs) {
        if (other === id) continue;
        // wins/losses report only decisive weight; the tie halves folded into
        // the solver's win matrix are backed out so the three columns are disjoint.
        weightedWins += record.wins.get(id)?.get(other) ?? 0;
        weightedLosses += record.wins.get(other)?.get(id) ?? 0;
      }
      weightedWins -= weightedTies / 2;
      weightedLosses -= weightedTies / 2;
      return { configurationId: id, strength: strengths.get(id) ?? 0, ci: bands.get(id) ?? { lower: 0, upper: 0 }, weightedWins, weightedLosses, weightedTies };
    })
    .sort((a, b) => b.strength - a.strength);
}

/** Deterministic 32-bit PRNG (public-domain mulberry32); seeded so bootstrap bands are reproducible. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

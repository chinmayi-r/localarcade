export type BattleKind = "response" | "experience";
export type VoterClass = "prompter" | "third-party";
export type VoteChoice = "a" | "b" | "tie" | "both-bad";
export type VoteIntegrity = "accepted" | "excluded";
export type PromptSource = "curated" | "own-prompt";

/** One side of a pair: an exact configuration plus the completed generation it produced. */
export type PairSide = {
  configurationId: string;
  outputRef: string;
  generation: {
    engineBuild: string;
    completed: boolean;
    samplingParams: Record<string, number | string>;
  };
};

/**
 * A publishable battle pair. Both generations must be complete (decision-tree D2X:
 * a DNF is a stability result, never a battle) and both sides must come from the
 * same hardware bucket so bucket-scoped ratings stay honest.
 */
export type BattlePair = {
  id: string;
  bucketId: string;
  kind: BattleKind;
  promptId: string;
  promptSource: PromptSource;
  a: PairSide;
  b: PairSide;
};

export type Vote = {
  id: string;
  pairId: string;
  kind: BattleKind;
  choice: VoteChoice;
  voterClass: VoterClass;
  integrity: VoteIntegrity;
};

export type RatingPolicy = {
  /** Multiplier applied to a vote by voter class. Product policy, not evidence. */
  voteWeights: Record<VoterClass, number>;
  /** D8: a bucket's table is `live` only at or above this effective-vote count. */
  minEffectiveVotesForLive: number;
  /** Deterministic bootstrap settings for confidence bands. */
  bootstrap: { resamples: number; seed: number };
  /** Maximum Bradley–Terry MM iterations and convergence tolerance. */
  solver: { maxIterations: number; tolerance: number };
};

export type RatingEntry = {
  configurationId: string;
  /** Bradley–Terry strength, normalized so the bucket's mean strength is 1. */
  strength: number;
  /** Seeded-bootstrap band on the normalized strength. */
  ci: { lower: number; upper: number };
  weightedWins: number;
  weightedLosses: number;
  weightedTies: number;
};

export type BucketRatingTable =
  | {
      status: "live";
      bucketId: string;
      kind: BattleKind;
      effectiveVotes: number;
      requiredVotes: number;
      bothBadVotes: number;
      entries: RatingEntry[];
    }
  | {
      status: "collecting";
      bucketId: string;
      kind: BattleKind;
      effectiveVotes: number;
      requiredVotes: number;
      bothBadVotes: number;
      /** Present for auditability but MUST NOT be displayed as an ordering (I2). */
      provisionalEntries: RatingEntry[];
    }
  | { status: "unavailable"; bucketId: string; kind: BattleKind; reason: string };

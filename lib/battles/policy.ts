import type { RatingPolicy } from "./types";

/**
 * Editable product policy for battle ratings. These are policy choices, not
 * evidence-derived constants; changing them is legitimate but must go through
 * this file (and a DECISIONS.md entry), never inline in the math.
 */
export const defaultRatingPolicy: RatingPolicy = {
  // Prompter votes carry full weight: the voter knows the intent and standard
  // behind the prompt. Third-party votes on curated pairs are still evidence,
  // but discounted because the voter is judging against an inferred standard.
  voteWeights: { prompter: 1, "third-party": 0.5 },
  // D8 display threshold: below this effective (weighted) vote count the
  // bucket table stays in `collecting` and no ordering may be displayed.
  minEffectiveVotesForLive: 50,
  bootstrap: { resamples: 200, seed: 0x5eed_ca1 },
  solver: { maxIterations: 500, tolerance: 1e-10 },
};

import type { RecommendationRole } from "./types";

/**
 * Human-editable recommendation policy. These are product choices, not model
 * measurements. Change them here; the fit arithmetic and evidence data remain
 * independent.
 */
export const recommendationPolicy = {
  resultLimit: 5,
  safetyMarginBps: 1_000,
  reducedContextTokens: 8 * 1_024,
  tokensPerContextK: 1_024,
  scoreTieEpsilon: Number.EPSILON,
  roles: [
    "primary-match",
    "quality-option",
    "fast-option",
    "long-context-option",
    "memory-efficient-option",
  ] satisfies RecommendationRole[],
} as const;

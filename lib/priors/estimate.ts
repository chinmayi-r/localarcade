import type { NumericRange, ThroughputEstimate, ThroughputPrior, ThroughputQuery } from "./types";

/** Returns ranges only. No branch in this module produces a point estimate. */
export function estimateThroughput(query: ThroughputQuery, priors: ThroughputPrior[]): ThroughputEstimate {
  const compatible = priors.filter((prior) =>
    prior.artifact.sizeBand === query.sizeBand
    && prior.accelerator.kind === query.acceleratorKind
    && prior.runtime.product === query.product
    && prior.runtime.engine === query.engine
  );
  if (!compatible.length) return { kind: "unavailable", confidence: "none", reason: "No sourced prior covers this hardware kind, artifact-size band, product, and engine." };

  const exact = query.acceleratorId ? compatible.filter((prior) => prior.accelerator.id === query.acceleratorId) : [];
  if (exact.length) return aggregate(exact, "medium", "exact");

  const family = query.acceleratorFamily ? compatible.filter((prior) => prior.accelerator.family === query.acceleratorFamily) : [];
  if (family.length) return aggregate(family, "low", "family");

  return aggregate(compatible, "low", "coarse-bucket");
}

function aggregate(priors: ThroughputPrior[], confidence: "medium" | "low", hardwareMatch: "exact" | "family" | "coarse-bucket") {
  return {
    kind: "range" as const,
    confidence,
    hardwareMatch,
    ranges: {
      promptTokensPerSecond: envelope(priors.map((prior) => prior.ranges.promptTokensPerSecond)),
      generationTokensPerSecond: envelope(priors.map((prior) => prior.ranges.generationTokensPerSecond)),
      timeToFirstTokenMs: envelope(priors.map((prior) => prior.ranges.timeToFirstTokenMs)),
    },
    sampleCount: priors.reduce((total, prior) => total + prior.sampleCount, 0),
    sourceUrls: [...new Set(priors.map((prior) => prior.sourceUrl))].sort(),
  };
}

function envelope(ranges: NumericRange[]): NumericRange {
  return { min: Math.min(...ranges.map((range) => range.min)), max: Math.max(...ranges.map((range) => range.max)) };
}

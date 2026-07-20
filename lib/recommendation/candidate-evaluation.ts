import { fit } from "../fit";
import { estimateThroughput } from "../priors";
import type { FitHardware } from "../fit";
import type { ThroughputPrior } from "../priors";
import { recommendationPolicy } from "./policy";
import type { AcceleratorKind, RecommendationCandidate, RecommendationItem, RecommendationQuery } from "./types";

const GIB = 1_024 ** 3;

/** Tree A4-A5: evaluate only explicit hardware/runtime profiles and fail closed. */
export function evaluateCandidates(query: RecommendationQuery, candidates: RecommendationCandidate[], contextTokens: number, priors: ThroughputPrior[]): RecommendationItem[] {
  const acceleratorKind = hardwareKind(query);
  const hardware = fitHardware(query);
  return candidates.flatMap((candidate) => {
    if (!candidate.hardwareKinds.includes(acceleratorKind)) return [];
    const result = safeFit(candidate, hardware, contextTokens);
    if (!result?.fits) return [];
    return [{
      candidate,
      fit: result,
      throughput: estimateThroughput({
        acceleratorId: query.hardware.acceleratorId,
        acceleratorFamily: query.hardware.acceleratorFamily,
        acceleratorKind,
        sizeBand: candidate.sizeBand,
        product: candidate.runtime.product,
        engine: candidate.runtime.engine,
      }, priors),
      contextTokens,
      maxFeasibleContextTokens: findMaxFeasibleContext(candidate, hardware),
      alternatives: [],
    }];
  });
}

function findMaxFeasibleContext(candidate: RecommendationCandidate, hardware: FitHardware) {
  let low = 1;
  let high = candidate.artifact.maxContextTokens;
  while (low < high) {
    const midpoint = Math.ceil((low + high) / 2);
    if (safeFit(candidate, hardware, midpoint)?.fits) low = midpoint;
    else high = midpoint - 1;
  }
  return low;
}

function safeFit(candidate: RecommendationCandidate, hardware: FitHardware, contextTokens: number) {
  try {
    return fit(candidate.fitArtifact, hardware, contextTokens, candidate.runtime.kvCache);
  } catch {
    return undefined;
  }
}

function fitHardware(query: RecommendationQuery): FitHardware {
  return {
    physicalMemoryBytes: Math.round(query.hardware.availableMemoryGb * GIB),
    osReserveBytes: 0,
    displayReserveBytes: 0,
    safetyMarginBps: recommendationPolicy.safetyMarginBps,
  };
}

function hardwareKind(query: RecommendationQuery): AcceleratorKind {
  if (query.hardware.platform === "cpu") return "cpu";
  if (query.hardware.platform === "apple") return "integrated";
  return "gpu";
}

/** True when at least one catalog candidate targets this platform's
 * accelerator kind — i.e. an empty result means "doesn't fit" rather than
 * "we have no evidence for this platform yet". */
export function platformHasCoverage(query: RecommendationQuery, candidates: RecommendationCandidate[]): boolean {
  const kind = hardwareKind(query);
  return candidates.some((candidate) => candidate.hardwareKinds.includes(kind));
}

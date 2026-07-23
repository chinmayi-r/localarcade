import { fit, fitMemoryPools } from "../fit";
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
    if (!candidate.platforms.includes(query.hardware.platform)) return [];
    if (candidate.acceleratorIds && (!query.hardware.acceleratorId || !candidate.acceleratorIds.includes(query.hardware.acceleratorId))) return [];
    const result = safeFit(candidate, query, hardware, contextTokens);
    if (!result?.fit.fits) return [];
    return [{
      candidate,
      fit: result.fit,
      memoryPools: result.memoryPools,
      throughput: estimateThroughput({
        acceleratorId: query.hardware.acceleratorId,
        acceleratorFamily: query.hardware.acceleratorFamily,
        acceleratorKind,
        sizeBand: candidate.sizeBand,
        product: candidate.runtime.product,
        engine: candidate.runtime.engine,
      }, priors),
      contextTokens,
      maxFeasibleContextTokens: findMaxFeasibleContext(candidate, query, hardware),
      alternatives: [],
    }];
  });
}

function findMaxFeasibleContext(candidate: RecommendationCandidate, query: RecommendationQuery, hardware: FitHardware) {
  let low = 1;
  let high = candidate.artifact.maxContextTokens;
  while (low < high) {
    const midpoint = Math.ceil((low + high) / 2);
    if (safeFit(candidate, query, hardware, midpoint)?.fit.fits) low = midpoint;
    else high = midpoint - 1;
  }
  return low;
}

function safeFit(candidate: RecommendationCandidate, query: RecommendationQuery, hardware: FitHardware, contextTokens: number) {
  try {
    const singlePool = fit(candidate.fitArtifact, hardware, contextTokens, candidate.runtime.kvCache);
    if (!candidate.memoryPools) return { fit: singlePool };
    if (!query.hardware.systemMemoryGb) return undefined;
    const memoryPools = fitMemoryPools(candidate.memoryPools, {
      devicePhysicalBytes: hardware.physicalMemoryBytes,
      hostPhysicalBytes: Math.round(query.hardware.systemMemoryGb * GIB),
      deviceReserveBytes: hardware.osReserveBytes + hardware.displayReserveBytes,
      hostReserveBytes: 0,
      safetyMarginBps: hardware.safetyMarginBps,
    }, contextTokens);
    return { fit: { ...singlePool, fits: singlePool.fits && memoryPools.fits, reasons: [...singlePool.reasons, ...memoryPools.reasons] }, memoryPools };
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
  return candidates.some((candidate) =>
    candidate.hardwareKinds.includes(kind)
    && candidate.platforms.includes(query.hardware.platform)
    && (!candidate.acceleratorIds || (!!query.hardware.acceleratorId && candidate.acceleratorIds.includes(query.hardware.acceleratorId))),
  );
}

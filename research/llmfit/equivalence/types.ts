import type { FitArtifact, FitHardware, KvCacheSelection } from "../../../lib/fit";

export const outcomeKinds = ["agreement", "disagreement", "unrepresentable"] as const;
export type OutcomeKind = (typeof outcomeKinds)[number];

export const upstreamTopologyKinds = [
  "single-pool",
  "unified-memory",
  "device-host-offload",
  "heterogeneous-multi-gpu",
] as const;
export type UpstreamTopologyKind = (typeof upstreamTopologyKinds)[number];

export type UpstreamFitObservation = {
  source: {
    name: "llmfit";
    version: string;
    commit: string;
    fixtureKind: "normalized-upstream-style";
  };
  topology: UpstreamTopologyKind;
  availableBytes: number;
  requiredBytes: number | null;
  fits: boolean | null;
  factsNotExposed: string[];
};

export type LocalFitInvocation = {
  artifact: FitArtifact;
  hardware: FitHardware;
  contextTokens: number;
  kvCacheSelection: KvCacheSelection;
};

export type EquivalenceTolerance = {
  requiredBytesAbsolute: number;
  requiredBytesRelativeBps: number;
};

export type EquivalenceScenario = {
  id: string;
  description: string;
  upstream: UpstreamFitObservation;
  local: LocalFitInvocation | null;
  mappingBlockers: string[];
  tolerance: EquivalenceTolerance;
  expectedOutcome: OutcomeKind;
};

export type FieldDifference = {
  field: "fits" | "requiredBytes";
  upstream: boolean | number;
  local: boolean | number;
  tolerance?: number;
};

export type EquivalenceResult = {
  scenarioId: string;
  outcome: OutcomeKind;
  upstream: UpstreamFitObservation;
  local: {
    fits: boolean;
    requiredBytes: number;
    availableBytes: number;
    breakdown: {
      weightsBytes: number;
      kvCacheBytes: number;
      runtimeComputeBufferBytes: number;
      osReserveBytes: number;
      displayReserveBytes: number;
      safetyMarginBytes: number;
    };
  } | null;
  differences: FieldDifference[];
  reasons: string[];
};

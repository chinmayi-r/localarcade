import type { FitArtifact, FitResult, KvCacheSelection } from "../fit";
import type { ArtifactSizeBand, ThroughputEstimate } from "../priors";
import type { ArtifactRegistryRecord } from "../registry";
import type { AccelerationBackend, EngineId, ProductId } from "../runtime";

export type PlatformId = "nvidia" | "apple" | "amd" | "cpu";
export type TaskId = "coding" | "general" | "writing" | "extraction";
export type StrategyId = "balanced" | "quality" | "speed" | "long-context" | "lightest";
export type AcceleratorKind = "cpu" | "gpu" | "integrated";

export type HardwareProfile = {
  platform: PlatformId;
  availableMemoryGb: number;
  acceleratorId?: string;
  acceleratorFamily?: string;
};

export type RecommendationQuery = {
  hardware: HardwareProfile;
  task: TaskId;
  desiredContextK: number;
  strategy: StrategyId;
};

export type ComparativeValue = {
  value: number;
  sourceUrl: string;
};

/** A candidate exists only when artifact, fit profile and runtime identity are explicit. */
export type RecommendationCandidate = {
  id: string;
  artifact: ArtifactRegistryRecord;
  fitArtifact: FitArtifact;
  fitProfileSourceUrl: string;
  hardwareKinds: AcceleratorKind[];
  sizeBand: ArtifactSizeBand;
  runtime: {
    product: ProductId;
    engine: EngineId;
    build: string;
    backend: AccelerationBackend;
    kvCache: KvCacheSelection;
    gpuLayers: number | "all";
    batchSize: number;
  };
  comparativeQuality?: Partial<Record<TaskId, ComparativeValue>>;
};

export type RecommendationRole = "primary-match" | "quality-option" | "fast-option" | "long-context-option" | "memory-efficient-option";

export type RecommendationItem = {
  candidate: RecommendationCandidate;
  fit: FitResult;
  throughput: ThroughputEstimate;
  role?: RecommendationRole;
  contextTokens: number;
  maxFeasibleContextTokens: number;
  alternatives: RecommendationCandidate[];
};

export type RecommendationOutcome =
  | { kind: "ranked"; items: RecommendationItem[]; message: string }
  | { kind: "unranked"; items: RecommendationItem[]; message: string }
  | { kind: "contradictory"; items: RecommendationItem[]; message: string }
  | { kind: "nothing-fits"; items: []; message: string }
  /** The catalog has no measured profiles for this platform at all — a
   * coverage gap in our evidence, never a statement about the machine. */
  | { kind: "no-coverage"; items: []; message: string };

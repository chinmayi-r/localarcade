import type { ArtifactRegistryRecord } from "../registry";

export type PlatformId = "nvidia" | "apple" | "amd" | "cpu";
export type TaskId = "coding" | "general" | "writing" | "extraction";
export type StrategyId = "balanced" | "quality" | "speed" | "long-context" | "lightest";

export type HardwareProfile = {
  platform: PlatformId;
  availableMemoryGb: number;
};

export type RecommendationQuery = {
  hardware: HardwareProfile;
  task: TaskId;
  desiredContextK: number;
  strategy: StrategyId;
};

export type TaskScores = Record<TaskId, number>;

/**
 * Prototype artifact record. Production records must add an immutable source
 * revision, hash, license evidence and source URLs before becoming eligible.
 */
export type Artifact = {
  id: string;
  family: string;
  model: string;
  quantization: string;
  format: "GGUF" | "MLX";
  runtime: "llama.cpp" | "MLX";
  weightSizeGb: number;
  kvCacheGbPer8K: number;
  maxContextK: number;
  baselineTokensPerSecond: number;
  stabilityScore: number;
  taskScores: TaskScores;
  evidenceLevel: "prototype";
  identity?: ArtifactRegistryRecord;
};

export type Eligibility = {
  eligible: boolean;
  requiredMemoryGb: number;
  usableMemoryGb: number;
  reasons: string[];
};

export type Recommendation = {
  artifact: Artifact;
  rank: number;
  score: number;
  estimatedTokensPerSecond: [number, number];
  requiredMemoryGb: number;
  configuration: RecommendedConfiguration;
  explanation: string[];
};

export type RecommendedConfiguration = {
  contextK: number;
  runtime: string;
  runtimeBuild?: string;
  backend?: string;
  kvCacheQuantization?: string;
  gpuLayers?: number | "all";
  batchSize?: number;
  artifactRepository?: string;
  artifactRevision?: string;
  artifactFileName?: string;
  artifactSha256?: string;
  artifactSourceUrl?: string;
  licenseId?: string;
  licenseSourceUrl?: string;
};

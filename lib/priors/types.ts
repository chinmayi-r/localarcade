export type EvidenceTier = "tier-1" | "tier-2";
export type PriorConfidence = "medium" | "low";
export type ArtifactSizeBand = "tiny-1b" | "small-8b" | "medium-14b";

export type NumericRange = {
  min: number;
  max: number;
};

export type ThroughputPrior = {
  id: string;
  accelerator: {
    id: string;
    family: string;
    kind: "cpu" | "gpu" | "integrated";
    memoryGb: number;
  };
  artifact: {
    family: string;
    sizeBand: ArtifactSizeBand;
    parameterCountBillion: number;
    quantization: string;
  };
  runtime: {
    product: string;
    engine: string;
    version: string;
    commit: string;
    backend: string;
  };
  conditions: {
    operatingSystem: string;
    architecture: string;
    protocol: string;
  };
  ranges: {
    promptTokensPerSecond: NumericRange;
    generationTokensPerSecond: NumericRange;
    timeToFirstTokenMs: NumericRange;
  };
  sampleCount: number;
  evidenceTier: EvidenceTier;
  sourceUrl: string;
  observedAt: string;
  retrievedAt: string;
};

export type ThroughputPriorSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  priors: ThroughputPrior[];
};

export type ThroughputQuery = {
  acceleratorId?: string;
  acceleratorFamily?: string;
  sizeBand: ArtifactSizeBand;
  engine: string;
};

export type ThroughputRangeEstimate = {
  kind: "range";
  confidence: PriorConfidence;
  hardwareMatch: "exact" | "family" | "coarse-bucket";
  ranges: ThroughputPrior["ranges"];
  sampleCount: number;
  sourceUrls: string[];
};

export type ThroughputEstimate = ThroughputRangeEstimate | {
  kind: "unavailable";
  confidence: "none";
  reason: string;
};

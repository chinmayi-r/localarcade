export type MappingClassification =
  | "exact"
  | "lossy"
  | "unsupported"
  | "unavailable";

export type AdvisoryBackend =
  | "cuda"
  | "rocm"
  | "metal"
  | "vulkan"
  | "cpu";

export type IndependentAdvisoryInput = {
  requestId: string;
  hardware: {
    totalRamBytes: number;
    availableRamBytes: number | null;
    cpu: {
      displayName: string | null;
      logicalCores: number | null;
    };
    accelerators: Array<{
      displayName: string;
      backend: AdvisoryBackend;
      deviceMemoryBytes: number | null;
      count: number;
    }>;
    unifiedMemory: boolean | null;
  };
  task: {
    family: "coding" | "writing" | "extraction" | "general" | "other";
    interactionStyle: "interactive" | "batch";
    contextTokens: number;
  };
  constraints: {
    forcedRuntime: string | null;
  };
};

export type RawLlmfitFixture = {
  fixtureSchema: "local-arcade.llmfit-raw-fixture.v1";
  fixtureId: string;
  fixtureKind: "synthetic-contract";
  source: {
    id: "llmfit";
    version: string;
    revision: string;
  };
  capturedAt: string;
  requestEcho: {
    totalRamGb: number;
    availableRamGb: number | null;
    cpuName: string | null;
    cpuCores: number | null;
    backend:
      | "CUDA"
      | "ROCm"
      | "Metal"
      | "Vulkan"
      | "CPU ARM"
      | "CPU x86"
      | "SYCL"
      | "Ascend";
    gpuName: string | null;
    gpuVramGb: number | null;
    gpuCount: number;
    unifiedMemory: boolean;
    contextLimit: number;
    forcedRuntime: string | null;
    taskFamily: IndependentAdvisoryInput["task"]["family"];
    interactionStyle: IndependentAdvisoryInput["task"]["interactionStyle"];
  };
  result:
    | {
        kind: "ok";
        models: RawLlmfitModelFit[];
      }
    | {
        kind: "error";
        errorKind: "timeout" | "upstream-unavailable" | "invalid-override";
        message: string;
      };
};

export type RawLlmfitModelFit = {
  model: {
    name: string;
    provider: string;
    parameters: number;
    capabilities: string[];
  };
  fitLevel: "Perfect" | "Good" | "Marginal" | "TooTight";
  runMode:
    | "Gpu"
    | "MoeOffload"
    | "CpuOffload"
    | "CpuOnly"
    | "TensorParallel";
  memoryRequiredGb: number;
  memoryAvailableGb: number;
  utilizationPct: number;
  notes: string[];
  estimatedTps: number | null;
  measuredTps: number | null;
  effectiveContextLength: number;
  usableContext: number;
  bestQuant: string | null;
  runtime: string | null;
  estimateBasis: Record<string, unknown> | null;
  score: number;
  scoreComponents: {
    quality: number;
    speed: number;
    fit: number;
    context: number;
  };
};

export type RawAttribution = {
  source: {
    id: "llmfit";
    version: string;
    revision: string;
  };
  fixtureId: string;
  fixtureKind: RawLlmfitFixture["fixtureKind"];
  capturedAt: string;
  rawRecord: unknown;
};

export type IgnoredUpstreamField = {
  path: string;
  reasonCode: string;
  message: string;
};

export type MappingIssue = {
  path: string;
  classification: "lossy" | "unsupported";
  reasonCode: string;
  message: string;
};

export type NormalizedAdvisoryCandidate = {
  modelFamilyCandidate: {
    upstreamName: string;
    displayName: string;
    provider: string;
    parameters: number;
    upstreamReportedCapabilities: string[];
  };
  advisory: {
    fit: "good" | "tight" | "does-not-fit";
    runPath: "gpu" | "cpu-offload" | "cpu";
    memoryRequiredBytes: number;
    memoryAvailableBytes: number;
    utilization: number;
    context: {
      requestedTokens: number;
      effectiveTokens: number;
      usableTokens: number;
    };
    performance: {
      estimatedGenerationTokensPerSecond: number | null;
      upstreamReportedGenerationTokensPerSecond: number | null;
      estimateBasis: Record<string, unknown> | null;
    };
    upstreamRuntime: string | null;
    suggestedQuantization: string | null;
    notes: string[];
  };
  mappingIssues: MappingIssue[];
  ignoredUpstreamFields: IgnoredUpstreamField[];
  rawAttribution: RawAttribution;
};

export type NormalizationSuccess = {
  schemaVersion: 1;
  capability: "llmfit-advisory-normalization";
  requestId: string;
  classificationScope: "adopted-advisory-projection";
  classification: "exact" | "lossy";
  candidates: NormalizedAdvisoryCandidate[];
  warnings: string[];
  rawAttribution: RawAttribution;
};

export type NormalizationFailure = {
  schemaVersion: 1;
  capability: "llmfit-advisory-normalization";
  requestId: string;
  classificationScope: "adopted-advisory-projection";
  classification: "unsupported" | "unavailable";
  reasonCode: string;
  message: string;
  recoverableActions: string[];
  rawAttribution: RawAttribution | null;
};

export type NormalizationResult =
  | NormalizationSuccess
  | NormalizationFailure;

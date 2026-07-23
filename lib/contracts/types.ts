export const schemaVersion = 1 as const;

export const contractIds = [
  "hardware-target", "recommendation-request", "exact-configuration-candidate",
  "fit-evidence-assessment", "recommendation-portfolio", "runner-handoff",
  "benchmark-plan", "benchmark-result", "quick-check-plan", "quick-check-result",
  "verification-plan", "verification-result", "compatibility-admission-receipt",
] as const;
export type ContractId = (typeof contractIds)[number];
export type Origin = "detected" | "self-reported" | "imported" | "confirmed" | "unknown";
export type OsFamily = "windows" | "macos" | "linux" | "other";
export type AcceleratorVendor = "nvidia" | "amd" | "apple" | "intel" | "cpu" | "other";
export type AcceleratorBackend = "cuda" | "rocm" | "metal" | "vulkan" | "cpu" | "other";
export type TaskFamily = "coding" | "writing" | "extraction" | "general" | "other";
export type Priority = "balanced" | "quality" | "speed" | "long-context" | "lightest";
export type Need = "tool-use" | "structured-output" | "vision" | "embeddings" | "offline";
export type PortfolioRole = "primary-match" | "quality-option" | "fast-option" | "long-context-option" | "memory-efficient-option";
export type DomainStatus = "completed" | "failed" | "timed-out" | "cancelled" | "oom" | "stopped";

export type Provenance = {
  source: { id: string; version: string | null; revision: string | null; url: string | null };
  retrievedAt: string | null;
  observedAt: string | null;
  method: "estimate" | "measurement" | "preference" | "objective-check" | "self-reported" | "detected" | "imported";
  hardwareMatch: "exact" | "calibrated-neighbor" | "coarse-bucket" | "not-applicable" | "unknown";
  configurationMatch: "exact" | "compatible" | "family-proxy" | "not-applicable" | "unknown";
  scope: { taskFamily: string | null; taskPackId: string | null; promptId: string | null; harnessId: string | null };
  sampleCount: number | null;
  measurement: null | {
    unit: "bytes" | "tokens-per-second" | "milliseconds" | "probability" | "joules" | "boolean" | "count" | "other";
    interval: { lower: number; upper: number } | null;
    confidence: number | null;
    eligible: boolean | null;
    eligibilityReasons: string[];
  };
  rawSourceRecordRef: string | null;
};

export type HardwareTarget = {
  hardwareTargetId: string;
  os: { family: OsFamily; version: string | null };
  cpu: { displayName: string | null; logicalCores: number | null };
  memory: { totalRamBytes: number; availableRamBytes: number | null; unified: boolean | null };
  accelerators: Array<{
    acceleratorId: string | null; displayName: string; kind: AcceleratorVendor;
    vendor: AcceleratorVendor; backend: AcceleratorBackend;
    deviceMemoryBytes: number | null; count: number;
  }>;
  fieldOrigins: Record<string, Origin>;
};

export type RecommendationRequest = {
  requestId: string;
  hardwareTargetId: string;
  task: { family: TaskFamily; interactionStyle: "interactive" | "batch"; scopeLabel: string; derivedContextTokens: number; needs: Need[] };
  preferences: { priority: Priority; allowCpuOffload: boolean; installedOnly: boolean };
  advanced: { forcedRuntime: string | null; maximumArtifactBytes: number | null };
};

export type RuntimeConfiguration = {
  runtimeConfigurationId: string; product: string; engine: string; engineBuild: string | null;
  backend: AcceleratorBackend; chatTemplate: string | null; contextTokens: number;
  kvCache: { key: string | null; value: string | null };
  gpuLayers: number | "all" | null; batchSize: number | null; microBatchSize: number | null;
  parallelism: number | null; threads: number | null; flashAttention: boolean | null; mmap: boolean | null;
  sampler: { temperature: number | null; topP: number | null; topK: number | null; minP: number | null; seed: number | null };
  additionalFlags: Array<{ name: string; value: string | null }>;
};

export type ExactConfigurationCandidate = {
  candidateId: string;
  modelFamily: { modelFamilyId: string; displayName: string };
  artifact: {
    artifactId: string; repository: string; revision: string; filename: string; sha256: string;
    bytes: number; format: string; quantization: string; license: string; status: "promoted";
  };
  runtime: RuntimeConfiguration;
  provenance: Provenance[];
};

export type CompatibilityAssertionStatus = "verified" | "documented" | "experimental" | "inferred";
export type CompatibilityAdmissionReceipt = {
  compatibilityAdmissionId: string;
  receiptVersion: 1;
  policy: { id: "m-e.compatibility"; version: "1" };
  candidateId: string;
  artifactId: string;
  artifactSha256: string;
  runtimeConfigurationId: string;
  decision: "admitted";
  target: {
    product: string;
    engine: string;
    engineBuild: string;
    runtimeVersion: string | null;
    exactBuild: string | null;
    operatingSystem: OsFamily;
    cpuArchitecture: "x86_64" | "aarch64";
    backend: AcceleratorBackend;
    featureFlags: string[];
    packageLayout: "gguf-single" | "gguf-split" | "hf-transformers" | "mlx-lm" | "mlx-swift-lm" | "ollama-package";
    declaredPackageFiles: string[];
    modelArchitecture: string | null;
    quantizationScheme: string;
  };
  assertion: {
    artifactId: string;
    productId: string;
    engineId: string;
    status: CompatibilityAssertionStatus;
    runtimeConstraint: { minVersion: string | null; maxVersion: string | null; exactBuild: string | null };
    conditions: {
      operatingSystems: string[] | null;
      cpuArchitectures: string[] | null;
      backends: string[] | null;
      modelArchitectures: string[] | null;
      packageLayouts: string[] | null;
      quantizationSchemes: string[] | null;
      requiredFiles: string[] | null;
      limitations: string[] | null;
    };
    evidence: Array<{ url: string; checkedAt: string; sourceRevision: string | null }>;
  };
};

export type MemoryPool = {
  modelBytes: number; contextBytes: number; computeBytes: number; reserveBytes: number;
  marginBytes: number; requiredBytes: number; availableBytes: number;
};
export type NumericRange = { low: number; high: number } | null;
export type FitEvidenceAssessment = {
  assessmentId: string; candidateId: string; hardwareTargetId: string;
  fit: "good" | "tight" | "does-not-fit" | "unknown";
  runPath: "gpu" | "cpu-offload" | "cpu" | "unknown";
  memoryPools: { device: MemoryPool; host: MemoryPool };
  performance: { promptTokensPerSecond: NumericRange; generationTokensPerSecond: NumericRange; timeToFirstTokenMs: NumericRange };
  evidence: { fit: Provenance[]; promptSpeed: Provenance[]; generationSpeed: Provenance[]; timeToFirstToken: Provenance[]; taskQuality: Provenance[] };
  blockingReasons: string[];
};

export type RecommendationPortfolio = {
  requestId: string;
  outcome: "ranked" | "unranked-compatible" | "contradictory-preferences" | "nothing-fits" | "coverage-gap";
  message: string;
  items: Array<{ role: PortfolioRole | null; modelFamilyId: string; candidateId: string; assessmentId: string; why: string[]; caveats: string[] }>;
  methodologyVersion: string;
};

export type RunnerHandoff = {
  handoffId: string; schemaVersion: 1; createdAt: string; expiresAt: string; contentHash: string;
  recommendationRequest: RecommendationRequest; hardwareTarget: HardwareTarget;
  selectedCandidate: ExactConfigurationCandidate; evidenceSummary: FitEvidenceAssessment;
  containsModelData: false; sideEffectAuthorization: false;
};

export type Preflight = {
  power: "ac" | "battery" | "unknown"; thermal: "acceptable" | "adverse" | "unknown";
  concurrentGpu: "idle" | "active" | "unknown"; requiresConfirmation: boolean; conditions: string[];
};
export type SideEffects = { executesLocalProcess: true; loadsModel: true; writesModelStore: false; network: false; upload: false };
export type BenchmarkPlan = {
  benchmarkPlanId: string; candidateId: string; artifactPath: string; expectedArtifactSha256: string;
  runtime: RuntimeConfiguration; protocolId: string; warmupRuns: number; measuredRuns: number;
  measurementKinds: Array<"prompt-processing" | "generation" | "time-to-first-token" | "memory" | "stability">;
  preflight: Preflight; sideEffects: SideEffects;
};
export type QuickCheckPlan = {
  quickCheckPlanId: string; candidateId: string; artifactPath: string; expectedArtifactSha256: string;
  runtime: RuntimeConfiguration; checks: Array<{ checkId: string; criterion: string }>;
  preflight: Preflight; sideEffects: SideEffects;
};
export type VerificationPlan = {
  verificationPlanId: string; hardwareTargetId: string; candidateId: string;
  benchmarkPlan: BenchmarkPlan | null; quickCheckPlan: QuickCheckPlan | null;
};

export type MeasurementSeries = {
  kind: "prompt-processing" | "generation" | "time-to-first-token" | "memory" | "stability";
  unit: "tokens-per-second" | "milliseconds" | "bytes" | "boolean" | "count" | "other";
  warmupSamples: number[]; measuredSamples: number[];
  aggregate: { minimum: number; maximum: number; median: number } | null;
  completion: DomainStatus; stability: "stable" | "unstable" | "insufficient-samples" | "not-applicable";
  evidence: Provenance;
};
export type BenchmarkResult = {
  benchmarkResultId: string; benchmarkPlanId: string; candidateId: string; domainStatus: DomainStatus;
  series: MeasurementSeries[]; calibrationEligible: boolean; calibrationExclusions: string[]; diagnostics: string[];
};
export type QuickCheckResult = {
  quickCheckResultId: string; quickCheckPlanId: string; candidateId: string; domainStatus: DomainStatus;
  checks: Array<{ checkId: string; criterion: string; status: "pass" | "fail" | "not-run"; explanation: string; localDiagnostics: string | null; evidence: Provenance }>;
};
export type VerificationResult = {
  verificationResultId: string; verificationPlanId: string; candidateId: string; domainStatus: DomainStatus;
  benchmarkResult: BenchmarkResult | null; quickCheckResult: QuickCheckResult | null;
};

export type ContractDataMap = {
  "hardware-target": HardwareTarget; "recommendation-request": RecommendationRequest;
  "exact-configuration-candidate": ExactConfigurationCandidate; "fit-evidence-assessment": FitEvidenceAssessment;
  "recommendation-portfolio": RecommendationPortfolio; "runner-handoff": RunnerHandoff;
  "benchmark-plan": BenchmarkPlan; "benchmark-result": BenchmarkResult;
  "quick-check-plan": QuickCheckPlan; "quick-check-result": QuickCheckResult;
  "verification-plan": VerificationPlan; "verification-result": VerificationResult;
  "compatibility-admission-receipt": CompatibilityAdmissionReceipt;
};
export type Completeness = { complete: boolean; missing: string[]; warnings: string[]; recoverableActions: string[] };
export type TypedEnvelope<K extends ContractId = ContractId> = K extends ContractId ? {
  schemaVersion: 1; contract: K; status: "ok" | "partial"; data: ContractDataMap[K]; provenance: Provenance[]; completeness: Completeness;
} : never;
export type NonDataEnvelope = {
  schemaVersion: 1; contract: ContractId; status: "unavailable" | "blocked" | "error";
  reasonCode: string; message: string; recoverableActions: string[]; provenance: Provenance[]; warnings: string[];
};
export type ContractEnvelope = TypedEnvelope | NonDataEnvelope;

export type MappingResult<T> = { kind: "ok"; value: T } | { kind: "blocked"; reasonCode: string; message: string; missing: string[] };

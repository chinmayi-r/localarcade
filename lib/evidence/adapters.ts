import type { FitEvidenceAssessment, Provenance } from "../contracts";
import type { FitResult } from "../fit";
import type { ThroughputPrior } from "../priors";
import { validateThroughputPrior } from "../priors";
import { claimForEvidence, validateEvidenceRecord } from "./validation";
import type { EvidenceClaim, EvidenceRecord, ExactConfigurationIdentity, MetricKind } from "./types";

export type EvidenceAdapterResult<T> =
  | { kind: "exact"; value: T }
  | { kind: "lossy"; value: T; reasons: string[] }
  | { kind: "unsupported"; reasons: string[] };

export type EvidenceRecordContext = {
  candidateId: string;
  hardwareTargetId: string | null;
  configuration?: ExactConfigurationIdentity;
  hardwareFingerprint?: string;
  hardwareGroupId?: string;
};

export type NormalizedEvidenceComponent = {
  candidateId: string;
  hardwareTargetId: string | null;
  metric: MetricKind;
  claim: EvidenceClaim;
  provenance: Provenance[];
};

export type ThroughputPriorContext = {
  candidateId: string;
  hardwareTargetId: string;
  hardwareMatch: "exact" | "calibrated-neighbor" | "coarse-bucket";
  configurationMatch: "compatible" | "family-proxy";
  target: {
    acceleratorId?: string;
    acceleratorFamily?: string;
    artifactFamily: string;
    sizeBand: ThroughputPrior["artifact"]["sizeBand"];
    quantization: string;
    runtime: { product: string; engine: string; build: string; backend: string };
  };
};

export type ThroughputEvidenceComponents = {
  candidateId: string;
  hardwareTargetId: string;
  claim: "estimated";
  performance: FitEvidenceAssessment["performance"];
  evidence: Pick<FitEvidenceAssessment["evidence"], "promptSpeed" | "generationSpeed" | "timeToFirstToken">;
};

export type LocalFitContext = {
  candidateId: string;
  hardwareTargetId: string;
  runPath: "cpu" | "gpu" | "cpu-offload";
  sourceUrl: string;
  rawSourceRecordRef: string;
};

export type LocalFitEvidenceComponents = {
  candidateId: string;
  hardwareTargetId: string;
  legacyFits: boolean;
  memoryPools: FitEvidenceAssessment["memoryPools"];
  blockingReasons: string[];
  evidence: Pick<FitEvidenceAssessment["evidence"], "fit">;
};

export function adaptEvidenceRecord(record: EvidenceRecord, context: EvidenceRecordContext): EvidenceAdapterResult<NormalizedEvidenceComponent> {
  const issues = validateEvidenceRecord(record);
  if (issues.length > 0) return { kind: "unsupported", reasons: issues };

  const identityIssues = identityMismatches(record, context);
  if (identityIssues.length > 0) return { kind: "unsupported", reasons: identityIssues };

  const value: NormalizedEvidenceComponent = {
    candidateId: context.candidateId,
    hardwareTargetId: context.hardwareTargetId,
    metric: record.metric,
    claim: claimForEvidence(record),
    provenance: record.provenanceLinks.map((url) => ({
      source: { id: `legacy-evidence.${record.source}`, version: null, revision: null, url },
      retrievedAt: null,
      observedAt: record.observedAt,
      method: record.method,
      hardwareMatch: record.hardwareMatch,
      configurationMatch: record.configurationMatch,
      scope: { taskFamily: null, taskPackId: record.taskPackId ?? null, promptId: null, harnessId: null },
      sampleCount: record.sampleCount,
      measurement: {
        unit: record.interval.unit,
        interval: { lower: record.interval.lower, upper: record.interval.upper },
        confidence: record.interval.confidenceLevel ?? null,
        eligible: true,
        eligibilityReasons: [],
      },
      rawSourceRecordRef: `legacy-evidence:${record.id}`,
    })),
  };

  const losses: string[] = [];
  if (record.taskPackVersion !== undefined) losses.push("taskPackVersion has no approved v1 provenance field and remains available only through rawSourceRecordRef.");
  if (record.hardwareGroupId !== undefined) losses.push("hardwareGroupId has no approved v1 provenance field and remains available only through rawSourceRecordRef.");
  return losses.length > 0 ? { kind: "lossy", value, reasons: losses } : { kind: "exact", value };
}

export function adaptThroughputPrior(prior: ThroughputPrior, context: ThroughputPriorContext): EvidenceAdapterResult<ThroughputEvidenceComponents> {
  const issues = validateThroughputPrior(prior);
  if (issues.length > 0) return { kind: "unsupported", reasons: issues };
  const scopeIssues = throughputScopeMismatches(prior, context);
  if (scopeIssues.length > 0) return { kind: "unsupported", reasons: scopeIssues };

  const provenance = (metric: "prompt-throughput" | "generation-throughput" | "time-to-first-token", interval: { min: number; max: number }): Provenance => ({
    source: { id: "localscore", version: null, revision: null, url: prior.sourceUrl },
    retrievedAt: prior.retrievedAt,
    observedAt: prior.observedAt,
    // The source row is measured, but applying its scoped range to another
    // candidate is an estimate. Never upgrade the target candidate to measured.
    method: "estimate",
    hardwareMatch: context.hardwareMatch,
    configurationMatch: context.configurationMatch,
    scope: { taskFamily: null, taskPackId: null, promptId: null, harnessId: prior.conditions.protocol },
    sampleCount: prior.sampleCount,
    measurement: {
      unit: metric === "time-to-first-token" ? "milliseconds" : "tokens-per-second",
      interval: { lower: interval.min, upper: interval.max },
      confidence: null,
      eligible: true,
      eligibilityReasons: [
        `Source evidence tier: ${prior.evidenceTier}.`,
        `Source runtime: ${prior.runtime.product}/${prior.runtime.engine}@${prior.runtime.version} (${prior.runtime.commit}).`,
      ],
    },
    rawSourceRecordRef: `throughput-prior:${prior.id}:${metric}`,
  });

  const prompt = provenance("prompt-throughput", prior.ranges.promptTokensPerSecond);
  const generation = provenance("generation-throughput", prior.ranges.generationTokensPerSecond);
  const ttft = provenance("time-to-first-token", prior.ranges.timeToFirstTokenMs);
  return {
    kind: "lossy",
    value: {
      candidateId: context.candidateId,
      hardwareTargetId: context.hardwareTargetId,
      claim: "estimated",
      performance: {
        promptTokensPerSecond: { low: prior.ranges.promptTokensPerSecond.min, high: prior.ranges.promptTokensPerSecond.max },
        generationTokensPerSecond: { low: prior.ranges.generationTokensPerSecond.min, high: prior.ranges.generationTokensPerSecond.max },
        timeToFirstTokenMs: { low: prior.ranges.timeToFirstTokenMs.min, high: prior.ranges.timeToFirstTokenMs.max },
      },
      evidence: { promptSpeed: [prompt], generationSpeed: [generation], timeToFirstToken: [ttft] },
    },
    reasons: [
      "The prior has family/size/quantization scope rather than immutable target artifact and settings identity.",
      "Evidence tier, accelerator memory, runtime conditions, and qualitative confidence are retained by rawSourceRecordRef but are not separate v1 fields.",
    ],
  };
}

export function adaptLocalFitResult(result: FitResult, context: LocalFitContext): EvidenceAdapterResult<LocalFitEvidenceComponents> {
  const issues = validateFitResult(result);
  if (issues.length > 0) return { kind: "unsupported", reasons: issues };
  if (context.runPath !== "cpu") {
    return { kind: "unsupported", reasons: ["The legacy fit result has one combined memory pool and cannot be split honestly for GPU or CPU-offload paths."] };
  }

  const reserveBytes = result.breakdown.osReserveBytes + result.breakdown.displayReserveBytes;
  const emptyPool = { modelBytes: 0, contextBytes: 0, computeBytes: 0, reserveBytes: 0, marginBytes: 0, requiredBytes: 0, availableBytes: 0 };
  const fitProvenance: Provenance = {
    source: { id: "legacy-fit-profile", version: null, revision: null, url: context.sourceUrl },
    retrievedAt: null,
    observedAt: null,
    method: "estimate",
    hardwareMatch: "exact",
    configurationMatch: "compatible",
    scope: { taskFamily: null, taskPackId: null, promptId: null, harnessId: null },
    sampleCount: null,
    measurement: null,
    rawSourceRecordRef: context.rawSourceRecordRef,
  };

  return {
    kind: "lossy",
    value: {
      candidateId: context.candidateId,
      hardwareTargetId: context.hardwareTargetId,
      legacyFits: result.fits,
      memoryPools: {
        device: emptyPool,
        host: {
          modelBytes: result.breakdown.weightsBytes,
          contextBytes: result.breakdown.kvCacheBytes,
          computeBytes: result.breakdown.runtimeComputeBufferBytes,
          reserveBytes,
          marginBytes: result.breakdown.safetyMarginBytes,
          requiredBytes: result.requiredBytes,
          availableBytes: result.physicalMemoryBytes,
        },
      },
      blockingReasons: [...result.reasons],
      evidence: { fit: [fitProvenance] },
    },
    reasons: [
      "The approved v1 pool combines OS and display reserves, while the legacy result retains them separately through rawSourceRecordRef.",
      "M-G does not convert the legacy fits boolean into good/tight/does-not-fit; M-F owns that decision.",
    ],
  };
}

function identityMismatches(record: EvidenceRecord, context: EvidenceRecordContext): string[] {
  const issues: string[] = [];
  if (record.configurationMatch === "exact") {
    if (!context.configuration) issues.push("Exact configuration evidence requires target configuration identity at the adapter boundary.");
    else if (record.configuration?.artifactSha256 !== context.configuration.artifactSha256
      || record.configuration.runtimeBuild !== context.configuration.runtimeBuild
      || record.configuration.settingsFingerprint !== context.configuration.settingsFingerprint) {
      issues.push("Evidence configuration identity does not match the target candidate.");
    }
  }
  if (record.hardwareMatch === "exact") {
    if (!context.hardwareFingerprint) issues.push("Exact hardware evidence requires the target hardware fingerprint at the adapter boundary.");
    else if (record.hardwareFingerprint !== context.hardwareFingerprint) issues.push("Evidence hardware fingerprint does not match the target hardware.");
  }
  if (record.hardwareMatch === "calibrated-neighbor" || record.hardwareMatch === "coarse-bucket") {
    if (!context.hardwareGroupId || context.hardwareGroupId !== record.hardwareGroupId) issues.push("Grouped hardware evidence does not match the selected hardware group.");
  }
  return issues;
}

function throughputScopeMismatches(prior: ThroughputPrior, context: ThroughputPriorContext): string[] {
  const issues: string[] = [];
  if (context.hardwareMatch === "exact" && context.target.acceleratorId !== prior.accelerator.id) {
    issues.push("An exact throughput hardware match requires the same accelerator id as the source prior.");
  }
  if (context.hardwareMatch === "calibrated-neighbor" && context.target.acceleratorFamily !== prior.accelerator.family) {
    issues.push("A calibrated-neighbor throughput match requires the same accelerator family as the source prior.");
  }
  if (context.target.artifactFamily !== prior.artifact.family || context.target.sizeBand !== prior.artifact.sizeBand) {
    issues.push("The throughput prior does not cover the target artifact family and size band.");
  }
  if (context.configurationMatch === "compatible") {
    if (context.target.quantization !== prior.artifact.quantization) issues.push("Compatible throughput evidence requires matching quantization.");
    if (context.target.runtime.product !== prior.runtime.product || context.target.runtime.engine !== prior.runtime.engine
      || context.target.runtime.backend !== prior.runtime.backend) issues.push("Compatible throughput evidence requires matching product, engine, and backend.");
    if (context.target.runtime.build !== prior.runtime.commit && context.target.runtime.build !== prior.runtime.version) {
      issues.push("Compatible throughput evidence requires the source runtime version or commit.");
    }
  }
  return issues;
}

function validateFitResult(result: FitResult): string[] {
  const issues: string[] = [];
  const values = [result.requiredBytes, result.physicalMemoryBytes, ...Object.values(result.breakdown)];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) issues.push("Fit result byte values must be finite and non-negative.");
  const expected = result.breakdown.weightsBytes + result.breakdown.kvCacheBytes + result.breakdown.runtimeComputeBufferBytes
    + result.breakdown.osReserveBytes + result.breakdown.displayReserveBytes + result.breakdown.safetyMarginBytes;
  if (result.requiredBytes !== expected) issues.push("Fit result requiredBytes does not equal its preserved components.");
  if (result.fits !== (result.requiredBytes <= result.physicalMemoryBytes)) issues.push("Fit result boolean contradicts required and available memory.");
  return issues;
}

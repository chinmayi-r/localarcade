import type {
  FitEvidenceAssessment,
  MemoryPool,
  NonDataEnvelope,
  Provenance,
} from "../contracts";
import { validateContract } from "../contracts";
import type {
  EvidenceAdapterResult,
  NormalizedEvidenceComponent,
  ThroughputEvidenceComponents,
} from "../evidence";
import { fit, fitMemoryPools } from "../fit";
import type { FitResult, MemoryPoolBreakdown } from "../fit";
import type {
  FitEvidenceAssessmentEnvelope,
  FitEvidenceAssessmentInput,
} from "./types";
export {
  admitCapacityPolicy,
  admitFitProfile,
} from "./admission";
export type {
  AdmissionResult,
  CapacityPolicyAdmissionInput,
  CapacityPolicyRecord,
  FitProfileAdmissionInput,
  ReviewedAdmissionManifest,
  RuntimeScopedFitProfileRecord,
} from "./admission";

export type {
  AdmittedFitAssessmentPolicy,
  AdmittedFitProfile,
  BoundFitProfile,
  FitAssessmentInput,
  FitAssessmentPolicy,
  FitEvidenceAssessmentEnvelope,
  FitEvidenceAssessmentInput,
  UpstreamAdvisoryState,
} from "./types";

export {
  RUNNER_FIT_PROFILE_CAPTURE_CONTRACT,
  RUNNER_FIT_PROFILE_CAPTURE_PROTOCOL,
  RUNNER_FIT_PROFILE_CAPTURE_SCHEMA_VERSION,
  validateRunnerFitProfileCapture,
} from "./runner-fit-profile-capture";
export type {
  RunnerFitProfileCaptureAttempt,
  RunnerFitProfileCapturePool,
  RunnerFitProfileCaptureV1,
  TrustedCaptureValidation,
} from "./runner-fit-profile-capture";

type PerformanceKey = keyof FitEvidenceAssessment["performance"];
type EvidenceKey = keyof FitEvidenceAssessment["evidence"];

/**
 * M-F's pure boundary. It combines already-admitted identity, explicit
 * allocation facts and M-G-scoped evidence. It performs no discovery,
 * ranking, role assignment or I/O.
 */
export function assessFitEvidence(
  input: FitEvidenceAssessmentInput,
): FitEvidenceAssessmentEnvelope | NonDataEnvelope {
  try {
    return assessFitEvidenceValidated(input);
  } catch (error) {
    return failure(
      "error",
      "fit.input-invalid",
      error instanceof Error
        ? error.message
        : "The assessment input could not be validated.",
    );
  }
}

function assessFitEvidenceValidated(
  input: FitEvidenceAssessmentInput,
): FitEvidenceAssessmentEnvelope | NonDataEnvelope {
  const identityFailure = validateIdentity(input);
  if (identityFailure) return identityFailure;

  const hardwareFailure = validateHardware(input);
  if (hardwareFailure) return hardwareFailure;

  const policyFailure = validatePolicy(input);
  if (policyFailure) return policyFailure;

  let result: {
    fits: boolean;
    device: MemoryPool;
    host: MemoryPool;
    reasons: string[];
  };
  try {
    if (input.fitProfile.mode === "host") {
      result = hostFit(input);
    } else {
      const accelerator = input.hardwareTarget.accelerators[0]!;
      const split = fitMemoryPools(
        input.fitProfile.profile,
        {
          devicePhysicalBytes: accelerator.deviceMemoryBytes!,
          hostPhysicalBytes: input.hardwareTarget.memory.totalRamBytes,
          deviceReserveBytes: input.fitPolicy.deviceReserveBytes,
          hostReserveBytes: input.fitPolicy.hostReserveBytes,
          safetyMarginBps: input.fitPolicy.safetyMarginBps,
        },
        input.desiredContextTokens,
      );
      result = {
        fits: split.fits,
        device: toContractPool(split.device),
        host: toContractPool(split.host),
        reasons: split.reasons,
      };
    }
  } catch (error) {
    return failure(
      "error",
      "fit.profile-invalid",
      error instanceof Error ? error.message : "The fit profile could not be evaluated.",
    );
  }

  const evidence = collectEvidence(input);
  if (evidence.blocked) return evidence.blocked;

  const device = result.device;
  const host = result.host;
  const fit = result.fits ? "good" : "does-not-fit";

  const missing = evidence.missing;
  const warnings = [...evidence.warnings];
  if (input.upstreamAdvisory?.kind === "blocked") {
    warnings.push(
      `${input.upstreamAdvisory.reasonCode}: ${input.upstreamAdvisory.message}`,
    );
  } else if (input.upstreamAdvisory?.kind === "unavailable") {
    warnings.push(
      `${input.upstreamAdvisory.reasonCode}: ${input.upstreamAdvisory.message}`,
    );
  } else if (input.upstreamAdvisory?.kind === "ok") {
    return failure(
      "blocked",
      "llmfit.binding.registry-crosswalk-unverified",
      "No verified M-C family crosswalk can currently admit an M-B success into M-F.",
    );
  }

  const fitProvenance = input.fitProfile.provenance;
  const fitProvenanceItems = Array.isArray(fitProvenance)
    ? fitProvenance
    : [fitProvenance];
  evidence.fit.unshift(...fitProvenanceItems);
  const assessment: FitEvidenceAssessment = {
    assessmentId: input.assessmentId,
    candidateId: input.candidate.candidateId,
    hardwareTargetId: input.hardwareTarget.hardwareTargetId,
    fit,
    runPath: input.fitProfile.runPath,
    memoryPools: { device, host },
    performance: evidence.performance,
    evidence: {
      fit: evidence.fit,
      promptSpeed: evidence.promptSpeed,
      generationSpeed: evidence.generationSpeed,
      timeToFirstToken: evidence.timeToFirstToken,
      taskQuality: evidence.taskQuality,
    },
    blockingReasons: [...result.reasons],
  };

  const uniqueMissing = unique(missing);
  const uniqueWarnings = unique(warnings);
  const envelope: FitEvidenceAssessmentEnvelope = {
    schemaVersion: 1,
    contract: "fit-evidence-assessment",
    status: uniqueMissing.length === 0 ? "ok" : "partial",
    data: assessment,
    provenance: uniqueProvenance([
      ...fitProvenanceItems,
      ...input.fitPolicy.provenance,
      ...evidence.fit,
      ...evidence.promptSpeed,
      ...evidence.generationSpeed,
      ...evidence.timeToFirstToken,
      ...evidence.taskQuality,
    ]),
    completeness: {
      complete: uniqueMissing.length === 0,
      missing: uniqueMissing,
      warnings: uniqueWarnings,
      recoverableActions: uniqueMissing.length === 0
        ? []
        : ["Provide compatible scoped performance evidence for this exact assessment."],
    },
  };
  const validation = validateContract(envelope);
  if (!validation.ok) {
    return failure(
      "error",
      "fit.output-contract-invalid",
      `M-F refused to emit an invalid M-A envelope: ${validation.errors.join(" ")}`,
    );
  }
  return envelope;
}

function validateIdentity(
  input: FitEvidenceAssessmentInput,
): NonDataEnvelope | null {
  const candidateContractFailure = invalidProducerContract(
    "exact-configuration-candidate",
    input.candidate,
  );
  if (candidateContractFailure) {
    return failure(
      "blocked",
      "fit.candidate-contract-invalid",
      candidateContractFailure,
    );
  }
  const receiptContractFailure = invalidProducerContract(
    "compatibility-admission-receipt",
    input.compatibilityReceipt,
  );
  if (receiptContractFailure) {
    return failure(
      "blocked",
      "fit.compatibility-receipt-invalid",
      receiptContractFailure,
    );
  }
  const missing: string[] = [];
  if (!input.assessmentId.trim()) missing.push("assessmentId");
  if (!Number.isSafeInteger(input.desiredContextTokens) || input.desiredContextTokens <= 0) {
    missing.push("desiredContextTokens");
  }
  if (input.desiredContextTokens !== input.candidate.runtime.contextTokens) {
    return failure(
      "blocked",
      "fit.context-mismatch",
      "The requested context does not match the admitted exact runtime configuration.",
    );
  }

  const receipt = input.compatibilityReceipt;
  const candidate = input.candidate;
  const receiptMatches =
    receipt.receiptVersion === 1
    && receipt.policy.id === "m-e.compatibility"
    && receipt.policy.version === "1"
    && receipt.decision === "admitted"
    && receipt.candidateId === candidate.candidateId
    && receipt.artifactId === candidate.artifact.artifactId
    && receipt.artifactSha256 === candidate.artifact.sha256
    && receipt.runtimeConfigurationId === candidate.runtime.runtimeConfigurationId
    && receipt.target.product === candidate.runtime.product
    && receipt.target.engine === candidate.runtime.engine
    && receipt.target.engineBuild === candidate.runtime.engineBuild
    && receipt.target.backend === candidate.runtime.backend
    && receipt.target.quantizationScheme === candidate.artifact.quantization
    && (receipt.assertion.runtimeConstraint.exactBuild === null
      || receipt.assertion.runtimeConstraint.exactBuild
        === receipt.target.engineBuild);
  if (!receiptMatches) {
    return failure(
      "blocked",
      "fit.compatibility-receipt-mismatch",
      "The compatibility receipt is not bound to the exact candidate.",
    );
  }

  const binding = input.fitProfile.binding;
  if (
    binding.candidateId !== candidate.candidateId
    || binding.artifactSha256 !== candidate.artifact.sha256
    || binding.acceleratorId
      !== (input.hardwareTarget.accelerators[0]?.acceleratorId ?? null)
    || (binding.hardwareTargetId !== null
      && binding.hardwareTargetId !== input.hardwareTarget.hardwareTargetId)
    || !sameRuntime(binding.runtime, candidate.runtime)
  ) {
    return failure(
      "blocked",
      "fit.profile-binding-mismatch",
      "The fit profile is not bound to the exact candidate, artifact and runtime.",
    );
  }
  if (
    (input.fitProfile.mode === "host"
      ? input.fitProfile.artifact.id.trim() === ""
      : input.fitProfile.profile.id.trim() === "")
    || (Array.isArray(input.fitProfile.provenance)
      ? input.fitProfile.provenance.length === 0
        || input.fitProfile.provenance.some((item) => !validProvenance(item))
      : !validProvenance(input.fitProfile.provenance))
  ) {
    return failure(
      "blocked",
      "fit.profile-provenance-missing",
      "The fit profile requires attributable source provenance.",
    );
  }
  if (
    input.fitProfile.mode !== "host"
    && input.fitProfile.profile.device.modelBytes
      + input.fitProfile.profile.host.modelBytes <= 0
  ) {
    return failure(
      "blocked",
      "fit.profile-allocation-invalid",
      "An exact split profile must allocate model bytes to at least one pool.",
    );
  }
  const provenanceItems = Array.isArray(input.fitProfile.provenance)
    ? input.fitProfile.provenance
    : [input.fitProfile.provenance];
  if (
    provenanceItems.some((item) => item.hardwareMatch === "exact")
    && binding.hardwareTargetId !== input.hardwareTarget.hardwareTargetId
  ) {
    return failure(
      "blocked",
      "fit.profile-hardware-scope-mismatch",
      "Exact-hardware fit provenance requires an exact hardware-target binding.",
    );
  }
  if (missing.length > 0) {
    return failure(
      "blocked",
      "fit.input-incomplete",
      `Required assessment inputs are missing or invalid: ${missing.join(", ")}.`,
    );
  }
  return null;
}

function validateHardware(
  input: FitEvidenceAssessmentInput,
): NonDataEnvelope | null {
  const hardware = input.hardwareTarget;
  const hardwareContractFailure = invalidProducerContract(
    "hardware-target",
    hardware,
  );
  if (hardwareContractFailure) {
    return failure(
      "blocked",
      "fit.hardware-contract-invalid",
      hardwareContractFailure,
    );
  }
  if (hardware.hardwareTargetId.trim() === "") {
    return failure(
      "blocked",
      "fit.hardware-incomplete",
      "A hardware target identity is required.",
    );
  }
  if (hardware.os.family !== input.compatibilityReceipt.target.operatingSystem) {
    return failure(
      "blocked",
      "fit.hardware-runtime-mismatch",
      "The hardware operating system differs from the admitted runtime target.",
    );
  }
  if (
    !Number.isSafeInteger(hardware.memory.totalRamBytes)
    || hardware.memory.totalRamBytes <= 0
    || (hardware.memory.availableRamBytes !== null
      && hardware.memory.availableRamBytes > hardware.memory.totalRamBytes)
  ) {
    return failure(
      "blocked",
      "fit.host-memory-unconfirmed",
      "Confirmed or detected total host memory is required.",
    );
  }
  if (input.fitProfile.mode === "host") {
    if (
      input.candidate.runtime.backend !== "cpu"
      || input.fitProfile.runPath !== "cpu"
      || input.fitProfile.binding.acceleratorId !== null
      || hardware.accelerators.length !== 0
      || input.fitPolicy.deviceReserveBytes !== 0
    ) {
      return failure(
        "blocked",
        "fit.host-path-mismatch",
        "A host-only profile requires a CPU runtime, no accelerator, and no device reserve.",
      );
    }
  } else if (hardware.memory.unified !== false) {
    return failure(
      "blocked",
      "fit.unified-memory-profile-required",
      "A split device/host profile cannot be applied to unified or unknown memory.",
    );
  }
  if (input.fitProfile.mode !== "host" && hardware.accelerators.length !== 1) {
    return failure(
      "blocked",
      "fit.accelerator-selection-required",
      "The split-pool assessment requires exactly one selected accelerator.",
    );
  }
  if (input.fitProfile.mode === "host") {
    const hostOrigin = hardware.fieldOrigins["/memory/totalRamBytes"];
    if (!trustedCapacityOrigin(hostOrigin)) {
      return failure(
        "blocked",
        "fit.memory-origin-unconfirmed",
        "Host capacity must be confirmed or detected; estimates are not accepted.",
      );
    }
    return null;
  }

  const accelerator = hardware.accelerators[0]!;
  if (
    accelerator.acceleratorId === null
    || accelerator.acceleratorId.trim() === ""
    || accelerator.count !== 1
    || accelerator.kind !== accelerator.vendor
    || accelerator.vendor === "cpu"
  ) {
    return failure(
      "blocked",
      "fit.accelerator-selection-required",
      "The split-pool assessment requires one exact registered device.",
    );
  }
  if (
    accelerator.deviceMemoryBytes === null
    || !Number.isSafeInteger(accelerator.deviceMemoryBytes)
    || accelerator.deviceMemoryBytes <= 0
  ) {
    return failure(
      "blocked",
      "fit.device-memory-unconfirmed",
      "Confirmed or detected device memory is required for a split-pool assessment.",
    );
  }
  if (accelerator.backend !== input.candidate.runtime.backend) {
    return failure(
      "blocked",
      "fit.backend-mismatch",
      "The selected accelerator backend differs from the admitted runtime backend.",
    );
  }
  const gpuLayers = input.candidate.runtime.gpuLayers;
  if (
    (input.fitProfile.runPath === "gpu" && gpuLayers !== "all")
    || (input.fitProfile.runPath === "cpu-offload"
      && !(typeof gpuLayers === "number" && gpuLayers > 0))
    || input.candidate.runtime.backend === "cpu"
  ) {
    return failure(
      "blocked",
      "fit.run-path-mismatch",
      "The profile run path contradicts the exact admitted runtime settings.",
    );
  }
  const deviceOrigin = hardware.fieldOrigins["/accelerators/0/deviceMemoryBytes"];
  const hostOrigin = hardware.fieldOrigins["/memory/totalRamBytes"];
  if (!trustedCapacityOrigin(deviceOrigin) || !trustedCapacityOrigin(hostOrigin)) {
    return failure(
      "blocked",
      "fit.memory-origin-unconfirmed",
      "Device and host capacities must be confirmed or detected; estimates are not accepted.",
    );
  }
  return null;
}

function validatePolicy(
  input: FitEvidenceAssessmentInput,
): NonDataEnvelope | null {
  const policy = input.fitPolicy;
  const bytes = [policy.deviceReserveBytes, policy.hostReserveBytes];
  if (
    policy.policyId.trim() === ""
    || policy.policyVersion.trim() === ""
    || policy.binding.hardwareTargetId !== input.hardwareTarget.hardwareTargetId
    || policy.binding.operatingSystem !== input.hardwareTarget.os.family
    || policy.binding.runPath !== input.fitProfile.runPath
    || bytes.some((value) => !Number.isSafeInteger(value) || value < 0)
    || !Number.isInteger(policy.safetyMarginBps)
    || policy.safetyMarginBps < 0
    || policy.safetyMarginBps > 10_000
    || !Number.isInteger(policy.tightHeadroomBps)
    || policy.basis !== "confirmed-capacity-minus-reserve"
    || !Array.isArray(policy.provenance)
    || policy.provenance.length === 0
    || policy.provenance.some((item) => !validProvenance(item))
  ) {
    return failure(
      "blocked",
      "fit.policy-invalid",
      "Fit reserves and basis-point thresholds must be explicit valid values.",
    );
  }
  if (policy.tightHeadroomBps !== 0) {
    return failure(
      "blocked",
      "fit.tight-policy-unapproved",
      "No product-owner-approved threshold currently defines a tight fit.",
    );
  }
  return null;
}

function collectEvidence(input: FitEvidenceAssessmentInput): {
  performance: FitEvidenceAssessment["performance"];
  fit: Provenance[];
  promptSpeed: Provenance[];
  generationSpeed: Provenance[];
  timeToFirstToken: Provenance[];
  taskQuality: Provenance[];
  missing: string[];
  warnings: string[];
  blocked: NonDataEnvelope | null;
} {
  const collected = {
    performance: {
      promptTokensPerSecond: null,
      generationTokensPerSecond: null,
      timeToFirstTokenMs: null,
    } as FitEvidenceAssessment["performance"],
    fit: [] as Provenance[],
    promptSpeed: [] as Provenance[],
    generationSpeed: [] as Provenance[],
    timeToFirstToken: [] as Provenance[],
    taskQuality: [] as Provenance[],
    missing: [] as string[],
    warnings: [] as string[],
    blocked: null as NonDataEnvelope | null,
  };

  const throughput = input.evidence.throughput;
  if (throughput) {
    if (throughput.kind === "unsupported") {
      collected.blocked = failure(
        "blocked",
        "fit.evidence-unsupported",
        unsupportedEvidenceMessage(throughput.reasons),
      );
      return collected;
    } else {
      const mismatch = componentIdentityMismatch(
        input,
        throughput.value.candidateId,
        throughput.value.hardwareTargetId,
      );
      if (mismatch) {
        collected.blocked = mismatch;
        return collected;
      }
      const invalidThroughput = validateThroughputComponent(throughput.value);
      if (invalidThroughput) {
        collected.blocked = invalidThroughput;
        return collected;
      }
      collected.performance = { ...throughput.value.performance };
      collected.promptSpeed.push(...throughput.value.evidence.promptSpeed);
      collected.generationSpeed.push(...throughput.value.evidence.generationSpeed);
      collected.timeToFirstToken.push(...throughput.value.evidence.timeToFirstToken);
      if (throughput.kind === "lossy") {
        collected.warnings.push(...throughput.reasons);
      }
    }
  }

  for (const result of input.evidence.records) {
    if (result.kind === "unsupported") {
      collected.blocked = failure(
        "blocked",
        "fit.evidence-unsupported",
        unsupportedEvidenceMessage(result.reasons),
      );
      return collected;
    }
    const mismatch = componentIdentityMismatch(
      input,
      result.value.candidateId,
      result.value.hardwareTargetId,
    );
    if (mismatch) {
      collected.blocked = mismatch;
      return collected;
    }
    if (![
      "fit-memory",
      "prompt-throughput",
      "generation-throughput",
      "time-to-first-token",
    ].includes(result.value.metric)) {
      collected.blocked = failure(
        "blocked",
        "fit.evidence-channel-forbidden",
        "Only fit and performance evidence may enter M-F.",
      );
      return collected;
    }
    const invalidRecord = validateNormalizedComponent(result.value);
    if (invalidRecord) {
      collected.blocked = invalidRecord;
      return collected;
    }
    const mapping = metricMapping(result.value.metric);
    const preferred = preferredMeasurement(result.value.provenance);
    if (mapping?.performance && preferred) {
      const next = {
        low: preferred.measurement!.interval!.lower,
        high: preferred.measurement!.interval!.upper,
      };
      const existingExact = preferredMeasurement(collected[mapping.evidence]);
      const existingRange = existingExact?.measurement?.interval;
      if (existingRange
        && (existingRange.lower !== next.low || existingRange.upper !== next.high)) {
        collected.blocked = failure(
          "blocked",
          "fit.evidence-conflict",
          "Multiple accepted evidence components provide conflicting performance ranges.",
        );
        return collected;
      }
    }
    addNormalizedEvidence(collected, result);
    if (result.kind === "lossy") collected.warnings.push(...result.reasons);
  }

  for (const key of [
    "promptTokensPerSecond",
    "generationTokensPerSecond",
    "timeToFirstTokenMs",
  ] as const) {
    if (collected.performance[key] === null) {
      collected.missing.push(`performance.${key}`);
    }
  }
  return collected;
}

function addNormalizedEvidence(
  target: ReturnType<typeof collectEvidence>,
  result: Exclude<
    EvidenceAdapterResult<NormalizedEvidenceComponent>,
    { kind: "unsupported" }
  >,
): void {
  const component = result.value;
  const mapping = metricMapping(component.metric);
  if (!mapping) return;
  target[mapping.evidence].push(...component.provenance);
  const preferred = preferredMeasurement(component.provenance);
  if (preferred && mapping.performance) {
    target.performance[mapping.performance] = {
      low: preferred.measurement!.interval!.lower,
      high: preferred.measurement!.interval!.upper,
    };
  }
}

function metricMapping(
  metric: NormalizedEvidenceComponent["metric"],
): { evidence: EvidenceKey; performance: PerformanceKey | null } | null {
  switch (metric) {
    case "fit-memory":
      return { evidence: "fit", performance: null };
    case "prompt-throughput":
      return { evidence: "promptSpeed", performance: "promptTokensPerSecond" };
    case "generation-throughput":
      return {
        evidence: "generationSpeed",
        performance: "generationTokensPerSecond",
      };
    case "time-to-first-token":
      return { evidence: "timeToFirstToken", performance: "timeToFirstTokenMs" };
    default:
      return null;
  }
}

function preferredMeasurement(provenance: Provenance[]): Provenance | null {
  return provenance.find(
    (item) =>
      item.method === "measurement"
      && item.hardwareMatch === "exact"
      && item.configurationMatch === "exact"
      && item.measurement?.eligible === true
      && item.measurement.interval !== null,
  ) ?? null;
}

function componentIdentityMismatch(
  input: FitEvidenceAssessmentInput,
  candidateId: string,
  hardwareTargetId: string | null,
): NonDataEnvelope | null {
  if (
    candidateId !== input.candidate.candidateId
    || hardwareTargetId !== input.hardwareTarget.hardwareTargetId
  ) {
    return failure(
      "blocked",
      "fit.evidence-identity-mismatch",
      "M-G evidence is not bound to the selected candidate and hardware target.",
    );
  }
  return null;
}

function toContractPool(pool: MemoryPoolBreakdown): MemoryPool {
  return {
    modelBytes: pool.modelBytes,
    contextBytes: pool.contextBytes,
    computeBytes: pool.computeBytes,
    reserveBytes: pool.reserveBytes,
    marginBytes: pool.safetyMarginBytes,
    requiredBytes: pool.requiredBytes,
    availableBytes: pool.physicalBytes,
  };
}

function hostFit(input: FitEvidenceAssessmentInput): {
  fits: boolean;
  device: MemoryPool;
  host: MemoryPool;
  reasons: string[];
} {
  if (input.fitProfile.mode !== "host") {
    throw new TypeError("A host-only fit profile is required.");
  }
  const result: FitResult = fit(
    input.fitProfile.artifact,
    {
      physicalMemoryBytes: input.hardwareTarget.memory.totalRamBytes,
      osReserveBytes: input.fitPolicy.hostReserveBytes,
      displayReserveBytes: 0,
      safetyMarginBps: input.fitPolicy.safetyMarginBps,
    },
    input.desiredContextTokens,
    input.fitProfile.kvCache,
  );
  return {
    fits: result.fits,
    device: {
      modelBytes: 0,
      contextBytes: 0,
      computeBytes: 0,
      reserveBytes: 0,
      marginBytes: 0,
      requiredBytes: 0,
      availableBytes: 0,
    },
    host: {
      modelBytes: result.breakdown.weightsBytes,
      contextBytes: result.breakdown.kvCacheBytes,
      computeBytes: result.breakdown.runtimeComputeBufferBytes,
      reserveBytes:
        result.breakdown.osReserveBytes + result.breakdown.displayReserveBytes,
      marginBytes: result.breakdown.safetyMarginBytes,
      requiredBytes: result.requiredBytes,
      availableBytes: result.physicalMemoryBytes,
    },
    reasons: result.reasons,
  };
}

function sameRuntime(
  left: FitEvidenceAssessmentInput["candidate"]["runtime"],
  right: FitEvidenceAssessmentInput["candidate"]["runtime"],
): boolean {
  return left.runtimeConfigurationId === right.runtimeConfigurationId
    && left.product === right.product
    && left.engine === right.engine
    && left.engineBuild === right.engineBuild
    && left.backend === right.backend
    && left.chatTemplate === right.chatTemplate
    && left.contextTokens === right.contextTokens
    && left.kvCache.key === right.kvCache.key
    && left.kvCache.value === right.kvCache.value
    && left.gpuLayers === right.gpuLayers
    && left.batchSize === right.batchSize
    && left.microBatchSize === right.microBatchSize
    && left.parallelism === right.parallelism
    && left.threads === right.threads
    && left.flashAttention === right.flashAttention
    && left.mmap === right.mmap
    && left.sampler.temperature === right.sampler.temperature
    && left.sampler.topP === right.sampler.topP
    && left.sampler.topK === right.sampler.topK
    && left.sampler.minP === right.sampler.minP
    && left.sampler.seed === right.sampler.seed
    && left.additionalFlags.length === right.additionalFlags.length
    && left.additionalFlags.every((flag, index) =>
      flag.name === right.additionalFlags[index]?.name
      && flag.value === right.additionalFlags[index]?.value);
}

function validateThroughputComponent(
  component: ThroughputEvidenceComponents,
): NonDataEnvelope | null {
  for (const [key, range] of Object.entries(component.performance)) {
    if (range !== null
      && (!Number.isFinite(range.low)
        || !Number.isFinite(range.high)
        || range.low < 0
        || range.low > range.high)) {
      return failure(
        "blocked",
        "fit.performance-range-invalid",
        `The ${key} performance interval is invalid.`,
      );
    }
  }
  const channels = [
    ["promptSpeed", "promptTokensPerSecond", "tokens-per-second"],
    ["generationSpeed", "generationTokensPerSecond", "tokens-per-second"],
    ["timeToFirstToken", "timeToFirstTokenMs", "milliseconds"],
  ] as const;
  for (const [key, performanceKey, unit] of channels) {
    if (component.evidence[key].some((item) => !validProvenance(item))) {
      return failure(
        "blocked",
        "fit.performance-evidence-invalid",
        `The ${key} evidence contains invalid provenance.`,
      );
    }
    if (component.evidence[key].some((item) =>
      item.method !== "estimate"
      || item.measurement === null
      || item.measurement.unit !== unit
      || item.measurement.interval === null
      || !validInterval(
        item.measurement.interval.lower,
        item.measurement.interval.upper,
      ))) {
      return failure(
        "blocked",
        "fit.performance-evidence-invalid",
        `The ${key} prior must remain an attributed non-negative estimate.`,
      );
    }
    const range = component.performance[performanceKey];
    if (
      range !== null
      && !component.evidence[key].some((item) =>
        item.measurement?.interval?.lower === range.low
        && item.measurement.interval.upper === range.high)
    ) {
      return failure(
        "blocked",
        "fit.performance-provenance-mismatch",
        `The ${key} range is not supported by its attached provenance.`,
      );
    }
  }
  return null;
}

function validateNormalizedComponent(
  component: NormalizedEvidenceComponent,
): NonDataEnvelope | null {
  if (
    !Array.isArray(component.provenance)
    || component.provenance.length === 0
    || component.provenance.some((item) => !validProvenance(item))
  ) {
    return failure(
      "blocked",
      "fit.performance-evidence-invalid",
      "Normalized evidence requires valid attributed provenance.",
    );
  }
  const expectedUnit = component.metric === "prompt-throughput"
    || component.metric === "generation-throughput"
    ? "tokens-per-second"
    : component.metric === "time-to-first-token"
      ? "milliseconds"
      : component.metric === "fit-memory"
        ? "bytes"
        : null;
  if (
    expectedUnit === null
    || component.claim === "preference"
    || component.provenance.some((item) => item.method === "preference")
  ) {
    return failure(
      "blocked",
      "fit.performance-evidence-invalid",
      "Preference evidence cannot support a fit or performance range.",
    );
  }
  for (const item of component.provenance) {
    if (
      item.measurement?.interval !== null
      && item.measurement !== null
      && (item.measurement.unit !== expectedUnit
        || !validInterval(
          item.measurement.interval.lower,
          item.measurement.interval.upper,
        ))
    ) {
      return failure(
        "blocked",
        "fit.performance-evidence-invalid",
        `The ${component.metric} evidence has an invalid interval or unit.`,
      );
    }
  }
  const exactIntervals = component.provenance
    .filter((item) =>
      item.method === "measurement"
      && item.hardwareMatch === "exact"
      && item.configurationMatch === "exact"
      && item.measurement?.eligible === true
      && item.measurement.interval !== null)
    .map((item) =>
      `${item.measurement!.interval!.lower}:${item.measurement!.interval!.upper}`);
  if (new Set(exactIntervals).size > 1) {
    return failure(
      "blocked",
      "fit.evidence-conflict",
      "One evidence component contains conflicting exact eligible ranges.",
    );
  }
  return null;
}

function validInterval(lower: number, upper: number): boolean {
  return Number.isFinite(lower)
    && Number.isFinite(upper)
    && lower >= 0
    && lower <= upper;
}

function trustedCapacityOrigin(value: unknown): boolean {
  return value === "confirmed" || value === "detected";
}

function validProvenance(value: Provenance): boolean {
  if (
    typeof value !== "object"
    || value === null
    || typeof value.source?.id !== "string"
    || value.source.id.trim() === ""
    || !Boolean(
      (typeof value.source.url === "string" && value.source.url.trim())
      || (typeof value.rawSourceRecordRef === "string"
        && value.rawSourceRecordRef.trim()),
    )
  ) {
    return false;
  }
  return validateContract({
    schemaVersion: 1,
    contract: "fit-evidence-assessment",
    status: "unavailable",
    reasonCode: "fit.provenance-validation",
    message: "Provenance validation carrier.",
    recoverableActions: [],
    provenance: [value],
    warnings: [],
  }).ok;
}

function invalidProducerContract(
  contract:
    | "hardware-target"
    | "exact-configuration-candidate"
    | "compatibility-admission-receipt",
  data: unknown,
): string | null {
  const validation = validateContract({
    schemaVersion: 1,
    contract,
    status: "ok",
    data,
    provenance: [],
    completeness: {
      complete: true,
      missing: [],
      warnings: [],
      recoverableActions: [],
    },
  });
  return validation.ok
    ? null
    : `The ${contract} producer output is invalid: ${validation.errors.join(" ")}`;
}

function failure(
  status: "unavailable" | "blocked" | "error",
  reasonCode: string,
  message: string,
): NonDataEnvelope {
  const safeReasonCode = reasonCode.trim() || "fit.unspecified-failure";
  const safeMessage = message.trim()
    || "M-F rejected the input without a usable upstream diagnostic.";
  return {
    schemaVersion: 1,
    contract: "fit-evidence-assessment",
    status,
    reasonCode: safeReasonCode,
    message: safeMessage,
    recoverableActions: [],
    provenance: [],
    warnings: [],
  };
}

function unsupportedEvidenceMessage(reasons: string[]): string {
  const usable = reasons
    .filter((reason): reason is string => typeof reason === "string")
    .map((reason) => reason.trim())
    .filter(Boolean);
  return usable.length > 0
    ? usable.join(" ")
    : "M-G marked evidence unsupported without an attributable reason.";
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function uniqueProvenance(values: Provenance[]): Provenance[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = JSON.stringify(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

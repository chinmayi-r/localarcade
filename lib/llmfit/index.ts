import type {
  LlmfitAdvisoryCandidate,
  LlmfitAdvisoryEnvelope,
  LlmfitAdvisoryOk,
  LlmfitAdvisoryRequest,
  LlmfitFamilyBinding,
  LlmfitMappingResult,
  MFFitUpstreamAdvisoryInput,
} from "./types";
import {
  llmfitRevision,
  llmfitSourceUrl,
  llmfitVersion,
} from "./types";

export type {
  LlmfitAdvisoryCandidate,
  LlmfitAdvisoryEnvelope,
  LlmfitAdvisoryRequest,
  LlmfitFamilyBinding,
  MFFitUpstreamAdvisoryInput,
} from "./types";
export { llmfitRevision, llmfitSourceUrl, llmfitVersion } from "./types";

type RecordValue = Record<string, unknown>;

const taskFamilies = new Set([
  "coding",
  "writing",
  "extraction",
  "general",
  "other",
]);
const backends = new Set(["cuda", "rocm", "metal", "vulkan", "cpu"]);
const knownRuntimeNames = new Set([
  "llama.cpp",
  "llamacpp",
  "ollama",
  "mlx",
  "vllm",
]);
const forbiddenRankingFields = new Set([
  "score",
  "scoreComponents",
  "rank",
  "position",
  "role",
  "quality",
]);
const u32Max = 4_294_967_295;

function blocked<T>(
  reasonCode: string,
  message: string,
  missing?: string[],
): LlmfitMappingResult<T> {
  return { kind: "blocked", reasonCode, message, ...(missing ? { missing } : {}) };
}

function isRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasOnlyKeys(value: RecordValue, allowed: readonly string[]): boolean {
  const keys = new Set(allowed);
  return Object.keys(value).every((key) => keys.has(key));
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function exactSource(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["id", "version", "revision", "url"]) &&
    value.id === "llmfit-core" &&
    value.version === llmfitVersion &&
    value.revision === llmfitRevision &&
    value.url === llmfitSourceUrl
  );
}

function hasForbiddenRankingField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenRankingField);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(
    ([key, child]) =>
      forbiddenRankingFields.has(key) ||
      /score|rank|quality/i.test(key) ||
      hasForbiddenRankingField(child),
  );
}

function validProvenance(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "source",
      "retrievedAt",
      "observedAt",
      "method",
      "hardwareMatch",
      "configurationMatch",
      "scope",
      "sampleCount",
      "measurement",
      "rawSourceRecordRef",
    ]) ||
    !exactSource(value.source) ||
    value.method !== "estimate" ||
    value.hardwareMatch !== "exact" ||
    value.configurationMatch !== "family-proxy" ||
    !isRecord(value.scope) ||
    !hasOnlyKeys(value.scope, [
      "taskFamily",
      "taskPackId",
      "promptId",
      "harnessId",
    ]) ||
    !nonEmpty(value.rawSourceRecordRef)
  ) {
    return false;
  }
  if (value.measurement === null) return true;
  if (
    !isRecord(value.measurement) ||
    !hasOnlyKeys(value.measurement, [
      "unit",
      "interval",
      "confidence",
      "eligible",
      "eligibilityReasons",
    ])
  ) {
    return false;
  }
  if (
    ![
      "bytes",
      "tokens-per-second",
      "milliseconds",
      "probability",
      "joules",
      "boolean",
      "count",
      "other",
    ].includes(String(value.measurement.unit))
  ) {
    return false;
  }
  const interval = value.measurement.interval;
  if (
    interval !== null &&
    (!isRecord(interval) ||
      !hasOnlyKeys(interval, ["lower", "upper"]) ||
      !finiteNonNegative(interval.lower) ||
      !finiteNonNegative(interval.upper) ||
      Number(interval.lower) > Number(interval.upper))
  ) {
    return false;
  }
  const confidence = value.measurement.confidence;
  return (
    (confidence === null ||
      (finiteNonNegative(confidence) && Number(confidence) <= 1)) &&
    (value.measurement.eligible === null ||
      typeof value.measurement.eligible === "boolean") &&
    Array.isArray(value.measurement.eligibilityReasons) &&
    value.measurement.eligibilityReasons.every(nonEmpty)
  );
}

function validFailureProvenance(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "source",
      "retrievedAt",
      "observedAt",
      "method",
      "hardwareMatch",
      "configurationMatch",
      "scope",
      "sampleCount",
      "measurement",
      "rawSourceRecordRef",
    ]) &&
    exactSource(value.source) &&
    value.method === "estimate" &&
    ["exact", "calibrated-neighbor", "coarse-bucket", "not-applicable", "unknown"].includes(
      String(value.hardwareMatch),
    ) &&
    ["exact", "compatible", "family-proxy", "not-applicable", "unknown"].includes(
      String(value.configurationMatch),
    ) &&
    isRecord(value.scope) &&
    hasOnlyKeys(value.scope, [
      "taskFamily",
      "taskPackId",
      "promptId",
      "harnessId",
    ]) &&
    (value.rawSourceRecordRef === null || nonEmpty(value.rawSourceRecordRef))
  );
}

function validRange(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["low", "high"]) &&
    finiteNonNegative(value.low) &&
    finiteNonNegative(value.high) &&
    Number(value.low) <= Number(value.high)
  );
}

function validCandidate(value: unknown): value is LlmfitAdvisoryCandidate {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "advisoryId",
      "upstreamModel",
      "advisory",
      "mappingIssues",
      "provenance",
      "rawSourceRecordRef",
    ]) ||
    !nonEmpty(value.advisoryId)
  ) {
    return false;
  }
  if (
    !isRecord(value.upstreamModel) ||
    !hasOnlyKeys(value.upstreamModel, [
      "id",
      "displayName",
      "provider",
      "parameters",
      "upstreamReportedCapabilities",
    ]) ||
    !nonEmpty(value.upstreamModel.id) ||
    !nonEmpty(value.upstreamModel.displayName) ||
    !nonEmpty(value.upstreamModel.provider) ||
    !positiveInteger(value.upstreamModel.parameters) ||
    !Array.isArray(value.upstreamModel.upstreamReportedCapabilities) ||
    !value.upstreamModel.upstreamReportedCapabilities.every(nonEmpty)
  ) {
    return false;
  }
  const advisory = value.advisory;
  if (
    !isRecord(advisory) ||
    !hasOnlyKeys(advisory, [
      "fit",
      "runPath",
      "memoryRequiredBytes",
      "memoryAvailableBytes",
      "context",
      "performance",
      "suggestedRuntime",
      "suggestedQuantization",
    ])
  ) {
    return false;
  }
  if (!["good", "tight", "does-not-fit"].includes(String(advisory.fit))) {
    return false;
  }
  if (!["gpu", "cpu-offload", "cpu"].includes(String(advisory.runPath))) {
    return false;
  }
  if (
    !positiveInteger(advisory.memoryRequiredBytes) ||
    !positiveInteger(advisory.memoryAvailableBytes) ||
    !isRecord(advisory.context) ||
    !hasOnlyKeys(advisory.context, [
      "requestedTokens",
      "effectiveTokens",
      "usableTokens",
    ]) ||
    !positiveInteger(advisory.context.requestedTokens) ||
    !positiveInteger(advisory.context.effectiveTokens) ||
    !positiveInteger(advisory.context.usableTokens) ||
    !isRecord(advisory.performance) ||
    !hasOnlyKeys(advisory.performance, [
      "estimatedGenerationTokensPerSecond",
      "upstreamReportedGenerationTokensPerSecond",
    ])
  ) {
    return false;
  }
  if (
    (advisory.fit === "good" || advisory.fit === "tight") &&
    Number(advisory.memoryRequiredBytes) >
      Number(advisory.memoryAvailableBytes)
  ) {
    return false;
  }
  if (
    Number(advisory.context.effectiveTokens) >
      Number(advisory.context.requestedTokens) ||
    Number(advisory.context.usableTokens) >
      Number(advisory.context.effectiveTokens)
  ) {
    return false;
  }
  const estimate = advisory.performance.estimatedGenerationTokensPerSecond;
  if (estimate !== null && !validRange(estimate)) return false;
  if (advisory.performance.upstreamReportedGenerationTokensPerSecond !== null) {
    return false;
  }
  if (
    !(advisory.suggestedRuntime === null || nonEmpty(advisory.suggestedRuntime)) ||
    !(advisory.suggestedQuantization === null ||
      nonEmpty(advisory.suggestedQuantization))
  ) {
    return false;
  }
  if (!Array.isArray(value.mappingIssues)) return false;
  if (
    !value.mappingIssues.every(
      (issue) =>
        isRecord(issue) &&
        hasOnlyKeys(issue, [
          "path",
          "classification",
          "reasonCode",
          "message",
        ]) &&
        nonEmpty(issue.path) &&
        ["lossy", "unsupported"].includes(String(issue.classification)) &&
        nonEmpty(issue.reasonCode) &&
        nonEmpty(issue.message),
    )
  ) {
    return false;
  }
  if (
    !Array.isArray(value.provenance) ||
    value.provenance.length === 0 ||
    !value.provenance.every(validProvenance) ||
    !nonEmpty(value.rawSourceRecordRef)
  ) {
    return false;
  }
  if (
    value.provenance.some(
      (item) =>
        isRecord(item) &&
        item.rawSourceRecordRef !== value.rawSourceRecordRef,
    )
  ) {
    return false;
  }
  return true;
}

export function validateLlmfitAdvisoryRequest(
  value: unknown,
): LlmfitMappingResult<LlmfitAdvisoryRequest> {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "schemaVersion",
      "capability",
      "requestId",
      "hardwareTarget",
      "query",
    ]) ||
    value.schemaVersion !== 1 ||
    value.capability !== "llmfit-advisory-request" ||
    !nonEmpty(value.requestId) ||
    !isRecord(value.hardwareTarget) ||
    !nonEmpty(value.hardwareTarget.hardwareTargetId) ||
    !isRecord(value.query)
  ) {
    return blocked("llmfit.request.invalid", "The M-B request is malformed.");
  }
  const query = value.query;
  if (
    !hasOnlyKeys(query, [
      "taskFamily",
      "interactionStyle",
      "desiredContextTokens",
      "forcedRuntime",
    ]) ||
    !taskFamilies.has(String(query.taskFamily)) ||
    !["interactive", "batch"].includes(String(query.interactionStyle)) ||
    !positiveInteger(query.desiredContextTokens) ||
    Number(query.desiredContextTokens) > u32Max
  ) {
    return blocked(
      "llmfit.request.invalid",
      "The M-B task or context request is invalid.",
    );
  }
  if (query.forcedRuntime !== null) {
    if (!knownRuntimeNames.has(String(query.forcedRuntime))) {
      return blocked(
        "llmfit.override.invalid",
        "The requested runtime is not recognized by the pinned adapter.",
      );
    }
    return blocked(
      "llmfit.override.unsupported-in-pinned-adapter",
      "The pinned pure-fit API cannot combine a forced runtime with the explicit calculation policy.",
    );
  }

  const hardware = value.hardwareTarget;
  if (
    !hasOnlyKeys(hardware, [
      "hardwareTargetId",
      "os",
      "cpu",
      "memory",
      "accelerators",
      "fieldOrigins",
    ])
  ) {
    return blocked(
      "llmfit.request.invalid",
      "The hardware target contains undeclared fields.",
    );
  }
  if (
    !isRecord(hardware.os) ||
    !hasOnlyKeys(hardware.os, ["family", "version"]) ||
    !["windows", "macos", "linux", "other"].includes(
      String(hardware.os.family),
    ) ||
    !isRecord(hardware.fieldOrigins)
  ) {
    return blocked(
      "llmfit.request.invalid",
      "The hardware OS or field-origin record is malformed.",
    );
  }
  const missing: string[] = [];
  if (!isRecord(hardware.cpu)) {
    missing.push(
      "hardwareTarget.cpu.displayName",
      "hardwareTarget.cpu.logicalCores",
    );
  } else {
    if (!hasOnlyKeys(hardware.cpu, ["displayName", "logicalCores"])) {
      return blocked(
        "llmfit.request.invalid",
        "The CPU target contains undeclared fields.",
      );
    }
    if (!nonEmpty(hardware.cpu.displayName)) {
      missing.push("hardwareTarget.cpu.displayName");
    }
    if (!positiveInteger(hardware.cpu.logicalCores)) {
      missing.push("hardwareTarget.cpu.logicalCores");
    }
  }
  if (!isRecord(hardware.memory)) {
    missing.push(
      "hardwareTarget.memory.totalRamBytes",
      "hardwareTarget.memory.availableRamBytes",
      "hardwareTarget.memory.unified",
    );
  } else {
    if (
      !hasOnlyKeys(hardware.memory, [
        "totalRamBytes",
        "availableRamBytes",
        "unified",
      ])
    ) {
      return blocked(
        "llmfit.request.invalid",
        "The memory target contains undeclared fields.",
      );
    }
    if (!positiveInteger(hardware.memory.totalRamBytes)) {
      missing.push("hardwareTarget.memory.totalRamBytes");
    }
    if (!positiveInteger(hardware.memory.availableRamBytes)) {
      missing.push("hardwareTarget.memory.availableRamBytes");
    }
    if (typeof hardware.memory.unified !== "boolean") {
      missing.push("hardwareTarget.memory.unified");
    }
  }
  if (!Array.isArray(hardware.accelerators) || hardware.accelerators.length !== 1) {
    return blocked(
      "llmfit.hardware.topology-not-representable",
      "The pinned advisory adapter supports one homogeneous accelerator group only.",
    );
  }
  const accelerator = hardware.accelerators[0];
  if (!isRecord(accelerator)) {
    missing.push("hardwareTarget.accelerators[0]");
  } else {
    if (
      !hasOnlyKeys(accelerator, [
        "acceleratorId",
        "displayName",
        "kind",
        "vendor",
        "backend",
        "deviceMemoryBytes",
        "count",
      ])
    ) {
      return blocked(
        "llmfit.request.invalid",
        "The accelerator target contains undeclared fields.",
      );
    }
    if (!nonEmpty(accelerator.displayName)) {
      missing.push("hardwareTarget.accelerators[0].displayName");
    }
    if (
      !["nvidia", "amd", "apple", "intel", "cpu", "other"].includes(
        String(accelerator.kind),
      ) ||
      !["nvidia", "amd", "apple", "intel", "cpu", "other"].includes(
        String(accelerator.vendor),
      )
    ) {
      return blocked(
        "llmfit.request.invalid",
        "The accelerator kind or vendor is unknown.",
      );
    }
    if (!backends.has(String(accelerator.backend))) {
      missing.push("hardwareTarget.accelerators[0].backend");
    }
    if (!positiveInteger(accelerator.deviceMemoryBytes)) {
      missing.push("hardwareTarget.accelerators[0].deviceMemoryBytes");
    }
    if (
      !positiveInteger(accelerator.count) ||
      Number(accelerator.count) > u32Max
    ) {
      missing.push("hardwareTarget.accelerators[0].count");
    }
  }
  if (missing.length > 0) {
    return blocked(
      "llmfit.hardware.required-facts-missing",
      "Confirm every required hardware fact before requesting upstream advice.",
      missing,
    );
  }
  if (
    isRecord(hardware.memory) &&
    Number(hardware.memory.availableRamBytes) >
      Number(hardware.memory.totalRamBytes)
  ) {
    return blocked(
      "llmfit.hardware.contradictory",
      "Available RAM cannot exceed total RAM.",
    );
  }
  if (isRecord(accelerator) && accelerator.backend === "cpu") {
    return blocked(
      "llmfit.hardware.cpu-architecture-missing",
      "The M-A hardware target does not carry the CPU architecture required by the pinned provider.",
    );
  }
  if (isRecord(hardware.memory) && hardware.memory.unified === true) {
    return blocked(
      "llmfit.hardware.unified-working-set-missing",
      "The M-A hardware target does not carry the confirmed GPU working-set limit required by the pinned provider.",
    );
  }
  if (
    isRecord(hardware.memory) &&
    hardware.memory.unified === true &&
    isRecord(accelerator) &&
    Number(accelerator.count) !== 1
  ) {
    return blocked(
      "llmfit.hardware.topology-not-representable",
      "The pinned adapter cannot aggregate multiple unified-memory devices.",
    );
  }
  return { kind: "ok", value: value as LlmfitAdvisoryRequest };
}

export function parseLlmfitAdvisoryEnvelope(
  value: unknown,
): LlmfitMappingResult<LlmfitAdvisoryEnvelope> {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "schemaVersion",
      "capability",
      "status",
      "requestId",
      "hardwareTargetId",
      "source",
      "requestScope",
      "candidates",
      "warnings",
      "reasonCode",
      "message",
      "providerInvoked",
      "recoverableActions",
      "provenance",
      "missing",
      "unsupportedPath",
      "unsupportedValue",
      "rawSourceRecordRef",
    ]) ||
    value.schemaVersion !== 1 ||
    value.capability !== "llmfit-advisory" ||
    !nonEmpty(value.requestId) ||
    hasForbiddenRankingField(value)
  ) {
    return blocked(
      "llmfit.envelope.invalid",
      "The M-B envelope is malformed or contains ranking fields.",
    );
  }
  if (value.status === "ok") {
    if (
      [
        "reasonCode",
        "message",
        "providerInvoked",
        "recoverableActions",
        "provenance",
        "missing",
        "unsupportedPath",
        "unsupportedValue",
        "rawSourceRecordRef",
      ].some((key) => key in value)
    ) {
      return blocked(
        "llmfit.envelope.invalid",
        "A successful envelope cannot contain failure fields.",
      );
    }
    const requestScope = value.requestScope;
    if (
      !nonEmpty(value.hardwareTargetId) ||
      !exactSource(value.source) ||
      !isRecord(requestScope) ||
      !taskFamilies.has(String(requestScope.taskFamily)) ||
      !["interactive", "batch"].includes(String(requestScope.interactionStyle)) ||
      !positiveInteger(requestScope.desiredContextTokens) ||
      requestScope.forcedRuntime !== null ||
      !Array.isArray(value.candidates) ||
      !value.candidates.every(validCandidate) ||
      !Array.isArray(value.warnings) ||
      !value.warnings.every(nonEmpty)
    ) {
      return blocked(
        "llmfit.envelope.provenance-or-schema-invalid",
        "Successful M-B advice must be completely attributed and schema-valid.",
      );
    }
    const candidates = value.candidates as LlmfitAdvisoryCandidate[];
    if (
      new Set(candidates.map((candidate) => candidate.advisoryId)).size !==
        candidates.length ||
      candidates.some(
        (candidate) =>
          candidate.advisory.context.requestedTokens !==
          requestScope.desiredContextTokens,
      )
    ) {
      return blocked(
        "llmfit.envelope.request-binding-invalid",
        "Every advisory must bind uniquely to the preserved request context.",
      );
    }
    return { kind: "ok", value: value as LlmfitAdvisoryOk };
  }
  if (
    !["blocked", "unsupported", "unavailable", "error"].includes(
      String(value.status),
    ) ||
    !nonEmpty(value.reasonCode) ||
    !nonEmpty(value.message) ||
    typeof value.providerInvoked !== "boolean" ||
    !Array.isArray(value.recoverableActions) ||
    !value.recoverableActions.every(nonEmpty) ||
    !Array.isArray(value.provenance) ||
    !value.provenance.every(validFailureProvenance) ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every(nonEmpty)
  ) {
    return blocked(
      "llmfit.envelope.invalid",
      "The M-B failure envelope is malformed.",
    );
  }
  if (
    ("missing" in value &&
      (!Array.isArray(value.missing) || !value.missing.every(nonEmpty))) ||
    ("unsupportedPath" in value && !nonEmpty(value.unsupportedPath)) ||
    ("rawSourceRecordRef" in value &&
      !(value.rawSourceRecordRef === null ||
        nonEmpty(value.rawSourceRecordRef)))
  ) {
    return blocked(
      "llmfit.envelope.invalid",
      "The M-B failure detail is malformed.",
    );
  }
  if (
    "candidates" in value ||
    "hardwareTargetId" in value ||
    "source" in value ||
    "requestScope" in value
  ) {
    return blocked(
      "llmfit.envelope.invalid",
      "A failure envelope cannot contain successful advisory fields.",
    );
  }
  if (
    (value.providerInvoked === true && value.provenance.length === 0) ||
    (value.providerInvoked === false && value.provenance.length !== 0)
  ) {
    return blocked(
      "llmfit.envelope.provenance-invalid",
      "Failure provenance must reflect whether the provider was invoked.",
    );
  }
  return { kind: "ok", value: value as LlmfitAdvisoryEnvelope };
}

export function bindLlmfitAdvisoryForMFFit(
  envelopeValue: unknown,
  bindingValue: unknown,
): LlmfitMappingResult<MFFitUpstreamAdvisoryInput> {
  const parsed = parseLlmfitAdvisoryEnvelope(envelopeValue);
  if (parsed.kind !== "ok" || parsed.value.status !== "ok") {
    return blocked(
      "llmfit.binding.advice-unavailable",
      "Only valid successful M-B advice can be bound for M-F.",
    );
  }
  if (
    !isRecord(bindingValue) ||
    !nonEmpty(bindingValue.advisoryId) ||
    !nonEmpty(bindingValue.candidateId) ||
    !nonEmpty(bindingValue.modelFamilyId) ||
    !nonEmpty(bindingValue.upstreamModelId) ||
    bindingValue.method !== "explicit-registry-crosswalk" ||
    !nonEmpty(bindingValue.sourceRevision)
  ) {
    return blocked(
      "llmfit.binding.invalid",
      "The explicit model-family crosswalk is incomplete.",
    );
  }
  const binding = bindingValue as LlmfitFamilyBinding;
  const candidate = parsed.value.candidates.find(
    (item) => item.advisoryId === binding.advisoryId,
  );
  if (!candidate || candidate.upstreamModel.id !== binding.upstreamModelId) {
    return blocked(
      "llmfit.binding.family-mismatch",
      "The explicit family binding does not match the selected upstream advisory.",
    );
  }
  if (
    candidate.mappingIssues.some(
      (issue) => issue.classification === "unsupported",
    )
  ) {
    return blocked(
      "llmfit.binding.unsupported-mapping",
      "An unsupported upstream distinction cannot enter M-F.",
    );
  }
  return blocked(
    "llmfit.binding.registry-crosswalk-unverified",
    "M-C does not yet provide a verified upstream-family crosswalk, so M-B advice cannot enter M-F.",
  );
}

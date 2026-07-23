import type {
  AdvisoryBackend,
  IndependentAdvisoryInput,
  MappingIssue,
  NormalizationFailure,
  NormalizationResult,
  NormalizationSuccess,
  NormalizedAdvisoryCandidate,
  RawAttribution,
  RawLlmfitFixture,
  RawLlmfitModelFit,
} from "./types";

export const PINNED_LLMFIT_VERSION = "1.1.6";
export const PINNED_LLMFIT_REVISION =
  "aaa2bc179cec214ccdc44501c853b98fba0b343b";

const GIB = 1024 ** 3;

function unavailable(
  requestId: string,
  reasonCode: string,
  message: string,
  rawAttribution: RawAttribution | null,
): NormalizationFailure {
  return {
    schemaVersion: 1,
    capability: "llmfit-advisory-normalization",
    requestId,
    classificationScope: "adopted-advisory-projection",
    classification: "unavailable",
    reasonCode,
    message,
    recoverableActions: ["Replay a valid fixture from the pinned llmfit build."],
    rawAttribution,
  };
}

function unsupported(
  requestId: string,
  reasonCode: string,
  message: string,
  rawAttribution: RawAttribution,
): NormalizationFailure {
  return {
    schemaVersion: 1,
    capability: "llmfit-advisory-normalization",
    requestId,
    classificationScope: "adopted-advisory-projection",
    classification: "unsupported",
    reasonCode,
    message,
    recoverableActions: [
      "Use a supported backend or retain this record for a later adapter revision.",
    ],
    rawAttribution,
  };
}

function snapshot(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

function attribution(fixture: RawLlmfitFixture): RawAttribution {
  return {
    source: { ...fixture.source },
    fixtureId: fixture.fixtureId,
    fixtureKind: fixture.fixtureKind,
    capturedAt: fixture.capturedAt,
    rawRecord: snapshot(fixture),
  };
}

function isRawFixture(value: unknown): value is RawLlmfitFixture {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (
    record.fixtureSchema !== "local-arcade.llmfit-raw-fixture.v1" ||
    typeof record.fixtureId !== "string" ||
    record.fixtureKind !== "synthetic-contract" ||
    typeof record.capturedAt !== "string"
  ) {
    return false;
  }
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(
      record.capturedAt,
    ) ||
    !Number.isFinite(Date.parse(record.capturedAt))
  ) {
    return false;
  }
  if (!record.source || typeof record.source !== "object") return false;
  const source = record.source as Record<string, unknown>;
  if (
    source.id !== "llmfit" ||
    typeof source.version !== "string" ||
    typeof source.revision !== "string"
  ) {
    return false;
  }
  if (!record.requestEcho || typeof record.requestEcho !== "object") return false;
  const requestEcho = record.requestEcho as Record<string, unknown>;
  const backends = new Set([
    "CUDA",
    "ROCm",
    "Metal",
    "Vulkan",
    "CPU ARM",
    "CPU x86",
    "SYCL",
    "Ascend",
  ]);
  if (
    !finiteNonNegative(requestEcho.totalRamGb) ||
    !(
      requestEcho.availableRamGb === null ||
      finiteNonNegative(requestEcho.availableRamGb)
    ) ||
    !(requestEcho.cpuName === null || typeof requestEcho.cpuName === "string") ||
    !(
      requestEcho.cpuCores === null ||
      (Number.isInteger(requestEcho.cpuCores) &&
        Number(requestEcho.cpuCores) >= 0)
    ) ||
    !backends.has(String(requestEcho.backend)) ||
    !(requestEcho.gpuName === null || typeof requestEcho.gpuName === "string") ||
    !(
      requestEcho.gpuVramGb === null ||
      finiteNonNegative(requestEcho.gpuVramGb)
    ) ||
    !Number.isInteger(requestEcho.gpuCount) ||
    Number(requestEcho.gpuCount) < 0 ||
    typeof requestEcho.unifiedMemory !== "boolean" ||
    !Number.isInteger(requestEcho.contextLimit) ||
    Number(requestEcho.contextLimit) <= 0 ||
    !(
      requestEcho.forcedRuntime === null ||
      typeof requestEcho.forcedRuntime === "string"
    ) ||
    !new Set(["coding", "writing", "extraction", "general", "other"]).has(
      String(requestEcho.taskFamily),
    ) ||
    !new Set(["interactive", "batch"]).has(
      String(requestEcho.interactionStyle),
    )
  ) {
    return false;
  }
  if (!record.result || typeof record.result !== "object") return false;
  const result = record.result as Record<string, unknown>;
  const errorKinds = new Set([
    "timeout",
    "upstream-unavailable",
    "invalid-override",
  ]);
  return (
    (result.kind === "ok" && Array.isArray(result.models)) ||
    (result.kind === "error" &&
      errorKinds.has(String(result.errorKind)) &&
      typeof result.message === "string")
  );
}

function validateInput(input: IndependentAdvisoryInput): string[] {
  const missing: string[] = [];
  if (!input.requestId) missing.push("requestId");
  if (
    !Number.isSafeInteger(input.hardware.totalRamBytes) ||
    input.hardware.totalRamBytes <= 0
  ) {
    missing.push("hardware.totalRamBytes");
  }
  if (
    input.hardware.availableRamBytes !== null &&
    (!Number.isSafeInteger(input.hardware.availableRamBytes) ||
      input.hardware.availableRamBytes < 0 ||
      input.hardware.availableRamBytes > input.hardware.totalRamBytes)
  ) {
    missing.push("hardware.availableRamBytes");
  }
  if (
    input.hardware.cpu.logicalCores !== null &&
    (!Number.isInteger(input.hardware.cpu.logicalCores) ||
      input.hardware.cpu.logicalCores <= 0)
  ) {
    missing.push("hardware.cpu.logicalCores");
  }
  if (!Number.isInteger(input.task.contextTokens) || input.task.contextTokens <= 0) {
    missing.push("task.contextTokens");
  }
  for (const [index, accelerator] of input.hardware.accelerators.entries()) {
    if (!accelerator.displayName) {
      missing.push(`hardware.accelerators[${index}].displayName`);
    }
    if (!Number.isInteger(accelerator.count) || accelerator.count <= 0) {
      missing.push(`hardware.accelerators[${index}].count`);
    }
    if (
      accelerator.deviceMemoryBytes !== null &&
      (!Number.isSafeInteger(accelerator.deviceMemoryBytes) ||
        accelerator.deviceMemoryBytes <= 0)
    ) {
      missing.push(`hardware.accelerators[${index}].deviceMemoryBytes`);
    }
  }
  return missing;
}

function expectedBackend(
  input: IndependentAdvisoryInput,
): AdvisoryBackend {
  return input.hardware.accelerators[0]?.backend ?? "cpu";
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-9;
}

function hardwareEchoMatches(
  input: IndependentAdvisoryInput,
  fixture: RawLlmfitFixture,
): boolean {
  const echo = fixture.requestEcho;
  const accelerator = input.hardware.accelerators[0] ?? null;
  if (input.hardware.accelerators.length > 1) return false;
  if (!nearlyEqual(input.hardware.totalRamBytes / GIB, echo.totalRamGb)) {
    return false;
  }
  if (
    (input.hardware.availableRamBytes === null) !==
      (echo.availableRamGb === null) ||
    (input.hardware.availableRamBytes !== null &&
      echo.availableRamGb !== null &&
      !nearlyEqual(input.hardware.availableRamBytes / GIB, echo.availableRamGb))
  ) {
    return false;
  }
  if (
    input.hardware.cpu.displayName !== echo.cpuName ||
    input.hardware.cpu.logicalCores !== echo.cpuCores
  ) {
    return false;
  }
  if (accelerator === null) {
    return (
      echo.gpuName === null &&
      echo.gpuVramGb === null &&
      echo.gpuCount === 0 &&
      (input.hardware.unifiedMemory === null ||
        input.hardware.unifiedMemory === echo.unifiedMemory)
    );
  }
  return (
    accelerator.displayName === echo.gpuName &&
    accelerator.count === echo.gpuCount &&
    (accelerator.deviceMemoryBytes === null
      ? echo.gpuVramGb === null
      : echo.gpuVramGb !== null &&
        nearlyEqual(accelerator.deviceMemoryBytes / GIB, echo.gpuVramGb)) &&
    (input.hardware.unifiedMemory === null ||
      input.hardware.unifiedMemory === echo.unifiedMemory)
  );
}

function bytesFromGib(value: number): number | null {
  const bytes = Math.round(value * GIB);
  return Number.isSafeInteger(bytes) ? bytes : null;
}

function normalizeBackend(raw: RawLlmfitFixture["requestEcho"]["backend"]):
  | { kind: "exact"; value: AdvisoryBackend }
  | { kind: "lossy"; value: "cpu"; detail: string }
  | { kind: "unsupported"; detail: string } {
  switch (raw) {
    case "CUDA":
      return { kind: "exact", value: "cuda" };
    case "ROCm":
      return { kind: "exact", value: "rocm" };
    case "Metal":
      return { kind: "exact", value: "metal" };
    case "Vulkan":
      return { kind: "exact", value: "vulkan" };
    case "CPU ARM":
    case "CPU x86":
      return {
        kind: "lossy",
        value: "cpu",
        detail: `${raw} collapses to the approved cpu backend enum.`,
      };
    case "SYCL":
    case "Ascend":
      return {
        kind: "unsupported",
        detail: `${raw} has no approved first-slice backend representation.`,
      };
  }
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function hasFiniteScoreComponents(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return ["quality", "speed", "fit", "context"].every(
    (key) => typeof record[key] === "number" && Number.isFinite(record[key]),
  );
}

function isModelFit(value: unknown): value is RawLlmfitModelFit {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const model = record.model as Record<string, unknown> | undefined;
  const fitLevels = new Set(["Perfect", "Good", "Marginal", "TooTight"]);
  const runModes = new Set([
    "Gpu",
    "MoeOffload",
    "CpuOffload",
    "CpuOnly",
    "TensorParallel",
  ]);
  return Boolean(
    model &&
      typeof model.name === "string" &&
      typeof model.provider === "string" &&
      finiteNonNegative(model.parameters) &&
      Array.isArray(model.capabilities) &&
      model.capabilities.every((item) => typeof item === "string") &&
      fitLevels.has(String(record.fitLevel)) &&
      runModes.has(String(record.runMode)) &&
      finiteNonNegative(record.memoryRequiredGb) &&
      bytesFromGib(record.memoryRequiredGb) !== null &&
      finiteNonNegative(record.memoryAvailableGb) &&
      bytesFromGib(record.memoryAvailableGb) !== null &&
      finiteNonNegative(record.utilizationPct) &&
      Number(record.utilizationPct) <= 100 &&
      Array.isArray(record.notes) &&
      record.notes.every((item) => typeof item === "string") &&
      finiteNonNegative(record.effectiveContextLength) &&
      Number.isInteger(record.effectiveContextLength) &&
      finiteNonNegative(record.usableContext) &&
      Number.isInteger(record.usableContext) &&
      (record.estimatedTps === null ||
        finiteNonNegative(record.estimatedTps)) &&
      (record.measuredTps === null ||
        finiteNonNegative(record.measuredTps)) &&
      (record.bestQuant === null || typeof record.bestQuant === "string") &&
      (record.runtime === null || typeof record.runtime === "string") &&
      (record.estimateBasis === null ||
        (typeof record.estimateBasis === "object" &&
          !Array.isArray(record.estimateBasis))) &&
      finiteNonNegative(record.score) &&
      hasFiniteScoreComponents(record.scoreComponents)
  );
}

function normalizeFit(raw: RawLlmfitModelFit["fitLevel"]): {
  value: NormalizedAdvisoryCandidate["advisory"]["fit"];
  issue: MappingIssue | null;
} {
  switch (raw) {
    case "Perfect":
      return {
        value: "good",
        issue: {
          path: "fitLevel",
          classification: "lossy",
          reasonCode: "llmfit.fit-level.perfect-collapsed",
          message:
            "The approved fit vocabulary has no Perfect tier; the raw tier remains attributed.",
        },
      };
    case "Good":
      return { value: "good", issue: null };
    case "Marginal":
      return { value: "tight", issue: null };
    case "TooTight":
      return { value: "does-not-fit", issue: null };
  }
}

function normalizeRunMode(
  raw: RawLlmfitModelFit["runMode"],
): {
  value: NormalizedAdvisoryCandidate["advisory"]["runPath"];
  issue: MappingIssue | null;
} {
  switch (raw) {
    case "Gpu":
      return { value: "gpu", issue: null };
    case "TensorParallel":
      return {
        value: "gpu",
        issue: {
          path: "runMode",
          classification: "lossy",
          reasonCode: "llmfit.run-mode.tensor-parallel-collapsed",
          message:
            "The approved first-slice run path preserves GPU execution but not tensor-parallel topology.",
        },
      };
    case "CpuOffload":
      return { value: "cpu-offload", issue: null };
    case "CpuOnly":
      return { value: "cpu", issue: null };
    case "MoeOffload":
      return {
        value: "cpu-offload",
        issue: {
          path: "runMode",
          classification: "lossy",
          reasonCode: "llmfit.run-mode.moe-detail-not-representable",
          message:
            "The approved first-slice run path preserves offload but not llmfit's MoE-specific offload distinction.",
        },
      };
  }
}

function normalizeModel(
  fixture: RawLlmfitFixture,
  input: IndependentAdvisoryInput,
  raw: RawLlmfitModelFit,
  backendIssue: MappingIssue | null,
): NormalizedAdvisoryCandidate {
  const runMode = normalizeRunMode(raw.runMode);
  const fit = normalizeFit(raw.fitLevel);
  const mappingIssues = [backendIssue, fit.issue, runMode.issue].filter(
    (issue): issue is MappingIssue => issue !== null,
  );
  return {
    modelFamilyCandidate: {
      upstreamName: raw.model.name,
      displayName: raw.model.name,
      provider: raw.model.provider,
      parameters: raw.model.parameters,
      upstreamReportedCapabilities: [...raw.model.capabilities],
    },
    advisory: {
      fit: fit.value,
      runPath: runMode.value,
      memoryRequiredBytes: bytesFromGib(raw.memoryRequiredGb)!,
      memoryAvailableBytes: bytesFromGib(raw.memoryAvailableGb)!,
      utilization: raw.utilizationPct / 100,
      context: {
        requestedTokens: input.task.contextTokens,
        effectiveTokens: raw.effectiveContextLength,
        usableTokens: raw.usableContext,
      },
      performance: {
        estimatedGenerationTokensPerSecond: raw.estimatedTps,
        upstreamReportedGenerationTokensPerSecond: raw.measuredTps,
        estimateBasis:
          raw.estimateBasis === null
            ? null
            : (snapshot(raw.estimateBasis) as Record<string, unknown>),
      },
      upstreamRuntime: raw.runtime,
      suggestedQuantization: raw.bestQuant,
      notes: [...raw.notes],
    },
    mappingIssues,
    ignoredUpstreamFields: [
      {
        path: "score",
        reasonCode: "llmfit.ranking.composite-not-adopted",
        message:
          "The upstream composite score is retained only in raw attribution and is not Local Arcade ranking evidence.",
      },
      {
        path: "scoreComponents",
        reasonCode: "llmfit.ranking.components-not-adopted",
        message:
          "Upstream quality/speed/fit/context score components are retained only in raw attribution.",
      },
    ],
    rawAttribution: {
      source: { ...fixture.source },
      fixtureId: fixture.fixtureId,
      fixtureKind: fixture.fixtureKind,
      capturedAt: fixture.capturedAt,
      rawRecord: snapshot(raw),
    },
  };
}

export function normalizeRawLlmfitFixture(
  input: IndependentAdvisoryInput,
  rawFixture: unknown,
): NormalizationResult {
  const inputProblems = validateInput(input);
  if (inputProblems.length > 0) {
    return unavailable(
      input.requestId,
      "llmfit.input.invalid",
      `Independent input is invalid: ${inputProblems.join(", ")}.`,
      null,
    );
  }

  if (!isRawFixture(rawFixture)) {
    return unavailable(
      input.requestId,
      "llmfit.fixture.schema-mismatch",
      "The raw fixture does not match the replay fixture envelope.",
      null,
    );
  }

  const rawAttribution = attribution(rawFixture);
  if (
    rawFixture.source.version !== PINNED_LLMFIT_VERSION ||
    rawFixture.source.revision !== PINNED_LLMFIT_REVISION
  ) {
    return unavailable(
      input.requestId,
      "llmfit.source.version-mismatch",
      `Expected llmfit ${PINNED_LLMFIT_VERSION} at ${PINNED_LLMFIT_REVISION}.`,
      rawAttribution,
    );
  }

  if (rawFixture.result.kind === "error") {
    return unavailable(
      input.requestId,
      `llmfit.upstream.${rawFixture.result.errorKind}`,
      rawFixture.result.message,
      rawAttribution,
    );
  }

  if (input.hardware.unifiedMemory === null) {
    return unsupported(
      input.requestId,
      "llmfit.request.unified-memory-unknown",
      "Unknown unified-memory state cannot be bound exactly to llmfit's required boolean echo.",
      rawAttribution,
    );
  }

  const backend = normalizeBackend(rawFixture.requestEcho.backend);
  if (backend.kind === "unsupported") {
    return unsupported(
      input.requestId,
      "llmfit.backend.unsupported",
      backend.detail,
      rawAttribution,
    );
  }

  if (backend.value !== expectedBackend(input)) {
    return unsupported(
      input.requestId,
      "llmfit.request.hardware-mismatch",
      `Fixture backend ${backend.value} does not match independent input backend ${expectedBackend(input)}.`,
      rawAttribution,
    );
  }

  if (!hardwareEchoMatches(input, rawFixture)) {
    return unsupported(
      input.requestId,
      "llmfit.request.hardware-mismatch",
      "The replayed hardware facts do not match the independent hardware input.",
      rawAttribution,
    );
  }

  if (
    rawFixture.requestEcho.contextLimit !== input.task.contextTokens ||
    rawFixture.requestEcho.forcedRuntime !== input.constraints.forcedRuntime ||
    rawFixture.requestEcho.taskFamily !== input.task.family ||
    rawFixture.requestEcho.interactionStyle !== input.task.interactionStyle
  ) {
    return unsupported(
      input.requestId,
      "llmfit.request.constraints-mismatch",
      "The replayed task, interaction style, context, or runtime constraint does not match the independent request.",
      rawAttribution,
    );
  }

  if (!rawFixture.result.models.every(isModelFit)) {
    return unavailable(
      input.requestId,
      "llmfit.fixture.model-schema-mismatch",
      "At least one raw ModelFit record is malformed.",
      rawAttribution,
    );
  }

  const backendIssue: MappingIssue | null =
    backend.kind === "lossy"
      ? {
          path: "requestEcho.backend",
          classification: "lossy",
          reasonCode: "llmfit.backend.cpu-architecture-collapsed",
          message: backend.detail,
        }
      : null;
  const candidates = rawFixture.result.models.map((model) =>
    normalizeModel(rawFixture, input, model, backendIssue),
  );
  const classification = candidates.some(
    (candidate) => candidate.mappingIssues.length > 0,
  )
    ? "lossy"
    : "exact";

  const result: NormalizationSuccess = {
    schemaVersion: 1,
    capability: "llmfit-advisory-normalization",
    requestId: input.requestId,
    classificationScope: "adopted-advisory-projection",
    classification,
    candidates,
    warnings: [
      "Classification applies only to the adopted advisory projection, not the complete upstream record.",
      "This replay is an attributed upstream advisory, not exact artifact admission.",
      "llmfit composite score and score components remain in raw attribution and are not Local Arcade ranking evidence.",
      ...(candidates.length === 0
        ? ["The pinned upstream fixture returned no advisory candidates."]
        : []),
    ],
    rawAttribution,
  };
  return result;
}

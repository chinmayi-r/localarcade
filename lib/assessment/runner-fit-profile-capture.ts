/**
 * U27 runner-owned fit-profile capture receipt.
 *
 * This is the only path that may turn a local `llama-fit-params` observation
 * into an M-F profile proposal.  It is intentionally a receipt, not a claim
 * that a profile is reviewed, representative, or safe to recommend.
 */
import type {
  CompatibilityAdmissionReceipt,
  ExactConfigurationCandidate,
  HardwareTarget,
} from "../contracts";
import { validateContract } from "../contracts";
import { recordContentSha256 } from "./record-digest";

export const RUNNER_FIT_PROFILE_CAPTURE_CONTRACT =
  "runner-fit-profile-capture" as const;
export const RUNNER_FIT_PROFILE_CAPTURE_SCHEMA_VERSION = 1 as const;
export const RUNNER_FIT_PROFILE_CAPTURE_PROTOCOL =
  "llama-fit-params-memory-breakdown-v1" as const;

export type RunnerFitProfileCapturePool = {
  modelBytes: number;
  contextBytes: number;
  computeBytes: number;
};

export type RunnerFitProfileCaptureAttempt = {
  attemptId: string;
  observedAt: string;
  rawSourceRecordRef: string;
  status: "completed";
  device: RunnerFitProfileCapturePool;
  host: RunnerFitProfileCapturePool;
};

export type RunnerFitProfileCaptureV1 = {
  schemaVersion: typeof RUNNER_FIT_PROFILE_CAPTURE_SCHEMA_VERSION;
  contract: typeof RUNNER_FIT_PROFILE_CAPTURE_CONTRACT;
  captureId: string;
  captureVersion: string;
  capturedAt: string;
  contentHash: string;
  consent: {
    action: "capture-fit-profile";
    acknowledgedAt: string;
    localProcessExecutionAcknowledged: true;
    grantsServingAuthorization: false;
    grantsRecommendationAuthorization: false;
  };
  candidate: ExactConfigurationCandidate;
  compatibilityReceipt: CompatibilityAdmissionReceipt;
  hardwareTarget: HardwareTarget;
  bindings: {
    candidateContentSha256: string;
    compatibilityReceiptContentSha256: string;
    hardwareTargetContentSha256: string;
    artifactSha256: string;
    selectedArtifactSha256: string;
  };
  artifact: {
    canonicalPath: string;
    sha256: string;
    bytes: number;
  };
  tool: {
    id: "llama-fit-params";
    version: string;
    executableSha256: string;
    probeProtocolId: "llama-cpp-version-v1";
  };
  command: {
    protocolId: typeof RUNNER_FIT_PROFILE_CAPTURE_PROTOCOL;
    argvTemplate: string[];
  };
  runPath: "gpu";
  contexts: Array<{
    contextTokens: number;
    attempts: RunnerFitProfileCaptureAttempt[];
  }>;
};

export type TrustedCaptureValidation =
  | { kind: "ok"; value: RunnerFitProfileCaptureV1 }
  | {
      kind: "blocked";
      reasonCode: string;
      message: string;
      issues: string[];
    };

/**
 * Validates the full runner receipt before it can cross into the existing raw
 * collection machinery. The receipt is cloned on success so a caller cannot
 * mutate the admitted object after its digest was checked.
 */
export function validateRunnerFitProfileCapture(
  value: unknown,
): TrustedCaptureValidation {
  const issues: string[] = [];
  if (!isRecord(value)) return blocked(["capture"]);
  exactKeys(value, [
    "schemaVersion", "contract", "captureId", "captureVersion", "capturedAt",
    "contentHash", "consent", "candidate", "compatibilityReceipt",
    "hardwareTarget", "bindings", "artifact", "tool", "command", "runPath",
    "contexts",
  ], "capture", issues);
  if (value.schemaVersion !== RUNNER_FIT_PROFILE_CAPTURE_SCHEMA_VERSION) {
    issues.push("schemaVersion");
  }
  if (value.contract !== RUNNER_FIT_PROFILE_CAPTURE_CONTRACT) {
    issues.push("contract");
  }
  for (const key of ["captureId", "captureVersion"] as const) {
    if (!nonEmpty(value[key])) issues.push(key);
  }
  if (!validTimestamp(value.capturedAt)) issues.push("capturedAt");
  if (!sha256(value.contentHash)) issues.push("contentHash");
  validateConsent(value.consent, issues);
  validateProducer("exact-configuration-candidate", value.candidate, issues);
  validateProducer(
    "compatibility-admission-receipt",
    value.compatibilityReceipt,
    issues,
  );
  validateProducer("hardware-target", value.hardwareTarget, issues);
  validateBindings(value.bindings, issues);
  validateArtifact(value.artifact, issues);
  validateTool(value.tool, issues);
  validateCommand(value.command, issues);
  validateContexts(value.contexts, issues);
  if (value.runPath !== "gpu") issues.push("runPath");
  if (issues.length > 0) return blocked(issues);

  const capture = value as unknown as RunnerFitProfileCaptureV1;
  const snapshot = structuredClone(capture) as Record<string, unknown>;
  delete snapshot.contentHash;
  if (recordContentSha256(snapshot) !== capture.contentHash) {
    issues.push("contentHash");
  }
  validateCrossBindings(capture, issues);
  return issues.length === 0
    ? { kind: "ok", value: structuredClone(capture) }
    : blocked(issues);
}

function validateConsent(value: unknown, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push("consent");
    return;
  }
  exactKeys(value, [
    "action", "acknowledgedAt", "localProcessExecutionAcknowledged",
    "grantsServingAuthorization", "grantsRecommendationAuthorization",
  ], "consent", issues);
  if (value.action !== "capture-fit-profile") issues.push("consent.action");
  if (!validTimestamp(value.acknowledgedAt)) issues.push("consent.acknowledgedAt");
  if (value.localProcessExecutionAcknowledged !== true) {
    issues.push("consent.localProcessExecutionAcknowledged");
  }
  if (value.grantsServingAuthorization !== false) {
    issues.push("consent.grantsServingAuthorization");
  }
  if (value.grantsRecommendationAuthorization !== false) {
    issues.push("consent.grantsRecommendationAuthorization");
  }
}

function validateProducer(
  contract:
    | "exact-configuration-candidate"
    | "compatibility-admission-receipt"
    | "hardware-target",
  data: unknown,
  issues: string[],
): void {
  const result = validateContract({
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
  if (!result.ok) issues.push(`${contract}: ${result.errors.join(" ")}`);
}

function validateBindings(value: unknown, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push("bindings");
    return;
  }
  exactKeys(value, [
    "candidateContentSha256", "compatibilityReceiptContentSha256",
    "hardwareTargetContentSha256", "artifactSha256", "selectedArtifactSha256",
  ], "bindings", issues);
  for (const key of [
    "candidateContentSha256", "compatibilityReceiptContentSha256",
    "hardwareTargetContentSha256", "artifactSha256", "selectedArtifactSha256",
  ] as const) {
    if (!sha256(value[key])) issues.push(`bindings.${key}`);
  }
}

function validateArtifact(value: unknown, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push("artifact");
    return;
  }
  exactKeys(value, ["canonicalPath", "sha256", "bytes"], "artifact", issues);
  if (!nonEmpty(value.canonicalPath)) issues.push("artifact.canonicalPath");
  if (!sha256(value.sha256)) issues.push("artifact.sha256");
  if (!positiveInteger(value.bytes)) issues.push("artifact.bytes");
}

function validateTool(value: unknown, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push("tool");
    return;
  }
  exactKeys(value, ["id", "version", "executableSha256", "probeProtocolId"], "tool", issues);
  if (value.id !== "llama-fit-params") issues.push("tool.id");
  if (!nonEmpty(value.version)) issues.push("tool.version");
  if (!sha256(value.executableSha256)) issues.push("tool.executableSha256");
  if (value.probeProtocolId !== "llama-cpp-version-v1") {
    issues.push("tool.probeProtocolId");
  }
}

function validateCommand(value: unknown, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push("command");
    return;
  }
  exactKeys(value, ["protocolId", "argvTemplate"], "command", issues);
  if (value.protocolId !== RUNNER_FIT_PROFILE_CAPTURE_PROTOCOL) {
    issues.push("command.protocolId");
  }
  if (!Array.isArray(value.argvTemplate) || value.argvTemplate.length === 0
    || value.argvTemplate.some((part) => !nonEmpty(part))) {
    issues.push("command.argvTemplate");
  } else {
    const contextIndex = value.argvTemplate.indexOf("{contextTokens}");
    if (contextIndex < 1 || value.argvTemplate[contextIndex - 1] !== "-c"
      || value.argvTemplate.filter((part) => part === "{contextTokens}").length !== 1) {
      issues.push("command.argvTemplate.contextTokens");
    }
  }
}

function validateContexts(value: unknown, issues: string[]): void {
  if (!Array.isArray(value) || value.length !== 2) {
    issues.push("contexts");
    return;
  }
  const contexts = new Set<number>();
  const attempts = new Set<string>();
  for (const [index, context] of value.entries()) {
    const path = `contexts.${index}`;
    if (!isRecord(context)) {
      issues.push(path);
      continue;
    }
    exactKeys(context, ["contextTokens", "attempts"], path, issues);
    if (!positiveInteger(context.contextTokens)
      || contexts.has(Number(context.contextTokens))) {
      issues.push(`${path}.contextTokens`);
    }
    contexts.add(Number(context.contextTokens));
    if (!Array.isArray(context.attempts) || context.attempts.length !== 3) {
      issues.push(`${path}.attempts`);
      continue;
    }
    for (const [attemptIndex, attempt] of context.attempts.entries()) {
      const attemptPath = `${path}.attempts.${attemptIndex}`;
      if (!isRecord(attempt)) {
        issues.push(attemptPath);
        continue;
      }
      exactKeys(attempt, [
        "attemptId", "observedAt", "rawSourceRecordRef", "status", "device", "host",
      ], attemptPath, issues);
      if (!nonEmpty(attempt.attemptId) || attempts.has(attempt.attemptId)) {
        issues.push(`${attemptPath}.attemptId`);
      }
      attempts.add(String(attempt.attemptId));
      if (!validTimestamp(attempt.observedAt)) issues.push(`${attemptPath}.observedAt`);
      if (!nonEmpty(attempt.rawSourceRecordRef)) issues.push(`${attemptPath}.rawSourceRecordRef`);
      if (attempt.status !== "completed") issues.push(`${attemptPath}.status`);
      validatePool(attempt.device, `${attemptPath}.device`, issues);
      validatePool(attempt.host, `${attemptPath}.host`, issues);
    }
  }
}

function validatePool(value: unknown, path: string, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push(path);
    return;
  }
  exactKeys(value, ["modelBytes", "contextBytes", "computeBytes"], path, issues);
  for (const key of ["modelBytes", "contextBytes", "computeBytes"] as const) {
    if (!nonNegativeInteger(value[key])) issues.push(`${path}.${key}`);
  }
}

function validateCrossBindings(
  capture: RunnerFitProfileCaptureV1,
  issues: string[],
): void {
  const candidate = capture.candidate;
  const receipt = capture.compatibilityReceipt;
  const hardware = capture.hardwareTarget;
  const bindings = capture.bindings;
  if (bindings.candidateContentSha256 !== recordContentSha256(candidate)) {
    issues.push("bindings.candidateContentSha256");
  }
  if (bindings.compatibilityReceiptContentSha256 !== recordContentSha256(receipt)) {
    issues.push("bindings.compatibilityReceiptContentSha256");
  }
  if (bindings.hardwareTargetContentSha256 !== recordContentSha256(hardware)) {
    issues.push("bindings.hardwareTargetContentSha256");
  }
  if (bindings.artifactSha256 !== candidate.artifact.sha256
    || bindings.selectedArtifactSha256 !== capture.artifact.sha256
    || capture.artifact.sha256 !== candidate.artifact.sha256
    || capture.artifact.bytes !== candidate.artifact.bytes) {
    issues.push("bindings.artifact");
  }
  if (receipt.candidateId !== candidate.candidateId
    || receipt.artifactId !== candidate.artifact.artifactId
    || receipt.artifactSha256 !== candidate.artifact.sha256
    || receipt.runtimeConfigurationId !== candidate.runtime.runtimeConfigurationId) {
    issues.push("compatibilityReceipt.binding");
  }
  const accelerator = hardware.accelerators[0];
  if (hardware.memory.unified !== false
    || hardware.accelerators.length !== 1
    || accelerator?.acceleratorId === null
    || accelerator?.deviceMemoryBytes === null
    || accelerator?.backend !== candidate.runtime.backend
    || candidate.runtime.gpuLayers !== "all") {
    issues.push("hardwareTarget.runPath");
  }
  const contextValues = new Set(capture.contexts.map((item) => item.contextTokens));
  if (!contextValues.has(candidate.runtime.contextTokens)) {
    issues.push("contexts.runtimeContext");
  }
  if (
    capture.contexts[0]?.contextTokens !== candidate.runtime.contextTokens
    || capture.contexts[1]?.contextTokens
      !== candidate.runtime.contextTokens * 4
  ) {
    issues.push("contexts.fixedProtocol");
  }
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  path: string,
  issues: string[],
): void {
  for (const key of expected) {
    if (!Object.hasOwn(value, key)) issues.push(`${path}.${key}`);
  }
  for (const key of Object.keys(value)) {
    if (!expected.includes(key)) issues.push(`${path}.${key}`);
  }
}

function blocked(issues: string[]): TrustedCaptureValidation {
  return {
    kind: "blocked",
    reasonCode: "fit-profile-capture.invalid",
    message: "The runner fit-profile capture is incomplete, mutated, or outside the exact supported scope.",
    issues: [...new Set(issues)].sort(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveInteger(value: unknown): boolean {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function nonNegativeInteger(value: unknown): boolean {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function sha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function validTimestamp(value: unknown): value is string {
  return nonEmpty(value)
    && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString() === value;
}

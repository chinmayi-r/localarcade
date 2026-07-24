/**
 * Browser-safe M-P admission for the U27 capture receipt.
 *
 * The shared M-F validator remains the producer/domain authority. This
 * adapter deliberately does not import Node-only schema/hash code into the
 * desktop browser bundle: it verifies the complete receipt digest and every
 * display-critical binding before the receipt can be rendered. It grants no
 * recommendation or serving authority.
 */
import { recordContentSha256 } from "../../lib/assessment/record-digest";

export type FitProfileCaptureReceipt = {
  schemaVersion: 1;
  contract: "runner-fit-profile-capture";
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
  candidate: Record<string, unknown>;
  compatibilityReceipt: Record<string, unknown>;
  hardwareTarget: Record<string, unknown>;
  bindings: {
    candidateContentSha256: string;
    compatibilityReceiptContentSha256: string;
    hardwareTargetContentSha256: string;
    artifactSha256: string;
    selectedArtifactSha256: string;
  };
  artifact: { canonicalPath: string; sha256: string; bytes: number };
  tool: {
    id: "llama-fit-params";
    version: string;
    executableSha256: string;
    probeProtocolId: "llama-cpp-version-v1";
  };
  command: {
    protocolId: "llama-fit-params-memory-breakdown-v1";
    argvTemplate: string[];
  };
  runPath: "gpu";
  contexts: Array<{
    contextTokens: number;
    attempts: Array<{
      attemptId: string;
      observedAt: string;
      rawSourceRecordRef: string;
      status: "completed";
      device: MemoryPool;
      host: MemoryPool;
    }>;
  }>;
};

type MemoryPool = {
  modelBytes: number;
  contextBytes: number;
  computeBytes: number;
};

export type FitProfileCapturePresentationValidation =
  | { kind: "ok"; value: FitProfileCaptureReceipt }
  | { kind: "blocked"; issues: string[] };

export function validateFitProfileCaptureForPresentation(
  value: unknown,
): FitProfileCapturePresentationValidation {
  const issues: string[] = [];
  if (!isRecord(value)) return blocked(["capture"]);
  exactKeys(value, [
    "schemaVersion", "contract", "captureId", "captureVersion", "capturedAt",
    "contentHash", "consent", "candidate", "compatibilityReceipt",
    "hardwareTarget", "bindings", "artifact", "tool", "command", "runPath",
    "contexts",
  ], "capture", issues);
  if (value.schemaVersion !== 1) issues.push("schemaVersion");
  if (value.contract !== "runner-fit-profile-capture") issues.push("contract");
  if (!nonEmpty(value.captureId)) issues.push("captureId");
  if (!nonEmpty(value.captureVersion)) issues.push("captureVersion");
  if (!timestamp(value.capturedAt)) issues.push("capturedAt");
  if (!sha256(value.contentHash)) issues.push("contentHash");
  validateConsent(value.consent, issues);
  const candidate = validateCandidate(value.candidate, issues);
  const receipt = validateReceipt(value.compatibilityReceipt, issues);
  const hardware = validateHardware(value.hardwareTarget, issues);
  validateBindings(value.bindings, issues);
  validateArtifact(value.artifact, issues);
  validateTool(value.tool, issues);
  validateCommand(value.command, issues);
  validateContexts(value.contexts, issues);
  if (value.runPath !== "gpu") issues.push("runPath");
  if (issues.length > 0 || !candidate || !receipt || !hardware) {
    return blocked(issues);
  }

  const snapshot = structuredClone(value);
  delete snapshot.contentHash;
  if (recordContentSha256(snapshot) !== value.contentHash) {
    issues.push("contentHash");
  }
  validateBindingsAgainstContent(value, candidate, receipt, hardware, issues);
  return issues.length === 0
    ? { kind: "ok", value: structuredClone(value) as FitProfileCaptureReceipt }
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
  if (!timestamp(value.acknowledgedAt)) issues.push("consent.acknowledgedAt");
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

function validateCandidate(
  value: unknown,
  issues: string[],
): Record<string, unknown> | null {
  if (!isRecord(value)) {
    issues.push("candidate");
    return null;
  }
  const artifact = record(value.artifact, "candidate.artifact", issues);
  const runtime = record(value.runtime, "candidate.runtime", issues);
  if (!nonEmpty(value.candidateId)) issues.push("candidate.candidateId");
  if (!artifact || !runtime) return null;
  if (!nonEmpty(artifact.artifactId) || !sha256(artifact.sha256)
    || !positiveInteger(artifact.bytes)) {
    issues.push("candidate.artifact");
  }
  if (!nonEmpty(runtime.runtimeConfigurationId)
    || !nonEmpty(runtime.product)
    || !nonEmpty(runtime.engine)
    || !nonEmpty(runtime.engineBuild)
    || !nonEmpty(runtime.backend)
    || !positiveInteger(runtime.contextTokens)
    || runtime.gpuLayers !== "all") {
    issues.push("candidate.runtime");
  }
  return value;
}

function validateReceipt(
  value: unknown,
  issues: string[],
): Record<string, unknown> | null {
  if (!isRecord(value)) {
    issues.push("compatibilityReceipt");
    return null;
  }
  const target = record(value.target, "compatibilityReceipt.target", issues);
  for (const key of [
    "candidateId", "artifactId", "artifactSha256", "runtimeConfigurationId",
  ]) if (!nonEmpty(value[key])) issues.push(`compatibilityReceipt.${key}`);
  if (!sha256(value.artifactSha256)) issues.push("compatibilityReceipt.artifactSha256");
  if (!target) return null;
  for (const key of ["product", "engine", "engineBuild", "backend"] as const) {
    if (!nonEmpty(target[key])) issues.push(`compatibilityReceipt.target.${key}`);
  }
  return value;
}

function validateHardware(
  value: unknown,
  issues: string[],
): Record<string, unknown> | null {
  if (!isRecord(value)) {
    issues.push("hardwareTarget");
    return null;
  }
  const memory = record(value.memory, "hardwareTarget.memory", issues);
  if (!nonEmpty(value.hardwareTargetId) || !memory || memory.unified !== false) {
    issues.push("hardwareTarget");
  }
  const accelerators = value.accelerators;
  if (!Array.isArray(accelerators) || accelerators.length !== 1
    || !isRecord(accelerators[0])) {
    issues.push("hardwareTarget.accelerators");
    return null;
  }
  const accelerator = accelerators[0];
  if (!nonEmpty(accelerator.acceleratorId)
    || !nonEmpty(accelerator.backend)
    || !positiveInteger(accelerator.deviceMemoryBytes)) {
    issues.push("hardwareTarget.accelerators.0");
  }
  return value;
}

function validateBindings(value: unknown, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push("bindings");
    return;
  }
  const keys = [
    "candidateContentSha256", "compatibilityReceiptContentSha256",
    "hardwareTargetContentSha256", "artifactSha256", "selectedArtifactSha256",
  ] as const;
  exactKeys(value, keys, "bindings", issues);
  for (const key of keys) if (!sha256(value[key])) issues.push(`bindings.${key}`);
}

function validateArtifact(value: unknown, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push("artifact");
    return;
  }
  exactKeys(value, ["canonicalPath", "sha256", "bytes"], "artifact", issues);
  if (!nonEmpty(value.canonicalPath) || !sha256(value.sha256)
    || !positiveInteger(value.bytes)) issues.push("artifact");
}

function validateTool(value: unknown, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push("tool");
    return;
  }
  exactKeys(value, ["id", "version", "executableSha256", "probeProtocolId"], "tool", issues);
  if (value.id !== "llama-fit-params" || !nonEmpty(value.version)
    || !sha256(value.executableSha256)
    || value.probeProtocolId !== "llama-cpp-version-v1") issues.push("tool");
}

function validateCommand(value: unknown, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push("command");
    return;
  }
  exactKeys(value, ["protocolId", "argvTemplate"], "command", issues);
  if (value.protocolId !== "llama-fit-params-memory-breakdown-v1"
    || !Array.isArray(value.argvTemplate)
    || value.argvTemplate.length === 0
    || value.argvTemplate.some((item) => !nonEmpty(item))) {
    issues.push("command");
    return;
  }
  const contexts = value.argvTemplate.filter((item) => item === "{contextTokens}");
  if (contexts.length !== 1
    || value.argvTemplate[value.argvTemplate.indexOf("{contextTokens}") - 1] !== "-c") {
    issues.push("command.argvTemplate");
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
    if (!positiveInteger(context.contextTokens) || contexts.has(context.contextTokens)) {
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
      if (!timestamp(attempt.observedAt) || !nonEmpty(attempt.rawSourceRecordRef)
        || attempt.status !== "completed") issues.push(attemptPath);
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

function validateBindingsAgainstContent(
  capture: Record<string, unknown>,
  candidate: Record<string, unknown>,
  receipt: Record<string, unknown>,
  hardware: Record<string, unknown>,
  issues: string[],
): void {
  const bindings = capture.bindings as Record<string, unknown>;
  const artifact = capture.artifact as Record<string, unknown>;
  const candidateArtifact = candidate.artifact as Record<string, unknown>;
  const candidateRuntime = candidate.runtime as Record<string, unknown>;
  const receiptTarget = receipt.target as Record<string, unknown>;
  const accelerators = hardware.accelerators as Array<Record<string, unknown>>;
  const contexts = capture.contexts as Array<Record<string, unknown>>;
  if (bindings.candidateContentSha256 !== recordContentSha256(candidate)) {
    issues.push("bindings.candidateContentSha256");
  }
  if (bindings.compatibilityReceiptContentSha256 !== recordContentSha256(receipt)) {
    issues.push("bindings.compatibilityReceiptContentSha256");
  }
  if (bindings.hardwareTargetContentSha256 !== recordContentSha256(hardware)) {
    issues.push("bindings.hardwareTargetContentSha256");
  }
  if (bindings.artifactSha256 !== candidateArtifact.sha256
    || bindings.selectedArtifactSha256 !== artifact.sha256
    || artifact.sha256 !== candidateArtifact.sha256
    || artifact.bytes !== candidateArtifact.bytes) {
    issues.push("bindings.artifact");
  }
  if (receipt.candidateId !== candidate.candidateId
    || receipt.artifactId !== candidateArtifact.artifactId
    || receipt.artifactSha256 !== candidateArtifact.sha256
    || receipt.runtimeConfigurationId !== candidateRuntime.runtimeConfigurationId
    || receiptTarget.product !== candidateRuntime.product
    || receiptTarget.engine !== candidateRuntime.engine
    || receiptTarget.engineBuild !== candidateRuntime.engineBuild
    || receiptTarget.backend !== candidateRuntime.backend
    || accelerators[0]?.backend !== candidateRuntime.backend
    || contexts[0]?.contextTokens !== candidateRuntime.contextTokens
    || contexts[1]?.contextTokens
      !== Number(candidateRuntime.contextTokens) * 4) {
    issues.push("producer.binding");
  }
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  path: string,
  issues: string[],
): void {
  for (const key of expected) if (!Object.hasOwn(value, key)) issues.push(`${path}.${key}`);
  for (const key of Object.keys(value)) if (!expected.includes(key)) issues.push(`${path}.${key}`);
}

function record(
  value: unknown,
  path: string,
  issues: string[],
): Record<string, unknown> | null {
  if (!isRecord(value)) {
    issues.push(path);
    return null;
  }
  return value;
}

function blocked(issues: string[]): FitProfileCapturePresentationValidation {
  return { kind: "blocked", issues: [...new Set(issues)].sort() };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function sha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function timestamp(value: unknown): value is string {
  return nonEmpty(value)
    && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString() === value;
}

import { validateContract } from "../../lib/contracts";
import { recordContentSha256 } from "../../lib/assessment/record-digest";
import {
  COLLECTION_CONTRACT,
  COLLECTION_SCHEMA_VERSION,
} from "./types";
import type {
  CollectionAttempt,
  CollectionValidation,
  ProfileCollectionBundleV1,
} from "./types";

const SHA256 = /^[0-9a-f]{64}$/;

export function validateCollectionBundle(
  value: unknown,
): CollectionValidation {
  const issues: string[] = [];
  if (!isRecord(value)) return blocked(["bundle"]);

  exactKeys(value, [
    "schemaVersion",
    "contract",
    "collectionId",
    "collectionVersion",
    "evidenceClassification",
    "candidate",
    "compatibilityReceipt",
    "hardwareTarget",
    "bindings",
    "tool",
    "command",
    "runPath",
    "contexts",
  ], "bundle", issues);

  if (value.schemaVersion !== COLLECTION_SCHEMA_VERSION) {
    issues.push("schemaVersion");
  }
  if (value.contract !== COLLECTION_CONTRACT) issues.push("contract");
  for (const key of ["collectionId", "collectionVersion"] as const) {
    if (!nonEmpty(value[key])) issues.push(key);
  }
  if (
    value.evidenceClassification !== "synthetic-machinery-only"
    && value.evidenceClassification !== "local-measurement"
  ) {
    issues.push("evidenceClassification");
  }
  if (value.runPath !== "gpu") issues.push("runPath");

  validateProducer("exact-configuration-candidate", value.candidate, issues);
  validateProducer(
    "compatibility-admission-receipt",
    value.compatibilityReceipt,
    issues,
  );
  validateProducer("hardware-target", value.hardwareTarget, issues);

  if (!isRecord(value.bindings)) {
    issues.push("bindings");
  } else {
    exactKeys(value.bindings, [
      "candidateContentSha256",
      "compatibilityReceiptContentSha256",
      "hardwareTargetContentSha256",
      "artifactSha256",
    ], "bindings", issues);
    for (const key of [
      "candidateContentSha256",
      "compatibilityReceiptContentSha256",
      "hardwareTargetContentSha256",
      "artifactSha256",
    ] as const) {
      if (!SHA256.test(String(value.bindings[key] ?? ""))) {
        issues.push(`bindings.${key}`);
      }
    }
  }

  if (!isRecord(value.tool)) {
    issues.push("tool");
  } else {
    exactKeys(
      value.tool,
      ["id", "version", "executableSha256"],
      "tool",
      issues,
    );
    if (!nonEmpty(value.tool.id)) issues.push("tool.id");
    if (!nonEmpty(value.tool.version)) issues.push("tool.version");
    if (!SHA256.test(String(value.tool.executableSha256 ?? ""))) {
      issues.push("tool.executableSha256");
    }
  }

  if (!isRecord(value.command)) {
    issues.push("command");
  } else {
    exactKeys(value.command, ["argv"], "command", issues);
    if (
      !Array.isArray(value.command.argv)
      || value.command.argv.length === 0
      || value.command.argv.some((item) => !nonEmpty(item))
    ) {
      issues.push("command.argv");
    }
  }

  validateContexts(value.contexts, issues);
  if (issues.length > 0) return blocked(issues);

  const bundle = value as unknown as ProfileCollectionBundleV1;
  validateBindings(bundle, issues);
  validateIdentity(bundle, issues);
  return issues.length > 0 ? blocked(issues) : {
    kind: "ok",
    value: structuredClone(bundle),
  };
}

function validateProducer(
  contract:
    | "exact-configuration-candidate"
    | "compatibility-admission-receipt"
    | "hardware-target",
  data: unknown,
  issues: string[],
): void {
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
  if (!validation.ok) issues.push(`${contract}: ${validation.errors.join(" ")}`);
}

function validateBindings(
  bundle: ProfileCollectionBundleV1,
  issues: string[],
): void {
  const expected = {
    candidateContentSha256: recordContentSha256(bundle.candidate),
    compatibilityReceiptContentSha256:
      recordContentSha256(bundle.compatibilityReceipt),
    hardwareTargetContentSha256: recordContentSha256(bundle.hardwareTarget),
    artifactSha256: bundle.candidate.artifact.sha256,
  };
  for (const key of Object.keys(expected) as Array<keyof typeof expected>) {
    if (bundle.bindings[key] !== expected[key]) issues.push(`bindings.${key}`);
  }
}

function validateIdentity(
  bundle: ProfileCollectionBundleV1,
  issues: string[],
): void {
  const candidate = bundle.candidate;
  const receipt = bundle.compatibilityReceipt;
  const hardware = bundle.hardwareTarget;
  if (
    receipt.candidateId !== candidate.candidateId
    || receipt.artifactId !== candidate.artifact.artifactId
    || receipt.artifactSha256 !== candidate.artifact.sha256
    || receipt.runtimeConfigurationId
      !== candidate.runtime.runtimeConfigurationId
  ) {
    issues.push("compatibilityReceipt.binding");
  }
  if (
    hardware.memory.unified !== false
    || hardware.accelerators.length !== 1
    || hardware.accelerators[0]?.acceleratorId === null
    || hardware.accelerators[0]?.backend !== candidate.runtime.backend
    || candidate.runtime.gpuLayers !== "all"
  ) {
    issues.push("hardwareTarget.runPath");
  }
  const contextValues = new Set(bundle.contexts.map((item) => item.contextTokens));
  if (!contextValues.has(candidate.runtime.contextTokens)) {
    issues.push("contexts.runtimeContext");
  }
  if (contextValues.size < 2) issues.push("contexts.contextScaling");
}

function validateContexts(value: unknown, issues: string[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push("contexts");
    return;
  }
  const contexts = new Set<number>();
  const attemptIds = new Set<string>();
  for (const [contextIndex, context] of value.entries()) {
    const path = `contexts.${contextIndex}`;
    if (!isRecord(context)) {
      issues.push(path);
      continue;
    }
    exactKeys(context, ["contextTokens", "attempts"], path, issues);
    if (
      !Number.isSafeInteger(context.contextTokens)
      || Number(context.contextTokens) <= 0
      || contexts.has(Number(context.contextTokens))
    ) {
      issues.push(`${path}.contextTokens`);
    }
    contexts.add(Number(context.contextTokens));
    if (!Array.isArray(context.attempts) || context.attempts.length < 2) {
      issues.push(`${path}.attempts`);
      continue;
    }
    for (const [attemptIndex, attempt] of context.attempts.entries()) {
      validateAttempt(
        attempt,
        `${path}.attempts.${attemptIndex}`,
        attemptIds,
        issues,
      );
    }
  }
}

function validateAttempt(
  value: unknown,
  path: string,
  attemptIds: Set<string>,
  issues: string[],
): void {
  if (!isRecord(value)) {
    issues.push(path);
    return;
  }
  if (
    value.status !== "completed"
    && value.status !== "failed"
    && value.status !== "unavailable"
  ) {
    issues.push(`${path}.status`);
    return;
  }
  const completed = value.status === "completed";
  exactKeys(
    value,
    completed
      ? [
          "attemptId", "observedAt", "rawSourceRecordRef", "status",
          "device", "host",
        ]
      : [
          "attemptId", "observedAt", "rawSourceRecordRef", "status",
          "reasonCode", "device", "host",
        ],
    path,
    issues,
  );
  if (!nonEmpty(value.attemptId) || attemptIds.has(String(value.attemptId))) {
    issues.push(`${path}.attemptId`);
  }
  attemptIds.add(String(value.attemptId));
  if (!validTimestamp(value.observedAt)) issues.push(`${path}.observedAt`);
  if (!nonEmpty(value.rawSourceRecordRef)) {
    issues.push(`${path}.rawSourceRecordRef`);
  }
  if (completed) {
    validatePool(value.device, `${path}.device`, issues);
    validatePool(value.host, `${path}.host`, issues);
  } else {
    if (!nonEmpty(value.reasonCode)) issues.push(`${path}.reasonCode`);
    if (value.device !== null) issues.push(`${path}.device`);
    if (value.host !== null) issues.push(`${path}.host`);
  }
}

function validatePool(
  value: unknown,
  path: string,
  issues: string[],
): void {
  if (!isRecord(value)) {
    issues.push(path);
    return;
  }
  exactKeys(
    value,
    ["modelBytes", "contextBytes", "computeBytes"],
    path,
    issues,
  );
  for (const key of ["modelBytes", "contextBytes", "computeBytes"] as const) {
    if (!Number.isSafeInteger(value[key]) || Number(value[key]) < 0) {
      issues.push(`${path}.${key}`);
    }
  }
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  path: string,
  issues: string[],
): void {
  const actual = Object.keys(value);
  for (const key of expected) {
    if (!Object.hasOwn(value, key)) issues.push(`${path}.${key}`);
  }
  for (const key of actual) {
    if (!expected.includes(key)) issues.push(`${path}.${key}`);
  }
}

function blocked(issues: string[]): CollectionValidation {
  return {
    kind: "blocked",
    reasonCode: "fit-profile-collection.invalid",
    message: "The raw profile collection bundle is incomplete or inconsistent.",
    issues: [...new Set(issues)].sort(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validTimestamp(value: unknown): value is string {
  return nonEmpty(value)
    && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString() === value;
}

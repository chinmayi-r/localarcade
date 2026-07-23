import {
  canonicalJson,
  validateContract,
} from "../contracts";
import type {
  ExactConfigurationCandidate,
  RunnerImportBundle,
  TypedEnvelope,
} from "../contracts";
import {
  isImportAllowedByInspection,
} from "./runner-import";
import {
  isIntactVerifiedInventorySelection,
} from "./runner";
import type {
  BenchmarkPreparationV1,
  ImportAllowedInspectionV1,
  ObservedToolIdentityReceiptV1,
  PrepareVerificationPlanPortInputV1,
  PrepareVerificationPlanPreviewInputV1,
  QuickCheckPreparationV1,
  RunnerConfirmedHardwareReceiptV1,
  VerificationPlanEnvelope,
  VerificationPlanPreviewPortsV1,
  VerificationPlanPreviewV1,
} from "./verification-preview-types";
import type { VerifiedInventorySelectionV1 } from "./runner-types";

export type {
  BenchmarkPreparationV1,
  ImportAllowedInspectionV1,
  ObservedToolIdentityReceiptV1,
  PrepareVerificationPlanPortInputV1,
  PrepareVerificationPlanPreviewInputV1,
  QuickCheckPreparationV1,
  RunnerConfirmedHardwareReceiptV1,
  VerificationPlanEnvelope,
  VerificationPlanPreviewPortsV1,
  VerificationPlanPreviewV1,
} from "./verification-preview-types";
export type { VerifiedInventorySelectionV1 } from "./runner-types";

/**
 * Validates the exact input/output seam for a future explicitly requested,
 * read-only M-J preparation call. There is not yet a real TypeScript-to-Rust
 * adapter or authenticated hardware/tool receipt producer. It cannot run a
 * plan: no execution capability is present in the input or ports object.
 */
export async function prepareVerificationPlanPreview(
  input: PrepareVerificationPlanPreviewInputV1,
  acceptedImport: ImportAllowedInspectionV1,
  inventorySelection: VerifiedInventorySelectionV1,
  ports: VerificationPlanPreviewPortsV1,
): Promise<VerificationPlanPreviewV1> {
  try {
    if (!validAction(input)) {
      return localFailure(
        "blocked",
        "orchestrator.verification-preview.action-invalid",
        "Verification preview requires the explicit prepare-verification action and a plan ID.",
      );
    }
    if (!isImportAllowedByInspection(acceptedImport)
      || !validAcceptedImport(acceptedImport)) {
      return localFailure(
        "blocked",
        "orchestrator.verification-preview.import-not-allowed",
        "Verification preview requires the intact process-local import result, including expired-handoff confirmation when applicable.",
      );
    }
    if (!isIntactVerifiedInventorySelection(inventorySelection)) {
      return localFailure(
        "blocked",
        "orchestrator.verification-preview.inventory-not-intact",
        "Verification preview requires the intact process-local verified inventory selection.",
      );
    }
    if (!plainRecord(ports, ["prepareVerificationPlan"])
      || typeof ports.prepareVerificationPlan !== "function") {
      return localFailure(
        "unavailable",
        "orchestrator.verification-preview.port-unavailable",
        "The existing-engine verification planner is unavailable.",
      );
    }

    const bundle = acceptedImport.bundle;
    const candidate = bundle.handoff.selectedCandidate;
    if (!preparationBindsBundle(input, bundle)) {
      return localFailure(
        "blocked",
        "orchestrator.verification-preview.preparation-invalid",
        "Confirmed hardware and at least one complete, observed-tool preparation are required and must match the imported configuration.",
      );
    }
    if (!candidateMatchesInventory(candidate, inventorySelection)) {
      return localFailure(
        "blocked",
        "orchestrator.verification-preview.inventory-drift",
        "The selected local artifact no longer matches the imported exact configuration.",
      );
    }

    const request: PrepareVerificationPlanPortInputV1 = structuredClone({
      action: "prepare-verification",
      verificationPlanId: input.verificationPlanId,
      confirmedHardware: input.confirmedHardware,
      candidate,
      compatibilityAdmission: bundle.compatibilityAdmission,
      inventorySelection,
      benchmark: input.benchmark,
      quickCheck: input.quickCheck,
      previewOnly: true,
      grantsExecutionAuthorization: false,
    });
    deepFreeze(request);

    let raw: VerificationPlanEnvelope;
    try {
      raw = await ports.prepareVerificationPlan(request);
    } catch {
      return localFailure(
        "error",
        "orchestrator.verification-preview.port-failed",
        "The verification planner failed while preparing the preview.",
      );
    }

    if (!passivePlainData(raw)) {
      return localFailure(
        "error",
        "orchestrator.verification-preview.port-hostile",
        "The verification planner returned accessor-bearing, cyclic or non-data state.",
      );
    }
    const validated = validateContract(raw);
    if (!validated.ok || validated.value.contract !== "verification-plan") {
      return localFailure(
        "error",
        "orchestrator.verification-preview.port-invalid",
        "The verification planner returned a malformed or wrong-contract result.",
      );
    }
    const plan = structuredClone(validated.value) as VerificationPlanEnvelope;
    if ((plan.status === "ok" || plan.status === "partial")
      && !planBindsRequest(
        plan,
        input.verificationPlanId,
        input,
        bundle,
        inventorySelection,
      )) {
      return localFailure(
        "blocked",
        "orchestrator.verification-preview.plan-binding-invalid",
        "The prepared plan does not bind to the imported configuration and verified local artifact.",
      );
    }

    return sealPreview(plan);
  } catch {
    return localFailure(
      "error",
      "orchestrator.verification-preview.input-hostile",
      "Verification preview rejected hostile or unreadable input.",
    );
  }
}

function validAction(
  value: unknown,
): value is PrepareVerificationPlanPreviewInputV1 {
  return passivePlainData(value)
    && plainRecord(value, [
      "action",
      "verificationPlanId",
      "confirmedHardware",
      "benchmark",
      "quickCheck",
    ])
    && value.action === "prepare-verification"
    && nonEmpty(value.verificationPlanId);
}

function preparationBindsBundle(
  input: PrepareVerificationPlanPreviewInputV1,
  bundle: RunnerImportBundle,
): boolean {
  const candidate = bundle.handoff.selectedCandidate;
  return validConfirmedHardware(
    input.confirmedHardware,
    bundle.handoff.hardwareTarget.hardwareTargetId,
  )
    && (input.benchmark !== null || input.quickCheck !== null)
    && (input.benchmark === null
      || validBenchmarkPreparation(input.benchmark, candidate))
    && (input.quickCheck === null
      || validQuickCheckPreparation(input.quickCheck, candidate));
}

function validConfirmedHardware(
  value: unknown,
  hardwareTargetId: string,
): value is RunnerConfirmedHardwareReceiptV1 {
  return plainRecord(value, [
    "confirmationVersion",
    "hardwareTargetId",
    "state",
    "actionId",
    "confirmedAt",
  ])
    && value.confirmationVersion === 1
    && value.hardwareTargetId === hardwareTargetId
    && (value.state === "ready"
      || value.state === "ambiguity-explicitly-confirmed")
    && nonEmpty(value.actionId)
    && validInstant(value.confirmedAt);
}

function validBenchmarkPreparation(
  value: unknown,
  candidate: ExactConfigurationCandidate,
): value is BenchmarkPreparationV1 {
  if (!plainRecord(value, [
    "planId",
    "tool",
    "protocolId",
    "warmupRuns",
    "measuredRuns",
    "measurementKinds",
    "preflight",
  ])
    || !nonEmpty(value.planId)
    || !validTool(value.tool, "benchmark", candidate)
    || !nonEmpty(value.protocolId)
    || !nonNegativeInteger(value.warmupRuns)
    || !positiveInteger(value.measuredRuns)
    || !Array.isArray(value.measurementKinds)
    || value.measurementKinds.length === 0
    || new Set(value.measurementKinds).size !== value.measurementKinds.length
    || !value.measurementKinds.every((kind) => [
      "prompt-processing",
      "generation",
      "time-to-first-token",
      "memory",
      "stability",
    ].includes(String(kind)))) return false;
  return validPreflight(value.preflight);
}

function validQuickCheckPreparation(
  value: unknown,
  candidate: ExactConfigurationCandidate,
): value is QuickCheckPreparationV1 {
  if (!plainRecord(value, [
    "planId",
    "tool",
    "checks",
    "preflight",
  ])
    || !nonEmpty(value.planId)
    || !validTool(value.tool, "quick-check", candidate)
    || !Array.isArray(value.checks)
    || value.checks.length === 0
    || !value.checks.every((check) =>
      plainRecord(check, ["checkId", "criterion"])
      && nonEmpty(check.checkId)
      && nonEmpty(check.criterion))
    || new Set(value.checks.map((check) => check.checkId)).size
      !== value.checks.length) return false;
  return validPreflight(value.preflight);
}

function validTool(
  value: unknown,
  kind: ObservedToolIdentityReceiptV1["kind"],
  candidate: ExactConfigurationCandidate,
): value is ObservedToolIdentityReceiptV1 {
  if (!plainRecord(value, [
    "kind",
    "path",
    "expectedSha256",
    "observedProduct",
    "observedEngine",
    "observedEngineBuild",
    "probeProtocolId",
    "observedAt",
  ])) return false;
  const expectedName = kind === "benchmark"
    ? "llama-bench.exe"
    : "llama-cli.exe";
  if (!nonEmpty(value.path)) return false;
  const actualName = value.path.replaceAll("\\", "/").split("/").at(-1);
  return value.kind === kind
    && actualName?.toLowerCase() === expectedName
    && sha256(value.expectedSha256)
    && value.observedProduct === candidate.runtime.product
    && value.observedEngine === candidate.runtime.engine
    && value.observedEngineBuild === candidate.runtime.engineBuild
    && nonEmpty(value.probeProtocolId)
    && validInstant(value.observedAt);
}

function validPreflight(value: unknown): boolean {
  return plainRecord(value, [
    "power",
    "thermal",
    "concurrentGpu",
    "requiresConfirmation",
    "conditions",
  ])
    && ["ac", "battery", "unknown"].includes(String(value.power))
    && ["acceptable", "adverse", "unknown"].includes(String(value.thermal))
    && ["idle", "active", "unknown"].includes(String(value.concurrentGpu))
    && typeof value.requiresConfirmation === "boolean"
    && stringArray(value.conditions);
}

function validAcceptedImport(
  value: unknown,
): value is ImportAllowedInspectionV1 {
  if (!isImportAllowedByInspection(value)) return false;
  const envelope = {
    schemaVersion: 1,
    contract: "runner-import-bundle",
    status: "ok",
    data: value.bundle,
    provenance: [],
    completeness: {
      complete: true,
      missing: [],
      warnings: [],
      recoverableActions: [],
    },
  };
  const validated = validateContract(envelope);
  return validated.ok && validated.value.contract === "runner-import-bundle";
}

function candidateMatchesInventory(
  candidate: ExactConfigurationCandidate,
  selection: VerifiedInventorySelectionV1,
): boolean {
  return selection.sha256 === candidate.artifact.sha256
    && selection.fileSizeBytes === candidate.artifact.bytes
    && canonicalJson(selection.identity.artifact)
      === canonicalJson(candidate.artifact);
}

function planBindsRequest(
  envelope: TypedEnvelope<"verification-plan">,
  verificationPlanId: string,
  input: PrepareVerificationPlanPreviewInputV1,
  bundle: RunnerImportBundle,
  selection: VerifiedInventorySelectionV1,
): boolean {
  const plan = envelope.data;
  const candidate = bundle.handoff.selectedCandidate;
  if (plan.verificationPlanId !== verificationPlanId
    || plan.hardwareTargetId !== bundle.handoff.hardwareTarget.hardwareTargetId
    || plan.candidateId !== candidate.candidateId) return false;
  if ((input.benchmark === null) !== (plan.benchmarkPlan === null)
    || (input.quickCheck === null) !== (plan.quickCheckPlan === null)) {
    return false;
  }
  if (input.benchmark !== null && plan.benchmarkPlan !== null
    && (plan.benchmarkPlan.benchmarkPlanId !== input.benchmark.planId
      || plan.benchmarkPlan.protocolId !== input.benchmark.protocolId
      || plan.benchmarkPlan.warmupRuns !== input.benchmark.warmupRuns
      || plan.benchmarkPlan.measuredRuns !== input.benchmark.measuredRuns
      || canonicalJson(plan.benchmarkPlan.measurementKinds)
        !== canonicalJson(input.benchmark.measurementKinds)
      || canonicalJson(plan.benchmarkPlan.preflight)
        !== canonicalJson(input.benchmark.preflight))) return false;
  if (input.quickCheck !== null && plan.quickCheckPlan !== null
    && (plan.quickCheckPlan.quickCheckPlanId !== input.quickCheck.planId
      || canonicalJson(plan.quickCheckPlan.checks)
        !== canonicalJson(input.quickCheck.checks)
      || canonicalJson(plan.quickCheckPlan.preflight)
        !== canonicalJson(input.quickCheck.preflight))) return false;
  for (const nested of [plan.benchmarkPlan, plan.quickCheckPlan]) {
    if (nested === null
      || nested.candidateId !== candidate.candidateId
      || nested.artifactPath !== selection.path
      || nested.expectedArtifactSha256 !== selection.sha256
      || canonicalJson(nested.runtime) !== canonicalJson(candidate.runtime)) {
      if (nested !== null) return false;
    }
  }
  return plan.benchmarkPlan !== null || plan.quickCheckPlan !== null;
}

function localFailure(
  status: "unavailable" | "blocked" | "error",
  reasonCode: string,
  message: string,
): VerificationPlanPreviewV1 {
  const plan: VerificationPlanEnvelope = {
    schemaVersion: 1,
    contract: "verification-plan",
    status,
    reasonCode,
    message,
    recoverableActions: [],
    provenance: [],
    warnings: [],
  };
  return sealPreview(plan);
}

function sealPreview(plan: VerificationPlanEnvelope): VerificationPlanPreviewV1 {
  return deepFreeze({
    previewVersion: 1,
    action: "prepare-verification",
    status: plan.status,
    previewOnly: true,
    grantsExecutionAuthorization: false,
    permissionBoundary: {
      readsSelectedArtifactAndToolIdentity: true,
      writes: false,
      executesLocalProcess: false,
      loadsModel: false,
      network: false,
      upload: false,
    },
    plan,
  });
}

function plainRecord(
  value: unknown,
  keys: string[],
): value is Record<string, unknown> {
  if (value === null || typeof value !== "object"
    || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors)
    .some((descriptor) => "get" in descriptor || "set" in descriptor)) {
    return false;
  }
  const actual = Object.keys(descriptors).sort();
  return actual.length === keys.length
    && actual.every((key, index) => key === [...keys].sort()[index]);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function sha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function validInstant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/
    .exec(value);
  if (match === null) return false;
  const [year, month, day, hour, minute, second] =
    match.slice(1, 7).map(Number);
  if (year < 1 || month < 1 || month > 12 || hour > 23
    || minute > 59 || second > 59) return false;
  const milliseconds = Number((match[7] ?? "").padEnd(3, "0"));
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  calendar.setUTCHours(hour, minute, second, milliseconds);
  if (calendar.getUTCFullYear() !== year
    || calendar.getUTCMonth() !== month - 1
    || calendar.getUTCDate() !== day
    || calendar.getUTCHours() !== hour
    || calendar.getUTCMinutes() !== minute
    || calendar.getUTCSeconds() !== second
    || calendar.getUTCMilliseconds() !== milliseconds) return false;
  const offsetMinutes = match[8] === "Z"
    ? 0
    : (Number(match[10]) * 60 + Number(match[11]))
      * (match[9] === "+" ? 1 : -1);
  if (Math.abs(offsetMinutes) > 14 * 60
    || Number(match[10] ?? 0) > 14
    || Number(match[11] ?? 0) > 59) return false;
  return calendar.getTime() - offsetMinutes * 60_000 === Date.parse(value);
}

function passivePlainData(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object") return true;
  if (seen.has(value)) return false;
  seen.add(value);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== Array.prototype) {
    return false;
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const descriptor of Object.values(descriptors)) {
    if ("get" in descriptor || "set" in descriptor) return false;
    if ("value" in descriptor
      && !passivePlainData(descriptor.value, seen)) return false;
  }
  return true;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

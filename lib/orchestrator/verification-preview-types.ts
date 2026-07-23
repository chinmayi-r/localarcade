import type {
  BenchmarkPlan,
  CompatibilityAdmissionReceipt,
  ContractEnvelope,
  ExactConfigurationCandidate,
  Preflight,
  QuickCheckPlan,
  TypedEnvelope,
} from "../contracts";
import type { AcceptedRunnerImportInspectionV1 } from "./runner-import-types";
import type { VerifiedInventorySelectionV1 } from "./runner-types";

export type ImportAllowedInspectionV1 =
  AcceptedRunnerImportInspectionV1 & { canImport: true };

export type PrepareVerificationPlanPreviewInputV1 = {
  action: "prepare-verification";
  verificationPlanId: string;
  confirmedHardware: RunnerConfirmedHardwareReceiptV1;
  benchmark: BenchmarkPreparationV1 | null;
  quickCheck: QuickCheckPreparationV1 | null;
};

/**
 * Required shape from a future process-local M-D confirmation action. This
 * checkpoint validates the seam but does not provide/authenticate that action.
 */
export type RunnerConfirmedHardwareReceiptV1 = {
  confirmationVersion: 1;
  hardwareTargetId: string;
  state: "ready" | "ambiguity-explicitly-confirmed";
  actionId: string;
  confirmedAt: string;
};

/**
 * Exact structural mirror of Rust M-J's observed tool receipt. This checkpoint
 * has no tool-probe producer, so an object of this type is not authenticated
 * evidence and cannot support a real preview until a separately gated,
 * process-local probe returns an integrity-bound receipt.
 */
export type ObservedToolIdentityReceiptV1 = {
  kind: "benchmark" | "quick-check";
  path: string;
  expectedSha256: string;
  observedProduct: string;
  observedEngine: string;
  observedEngineBuild: string;
  probeProtocolId: string;
  observedAt: string;
};

export type BenchmarkPreparationV1 = {
  planId: string;
  tool: ObservedToolIdentityReceiptV1;
  protocolId: string;
  warmupRuns: number;
  measuredRuns: number;
  measurementKinds: BenchmarkPlan["measurementKinds"];
  preflight: Preflight;
};

export type QuickCheckPreparationV1 = {
  planId: string;
  tool: ObservedToolIdentityReceiptV1;
  checks: QuickCheckPlan["checks"];
  preflight: Preflight;
};

/**
 * Versioned TypeScript mirror of Rust M-J's preparation request. It is an
 * internal injected-port DTO only; no TypeScript-to-Rust transport or IPC
 * adapter is implemented by this checkpoint. The confirmed-hardware and tool
 * fields are exact seam requirements, not proof that their still-absent
 * process-local producers have run.
 */
export type PrepareVerificationPlanPortInputV1 = {
  action: "prepare-verification";
  verificationPlanId: string;
  confirmedHardware: RunnerConfirmedHardwareReceiptV1;
  candidate: ExactConfigurationCandidate;
  compatibilityAdmission: CompatibilityAdmissionReceipt;
  inventorySelection: VerifiedInventorySelectionV1;
  benchmark: BenchmarkPreparationV1 | null;
  quickCheck: QuickCheckPreparationV1 | null;
  previewOnly: true;
  grantsExecutionAuthorization: false;
};

export type VerificationPlanEnvelope =
  | TypedEnvelope<"verification-plan">
  | (Extract<ContractEnvelope, {
    status: "unavailable" | "blocked" | "error";
  }> & { contract: "verification-plan" });

export type VerificationPlanPreviewPortsV1 = {
  prepareVerificationPlan(
    input: Readonly<PrepareVerificationPlanPortInputV1>,
  ): VerificationPlanEnvelope | Promise<VerificationPlanEnvelope>;
};

export type VerificationPlanPreviewV1 = {
  previewVersion: 1;
  action: "prepare-verification";
  status: VerificationPlanEnvelope["status"];
  previewOnly: true;
  grantsExecutionAuthorization: false;
  permissionBoundary: {
    readsSelectedArtifactAndToolIdentity: true;
    writes: false;
    executesLocalProcess: false;
    loadsModel: false;
    network: false;
    upload: false;
  };
  plan: VerificationPlanEnvelope;
};

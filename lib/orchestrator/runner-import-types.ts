import type {
  RunnerImportBundle,
  TypedEnvelope,
} from "../contracts/types";

export type RunnerImportIntentV1 =
  | "inspect"
  | "confirm-expired-import";

export type RunnerImportBundleEnvelopeV1 =
  TypedEnvelope<"runner-import-bundle">;

export type InspectRunnerImportInputV1 = {
  bundleEnvelope: unknown;
  now: string;
  intent: RunnerImportIntentV1;
};

export type AcceptedRunnerImportInspectionV1 = {
  inspectionVersion: 1;
  status: "accepted";
  disposition:
    | "fresh"
    | "expired-awaiting-confirmation"
    | "expired-confirmed";
  intent: RunnerImportIntentV1;
  inspectedAt: string;
  bundleEnvelope: RunnerImportBundleEnvelopeV1;
  bundle: RunnerImportBundle;
  expired: boolean;
  canInspect: true;
  canImport: boolean;
  requiresExpiryConfirmation: boolean;
  sideEffectAuthorization: false;
  executionAuthorization: false;
  warnings: string[];
};

export type BlockedRunnerImportInspectionV1 = {
  inspectionVersion: 1;
  status: "blocked";
  reasonCode: string;
  message: string;
  canInspect: false;
  canImport: false;
  requiresExpiryConfirmation: false;
  sideEffectAuthorization: false;
  executionAuthorization: false;
  warnings: string[];
};

export type RunnerImportInspectionV1 =
  | AcceptedRunnerImportInspectionV1
  | BlockedRunnerImportInspectionV1;

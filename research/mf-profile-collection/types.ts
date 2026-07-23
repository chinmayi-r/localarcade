import type {
  CompatibilityAdmissionReceipt,
  ExactConfigurationCandidate,
  HardwareTarget,
} from "../../lib/contracts";
import type { TwoPoolFitProfile } from "../../lib/fit";
import type { RuntimeScopedFitProfileRecord } from "../../lib/assessment";

export const COLLECTION_CONTRACT = "mf-profile-collection-bundle" as const;
export const COLLECTION_SCHEMA_VERSION = 1 as const;

export type PoolObservation = {
  modelBytes: number;
  contextBytes: number;
  computeBytes: number;
};

export type CompletedCollectionAttempt = {
  attemptId: string;
  observedAt: string;
  rawSourceRecordRef: string;
  status: "completed";
  device: PoolObservation;
  host: PoolObservation;
};

export type IncompleteCollectionAttempt = {
  attemptId: string;
  observedAt: string;
  rawSourceRecordRef: string;
  status: "failed" | "unavailable";
  reasonCode: string;
  device: null;
  host: null;
};

export type CollectionAttempt =
  | CompletedCollectionAttempt
  | IncompleteCollectionAttempt;

export type ContextCollection = {
  contextTokens: number;
  attempts: CollectionAttempt[];
};

/**
 * Non-production capture contract. It stores producer content as well as
 * canonical digests so a consumer can reject same-ID mutation without having
 * to reconstruct trust facts.
 */
export type ProfileCollectionBundleV1 = {
  schemaVersion: typeof COLLECTION_SCHEMA_VERSION;
  contract: typeof COLLECTION_CONTRACT;
  collectionId: string;
  collectionVersion: string;
  evidenceClassification: "synthetic-machinery-only" | "local-measurement";
  candidate: ExactConfigurationCandidate;
  compatibilityReceipt: CompatibilityAdmissionReceipt;
  hardwareTarget: HardwareTarget;
  bindings: {
    candidateContentSha256: string;
    compatibilityReceiptContentSha256: string;
    hardwareTargetContentSha256: string;
    artifactSha256: string;
  };
  tool: {
    id: string;
    version: string;
    executableSha256: string;
  };
  command: {
    argv: string[];
  };
  runPath: "gpu";
  contexts: ContextCollection[];
};

export type CollectionValidation =
  | { kind: "ok"; value: ProfileCollectionBundleV1 }
  | {
      kind: "blocked";
      reasonCode: string;
      message: string;
      issues: string[];
    };

export type ProfileDerivation =
  | {
      kind: "proposed-unreviewed";
      record: RuntimeScopedFitProfileRecord;
      recordContentSha256: string;
      warning: string;
    }
  | {
      kind: "blocked";
      reasonCode: string;
      message: string;
      issues: string[];
    };

export type PolicyCandidate = {
  policyId: string;
  deviceReserveBytes: number;
  hostReserveBytes: number;
  safetyMarginBps: number;
};

export type CalibrationCase = {
  caseId: string;
  profile: TwoPoolFitProfile;
  contextTokens: number;
  devicePhysicalBytes: number;
  hostPhysicalBytes: number;
  observedOutcome: "loaded" | "capacity-failure" | "unknown";
};

export type PolicySweepInput = {
  schemaVersion: 1;
  evidenceClassification: "synthetic-machinery-only";
  policies: PolicyCandidate[];
  cases: CalibrationCase[];
};

export type PolicySweepReport = {
  schemaVersion: 1;
  status: "analysis-only";
  selectedPolicy: null;
  results: Array<{
    policyId: string;
    evaluatedCases: number;
    unknownCases: number;
    falseFits: number;
    falseNoFits: number;
    correctFits: number;
    correctNoFits: number;
  }>;
  warnings: string[];
};

export type ProductionReadiness = {
  schemaVersion: 1;
  status: "unavailable";
  reasonCode: "fit.production-profile-unavailable";
  message: string;
  missing: string[];
  productionProfile: null;
  selectedPolicy: null;
};

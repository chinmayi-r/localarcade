import type {
  CompatibilityAdmissionReceipt,
  ContractEnvelope,
  Provenance,
  TypedEnvelope,
} from "../contracts";
import type {
  CandidateDispositionV1,
  CandidateUniverseReceiptV1,
  FitAssessmentEnvelope,
  RecommendationPortfolioEnvelope,
} from "../portfolio";

export type HardwareTargetEnvelope = TypedEnvelope<"hardware-target">;
export type RecommendationRequestEnvelope =
  TypedEnvelope<"recommendation-request">;
export type RunnerHandoffEnvelope =
  | TypedEnvelope<"runner-handoff">
  | (Extract<ContractEnvelope, { status: "unavailable" | "blocked" | "error" }>
    & { contract: "runner-handoff" });
export type RunnerImportBundleEnvelope =
  | TypedEnvelope<"runner-import-bundle">
  | (Extract<ContractEnvelope, { status: "unavailable" | "blocked" | "error" }>
    & { contract: "runner-import-bundle" });

export type OrchestratorFailure = {
  status: "unavailable" | "blocked" | "error";
  reasonCode: string;
  message: string;
  recoverableActions: string[];
  provenance: Provenance[];
  warnings: string[];
};

export type CandidateUniversePortResult =
  | {
    status: "ok";
    universe: CandidateUniverseReceiptV1;
  }
  | OrchestratorFailure;

export type FinderPorts = {
  loadCandidateUniverse(
    request: RecommendationRequestEnvelope,
    hardware: HardwareTargetEnvelope,
  ): CandidateUniversePortResult | Promise<CandidateUniversePortResult>;
};

export type FinderUseCaseInput = {
  request: RecommendationRequestEnvelope;
  hardware: HardwareTargetEnvelope;
  policy: {
    policyVersion: 1;
    methodologyVersion: string;
  };
};

export type FinderSessionV1 = {
  portfolio: RecommendationPortfolioEnvelope;
  ledger: CandidateDispositionV1[];
  /**
   * Internal frozen snapshot retained for exact-detail lookup. It is not a
   * surface payload and must not be serialized as an M-A contract.
   */
  universe: CandidateUniverseReceiptV1 | null;
};

export type ExactConfigurationDetailV1 = {
  requestId: string;
  candidate: TypedEnvelope<"exact-configuration-candidate">;
  compatibilityAdmission: CompatibilityAdmissionReceipt;
  assessment: Extract<FitAssessmentEnvelope, { status: "ok" | "partial" }>;
  alternatives: Array<{
    candidateId: string;
    artifactId: string;
    quantization: string;
    disposition: CandidateDispositionV1["disposition"];
    reasonCodes: string[];
  }>;
};

export type ExactConfigurationDetailResultV1 =
  | {
    status: "ok" | "partial";
    data: ExactConfigurationDetailV1;
    provenance: Provenance[];
    missing: string[];
    warnings: string[];
    recoverableActions: string[];
  }
  | OrchestratorFailure;

export type CreateRunnerHandoffInputV1 = {
  handoffId: string;
  now: string;
  hardware: HardwareTargetEnvelope;
  request: RecommendationRequestEnvelope;
  detail: ExactConfigurationDetailResultV1;
};

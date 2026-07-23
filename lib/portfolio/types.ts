import type {
  CompatibilityAdmissionReceipt,
  ExactConfigurationCandidate,
  Need,
  NonDataEnvelope,
  Provenance,
  TypedEnvelope,
} from "../contracts";
import type {
  EvidenceAdapterResult,
  NormalizedEvidenceComponent,
} from "../evidence";

export type RecommendationRequestEnvelope =
  TypedEnvelope<"recommendation-request">;

export type FitAssessmentEnvelope =
  | TypedEnvelope<"fit-evidence-assessment">
  | (NonDataEnvelope & { contract: "fit-evidence-assessment" });

export type RecommendationPortfolioEnvelope =
  | TypedEnvelope<"recommendation-portfolio">
  | (NonDataEnvelope & { contract: "recommendation-portfolio" });

export type ReviewedFamiliaritySignalV1 = {
  signalVersion: 1;
  signalId: string;
  modelFamilyId: string;
  candidateId: string;
  artifactId: string;
  /**
   * An owner-reviewed ordinal used only after evidence and request-priority
   * comparisons cannot distinguish two candidates.
   */
  ordinal: number;
  ordinalDirection: "higher-is-more-familiar";
  reviewedBy: string;
  reviewedAt: string;
  provenance: Provenance[];
};

export type CatalogReferenceV1 = {
  snapshotId: string;
  /**
   * Stable position in the frozen registry snapshot. It is a deterministic
   * final reference order, not a quality or popularity score.
   */
  position: number;
};

export type CandidateEligibilityFactsV1 = {
  installed: boolean | null;
  capabilities: Record<Need, boolean | null>;
};

export type PortfolioCandidateEntryV1 = {
  kind: "candidate";
  artifactId: string;
  candidate: ExactConfigurationCandidate;
  compatibilityReceipt: CompatibilityAdmissionReceipt;
  assessment: FitAssessmentEnvelope;
  evidence: Array<EvidenceAdapterResult<NormalizedEvidenceComponent>>;
  familiarity: ReviewedFamiliaritySignalV1 | null;
  catalogReference: CatalogReferenceV1;
  eligibility: CandidateEligibilityFactsV1;
};

export type PortfolioUpstreamGapEntryV1 = {
  kind: "upstream-gap";
  artifactId: string;
  modelFamilyId: string | null;
  reasonCode: string;
  message: string;
  catalogReference: CatalogReferenceV1;
  provenance: Provenance[];
};

export type PortfolioUniverseEntryV1 =
  | PortfolioCandidateEntryV1
  | PortfolioUpstreamGapEntryV1;

export type CandidateUniverseReceiptV1 = {
  receiptVersion: 1;
  universeId: string;
  requestId: string;
  hardwareTargetId: string;
  registrySnapshot: {
    snapshotId: string;
    artifactIds: string[];
  };
  entries: PortfolioUniverseEntryV1[];
};

export type PortfolioPolicyV1 = {
  policyVersion: 1;
  methodologyVersion: string;
};

export type BuildRecommendationPortfolioInputV1 = {
  request: RecommendationRequestEnvelope;
  universe: CandidateUniverseReceiptV1;
  policy: PortfolioPolicyV1;
};

export type PortfolioDisposition =
  | "selected"
  | "excluded"
  | "unsupported"
  | "upstream-gap";

export type CandidateDispositionV1 = {
  artifactId: string;
  modelFamilyId: string | null;
  candidateId: string | null;
  assessmentId: string | null;
  disposition: PortfolioDisposition;
  reasonCodes: string[];
  details: string[];
};

export type RecommendationPortfolioResultV1 = {
  envelope: RecommendationPortfolioEnvelope;
  ledger: CandidateDispositionV1[];
};

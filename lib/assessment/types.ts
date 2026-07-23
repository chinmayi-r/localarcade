import type {
  CompatibilityAdmissionReceipt,
  ContractEnvelope,
  ExactConfigurationCandidate,
  HardwareTarget,
  Provenance,
} from "../contracts";
import type {
  EvidenceAdapterResult,
  NormalizedEvidenceComponent,
  ThroughputEvidenceComponents,
} from "../evidence";
import type {
  FitArtifact,
  KvCacheSelection,
  TwoPoolFitProfile,
} from "../fit";
import type {
  LlmfitMappingResult,
  MFFitUpstreamAdvisoryInput,
} from "../llmfit/types";

type FitProfileBinding = {
  candidateId: string;
  artifactSha256: string;
  acceleratorId: string | null;
  hardwareTargetId: string | null;
  runtime: ExactConfigurationCandidate["runtime"];
};

type FitProfileSource = {
  provenance: Provenance | Provenance[];
};

export type BoundFitProfile = FitProfileSource & ({
  mode?: "split";
  binding: FitProfileBinding & { acceleratorId: string };
  profile: TwoPoolFitProfile;
  runPath: "gpu" | "cpu-offload";
} | {
  mode: "host";
  binding: FitProfileBinding & { acceleratorId: null };
  artifact: FitArtifact;
  kvCache: KvCacheSelection;
  runPath: "cpu";
});

export type FitAssessmentPolicy = {
  policyId: string;
  policyVersion: string;
  binding: {
    hardwareTargetId: string;
    operatingSystem: HardwareTarget["os"]["family"];
    runPath: BoundFitProfile["runPath"];
  };
  deviceReserveBytes: number;
  hostReserveBytes: number;
  safetyMarginBps: number;
  tightHeadroomBps: number;
  basis: "confirmed-capacity-minus-reserve";
  provenance: Provenance[];
};

declare const admittedFitProfileBrand: unique symbol;
declare const admittedFitPolicyBrand: unique symbol;

export type AdmittedFitProfile = BoundFitProfile & {
  readonly [admittedFitProfileBrand]: "admitted-fit-profile";
};

export type AdmittedFitAssessmentPolicy = FitAssessmentPolicy & {
  readonly [admittedFitPolicyBrand]: "admitted-fit-policy";
};

export type UpstreamAdvisoryState =
  | LlmfitMappingResult<MFFitUpstreamAdvisoryInput>
  | {
      kind: "unavailable";
      reasonCode: string;
      message: string;
    }
  | null;

export type FitEvidenceAssessmentInput = {
  assessmentId: string;
  candidate: ExactConfigurationCandidate;
  compatibilityReceipt: CompatibilityAdmissionReceipt;
  hardwareTarget: HardwareTarget;
  desiredContextTokens: number;
  fitProfile: AdmittedFitProfile;
  fitPolicy: AdmittedFitAssessmentPolicy;
  evidence: {
    throughput: EvidenceAdapterResult<ThroughputEvidenceComponents> | null;
    records: Array<EvidenceAdapterResult<NormalizedEvidenceComponent>>;
  };
  upstreamAdvisory: UpstreamAdvisoryState;
};

export type FitAssessmentInput = FitEvidenceAssessmentInput;

export type FitEvidenceAssessmentEnvelope = Extract<
  ContractEnvelope,
  { contract: "fit-evidence-assessment" }
>;

export type EvidenceClass = "estimated" | "community-measured" | "locally-measured" | "objective-check";

export type Observation = {
  /** Closed interval. A point observation uses the same lower and upper bound. */
  lower: number;
  upper: number;
  unit: string;
  scope: string;
  evidenceClass: EvidenceClass;
  sourceIds: string[];
};

export type ConstraintOperator = "at-most" | "at-least" | "equal";

export type HardConstraint = {
  id: string;
  observation: string;
  operator: ConstraintOperator;
  value: number;
  unit: string;
  scope: string;
};

export type Objective = {
  id: string;
  observation: string;
  direction: "maximize" | "minimize";
  unit: string;
  scope: string;
};

export type NeutralCandidate = {
  id: string;
  familyId: string;
  exactConfigurationId: string | null;
  observations: Record<string, Observation | undefined>;
  diversity: Record<string, string | undefined>;
};

export type NeutralScenario = {
  id: string;
  retrievedAt: string;
  hardConstraints: HardConstraint[];
  objectives: Objective[];
  diversityDimensions: string[];
  candidates: NeutralCandidate[];
};

export type Rejection = {
  candidateId: string;
  stage: "constraints" | "pareto" | "diversity";
  code: "missing-observation" | "invalid-observation" | "incomparable-scope" | "unit-mismatch" | "constraint-failed" | "missing-diversity-dimension";
  detail: string;
};

export type StageResult<T> = {
  eligible: T[];
  rejected: Rejection[];
};

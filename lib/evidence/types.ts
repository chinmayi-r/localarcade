export const metricKinds = [
  "fit-memory",
  "prompt-throughput",
  "generation-throughput",
  "time-to-first-token",
  "task-latency",
  "stability",
  "energy-per-task",
  "task-success",
  "operator-intervention-rate",
  "response-preference",
  "experience-preference",
] as const;

export type MetricKind = (typeof metricKinds)[number];

export type EvidenceMethod = "estimate" | "measurement" | "preference";
export type EvidenceSource = "catalog" | "lab" | "community" | "personal";
export type HardwareMatch = "exact" | "calibrated-neighbor" | "coarse-bucket" | "not-applicable";
export type ConfigurationMatch = "exact" | "compatible" | "family-proxy";
export type EvidenceUnit = "bytes" | "tokens-per-second" | "milliseconds" | "probability" | "joules";

export type EvidenceInterval = {
  lower: number;
  upper: number;
  unit: EvidenceUnit;
  confidenceLevel?: number;
};

export type ExactConfigurationIdentity = {
  artifactSha256: string;
  runtimeBuild: string;
  settingsFingerprint: string;
};

/**
 * The stored evidence shape is deliberately orthogonal. Display labels such as
 * "verified" are derived from these fields and are never persisted as truth.
 */
export type EvidenceRecord = {
  id: string;
  metric: MetricKind;
  method: EvidenceMethod;
  source: EvidenceSource;
  hardwareMatch: HardwareMatch;
  configurationMatch: ConfigurationMatch;
  interval: EvidenceInterval;
  sampleCount: number;
  observedAt: string;
  provenanceLinks: string[];
  configuration?: ExactConfigurationIdentity;
  hardwareFingerprint?: string;
  hardwareGroupId?: string;
  taskPackId?: string;
  taskPackVersion?: string;
};

export type EvidenceClaim = "estimated" | "measured" | "community" | "verified" | "preference";

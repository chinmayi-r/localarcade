import type { EvidenceMethod, EvidenceUnit, MetricKind } from "./types";

export type MetricConditioning = "configuration" | "configuration-and-hardware";

export type MetricPolicy = {
  conditioning: MetricConditioning;
  allowedMethods: readonly EvidenceMethod[];
  unit: EvidenceUnit;
};

/**
 * One exhaustive policy table owns evidence pooling. Ranking and UI code must
 * query it instead of independently deciding whether hardware matters.
 */
export const metricPolicies = {
  "fit-memory": policy("configuration-and-hardware", ["estimate", "measurement"], "bytes"),
  "prompt-throughput": policy("configuration-and-hardware", ["estimate", "measurement"], "tokens-per-second"),
  "generation-throughput": policy("configuration-and-hardware", ["estimate", "measurement"], "tokens-per-second"),
  "time-to-first-token": policy("configuration-and-hardware", ["estimate", "measurement"], "milliseconds"),
  "task-latency": policy("configuration-and-hardware", ["estimate", "measurement"], "milliseconds"),
  stability: policy("configuration-and-hardware", ["estimate", "measurement"], "probability"),
  "energy-per-task": policy("configuration-and-hardware", ["measurement"], "joules"),
  "task-success": policy("configuration", ["measurement"], "probability"),
  "operator-intervention-rate": policy("configuration", ["measurement"], "probability"),
  "response-preference": policy("configuration", ["preference"], "probability"),
  "experience-preference": policy("configuration-and-hardware", ["preference"], "probability"),
} satisfies Record<MetricKind, MetricPolicy>;

export function policyForMetric(metric: MetricKind): MetricPolicy {
  const result = metricPolicies[metric];
  if (!result) throw new TypeError(`Unknown metric: ${metric}`);
  return result;
}

export function mayPoolAcrossHardware(metric: MetricKind): boolean {
  return policyForMetric(metric).conditioning === "configuration";
}

function policy(
  conditioning: MetricConditioning,
  allowedMethods: readonly EvidenceMethod[],
  unit: EvidenceUnit,
): MetricPolicy {
  return { conditioning, allowedMethods, unit };
}

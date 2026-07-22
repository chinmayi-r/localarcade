import type { Observation } from "./types";

export function observationProblem(observation: Observation | undefined, unit: string, scope: string): "missing-observation" | "invalid-observation" | "unit-mismatch" | "incomparable-scope" | undefined {
  if (!observation) return "missing-observation";
  if (!Number.isFinite(observation.lower) || !Number.isFinite(observation.upper) || observation.lower > observation.upper || observation.sourceIds.length === 0) return "invalid-observation";
  if (observation.unit !== unit) return "unit-mismatch";
  if (observation.scope !== scope) return "incomparable-scope";
  return undefined;
}

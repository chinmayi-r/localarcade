import type { HardConstraint, NeutralCandidate, Rejection, StageResult } from "./types";
import { observationProblem } from "./validation";

function provablySatisfies(candidate: NeutralCandidate, constraint: HardConstraint): boolean {
  const observation = candidate.observations[constraint.observation];
  if (!observation) return false;
  if (constraint.operator === "at-most") return observation.upper <= constraint.value;
  if (constraint.operator === "at-least") return observation.lower >= constraint.value;
  return observation.lower === constraint.value && observation.upper === constraint.value;
}

export function applyHardConstraints(candidates: NeutralCandidate[], constraints: HardConstraint[]): StageResult<NeutralCandidate> {
  const eligible: NeutralCandidate[] = [];
  const rejected: Rejection[] = [];
  for (const candidate of candidates) {
    let failed = false;
    for (const constraint of constraints) {
      const problem = observationProblem(candidate.observations[constraint.observation], constraint.unit, constraint.scope);
      if (problem) {
        rejected.push({ candidateId: candidate.id, stage: "constraints", code: problem, detail: `${constraint.id} requires ${constraint.observation} in ${constraint.unit} at ${constraint.scope}` });
        failed = true;
      } else if (!provablySatisfies(candidate, constraint)) {
        rejected.push({ candidateId: candidate.id, stage: "constraints", code: "constraint-failed", detail: `${constraint.id} was not satisfied by the complete observation interval` });
        failed = true;
      }
    }
    if (!failed) eligible.push(candidate);
  }
  return { eligible, rejected };
}

import type { NeutralCandidate, Objective, Rejection, StageResult } from "./types";
import { observationProblem } from "./validation";

function provablyNoWorse(a: NeutralCandidate, b: NeutralCandidate, objective: Objective): boolean {
  const left = a.observations[objective.observation]!;
  const right = b.observations[objective.observation]!;
  return objective.direction === "maximize" ? left.lower >= right.upper : left.upper <= right.lower;
}

function provablyBetter(a: NeutralCandidate, b: NeutralCandidate, objective: Objective): boolean {
  const left = a.observations[objective.observation]!;
  const right = b.observations[objective.observation]!;
  return objective.direction === "maximize" ? left.lower > right.upper : left.upper < right.lower;
}

/** Conservative dominance: all closed intervals must be provably no worse and at least one strictly better. */
export function dominates(a: NeutralCandidate, b: NeutralCandidate, objectives: Objective[]): boolean {
  const comparable = objectives.every((objective) =>
    observationProblem(a.observations[objective.observation], objective.unit, objective.scope) === undefined
    && observationProblem(b.observations[objective.observation], objective.unit, objective.scope) === undefined);
  return objectives.length > 0
    && comparable
    && objectives.every((objective) => provablyNoWorse(a, b, objective))
    && objectives.some((objective) => provablyBetter(a, b, objective));
}

export type ParetoResult = StageResult<NeutralCandidate> & { dominated: Array<{ candidateId: string; dominatedBy: string[] }> };

export function nonDominated(candidates: NeutralCandidate[], objectives: Objective[]): ParetoResult {
  const comparable: NeutralCandidate[] = [];
  const rejected: Rejection[] = [];
  for (const candidate of candidates) {
    let failed = false;
    for (const objective of objectives) {
      const problem = observationProblem(candidate.observations[objective.observation], objective.unit, objective.scope);
      if (problem) {
        rejected.push({ candidateId: candidate.id, stage: "pareto", code: problem, detail: `${objective.id} requires ${objective.observation} in ${objective.unit} at ${objective.scope}` });
        failed = true;
      }
    }
    if (!failed) comparable.push(candidate);
  }
  const dominated = comparable.flatMap((candidate) => {
    const dominatedBy = comparable.filter((other) => other.id !== candidate.id && dominates(other, candidate, objectives)).map((other) => other.id);
    return dominatedBy.length ? [{ candidateId: candidate.id, dominatedBy }] : [];
  });
  const dominatedIds = new Set(dominated.map((entry) => entry.candidateId));
  return { eligible: comparable.filter((candidate) => !dominatedIds.has(candidate.id)), rejected, dominated };
}

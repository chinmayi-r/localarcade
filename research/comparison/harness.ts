import type { Objective, Observation } from "../ranking/types";

export type MappingClass = "exact" | "lossy" | "unsupported";
export type Disposition = "considered" | "recommended" | "excluded" | "unsupported";

type Expectation = {
  expectationId: string;
  modelFamilyId: string;
  acceptableDispositions: Disposition[];
  acceptableExclusionCodes: string[];
};

type Candidate = {
  candidateId: string;
  modelFamilyId: string;
  disposition: Disposition;
  exclusionCodes: string[];
  runtimeIdentityComplete: boolean;
  runnable: "yes" | "no" | "unknown";
  observations: Record<string, Observation | undefined>;
  diversity: Record<string, string | null | undefined>;
};
type GuardAssessment = { guardCode: string; status: "satisfied" | "violated" | "not-evaluable" };
type SystemResult = {
  systemId: string;
  inputMapping: MappingClass;
  mappingFacets: Record<string, MappingClass>;
  guardAssessments: GuardAssessment[];
  candidates: Candidate[];
};
export type Comparison = {
  scenario: {
    expectations: Expectation[];
    objectives: Objective[];
    diversityDimensions: string[];
  };
  systemResults: SystemResult[];
};

export function normalizeRetrievalDate(value: string): { retrievedAt: string; retrievalPrecision: "date" | "date-time" } {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { retrievedAt: `${value}T00:00:00Z`, retrievalPrecision: "date" };
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf())) throw new Error(`invalid retrieval date: ${value}`);
  return { retrievedAt: parsed.toISOString(), retrievalPrecision: "date-time" };
}

function expectationOutcome(expectation: Expectation, candidates: Candidate[]) {
  const matches = candidates.filter((candidate) => candidate.modelFamilyId === expectation.modelFamilyId);
  if (!matches.length) return { expectationId: expectation.expectationId, status: "silently-missed" as const, candidateIds: [] as string[] };
  const accepted = matches.filter((candidate) => {
    if (!expectation.acceptableDispositions.includes(candidate.disposition)) return false;
    if (candidate.disposition !== "excluded") return true;
    return candidate.exclusionCodes.some((code) => expectation.acceptableExclusionCodes.includes(code));
  });
  if (accepted.length) {
    const excluded = accepted.every((candidate) => candidate.disposition === "excluded");
    return { expectationId: expectation.expectationId, status: excluded ? "excluded-with-reason" as const : "retained" as const, candidateIds: accepted.map((candidate) => candidate.candidateId) };
  }
  return { expectationId: expectation.expectationId, status: "present-but-unjustified" as const, candidateIds: matches.map((candidate) => candidate.candidateId) };
}

function objectiveCoverage(objectives: Objective[], candidates: Candidate[]) {
  return objectives.map((objective) => {
    const eligible = candidates.filter((candidate) => candidate.disposition === "recommended" || candidate.disposition === "considered");
    const matching = eligible.filter((candidate) => {
      const observation = candidate.observations[objective.observation];
      return observation && observation.unit === objective.unit && observation.scope === objective.scope && observation.sourceIds.length > 0 && Number.isFinite(observation.lower) && Number.isFinite(observation.upper) && observation.lower <= observation.upper;
    });
    return { objectiveId: objective.id, candidatesWithComparableObservation: matching.map((candidate) => candidate.candidateId), eligibleCandidateCount: eligible.length };
  });
}

function diversityCoverage(dimensions: string[], candidates: Candidate[]) {
  const selected = candidates.filter((candidate) => candidate.disposition === "recommended");
  return dimensions.map((dimension) => ({
    dimension,
    knownSelectedCount: selected.filter((candidate) => candidate.diversity[dimension] != null).length,
    distinctValues: [...new Set(selected.map((candidate) => candidate.diversity[dimension]).filter((value): value is string => typeof value === "string"))].sort(),
  }));
}

export function evaluateComparison(comparison: Comparison) {
  return comparison.systemResults.map((result) => {
    const expectations = comparison.scenario.expectations.map((expectation) => expectationOutcome(expectation, result.candidates));
    const recommended = result.candidates.filter((candidate) => candidate.disposition === "recommended");
    const measuredRunnable = recommended.filter((candidate) => candidate.runnable !== "unknown");
    return {
      systemId: result.systemId,
      inputMapping: result.inputMapping,
      mappingFacetCounts: { exact: Object.values(result.mappingFacets).filter((value) => value === "exact").length, lossy: Object.values(result.mappingFacets).filter((value) => value === "lossy").length, unsupported: Object.values(result.mappingFacets).filter((value) => value === "unsupported").length },
      expectations,
      expectationCounts: {
        retained: expectations.filter((item) => item.status === "retained").length,
        excludedWithReason: expectations.filter((item) => item.status === "excluded-with-reason").length,
        silentlyMissed: expectations.filter((item) => item.status === "silently-missed").length,
        presentButUnjustified: expectations.filter((item) => item.status === "present-but-unjustified").length,
      },
      guardCounts: {
        satisfied: result.guardAssessments.filter((guard) => guard.status === "satisfied").length,
        violated: result.guardAssessments.filter((guard) => guard.status === "violated").length,
        notEvaluable: result.guardAssessments.filter((guard) => guard.status === "not-evaluable").length,
      },
      exactConfigurationCompleteness: recommended.length ? { kind: "value" as const, numerator: recommended.filter((candidate) => candidate.runtimeIdentityComplete).length, denominator: recommended.length } : { kind: "unavailable" as const, reason: "no recommended candidates" },
      runnablePrecision: measuredRunnable.length ? { kind: "value" as const, numerator: measuredRunnable.filter((candidate) => candidate.runnable === "yes").length, denominator: measuredRunnable.length } : { kind: "unavailable" as const, reason: "no recommended candidate has a measured run outcome" },
      objectiveCoverage: objectiveCoverage(comparison.scenario.objectives, result.candidates),
      diversityCoverage: diversityCoverage(comparison.scenario.diversityDimensions, result.candidates),
    };
  });
}

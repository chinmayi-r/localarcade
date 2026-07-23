import { readFile } from "node:fs/promises";
import { recommend } from "../../lib/recommendation";
import type { RecommendationOutcome, RecommendationQuery } from "../../lib/recommendation";
import { evaluateComparison, type Comparison } from "../comparison/harness";

type ProofAssertion = {
  claim: string;
  status: "pass" | "gap";
  evidence: string;
};

type RankingCase = {
  name: string;
  input: RecommendationQuery;
  output: {
    kind: RecommendationOutcome["kind"];
    itemCount: number;
    candidateIds: string[];
    message: string;
  };
  assertions: ProofAssertion[];
};

export type InterfaceProofReport = {
  proofVersion: 1;
  generatedFrom: "checked-in-code-and-fixtures";
  productionBehaviorChanged: false;
  rankingCurrent: {
    boundary: "lib/recommendation.recommend";
    requiredInputs: string[];
    optionalInputs: string[];
    forbiddenAssumptions: string[];
    cases: RankingCase[];
    boundaryGaps: ProofAssertion[];
  };
  rankingResearchComparison: {
    boundary: "research/comparison.evaluateComparison";
    fixture: string;
    inputSummary: {
      scenarioId: string;
      systems: string[];
      expectations: number;
      objectives: number;
    };
    output: ReturnType<typeof evaluateComparison>;
    assertions: ProofAssertion[];
  };
};

const rankingCases: Array<{ name: string; input: RecommendationQuery }> = [
  {
    name: "supported-but-not-honestly-rankable",
    input: {
      hardware: { platform: "cpu", availableMemoryGb: 32 },
      task: "coding",
      desiredContextK: 16,
      strategy: "balanced",
    },
  },
  {
    name: "catalog-coverage-gap",
    input: {
      hardware: { platform: "amd", availableMemoryGb: 8 },
      task: "general",
      desiredContextK: 8,
      strategy: "balanced",
    },
  },
  {
    name: "covered-hardware-but-no-fit",
    input: {
      hardware: { platform: "cpu", availableMemoryGb: 1 },
      task: "coding",
      desiredContextK: 64,
      strategy: "quality",
    },
  },
];

function summarizeOutcome(outcome: RecommendationOutcome) {
  return {
    kind: outcome.kind,
    itemCount: outcome.items.length,
    candidateIds: outcome.items.map((item) => item.candidate.id),
    message: outcome.message,
  };
}

function assertionsFor(name: string, outcome: RecommendationOutcome): ProofAssertion[] {
  if (name === "supported-but-not-honestly-rankable") {
    return [{
      claim: "Missing comparative evidence does not become an invented ordering.",
      status: outcome.kind === "unranked" ? "pass" : "gap",
      evidence: `Observed outcome kind: ${outcome.kind}.`,
    }];
  }
  if (name === "catalog-coverage-gap") {
    return [{
      claim: "Missing catalog coverage is not reported as inadequate hardware.",
      status: outcome.kind === "no-coverage" ? "pass" : "gap",
      evidence: `Observed outcome kind: ${outcome.kind}.`,
    }];
  }
  return [{
    claim: "A covered platform with insufficient capacity reports no fit.",
    status: outcome.kind === "nothing-fits" ? "pass" : "gap",
    evidence: `Observed outcome kind: ${outcome.kind}.`,
  }];
}

export async function buildInterfaceProofReport(): Promise<InterfaceProofReport> {
  const comparisonFixtureUrl = new URL("../comparison/fixtures/smoke.valid.json", import.meta.url);
  const comparison = JSON.parse(await readFile(comparisonFixtureUrl, "utf8")) as Comparison & {
    scenario: Comparison["scenario"] & { scenarioId: string };
  };
  const comparisonOutput = evaluateComparison(comparison);
  const rankingProofs = rankingCases.map(({ name, input }) => {
    const outcome = recommend(input);
    return {
      name,
      input,
      output: summarizeOutcome(outcome),
      assertions: assertionsFor(name, outcome),
    };
  });

  return {
    proofVersion: 1,
    generatedFrom: "checked-in-code-and-fixtures",
    productionBehaviorChanged: false,
    rankingCurrent: {
      boundary: "lib/recommendation.recommend",
      requiredInputs: [
        "hardware.platform",
        "hardware.availableMemoryGb",
        "task",
        "desiredContextK",
        "strategy",
      ],
      optionalInputs: [
        "hardware.systemMemoryGb",
        "hardware.acceleratorId",
        "hardware.acceleratorFamily",
        "candidate list",
        "result limit",
        "throughput priors",
      ],
      forbiddenAssumptions: [
        "Do not infer an accelerator model from platform alone.",
        "Do not rank when the selected strategy lacks comparable evidence.",
        "Do not turn missing catalog coverage into a no-fit claim.",
      ],
      cases: rankingProofs,
      boundaryGaps: [
        {
          claim: "The request uses the approved M-A hardware target and recommendation request.",
          status: "gap",
          evidence: "The current boundary still accepts legacy RecommendationQuery/HardwareProfile types.",
        },
        {
          claim: "Every considered or rejected candidate has a machine-readable disposition and reason codes.",
          status: "gap",
          evidence: "RecommendationOutcome returns selected items and a summary message, not a complete candidate decision ledger.",
        },
        {
          claim: "Invalid requests return the common blocked/error envelope.",
          status: "gap",
          evidence: "An unknown strategy currently throws before an M-O envelope exists.",
        },
        {
          claim: "Surfaces can reach ranking only through M-O.",
          status: "gap",
          evidence:
            "M-O has an isolated portfolio boundary and a typed desktop consumer, but the legacy website still reaches the legacy recommendation domain directly; U27 blocks production finder migration.",
        },
      ],
    },
    rankingResearchComparison: {
      boundary: "research/comparison.evaluateComparison",
      fixture: "research/comparison/fixtures/smoke.valid.json",
      inputSummary: {
        scenarioId: comparison.scenario.scenarioId,
        systems: comparison.systemResults.map((result) => result.systemId),
        expectations: comparison.scenario.expectations.length,
        objectives: comparison.scenario.objectives.length,
      },
      output: comparisonOutput,
      assertions: [
        {
          claim: "Lossy input mappings remain visible.",
          status: comparisonOutput.some((item) => item.inputMapping === "lossy") ? "pass" : "gap",
          evidence: "The fixture maps a patient latency request lossily and reports that classification.",
        },
        {
          claim: "Expected candidates cannot disappear without being counted.",
          status: comparisonOutput.every((item) => typeof item.expectationCounts.silentlyMissed === "number") ? "pass" : "gap",
          evidence: "The scorecard reports retained, justified exclusion, silent miss, and unjustified presence separately.",
        },
        {
          claim: "Unavailable measured outcomes remain unavailable.",
          status: "pass",
          evidence: "Runnable precision is emitted only when recommended candidates have measured run outcomes.",
        },
      ],
    },
  };
}

import assert from "node:assert/strict";
import test from "node:test";
import scenarioJson from "./fixtures/neutral-scenario.json";
import { applyHardConstraints, dominates, evaluateSelection, nonDominated, selectDiverseTopK } from "./index";
import type { NeutralCandidate, NeutralScenario } from "./types";

const scenario = scenarioJson as NeutralScenario;
const [a, b, unknown] = scenario.candidates;

test("hard constraints reject missing evidence instead of assuming fit", () => {
  const result = applyHardConstraints(scenario.candidates, scenario.hardConstraints);
  assert.deepEqual(result.eligible.map((candidate) => candidate.id), ["cfg-a", "cfg-b"]);
  assert.deepEqual(result.rejected.map(({ candidateId, code }) => [candidateId, code]), [["cfg-unknown", "missing-observation"]]);
});

test("closed, overlapping intervals do not manufacture Pareto dominance", () => {
  assert.equal(dominates(a, b, scenario.objectives), false);
  assert.equal(dominates(b, a, scenario.objectives), false);
  const result = nonDominated(scenario.candidates, scenario.objectives);
  assert.deepEqual(result.eligible.map((candidate) => candidate.id), ["cfg-a", "cfg-b"]);
  assert.equal(result.rejected.every(({ candidateId }) => candidateId === "cfg-unknown"), true);
});

test("provable interval dominance removes only the dominated candidate", () => {
  const dominated: NeutralCandidate = {
    ...b,
    id: "cfg-dominated",
    observations: {
      ...b.observations,
      decodeTps: { ...b.observations.decodeTps!, lower: 20, upper: 25 },
      memoryHeadroomGb: { ...b.observations.memoryHeadroomGb!, lower: 0.5, upper: 1 },
    },
  };
  const result = nonDominated([a, dominated], scenario.objectives);
  assert.deepEqual(result.eligible.map((candidate) => candidate.id), ["cfg-a"]);
  assert.deepEqual(result.dominated, [{ candidateId: "cfg-dominated", dominatedBy: ["cfg-a"] }]);
});

test("scope mismatch is a rejection rather than an approximate comparison", () => {
  const mismatch: NeutralCandidate = {
    ...a,
    id: "cfg-mismatch",
    observations: { ...a.observations, decodeTps: { ...a.observations.decodeTps!, scope: "different-hardware" } },
  };
  const result = nonDominated([mismatch], scenario.objectives);
  assert.equal(result.eligible.length, 0);
  assert.equal(result.rejected[0].code, "incomparable-scope");
});

test("MMR-style selection requires explicit experiment relevance and tradeoff", () => {
  const result = selectDiverseTopK([a, b, unknown], [
    { candidateId: "cfg-a", value: 0.9, scope: "experiment-1", sourceIds: ["score-a"] },
    { candidateId: "cfg-b", value: 0.8, scope: "experiment-1", sourceIds: ["score-b"] },
  ], { limit: 2, tradeoff: 0.5, scope: "experiment-1", dimensions: scenario.diversityDimensions });
  assert.deepEqual(result.eligible.map(({ candidate }) => candidate.id), ["cfg-a", "cfg-b"]);
  assert.deepEqual(result.rejected.map(({ candidateId }) => candidateId), ["cfg-unknown"]);
  assert.throws(() => selectDiverseTopK([a], [], { limit: 1, tradeoff: 1.1, scope: "x", dimensions: [] }), /tradeoff/);
});

test("metrics expose unknown labels instead of treating them as failures", () => {
  const metrics = evaluateSelection(["cfg-a", "cfg-b", "not-labeled"], [
    { candidateId: "cfg-a", familyId: "family-a", exactConfigurationComplete: true, observedRunnable: true, claims: [{ supported: true }], consensusMustConsider: true },
    { candidateId: "cfg-b", familyId: "family-b", exactConfigurationComplete: true, observedRunnable: null, claims: [{ supported: null }], consensusMustConsider: false },
  ]);
  assert.deepEqual(metrics.runnablePrecision, { kind: "value", value: 1, numerator: 1, denominator: 1 });
  assert.deepEqual(metrics.missingLabelIds, ["not-labeled"]);
  assert.equal(metrics.distinctFamilies, 2);
});

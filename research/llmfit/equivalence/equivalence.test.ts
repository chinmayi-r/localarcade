import assert from "node:assert/strict";
import test from "node:test";
import scenariosJson from "./fixtures/scenarios.json";
import negativeJson from "./fixtures/negative.json";
import { compareFitScenario, validateScenario } from "./harness";
import type { EquivalenceScenario } from "./types";

const scenarios = scenariosJson as EquivalenceScenario[];

test("corpus demonstrates agreement, disagreement, and unrepresentable mappings", () => {
  assert.deepEqual(
    scenarios.map((scenario) => compareFitScenario(scenario).outcome),
    ["agreement", "disagreement", "unrepresentable"],
  );

  for (const scenario of scenarios) {
    const result = compareFitScenario(scenario);
    assert.equal(result.outcome, scenario.expectedOutcome, scenario.id);
  }
});

test("agreement includes the Local Arcade component output", () => {
  const result = compareFitScenario(scenarios[0]);
  assert.equal(result.local?.requiredBytes, 7_247_757_312);
  assert.deepEqual(result.local?.breakdown, {
    weightsBytes: 4_294_967_296,
    kvCacheBytes: 536_870_912,
    runtimeComputeBufferBytes: 536_870_912,
    osReserveBytes: 1_073_741_824,
    displayReserveBytes: 268_435_456,
    safetyMarginBytes: 536_870_912,
  });
  assert.deepEqual(result.differences, []);
});

test("disagreement preserves the fit decision and byte delta instead of averaging them", () => {
  const result = compareFitScenario(scenarios[1]);
  assert.equal(result.outcome, "disagreement");
  assert.deepEqual(result.differences.map(({ field }) => field), ["fits", "requiredBytes"]);
  assert.match(result.reasons.join(" "), /upstream=true, local=false/);
});

test("unsupported topology fails closed without invoking Local Arcade fit", () => {
  const result = compareFitScenario(scenarios[2]);
  assert.equal(result.outcome, "unrepresentable");
  assert.equal(result.local, null);
  assert.match(result.reasons.join(" "), /heterogeneous multi-GPU/);
  assert.match(result.reasons.join(" "), /per-device tensor placement/);
});

test("negative fixtures are rejected for their declared reason", () => {
  for (const fixture of negativeJson) {
    const issues = validateScenario(fixture.scenario);
    assert.ok(
      issues.some((issue) => issue.includes(fixture.expectedIssue)),
      `${fixture.name}: expected ${fixture.expectedIssue}, received ${issues.join(" ")}`,
    );
    assert.throws(
      () => compareFitScenario(fixture.scenario as unknown as EquivalenceScenario),
      /Invalid equivalence scenario/,
    );
  }
});

test("a different upstream release cannot be presented as an equivalence result", () => {
  const scenario = structuredClone(scenarios[0]);
  scenario.upstream.source.version = "1.1.7";
  scenario.upstream.source.commit = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

  const issues = validateScenario(scenario);
  assert.ok(issues.some((issue) => issue.includes("pinned 1.1.6")));
  assert.ok(
    issues.some((issue) =>
      issue.includes("aaa2bc179cec214ccdc44501c853b98fba0b343b"),
    ),
  );
  assert.throws(() => compareFitScenario(scenario), /Invalid equivalence scenario/);
});

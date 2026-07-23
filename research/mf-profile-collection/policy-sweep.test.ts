import assert from "node:assert/strict";
import test from "node:test";
import { policySweepFixture } from "./fixtures";
import { evaluatePolicySweep } from "./policy-sweep";

test("the synthetic sweep reports each policy without selecting a winner", () => {
  const report = evaluatePolicySweep(policySweepFixture());
  assert.equal(report.status, "analysis-only");
  assert.equal(report.selectedPolicy, null);
  assert.equal(report.results.length, 2);
  assert.deepEqual(report.results[0], {
    policyId: "synthetic-zero",
    evaluatedCases: 2,
    unknownCases: 1,
    falseFits: 0,
    falseNoFits: 0,
    correctFits: 1,
    correctNoFits: 1,
  });
  assert.deepEqual(report.results[1], {
    policyId: "synthetic-conservative",
    evaluatedCases: 2,
    unknownCases: 1,
    falseFits: 0,
    falseNoFits: 1,
    correctFits: 0,
    correctNoFits: 1,
  });
  assert.ok(report.warnings.every((warning) => warning.trim().length > 0));
});

test("invalid candidate values do not become hidden defaults", () => {
  const fixture = policySweepFixture();
  fixture.policies[0]!.safetyMarginBps = -1;
  assert.throws(() => evaluatePolicySweep(fixture), TypeError);
});

test("policy evaluation is deterministic and input-immutable", () => {
  const fixture = policySweepFixture();
  const before = structuredClone(fixture);
  assert.deepEqual(evaluatePolicySweep(fixture), evaluatePolicySweep(fixture));
  assert.deepEqual(fixture, before);
});

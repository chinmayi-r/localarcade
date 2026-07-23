import assert from "node:assert/strict";
import test from "node:test";
import { buildInterfaceProofReport } from "./report";

test("interface proof exposes current ranking outcomes and boundary gaps", async () => {
  const report = await buildInterfaceProofReport();
  assert.equal(report.productionBehaviorChanged, false);
  assert.deepEqual(
    report.rankingCurrent.cases.map((item) => item.output.kind),
    ["unranked", "no-coverage", "nothing-fits"],
  );
  assert.ok(report.rankingCurrent.cases.every((item) => item.assertions.every((assertion) => assertion.status === "pass")));
  assert.equal(report.rankingCurrent.boundaryGaps.length, 4);
  assert.ok(report.rankingCurrent.boundaryGaps.every((gap) => gap.status === "gap"));
});

test("comparison proof retains mapping and candidate-disposition accounting", async () => {
  const report = await buildInterfaceProofReport();
  const [comparison] = report.rankingResearchComparison.output;
  assert.equal(comparison.inputMapping, "lossy");
  assert.deepEqual(comparison.expectationCounts, {
    retained: 1,
    excludedWithReason: 1,
    silentlyMissed: 0,
    presentButUnjustified: 0,
  });
});

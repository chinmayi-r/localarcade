import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { evaluateComparison, normalizeRetrievalDate, type Comparison } from "./harness";

const fixture = JSON.parse(await readFile(new URL("./fixtures/smoke.valid.json", import.meta.url), "utf8"));

test("date-only retrievals normalize deterministically without inventing precision", () => {
  assert.deepEqual(normalizeRetrievalDate("2026-07-22"), { retrievedAt: "2026-07-22T00:00:00Z", retrievalPrecision: "date" });
  assert.deepEqual(normalizeRetrievalDate("2026-07-22T16:30:00-07:00"), { retrievedAt: "2026-07-22T23:30:00.000Z", retrievalPrecision: "date-time" });
  assert.throws(() => normalizeRetrievalDate("not-a-date"));
});

test("expectations distinguish retention, stable exclusion and silent misses", () => {
  const [score] = evaluateComparison(fixture as Comparison);
  assert.deepEqual(score.expectationCounts, { retained: 1, excludedWithReason: 1, silentlyMissed: 0, presentButUnjustified: 0 });
  const missing = structuredClone(fixture);
  missing.systemResults[0].candidates = missing.systemResults[0].candidates.filter((candidate: { modelFamilyId: string }) => candidate.modelFamilyId !== "family-b");
  assert.equal(evaluateComparison(missing as Comparison)[0].expectationCounts.silentlyMissed, 1);
});

test("unapproved exclusion codes are not credited", () => {
  const invalidReason = structuredClone(fixture);
  invalidReason.systemResults[0].candidates[1].exclusionCodes = ["UNRELATED"];
  assert.equal(evaluateComparison(invalidReason as Comparison)[0].expectationCounts.presentButUnjustified, 1);
});

test("scoped objective and diversity coverage remain separate", () => {
  const [score] = evaluateComparison(fixture as Comparison);
  assert.deepEqual(score.objectiveCoverage[0], { objectiveId: "decode", candidatesWithComparableObservation: ["candidate-a"], eligibleCandidateCount: 1 });
  assert.deepEqual(score.diversityCoverage, [
    { dimension: "family", knownSelectedCount: 1, distinctValues: ["family-a"] },
    { dimension: "runtime", knownSelectedCount: 1, distinctValues: ["llama.cpp"] },
  ]);
});

test("unsupported mapping and empty results produce unavailable metrics", async () => {
  const unknown = JSON.parse(await readFile(new URL("./fixtures/unknown-hardware.valid.json", import.meta.url), "utf8"));
  const [score] = evaluateComparison(unknown as Comparison);
  assert.equal(score.inputMapping, "unsupported");
  assert.equal(score.mappingFacetCounts.unsupported, 4);
  assert.equal(score.exactConfigurationCompleteness.kind, "unavailable");
  assert.equal(score.runnablePrecision.kind, "unavailable");
  assert.equal(score.guardCounts.satisfied, 1);
});

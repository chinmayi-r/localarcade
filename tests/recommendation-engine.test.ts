import assert from "node:assert/strict";
import test from "node:test";
import { recommend, strategyOptions } from "../lib/recommendation/index";
import type { RecommendationQuery, StrategyId } from "../lib/recommendation/types";

const baseQuery: RecommendationQuery = {
  hardware: { platform: "nvidia", availableMemoryGb: 24 },
  task: "coding",
  desiredContextK: 32,
  strategy: "balanced",
};

test("every visible strategy is implemented and returns bounded results", () => {
  for (const strategy of strategyOptions) {
    const results = recommend({ ...baseQuery, strategy: strategy.id });
    assert.ok(results.length > 0, strategy.id);
    assert.ok(results.length <= 5, strategy.id);
    assert.deepEqual(results.map((result) => result.rank), results.map((_, index) => index + 1));
  }
});

test("recommendations never exceed the configured memory safety envelope", () => {
  for (const memory of [4, 8, 12, 16, 24, 32, 64, 128]) {
    const results = recommend({ ...baseQuery, hardware: { ...baseQuery.hardware, availableMemoryGb: memory } });
    for (const result of results) assert.ok(result.requiredMemoryGb <= memory * 0.86, `${result.artifact.id} at ${memory} GB`);
  }
});

test("recommendations satisfy desired context", () => {
  for (const desiredContextK of [8, 16, 32, 64]) {
    const results = recommend({ ...baseQuery, desiredContextK });
    for (const result of results) {
      assert.ok(result.artifact.maxContextK >= desiredContextK);
      assert.equal(result.configuration.contextK, desiredContextK);
      assert.equal(result.configuration.runtime, result.artifact.runtime);
    }
  }
});

test("one model family cannot occupy multiple top-five slots", () => {
  const results = recommend(baseQuery);
  const families = results.map((result) => result.artifact.family);
  assert.equal(new Set(families).size, families.length);
});

test("strategy changes can change ordering without changing eligibility", () => {
  const order = (strategy: StrategyId) => recommend({ ...baseQuery, strategy }).map((result) => result.artifact.id);
  assert.notDeepEqual(order("quality"), order("speed"));
  assert.notDeepEqual(order("long-context"), order("lightest"));
});

test("unknown strategies fail closed", () => {
  assert.throws(() => recommend({ ...baseQuery, strategy: "mystery" as StrategyId }), /Unknown ranking strategy/);
});

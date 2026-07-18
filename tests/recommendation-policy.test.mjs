import assert from "node:assert/strict";
import test from "node:test";
import { blockingConditions, decideRecommendation, dimensions } from "../lib/recommendation/safety-policy.mjs";

function* states() {
  for (const hardware of dimensions.hardware)
    for (const evidence of dimensions.evidence)
      for (const runner of dimensions.runner)
        for (const artifact of dimensions.artifact)
          for (const network of dimensions.network)
            yield { hardware, evidence, runner, artifact, network };
}

test("every declared state combination produces a complete decision", () => {
  let count = 0;
  for (const state of states()) {
    const result = decideRecommendation(state);
    assert.ok(result.ranking.kind, JSON.stringify(state));
    assert.ok(result.ranking.label, JSON.stringify(state));
    assert.ok(result.benchmark.action, JSON.stringify(state));
    assert.equal(typeof result.authorization.mayDownload, "boolean");
    assert.equal(typeof result.authorization.mayExecute, "boolean");
    assert.equal(result.claims.mustShowProvenance, true);
    assert.equal(result.claims.mustShowUncertainty, true);
    count++;
  }
  assert.equal(count, 432);
});

test("downloads and execution are impossible without separate consent", () => {
  for (const state of states()) {
    const withoutConsent = decideRecommendation(state);
    assert.equal(withoutConsent.authorization.mayDownload, false, JSON.stringify(state));
    assert.equal(withoutConsent.authorization.mayExecute, false, JSON.stringify(state));

    const withDownloadOnly = decideRecommendation({ ...state, downloadConsent: true });
    assert.equal(withDownloadOnly.authorization.mayExecute, false, JSON.stringify(state));

    const withRunOnly = decideRecommendation({ ...state, runConsent: true });
    assert.equal(withRunOnly.authorization.mayDownload, false, JSON.stringify(state));
  }
});

test("only exact evidence can receive a verified label", () => {
  for (const state of states()) {
    const result = decideRecommendation(state);
    if (result.claims.maySayVerified) {
      assert.equal(state.hardware, "complete");
      assert.equal(state.evidence, "exact");
      assert.equal(result.ranking.kind, "verified");
    }
    assert.equal(result.claims.maySayBest, false);
  }
});

test("missing evidence never creates an ordered ranking", () => {
  for (const state of states()) {
    if (state.evidence !== "none") continue;
    const result = decideRecommendation(state);
    assert.ok(["none", "compatibility-only"].includes(result.ranking.kind));
  }
});

test("declining the runner preserves ranking and suppresses benchmark prompts", () => {
  for (const state of states()) {
    if (state.runner !== "declined") continue;
    const result = decideRecommendation(state);
    assert.notEqual(result.ranking.kind, undefined);
    assert.equal(result.benchmark.action, "none");
  }
});

test("no installed model has explicit offline, metered, and unmetered behavior", () => {
  const base = { hardware: "complete", evidence: "metadata", runner: "available", artifact: "none" };
  assert.equal(decideRecommendation({ ...base, network: "offline" }).benchmark.action, "none");
  assert.equal(decideRecommendation({ ...base, network: "online-metered" }).benchmark.action, "offer-metered-download");
  assert.equal(decideRecommendation({ ...base, network: "online-unmetered" }).benchmark.action, "offer-download");
});

test("every safety blocker prevents an otherwise available benchmark action", () => {
  const base = { hardware: "complete", evidence: "metadata", runner: "available", artifact: "exact-candidate", network: "online-unmetered", runConsent: true };
  for (const blocker of blockingConditions) {
    const result = decideRecommendation({ ...base, blockers: [blocker] });
    assert.equal(result.benchmark.action, "blocked", blocker);
    assert.equal(result.authorization.mayExecute, false, blocker);
    assert.ok(result.benchmark.reason, blocker);
  }
});

test("unknown future states fail closed instead of choosing a default", () => {
  assert.throws(() => decideRecommendation({ hardware: "mystery", evidence: "none", runner: "absent", artifact: "none", network: "offline" }), /Unknown hardware/);
});

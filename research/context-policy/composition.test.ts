import assert from "node:assert/strict";
import test from "node:test";
import { validateContract } from "../../lib/contracts";
import { compileRecommendationRequest } from "../../lib/orchestrator/context";

function input() {
  return {
    requestId: "request-context-proof",
    hardwareTargetId: "hardware-context-proof",
    context: {
      policyVersion: 1 as const,
      mode: "novice" as const,
      task: {
        family: "coding" as const,
        scope: "few-files" as const,
      },
    },
    interactionStyle: "interactive" as const,
    needs: ["structured-output", "offline"] as const,
    preferences: {
      priority: "balanced" as const,
      allowCpuOffload: true,
      installedOnly: false,
    },
    advanced: {
      forcedRuntime: null,
      maximumArtifactBytes: null,
    },
    provenance: [],
  };
}

test("M-O composes the policy decision into a complete M-A request", () => {
  const value = input();
  const result = compileRecommendationRequest({
    ...value,
    needs: [...value.needs],
  });
  assert.equal(result.status, "ok");
  assert.ok(validateContract(result).ok);
  if (result.status !== "ok") return;
  assert.deepEqual(result.data.task, {
    family: "coding",
    interactionStyle: "interactive",
    scopeLabel: "a few project files",
    derivedContextTokens: 16_384,
    needs: ["structured-output", "offline"],
  });
  assert.equal("scopeId" in result.data.task, false);
  assert.match(result.completeness.warnings[0] ?? "", /not proof/i);
});

test("expert override remains exact in the complete M-A request", () => {
  const value = input();
  const result = compileRecommendationRequest({
    ...value,
    context: {
      policyVersion: 1,
      mode: "expert-override",
      task: { family: "other", scopeLabel: "specialized corpus" },
      contextTokens: 12_345,
    },
    needs: [...value.needs],
  });
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.data.task.derivedContextTokens, 12_345);
});

test("unsupported policy states and invalid remaining fields stay nondata", () => {
  const value = input();
  let result = compileRecommendationRequest({
    ...value,
    context: {
      policyVersion: 1,
      mode: "novice",
      task: {
        family: "coding",
        scope: "future-scope",
      } as never,
    },
    needs: [...value.needs],
  });
  assert.equal(result.status, "unavailable");

  result = compileRecommendationRequest({
    ...value,
    interactionStyle: "future" as never,
    needs: [...value.needs],
  });
  assert.equal(result.status, "blocked");
});

test("duplicate needs and hostile inputs fail closed without mutation", () => {
  const value = input();
  const duplicate = compileRecommendationRequest({
    ...value,
    needs: ["offline", "offline"],
  });
  assert.equal(duplicate.status, "blocked");

  const hostile = new Proxy({}, {
    getPrototypeOf(): never {
      throw new Error("hostile");
    },
  });
  assert.doesNotThrow(() =>
    compileRecommendationRequest(hostile as never));
  assert.equal(compileRecommendationRequest(hostile as never).status, "error");
});

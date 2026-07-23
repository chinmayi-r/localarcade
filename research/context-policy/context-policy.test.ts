import assert from "node:assert/strict";
import test from "node:test";

import { deriveTaskContext } from "../../lib/context-policy";

const noviceCases = [
  ["coding", "snippet", 4_096],
  ["coding", "single-file", 8_192],
  ["coding", "few-files", 16_384],
  ["coding", "repository", 32_768],
  ["writing", "short-form", 4_096],
  ["writing", "document", 8_192],
  ["writing", "long-document", 32_768],
  ["extraction", "single-record", 4_096],
  ["extraction", "document", 8_192],
  ["extraction", "document-set", 32_768],
  ["general", "quick-question", 4_096],
  ["general", "conversation", 8_192],
  ["general", "reference-material", 16_384],
] as const;

test("policy v1 derives every documented novice task/scope target", () => {
  for (const [family, scope, expected] of noviceCases) {
    const result = deriveTaskContext({
      policyVersion: 1,
      mode: "novice",
      task: { family, scope },
    });
    assert.equal(result.status, "ok");
    if (result.status !== "ok") continue;
    assert.equal(result.data.source, "novice-derived");
    assert.equal(result.data.task.family, family);
    assert.equal(result.data.task.scopeId, scope);
    assert.equal(result.data.task.derivedContextTokens, expected);
    assert.match(result.warnings[0] ?? "", /not proof/i);
  }
});

test("policy v1 maps coding across a few files to its versioned 16K planning target", () => {
  const result = deriveTaskContext({
    policyVersion: 1,
    mode: "novice",
    task: { family: "coding", scope: "few-files" },
  });
  assert.deepEqual(result, {
    status: "ok",
    data: {
      policyId: "local-arcade.task-context",
      policyVersion: 1,
      source: "novice-derived",
      task: {
        family: "coding",
        scopeId: "few-files",
        scopeLabel: "a few project files",
        derivedContextTokens: 16_384,
      },
      explanation: "Policy v1 recommends 16384 tokens for a few project files.",
    },
    warnings: ["This is a planning target, not proof that a configuration fits or can run."],
  });
});

test("expert override is preserved exactly and visibly labeled", () => {
  const result = deriveTaskContext({
    policyVersion: 1,
    mode: "expert-override",
    task: { family: "other", scopeLabel: "a specialized legal corpus" },
    contextTokens: 12_345,
  });
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.data.source, "expert-override");
  assert.equal(result.data.task.scopeId, null);
  assert.equal(result.data.task.derivedContextTokens, 12_345);
  assert.match(result.warnings[0] ?? "", /fit checks/i);
});

test("unknown task/scope combinations are unavailable, never defaulted", () => {
  const results = [
    deriveTaskContext({
      policyVersion: 1,
      mode: "novice",
      task: { family: "other", scope: "custom" },
    }),
    deriveTaskContext({
      policyVersion: 1,
      mode: "novice",
      task: { family: "coding", scope: "future-mega-project" },
    }),
    deriveTaskContext({
      policyVersion: 1,
      mode: "novice",
      task: { family: "future-task", scope: "brief" },
    }),
  ];
  for (const result of results) {
    assert.equal(result.status, "unavailable");
    if (result.status === "unavailable") {
      assert.equal(result.reasonCode, "context-policy.unsupported-task-scope");
    }
  }
});

test("malformed, extra, and future-version inputs fail closed", () => {
  const inputs: unknown[] = [
    null,
    [],
    {},
    { policyVersion: 2, mode: "novice", task: { family: "coding", scope: "snippet" } },
    { policyVersion: 1, mode: "future", task: { family: "coding", scope: "snippet" } },
    { policyVersion: 1, mode: "novice", task: { family: "coding", scope: "snippet" }, tokens: 4_096 },
    { policyVersion: 1, mode: "novice", task: { family: "coding" } },
    { policyVersion: 1, mode: "novice", task: { family: "coding", scope: "snippet", hidden: true } },
    { policyVersion: 1, mode: "expert-override", task: { family: "general", scopeLabel: "" }, contextTokens: 4_096 },
    { policyVersion: 1, mode: "expert-override", task: { family: "general", scopeLabel: "test" }, contextTokens: 0 },
    { policyVersion: 1, mode: "expert-override", task: { family: "general", scopeLabel: "test" }, contextTokens: 1.5 },
    { policyVersion: 1, mode: "expert-override", task: { family: "future", scopeLabel: "test" }, contextTokens: 4_096 },
  ];
  for (const input of inputs) {
    assert.equal(deriveTaskContext(input).status, "blocked");
  }
});

test("input objects are not mutated", () => {
  const input = {
    policyVersion: 1 as const,
    mode: "novice" as const,
    task: { family: "coding" as const, scope: "few-files" as const },
  };
  const before = structuredClone(input);
  deriveTaskContext(input);
  assert.deepEqual(input, before);
});

test("hostile objects are converted to blocked results rather than thrown", () => {
  const hostile = new Proxy({}, {
    getOwnPropertyDescriptor() {
      throw new Error("hostile");
    },
  });
  assert.doesNotThrow(() => deriveTaskContext(hostile));
  assert.equal(deriveTaskContext(hostile).status, "blocked");
});

test("accessor properties are rejected without executing them", () => {
  let getterRuns = 0;
  const input = {
    mode: "novice",
    task: { family: "coding", scope: "snippet" },
  } as Record<string, unknown>;
  Object.defineProperty(input, "policyVersion", {
    enumerable: true,
    get() {
      getterRuns += 1;
      return 1;
    },
  });
  const result = deriveTaskContext(input);
  assert.equal(result.status, "blocked");
  assert.equal(getterRuns, 0);

  const nested = {
    policyVersion: 1,
    mode: "novice",
    task: {},
  } as Record<string, unknown>;
  Object.defineProperty(nested.task, "family", {
    enumerable: true,
    get() {
      getterRuns += 1;
      return "coding";
    },
  });
  Object.defineProperty(nested.task, "scope", {
    enumerable: true,
    value: "snippet",
  });
  assert.equal(deriveTaskContext(nested).status, "blocked");
  assert.equal(getterRuns, 0);
});

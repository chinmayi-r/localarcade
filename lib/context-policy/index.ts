import {
  taskContextPolicyId,
  taskContextPolicyVersion,
  type TaskContextDecisionV1,
  type TaskContextPolicyInputV1,
  type TaskContextPolicyResultV1,
} from "./types";

export * from "./types";

type NoviceRule = {
  family: "coding" | "writing" | "extraction" | "general";
  scope: string;
  scopeLabel: string;
  contextTokens: number;
};

const noviceRules: readonly NoviceRule[] = Object.freeze([
  Object.freeze({ family: "coding", scope: "snippet", scopeLabel: "a code snippet", contextTokens: 4_096 }),
  Object.freeze({ family: "coding", scope: "single-file", scopeLabel: "one code file", contextTokens: 8_192 }),
  Object.freeze({ family: "coding", scope: "few-files", scopeLabel: "a few project files", contextTokens: 16_384 }),
  Object.freeze({ family: "coding", scope: "repository", scopeLabel: "a larger repository", contextTokens: 32_768 }),
  Object.freeze({ family: "writing", scope: "short-form", scopeLabel: "short-form writing", contextTokens: 4_096 }),
  Object.freeze({ family: "writing", scope: "document", scopeLabel: "one document", contextTokens: 8_192 }),
  Object.freeze({ family: "writing", scope: "long-document", scopeLabel: "a long document", contextTokens: 32_768 }),
  Object.freeze({ family: "extraction", scope: "single-record", scopeLabel: "one record", contextTokens: 4_096 }),
  Object.freeze({ family: "extraction", scope: "document", scopeLabel: "one document", contextTokens: 8_192 }),
  Object.freeze({ family: "extraction", scope: "document-set", scopeLabel: "a set of documents", contextTokens: 32_768 }),
  Object.freeze({ family: "general", scope: "quick-question", scopeLabel: "a quick question", contextTokens: 4_096 }),
  Object.freeze({ family: "general", scope: "conversation", scopeLabel: "an ongoing conversation", contextTokens: 8_192 }),
  Object.freeze({ family: "general", scope: "reference-material", scopeLabel: "supplied reference material", contextTokens: 16_384 }),
]);

const taskFamilies = new Set(["coding", "writing", "extraction", "general", "other"]);

function keysExactly(value: object, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length
    && keys.every((key, index) => key === [...expected].sort()[index]);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(Object.getOwnPropertyDescriptors(value))
    .every((descriptor) => !("get" in descriptor) && !("set" in descriptor));
}

function blocked(message: string): TaskContextPolicyResultV1 {
  return {
    status: "blocked",
    reasonCode: "context-policy.invalid-input",
    message,
    recoverableActions: ["Correct the task and scope selection, then try again."],
  };
}

function unavailable(family: string, scope: string): TaskContextPolicyResultV1 {
  return {
    status: "unavailable",
    reasonCode: "context-policy.unsupported-task-scope",
    message: `Policy v1 does not derive a context target for task "${family}" and scope "${scope}".`,
    recoverableActions: [
      "Choose a supported novice task scope.",
      "Use the explicit expert context override.",
    ],
  };
}

function ok(
  source: TaskContextDecisionV1["source"],
  family: TaskContextDecisionV1["task"]["family"],
  scopeId: string | null,
  scopeLabel: string,
  derivedContextTokens: number,
): TaskContextPolicyResultV1 {
  const isOverride = source === "expert-override";
  return {
    status: "ok",
    data: {
      policyId: taskContextPolicyId,
      policyVersion: taskContextPolicyVersion,
      source,
      task: {
        family,
        scopeId,
        scopeLabel,
        derivedContextTokens,
      },
      explanation: isOverride
        ? `Using the explicitly entered expert context target of ${derivedContextTokens} tokens.`
        : `Policy v1 recommends ${derivedContextTokens} tokens for ${scopeLabel}.`,
    },
    warnings: isOverride
      ? ["An expert override still requires downstream artifact, runtime, and hardware fit checks."]
      : ["This is a planning target, not proof that a configuration fits or can run."],
  };
}

function evaluate(input: unknown): TaskContextPolicyResultV1 {
  if (!isPlainRecord(input)) return blocked("Context policy input must be a plain object.");
  if (input.policyVersion !== 1) {
    return blocked("Only task-context policyVersion 1 is supported.");
  }
  if (input.mode === "novice") {
    if (!keysExactly(input, ["policyVersion", "mode", "task"])) {
      return blocked("Novice input contains missing or unexpected fields.");
    }
    if (!isPlainRecord(input.task) || !keysExactly(input.task, ["family", "scope"])) {
      return blocked("Novice task must contain exactly family and scope.");
    }
    if (typeof input.task.family !== "string" || typeof input.task.scope !== "string") {
      return blocked("Novice task family and scope must be strings.");
    }
    const family = input.task.family;
    const scope = input.task.scope;
    const rule = noviceRules.find(
      (candidate) =>
        candidate.family === family
        && candidate.scope === scope,
    );
    if (!rule) return unavailable(family, scope);
    return ok(
      "novice-derived",
      rule.family,
      rule.scope,
      rule.scopeLabel,
      rule.contextTokens,
    );
  }

  if (input.mode === "expert-override") {
    if (!keysExactly(input, ["policyVersion", "mode", "task", "contextTokens"])) {
      return blocked("Expert override contains missing or unexpected fields.");
    }
    if (!isPlainRecord(input.task) || !keysExactly(input.task, ["family", "scopeLabel"])) {
      return blocked("Expert task must contain exactly family and scopeLabel.");
    }
    if (
      typeof input.task.family !== "string"
      || !taskFamilies.has(input.task.family)
      || typeof input.task.scopeLabel !== "string"
      || input.task.scopeLabel.trim().length === 0
    ) {
      return blocked("Expert task family and non-empty scopeLabel are required.");
    }
    if (!Number.isSafeInteger(input.contextTokens) || Number(input.contextTokens) <= 0) {
      return blocked("Expert contextTokens must be a positive safe integer.");
    }
    return ok(
      "expert-override",
      input.task.family as TaskContextDecisionV1["task"]["family"],
      null,
      input.task.scopeLabel,
      Number(input.contextTokens),
    );
  }

  return blocked("Context policy mode must be novice or expert-override.");
}

/**
 * Converts a novice task/scope choice or an explicit expert override into the
 * M-A recommendation request's context fields. It performs no I/O, fit check,
 * candidate selection, or side effect.
 */
export function deriveTaskContext(
  input: TaskContextPolicyInputV1 | unknown,
): TaskContextPolicyResultV1 {
  try {
    return evaluate(input);
  } catch {
    return blocked("Context policy input could not be inspected safely.");
  }
}

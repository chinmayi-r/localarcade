import {
  validateContract,
  type Need,
  type Provenance,
  type TypedEnvelope,
} from "../contracts";
import {
  deriveTaskContext,
  type TaskContextPolicyInputV1,
} from "../context-policy";

export type CompileRecommendationRequestInputV1 = {
  requestId: string;
  hardwareTargetId: string;
  context: TaskContextPolicyInputV1;
  interactionStyle: "interactive" | "batch";
  needs: Need[];
  preferences: {
    priority: "balanced" | "quality" | "speed" | "long-context" | "lightest";
    allowCpuOffload: boolean;
    installedOnly: boolean;
  };
  advanced: {
    forcedRuntime: string | null;
    maximumArtifactBytes: number | null;
  };
  provenance: Provenance[];
};

export type RecommendationRequestCompileResultV1 =
  | TypedEnvelope<"recommendation-request">
  | {
    schemaVersion: 1;
    contract: "recommendation-request";
    status: "unavailable" | "blocked" | "error";
    reasonCode: string;
    message: string;
    recoverableActions: string[];
    provenance: Provenance[];
    warnings: string[];
  };

/**
 * Owns the U30 composition seam. Policy-only scopeId is deliberately omitted;
 * M-O supplies the remaining M-A task/request fields and validates the complete
 * envelope before any candidate provider can see it.
 */
export function compileRecommendationRequest(
  input: CompileRecommendationRequestInputV1,
): RecommendationRequestCompileResultV1 {
  try {
    if (!plainData(input)) {
      return failure(
        "blocked",
        "orchestrator.request-input-invalid",
        "Recommendation request composition requires a plain input.",
      );
    }
    const context = deriveTaskContext(input.context);
    if (context.status !== "ok") {
      return {
        schemaVersion: 1,
        contract: "recommendation-request",
        status: context.status,
        reasonCode: context.reasonCode,
        message: context.message,
        recoverableActions: [...context.recoverableActions],
        provenance: validProvenanceArray(input.provenance)
          ? structuredClone(input.provenance)
          : [],
        warnings: [],
      };
    }
    if (!nonEmpty(input.requestId)
      || !nonEmpty(input.hardwareTargetId)
      || (input.interactionStyle !== "interactive"
        && input.interactionStyle !== "batch")
      || !Array.isArray(input.needs)
      || new Set(input.needs).size !== input.needs.length
      || !validProvenanceArray(input.provenance)) {
      return failure(
        "blocked",
        "orchestrator.request-input-invalid",
        "Recommendation request identifiers, interaction style, needs or provenance are invalid.",
      );
    }
    const envelope: TypedEnvelope<"recommendation-request"> = {
      schemaVersion: 1,
      contract: "recommendation-request",
      status: "ok",
      data: {
        requestId: input.requestId,
        hardwareTargetId: input.hardwareTargetId,
        task: {
          family: context.data.task.family,
          interactionStyle: input.interactionStyle,
          scopeLabel: context.data.task.scopeLabel,
          derivedContextTokens: context.data.task.derivedContextTokens,
          needs: [...input.needs],
        },
        preferences: structuredClone(input.preferences),
        advanced: structuredClone(input.advanced),
      },
      provenance: structuredClone(input.provenance),
      completeness: {
        complete: true,
        missing: [],
        warnings: [...context.warnings],
        recoverableActions: [],
      },
    };
    const validation = validateContract(envelope);
    return validation.ok
      ? deepFreeze(envelope)
      : failure(
        "blocked",
        "orchestrator.request-output-invalid",
        `The composed recommendation request is not M-A-valid: ${validation.errors.join(" ")}`,
      );
  } catch {
    return failure(
      "error",
      "orchestrator.request-input-hostile",
      "Recommendation request composition rejected a hostile input.",
    );
  }
}

function failure(
  status: "blocked" | "error",
  reasonCode: string,
  message: string,
): RecommendationRequestCompileResultV1 {
  return {
    schemaVersion: 1,
    contract: "recommendation-request",
    status,
    reasonCode,
    message,
    recoverableActions: [],
    provenance: [],
    warnings: [],
  };
}

function validProvenanceArray(value: unknown): value is Provenance[] {
  if (!Array.isArray(value)) return false;
  const carrier = {
    schemaVersion: 1,
    contract: "recommendation-request",
    status: "unavailable",
    reasonCode: "orchestrator.provenance-check",
    message: "Provenance validation carrier.",
    recoverableActions: [],
    provenance: value,
    warnings: [],
  } as const;
  return validateContract(carrier).ok;
}

function plainData(value: unknown, stack = new Set<object>()): boolean {
  if (value === null
    || typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean") return true;
  if (typeof value !== "object" || stack.has(value)) return false;
  stack.add(value);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== Array.prototype) {
    return false;
  }
  const valid = Object.values(Object.getOwnPropertyDescriptors(value))
    .every((descriptor) =>
      "value" in descriptor && plainData(descriptor.value, stack));
  stack.delete(value);
  return valid;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

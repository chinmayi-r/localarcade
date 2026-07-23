import { validateContract } from "../contracts/validator";
import type { TypedEnvelope } from "../contracts/types";
import type {
  AcceptedRunnerImportInspectionV1,
  BlockedRunnerImportInspectionV1,
  InspectRunnerImportInputV1,
  RunnerImportInspectionV1,
} from "./runner-import-types";

const inspectionBrands = new WeakMap<object, string>();

export type {
  AcceptedRunnerImportInspectionV1,
  BlockedRunnerImportInspectionV1,
  InspectRunnerImportInputV1,
  RunnerImportBundleEnvelopeV1,
  RunnerImportInspectionV1,
  RunnerImportIntentV1,
} from "./runner-import-types";

/**
 * Purely inspects a portable bundle. Expiry changes import confirmation state,
 * never schema validity and never execution authority.
 */
export function inspectRunnerImportBundle(
  input: InspectRunnerImportInputV1,
): RunnerImportInspectionV1 {
  try {
    if (!plainRecord(input, ["bundleEnvelope", "now", "intent"])
      || !validInstant(input.now)
      || (input.intent !== "inspect"
        && input.intent !== "confirm-expired-import")) {
      return blocked(
        "orchestrator.runner-import-input-invalid",
        "Import inspection requires an exact bundle, current time and explicit inspection intent.",
      );
    }

    if (!passivePlainData(input.bundleEnvelope)) {
      return blocked(
        "orchestrator.runner-import-bundle-hostile",
        "The runner import bundle contains unreadable or executable properties.",
      );
    }

    const snapshot = structuredClone(input.bundleEnvelope);
    const validation = validateContract(snapshot);
    if (!validation.ok
      || validation.value.contract !== "runner-import-bundle"
      || (validation.value.status !== "ok"
        && validation.value.status !== "partial")) {
      return blocked(
        "orchestrator.runner-import-bundle-invalid",
        "The runner import bundle failed its version, schema, identity or content-hash checks.",
        validation.ok ? [] : validation.errors,
      );
    }

    const envelope = validation.value as TypedEnvelope<"runner-import-bundle">;
    const nowMillis = Date.parse(input.now);
    const expired = nowMillis >= Date.parse(envelope.data.handoff.expiresAt);
    const confirmed = expired && input.intent === "confirm-expired-import";
    const expiryWarning = expired
      ? [
        `This handoff expired at ${envelope.data.handoff.expiresAt}. Expiry is informational; confirm before importing it.`,
      ]
      : [];
    const completenessWarnings = [
      ...envelope.completeness.warnings,
      ...(envelope.status === "partial"
        ? ["This valid bundle is marked partial; review its completeness before use."]
        : []),
    ];
    const result: AcceptedRunnerImportInspectionV1 = {
      inspectionVersion: 1,
      status: "accepted",
      disposition: expired
        ? (confirmed ? "expired-confirmed" : "expired-awaiting-confirmation")
        : "fresh",
      intent: input.intent,
      inspectedAt: input.now,
      bundleEnvelope: envelope,
      bundle: envelope.data,
      expired,
      canInspect: true,
      canImport: !expired || confirmed,
      requiresExpiryConfirmation: expired && !confirmed,
      sideEffectAuthorization: false,
      executionAuthorization: false,
      warnings: [...expiryWarning, ...completenessWarnings],
    };
    deepFreeze(result);
    inspectionBrands.set(result, stableJson(result));
    return result;
  } catch {
    return blocked(
      "orchestrator.runner-import-input-hostile",
      "Import inspection rejected hostile or unreadable input.",
    );
  }
}

/**
 * Later M-O previews may consume only the intact, process-local inspection.
 * Import permission is checked separately because expired inspection is valid.
 */
export function isIntactAcceptedRunnerImportInspection(
  value: unknown,
): value is AcceptedRunnerImportInspectionV1 {
  try {
    return plainData(value)
      && inspectionBrands.get(value) === stableJson(value);
  } catch {
    return false;
  }
}

export function isImportAllowedByInspection(
  value: unknown,
): value is AcceptedRunnerImportInspectionV1 & { canImport: true } {
  return isIntactAcceptedRunnerImportInspection(value) && value.canImport;
}

function blocked(
  reasonCode: string,
  message: string,
  warnings: string[] = [],
): BlockedRunnerImportInspectionV1 {
  return deepFreeze({
    inspectionVersion: 1,
    status: "blocked",
    reasonCode,
    message,
    canInspect: false,
    canImport: false,
    requiresExpiryConfirmation: false,
    sideEffectAuthorization: false,
    executionAuthorization: false,
    warnings,
  });
}

function validInstant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/
    .exec(value);
  if (match === null) return false;
  const [year, month, day, hour, minute, second] =
    match.slice(1, 7).map(Number);
  if (year < 1 || month < 1 || month > 12 || hour > 23
    || minute > 59 || second > 59) return false;
  const milliseconds = Number((match[7] ?? "").padEnd(3, "0"));
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  calendar.setUTCHours(hour, minute, second, milliseconds);
  if (calendar.getUTCFullYear() !== year
    || calendar.getUTCMonth() !== month - 1
    || calendar.getUTCDate() !== day
    || calendar.getUTCHours() !== hour
    || calendar.getUTCMinutes() !== minute
    || calendar.getUTCSeconds() !== second
    || calendar.getUTCMilliseconds() !== milliseconds) return false;
  const offsetMinutes = match[8] === "Z"
    ? 0
    : (Number(match[10]) * 60 + Number(match[11]))
      * (match[9] === "+" ? 1 : -1);
  if (Math.abs(offsetMinutes) > 14 * 60
    || Number(match[10] ?? 0) > 14
    || Number(match[11] ?? 0) > 59) return false;
  return calendar.getTime() - offsetMinutes * 60_000 === Date.parse(value);
}

function plainRecord<T extends readonly string[]>(
  value: unknown,
  keys: T,
): value is Record<T[number], unknown> {
  return plainData(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function plainData(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object"
    || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.values(Object.getOwnPropertyDescriptors(value))
    .every((descriptor) => !("get" in descriptor) && !("set" in descriptor));
}

function passivePlainData(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object") return true;
  if (seen.has(value)) return false;
  seen.add(value);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== Array.prototype) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const descriptor of Object.values(descriptors)) {
    if ("get" in descriptor || "set" in descriptor) return false;
    if ("value" in descriptor && !passivePlainData(descriptor.value, seen)) return false;
  }
  return true;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return value;
}

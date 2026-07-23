import { fit } from "../../../lib/fit";
import type { EquivalenceResult, EquivalenceScenario } from "./types";

const locallyRepresentableTopologies = new Set([
  "single-pool",
  "unified-memory",
]);
const PINNED_LLMFIT_VERSION = "1.1.6";
const PINNED_LLMFIT_COMMIT =
  "aaa2bc179cec214ccdc44501c853b98fba0b343b";

export function compareFitScenario(scenario: EquivalenceScenario): EquivalenceResult {
  const issues = validateScenario(scenario);
  if (issues.length) {
    throw new TypeError(`Invalid equivalence scenario ${scenario.id || "<missing-id>"}: ${issues.join(" ")}`);
  }

  if (
    scenario.mappingBlockers.length > 0
    || !locallyRepresentableTopologies.has(scenario.upstream.topology)
    || scenario.local === null
    || scenario.upstream.requiredBytes === null
    || scenario.upstream.fits === null
  ) {
    return {
      scenarioId: scenario.id,
      outcome: "unrepresentable",
      upstream: scenario.upstream,
      local: null,
      differences: [],
      reasons: [
        ...scenario.mappingBlockers,
        ...scenario.upstream.factsNotExposed.map((fact) => `Upstream output does not expose ${fact}.`),
      ],
    };
  }

  const localResult = fit(
    scenario.local.artifact,
    scenario.local.hardware,
    scenario.local.contextTokens,
    scenario.local.kvCacheSelection,
  );
  const relativeTolerance = Math.ceil(
    Math.max(scenario.upstream.requiredBytes, localResult.requiredBytes)
      * scenario.tolerance.requiredBytesRelativeBps / 10_000,
  );
  const byteTolerance = Math.max(
    scenario.tolerance.requiredBytesAbsolute,
    relativeTolerance,
  );
  const differences = [];

  if (scenario.upstream.fits !== localResult.fits) {
    differences.push({
      field: "fits" as const,
      upstream: scenario.upstream.fits,
      local: localResult.fits,
    });
  }
  if (Math.abs(scenario.upstream.requiredBytes - localResult.requiredBytes) > byteTolerance) {
    differences.push({
      field: "requiredBytes" as const,
      upstream: scenario.upstream.requiredBytes,
      local: localResult.requiredBytes,
      tolerance: byteTolerance,
    });
  }

  return {
    scenarioId: scenario.id,
    outcome: differences.length ? "disagreement" : "agreement",
    upstream: scenario.upstream,
    local: {
      fits: localResult.fits,
      requiredBytes: localResult.requiredBytes,
      availableBytes: localResult.physicalMemoryBytes,
      breakdown: localResult.breakdown,
    },
    differences,
    reasons: differences.map((difference) => {
      if (difference.field === "fits") {
        return `Fit decision differs: upstream=${difference.upstream}, local=${difference.local}.`;
      }
      return `Required bytes differ beyond tolerance ${difference.tolerance}: upstream=${difference.upstream}, local=${difference.local}.`;
    }),
  };
}

export function validateScenario(value: unknown): string[] {
  if (!isRecord(value)) return ["Scenario must be an object."];
  const issues: string[] = [];
  if (!isNonEmptyString(value.id)) issues.push("id must be a non-empty string.");
  if (!isNonEmptyString(value.description)) issues.push("description must be a non-empty string.");
  if (!isRecord(value.upstream)) issues.push("upstream must be an object.");
  if (!isRecord(value.tolerance)) issues.push("tolerance must be an object.");
  if (!Array.isArray(value.mappingBlockers) || !value.mappingBlockers.every(isNonEmptyString)) {
    issues.push("mappingBlockers must contain only non-empty strings.");
  }
  if (!["agreement", "disagreement", "unrepresentable"].includes(String(value.expectedOutcome))) {
    issues.push("expectedOutcome is unknown.");
  }

  if (isRecord(value.upstream)) {
    if (!isRecord(value.upstream.source)) {
      issues.push("upstream.source must be an object.");
    } else {
      if (value.upstream.source.name !== "llmfit") issues.push("upstream.source.name must be llmfit.");
      if (value.upstream.source.version !== PINNED_LLMFIT_VERSION) {
        issues.push(`upstream.source.version must be the pinned ${PINNED_LLMFIT_VERSION}.`);
      }
      if (value.upstream.source.commit !== PINNED_LLMFIT_COMMIT) {
        issues.push(`upstream.source.commit must be the pinned ${PINNED_LLMFIT_COMMIT}.`);
      }
      if (value.upstream.source.fixtureKind !== "normalized-upstream-style") {
        issues.push("upstream.source.fixtureKind must identify normalized-upstream-style data.");
      }
    }
    if (!["single-pool", "unified-memory", "device-host-offload", "heterogeneous-multi-gpu"].includes(String(value.upstream.topology))) {
      issues.push("upstream.topology is unknown.");
    }
    if (!isPositiveSafeInteger(value.upstream.availableBytes)) {
      issues.push("upstream.availableBytes must be a positive safe integer.");
    }
    if (value.upstream.requiredBytes !== null && !isPositiveSafeInteger(value.upstream.requiredBytes)) {
      issues.push("upstream.requiredBytes must be null or a positive safe integer.");
    }
    if (value.upstream.fits !== null && typeof value.upstream.fits !== "boolean") {
      issues.push("upstream.fits must be null or boolean.");
    }
    if (!Array.isArray(value.upstream.factsNotExposed) || !value.upstream.factsNotExposed.every(isNonEmptyString)) {
      issues.push("upstream.factsNotExposed must contain only non-empty strings.");
    }
    if (
      typeof value.upstream.fits === "boolean"
      && isPositiveSafeInteger(value.upstream.requiredBytes)
      && isPositiveSafeInteger(value.upstream.availableBytes)
      && value.upstream.fits !== (value.upstream.requiredBytes <= value.upstream.availableBytes)
    ) {
      issues.push("upstream.fits contradicts requiredBytes and availableBytes.");
    }
  }

  if (value.local !== null && !isRecord(value.local)) {
    issues.push("local must be an object or null.");
  } else if (isRecord(value.local)) {
    if (!isRecord(value.local.artifact)) issues.push("local.artifact must be an object.");
    if (!isRecord(value.local.hardware)) issues.push("local.hardware must be an object.");
    if (!isPositiveSafeInteger(value.local.contextTokens)) issues.push("local.contextTokens must be a positive safe integer.");
    if (
      typeof value.local.kvCacheSelection !== "string"
      && !isRecord(value.local.kvCacheSelection)
    ) {
      issues.push("local.kvCacheSelection must be a string or key/value object.");
    }
  }

  if (isRecord(value.tolerance)) {
    if (!isNonNegativeSafeInteger(value.tolerance.requiredBytesAbsolute)) {
      issues.push("tolerance.requiredBytesAbsolute must be a non-negative safe integer.");
    }
    if (
      !isNonNegativeSafeInteger(value.tolerance.requiredBytesRelativeBps)
      || Number(value.tolerance.requiredBytesRelativeBps) > 10_000
    ) {
      issues.push("tolerance.requiredBytesRelativeBps must be between 0 and 10000.");
    }
  }

  if (value.local === null && Array.isArray(value.mappingBlockers) && value.mappingBlockers.length === 0) {
    issues.push("A null local invocation requires at least one explicit mapping blocker.");
  }
  return issues;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

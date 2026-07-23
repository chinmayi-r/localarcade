import { fitMemoryPools } from "../../lib/fit";
import type {
  PolicySweepInput,
  PolicySweepReport,
} from "./types";

export function evaluatePolicySweep(
  input: PolicySweepInput,
): PolicySweepReport {
  if (
    input.schemaVersion !== 1
    || input.evidenceClassification !== "synthetic-machinery-only"
    || input.policies.length === 0
    || input.cases.length === 0
  ) {
    throw new TypeError("A versioned synthetic policy-sweep corpus is required.");
  }
  const policyIds = new Set<string>();
  const results = input.policies.map((policy) => {
    if (
      policy.policyId.trim() === ""
      || policyIds.has(policy.policyId)
      || !nonNegative(policy.deviceReserveBytes)
      || !nonNegative(policy.hostReserveBytes)
      || !nonNegative(policy.safetyMarginBps)
      || policy.safetyMarginBps > 10_000
    ) {
      throw new TypeError("Policy candidates require unique IDs and valid values.");
    }
    policyIds.add(policy.policyId);
    const counts = {
      policyId: policy.policyId,
      evaluatedCases: 0,
      unknownCases: 0,
      falseFits: 0,
      falseNoFits: 0,
      correctFits: 0,
      correctNoFits: 0,
    };
    for (const fixture of input.cases) {
      if (fixture.observedOutcome === "unknown") {
        counts.unknownCases += 1;
        continue;
      }
      const predicted = fitMemoryPools(fixture.profile, {
        devicePhysicalBytes: fixture.devicePhysicalBytes,
        hostPhysicalBytes: fixture.hostPhysicalBytes,
        deviceReserveBytes: policy.deviceReserveBytes,
        hostReserveBytes: policy.hostReserveBytes,
        safetyMarginBps: policy.safetyMarginBps,
      }, fixture.contextTokens).fits;
      const observed = fixture.observedOutcome === "loaded";
      counts.evaluatedCases += 1;
      if (predicted && observed) counts.correctFits += 1;
      else if (!predicted && !observed) counts.correctNoFits += 1;
      else if (predicted) counts.falseFits += 1;
      else counts.falseNoFits += 1;
    }
    return counts;
  });
  return {
    schemaVersion: 1,
    status: "analysis-only",
    selectedPolicy: null,
    results,
    warnings: [
      "Synthetic fixtures prove policy-evaluation machinery only.",
      "No policy is selected; reserves, margin, materiality and hardware scope require owner approval.",
    ],
  };
}

function nonNegative(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

import type { CompatibilityAssertion, RuntimeBuild } from "./types";

export type CompatibilityDecision = {
  compatible: boolean;
  status: CompatibilityAssertion["status"];
  reasons: string[];
  unknowns: string[];
};

export function evaluateCompatibility(assertion: CompatibilityAssertion, build: RuntimeBuild): CompatibilityDecision {
  const reasons: string[] = [];
  const unknowns: string[] = [];
  if (assertion.engineId !== build.engineId) reasons.push(`Requires ${assertion.engineId}; selected build uses ${build.engineId}.`);
  if (assertion.conditions.operatingSystems && !assertion.conditions.operatingSystems.includes(build.os)) reasons.push(`Operating system ${build.os} is outside the documented set.`);
  if (assertion.conditions.cpuArchitectures && !assertion.conditions.cpuArchitectures.includes(build.cpuArchitecture)) reasons.push(`CPU architecture ${build.cpuArchitecture} is outside the documented set.`);
  if (assertion.conditions.backends && !assertion.conditions.backends.includes(build.backend)) reasons.push(`Backend ${build.backend} is outside the documented set.`);
  if (assertion.status === "unknown") unknowns.push("No compatibility evidence is available for this artifact and runtime route.");
  if (!build.version && !build.exactBuild) unknowns.push("The runtime build version is unknown.");
  if (assertion.status === "unsupported") reasons.push("The source explicitly marks this route unsupported.");
  return { compatible: reasons.length === 0 && assertion.status !== "unknown", status: assertion.status, reasons, unknowns };
}

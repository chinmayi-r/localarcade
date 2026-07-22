import type { ArtifactPackageLayout, CompatibilityAssertion, ProductId, RuntimeBuild } from "./types";

export type CompatibilityDecision = {
  compatible: boolean;
  status: CompatibilityAssertion["status"];
  reasons: string[];
  unknowns: string[];
};

export type CompatibilityTarget = {
  artifactId: string;
  productId: ProductId;
  runtimeBuild: RuntimeBuild;
  packageLayout?: ArtifactPackageLayout;
  packageFiles?: string[];
  modelArchitecture?: string;
  quantizationScheme?: string;
};

function compareVersion(left: string, right: string): number | null {
  const parse = (value: string) => {
    const match = /^(?:v)?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(value);
    return match ? [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)] : null;
  };
  const a = parse(left);
  const b = parse(right);
  if (!a || !b) return null;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

function conditionDecision(
  values: string[] | undefined,
  selected: string | undefined,
  label: string,
  reasons: string[],
  unknowns: string[],
): void {
  if (!values) return;
  if (!selected) {
    unknowns.push(`${label} is required to evaluate this compatibility assertion.`);
  } else if (!values.includes(selected)) {
    reasons.push(`${label} ${selected} is outside the documented set.`);
  }
}

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
  return { compatible: reasons.length === 0 && unknowns.length === 0 && assertion.status !== "unknown", status: assertion.status, reasons, unknowns };
}

export function evaluateArtifactCompatibility(assertion: CompatibilityAssertion, target: CompatibilityTarget): CompatibilityDecision {
  const reasons: string[] = [];
  const unknowns: string[] = [];
  const build = target.runtimeBuild;

  if (assertion.artifactId !== target.artifactId) reasons.push("The compatibility assertion belongs to a different artifact.");
  if (assertion.productId !== target.productId) reasons.push(`Requires product ${assertion.productId}; selected product is ${target.productId}.`);
  if (assertion.engineId !== build.engineId) reasons.push(`Requires ${assertion.engineId}; selected build uses ${build.engineId}.`);
  conditionDecision(assertion.conditions.operatingSystems, build.os || undefined, "Operating system", reasons, unknowns);
  conditionDecision(assertion.conditions.cpuArchitectures, build.cpuArchitecture || undefined, "CPU architecture", reasons, unknowns);
  conditionDecision(assertion.conditions.backends, build.backend, "Backend", reasons, unknowns);
  conditionDecision(assertion.conditions.packageLayouts, target.packageLayout, "Package layout", reasons, unknowns);
  conditionDecision(assertion.conditions.modelArchitectures, target.modelArchitecture, "Model architecture", reasons, unknowns);
  conditionDecision(assertion.conditions.quantizationSchemes, target.quantizationScheme, "Quantization", reasons, unknowns);

  if (assertion.conditions.requiredFiles) {
    if (!target.packageFiles) {
      unknowns.push("Package files are required to evaluate this compatibility assertion.");
    } else {
      for (const requiredFile of assertion.conditions.requiredFiles) {
        if (!target.packageFiles.includes(requiredFile)) reasons.push(`Required package file ${requiredFile} is missing.`);
      }
    }
  }

  if (assertion.evidence.length === 0) unknowns.push("The compatibility assertion has no source evidence.");

  if (!build.exactBuild && !build.version) {
    unknowns.push("The runtime build version is unknown.");
  }
  if (assertion.runtimeConstraint.exactBuild) {
    if (!build.exactBuild) unknowns.push(`Exact runtime build ${assertion.runtimeConstraint.exactBuild} is required but was not identified.`);
    else if (build.exactBuild !== assertion.runtimeConstraint.exactBuild) reasons.push(`Runtime build ${build.exactBuild} does not match required build ${assertion.runtimeConstraint.exactBuild}.`);
  }
  if (assertion.runtimeConstraint.minVersion || assertion.runtimeConstraint.maxVersion) {
    if (!build.version) unknowns.push("A runtime version is required to evaluate version constraints.");
    else {
      for (const [boundary, required, direction] of [
        ["minimum", assertion.runtimeConstraint.minVersion, -1],
        ["maximum", assertion.runtimeConstraint.maxVersion, 1],
      ] as const) {
        if (!required) continue;
        const comparison = compareVersion(build.version, required);
        if (comparison === null) unknowns.push(`Runtime version ${build.version} cannot be safely compared with ${boundary} ${required}.`);
        else if (comparison === direction) reasons.push(`Runtime version ${build.version} is outside the ${boundary} ${required} constraint.`);
      }
    }
  }

  if (assertion.status === "unknown") unknowns.push("No compatibility evidence is available for this artifact and runtime route.");
  if (assertion.status === "unsupported") reasons.push("The source explicitly marks this route unsupported.");

  return {
    compatible: reasons.length === 0 && unknowns.length === 0 && assertion.status !== "unknown",
    status: assertion.status,
    reasons,
    unknowns,
  };
}

import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type GateStatus = "passed" | "partial" | "missing" | "deferred" | "not-applicable";
export type Gate = { status: GateStatus; evidence: string[]; gap?: string };
export type Capability = {
  id: string;
  architectureRef: string;
  name: string;
  gates: Record<"core" | "boundary" | "handoff" | "userDemo", Gate>;
  proofCommands: string[];
};
export type CapabilityManifest = {
  proofManifestVersion: 1;
  productBoundary: {
    handles: string[];
    doesNotHandle: string[];
    independentScenarioRule: string;
  };
  gateDefinitions: Record<keyof Capability["gates"], string>;
  capabilities: Capability[];
};

const allowedStatuses = new Set<GateStatus>(["passed", "partial", "missing", "deferred", "not-applicable"]);

export async function loadCapabilityManifest(): Promise<CapabilityManifest> {
  const path = new URL("./capabilities.json", import.meta.url);
  return JSON.parse(await readFile(path, "utf8")) as CapabilityManifest;
}

export async function validateCapabilityManifest(manifest: CapabilityManifest, root = process.cwd()): Promise<string[]> {
  const issues: string[] = [];
  if (manifest.proofManifestVersion !== 1) issues.push("unsupported proof manifest version");
  if (!manifest.productBoundary.doesNotHandle.includes("tool calling")) issues.push("product boundary must explicitly exclude tool calling");
  if (!/independent/i.test(manifest.productBoundary.independentScenarioRule)) issues.push("independent scenario rule is required");

  const ids = new Set<string>();
  for (const capability of manifest.capabilities) {
    if (ids.has(capability.id)) issues.push(`${capability.id}: duplicate capability id`);
    ids.add(capability.id);
    for (const gateName of ["core", "boundary", "handoff", "userDemo"] as const) {
      const gate = capability.gates[gateName];
      if (!gate || !allowedStatuses.has(gate.status)) {
        issues.push(`${capability.id}.${gateName}: invalid or missing status`);
        continue;
      }
      if (gate.status === "passed" && gate.evidence.length === 0) {
        issues.push(`${capability.id}.${gateName}: passed gate requires executable or source evidence`);
      }
      if ((gate.status === "partial" || gate.status === "missing" || gate.status === "deferred") && !gate.gap) {
        issues.push(`${capability.id}.${gateName}: non-passing gate requires an explicit gap`);
      }
      for (const evidence of gate.evidence) {
        try {
          await access(resolve(root, evidence));
        } catch {
          issues.push(`${capability.id}.${gateName}: evidence path does not exist: ${evidence}`);
        }
      }
    }
  }
  return issues;
}

export function summarizeCapabilities(manifest: CapabilityManifest) {
  return manifest.capabilities.map((capability) => ({
    id: capability.id,
    architectureRef: capability.architectureRef,
    name: capability.name,
    ...Object.fromEntries(Object.entries(capability.gates).map(([name, gate]) => [name, gate.status])),
  }));
}

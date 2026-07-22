import type { HardwareProfile, RecommendationQuery } from "../../recommendation/types";
import type { HardwareTarget, MappingResult, Need, OsFamily, Origin, RecommendationRequest } from "../types";

const GIB = 2 ** 30;
/** Adapter-local extension; the legacy core does not yet model system RAM. */
export type HardwareProfileWithSystemMemory = HardwareProfile & { systemMemoryGb?: number };
export type RecommendationRequestContext = {
  requestId: string; hardwareTargetId: string; interactionStyle: "interactive" | "batch"; scopeLabel: string;
  needs: Need[]; allowCpuOffload: boolean; installedOnly: boolean;
  forcedRuntime: string | null; maximumArtifactBytes: number | null;
};

export function toRecommendationRequest(query: RecommendationQuery, context: RecommendationRequestContext): RecommendationRequest {
  return {
    requestId: context.requestId, hardwareTargetId: context.hardwareTargetId,
    task: { family: query.task, interactionStyle: context.interactionStyle, scopeLabel: context.scopeLabel, derivedContextTokens: query.desiredContextK * 1024, needs: context.needs },
    preferences: { priority: query.strategy, allowCpuOffload: context.allowCpuOffload, installedOnly: context.installedOnly },
    advanced: { forcedRuntime: context.forcedRuntime, maximumArtifactBytes: context.maximumArtifactBytes },
  };
}

export function fromRecommendationRequest(request: RecommendationRequest, hardware: HardwareProfile): MappingResult<RecommendationQuery> {
  if (request.task.derivedContextTokens % 1024 !== 0) return { kind: "blocked", reasonCode: "mapping.context-not-kib-aligned", message: "Current recommendation context is represented in whole K tokens.", missing: ["task.derivedContextTokens"] };
  return { kind: "ok", value: { hardware, task: request.task.family === "other" ? "general" : request.task.family, desiredContextK: request.task.derivedContextTokens / 1024, strategy: request.preferences.priority } };
}

export type HardwareAdapterContext = {
  hardwareTargetId: string; osFamily: OsFamily; osVersion: string | null;
  cpuDisplayName: string | null; logicalCores: number | null; totalRamGb: number;
  unified: boolean | null; acceleratorDisplayName: string; acceleratorVendor: HardwareTarget["accelerators"][number]["vendor"];
  backend: HardwareTarget["accelerators"][number]["backend"]; fieldOrigins: Record<string, Origin>;
};

export function toHardwareTarget(profile: HardwareProfileWithSystemMemory, context: HardwareAdapterContext): HardwareTarget {
  return {
    hardwareTargetId: context.hardwareTargetId, os: { family: context.osFamily, version: context.osVersion },
    cpu: { displayName: context.cpuDisplayName, logicalCores: context.logicalCores },
    memory: { totalRamBytes: Math.round(context.totalRamGb * GIB), availableRamBytes: profile.systemMemoryGb === undefined ? null : Math.round(profile.systemMemoryGb * GIB), unified: context.unified },
    accelerators: [{ acceleratorId: profile.acceleratorId ?? null, displayName: context.acceleratorDisplayName, kind: context.acceleratorVendor, vendor: context.acceleratorVendor, backend: context.backend, deviceMemoryBytes: Math.round(profile.availableMemoryGb * GIB), count: 1 }],
    fieldOrigins: context.fieldOrigins,
  };
}

export function fromHardwareTarget(target: HardwareTarget): MappingResult<HardwareProfileWithSystemMemory> {
  if (target.accelerators.length !== 1) return { kind: "blocked", reasonCode: "mapping.accelerator-cardinality", message: "Current hardware profiles support exactly one accelerator.", missing: ["accelerators"] };
  const accelerator = target.accelerators[0];
  if (accelerator.deviceMemoryBytes === null) return { kind: "blocked", reasonCode: "mapping.device-memory-unknown", message: "Current recommendation requires confirmed available accelerator memory.", missing: ["accelerators/0/deviceMemoryBytes"] };
  const platform = accelerator.vendor === "intel" || accelerator.vendor === "other" ? null : accelerator.vendor;
  if (platform === null) return { kind: "blocked", reasonCode: "mapping.platform-unsupported", message: "Current recommendation has no Intel/other platform value.", missing: ["accelerators/0/vendor"] };
  return { kind: "ok", value: { platform, availableMemoryGb: accelerator.deviceMemoryBytes / GIB, ...(target.memory.availableRamBytes === null ? {} : { systemMemoryGb: target.memory.availableRamBytes / GIB }), ...(accelerator.acceleratorId === null ? {} : { acceleratorId: accelerator.acceleratorId }) } };
}

export function blockedCandidateMapping(missing: string[]): MappingResult<never> {
  return { kind: "blocked", reasonCode: "mapping.runtime-identity-incomplete", message: "The current candidate cannot satisfy approved exact runtime identity without explicit values.", missing };
}

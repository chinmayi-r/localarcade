import type {
  CompatibilityAdmissionReceipt,
  ExactConfigurationCandidate,
  HardwareTarget,
  Provenance,
  RuntimeConfiguration,
} from "../contracts";
import { validateContract } from "../contracts";
import { fit, fitMemoryPools } from "../fit";
import type {
  FitArtifact,
  KvCacheSelection,
  TwoPoolFitProfile,
} from "../fit";
import type {
  AdmittedFitAssessmentPolicy,
  AdmittedFitProfile,
  BoundFitProfile,
  FitAssessmentPolicy,
} from "./types";
import { recordContentSha256 } from "./record-digest";

type AdmissionBlocked = {
  kind: "blocked";
  reasonCode: string;
  message: string;
  missing: string[];
  mismatches: string[];
};

export type AdmissionResult<T> =
  | { kind: "ok"; value: T }
  | AdmissionBlocked;

type ProfileScope = {
  candidateId: string;
  artifactSha256: string;
  hardwareTargetId: string | null;
  acceleratorId: string | null;
  runtime: RuntimeConfiguration;
};

type ProfileRecordBase = {
  schemaVersion: 1;
  profileId: string;
  profileVersion: string;
  scope: ProfileScope;
  sourceEvidence: {
    tool: {
      id: string;
      version: string;
      executableSha256: string | null;
    };
    command: string;
    observations: Array<{
      contextTokens: number;
      observedAt: string;
      rawSourceRecordRef: string;
      device: {
        modelBytes: number;
        contextBytes: number;
        computeBytes: number;
      } | null;
      host: {
        modelBytes: number;
        contextBytes: number;
        computeBytes: number;
      };
    }>;
  };
  provenance: Provenance[];
};

export type RuntimeScopedFitProfileRecord =
  | (ProfileRecordBase & {
      mode: "split";
      runPath: "gpu" | "cpu-offload";
      allocation: TwoPoolFitProfile;
    })
  | (ProfileRecordBase & {
      mode: "host";
      runPath: "cpu";
      allocation: {
        artifact: FitArtifact;
        kvCache: KvCacheSelection;
      };
    });

export type FitProfileAdmissionInput = {
  record: unknown;
  reviewedManifest: ReviewedAdmissionManifest;
  candidate: ExactConfigurationCandidate;
  compatibilityReceipt: CompatibilityAdmissionReceipt;
  hardwareTarget: HardwareTarget;
};

export type CapacityPolicyRecord = {
  schemaVersion: 1;
  policyId: string;
  policyVersion: string;
  binding: {
    hardwareTargetId: string;
    operatingSystem: HardwareTarget["os"]["family"];
    runPath: BoundFitProfile["runPath"];
  };
  basis: "confirmed-capacity-minus-reserve";
  deviceReserveBytes: number;
  hostReserveBytes: number;
  safetyMarginBps: number;
  tightHeadroomBps: 0;
  approval: {
    decisionId: string;
    approvedAt: string;
    approvedBy: string;
  };
  provenance: Provenance[];
};

export type CapacityPolicyAdmissionInput = {
  record: unknown;
  reviewedManifest: ReviewedAdmissionManifest;
  hardwareTarget: HardwareTarget;
  runPath: BoundFitProfile["runPath"];
};

export type ReviewedAdmissionManifest = {
  schemaVersion: 1;
  manifestId: string;
  manifestVersion: string;
  reviewedAt: string;
  reviewedBy: string;
  entries: Array<{
    recordKind: "fit-profile" | "capacity-policy";
    recordId: string;
    recordVersion: string;
    contentSha256: string;
    status: "reviewed" | "owner-approved";
  }>;
};

const runtimeKeys = [
  "runtimeConfigurationId",
  "product",
  "engine",
  "engineBuild",
  "backend",
  "chatTemplate",
  "contextTokens",
  "kvCache",
  "gpuLayers",
  "batchSize",
  "microBatchSize",
  "parallelism",
  "threads",
  "flashAttention",
  "mmap",
  "sampler",
  "additionalFlags",
] as const;

const samplerKeys = ["temperature", "topP", "topK", "minP", "seed"] as const;

export function admitFitProfile(
  input: FitProfileAdmissionInput,
): AdmissionResult<AdmittedFitProfile> {
  try {
    const producerIssue = validateProducerInputs(input);
    if (producerIssue) return producerIssue;

    const missing = missingProfilePaths(input.record);
    if (missing.length > 0) {
      return blocked(
        "fit-profile.incomplete",
        "The source profile does not independently identify every allocation-affecting fact.",
        missing,
      );
    }
    const record = input.record as RuntimeScopedFitProfileRecord;
    const shapeIssues = strictProfileRecordIssues(record);
    if (shapeIssues.length > 0) {
      return blocked(
        "fit-profile.invalid",
        "The source profile contains unknown or malformed record fields.",
        [],
        shapeIssues,
      );
    }
    const mismatches = profileMismatches(record, input);
    if (mismatches.length > 0) {
      return blocked(
        "fit-profile.scope-mismatch",
        "The source profile does not match the admitted candidate and hardware scope.",
        [],
        mismatches,
      );
    }
    const validationIssues = validateProfileRecord(record);
    if (validationIssues.length > 0) {
      return blocked(
        "fit-profile.invalid",
        "The source profile contains invalid allocation or provenance facts.",
        [],
        validationIssues,
      );
    }
    const trustIssue = reviewedRecordIssue(
      input.reviewedManifest,
      "fit-profile",
      record.profileId,
      record.profileVersion,
      record,
      "reviewed",
    );
    if (trustIssue) {
      return blocked(
        "fit-profile.untrusted-source",
        "The source profile is not an exact member of the injected reviewed-record manifest.",
        [],
        [trustIssue],
      );
    }

    const binding = {
      candidateId: record.scope.candidateId,
      artifactSha256: record.scope.artifactSha256,
      hardwareTargetId: record.scope.hardwareTargetId,
      acceleratorId: record.scope.acceleratorId,
      runtime: cloneRuntime(record.scope.runtime),
    };
    const provenance = structuredClone(record.provenance);
    const value: BoundFitProfile = record.mode === "split"
      ? {
          mode: "split",
          binding: {
            ...binding,
            acceleratorId: record.scope.acceleratorId!,
          },
          profile: structuredClone(record.allocation),
          runPath: record.runPath,
          provenance,
        }
      : {
          mode: "host",
          binding: { ...binding, acceleratorId: null },
          artifact: structuredClone(record.allocation.artifact),
          kvCache: structuredClone(record.allocation.kvCache),
          runPath: "cpu",
          provenance,
        };
    return { kind: "ok", value: value as AdmittedFitProfile };
  } catch (error) {
    return blocked(
      "fit-profile.invalid",
      error instanceof Error && error.message.trim()
        ? error.message
        : "The source profile could not be validated.",
    );
  }
}

export function admitCapacityPolicy(
  input: CapacityPolicyAdmissionInput,
): AdmissionResult<AdmittedFitAssessmentPolicy> {
  try {
    const hardwareIssue = invalidProducerContract(
      "hardware-target",
      input.hardwareTarget,
    );
    if (hardwareIssue) {
      return blocked(
        "fit-policy.hardware-invalid",
        hardwareIssue,
      );
    }
    const missing = missingPolicyPaths(input.record);
    if (missing.length > 0) {
      return blocked(
        "fit-policy.incomplete",
        "The capacity policy is missing required attributed facts.",
        missing,
      );
    }
    const record = input.record as CapacityPolicyRecord;
    const shapeIssues = strictPolicyRecordIssues(record);
    if (shapeIssues.length > 0) {
      return blocked(
        "fit-policy.invalid",
        "The capacity policy contains unknown or malformed record fields.",
        [],
        shapeIssues,
      );
    }
    const mismatches: string[] = [];
    if (record.binding.hardwareTargetId !== input.hardwareTarget.hardwareTargetId) {
      mismatches.push("binding.hardwareTargetId");
    }
    if (record.binding.operatingSystem !== input.hardwareTarget.os.family) {
      mismatches.push("binding.operatingSystem");
    }
    if (record.binding.runPath !== input.runPath) {
      mismatches.push("binding.runPath");
    }
    if (mismatches.length > 0) {
      return blocked(
        "fit-policy.scope-mismatch",
        "The capacity policy does not match the hardware and run path.",
        [],
        mismatches,
      );
    }
    const issues = validateCapacityPolicyRecord(record);
    if (issues.length > 0) {
      return blocked(
        "fit-policy.invalid",
        "The capacity policy contains invalid or unattributed values.",
        [],
        issues,
      );
    }
    const trustIssue = reviewedRecordIssue(
      input.reviewedManifest,
      "capacity-policy",
      record.policyId,
      record.policyVersion,
      record,
      "owner-approved",
    );
    if (trustIssue) {
      return blocked(
        "fit-policy.untrusted-source",
        "The policy is not an exact owner-approved member of the injected reviewed-record manifest.",
        [],
        [trustIssue],
      );
    }
    const value: FitAssessmentPolicy = {
      policyId: record.policyId,
      policyVersion: record.policyVersion,
      binding: { ...record.binding },
      basis: record.basis,
      deviceReserveBytes: record.deviceReserveBytes,
      hostReserveBytes: record.hostReserveBytes,
      safetyMarginBps: record.safetyMarginBps,
      tightHeadroomBps: 0,
      provenance: structuredClone(record.provenance),
    };
    return {
      kind: "ok",
      value: value as AdmittedFitAssessmentPolicy,
    };
  } catch (error) {
    return blocked(
      "fit-policy.invalid",
      error instanceof Error && error.message.trim()
        ? error.message
        : "The capacity policy could not be validated.",
    );
  }
}

function validateProducerInputs(
  input: FitProfileAdmissionInput,
): AdmissionBlocked | null {
  for (const [contract, value] of [
    ["exact-configuration-candidate", input.candidate],
    ["compatibility-admission-receipt", input.compatibilityReceipt],
    ["hardware-target", input.hardwareTarget],
  ] as const) {
    const issue = invalidProducerContract(contract, value);
    if (issue) {
      return blocked("fit-profile.producer-invalid", issue);
    }
  }
  const receipt = input.compatibilityReceipt;
  const candidate = input.candidate;
  if (
    receipt.candidateId !== candidate.candidateId
    || receipt.artifactId !== candidate.artifact.artifactId
    || receipt.artifactSha256 !== candidate.artifact.sha256
    || receipt.runtimeConfigurationId !== candidate.runtime.runtimeConfigurationId
    || receipt.target.product !== candidate.runtime.product
    || receipt.target.engine !== candidate.runtime.engine
    || receipt.target.engineBuild !== candidate.runtime.engineBuild
    || receipt.target.backend !== candidate.runtime.backend
  ) {
    return blocked(
      "fit-profile.compatibility-receipt-mismatch",
      "The M-E admission receipt is not bound to the candidate.",
    );
  }
  return null;
}

function missingProfilePaths(value: unknown): string[] {
  const missing: string[] = [];
  if (!isRecord(value)) return ["record"];
  for (const key of [
    "schemaVersion",
    "profileId",
    "profileVersion",
    "scope",
    "mode",
    "runPath",
    "allocation",
    "sourceEvidence",
    "provenance",
  ]) {
    if (!hasOwn(value, key)) missing.push(key);
  }
  if (!isRecord(value.scope)) {
    if (hasOwn(value, "scope")) missing.push("scope");
    for (const key of [
      "candidateId",
      "artifactSha256",
      "hardwareTargetId",
      "acceleratorId",
      "runtime",
    ]) {
      missing.push(`scope.${key}`);
    }
    for (const key of runtimeKeys) {
      missing.push(`scope.runtime.${key}`);
    }
    missing.push(
      "scope.runtime.kvCache.key",
      "scope.runtime.kvCache.value",
      ...samplerKeys.map((key) => `scope.runtime.sampler.${key}`),
    );
    addMissingSourceEvidence(value, missing);
    return unique(missing);
  }
  for (const key of [
    "candidateId",
    "artifactSha256",
    "hardwareTargetId",
    "acceleratorId",
    "runtime",
  ]) {
    if (!hasOwn(value.scope, key)) missing.push(`scope.${key}`);
  }
  if (!isRecord(value.scope.runtime)) {
    if (hasOwn(value.scope, "runtime")) missing.push("scope.runtime");
    for (const key of runtimeKeys) {
      missing.push(`scope.runtime.${key}`);
    }
    missing.push(
      "scope.runtime.kvCache.key",
      "scope.runtime.kvCache.value",
      ...samplerKeys.map((key) => `scope.runtime.sampler.${key}`),
    );
    addMissingSourceEvidence(value, missing);
    return unique(missing);
  }
  for (const key of runtimeKeys) {
    if (!hasOwn(value.scope.runtime, key)) missing.push(`scope.runtime.${key}`);
  }
  if (!isRecord(value.scope.runtime.kvCache)) {
    if (hasOwn(value.scope.runtime, "kvCache")) missing.push("scope.runtime.kvCache");
  } else {
    for (const key of ["key", "value"]) {
      if (!hasOwn(value.scope.runtime.kvCache, key)) {
        missing.push(`scope.runtime.kvCache.${key}`);
      }
    }
  }
  if (!isRecord(value.scope.runtime.sampler)) {
    if (hasOwn(value.scope.runtime, "sampler")) missing.push("scope.runtime.sampler");
  } else {
    for (const key of samplerKeys) {
      if (!hasOwn(value.scope.runtime.sampler, key)) {
        missing.push(`scope.runtime.sampler.${key}`);
      }
    }
  }
  addMissingSourceEvidence(value, missing);
  return unique(missing);
}

function addMissingSourceEvidence(
  value: Record<string, unknown>,
  missing: string[],
): void {
  if (!isRecord(value.sourceEvidence)) {
    if (hasOwn(value, "sourceEvidence")) missing.push("sourceEvidence");
    missing.push(
      "sourceEvidence.tool",
      "sourceEvidence.command",
      "sourceEvidence.observations",
    );
    return;
  }
  for (const key of ["tool", "command", "observations"]) {
    if (!hasOwn(value.sourceEvidence, key)) {
      missing.push(`sourceEvidence.${key}`);
    }
  }
  if (!isRecord(value.sourceEvidence.tool)) {
    missing.push("sourceEvidence.tool");
    return;
  }
  for (const key of ["id", "version", "executableSha256"]) {
    if (!hasOwn(value.sourceEvidence.tool, key)) {
      missing.push(`sourceEvidence.tool.${key}`);
    }
  }
}

function missingPolicyPaths(value: unknown): string[] {
  const missing: string[] = [];
  if (!isRecord(value)) return ["record"];
  for (const key of [
    "schemaVersion",
    "policyId",
    "policyVersion",
    "binding",
    "basis",
    "deviceReserveBytes",
    "hostReserveBytes",
    "safetyMarginBps",
    "tightHeadroomBps",
    "approval",
    "provenance",
  ]) {
    if (!hasOwn(value, key)) missing.push(key);
  }
  if (!isRecord(value.binding)) {
    if (hasOwn(value, "binding")) missing.push("binding");
  } else {
    for (const key of ["hardwareTargetId", "operatingSystem", "runPath"]) {
      if (!hasOwn(value.binding, key)) missing.push(`binding.${key}`);
    }
  }
  if (!isRecord(value.approval)) {
    if (hasOwn(value, "approval")) missing.push("approval");
  } else {
    for (const key of ["decisionId", "approvedAt", "approvedBy"]) {
      if (!hasOwn(value.approval, key)) missing.push(`approval.${key}`);
    }
  }
  return unique(missing);
}

function profileMismatches(
  record: RuntimeScopedFitProfileRecord,
  input: FitProfileAdmissionInput,
): string[] {
  const mismatches: string[] = [];
  const candidate = input.candidate;
  const hardware = input.hardwareTarget;
  if (record.schemaVersion !== 1) mismatches.push("schemaVersion");
  if (record.scope.candidateId !== candidate.candidateId) {
    mismatches.push("scope.candidateId");
  }
  if (record.scope.artifactSha256 !== candidate.artifact.sha256) {
    mismatches.push("scope.artifactSha256");
  }
  if (
    record.scope.hardwareTargetId !== null
    && record.scope.hardwareTargetId !== hardware.hardwareTargetId
  ) {
    mismatches.push("scope.hardwareTargetId");
  }
  if (!sameRuntime(record.scope.runtime, candidate.runtime)) {
    for (const key of runtimeKeys) {
      if (!runtimeFieldEqual(record.scope.runtime, candidate.runtime, key)) {
        mismatches.push(`scope.runtime.${key}`);
      }
    }
  }
  if (record.mode === "split") {
    if (hardware.memory.unified !== false) mismatches.push("hardwareTarget.memory.unified");
    if (hardware.accelerators.length !== 1) {
      mismatches.push("hardwareTarget.accelerators");
    } else if (
      record.scope.acceleratorId !== hardware.accelerators[0]?.acceleratorId
    ) {
      mismatches.push("scope.acceleratorId");
    }
    if (
      record.runPath === "gpu"
      && candidate.runtime.gpuLayers !== "all"
    ) {
      mismatches.push("runPath");
    }
    if (
      record.runPath === "cpu-offload"
      && !(typeof candidate.runtime.gpuLayers === "number"
        && candidate.runtime.gpuLayers > 0)
    ) {
      mismatches.push("runPath");
    }
  } else {
    if (record.scope.acceleratorId !== null) mismatches.push("scope.acceleratorId");
    if (hardware.accelerators.length !== 0) {
      mismatches.push("hardwareTarget.accelerators");
    }
    if (
      candidate.runtime.backend !== "cpu"
      || (candidate.runtime.gpuLayers !== 0
        && candidate.runtime.gpuLayers !== null)
    ) {
      mismatches.push("runPath");
    }
  }
  return unique(mismatches);
}

function validateProfileRecord(record: RuntimeScopedFitProfileRecord): string[] {
  const issues: string[] = [];
  if (!nonEmpty(record.profileId)) issues.push("profileId");
  if (!nonEmpty(record.profileVersion)) issues.push("profileVersion");
  if (!validProvenanceArray(record.provenance)) issues.push("provenance");
  if (
    record.provenance.some((item) =>
      item.method !== "measurement"
      || item.hardwareMatch !== "exact"
      || item.configurationMatch !== "exact"
      || (!nonEmpty(item.source.url) && !nonEmpty(item.rawSourceRecordRef))
    )
  ) {
    issues.push("provenance.scope");
  }
  if (
    record.provenance.some((item) => item.hardwareMatch === "exact")
    && record.scope.hardwareTargetId === null
  ) {
    issues.push("scope.hardwareTargetId");
  }
  if (
    !nonEmpty(record.sourceEvidence.tool.id)
    || !nonEmpty(record.sourceEvidence.tool.version)
    || (record.sourceEvidence.tool.executableSha256 !== null
      && !lowercaseSha256(record.sourceEvidence.tool.executableSha256))
  ) {
    issues.push("sourceEvidence.tool");
  }
  if (!nonEmpty(record.sourceEvidence.command)) {
    issues.push("sourceEvidence.command");
  }
  if (
    !Array.isArray(record.sourceEvidence.observations)
    || record.sourceEvidence.observations.length === 0
  ) {
    issues.push("sourceEvidence.observations");
  }
  const observedContexts = new Set<number>();
  for (const [index, observation] of record.sourceEvidence.observations.entries()) {
    const path = `sourceEvidence.observations.${index}`;
    if (
      !Number.isSafeInteger(observation.contextTokens)
      || observation.contextTokens <= 0
      || observedContexts.has(observation.contextTokens)
    ) {
      issues.push(`${path}.contextTokens`);
    }
    observedContexts.add(observation.contextTokens);
    if (!validTimestamp(observation.observedAt)) issues.push(`${path}.observedAt`);
    if (!nonEmpty(observation.rawSourceRecordRef)) {
      issues.push(`${path}.rawSourceRecordRef`);
    }
  }
  if (!observedContexts.has(record.scope.runtime.contextTokens)) {
    issues.push("sourceEvidence.observations.runtimeContext");
  }
  const hasContextScaledComponent = record.mode === "split"
    ? record.allocation.device.contextBytesAtReference > 0
      || record.allocation.device.computeContextBytesAtReference > 0
      || record.allocation.host.contextBytesAtReference > 0
      || record.allocation.host.computeContextBytesAtReference > 0
    : record.allocation.artifact.kvCache.key.some(
      (item) => item.bytesAtReferenceContext > 0,
    ) || record.allocation.artifact.kvCache.value.some(
      (item) => item.bytesAtReferenceContext > 0,
    );
  if (hasContextScaledComponent && observedContexts.size < 2) {
    issues.push("sourceEvidence.observations.contextScaling");
  }
  try {
    if (record.mode === "split") {
      if (record.runPath !== "gpu" && record.runPath !== "cpu-offload") {
        issues.push("runPath");
      }
      if (record.allocation.id !== record.profileId) issues.push("allocation.id");
      if (
        record.allocation.device.modelBytes
          + record.allocation.host.modelBytes <= 0
      ) {
        issues.push("allocation.modelBytes");
      }
      for (const [index, observation] of record.sourceEvidence.observations.entries()) {
        const result = fitMemoryPools(record.allocation, {
          devicePhysicalBytes: Number.MAX_SAFE_INTEGER,
          hostPhysicalBytes: Number.MAX_SAFE_INTEGER,
          deviceReserveBytes: 0,
          hostReserveBytes: 0,
          safetyMarginBps: 0,
        }, observation.contextTokens);
        if (observation.device === null) {
          issues.push(`sourceEvidence.observations.${index}.device`);
        } else {
          compareObservedPool(
            observation.device,
            result.device,
            `sourceEvidence.observations.${index}.device`,
            issues,
          );
        }
        compareObservedPool(
          observation.host,
          result.host,
          `sourceEvidence.observations.${index}.host`,
          issues,
        );
      }
    } else {
      for (const [index, observation] of record.sourceEvidence.observations.entries()) {
        const result = fit(record.allocation.artifact, {
          physicalMemoryBytes: Number.MAX_SAFE_INTEGER,
          osReserveBytes: 0,
          displayReserveBytes: 0,
          safetyMarginBps: 0,
        }, observation.contextTokens, record.allocation.kvCache);
        if (observation.device !== null) {
          issues.push(`sourceEvidence.observations.${index}.device`);
        }
        const host = observation.host;
        if (host.modelBytes !== result.breakdown.weightsBytes) {
          issues.push(`sourceEvidence.observations.${index}.host.modelBytes`);
        }
        if (host.contextBytes !== result.breakdown.kvCacheBytes) {
          issues.push(`sourceEvidence.observations.${index}.host.contextBytes`);
        }
        if (host.computeBytes !== result.breakdown.runtimeComputeBufferBytes) {
          issues.push(`sourceEvidence.observations.${index}.host.computeBytes`);
        }
      }
    }
    const evidenceCeiling = Math.max(
      ...record.sourceEvidence.observations.map((item) => item.contextTokens),
    );
    const declaredCeiling = record.mode === "split"
      ? record.allocation.maxContextTokens
      : record.allocation.artifact.maxContextTokens;
    if (declaredCeiling !== evidenceCeiling) {
      issues.push("allocation.maxContextTokens");
    }
  } catch (error) {
    issues.push(
      error instanceof Error && error.message.trim()
        ? `allocation: ${error.message}`
        : "allocation",
    );
  }
  return issues;
}

function validateCapacityPolicyRecord(record: CapacityPolicyRecord): string[] {
  const issues: string[] = [];
  if (record.schemaVersion !== 1) issues.push("schemaVersion");
  if (!nonEmpty(record.policyId)) issues.push("policyId");
  if (!nonEmpty(record.policyVersion)) issues.push("policyVersion");
  if (record.basis !== "confirmed-capacity-minus-reserve") issues.push("basis");
  for (const [key, value] of [
    ["deviceReserveBytes", record.deviceReserveBytes],
    ["hostReserveBytes", record.hostReserveBytes],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) issues.push(key);
  }
  if (
    !Number.isInteger(record.safetyMarginBps)
    || record.safetyMarginBps < 0
    || record.safetyMarginBps > 10_000
  ) {
    issues.push("safetyMarginBps");
  }
  if (record.tightHeadroomBps !== 0) issues.push("tightHeadroomBps");
  if (
    !nonEmpty(record.approval.decisionId)
    || !nonEmpty(record.approval.approvedBy)
    || !validTimestamp(record.approval.approvedAt)
  ) {
    issues.push("approval");
  }
  if (!validProvenanceArray(record.provenance)) issues.push("provenance");
  if (
    record.provenance.some((item) =>
      item.method !== "imported"
      || item.hardwareMatch !== "not-applicable"
      || item.configurationMatch !== "not-applicable"
      || (!nonEmpty(item.source.url) && !nonEmpty(item.rawSourceRecordRef))
    )
  ) {
    issues.push("provenance.scope");
  }
  if (record.binding.runPath === "cpu" && record.deviceReserveBytes !== 0) {
    issues.push("deviceReserveBytes");
  }
  return unique(issues);
}

function strictProfileRecordIssues(
  record: RuntimeScopedFitProfileRecord,
): string[] {
  const issues: string[] = [];
  exactKeys(record, [
    "schemaVersion", "profileId", "profileVersion", "scope", "mode", "runPath",
    "allocation", "sourceEvidence", "provenance",
  ], "record", issues);
  exactKeys(record.scope, [
    "candidateId", "artifactSha256", "hardwareTargetId", "acceleratorId", "runtime",
  ], "scope", issues);
  exactKeys(record.scope.runtime, runtimeKeys, "scope.runtime", issues);
  exactKeys(record.scope.runtime.kvCache, ["key", "value"], "scope.runtime.kvCache", issues);
  exactKeys(record.scope.runtime.sampler, samplerKeys, "scope.runtime.sampler", issues);
  exactKeys(record.sourceEvidence, ["tool", "command", "observations"], "sourceEvidence", issues);
  exactKeys(
    record.sourceEvidence.tool,
    ["id", "version", "executableSha256"],
    "sourceEvidence.tool",
    issues,
  );
  for (const [index, observation] of record.sourceEvidence.observations.entries()) {
    const path = `sourceEvidence.observations.${index}`;
    exactKeys(
      observation,
      ["contextTokens", "observedAt", "rawSourceRecordRef", "device", "host"],
      path,
      issues,
    );
    if (observation.device !== null) {
      exactKeys(
        observation.device,
        ["modelBytes", "contextBytes", "computeBytes"],
        `${path}.device`,
        issues,
      );
    }
    exactKeys(
      observation.host,
      ["modelBytes", "contextBytes", "computeBytes"],
      `${path}.host`,
      issues,
    );
  }
  if (record.mode === "split") {
    exactKeys(
      record.allocation,
      ["id", "maxContextTokens", "device", "host"],
      "allocation",
      issues,
    );
    for (const pool of ["device", "host"] as const) {
      exactKeys(
        record.allocation[pool],
        [
          "modelBytes", "computeFixedBytes", "contextBytesAtReference",
          "computeContextBytesAtReference", "referenceContextTokens",
        ],
        `allocation.${pool}`,
        issues,
      );
    }
  } else {
    exactKeys(record.allocation, ["artifact", "kvCache"], "allocation", issues);
    exactKeys(
      record.allocation.artifact,
      [
        "id", "weightBytes", "maxContextTokens", "runtimeComputeBufferBytes",
        "kvCache",
      ],
      "allocation.artifact",
      issues,
    );
    exactKeys(
      record.allocation.artifact.kvCache,
      ["key", "value"],
      "allocation.artifact.kvCache",
      issues,
    );
    for (const component of ["key", "value"] as const) {
      for (
        const [index, profile]
        of record.allocation.artifact.kvCache[component].entries()
      ) {
        exactKeys(
          profile,
          ["quantization", "referenceContextTokens", "bytesAtReferenceContext"],
          `allocation.artifact.kvCache.${component}.${index}`,
          issues,
        );
      }
    }
    if (typeof record.allocation.kvCache === "object") {
      exactKeys(
        record.allocation.kvCache,
        ["key", "value"],
        "allocation.kvCache",
        issues,
      );
    }
  }
  return unique(issues);
}

function strictPolicyRecordIssues(record: CapacityPolicyRecord): string[] {
  const issues: string[] = [];
  exactKeys(record, [
    "schemaVersion", "policyId", "policyVersion", "binding", "basis",
    "deviceReserveBytes", "hostReserveBytes", "safetyMarginBps",
    "tightHeadroomBps", "approval", "provenance",
  ], "record", issues);
  exactKeys(
    record.binding,
    ["hardwareTargetId", "operatingSystem", "runPath"],
    "binding",
    issues,
  );
  exactKeys(
    record.approval,
    ["decisionId", "approvedAt", "approvedBy"],
    "approval",
    issues,
  );
  return unique(issues);
}

function reviewedRecordIssue(
  manifest: ReviewedAdmissionManifest,
  recordKind: "fit-profile" | "capacity-policy",
  recordId: string,
  recordVersion: string,
  record: unknown,
  requiredStatus: "reviewed" | "owner-approved",
): string | null {
  const issues: string[] = [];
  if (!isRecord(manifest)) return "reviewedManifest";
  exactKeys(
    manifest,
    [
      "schemaVersion", "manifestId", "manifestVersion", "reviewedAt",
      "reviewedBy", "entries",
    ],
    "reviewedManifest",
    issues,
  );
  if (
    manifest.schemaVersion !== 1
    || !nonEmpty(manifest.manifestId)
    || !nonEmpty(manifest.manifestVersion)
    || !nonEmpty(manifest.reviewedBy)
    || !validTimestamp(manifest.reviewedAt)
    || !Array.isArray(manifest.entries)
  ) {
    issues.push("reviewedManifest.metadata");
  }
  for (const [index, entry] of manifest.entries.entries()) {
    exactKeys(
      entry,
      ["recordKind", "recordId", "recordVersion", "contentSha256", "status"],
      `reviewedManifest.entries.${index}`,
      issues,
    );
  }
  if (issues.length > 0) return unique(issues).join(",");
  const matches = manifest.entries.filter((entry) =>
    entry.recordKind === recordKind
    && entry.recordId === recordId
    && entry.recordVersion === recordVersion
  );
  if (matches.length !== 1) return "reviewedManifest.entry";
  const entry = matches[0]!;
  if (entry.status !== requiredStatus) return "reviewedManifest.entry.status";
  if (!lowercaseSha256(entry.contentSha256)) {
    return "reviewedManifest.entry.contentSha256";
  }
  if (entry.contentSha256 !== recordContentSha256(record)) {
    return "reviewedManifest.entry.contentSha256";
  }
  return null;
}

function compareObservedPool(
  observed: { modelBytes: number; contextBytes: number; computeBytes: number },
  calculated: { modelBytes: number; contextBytes: number; computeBytes: number },
  path: string,
  issues: string[],
): void {
  for (const key of ["modelBytes", "contextBytes", "computeBytes"] as const) {
    if (observed[key] !== calculated[key]) issues.push(`${path}.${key}`);
  }
}

function exactKeys(
  value: object,
  allowed: readonly PropertyKey[],
  path: string,
  issues: string[],
): void {
  const allowedSet = new Set(allowed);
  for (const key of Reflect.ownKeys(value)) {
    if (!allowedSet.has(key)) issues.push(`${path}.${String(key)}`);
  }
}

function invalidProducerContract(
  contract:
    | "hardware-target"
    | "exact-configuration-candidate"
    | "compatibility-admission-receipt",
  data: unknown,
): string | null {
  const validation = validateContract({
    schemaVersion: 1,
    contract,
    status: "ok",
    data,
    provenance: [],
    completeness: {
      complete: true,
      missing: [],
      warnings: [],
      recoverableActions: [],
    },
  });
  return validation.ok
    ? null
    : `The ${contract} producer output is invalid: ${validation.errors.join(" ")}`;
}

function validProvenanceArray(value: unknown): value is Provenance[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((item) => validateContract({
      schemaVersion: 1,
      contract: "fit-evidence-assessment",
      status: "unavailable",
      reasonCode: "fit-profile.provenance-validation",
      message: "Provenance validation carrier.",
      recoverableActions: [],
      provenance: [item],
      warnings: [],
    }).ok);
}

function sameRuntime(
  left: RuntimeConfiguration,
  right: RuntimeConfiguration,
): boolean {
  return runtimeKeys.every((key) => runtimeFieldEqual(left, right, key));
}

function runtimeFieldEqual(
  left: RuntimeConfiguration,
  right: RuntimeConfiguration,
  key: (typeof runtimeKeys)[number],
): boolean {
  return JSON.stringify(left[key]) === JSON.stringify(right[key]);
}

function cloneRuntime(value: RuntimeConfiguration): RuntimeConfiguration {
  return structuredClone(value);
}

function blocked(
  reasonCode: string,
  message: string,
  missing: string[] = [],
  mismatches: string[] = [],
): AdmissionBlocked {
  return {
    kind: "blocked",
    reasonCode: reasonCode.trim() || "fit-profile.unspecified",
    message: message.trim() || "Fit-profile admission failed.",
    missing: unique(missing),
    mismatches: unique(mismatches),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function lowercaseSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function validTimestamp(value: unknown): value is string {
  if (
    typeof value !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  ) {
    return false;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;
  const canonical = new Date(parsed).toISOString();
  return value === canonical || value === canonical.replace(".000Z", "Z");
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

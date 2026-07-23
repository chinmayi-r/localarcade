import candidateEnvelope from "../../docs/contracts/fixtures/exact-configuration-candidate.ok.json";
import hardwareEnvelope from "../../docs/contracts/fixtures/hardware-target.ok.json";
import receiptEnvelope from "../../docs/contracts/fixtures/compatibility-admission-receipt.ok.json";
import type {
  CompatibilityAdmissionReceipt,
  ExactConfigurationCandidate,
  HardwareTarget,
  Provenance,
} from "../../lib/contracts";
import type {
  EvidenceAdapterResult,
  NormalizedEvidenceComponent,
  ThroughputEvidenceComponents,
} from "../../lib/evidence";
import type { TwoPoolFitProfile } from "../../lib/fit";
import type { FitAssessmentInput } from "../../lib/assessment";
import {
  admitCapacityPolicy,
  admitFitProfile,
} from "../../lib/assessment";
import type { AdmissionResult } from "../../lib/assessment";
import { recordContentSha256 } from "../../lib/assessment/record-digest";

const MIB = 1024 ** 2;

export const candidate = structuredClone(
  candidateEnvelope.data,
) as ExactConfigurationCandidate;
candidate.runtime.contextTokens = 4_096;

export const hardwareTarget = structuredClone(
  hardwareEnvelope.data,
) as HardwareTarget;
hardwareTarget.memory.availableRamBytes = 16 * 1024 ** 3;
hardwareTarget.accelerators[0].deviceMemoryBytes = 8 * 1024 ** 3;

export const compatibilityReceipt = structuredClone(
  receiptEnvelope.data,
) as CompatibilityAdmissionReceipt;

export const fitProvenance: Provenance = {
  source: {
    id: "allocation-profile",
    version: "1",
    revision: "fixture-revision",
    url: "https://example.invalid/allocation-profile",
  },
  retrievedAt: "2026-07-22T12:00:00Z",
  observedAt: "2026-07-22T11:00:00Z",
  method: "measurement",
  hardwareMatch: "exact",
  configurationMatch: "exact",
  scope: {
    taskFamily: null,
    taskPackId: null,
    promptId: null,
    harnessId: "allocation-profile-v1",
  },
  sampleCount: 2,
  measurement: null,
  rawSourceRecordRef: "fixture://allocation-profile",
};

export const fitPolicyProvenance: Provenance = {
  source: {
    id: "m-f.capacity-policy",
    version: "1",
    revision: "fixture-revision",
    url: "https://example.invalid/capacity-policy",
  },
  retrievedAt: "2026-07-22T12:00:00Z",
  observedAt: null,
  method: "imported",
  hardwareMatch: "not-applicable",
  configurationMatch: "not-applicable",
  scope: {
    taskFamily: null,
    taskPackId: null,
    promptId: null,
    harnessId: null,
  },
  sampleCount: null,
  measurement: null,
  rawSourceRecordRef: "fixture://m-f-capacity-policy-v1",
};

export const twoPoolProfile: TwoPoolFitProfile = {
  id: "profile-candidate-fixture",
  maxContextTokens: 16_384,
  device: {
    modelBytes: 4_000 * MIB,
    computeFixedBytes: 300 * MIB,
    contextBytesAtReference: 512 * MIB,
    computeContextBytesAtReference: 0,
    referenceContextTokens: 4_096,
  },
  host: {
    modelBytes: 1_000 * MIB,
    computeFixedBytes: 16 * MIB,
    contextBytesAtReference: 0,
    computeContextBytesAtReference: 4 * MIB,
    referenceContextTokens: 4_096,
  },
};

const promptProvenance: Provenance = {
  source: {
    id: "personal-benchmark",
    version: "1",
    revision: "fixture-revision",
    url: "local://benchmark/fixture",
  },
  retrievedAt: null,
  observedAt: "2026-07-22T11:30:00Z",
  method: "measurement",
  hardwareMatch: "exact",
  configurationMatch: "exact",
  scope: {
    taskFamily: null,
    taskPackId: null,
    promptId: null,
    harnessId: "benchmark-v1",
  },
  sampleCount: 3,
  measurement: {
    unit: "tokens-per-second",
    interval: { lower: 150, upper: 180 },
    confidence: null,
    eligible: true,
    eligibilityReasons: [],
  },
  rawSourceRecordRef: "fixture://benchmark/prompt",
};

const generationProvenance: Provenance = {
  ...promptProvenance,
  measurement: {
    ...promptProvenance.measurement!,
    interval: { lower: 40, upper: 55 },
  },
  rawSourceRecordRef: "fixture://benchmark/generation",
};

const ttftProvenance: Provenance = {
  ...promptProvenance,
  measurement: {
    ...promptProvenance.measurement!,
    unit: "milliseconds",
    interval: { lower: 120, upper: 220 },
  },
  rawSourceRecordRef: "fixture://benchmark/ttft",
};

export const lossyThroughputPrior: EvidenceAdapterResult<ThroughputEvidenceComponents> = {
  kind: "lossy",
  value: {
    candidateId: candidate.candidateId,
    hardwareTargetId: hardwareTarget.hardwareTargetId,
    claim: "estimated",
    performance: {
      promptTokensPerSecond: { low: 150, high: 180 },
      generationTokensPerSecond: { low: 40, high: 55 },
      timeToFirstTokenMs: { low: 120, high: 220 },
    },
    evidence: {
      promptSpeed: [{
        ...promptProvenance,
        source: { id: "localscore", version: null, revision: null, url: "https://example.invalid/throughput-prior" },
        method: "estimate",
        configurationMatch: "compatible",
        rawSourceRecordRef: "throughput-prior:fixture:prompt-throughput",
      }],
      generationSpeed: [{
        ...generationProvenance,
        source: { id: "localscore", version: null, revision: null, url: "https://example.invalid/throughput-prior" },
        method: "estimate",
        configurationMatch: "compatible",
        rawSourceRecordRef: "throughput-prior:fixture:generation-throughput",
      }],
      timeToFirstToken: [{
        ...ttftProvenance,
        source: { id: "localscore", version: null, revision: null, url: "https://example.invalid/throughput-prior" },
        method: "estimate",
        configurationMatch: "compatible",
        rawSourceRecordRef: "throughput-prior:fixture:time-to-first-token",
      }],
    },
  },
  reasons: [
    "The prior has compatible rather than immutable target configuration scope.",
  ],
};

export const exactSpeedRecords: Array<EvidenceAdapterResult<NormalizedEvidenceComponent>> = [
  {
    kind: "exact",
    value: {
      candidateId: candidate.candidateId,
      hardwareTargetId: hardwareTarget.hardwareTargetId,
      metric: "prompt-throughput",
      claim: "verified",
      provenance: [promptProvenance],
    },
  },
  {
    kind: "exact",
    value: {
      candidateId: candidate.candidateId,
      hardwareTargetId: hardwareTarget.hardwareTargetId,
      metric: "generation-throughput",
      claim: "verified",
      provenance: [generationProvenance],
    },
  },
  {
    kind: "exact",
    value: {
      candidateId: candidate.candidateId,
      hardwareTargetId: hardwareTarget.hardwareTargetId,
      metric: "time-to-first-token",
      claim: "verified",
      provenance: [ttftProvenance],
    },
  },
];

export const scopedTaskEvidence: EvidenceAdapterResult<NormalizedEvidenceComponent> = {
  kind: "exact",
  value: {
    candidateId: candidate.candidateId,
    hardwareTargetId: hardwareTarget.hardwareTargetId,
    metric: "task-success",
    claim: "verified",
    provenance: [{
      ...promptProvenance,
      scope: {
        taskFamily: "coding",
        taskPackId: "mechanical-coding-v1",
        promptId: null,
        harnessId: "quick-check-v1",
      },
      measurement: {
        unit: "probability",
        interval: { lower: 1, upper: 1 },
        confidence: null,
        eligible: true,
        eligibilityReasons: [],
      },
      rawSourceRecordRef: "fixture://quick-check/task-success",
    }],
  },
};

export function completeInput(): FitAssessmentInput {
  const profileRecord = {
    schemaVersion: 1 as const,
    profileId: twoPoolProfile.id,
    profileVersion: "1",
    scope: {
      candidateId: candidate.candidateId,
      artifactSha256: candidate.artifact.sha256,
      hardwareTargetId: hardwareTarget.hardwareTargetId,
      acceleratorId: hardwareTarget.accelerators[0].acceleratorId,
      runtime: structuredClone(candidate.runtime),
    },
    mode: "split" as const,
    runPath: "gpu" as const,
    allocation: structuredClone(twoPoolProfile),
    sourceEvidence: {
      tool: {
        id: "allocation-observer",
        version: "1",
        executableSha256: "a".repeat(64),
      },
      command: "allocation-observer --fixture",
      observations: splitObservations(),
    },
    provenance: [structuredClone(fitProvenance)],
  };
  const admittedProfile = requireAdmission(admitFitProfile({
    record: profileRecord,
    reviewedManifest: manifestFor(
      "fit-profile",
      profileRecord.profileId,
      profileRecord.profileVersion,
      profileRecord,
      "reviewed",
    ),
    candidate: structuredClone(candidate),
    compatibilityReceipt: structuredClone(compatibilityReceipt),
    hardwareTarget: structuredClone(hardwareTarget),
  }));
  const policyRecord = {
    schemaVersion: 1 as const,
    policyId: "m-f.capacity-policy",
    policyVersion: "1",
    binding: {
      hardwareTargetId: hardwareTarget.hardwareTargetId,
      operatingSystem: hardwareTarget.os.family,
      runPath: "gpu" as const,
    },
    basis: "confirmed-capacity-minus-reserve" as const,
    deviceReserveBytes: 256 * MIB,
    hostReserveBytes: 2 * 1024 ** 3,
    safetyMarginBps: 500,
    tightHeadroomBps: 0 as const,
    approval: {
      decisionId: "fixture-policy-approval",
      approvedAt: "2026-07-22T12:00:00Z",
      approvedBy: "test-fixture",
    },
    provenance: [structuredClone(fitPolicyProvenance)],
  };
  const admittedPolicy = requireAdmission(admitCapacityPolicy({
    record: policyRecord,
    reviewedManifest: manifestFor(
      "capacity-policy",
      policyRecord.policyId,
      policyRecord.policyVersion,
      policyRecord,
      "owner-approved",
    ),
    hardwareTarget: structuredClone(hardwareTarget),
    runPath: "gpu",
  }));
  return {
    assessmentId: "assessment-m-f-proof",
    candidate: structuredClone(candidate),
    compatibilityReceipt: structuredClone(compatibilityReceipt),
    hardwareTarget: structuredClone(hardwareTarget),
    desiredContextTokens: 4_096,
    fitProfile: admittedProfile,
    fitPolicy: admittedPolicy,
    evidence: {
      throughput: null,
      records: structuredClone(exactSpeedRecords),
    },
    upstreamAdvisory: null,
  };
}

export function hostOnlyInput(): FitAssessmentInput {
  const input = completeInput();
  input.candidate.runtime.backend = "cpu";
  input.candidate.runtime.gpuLayers = 0;
  input.compatibilityReceipt.target.backend = "cpu";
  input.compatibilityReceipt.target.featureFlags = ["cpu"];
  input.compatibilityReceipt.assertion.conditions.backends = ["cpu"];
  input.hardwareTarget.accelerators = [];
  const hostProfileRecord = {
    schemaVersion: 1 as const,
    profileId: "host-profile-candidate-fixture",
    profileVersion: "1",
    scope: {
      candidateId: input.candidate.candidateId,
      artifactSha256: input.candidate.artifact.sha256,
      hardwareTargetId: input.hardwareTarget.hardwareTargetId,
      acceleratorId: null,
      runtime: structuredClone(input.candidate.runtime),
    },
    mode: "host" as const,
    runPath: "cpu" as const,
    allocation: {
      artifact: {
        id: "host-profile-candidate-fixture",
        weightBytes: input.candidate.artifact.bytes,
        maxContextTokens: 16_384,
        runtimeComputeBufferBytes: 256 * MIB,
        kvCache: {
          key: [{
            quantization: "f16" as const,
            referenceContextTokens: 4_096,
            bytesAtReferenceContext: 128 * MIB,
          }],
          value: [{
            quantization: "f16" as const,
            referenceContextTokens: 4_096,
            bytesAtReferenceContext: 128 * MIB,
          }],
        },
      },
      kvCache: "f16" as const,
    },
    sourceEvidence: {
      tool: {
        id: "allocation-observer",
        version: "1",
        executableSha256: "a".repeat(64),
      },
      command: "allocation-observer --fixture --cpu",
      observations: [
        hostObservation(input.candidate.artifact.bytes, 4_096, 256 * MIB),
        hostObservation(input.candidate.artifact.bytes, 16_384, 256 * MIB),
      ],
    },
    provenance: [structuredClone(fitProvenance)],
  };
  input.fitProfile = requireAdmission(admitFitProfile({
    record: hostProfileRecord,
    reviewedManifest: manifestFor(
      "fit-profile",
      hostProfileRecord.profileId,
      hostProfileRecord.profileVersion,
      hostProfileRecord,
      "reviewed",
    ),
    candidate: structuredClone(input.candidate),
    compatibilityReceipt: structuredClone(input.compatibilityReceipt),
    hardwareTarget: structuredClone(input.hardwareTarget),
  }));
  const hostPolicyRecord = {
    schemaVersion: 1 as const,
    policyId: "m-f.capacity-policy",
    policyVersion: "1",
    binding: {
      hardwareTargetId: input.hardwareTarget.hardwareTargetId,
      operatingSystem: input.hardwareTarget.os.family,
      runPath: "cpu" as const,
    },
    basis: "confirmed-capacity-minus-reserve" as const,
    deviceReserveBytes: 0,
    hostReserveBytes: 2 * 1024 ** 3,
    safetyMarginBps: 500,
    tightHeadroomBps: 0 as const,
    approval: {
      decisionId: "fixture-policy-approval",
      approvedAt: "2026-07-22T12:00:00Z",
      approvedBy: "test-fixture",
    },
    provenance: [structuredClone(fitPolicyProvenance)],
  };
  input.fitPolicy = requireAdmission(admitCapacityPolicy({
    record: hostPolicyRecord,
    reviewedManifest: manifestFor(
      "capacity-policy",
      hostPolicyRecord.policyId,
      hostPolicyRecord.policyVersion,
      hostPolicyRecord,
      "owner-approved",
    ),
    hardwareTarget: structuredClone(input.hardwareTarget),
    runPath: "cpu",
  }));
  input.evidence.throughput = null;
  input.evidence.records = [];
  return input;
}

function splitObservations() {
  return [
    {
      contextTokens: 4_096,
      observedAt: "2026-07-22T11:00:00Z",
      rawSourceRecordRef: "fixture://allocation-profile/4096",
      device: {
        modelBytes: 4_000 * MIB,
        contextBytes: 512 * MIB,
        computeBytes: 300 * MIB,
      },
      host: {
        modelBytes: 1_000 * MIB,
        contextBytes: 0,
        computeBytes: 20 * MIB,
      },
    },
    {
      contextTokens: 16_384,
      observedAt: "2026-07-22T11:05:00Z",
      rawSourceRecordRef: "fixture://allocation-profile/16384",
      device: {
        modelBytes: 4_000 * MIB,
        contextBytes: 2_048 * MIB,
        computeBytes: 300 * MIB,
      },
      host: {
        modelBytes: 1_000 * MIB,
        contextBytes: 0,
        computeBytes: 32 * MIB,
      },
    },
  ];
}

function hostObservation(
  modelBytes: number,
  contextTokens: number,
  computeBytes: number,
) {
  return {
    contextTokens,
    observedAt: contextTokens === 4_096
      ? "2026-07-22T11:00:00Z"
      : "2026-07-22T11:05:00Z",
    rawSourceRecordRef: `fixture://host-allocation-profile/${contextTokens}`,
    device: null,
    host: {
      modelBytes,
      contextBytes: contextTokens === 4_096 ? 256 * MIB : 1_024 * MIB,
      computeBytes,
    },
  };
}

function manifestFor(
  recordKind: "fit-profile" | "capacity-policy",
  recordId: string,
  recordVersion: string,
  record: unknown,
  status: "reviewed" | "owner-approved",
) {
  return {
    schemaVersion: 1 as const,
    manifestId: "m-f-reviewed-record-fixture",
    manifestVersion: "1",
    reviewedAt: "2026-07-22T12:00:00Z",
    reviewedBy: "test-fixture",
    entries: [{
      recordKind,
      recordId,
      recordVersion,
      contentSha256: recordContentSha256(record),
      status,
    }],
  };
}

function requireAdmission<T>(result: AdmissionResult<T>): T {
  if (result.kind === "ok") return result.value;
  throw new Error(
    `${result.reasonCode}: ${result.message} `
      + `missing=${result.missing.join(",")} mismatches=${result.mismatches.join(",")}`,
  );
}

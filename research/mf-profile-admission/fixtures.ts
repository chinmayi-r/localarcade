import candidateEnvelope from "../../docs/contracts/fixtures/exact-configuration-candidate.ok.json";
import hardwareEnvelope from "../../docs/contracts/fixtures/hardware-target.ok.json";
import receiptEnvelope from "../../docs/contracts/fixtures/compatibility-admission-receipt.ok.json";
import type {
  CompatibilityAdmissionReceipt,
  ExactConfigurationCandidate,
  HardwareTarget,
  Provenance,
} from "../../lib/contracts";
import type { TwoPoolFitProfile } from "../../lib/fit";
import { recordContentSha256 } from "../../lib/assessment/record-digest";

const MIB = 1024 ** 2;

export const candidate = structuredClone(
  candidateEnvelope.data,
) as ExactConfigurationCandidate;
candidate.runtime.contextTokens = 4_096;

export const hardwareTarget = structuredClone(
  hardwareEnvelope.data,
) as HardwareTarget;
hardwareTarget.accelerators[0].deviceMemoryBytes = 8 * 1024 ** 3;

export const compatibilityReceipt = structuredClone(
  receiptEnvelope.data,
) as CompatibilityAdmissionReceipt;

export const profileProvenance: Provenance = {
  source: {
    id: "allocation-profile",
    version: "1",
    revision: "synthetic-fixture",
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

export const policyProvenance: Provenance = {
  source: {
    id: "m-f.capacity-policy",
    version: "1",
    revision: "synthetic-fixture",
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
  rawSourceRecordRef: "fixture://capacity-policy",
};

export const allocation: TwoPoolFitProfile = {
  id: "profile-admission-synthetic",
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

export function completeProfileAdmissionInput() {
  const record = {
    schemaVersion: 1 as const,
    profileId: "profile-admission-synthetic",
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
    allocation: structuredClone(allocation),
    sourceEvidence: {
      tool: {
        id: "allocation-observer",
        version: "1",
        executableSha256: "a".repeat(64),
      },
      command: "allocation-observer --fixture",
      observations: [
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
      ],
    },
    provenance: [structuredClone(profileProvenance)],
  };
  return {
    record,
    reviewedManifest: {
      schemaVersion: 1 as const,
      manifestId: "m-f-profile-review-fixture",
      manifestVersion: "1",
      reviewedAt: "2026-07-22T12:00:00Z",
      reviewedBy: "test-fixture",
      entries: [{
        recordKind: "fit-profile" as const,
        recordId: record.profileId,
        recordVersion: record.profileVersion,
        contentSha256: recordContentSha256(record),
        status: "reviewed" as const,
      }],
    },
    candidate: structuredClone(candidate),
    compatibilityReceipt: structuredClone(compatibilityReceipt),
    hardwareTarget: structuredClone(hardwareTarget),
  };
}

export function completePolicyAdmissionInput() {
  const record = {
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
    provenance: [structuredClone(policyProvenance)],
  };
  return {
    record,
    reviewedManifest: {
      schemaVersion: 1 as const,
      manifestId: "m-f-policy-review-fixture",
      manifestVersion: "1",
      reviewedAt: "2026-07-22T12:00:00Z",
      reviewedBy: "test-fixture",
      entries: [{
        recordKind: "capacity-policy" as const,
        recordId: record.policyId,
        recordVersion: record.policyVersion,
        contentSha256: recordContentSha256(record),
        status: "owner-approved" as const,
      }],
    },
    hardwareTarget: structuredClone(hardwareTarget),
    runPath: "gpu" as const,
  };
}

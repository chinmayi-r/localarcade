import candidateEnvelope from "../../docs/contracts/fixtures/exact-configuration-candidate.ok.json";
import hardwareEnvelope from "../../docs/contracts/fixtures/hardware-target.ok.json";
import receiptEnvelope from "../../docs/contracts/fixtures/compatibility-admission-receipt.ok.json";
import type {
  CompatibilityAdmissionReceipt,
  ExactConfigurationCandidate,
  HardwareTarget,
} from "../../lib/contracts";
import type { TwoPoolFitProfile } from "../../lib/fit";
import { recordContentSha256 } from "../../lib/assessment/record-digest";
import type {
  PolicySweepInput,
  ProfileCollectionBundleV1,
} from "./types";

const MIB = 1024 ** 2;

export function collectionFixture(): ProfileCollectionBundleV1 {
  const candidate = structuredClone(
    candidateEnvelope.data,
  ) as ExactConfigurationCandidate;
  candidate.runtime.contextTokens = 4_096;
  const receipt = structuredClone(
    receiptEnvelope.data,
  ) as CompatibilityAdmissionReceipt;
  const hardware = structuredClone(
    hardwareEnvelope.data,
  ) as HardwareTarget;
  hardware.accelerators[0]!.deviceMemoryBytes = 8 * 1024 ** 3;

  const bundle: ProfileCollectionBundleV1 = {
    schemaVersion: 1,
    contract: "mf-profile-collection-bundle",
    collectionId: "synthetic-split-gpu",
    collectionVersion: "1",
    evidenceClassification: "synthetic-machinery-only",
    candidate,
    compatibilityReceipt: receipt,
    hardwareTarget: hardware,
    bindings: {
      candidateContentSha256: recordContentSha256(candidate),
      compatibilityReceiptContentSha256: recordContentSha256(receipt),
      hardwareTargetContentSha256: recordContentSha256(hardware),
      artifactSha256: candidate.artifact.sha256,
    },
    tool: {
      id: "synthetic-allocation-observer",
      version: "1",
      executableSha256: "a".repeat(64),
    },
    command: {
      argv: [
        "synthetic-allocation-observer",
        "--machinery-fixture",
        "--no-process-was-run",
      ],
    },
    runPath: "gpu",
    contexts: [
      context(4_096, 512 * MIB, 300 * MIB, 20 * MIB),
      context(16_384, 2_048 * MIB, 300 * MIB, 32 * MIB),
    ],
  };
  return bundle;
}

function context(
  contextTokens: number,
  deviceContextBytes: number,
  deviceComputeBytes: number,
  hostComputeBytes: number,
): ProfileCollectionBundleV1["contexts"][number] {
  const observation = {
    device: {
      modelBytes: 4_000 * MIB,
      contextBytes: deviceContextBytes,
      computeBytes: deviceComputeBytes,
    },
    host: {
      modelBytes: 1_000 * MIB,
      contextBytes: 0,
      computeBytes: hostComputeBytes,
    },
  };
  return {
    contextTokens,
    attempts: [1, 2].map((repetition) => ({
      attemptId: `synthetic-${contextTokens}-${repetition}`,
      observedAt: repetition === 1
        ? "2026-07-23T10:00:00.000Z"
        : "2026-07-23T10:01:00.000Z",
      rawSourceRecordRef:
        `fixture://synthetic-machinery-only/${contextTokens}/${repetition}`,
      status: "completed" as const,
      device: structuredClone(observation.device),
      host: structuredClone(observation.host),
    })),
  };
}

export const syntheticProfile: TwoPoolFitProfile = {
  id: "synthetic-policy-sweep-profile",
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

export function policySweepFixture(): PolicySweepInput {
  return {
    schemaVersion: 1,
    evidenceClassification: "synthetic-machinery-only",
    policies: [
      {
        policyId: "synthetic-zero",
        deviceReserveBytes: 0,
        hostReserveBytes: 0,
        safetyMarginBps: 0,
      },
      {
        policyId: "synthetic-conservative",
        deviceReserveBytes: 256 * MIB,
        hostReserveBytes: 512 * MIB,
        safetyMarginBps: 500,
      },
    ],
    cases: [
      {
        caseId: "synthetic-loaded-near-boundary",
        profile: structuredClone(syntheticProfile),
        contextTokens: 4_096,
        devicePhysicalBytes: 4_900 * MIB,
        hostPhysicalBytes: 2_000 * MIB,
        observedOutcome: "loaded",
      },
      {
        caseId: "synthetic-capacity-failure",
        profile: structuredClone(syntheticProfile),
        contextTokens: 4_096,
        devicePhysicalBytes: 4_800 * MIB,
        hostPhysicalBytes: 2_000 * MIB,
        observedOutcome: "capacity-failure",
      },
      {
        caseId: "synthetic-unknown",
        profile: structuredClone(syntheticProfile),
        contextTokens: 4_096,
        devicePhysicalBytes: 8_000 * MIB,
        hostPhysicalBytes: 4_000 * MIB,
        observedOutcome: "unknown",
      },
    ],
  };
}

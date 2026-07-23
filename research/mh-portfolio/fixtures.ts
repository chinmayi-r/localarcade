import requestFixture from "../../docs/contracts/fixtures/recommendation-request.ok.json";
import { assessFitEvidence } from "../../lib/assessment";
import type {
  ContractEnvelope,
  ExactConfigurationCandidate,
  Provenance,
} from "../../lib/contracts";
import type { EvidenceAdapterResult, NormalizedEvidenceComponent } from "../../lib/evidence";
import type {
  BuildRecommendationPortfolioInputV1,
  CandidateUniverseReceiptV1,
  PortfolioCandidateEntryV1,
  PortfolioUpstreamGapEntryV1,
  ReviewedFamiliaritySignalV1,
} from "../../lib/portfolio";
import { admitPortfolioCandidateEntry } from "../../lib/portfolio";
import { completeInput as completeFitInput } from "../mf-assessment/fixtures";

const baseFitInput = completeFitInput();
const assessed = assessFitEvidence(baseFitInput);
if (assessed.status !== "ok" && assessed.status !== "partial") {
  throw new Error("Synthetic M-F fixture did not produce a data envelope.");
}
const baseAssessment = assessed;

export function requestEnvelope(): BuildRecommendationPortfolioInputV1["request"] {
  const request = structuredClone(requestFixture) as BuildRecommendationPortfolioInputV1["request"];
  request.data.task.derivedContextTokens = baseFitInput.desiredContextTokens;
  request.data.task.needs = [];
  request.data.advanced.maximumArtifactBytes = null;
  return request;
}

export type CandidateOptions = {
  id?: string;
  artifactId?: string;
  family?: string;
  position?: number;
  fit?: "good" | "tight" | "does-not-fit" | "unknown";
  partialMissing?: string[];
  installed?: boolean | null;
  capabilities?: Partial<PortfolioCandidateEntryV1["eligibility"]["capabilities"]>;
  generationRange?: { low: number; high: number } | null;
  totalRequiredBytes?: number;
  familiarityOrdinal?: number | null;
  evidence?: Array<EvidenceAdapterResult<NormalizedEvidenceComponent>>;
};

export function candidateEntry(options: CandidateOptions = {}): PortfolioCandidateEntryV1 {
  const id = options.id ?? "candidate-a";
  const artifactId = options.artifactId ?? `artifact-${id}`;
  const family = options.family ?? `family-${id}`;
  const candidate = structuredClone(baseFitInput.candidate) as ExactConfigurationCandidate;
  candidate.candidateId = id;
  candidate.modelFamily = { modelFamilyId: family, displayName: family };
  candidate.artifact.artifactId = artifactId;
  candidate.artifact.filename = `${artifactId}.gguf`;
  candidate.artifact.sha256 = shaFor(id);
  candidate.runtime.runtimeConfigurationId = `runtime-${id}`;

  const receipt = structuredClone(baseFitInput.compatibilityReceipt);
  receipt.compatibilityAdmissionId = `compatibility-${id}`;
  receipt.candidateId = id;
  receipt.artifactId = artifactId;
  receipt.artifactSha256 = candidate.artifact.sha256;
  receipt.runtimeConfigurationId = candidate.runtime.runtimeConfigurationId;
  receipt.assertion.artifactId = artifactId;

  const assessment = structuredClone(baseAssessment);
  assessment.data.assessmentId = `assessment-${id}`;
  assessment.data.candidateId = id;
  assessment.data.fit = options.fit ?? "good";
  assessment.data.blockingReasons = assessment.data.fit === "does-not-fit"
    ? ["The confirmed capacity is insufficient."]
    : [];
  if (options.generationRange !== undefined) {
    assessment.data.performance.generationTokensPerSecond =
      options.generationRange;
    for (const item of assessment.data.evidence.generationSpeed) {
      if (item.measurement !== null) {
        item.measurement.interval = options.generationRange === null
          ? null
          : {
              lower: options.generationRange.low,
              upper: options.generationRange.high,
            };
      }
    }
  }
  if (options.totalRequiredBytes !== undefined) {
    assessment.data.memoryPools.device.requiredBytes = options.totalRequiredBytes;
    assessment.data.memoryPools.host.requiredBytes = 0;
  }
  const partialMissing = options.partialMissing ?? [];
  if (partialMissing.length > 0) {
    assessment.status = "partial";
    assessment.completeness = {
      complete: false,
      missing: [...partialMissing],
      warnings: ["Synthetic M-H partial fixture."],
      recoverableActions: ["Supply the missing evidence."],
    };
  }

  const capabilities = {
    "tool-use": true,
    "structured-output": true,
    vision: true,
    embeddings: true,
    offline: true,
    ...options.capabilities,
  };
  return {
    kind: "candidate",
    artifactId,
    candidate,
    compatibilityReceipt: receipt,
    assessment,
    evidence: structuredClone(options.evidence ?? []),
    familiarity: options.familiarityOrdinal === undefined
      || options.familiarityOrdinal === null
      ? null
      : familiarity(family, id, artifactId, options.familiarityOrdinal),
    catalogReference: {
      snapshotId: "snapshot-mh-proof",
      position: options.position ?? 0,
    },
    eligibility: {
      installed: options.installed === undefined ? true : options.installed,
      capabilities,
    },
  };
}

export function upstreamGap(
  artifactId = "artifact-gap",
  position = 0,
): PortfolioUpstreamGapEntryV1 {
  return {
    kind: "upstream-gap",
    artifactId,
    modelFamilyId: null,
    reasonCode: "runtime.candidate-unavailable",
    message: "No exact runtime candidate could be constructed.",
    catalogReference: { snapshotId: "snapshot-mh-proof", position },
    provenance: [structuredClone(baseFitInput.candidate.provenance[0])],
  };
}

export function portfolioInput(
  entries: CandidateUniverseReceiptV1["entries"],
): BuildRecommendationPortfolioInputV1 {
  const request = requestEnvelope();
  const copiedEntries = structuredClone(entries).map((entry) =>
    entry.kind === "candidate"
      ? admitPortfolioCandidateEntry(entry)
      : entry);
  return {
    request,
    universe: {
      receiptVersion: 1,
      universeId: "universe-mh-proof",
      requestId: request.data.requestId,
      hardwareTargetId: request.data.hardwareTargetId,
      registrySnapshot: {
        snapshotId: "snapshot-mh-proof",
        artifactIds: [...copiedEntries]
          .sort((left, right) =>
            left.catalogReference.position - right.catalogReference.position
            || left.artifactId.localeCompare(right.artifactId))
          .map((entry) => entry.artifactId),
      },
      entries: copiedEntries,
    },
    policy: {
      policyVersion: 1,
      methodologyVersion: "portfolio-compatibility-v1",
    },
  };
}

export function taskEvidence(
  candidateId: string,
  low: number,
  high: number,
): EvidenceAdapterResult<NormalizedEvidenceComponent> {
  const provenance = structuredClone(baseFitInput.candidate.provenance[0]);
  provenance.method = "objective-check";
  provenance.configurationMatch = "exact";
  provenance.hardwareMatch = "exact";
  provenance.scope.taskFamily = "coding";
  provenance.measurement = {
    unit: "probability",
    interval: { lower: low, upper: high },
    confidence: null,
    eligible: true,
    eligibilityReasons: [],
  };
  return {
    kind: "exact",
    value: {
      candidateId,
      hardwareTargetId: baseFitInput.hardwareTarget.hardwareTargetId,
      metric: "task-success",
      claim: "verified",
      provenance: [provenance],
    },
  };
}

export function assertDataEnvelope(
  envelope: ContractEnvelope,
): asserts envelope is Extract<ContractEnvelope, { status: "ok" | "partial" }> {
  if (envelope.status !== "ok" && envelope.status !== "partial") {
    throw new Error("Expected a data envelope.");
  }
}

function familiarity(
  family: string,
  candidateId: string,
  artifactId: string,
  ordinal: number,
): ReviewedFamiliaritySignalV1 {
  return {
    signalVersion: 1,
    signalId: `familiarity-${candidateId}`,
    modelFamilyId: family,
    candidateId,
    artifactId,
    ordinal,
    ordinalDirection: "higher-is-more-familiar",
    reviewedBy: "synthetic-test-reviewer",
    reviewedAt: "2026-07-22T12:00:00Z",
    provenance: [structuredClone(baseFitInput.candidate.provenance[0]) as Provenance],
  };
}

function shaFor(value: string): string {
  let state = 0x811c9dc5;
  for (const character of value) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 0x01000193);
  }
  return Array.from({ length: 64 }, (_, index) =>
    ((state >>> ((index % 8) * 4)) & 0xf).toString(16)).join("");
}

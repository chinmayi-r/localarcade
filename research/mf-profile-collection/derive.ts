import type { Provenance } from "../../lib/contracts";
import type { MemoryPoolProfile } from "../../lib/fit/memory-pools";
import { recordContentSha256 } from "../../lib/assessment/record-digest";
import type { RuntimeScopedFitProfileRecord } from "../../lib/assessment";
import type {
  CompletedCollectionAttempt,
  PoolObservation,
  ProfileCollectionBundleV1,
  ProfileDerivation,
} from "./types";
import { validateCollectionBundle } from "./validator";

export function deriveProposedProfile(value: unknown): ProfileDerivation {
  const validation = validateCollectionBundle(value);
  if (validation.kind === "blocked") return validation;
  const bundle = validation.value;
  if (bundle.evidenceClassification !== "synthetic-machinery-only") {
    return derivationBlocked(
      "fit-profile-collection.trusted-capture-boundary-unavailable",
      [bundle.evidenceClassification],
    );
  }
  const bundleContentSha256 = recordContentSha256(bundle);
  const consensus: Array<{
    contextTokens: number;
    observedAt: string;
    rawSourceRecordRef: string;
    device: PoolObservation;
    host: PoolObservation;
  }> = [];

  for (const context of bundle.contexts) {
    const attempts = context.attempts;
    const incomplete = attempts.filter((attempt) => attempt.status !== "completed");
    if (incomplete.length > 0) {
      return derivationBlocked(
        "fit-profile-collection.incomplete-attempt",
        incomplete.map((attempt) => attempt.attemptId),
      );
    }
    const completed = attempts as CompletedCollectionAttempt[];
    const first = completed[0]!;
    for (const attempt of completed.slice(1)) {
      if (
        recordContentSha256(attempt.device)
          !== recordContentSha256(first.device)
        || recordContentSha256(attempt.host)
          !== recordContentSha256(first.host)
      ) {
        return derivationBlocked(
          "fit-profile-collection.repeat-disagreement",
          [first.attemptId, attempt.attemptId],
        );
      }
    }
    consensus.push({
      contextTokens: context.contextTokens,
      observedAt: first.observedAt,
      rawSourceRecordRef:
        `collection://${bundle.collectionId}/${bundle.collectionVersion}`
        + `/contexts/${context.contextTokens}?sha256=${bundleContentSha256}`,
      device: structuredClone(first.device),
      host: structuredClone(first.host),
    });
  }

  consensus.sort((left, right) => left.contextTokens - right.contextTokens);
  try {
    const profileId = `profile:${bundle.collectionId}:${bundle.collectionVersion}`;
    const allocation = {
      id: profileId,
      maxContextTokens: consensus[consensus.length - 1]!.contextTokens,
      device: derivePool(
        consensus.map((item) => ({
          contextTokens: item.contextTokens,
          pool: item.device,
        })),
      ),
      host: derivePool(
        consensus.map((item) => ({
          contextTokens: item.contextTokens,
          pool: item.host,
        })),
      ),
    };
    const provenance: Provenance[] = [{
      source: {
        id: bundle.tool.id,
        version: bundle.tool.version,
        revision: bundle.tool.executableSha256,
        url: null,
      },
      retrievedAt: null,
      observedAt: consensus[0]!.observedAt,
      method: "measurement",
      hardwareMatch: "exact",
      configurationMatch: "exact",
      scope: {
        taskFamily: null,
        taskPackId: null,
        promptId: null,
        harnessId: COLLECTION_HARNESS_ID,
      },
      sampleCount: bundle.contexts.reduce(
        (total, context) => total + context.attempts.length,
        0,
      ),
      measurement: null,
      rawSourceRecordRef:
        `collection://${bundle.collectionId}/${bundle.collectionVersion}`
        + `?sha256=${bundleContentSha256}`,
    }];
    const record: RuntimeScopedFitProfileRecord = {
      schemaVersion: 1,
      profileId,
      profileVersion: bundle.collectionVersion,
      scope: {
        candidateId: bundle.candidate.candidateId,
        artifactSha256: bundle.candidate.artifact.sha256,
        hardwareTargetId: bundle.hardwareTarget.hardwareTargetId,
        acceleratorId:
          bundle.hardwareTarget.accelerators[0]!.acceleratorId,
        runtime: structuredClone(bundle.candidate.runtime),
      },
      mode: "split",
      runPath: "gpu",
      allocation,
      sourceEvidence: {
        tool: structuredClone(bundle.tool),
        command: JSON.stringify(bundle.command.argv),
        observations: consensus,
      },
      provenance,
    };
    return {
      kind: "proposed-unreviewed",
      record,
      recordContentSha256: recordContentSha256(record),
      warning:
        "Synthetic collection proves machinery only. This proposed record is not reviewed, production evidence, or a capacity policy.",
    };
  } catch (error) {
    return derivationBlocked(
      "fit-profile-collection.scaling-unsupported",
      [error instanceof Error ? error.message : "profile derivation"],
    );
  }
}

const COLLECTION_HARNESS_ID = "mf-profile-collection-v1";

function derivePool(
  observations: Array<{ contextTokens: number; pool: PoolObservation }>,
): MemoryPoolProfile {
  const reference = observations[0]!;
  const comparison = observations[1]!;
  if (
    observations.some((item) =>
      item.pool.modelBytes !== reference.pool.modelBytes)
  ) {
    throw new TypeError("model bytes changed across contexts");
  }

  const contextBytesAtReference = exactScaleToReference(
    reference.pool.contextBytes,
    comparison.pool.contextBytes,
    reference.contextTokens,
    comparison.contextTokens,
    "context",
    true,
  );
  const computeContextBytesAtReference = exactScaleToReference(
    reference.pool.computeBytes,
    comparison.pool.computeBytes,
    reference.contextTokens,
    comparison.contextTokens,
    "compute",
    false,
  );
  const computeFixedBytes =
    reference.pool.computeBytes - computeContextBytesAtReference;
  if (computeFixedBytes < 0) {
    throw new TypeError("derived fixed compute bytes are negative");
  }

  const profile: MemoryPoolProfile = {
    modelBytes: reference.pool.modelBytes,
    computeFixedBytes,
    contextBytesAtReference,
    computeContextBytesAtReference,
    referenceContextTokens: reference.contextTokens,
  };
  for (const observation of observations) {
    if (
      scale(profile.contextBytesAtReference, observation.contextTokens,
        profile.referenceContextTokens) !== observation.pool.contextBytes
      || profile.computeFixedBytes
        + scale(
          profile.computeContextBytesAtReference,
          observation.contextTokens,
          profile.referenceContextTokens,
        ) !== observation.pool.computeBytes
    ) {
      throw new TypeError(
        `context ${observation.contextTokens} does not match one exact linear profile`,
      );
    }
  }
  return profile;
}

function exactScaleToReference(
  firstValue: number,
  secondValue: number,
  firstContext: number,
  secondContext: number,
  label: string,
  mustPassOrigin: boolean,
): number {
  if (secondContext <= firstContext) {
    throw new TypeError(`${label} contexts are not increasing`);
  }
  if (mustPassOrigin) {
    if (
      BigInt(firstValue) * BigInt(secondContext)
        !== BigInt(secondValue) * BigInt(firstContext)
    ) {
      throw new TypeError(`${label} bytes are not exactly context-proportional`);
    }
    return firstValue;
  }
  const numerator = BigInt(secondValue - firstValue) * BigInt(firstContext);
  const denominator = BigInt(secondContext - firstContext);
  if (numerator % denominator !== BigInt(0)) {
    throw new TypeError(`${label} scaling is not an exact integer`);
  }
  const value = Number(numerator / denominator);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} scaling is outside the safe integer range`);
  }
  return value;
}

function scale(value: number, numerator: number, denominator: number): number {
  return Number(
    (BigInt(value) * BigInt(numerator) + BigInt(denominator) - BigInt(1))
      / BigInt(denominator),
  );
}

function derivationBlocked(
  reasonCode: string,
  issues: string[],
): Extract<ProfileDerivation, { kind: "blocked" }> {
  return {
    kind: "blocked",
    reasonCode,
    message:
      "The raw attempts cannot be reduced to one exact, unreviewed fit profile.",
    issues,
  };
}

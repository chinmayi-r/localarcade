import type { ExactConfigurationCandidate, MappingResult, Provenance } from "../contracts";
import { assessRegistryFreshness } from "./freshness";
import type { ArtifactFieldProvenance, ArtifactRegistryRecord, QuarantineRecord, RegistrySnapshot } from "./types";
import { validateArtifactRegistryRecord, validateRegistrySnapshot } from "./validation";

type CandidateArtifact = ExactConfigurationCandidate["artifact"];
type ModelFamily = ExactConfigurationCandidate["modelFamily"];

export type RegistryArtifactIdentityV1 = {
  modelFamily: ModelFamily;
  artifact: CandidateArtifact;
  provenance: Provenance[];
  registryMetadata: {
    publisher: string;
    baseModel: string;
    model: string;
    maxContextTokens: number;
    chatTemplate: string;
    licenseSourceUrl: string;
    fieldProvenance: ArtifactFieldProvenance;
  };
};

export type RegistryArtifactSnapshotV1 = {
  registrySchemaVersion: 4;
  snapshotId: string;
  generatedAt: string;
  lastIngestSucceededAt: string;
  artifacts: RegistryArtifactIdentityV1[];
  lifecycle: { promotedArtifactIds: string[]; triageArtifactIds: string[] };
  quarantine: QuarantineRecord[];
};

const artifactProvenanceFields = [
  "id", "publisher", "repository", "revision", "fileName", "sha256",
  "fileSizeBytes", "format", "quantization", "baseModel", "family", "model",
  "maxContextTokens", "license", "chatTemplate",
] as const satisfies ReadonlyArray<keyof ArtifactFieldProvenance>;

const LOWERCASE_SHA256 = /^[a-f0-9]{64}$/;

export function toRegistryArtifactIdentity(record: ArtifactRegistryRecord): MappingResult<RegistryArtifactIdentityV1> {
  if (record.status !== "promoted") {
    return {
      kind: "blocked",
      reasonCode: "registry.artifact-not-promoted",
      message: "Only explicitly promoted registry artifacts may cross the M-C candidate boundary.",
      missing: ["status:promoted"],
    };
  }

  const issues = validateArtifactRegistryRecord(record);
  if (!LOWERCASE_SHA256.test(record.sha256)) issues.push("Approved M-A artifact hashes must use lowercase SHA-256 serialization.");
  if (issues.length > 0) {
    return {
      kind: "blocked",
      reasonCode: "registry.artifact-contract-incompatible",
      message: "The registry artifact cannot satisfy the approved M-A identity without changing or inventing a value.",
      missing: issues,
    };
  }

  return {
    kind: "ok",
    value: {
      modelFamily: { modelFamilyId: record.family, displayName: record.model },
      artifact: {
        artifactId: record.id,
        repository: `${record.publisher}/${record.repository}`,
        revision: record.revision,
        filename: record.fileName,
        sha256: record.sha256,
        bytes: record.fileSizeBytes,
        format: record.format,
        quantization: record.quantization,
        license: record.license.id,
        status: "promoted",
      },
      provenance: artifactProvenanceFields.map((field) => toContractProvenance(record, field)),
      registryMetadata: {
        publisher: record.publisher,
        baseModel: record.baseModel,
        model: record.model,
        maxContextTokens: record.maxContextTokens,
        chatTemplate: record.chatTemplate,
        licenseSourceUrl: record.license.sourceUrl,
        fieldProvenance: record.provenance,
      },
    },
  };
}

export function toRegistryArtifactSnapshot(snapshot: RegistrySnapshot, now = Date.now()): MappingResult<RegistryArtifactSnapshotV1> {
  const issues = validateRegistrySnapshot(snapshot);
  if (issues.length > 0) {
    return {
      kind: "blocked",
      reasonCode: "registry.snapshot-invalid",
      message: "The registry snapshot failed its existing admission contract.",
      missing: issues,
    };
  }

  const freshness = assessRegistryFreshness(snapshot.lastIngestSucceededAt, now);
  if (!freshness.fresh) {
    return {
      kind: "blocked",
      reasonCode: "registry.snapshot-not-fresh",
      message: freshness.reason,
      missing: ["lastIngestSucceededAt"],
    };
  }

  const artifacts: RegistryArtifactIdentityV1[] = [];
  for (const record of snapshot.artifacts) {
    if (record.status !== "promoted") continue;
    const mapped = toRegistryArtifactIdentity(record);
    if (mapped.kind === "blocked") {
      return { ...mapped, missing: mapped.missing.map((item) => `${record.id}: ${item}`) };
    }
    artifacts.push(mapped.value);
  }

  return {
    kind: "ok",
    value: {
      registrySchemaVersion: snapshot.schemaVersion,
      snapshotId: snapshot.snapshotId,
      generatedAt: snapshot.generatedAt,
      lastIngestSucceededAt: snapshot.lastIngestSucceededAt,
      artifacts,
      lifecycle: {
        promotedArtifactIds: snapshot.artifacts.filter((artifact) => artifact.status === "promoted").map((artifact) => artifact.id),
        triageArtifactIds: snapshot.artifacts.filter((artifact) => artifact.status === "triage").map((artifact) => artifact.id),
      },
      quarantine: snapshot.quarantine,
    },
  };
}

function toContractProvenance(record: ArtifactRegistryRecord, field: keyof ArtifactFieldProvenance): Provenance {
  const source = record.provenance[field];
  return {
    source: { id: `registry.${source.kind}`, version: "4", revision: record.revision, url: source.sourceUrl },
    retrievedAt: source.retrievedAt,
    observedAt: null,
    method: "imported",
    hardwareMatch: "not-applicable",
    configurationMatch: "not-applicable",
    scope: { taskFamily: null, taskPackId: null, promptId: null, harnessId: null },
    sampleCount: null,
    measurement: null,
    rawSourceRecordRef: `${record.id}#${field}`,
  };
}

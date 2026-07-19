import type { CompatibilityAssertion } from "../runtime";

export type ProvenanceKind = "hub-api" | "hub-lfs" | "model-card" | "gguf-metadata" | "filename-derivation" | "identity-derivation" | "base-model-derivation" | "schema-constant";

export type FieldProvenance = {
  sourceUrl: string;
  retrievedAt: string;
  kind: ProvenanceKind;
};

export type ArtifactFieldProvenance = {
  id: FieldProvenance;
  publisher: FieldProvenance;
  repository: FieldProvenance;
  revision: FieldProvenance;
  fileName: FieldProvenance;
  sha256: FieldProvenance;
  fileSizeBytes: FieldProvenance;
  format: FieldProvenance;
  quantization: FieldProvenance;
  baseModel: FieldProvenance;
  family: FieldProvenance;
  model: FieldProvenance;
  maxContextTokens: FieldProvenance;
  license: FieldProvenance;
  chatTemplate: FieldProvenance;
};

export type ArtifactRegistryRecord = {
  id: string;
  publisher: string;
  repository: string;
  revision: string;
  fileName: string;
  sha256: string;
  fileSizeBytes: number;
  format: "GGUF";
  quantization: string;
  baseModel: string;
  family: string;
  model: string;
  maxContextTokens: number;
  chatTemplate: string;
  status: "triage" | "promoted";
  license: {
    id: string;
    sourceUrl: string;
  };
  provenance: ArtifactFieldProvenance;
};

export const quarantineCodes = [
  "no-gguf-files",
  "split-package-unsupported",
  "unsupported-file-role",
  "unrecognized-quantization",
  "missing-sha256",
  "missing-file-size",
  "missing-base-model",
  "missing-license",
  "missing-license-source",
  "missing-context",
  "missing-chat-template",
] as const;

export type QuarantineCode = (typeof quarantineCodes)[number];

export type QuarantineRecord = {
  repository: string;
  revision: string;
  fileName?: string;
  code: QuarantineCode;
  reason: string;
  sourceUrl: string;
  recordedAt: string;
};

export type AcceleratorVariant = {
  id: string;
  label: string;
  memoryBytes: number;
  formFactor: "desktop" | "laptop" | "integrated" | "soc" | "workstation" | "datacenter";
  sourceUrl: string;
};

export type AcceleratorRegistryRecord = {
  id: string;
  vendor: "nvidia" | "amd" | "apple" | "intel";
  canonicalName: string;
  aliases: string[];
  variants: AcceleratorVariant[];
  supportedBackends: string[];
  source: FieldProvenance;
};

export type RegistrySnapshot = {
  schemaVersion: 4;
  snapshotId: string;
  generatedAt: string;
  lastIngestSucceededAt: string;
  artifacts: ArtifactRegistryRecord[];
  quarantine: QuarantineRecord[];
  accelerators: AcceleratorRegistryRecord[];
  compatibilityAssertions: CompatibilityAssertion[];
};

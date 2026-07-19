import type { CompatibilityAssertion } from "../runtime";

export type RegistrySource = {
  url: string;
  retrievedAt: string;
};

export type ArtifactRegistryRecord = {
  id: string;
  publisher: string;
  repository: string;
  revision: string;
  fileName: string;
  sha256: string;
  family: string;
  model: string;
  format: "GGUF" | "MLX" | "safetensors";
  quantization: string;
  fileSizeBytes: number;
  maxContextTokens: number;
  license: {
    id: string;
    sourceUrl: string;
  };
  source: RegistrySource;
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
  source: RegistrySource;
};

export type RegistrySnapshot = {
  schemaVersion: 2;
  snapshotId: string;
  generatedAt: string;
  artifacts: ArtifactRegistryRecord[];
  accelerators: AcceleratorRegistryRecord[];
  compatibilityAssertions: CompatibilityAssertion[];
};

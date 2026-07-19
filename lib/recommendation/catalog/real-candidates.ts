import registryJson from "../../../registry/generated/artifacts.json";
import type { RegistrySnapshot } from "../../registry";
import type { RecommendationCandidate } from "../types";

const registry = registryJson as RegistrySnapshot;
const LLAMA_32_1B_Q4_ID = "bartowski/Llama-3.2-1B-Instruct-GGUF/Llama-3.2-1B-Instruct-Q4_K_M.gguf@067b946cf014b7c697f3654f621d577a3e3afd1c";
const artifact = registry.artifacts.find((item) => item.id === LLAMA_32_1B_Q4_ID);
if (!artifact) throw new Error(`Registry artifact missing: ${LLAMA_32_1B_Q4_ID}`);

const mib = 1024 * 1024;

/**
 * Production candidates are deliberately sparse. This profile composes the exact
 * registry weight bytes with the cited llama.cpp Llama 3.2 1B allocation log.
 * It is CPU/build scoped and is not silently generalized to apps or GPU backends.
 */
export const realCandidates: RecommendationCandidate[] = [{
  id: `${artifact.id}/llama.cpp-b72c20b8-cpu-f16`,
  artifact,
  fitArtifact: {
    id: artifact.id,
    weightBytes: artifact.fileSizeBytes,
    maxContextTokens: artifact.maxContextTokens,
    runtimeComputeBufferBytes: 8_464.5 * mib,
    kvCache: {
      key: [{ quantization: "f16", referenceContextTokens: 131_072, bytesAtReferenceContext: 2_048 * mib }],
      value: [{ quantization: "f16", referenceContextTokens: 131_072, bytesAtReferenceContext: 2_048 * mib }],
    },
  },
  fitProfileSourceUrl: "https://github.com/ggml-org/llama.cpp/discussions/10223",
  hardwareKinds: ["cpu"],
  sizeBand: "tiny-1b",
  runtime: { product: "llama-cpp", engine: "llama.cpp", build: "b72c20b8", backend: "cpu", kvCache: "f16", gpuLayers: 0, batchSize: 2_048 },
}];

export const recommendationCatalogMetadata = {
  snapshotId: registry.snapshotId,
  generatedAt: registry.generatedAt,
  admittedArtifactCount: registry.artifacts.length,
  sourceUrl: artifact.provenance.repository.sourceUrl,
} as const;

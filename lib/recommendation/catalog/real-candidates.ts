import registryJson from "../../../registry/generated/artifacts.json";
import fitProfilesJson from "../../../registry/evidence/fit-profiles.json";
import type { RegistrySnapshot } from "../../registry";
import { isRecommendableArtifact } from "../../registry/freshness";
import type { RecommendationCandidate } from "../types";

const registry = registryJson as RegistrySnapshot;
const LLAMA_32_1B_Q4_ID = "bartowski/Llama-3.2-1B-Instruct-GGUF/Llama-3.2-1B-Instruct-Q4_K_M.gguf@067b946cf014b7c697f3654f621d577a3e3afd1c";
const artifact = registry.artifacts.find((item) => item.id === LLAMA_32_1B_Q4_ID && isRecommendableArtifact(item));
if (!artifact) throw new Error(`Registry artifact missing: ${LLAMA_32_1B_Q4_ID}`);
const QWEN3_4B_Q4_ID = "unsloth/Qwen3-4B-Instruct-2507-GGUF/Qwen3-4B-Instruct-2507-Q4_K_M.gguf@a06e946bb6b655725eafa393f4a9745d460374c9";
const qwenArtifact = registry.artifacts.find((item) => item.id === QWEN3_4B_Q4_ID && isRecommendableArtifact(item));
if (!qwenArtifact) throw new Error(`Registry artifact missing: ${QWEN3_4B_Q4_ID}`);
const qwenFit = fitProfilesJson.profiles.find((profile) => profile.artifactSha256 === qwenArtifact.sha256);
if (!qwenFit) throw new Error(`Fit profile missing: ${qwenArtifact.sha256}`);

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
  platforms: ["cpu"],
  sizeBand: "tiny-1b",
  runtime: { product: "llama-cpp", engine: "llama.cpp", build: "b72c20b8", backend: "cpu", kvCache: "f16", gpuLayers: 0, batchSize: 2_048 },
}, {
  id: `${qwenArtifact.id}/llama.cpp-b10061-cuda-f16-all`,
  artifact: qwenArtifact,
  fitArtifact: {
    id: qwenArtifact.id,
    weightBytes: qwenFit.normalized.device.modelMiB * mib,
    maxContextTokens: qwenArtifact.maxContextTokens,
    runtimeComputeBufferBytes: qwenFit.normalized.device.computeFixedMiB * mib,
    kvCache: {
      key: [{ quantization: "f16", referenceContextTokens: qwenFit.normalized.referenceContextTokens, bytesAtReferenceContext: qwenFit.normalized.device.contextMiB / 2 * mib }],
      value: [{ quantization: "f16", referenceContextTokens: qwenFit.normalized.referenceContextTokens, bytesAtReferenceContext: qwenFit.normalized.device.contextMiB / 2 * mib }],
    },
  },
  memoryPools: {
    id: `${qwenArtifact.id}/llama.cpp-b10061-cuda-f16-all`,
    maxContextTokens: qwenArtifact.maxContextTokens,
    device: { modelBytes: qwenFit.normalized.device.modelMiB * mib, computeFixedBytes: qwenFit.normalized.device.computeFixedMiB * mib, contextBytesAtReference: qwenFit.normalized.device.contextMiB * mib, computeContextBytesAtReference: qwenFit.normalized.device.computeContextMiB * mib, referenceContextTokens: qwenFit.normalized.referenceContextTokens },
    host: { modelBytes: qwenFit.normalized.host.modelMiB * mib, computeFixedBytes: qwenFit.normalized.host.computeFixedMiB * mib, contextBytesAtReference: qwenFit.normalized.host.contextMiB * mib, computeContextBytesAtReference: qwenFit.normalized.host.computeContextMiB * mib, referenceContextTokens: qwenFit.normalized.referenceContextTokens },
  },
  fitProfileSourceUrl: qwenFit.methodSourceUrl,
  hardwareKinds: ["gpu"],
  platforms: ["nvidia"],
  acceleratorIds: ["nvidia-geforce-rtx-3060-laptop-gpu"],
  sizeBand: "small-8b",
  runtime: { product: "llama-cpp", engine: "llama.cpp", build: "b10061 (5d5306bf3)", backend: "cuda", kvCache: "f16", gpuLayers: "all", batchSize: 2_048 },
}];

export const recommendationCatalogMetadata = {
  snapshotId: registry.snapshotId,
  generatedAt: registry.generatedAt,
  lastIngestSucceededAt: registry.lastIngestSucceededAt,
  admittedArtifactCount: registry.artifacts.length,
  sourceUrl: artifact.provenance.repository.sourceUrl,
} as const;

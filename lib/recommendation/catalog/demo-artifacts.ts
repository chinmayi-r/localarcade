import type { Artifact } from "../types";
import type { RegistrySnapshot } from "../../registry";
import huggingFaceSnapshotJson from "../../../registry/generated/hugging-face.json";

const huggingFaceSnapshot = huggingFaceSnapshotJson as RegistrySnapshot;
const qwen3Point6BQ8 = huggingFaceSnapshot.artifacts.find((record) => record.fileName === "Qwen3-0.6B-Q8_0.gguf");
const qwen3Point17BQ8 = huggingFaceSnapshot.artifacts.find((record) => record.fileName === "Qwen3-1.7B-Q8_0.gguf");
if (!qwen3Point6BQ8) throw new TypeError("The pinned Qwen3 0.6B Q8 artifact is missing from the generated registry.");
if (!qwen3Point17BQ8) throw new TypeError("The pinned Qwen3 1.7B Q8 artifact is missing from the generated registry.");

/**
 * UI-development data only.
 *
 * These values are intentionally isolated so they cannot be mistaken for a
 * sourced production registry. Replace this module with a versioned registry
 * before publishing recommendations as evidence-backed results.
 */
export const demoArtifacts: Artifact[] = [
  artifact("qwen3-06b-q8", "Qwen3", "Qwen3 0.6B", "Q8_0", qwen3Point6BQ8.fileSizeBytes / 1_000_000_000, 0.08, qwen3Point6BQ8.maxContextTokens / 1024, 98, 0.76, [42, 48, 44, 62], qwen3Point6BQ8),
  artifact("llama32-1b-q8", "Llama 3.2", "Llama 3.2 1B", "Q8_0", 1.3, 0.1, 16, 88, 0.82, [45, 54, 52, 61]),
  artifact("qwen3-17b-q8", "Qwen3", "Qwen3 1.7B", "Q8_0", qwen3Point17BQ8.fileSizeBytes / 1_000_000_000, 0.14, qwen3Point17BQ8.maxContextTokens / 1024, 76, 0.79, [58, 59, 55, 70], qwen3Point17BQ8),
  artifact("phi4-mini-q4", "Phi-4 Mini", "Phi-4 Mini 3.8B", "Q4_K_M", 2.6, 0.24, 16, 64, 0.84, [68, 63, 57, 74]),
  artifact("gemma3-4b-q4", "Gemma 3", "Gemma 3 4B", "Q4_K_M", 2.9, 0.27, 32, 59, 0.85, [63, 70, 68, 72]),
  artifact("llama31-8b-q4", "Llama 3.1", "Llama 3.1 8B", "Q4_K_M", 5.4, 0.46, 32, 45, 0.88, [69, 75, 77, 75]),
  artifact("qwen35-9b-q4", "Qwen 3.5", "Qwen 3.5 9B", "Q4_K_M", 6.2, 0.53, 64, 41, 0.82, [78, 78, 74, 83]),
  artifact("gemma3-12b-q4", "Gemma 3", "Gemma 3 12B", "Q4_K_M", 8.1, 0.72, 64, 34, 0.86, [75, 82, 83, 79]),
  artifact("gpt-oss-20b-mxfp4", "GPT-OSS", "GPT-OSS 20B", "MXFP4", 12.3, 0.92, 64, 28, 0.78, [86, 84, 79, 87]),
  artifact("mistral-small-24b-q4", "Mistral Small", "Mistral Small 24B", "Q4_K_M", 15.6, 1.14, 64, 23, 0.87, [84, 86, 88, 84]),
  artifact("qwen35-27b-q4", "Qwen 3.5", "Qwen 3.5 27B", "Q4_K_M", 17.8, 1.28, 64, 20, 0.81, [90, 88, 85, 91]),
  artifact("qwen3-32b-q4", "Qwen3", "Qwen3 32B", "Q4_K_M", 21.2, 1.46, 64, 17, 0.84, [89, 89, 87, 90]),
];

function artifact(
  id: string,
  family: string,
  model: string,
  quantization: string,
  weightSizeGb: number,
  kvCacheGbPer8K: number,
  maxContextK: number,
  baselineTokensPerSecond: number,
  stabilityScore: number,
  [coding, general, writing, extraction]: [number, number, number, number],
  identity?: Artifact["identity"],
): Artifact {
  return {
    id,
    family,
    model,
    quantization,
    format: "GGUF",
    runtime: "llama.cpp",
    weightSizeGb,
    kvCacheGbPer8K,
    maxContextK,
    baselineTokensPerSecond,
    stabilityScore,
    taskScores: { coding, general, writing, extraction },
    evidenceLevel: "prototype",
    identity,
  };
}

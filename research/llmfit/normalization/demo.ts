import { normalizeRawLlmfitFixture } from "./adapter";
import {
  cpuInput,
  cudaInput,
  exactCudaFixture,
  lossyCpuFixture,
  unsupportedAscendFixture,
} from "./fixtures";

const changedVersion = structuredClone(exactCudaFixture);
changedVersion.source.version = "future-version";

const demonstrations = [
  {
    scenario: "supported CUDA facts and pinned raw fixture",
    result: normalizeRawLlmfitFixture(cudaInput, exactCudaFixture),
  },
  {
    scenario: "CPU architecture and MoE details collapse visibly",
    result: normalizeRawLlmfitFixture(cpuInput, lossyCpuFixture),
  },
  {
    scenario: "backend has no approved representation",
    result: normalizeRawLlmfitFixture(cudaInput, unsupportedAscendFixture),
  },
  {
    scenario: "raw fixture is not from the pinned upstream version",
    result: normalizeRawLlmfitFixture(cudaInput, changedVersion),
  },
];

console.log(JSON.stringify(demonstrations, null, 2));

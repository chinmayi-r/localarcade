import type {
  IndependentAdvisoryInput,
  RawLlmfitFixture,
} from "./types";
import {
  PINNED_LLMFIT_REVISION,
  PINNED_LLMFIT_VERSION,
} from "./adapter";

export const cudaInput: IndependentAdvisoryInput = {
  requestId: "research-request-cuda",
  hardware: {
    totalRamBytes: 32 * 1024 ** 3,
    availableRamBytes: 24 * 1024 ** 3,
    cpu: { displayName: "Fixture CPU", logicalCores: 16 },
    accelerators: [
      {
        displayName: "Fixture CUDA GPU",
        backend: "cuda",
        deviceMemoryBytes: 12 * 1024 ** 3,
        count: 1,
      },
    ],
    unifiedMemory: false,
  },
  task: {
    family: "coding",
    interactionStyle: "interactive",
    contextTokens: 8192,
  },
  constraints: { forcedRuntime: "llama.cpp" },
};

export const cpuInput: IndependentAdvisoryInput = {
  ...cudaInput,
  requestId: "research-request-cpu",
  hardware: {
    ...cudaInput.hardware,
    accelerators: [],
  },
  constraints: { forcedRuntime: null },
};

const source = {
  id: "llmfit" as const,
  version: PINNED_LLMFIT_VERSION,
  revision: PINNED_LLMFIT_REVISION,
};

export const exactCudaFixture: RawLlmfitFixture = {
  fixtureSchema: "local-arcade.llmfit-raw-fixture.v1",
  fixtureId: "fixture-cuda-exact",
  fixtureKind: "synthetic-contract",
  source,
  capturedAt: "2026-07-22T12:00:00.000Z",
  requestEcho: {
    totalRamGb: 32,
    availableRamGb: 24,
    cpuName: "Fixture CPU",
    cpuCores: 16,
    backend: "CUDA",
    gpuName: "Fixture CUDA GPU",
    gpuVramGb: 12,
    gpuCount: 1,
    unifiedMemory: false,
    contextLimit: 8192,
    forcedRuntime: "llama.cpp",
    taskFamily: "coding",
    interactionStyle: "interactive",
  },
  result: {
    kind: "ok",
    models: [
      {
        model: {
          name: "Example 7B Instruct",
          provider: "ExampleOrg",
          parameters: 7_000_000_000,
          capabilities: ["text", "tool-use"],
        },
        fitLevel: "Good",
        runMode: "Gpu",
        memoryRequiredGb: 7.5,
        memoryAvailableGb: 12,
        utilizationPct: 62.5,
        notes: ["fixture-derived advisory"],
        estimatedTps: 32,
        measuredTps: null,
        effectiveContextLength: 8192,
        usableContext: 8192,
        bestQuant: "Q4_K_M",
        runtime: "llama.cpp",
        estimateBasis: { method: "memory-bandwidth", efficiency: 0.55 },
        score: 81,
        scoreComponents: {
          quality: 75,
          speed: 84,
          fit: 90,
          context: 75,
        },
      },
    ],
  },
};

export const lossyCpuFixture: RawLlmfitFixture = {
  ...exactCudaFixture,
  fixtureId: "fixture-cpu-lossy",
  requestEcho: {
    ...exactCudaFixture.requestEcho,
    backend: "CPU x86",
    gpuName: null,
    gpuVramGb: null,
    gpuCount: 0,
    forcedRuntime: null,
  },
  result: {
    kind: "ok",
    models: [
      {
        ...exactCudaFixture.result.kind === "ok"
          ? exactCudaFixture.result.models[0]
          : neverValue(),
        runMode: "MoeOffload",
        runtime: null,
      },
    ],
  },
};

function neverValue(): never {
  throw new Error("Unreachable fixture construction.");
}

export const unsupportedAscendFixture: RawLlmfitFixture = {
  ...exactCudaFixture,
  fixtureId: "fixture-ascend-unsupported",
  requestEcho: {
    ...exactCudaFixture.requestEcho,
    backend: "Ascend",
  },
};

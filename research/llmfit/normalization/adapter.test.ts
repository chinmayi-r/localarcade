import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeRawLlmfitFixture,
  PINNED_LLMFIT_REVISION,
} from "./adapter";
import {
  cpuInput,
  cudaInput,
  exactCudaFixture,
  lossyCpuFixture,
  unsupportedAscendFixture,
} from "./fixtures";

test("normalizes pinned CUDA advisory exactly without exposing composite ranking", () => {
  const result = normalizeRawLlmfitFixture(cudaInput, exactCudaFixture);
  assert.equal(result.classification, "exact");
  if (result.classification !== "exact") return;

  assert.equal(result.candidates.length, 1);
  assert.equal(
    result.classificationScope,
    "adopted-advisory-projection",
  );
  const candidate = result.candidates[0];
  assert.equal(candidate.modelFamilyCandidate.upstreamName, "Example 7B Instruct");
  assert.equal(candidate.advisory.fit, "good");
  assert.equal(candidate.advisory.runPath, "gpu");
  assert.equal(candidate.advisory.memoryRequiredBytes, 7.5 * 1024 ** 3);
  assert.equal(
    candidate.advisory.performance.estimatedGenerationTokensPerSecond,
    32,
  );
  assert.equal("score" in candidate.advisory, false);
  assert.deepEqual(candidate.mappingIssues, []);
  assert.deepEqual(
    candidate.ignoredUpstreamFields.map((field) => field.path),
    ["score", "scoreComponents"],
  );
  assert.equal(candidate.rawAttribution.fixtureKind, "synthetic-contract");

  const raw = candidate.rawAttribution.rawRecord as { score: number };
  assert.equal(raw.score, 81);
});

test("classifies representational collapse as lossy and preserves the raw distinctions", () => {
  const result = normalizeRawLlmfitFixture(cpuInput, lossyCpuFixture);
  assert.equal(result.classification, "lossy");
  if (result.classification !== "lossy") return;

  assert.deepEqual(
    result.candidates[0].mappingIssues.map((issue) => issue.reasonCode),
    [
      "llmfit.backend.cpu-architecture-collapsed",
      "llmfit.run-mode.moe-detail-not-representable",
    ],
  );
  assert.equal(result.candidates[0].advisory.runPath, "cpu-offload");
  const raw = result.candidates[0].rawAttribution.rawRecord as {
    runMode: string;
  };
  assert.equal(raw.runMode, "MoeOffload");
});

test("returns unsupported for an upstream backend outside the approved vocabulary", () => {
  const result = normalizeRawLlmfitFixture(cudaInput, unsupportedAscendFixture);
  assert.equal(result.classification, "unsupported");
  if (result.classification !== "unsupported") return;
  assert.equal(result.reasonCode, "llmfit.backend.unsupported");
  assert.ok(result.rawAttribution);
});

test("fails closed when the upstream version is not pinned", () => {
  const changed = structuredClone(exactCudaFixture);
  changed.source.revision = `${PINNED_LLMFIT_REVISION}-changed`;
  const result = normalizeRawLlmfitFixture(cudaInput, changed);
  assert.equal(result.classification, "unavailable");
  if (result.classification !== "unavailable") return;
  assert.equal(result.reasonCode, "llmfit.source.version-mismatch");
  assert.ok(result.rawAttribution);
});

test("rejects the stale audit commit even when it is labeled v1.1.6", () => {
  const stale = structuredClone(exactCudaFixture);
  stale.source.revision = "7ba90ce0f14756040db658933bfd5c6ad46ed4ea";
  const result = normalizeRawLlmfitFixture(cudaInput, stale);
  assert.equal(result.classification, "unavailable");
  if (result.classification !== "unavailable") return;
  assert.equal(result.reasonCode, "llmfit.source.version-mismatch");
  assert.match(result.message, /aaa2bc179cec214ccdc44501c853b98fba0b343b/);
});

test("fails closed for malformed raw records and mismatched independent constraints", () => {
  const malformed = structuredClone(exactCudaFixture) as unknown as {
    result: { models: Array<Record<string, unknown>> };
  };
  delete malformed.result.models[0].fitLevel;
  const malformedResult = normalizeRawLlmfitFixture(cudaInput, malformed);
  assert.equal(malformedResult.classification, "unavailable");
  if (malformedResult.classification !== "unavailable") {
    return;
  }
  assert.equal(
    malformedResult.reasonCode,
    "llmfit.fixture.model-schema-mismatch",
  );

  const mismatch = structuredClone(exactCudaFixture);
  mismatch.requestEcho.contextLimit = 4096;
  const mismatchResult = normalizeRawLlmfitFixture(cudaInput, mismatch);
  assert.equal(mismatchResult.classification, "unsupported");
  if (mismatchResult.classification !== "unsupported") return;
  assert.equal(mismatchResult.reasonCode, "llmfit.request.constraints-mismatch");
});

test("does not cover a mismatch between independent hardware and the replay echo", () => {
  const changed = structuredClone(exactCudaFixture);
  changed.requestEcho.gpuVramGb = 24;
  const result = normalizeRawLlmfitFixture(cudaInput, changed);
  assert.equal(result.classification, "unsupported");
  if (result.classification !== "unsupported") return;
  assert.equal(result.reasonCode, "llmfit.request.hardware-mismatch");
});

test("binds every independent hardware fact represented by the replay echo", () => {
  const mutations: Array<(fixture: typeof exactCudaFixture) => void> = [
    (fixture) => {
      fixture.requestEcho.availableRamGb = 23;
    },
    (fixture) => {
      fixture.requestEcho.cpuName = "Different CPU";
    },
    (fixture) => {
      fixture.requestEcho.cpuCores = 8;
    },
    (fixture) => {
      fixture.requestEcho.backend = "ROCm";
    },
    (fixture) => {
      fixture.requestEcho.gpuName = "Different GPU";
    },
    (fixture) => {
      fixture.requestEcho.gpuVramGb = 24;
    },
    (fixture) => {
      fixture.requestEcho.gpuCount = 2;
    },
    (fixture) => {
      fixture.requestEcho.unifiedMemory = true;
    },
  ];

  for (const mutate of mutations) {
    const fixture = structuredClone(exactCudaFixture);
    mutate(fixture);
    const result = normalizeRawLlmfitFixture(cudaInput, fixture);
    assert.equal(result.classification, "unsupported");
    if (result.classification === "unsupported") {
      assert.equal(result.reasonCode, "llmfit.request.hardware-mismatch");
    }
  }
});

test("binds task family, interaction style, context, and runtime independently", () => {
  const mutations: Array<(fixture: typeof exactCudaFixture) => void> = [
    (fixture) => {
      fixture.requestEcho.taskFamily = "writing";
    },
    (fixture) => {
      fixture.requestEcho.interactionStyle = "batch";
    },
    (fixture) => {
      fixture.requestEcho.contextLimit = 4096;
    },
    (fixture) => {
      fixture.requestEcho.forcedRuntime = "ollama";
    },
  ];

  for (const mutate of mutations) {
    const fixture = structuredClone(exactCudaFixture);
    mutate(fixture);
    const result = normalizeRawLlmfitFixture(cudaInput, fixture);
    assert.equal(result.classification, "unsupported");
    if (result.classification === "unsupported") {
      assert.equal(result.reasonCode, "llmfit.request.constraints-mismatch");
    }
  }
});

test("unknown unified-memory state cannot be classified exact", () => {
  const input = structuredClone(cudaInput);
  input.hardware.unifiedMemory = null;
  const result = normalizeRawLlmfitFixture(input, exactCudaFixture);
  assert.equal(result.classification, "unsupported");
  if (result.classification !== "unsupported") return;
  assert.equal(result.reasonCode, "llmfit.request.unified-memory-unknown");
});

test("rejects invalid utilization, score dimensions, timestamps, and unsafe byte conversions", () => {
  const invalidFixtures: unknown[] = [];

  const utilization = structuredClone(exactCudaFixture);
  if (utilization.result.kind === "ok") {
    utilization.result.models[0].utilizationPct = 100.01;
  }
  invalidFixtures.push(utilization);

  const score = structuredClone(exactCudaFixture);
  if (score.result.kind === "ok") {
    score.result.models[0].scoreComponents.quality = Number.POSITIVE_INFINITY;
  }
  invalidFixtures.push(score);

  const timestamp = structuredClone(exactCudaFixture);
  timestamp.capturedAt = "not-a-timestamp";
  invalidFixtures.push(timestamp);

  const unsafeMemory = structuredClone(exactCudaFixture);
  if (unsafeMemory.result.kind === "ok") {
    unsafeMemory.result.models[0].memoryRequiredGb =
      Number.MAX_SAFE_INTEGER / 1024 ** 3 + 1;
  }
  invalidFixtures.push(unsafeMemory);

  for (const fixture of invalidFixtures) {
    const result = normalizeRawLlmfitFixture(cudaInput, fixture);
    assert.equal(result.classification, "unavailable");
  }
});

test("rejects invalid independent capacities and counts before fixture adaptation", () => {
  const invalidInputs = [
    (() => {
      const input = structuredClone(cudaInput);
      input.hardware.availableRamBytes = input.hardware.totalRamBytes + 1;
      return input;
    })(),
    (() => {
      const input = structuredClone(cudaInput);
      input.hardware.cpu.logicalCores = 0;
      return input;
    })(),
    (() => {
      const input = structuredClone(cudaInput);
      input.hardware.accelerators[0].deviceMemoryBytes =
        Number.POSITIVE_INFINITY;
      return input;
    })(),
  ];

  for (const input of invalidInputs) {
    const result = normalizeRawLlmfitFixture(input, exactCudaFixture);
    assert.equal(result.classification, "unavailable");
    if (result.classification === "unavailable") {
      assert.equal(result.reasonCode, "llmfit.input.invalid");
    }
  }
});

test("represents a valid empty upstream result explicitly", () => {
  const empty = structuredClone(exactCudaFixture);
  empty.result = { kind: "ok", models: [] };
  const result = normalizeRawLlmfitFixture(cudaInput, empty);
  assert.equal(result.classification, "exact");
  if (result.classification !== "exact") return;
  assert.deepEqual(result.candidates, []);
  assert.ok(
    result.warnings.includes(
      "The pinned upstream fixture returned no advisory candidates.",
    ),
  );
});

test("snapshots raw attribution instead of retaining a mutable fixture reference", () => {
  const fixture = structuredClone(exactCudaFixture);
  const result = normalizeRawLlmfitFixture(cudaInput, fixture);
  assert.equal(result.classification, "exact");
  if (result.classification !== "exact") return;
  fixture.result = {
    kind: "error",
    errorKind: "timeout",
    message: "mutated after adaptation",
  };
  const raw = result.rawAttribution.rawRecord as {
    result: { kind: string };
  };
  assert.equal(raw.result.kind, "ok");
});

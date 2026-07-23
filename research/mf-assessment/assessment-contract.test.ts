import assert from "node:assert/strict";
import test from "node:test";
import { assessFitEvidence as assessFitEvidenceUnchecked } from "../../lib/assessment";
import { validateContract } from "../../lib/contracts";
import {
  completeInput,
  exactSpeedRecords,
  hardwareTarget,
  hostOnlyInput,
  lossyThroughputPrior,
  scopedTaskEvidence,
} from "./fixtures";

function assessFitEvidence(
  input: Parameters<typeof assessFitEvidenceUnchecked>[0],
): ReturnType<typeof assessFitEvidenceUnchecked> {
  const result = assessFitEvidenceUnchecked(input);
  const validation = validateContract(result);
  assert.equal(
    validation.ok,
    true,
    validation.ok ? undefined : validation.errors.join("\n"),
  );
  return result;
}

test("M-F maps exact producer outputs to a complete two-pool assessment", () => {
  const result = assessFitEvidence(completeInput());
  assert.equal(result.contract, "fit-evidence-assessment");
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;

  assert.equal(result.data.assessmentId, "assessment-m-f-proof");
  assert.equal(result.data.candidateId, "candidate-fixture");
  assert.equal(result.data.hardwareTargetId, "hw-fixture");
  assert.equal(result.data.fit, "good");
  assert.equal(result.data.runPath, "gpu");
  assert.deepEqual(result.data.memoryPools, {
    device: {
      modelBytes: 4_194_304_000,
      contextBytes: 536_870_912,
      computeBytes: 314_572_800,
      reserveBytes: 268_435_456,
      marginBytes: 252_287_386,
      requiredBytes: 5_566_470_554,
      availableBytes: 8_589_934_592,
    },
    host: {
      modelBytes: 1_048_576_000,
      contextBytes: 0,
      computeBytes: 20_971_520,
      reserveBytes: 2_147_483_648,
      marginBytes: 53_477_376,
      requiredBytes: 3_270_508_544,
      availableBytes: 34_359_738_368,
    },
  });
  assert.deepEqual(result.data.performance, {
    promptTokensPerSecond: { low: 150, high: 180 },
    generationTokensPerSecond: { low: 40, high: 55 },
    timeToFirstTokenMs: { low: 120, high: 220 },
  });
  assert.equal(result.data.evidence.fit[0].rawSourceRecordRef, "fixture://allocation-profile");
  assert.deepEqual(result.data.evidence.taskQuality, []);
  assert.deepEqual(result.data.blockingReasons, []);
});

test("M-B is optional: absence, attributed unavailability or a blocked binding does not reconstruct advice", () => {
  const absent = assessFitEvidence(completeInput());
  assert.ok(absent.status === "ok" || absent.status === "partial");
  if (absent.status !== "ok" && absent.status !== "partial") return;
  const cases = [
    {
      kind: "unavailable" as const,
      reasonCode: "llmfit.provider.not-linked",
      message: "The isolated upstream provider is not linked into this process.",
    },
    {
      kind: "blocked" as const,
      reasonCode: "llmfit.binding.registry-crosswalk-unverified",
      message: "M-C has not verified the upstream family crosswalk.",
    },
  ];
  for (const upstreamAdvisory of cases) {
    const input = completeInput();
    input.upstreamAdvisory = upstreamAdvisory;
    const result = assessFitEvidence(input);
    assert.ok(result.status === "ok" || result.status === "partial");
    if (result.status !== "ok" && result.status !== "partial") continue;
    assert.deepEqual(result.data, absent.data);
    assert.ok(result.completeness.warnings.some((warning) =>
      warning.includes(upstreamAdvisory.reasonCode)));
    assert.equal(JSON.stringify(result).includes("suggestedRuntime"), false);
    assert.equal(JSON.stringify(result).includes("suggestedQuantization"), false);
  }
});

test("M-F leaves absent performance absent rather than manufacturing a range", () => {
  const input = completeInput();
  input.evidence.records = [];
  const result = assessFitEvidence(input);
  assert.equal(result.status, "partial");
  if (result.status !== "partial") return;
  assert.deepEqual(result.data.performance, {
    promptTokensPerSecond: null,
    generationTokensPerSecond: null,
    timeToFirstTokenMs: null,
  });
  assert.deepEqual(result.data.evidence.promptSpeed, []);
  assert.deepEqual(result.data.evidence.generationSpeed, []);
  assert.deepEqual(result.data.evidence.timeToFirstToken, []);
  for (const missing of [
    "performance.promptTokensPerSecond",
    "performance.generationTokensPerSecond",
    "performance.timeToFirstTokenMs",
  ]) {
    assert.ok(result.completeness.missing.includes(missing), missing);
  }
  assert.ok(result.completeness.missing.every((item) => item.startsWith("performance")));
});

test("host capacity uses confirmed total RAM and does not mistake a transient availability sample for physical capacity", () => {
  const lowAvailability = completeInput();
  lowAvailability.hardwareTarget.memory.availableRamBytes = 2 * 1024 ** 3;
  const unknownAvailability = completeInput();
  unknownAvailability.hardwareTarget.memory.availableRamBytes = null;
  const low = assessFitEvidence(lowAvailability);
  const unknown = assessFitEvidence(unknownAvailability);
  assert.ok(low.status === "ok" || low.status === "partial");
  assert.ok(unknown.status === "ok" || unknown.status === "partial");
  if ((low.status !== "ok" && low.status !== "partial")
    || (unknown.status !== "ok" && unknown.status !== "partial")) return;
  assert.equal(low.data.memoryPools.host.availableBytes, 32 * 1024 ** 3);
  assert.equal(unknown.data.memoryPools.host.availableBytes, 32 * 1024 ** 3);
  assert.deepEqual(low.data.memoryPools.host, unknown.data.memoryPools.host);
});

test("M-F exposes the preserved host-only fit core with an honest zero device pool", () => {
  const result = assessFitEvidence(hostOnlyInput());
  assert.equal(result.status, "partial");
  if (result.status !== "partial") return;
  assert.equal(result.data.fit, "good");
  assert.equal(result.data.runPath, "cpu");
  assert.deepEqual(result.data.memoryPools.device, {
    modelBytes: 0,
    contextBytes: 0,
    computeBytes: 0,
    reserveBytes: 0,
    marginBytes: 0,
    requiredBytes: 0,
    availableBytes: 0,
  });
  assert.deepEqual(result.data.memoryPools.host, {
    modelBytes: 2_491_323_904,
    contextBytes: 268_435_456,
    computeBytes: 268_435_456,
    reserveBytes: 2_147_483_648,
    marginBytes: 151_409_741,
    requiredBytes: 5_327_088_205,
    availableBytes: 34_359_738_368,
  });
  assert.equal(result.data.evidence.fit[0].rawSourceRecordRef, "fixture://allocation-profile");
  assert.deepEqual(result.data.performance, {
    promptTokensPerSecond: null,
    generationTokensPerSecond: null,
    timeToFirstTokenMs: null,
  });
});

test("host-only mode rejects accelerator, device-reserve and run-path contradictions", () => {
  const cases = [
    (input: ReturnType<typeof hostOnlyInput>) => {
      input.hardwareTarget.accelerators = [structuredClone(hardwareTarget.accelerators[0])];
    },
    (input: ReturnType<typeof hostOnlyInput>) => {
      input.fitPolicy.deviceReserveBytes = 1;
    },
    (input: ReturnType<typeof hostOnlyInput>) => {
      input.fitProfile.binding.acceleratorId = "nvidia-fixture";
    },
    (input: ReturnType<typeof hostOnlyInput>) => {
      input.fitProfile.runPath = "gpu" as typeof input.fitProfile.runPath;
    },
  ];
  for (const mutate of cases) {
    const input = hostOnlyInput();
    mutate(input);
    const result = assessFitEvidence(input);
    assert.ok(result.status === "blocked" || result.status === "unavailable");
    assert.equal("data" in result, false);
  }
});

test("a failure in either memory pool is a visible does-not-fit result", () => {
  for (const [field, bytes, expected] of [
    ["deviceMemoryBytes", 4 * 1024 ** 3, "Device pool"],
    ["totalRamBytes", 2 * 1024 ** 3, "Host pool"],
  ] as const) {
    const input = completeInput();
    if (field === "deviceMemoryBytes") {
      input.hardwareTarget.accelerators[0].deviceMemoryBytes = bytes;
    } else {
      input.hardwareTarget.memory.totalRamBytes = bytes;
      input.hardwareTarget.memory.availableRamBytes = null;
    }
    const result = assessFitEvidence(input);
    assert.ok(result.status === "ok" || result.status === "partial", field);
    if (result.status !== "ok" && result.status !== "partial") continue;
    assert.equal(result.data.fit, "does-not-fit");
    assert.match(result.data.blockingReasons.join(" "), new RegExp(expected));
  }
});

test("M-F requires the exact M-E admission receipt binding", () => {
  const mutations = [
    ["candidate", (input: ReturnType<typeof completeInput>) => {
      input.compatibilityReceipt.candidateId = "different";
    }],
    ["artifact", (input: ReturnType<typeof completeInput>) => {
      input.compatibilityReceipt.artifactSha256 = "b".repeat(64);
    }],
    ["runtime", (input: ReturnType<typeof completeInput>) => {
      input.compatibilityReceipt.runtimeConfigurationId = "different";
    }],
    ["backend", (input: ReturnType<typeof completeInput>) => {
      input.compatibilityReceipt.target.backend = "cpu";
    }],
  ] as const;
  for (const [label, mutate] of mutations) {
    const input = completeInput();
    mutate(input);
    const result = assessFitEvidence(input);
    assert.equal(result.status, "blocked", label);
    if (result.status === "blocked") {
      assert.match(result.reasonCode, /admission|binding|identity|receipt/);
      assert.equal("data" in result, false);
    }
  }
});

test("M-F rejects semantically altered compatibility receipts from upstream", () => {
  const cases = [
    (input: ReturnType<typeof completeInput>) => {
      input.compatibilityReceipt.assertion.artifactId = "different";
    },
    (input: ReturnType<typeof completeInput>) => {
      input.compatibilityReceipt.assertion.productId = "ollama";
    },
    (input: ReturnType<typeof completeInput>) => {
      input.compatibilityReceipt.assertion.status =
        "unknown" as typeof input.compatibilityReceipt.assertion.status;
    },
    (input: ReturnType<typeof completeInput>) => {
      input.compatibilityReceipt.assertion.runtimeConstraint.exactBuild = "different";
    },
    (input: ReturnType<typeof completeInput>) => {
      input.compatibilityReceipt.target.exactBuild = "different";
    },
  ];
  for (const mutate of cases) {
    const input = completeInput();
    mutate(input);
    const result = assessFitEvidence(input);
    assert.equal(result.status, "blocked");
    assert.equal("data" in result, false);
  }
});

test("matching lossy M-G evidence remains attributed without falsifying data completeness", () => {
  const input = completeInput();
  input.evidence.records = [];
  input.evidence.throughput = structuredClone(lossyThroughputPrior);
  const result = assessFitEvidence(input);
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  if (input.evidence.throughput.kind !== "lossy") assert.fail("fixture must be lossy");
  assert.deepEqual(result.data.performance, input.evidence.throughput.value.performance);
  assert.equal(result.completeness.complete, true);
  assert.deepEqual(result.completeness.missing, []);
  assert.ok(result.completeness.warnings.some((warning) =>
    warning.includes("compatible rather than immutable")));
});

test("M-F fails closed when M-D has not supplied complete confirmed pool facts", () => {
  const cases = [
    ["host total-memory confirmation", (input: ReturnType<typeof completeInput>) => {
      input.hardwareTarget.fieldOrigins["/memory/totalRamBytes"] = "self-reported";
    }],
    ["device memory", (input: ReturnType<typeof completeInput>) => {
      input.hardwareTarget.accelerators[0].deviceMemoryBytes = null;
    }],
    ["selected device", (input: ReturnType<typeof completeInput>) => {
      input.hardwareTarget.accelerators.push(structuredClone(input.hardwareTarget.accelerators[0]));
    }],
    ["missing split-mode accelerator", (input: ReturnType<typeof completeInput>) => {
      input.hardwareTarget.accelerators = [];
    }],
    ["unified split-pool ambiguity", (input: ReturnType<typeof completeInput>) => {
      input.hardwareTarget.memory.unified = true;
    }],
    ["confirmation", (input: ReturnType<typeof completeInput>) => {
      input.hardwareTarget.fieldOrigins["/accelerators/0/deviceMemoryBytes"] = "self-reported";
    }],
  ] as const;
  for (const [label, mutate] of cases) {
    const input = completeInput();
    mutate(input);
    const result = assessFitEvidence(input);
    assert.ok(result.status === "unavailable" || result.status === "blocked", label);
    assert.equal("data" in result, false, label);
  }
});

test("candidate, requested context, profile and hardware identities may not drift", () => {
  const cases = [
    (input: ReturnType<typeof completeInput>) => {
      input.desiredContextTokens = 8_192;
    },
    (input: ReturnType<typeof completeInput>) => {
      input.fitProfile.binding.candidateId = "different";
    },
    (input: ReturnType<typeof completeInput>) => {
      input.fitProfile.binding.artifactSha256 = "b".repeat(64);
    },
    (input: ReturnType<typeof completeInput>) => {
      input.fitProfile.binding.runtime.runtimeConfigurationId = "different";
    },
    (input: ReturnType<typeof completeInput>) => {
      input.fitProfile.binding.acceleratorId = "different";
    },
    (input: ReturnType<typeof completeInput>) => {
      input.fitProfile.binding.hardwareTargetId = "different";
    },
    (input: ReturnType<typeof completeInput>) => {
      input.fitProfile.binding.hardwareTargetId = null;
    },
    (input: ReturnType<typeof completeInput>) => {
      input.fitProfile.binding.runtime.engine = "different";
    },
    (input: ReturnType<typeof completeInput>) => {
      input.fitProfile.binding.runtime.engineBuild = "different";
    },
    (input: ReturnType<typeof completeInput>) => {
      input.fitProfile.binding.runtime.backend = "cpu";
    },
    (input: ReturnType<typeof completeInput>) => {
      input.fitProfile.binding.runtime.gpuLayers = 1;
    },
    (input: ReturnType<typeof completeInput>) => {
      input.fitProfile.binding.runtime.kvCache.key = "q8_0";
    },
    (input: ReturnType<typeof completeInput>) => {
      input.fitProfile.binding.runtime.kvCache.value = "q8_0";
    },
    (input: ReturnType<typeof completeInput>) => {
      input.fitProfile.binding.runtime.batchSize = 1;
    },
    (input: ReturnType<typeof completeInput>) => {
      input.evidence.records = structuredClone(exactSpeedRecords);
      const first = input.evidence.records[0];
      if (first.kind !== "unsupported") first.value.candidateId = "different";
    },
    (input: ReturnType<typeof completeInput>) => {
      input.hardwareTarget.hardwareTargetId = `${hardwareTarget.hardwareTargetId}-different`;
    },
  ];
  for (const mutate of cases) {
    const input = completeInput();
    mutate(input);
    const result = assessFitEvidence(input);
    assert.equal(result.status, "blocked");
    assert.equal("data" in result, false);
  }
});

test("M-F does not invent a tight-fit threshold before its semantics are approved", () => {
  const input = completeInput();
  input.fitPolicy.tightHeadroomBps = 1_000;
  const result = assessFitEvidence(input);
  assert.equal(result.status, "blocked");
  if (result.status === "blocked") {
    assert.equal(result.reasonCode, "fit.tight-policy-unapproved");
    assert.equal("data" in result, false);
  }
});

test("M-F requires an attributed confirmed-capacity policy instead of magic reserve inputs", () => {
  const cases = [
    (input: ReturnType<typeof completeInput>) => {
      input.fitPolicy.policyId = "";
    },
    (input: ReturnType<typeof completeInput>) => {
      input.fitPolicy.policyVersion = "";
    },
    (input: ReturnType<typeof completeInput>) => {
      input.fitPolicy.binding.hardwareTargetId = "different";
    },
    (input: ReturnType<typeof completeInput>) => {
      input.fitPolicy.binding.operatingSystem = "linux";
    },
    (input: ReturnType<typeof completeInput>) => {
      input.fitPolicy.binding.runPath = "cpu";
    },
    (input: ReturnType<typeof completeInput>) => {
      input.fitPolicy.basis = "other" as typeof input.fitPolicy.basis;
    },
    (input: ReturnType<typeof completeInput>) => {
      input.fitPolicy.provenance = [];
    },
    (input: ReturnType<typeof completeInput>) => {
      input.fitPolicy.provenance[0].source.id = "";
      input.fitPolicy.provenance[0].source.url = null;
      input.fitPolicy.provenance[0].rawSourceRecordRef = null;
    },
  ];
  for (const mutate of cases) {
    const input = completeInput();
    mutate(input);
    const result = assessFitEvidence(input);
    assert.equal(result.status, "blocked");
    if (result.status === "blocked") assert.match(result.reasonCode, /policy|provenance/);
  }
});

test("profile and capacity-policy provenance must use a declared M-A method", () => {
  const profile = completeInput();
  const profileItems = Array.isArray(profile.fitProfile.provenance)
    ? profile.fitProfile.provenance
    : [profile.fitProfile.provenance];
  profileItems[0].method = "bogus" as typeof profileItems[0]["method"];
  const profileResult = assessFitEvidence(profile);
  assert.equal(profileResult.status, "blocked");

  const policy = completeInput();
  policy.fitPolicy.provenance[0].method =
    "bogus" as typeof policy.fitPolicy.provenance[0]["method"];
  const policyResult = assessFitEvidence(policy);
  assert.equal(policyResult.status, "blocked");
});

test("unsupported M-G evidence and a purported unbound M-B success are blocked", () => {
  const unsupported = completeInput();
  unsupported.evidence.throughput = {
    kind: "unsupported",
    reasons: ["The evidence identity does not match the candidate."],
  };
  const unsupportedResult = assessFitEvidence(unsupported);
  assert.equal(unsupportedResult.status, "blocked");

  const emptyReasons = completeInput();
  emptyReasons.evidence.throughput = {
    kind: "unsupported",
    reasons: [],
  };
  const emptyReasonsResult = assessFitEvidence(emptyReasons);
  assert.equal(emptyReasonsResult.status, "blocked");
  if (emptyReasonsResult.status === "blocked") {
    assert.match(emptyReasonsResult.message, /without an attributable reason/);
  }

  const blankReason = completeInput();
  blankReason.evidence.throughput = {
    kind: "unsupported",
    reasons: ["  "],
  };
  const blankReasonResult = assessFitEvidence(blankReason);
  assert.equal(blankReasonResult.status, "blocked");
  if (blankReasonResult.status === "blocked") {
    assert.match(blankReasonResult.message, /without an attributable reason/);
  }

  const upstream = completeInput();
  upstream.upstreamAdvisory = {
    kind: "ok",
    value: {
      schemaVersion: 1,
      capability: "m-f-upstream-advisory-input",
      candidateId: upstream.candidate.candidateId,
      hardwareTargetId: upstream.hardwareTarget.hardwareTargetId,
    },
  } as NonNullable<typeof upstream.upstreamAdvisory>;
  const upstreamResult = assessFitEvidence(upstream);
  assert.equal(upstreamResult.status, "blocked");
  if (upstreamResult.status === "blocked") assert.match(upstreamResult.reasonCode, /llmfit|upstream|crosswalk/);
});

test("M-F rejects wrong-unit fit evidence and internally conflicting exact ranges", () => {
  const wrongFit = completeInput();
  wrongFit.evidence.records = [{
    kind: "exact",
    value: {
      candidateId: wrongFit.candidate.candidateId,
      hardwareTargetId: wrongFit.hardwareTarget.hardwareTargetId,
      metric: "fit-memory",
      claim: "preference",
      provenance: [{
        ...structuredClone(wrongFit.fitPolicy.provenance[0]),
        method: "preference",
        hardwareMatch: "exact",
        configurationMatch: "exact",
        measurement: {
          unit: "probability",
          interval: { lower: 0.5, upper: 0.9 },
          confidence: null,
          eligible: true,
          eligibilityReasons: [],
        },
      }],
    },
  }];
  const wrongFitResult = assessFitEvidence(wrongFit);
  assert.equal(wrongFitResult.status, "blocked");

  const conflicting = completeInput();
  const first = structuredClone(exactSpeedRecords[0]);
  if (first.kind === "unsupported") assert.fail("fixture must be exact");
  first.value.provenance.push({
    ...structuredClone(first.value.provenance[0]),
    measurement: {
      ...structuredClone(first.value.provenance[0].measurement!),
      interval: { lower: 1, upper: 2 },
    },
    rawSourceRecordRef: "fixture://conflicting-exact-range",
  });
  conflicting.evidence.records = [first];
  const conflictResult = assessFitEvidence(conflicting);
  assert.equal(conflictResult.status, "blocked");
});

test("malformed producer handoffs return schema-valid nondata envelopes without throwing", () => {
  const cases: unknown[] = [];

  const assessment = completeInput();
  (assessment as unknown as { assessmentId: null }).assessmentId = null;
  cases.push(assessment);

  const sampler = completeInput();
  (sampler.candidate.runtime as unknown as { sampler: null }).sampler = null;
  cases.push(sampler);

  const records = completeInput();
  (records.evidence as unknown as { records: null }).records = null;
  cases.push(records);

  for (const value of cases) {
    const result = assessFitEvidence(
      value as Parameters<typeof assessFitEvidenceUnchecked>[0],
    );
    assert.ok(["blocked", "unavailable", "error"].includes(result.status));
    assert.equal("data" in result, false);
  }
});

test("an input getter throwing an empty Error still returns an attributable schema-valid error", () => {
  const hostile = new Proxy(completeInput(), {
    get(target, property, receiver) {
      if (property === "candidate") throw new Error("");
      return Reflect.get(target, property, receiver);
    },
  });
  const result = assessFitEvidence(hostile);
  assert.equal(result.status, "error");
  if (result.status === "error") {
    assert.equal(result.reasonCode, "fit.input-invalid");
    assert.ok(result.message.trim().length > 0);
  }
});

test("candidate lifecycle and contradictory hardware producer states fail closed", () => {
  const cases = [
    (input: ReturnType<typeof completeInput>) => {
      input.candidate.artifact.status =
        "triage" as typeof input.candidate.artifact.status;
    },
    (input: ReturnType<typeof completeInput>) => {
      input.hardwareTarget.accelerators[0].acceleratorId = "";
    },
    (input: ReturnType<typeof completeInput>) => {
      input.hardwareTarget.memory.availableRamBytes =
        input.hardwareTarget.memory.totalRamBytes + 1;
    },
    (input: ReturnType<typeof completeInput>) => {
      input.hardwareTarget.accelerators[0].kind = "cpu";
      input.hardwareTarget.accelerators[0].vendor = "cpu";
      input.hardwareTarget.accelerators[0].backend = "cuda";
    },
  ];
  for (const mutate of cases) {
    const input = completeInput();
    mutate(input);
    const result = assessFitEvidence(input);
    assert.ok(["blocked", "unavailable", "error"].includes(result.status));
    assert.equal("data" in result, false);
  }
});

test("M-F rejects task-success evidence because response/task quality belongs to a different subsystem", () => {
  const input = completeInput();
  input.evidence.records = [structuredClone(scopedTaskEvidence)];
  const result = assessFitEvidence(input);
  assert.equal(result.status, "blocked");
  if (result.status === "blocked") assert.match(result.reasonCode, /evidence|metric|channel/);
});

test("invalid arithmetic is returned as a typed error rather than escaping", () => {
  const input = completeInput();
  if (input.fitProfile.mode === "host") assert.fail("fixture must use split mode");
  input.fitProfile.profile.device.modelBytes = -1;
  const result = assessFitEvidence(input);
  assert.equal(result.status, "error");
  assert.equal("data" in result, false);
  if (result.status === "error") assert.match(result.reasonCode, /fit|assessment|input/);
});

test("M-F output contains no recommendation, role, ranking, UI or execution fields", () => {
  const result = assessFitEvidence(completeInput());
  const serialized = JSON.stringify(result);
  for (const forbidden of [
    "rank",
    "score",
    "responsequality",
    "universalquality",
    "primary-match",
    "download",
    "execute",
    "component",
    "screen",
  ]) {
    assert.equal(serialized.toLowerCase().includes(forbidden), false, forbidden);
  }
});

test("M-F is deterministic and does not mutate producer-owned inputs", () => {
  for (const input of [completeInput(), hostOnlyInput()]) {
    const before = structuredClone(input);
    const first = assessFitEvidence(input);
    const second = assessFitEvidence(input);
    assert.deepEqual(first, second);
    assert.deepEqual(input, before);
  }
});

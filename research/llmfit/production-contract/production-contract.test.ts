import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const PINNED_VERSION = "1.1.6";
const PINNED_REVISION = "aaa2bc179cec214ccdc44501c853b98fba0b343b";
const PRODUCTION_MODULE = "../../../lib/llmfit/index.ts";

type UnknownRecord = Record<string, unknown>;
type MappingResult =
  | { kind: "ok"; value: unknown }
  | { kind: "blocked"; reasonCode: string; message: string; missing?: string[] };
type ProductionContractModule = {
  parseLlmfitAdvisoryEnvelope: (value: unknown) => MappingResult;
  validateLlmfitAdvisoryRequest: (value: unknown) => MappingResult;
  bindLlmfitAdvisoryForMFFit: (
    envelope: unknown,
    binding: unknown,
  ) => MappingResult;
};

const successFixture = JSON.parse(
  await readFile(
    new URL("./fixtures/success.json", import.meta.url),
    "utf8",
  ),
) as UnknownRecord;
const failClosedFixture = JSON.parse(
  await readFile(
    new URL("./fixtures/fail-closed.json", import.meta.url),
    "utf8",
  ),
) as UnknownRecord;

async function loadProductionContract(): Promise<ProductionContractModule> {
  let imported: UnknownRecord;
  try {
    imported = (await import(PRODUCTION_MODULE)) as UnknownRecord;
  } catch (error) {
    assert.fail(
      `The approved M-B production boundary is not implemented at ${PRODUCTION_MODULE}: ${String(error)}`,
    );
  }
  for (const name of [
    "parseLlmfitAdvisoryEnvelope",
    "validateLlmfitAdvisoryRequest",
    "bindLlmfitAdvisoryForMFFit",
  ]) {
    assert.equal(
      typeof imported[name],
      "function",
      `M-B must export ${name} from ${PRODUCTION_MODULE}`,
    );
  }
  return imported as ProductionContractModule;
}

function record(value: unknown, path: string): UnknownRecord {
  assert.ok(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${path} must be an object`,
  );
  return value as UnknownRecord;
}

function array(value: unknown, path: string): unknown[] {
  assert.ok(Array.isArray(value), `${path} must be an array`);
  return value;
}

function assertNoRankingFields(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoRankingFields(item, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as UnknownRecord)) {
    assert.ok(
      !["score", "scoreComponents", "rank", "position", "role", "quality"].includes(
        key,
      ),
      `${path}.${key} would turn M-B advice into ranking or quality evidence`,
    );
    assertNoRankingFields(child, `${path}.${key}`);
  }
}

function assertPinnedSource(value: unknown, path: string): void {
  const source = record(value, path);
  assert.equal(source.id, "llmfit-core");
  assert.equal(source.version, PINNED_VERSION);
  assert.equal(source.revision, PINNED_REVISION);
  assert.equal(source.url, "https://github.com/AlexsJones/llmfit");
}

test("golden success fixture is attributed advice, preserves nulls, and contains no ranking", () => {
  const output = record(successFixture.providerOutput, "providerOutput");
  assert.equal(output.status, "ok");
  assertPinnedSource(output.source, "providerOutput.source");

  const candidates = array(output.candidates, "providerOutput.candidates").map(
    (candidate, index) => record(candidate, `providerOutput.candidates[${index}]`),
  );
  assert.deepEqual(
    candidates.map((candidate) => candidate.advisoryId),
    [
      "llmfit:fixture-org/example-7b",
      "llmfit:fixture-org/example-3b",
    ],
    "M-B preserves provider order only; this is not a ranking assertion",
  );
  const secondAdvisory = record(
    candidates[1].advisory,
    "providerOutput.candidates[1].advisory",
  );
  const secondPerformance = record(
    secondAdvisory.performance,
    "providerOutput.candidates[1].advisory.performance",
  );
  assert.equal(secondAdvisory.suggestedRuntime, null);
  assert.equal(secondAdvisory.suggestedQuantization, null);
  assert.equal(secondPerformance.estimatedGenerationTokensPerSecond, null);
  assert.equal(secondPerformance.upstreamReportedGenerationTokensPerSecond, null);
  for (const candidate of candidates) {
    const upstreamModel = record(candidate.upstreamModel, "candidate.upstreamModel");
    assert.ok(Array.isArray(upstreamModel.upstreamReportedCapabilities));
    assert.equal("capabilities" in upstreamModel, false);
  }

  for (const [index, candidate] of candidates.entries()) {
    assert.equal(typeof candidate.rawSourceRecordRef, "string");
    for (const [provenanceIndex, provenanceValue] of array(
      candidate.provenance,
      `providerOutput.candidates[${index}].provenance`,
    ).entries()) {
      const provenance = record(
        provenanceValue,
        `providerOutput.candidates[${index}].provenance[${provenanceIndex}]`,
      );
      assertPinnedSource(
        provenance.source,
        `providerOutput.candidates[${index}].provenance[${provenanceIndex}].source`,
      );
      assert.equal(provenance.method, "estimate");
      assert.equal(provenance.configurationMatch, "family-proxy");
    }
  }
  assertNoRankingFields(output);
});

test("golden failures distinguish unsupported, blocked, and unavailable without candidates", () => {
  const unknownEnum = record(
    record(failClosedFixture.unknownUpstreamEnum, "unknownUpstreamEnum")
      .providerOutput,
    "unknownUpstreamEnum.providerOutput",
  );
  assert.equal(unknownEnum.status, "unsupported");
  assert.equal(unknownEnum.reasonCode, "llmfit.upstream-enum.unsupported");
  assert.equal(unknownEnum.providerInvoked, true);
  assert.equal("candidates" in unknownEnum, false);
  assert.equal(typeof unknownEnum.rawSourceRecordRef, "string");

  const missingHardware = record(
    record(failClosedFixture.missingHardware, "missingHardware").expected,
    "missingHardware.expected",
  );
  assert.equal(missingHardware.status, "blocked");
  assert.equal(missingHardware.providerInvoked, false);
  assert.deepEqual(missingHardware.provenance, []);
  assert.equal("candidates" in missingHardware, false);

  const unavailable = record(
    record(failClosedFixture.upstreamUnavailable, "upstreamUnavailable").expected,
    "upstreamUnavailable.expected",
  );
  assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.providerInvoked, true);
  assert.equal("candidates" in unavailable, false);
  const provenance = record(
    array(unavailable.provenance, "upstreamUnavailable.expected.provenance")[0],
    "upstreamUnavailable.expected.provenance[0]",
  );
  assertPinnedSource(
    provenance.source,
    "upstreamUnavailable.expected.provenance[0].source",
  );

  const unknownRam = record(
    record(failClosedFixture.unknownAvailableRam, "unknownAvailableRam").expected,
    "unknownAvailableRam.expected",
  );
  assert.equal(unknownRam.status, "blocked");
  assert.equal(unknownRam.providerInvoked, false);
  assert.deepEqual(unknownRam.missing, [
    "hardwareTarget.memory.availableRamBytes",
  ]);

  const heterogeneous = record(
    record(
      failClosedFixture.heterogeneousAccelerators,
      "heterogeneousAccelerators",
    ).expected,
    "heterogeneousAccelerators.expected",
  );
  assert.equal(heterogeneous.status, "unsupported");
  assert.equal(heterogeneous.providerInvoked, false);
  assert.equal(
    heterogeneous.reasonCode,
    "llmfit.hardware.topology-not-representable",
  );
});

test("production parser accepts the provider-neutral golden envelope unchanged", async () => {
  const production = await loadProductionContract();
  const result = production.parseLlmfitAdvisoryEnvelope(
    successFixture.providerOutput,
  );
  assert.equal(result.kind, "ok");
  if (result.kind === "ok") {
    assert.deepEqual(result.value, successFixture.providerOutput);
  }
});

test("request validation blocks missing hardware and invalid runtime before provider invocation", async () => {
  const production = await loadProductionContract();
  const missingHardware = record(
    failClosedFixture.missingHardware,
    "missingHardware",
  );
  const missingResult = production.validateLlmfitAdvisoryRequest(
    missingHardware.input,
  );
  assert.equal(missingResult.kind, "blocked");
  if (missingResult.kind === "blocked") {
    const expected = record(missingHardware.expected, "missingHardware.expected");
    assert.equal(missingResult.reasonCode, expected.reasonCode);
    assert.deepEqual(missingResult.missing, expected.missing);
  }

  const successInput = structuredClone(successFixture.input) as UnknownRecord;
  const query = record(successInput.query, "input.query");
  query.forcedRuntime = "made-up-runtime";
  const runtimeResult =
    production.validateLlmfitAdvisoryRequest(successInput);
  assert.equal(runtimeResult.kind, "blocked");
  if (runtimeResult.kind === "blocked") {
    assert.equal(runtimeResult.reasonCode, "llmfit.override.invalid");
  }

  const knownRuntimeInput = structuredClone(successFixture.input) as UnknownRecord;
  record(knownRuntimeInput.query, "input.query").forcedRuntime = "llama.cpp";
  const knownRuntimeResult =
    production.validateLlmfitAdvisoryRequest(knownRuntimeInput);
  assert.equal(knownRuntimeResult.kind, "blocked");
  if (knownRuntimeResult.kind === "blocked") {
    assert.equal(
      knownRuntimeResult.reasonCode,
      "llmfit.override.unsupported-in-pinned-adapter",
    );
  }
});

test("request validation refuses unknown available RAM and heterogeneous accelerators", async () => {
  const production = await loadProductionContract();

  const unknownRamInput = structuredClone(successFixture.input) as UnknownRecord;
  const unknownRamHardware = record(
    unknownRamInput.hardwareTarget,
    "input.hardwareTarget",
  );
  record(unknownRamHardware.memory, "input.hardwareTarget.memory").availableRamBytes =
    null;
  unknownRamInput.requestId = "rec_unknown_available_ram";
  const unknownRamResult =
    production.validateLlmfitAdvisoryRequest(unknownRamInput);
  assert.equal(unknownRamResult.kind, "blocked");
  if (unknownRamResult.kind === "blocked") {
    assert.equal(
      unknownRamResult.reasonCode,
      "llmfit.hardware.required-facts-missing",
    );
    assert.deepEqual(unknownRamResult.missing, [
      "hardwareTarget.memory.availableRamBytes",
    ]);
  }

  const heterogeneousInput = structuredClone(
    successFixture.input,
  ) as UnknownRecord;
  heterogeneousInput.requestId = "rec_heterogeneous_accelerators";
  const heterogeneousHardware = record(
    heterogeneousInput.hardwareTarget,
    "input.hardwareTarget",
  );
  const accelerators = array(
    heterogeneousHardware.accelerators,
    "input.hardwareTarget.accelerators",
  );
  accelerators.push({
    acceleratorId: "fixture:rocm:16g",
    displayName: "Fixture ROCm GPU",
    kind: "amd",
    vendor: "amd",
    backend: "rocm",
    deviceMemoryBytes: 17179869184,
    count: 1,
  });
  const heterogeneousResult =
    production.validateLlmfitAdvisoryRequest(heterogeneousInput);
  assert.equal(heterogeneousResult.kind, "blocked");
  if (heterogeneousResult.kind === "blocked") {
    assert.equal(
      heterogeneousResult.reasonCode,
      "llmfit.hardware.topology-not-representable",
    );
  }
});

test("parser accepts explicit unknown-enum failure but rejects unattributed success", async () => {
  const production = await loadProductionContract();
  const unknownEnum = record(
    failClosedFixture.unknownUpstreamEnum,
    "unknownUpstreamEnum",
  );
  const unsupported = production.parseLlmfitAdvisoryEnvelope(
    unknownEnum.providerOutput,
  );
  assert.equal(unsupported.kind, "ok");

  const unattributed = structuredClone(
    successFixture.providerOutput,
  ) as UnknownRecord;
  const candidates = array(unattributed.candidates, "candidates");
  delete record(candidates[0], "candidates[0]").provenance;
  const rejected = production.parseLlmfitAdvisoryEnvelope(unattributed);
  assert.equal(rejected.kind, "blocked");
  if (rejected.kind === "blocked") {
    assert.match(rejected.reasonCode, /provenance|schema|invalid/);
  }
});

test("adversarial request values that cannot cross to Rust fail closed", async () => {
  const production = await loadProductionContract();

  const missingIdentity = structuredClone(successFixture.input) as UnknownRecord;
  record(missingIdentity.hardwareTarget, "hardwareTarget").hardwareTargetId = "";
  assert.equal(
    production.validateLlmfitAdvisoryRequest(missingIdentity).kind,
    "blocked",
  );

  const missingCpu = structuredClone(successFixture.input) as UnknownRecord;
  record(
    record(missingCpu.hardwareTarget, "hardwareTarget").cpu,
    "hardwareTarget.cpu",
  ).displayName = null;
  assert.equal(
    production.validateLlmfitAdvisoryRequest(missingCpu).kind,
    "blocked",
  );

  const oversizedContext = structuredClone(successFixture.input) as UnknownRecord;
  record(oversizedContext.query, "query").desiredContextTokens = 4_294_967_296;
  assert.equal(
    production.validateLlmfitAdvisoryRequest(oversizedContext).kind,
    "blocked",
  );
});

test("adversarial envelopes cannot hide contradictions, ranking, or failure candidates", async () => {
  const production = await loadProductionContract();
  const mutations: Array<(output: UnknownRecord) => void> = [
    (output) => {
      const candidate = record(array(output.candidates, "candidates")[0], "candidate");
      const advisory = record(candidate.advisory, "advisory");
      advisory.memoryRequiredBytes = 20_000_000_000;
    },
    (output) => {
      const candidate = record(array(output.candidates, "candidates")[0], "candidate");
      const context = record(record(candidate.advisory, "advisory").context, "context");
      context.effectiveTokens = 20_000;
    },
    (output) => {
      const candidate = record(array(output.candidates, "candidates")[0], "candidate");
      const provenance = record(array(candidate.provenance, "provenance")[0], "provenance[0]");
      const measurement = record(provenance.measurement, "measurement");
      record(measurement.interval, "interval").lower = -1;
    },
    (output) => {
      const candidate = record(array(output.candidates, "candidates")[0], "candidate");
      candidate.score_components = { fit: 1 };
    },
  ];

  for (const mutate of mutations) {
    const output = structuredClone(successFixture.providerOutput) as UnknownRecord;
    mutate(output);
    assert.equal(production.parseLlmfitAdvisoryEnvelope(output).kind, "blocked");
  }

  const failure = structuredClone(
    record(failClosedFixture.unknownUpstreamEnum, "unknownUpstreamEnum")
      .providerOutput,
  ) as UnknownRecord;
  failure.candidates = [];
  assert.equal(production.parseLlmfitAdvisoryEnvelope(failure).kind, "blocked");
});

test("M-B to M-F handoff stays blocked until M-C verifies the family crosswalk", async () => {
  const production = await loadProductionContract();
  const parsed = production.parseLlmfitAdvisoryEnvelope(
    successFixture.providerOutput,
  );
  assert.equal(parsed.kind, "ok");
  if (parsed.kind !== "ok") return;

  const bound = production.bindLlmfitAdvisoryForMFFit(
    parsed.value,
    successFixture.familyBinding,
  );
  assert.equal(bound.kind, "blocked");
  if (bound.kind === "blocked") {
    assert.equal(
      bound.reasonCode,
      "llmfit.binding.registry-crosswalk-unverified",
    );
  }

  const unsupportedEnvelope = structuredClone(
    successFixture.providerOutput,
  ) as UnknownRecord;
  const unsupportedCandidate = record(
    array(unsupportedEnvelope.candidates, "candidates")[0],
    "candidates[0]",
  );
  unsupportedCandidate.mappingIssues = [
    {
      path: "advisory.runPath",
      classification: "unsupported",
      reasonCode: "llmfit.run-path.unsupported",
      message: "unsupported path",
    },
  ];
  const unsupported = production.bindLlmfitAdvisoryForMFFit(
    unsupportedEnvelope,
    successFixture.familyBinding,
  );
  assert.equal(unsupported.kind, "blocked");
  if (unsupported.kind === "blocked") {
    assert.equal(unsupported.reasonCode, "llmfit.binding.unsupported-mapping");
  }

  const wrongBinding = {
    ...record(successFixture.familyBinding, "familyBinding"),
    upstreamModelId: "fixture-org/a-different-model",
  };
  const mismatch = production.bindLlmfitAdvisoryForMFFit(
    parsed.value,
    wrongBinding,
  );
  assert.equal(mismatch.kind, "blocked");
  if (mismatch.kind === "blocked") {
    assert.match(mismatch.reasonCode, /family|binding|mismatch/);
  }
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type {
  ContractEnvelope,
  RunnerImportBundle,
  TypedEnvelope,
} from "../../lib/contracts";
import {
  inspectRunnerImportBundle,
  isImportAllowedByInspection,
} from "../../lib/orchestrator/runner-import";
import type {
  RunnerImportInspectionV1,
} from "../../lib/orchestrator/runner-import";
import {
  scanRunnerInventory,
  selectVerifiedInventoryArtifact,
} from "../../lib/orchestrator/runner";
import type {
  RunnerInventoryPortResultV1,
  VerifiedInventorySelectionV1,
} from "../../lib/orchestrator/runner";
import {
  prepareVerificationPlanPreview,
} from "../../lib/orchestrator/verification-preview";
import type {
  PrepareVerificationPlanPreviewInputV1,
  ImportAllowedInspectionV1,
  PrepareVerificationPlanPortInputV1,
  VerificationPlanEnvelope,
} from "../../lib/orchestrator/verification-preview";

const bundleEnvelope = JSON.parse(readFileSync(
  new URL("../../docs/contracts/fixtures/runner-import-bundle.ok.json", import.meta.url),
  "utf8",
)) as TypedEnvelope<"runner-import-bundle">;
const planFixture = JSON.parse(readFileSync(
  new URL("../../docs/contracts/fixtures/verification-plan.ok.json", import.meta.url),
  "utf8",
)) as TypedEnvelope<"verification-plan">;

function inspect(
  intent: "inspect" | "confirm-expired-import" = "inspect",
  now = "2026-07-22T13:00:00Z",
  mutate?: (bundle: RunnerImportBundle) => void,
): RunnerImportInspectionV1 {
  const envelope = structuredClone(bundleEnvelope);
  mutate?.(envelope.data);
  return inspectRunnerImportBundle({ bundleEnvelope: envelope, now, intent });
}

async function makeVerifiedInventory(): Promise<VerifiedInventorySelectionV1> {
  const candidate = bundleEnvelope.data.handoff.selectedCandidate;
  const response: RunnerInventoryPortResultV1 = {
    status: "ok",
    data: {
      registrySnapshotId: "registry-fixture",
      registryLastIngestSucceededAt: "2026-07-22T12:00:00Z",
      stores: [{
        kind: "manual",
        path: "C:\\Models",
        exists: true,
        truncated: false,
      }],
      artifacts: [{
        path: "C:\\Models\\fixture.gguf",
        store: "manual",
        label: candidate.artifact.filename,
        fileSizeBytes: candidate.artifact.bytes,
        sha256: candidate.artifact.sha256,
        resolution: {
          status: "verified",
          identity: {
            modelFamily: structuredClone(candidate.modelFamily),
            artifact: structuredClone(candidate.artifact),
            provenance: structuredClone(candidate.provenance),
            registryMetadata: {
              publisher: "fixture-publisher",
              baseModel: "fixture-base",
              model: "fixture-model",
              maxContextTokens: 32_768,
              chatTemplate: candidate.runtime.chatTemplate ?? "unknown",
              licenseSourceUrl: "https://example.invalid/license",
              fieldProvenance: {
                sha256: {
                  sourceUrl: "https://example.invalid/artifact",
                  retrievedAt: "2026-07-22T12:00:00Z",
                  kind: "registry",
                },
              },
            },
          },
        },
      }],
      duplicateGroups: [],
      unreadable: [],
      provenance: "fixture",
    },
    warnings: [],
  };
  const session = await scanRunnerInventory(
    { action: "scan-model-stores", requestId: "inventory-fixture", extraDirectories: [] },
    { scanModelStores: () => response },
  );
  const selected = selectVerifiedInventoryArtifact(
    session,
    "C:\\Models\\fixture.gguf",
  );
  if (selected.status !== "ok") throw new Error("verified inventory fixture failed");
  return selected.data;
}

const freshInspection = inspect();
if (!isImportAllowedByInspection(freshInspection)) {
  throw new Error("fresh import fixture failed");
}
const acceptedImport: ImportAllowedInspectionV1 = freshInspection;
const verifiedInventory = await makeVerifiedInventory();

function plan(
  bundle = bundleEnvelope.data,
  status: "ok" | "partial" = "ok",
): TypedEnvelope<"verification-plan"> {
  const value = structuredClone(planFixture);
  value.status = status;
  value.data.verificationPlanId = "plan-requested";
  value.data.hardwareTargetId = bundle.handoff.hardwareTarget.hardwareTargetId;
  value.data.candidateId = bundle.handoff.selectedCandidate.candidateId;
  value.data.quickCheckPlan = null;
  const benchmark = value.data.benchmarkPlan;
  assert.notEqual(benchmark, null);
  if (benchmark === null) throw new Error("fixture benchmark plan is required");
  benchmark.candidateId = bundle.handoff.selectedCandidate.candidateId;
  benchmark.artifactPath = "C:\\Models\\fixture.gguf";
  benchmark.expectedArtifactSha256 =
    bundle.handoff.selectedCandidate.artifact.sha256;
  benchmark.runtime =
    structuredClone(bundle.handoff.selectedCandidate.runtime);
  value.completeness.complete = status === "ok";
  value.completeness.missing = status === "partial" ? ["quick-check-plan"] : [];
  return value;
}

function previewInput(
  mutate?: (value: PrepareVerificationPlanPreviewInputV1) => void,
): PrepareVerificationPlanPreviewInputV1 {
  const candidate = bundleEnvelope.data.handoff.selectedCandidate;
  const benchmark = planFixture.data.benchmarkPlan;
  if (benchmark === null || candidate.runtime.engineBuild === null) {
    throw new Error("complete benchmark fixture is required");
  }
  const value: PrepareVerificationPlanPreviewInputV1 = {
    action: "prepare-verification",
    verificationPlanId: "plan-requested",
    confirmedHardware: {
      confirmationVersion: 1,
      hardwareTargetId: bundleEnvelope.data.handoff.hardwareTarget.hardwareTargetId,
      state: "ready",
      actionId: "detect-hardware-fixture",
      confirmedAt: "2026-07-22T12:30:00Z",
    },
    benchmark: {
      planId: benchmark.benchmarkPlanId,
      tool: {
        kind: "benchmark",
        path: "C:\\Tools\\llama-bench.exe",
        expectedSha256: "c".repeat(64),
        observedProduct: candidate.runtime.product,
        observedEngine: candidate.runtime.engine,
        observedEngineBuild: candidate.runtime.engineBuild,
        probeProtocolId: "existing-tool-probe-v1",
        observedAt: "2026-07-22T12:31:00Z",
      },
      protocolId: benchmark.protocolId,
      warmupRuns: benchmark.warmupRuns,
      measuredRuns: benchmark.measuredRuns,
      measurementKinds: structuredClone(benchmark.measurementKinds),
      preflight: structuredClone(benchmark.preflight),
    },
    quickCheck: null,
  };
  mutate?.(value);
  return value;
}

test("complete structural seam input is forwarded frozen without defaults or authorization", async () => {
  let observedAction = "";
  let observedExecutionAuthorization = true;
  let observedHardware: unknown = null;
  let observedBenchmark: unknown = null;
  let observedQuickCheck: unknown = "not-observed";
  let observedKeys: string[] = [];
  const requested = previewInput();
  const result = await prepareVerificationPlanPreview(
    requested,
    acceptedImport,
    verifiedInventory,
    {
      prepareVerificationPlan(input) {
        const seen = input as PrepareVerificationPlanPortInputV1;
        observedAction = seen.action;
        observedExecutionAuthorization = seen.grantsExecutionAuthorization;
        observedHardware = structuredClone(seen.confirmedHardware);
        observedBenchmark = structuredClone(seen.benchmark);
        observedQuickCheck = structuredClone(seen.quickCheck);
        observedKeys = Object.keys(seen).sort();
        assert.equal(Object.isFrozen(input), true);
        assert.equal(Object.isFrozen(input.candidate.runtime), true);
        return plan();
      },
    },
  );

  assert.equal(result.status, "ok");
  assert.equal(result.previewOnly, true);
  assert.equal(result.grantsExecutionAuthorization, false);
  assert.equal(result.permissionBoundary.readsSelectedArtifactAndToolIdentity, true);
  assert.equal(result.permissionBoundary.executesLocalProcess, false);
  assert.equal(result.permissionBoundary.loadsModel, false);
  assert.equal(result.permissionBoundary.network, false);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(observedAction, "prepare-verification");
  assert.equal(observedExecutionAuthorization, false);
  assert.deepEqual(observedHardware, requested.confirmedHardware);
  assert.deepEqual(observedBenchmark, requested.benchmark);
  assert.deepEqual(observedQuickCheck, requested.quickCheck);
  assert.deepEqual(observedKeys, [
    "action",
    "benchmark",
    "candidate",
    "compatibilityAdmission",
    "confirmedHardware",
    "grantsExecutionAuthorization",
    "inventorySelection",
    "previewOnly",
    "quickCheck",
    "verificationPlanId",
  ]);
});

test("partial and non-data M-J states are preserved without promotion", async () => {
  const partial = await prepareVerificationPlanPreview(
    previewInput(),
    acceptedImport,
    verifiedInventory,
    { prepareVerificationPlan: () => plan(bundleEnvelope.data, "partial") },
  );
  assert.equal(partial.status, "partial");
  assert.equal(partial.plan.status, "partial");

  const unavailable: VerificationPlanEnvelope = {
    schemaVersion: 1,
    contract: "verification-plan",
    status: "unavailable",
    reasonCode: "m-j.platform.unsupported",
    message: "Windows-first adapter is unavailable.",
    recoverableActions: [],
    provenance: [],
    warnings: ["No platform parity claim."],
  };
  const result = await prepareVerificationPlanPreview(
    previewInput(),
    acceptedImport,
    verifiedInventory,
    { prepareVerificationPlan: () => unavailable },
  );
  assert.deepEqual(result.plan, unavailable);
  assert.equal(result.status, "unavailable");
});

test("invalid action fails before the preparation port is called", async () => {
  let calls = 0;
  const result = await prepareVerificationPlanPreview(
    previewInput((value) => {
      value.action = "inspect-import" as "prepare-verification";
    }),
    acceptedImport,
    verifiedInventory,
    { prepareVerificationPlan: () => { calls += 1; return plan(); } },
  );
  assert.equal(result.status, "blocked");
  assert.equal(calls, 0);
});

test("missing or mismatched M-J prerequisites block with no defaults and no port call", async () => {
  const mutations: Array<{
    label: string;
    mutate(value: PrepareVerificationPlanPreviewInputV1): void;
  }> = [
    {
      label: "hardware receipt",
      mutate(value) {
        (value as Partial<PrepareVerificationPlanPreviewInputV1>)
          .confirmedHardware = undefined;
      },
    },
    {
      label: "hardware binding",
      mutate(value) {
        value.confirmedHardware.hardwareTargetId = "other-hardware";
      },
    },
    {
      label: "all typed preparations",
      mutate(value) {
        value.benchmark = null;
        value.quickCheck = null;
      },
    },
    {
      label: "observed tool receipt",
      mutate(value) {
        if (value.benchmark === null) throw new Error("fixture");
        (value.benchmark as Partial<typeof value.benchmark>).tool = undefined;
      },
    },
    {
      label: "tool/runtime binding",
      mutate(value) {
        if (value.benchmark === null) throw new Error("fixture");
        value.benchmark.tool.observedEngine = "other-engine";
      },
    },
    {
      label: "tool role",
      mutate(value) {
        if (value.benchmark === null) throw new Error("fixture");
        value.benchmark.tool.kind = "quick-check";
      },
    },
    {
      label: "preflight",
      mutate(value) {
        if (value.benchmark === null) throw new Error("fixture");
        (value.benchmark as Partial<typeof value.benchmark>).preflight = undefined;
      },
    },
    {
      label: "measured runs",
      mutate(value) {
        if (value.benchmark === null) throw new Error("fixture");
        value.benchmark.measuredRuns = 0;
      },
    },
    {
      label: "measurement kinds",
      mutate(value) {
        if (value.benchmark === null) throw new Error("fixture");
        value.benchmark.measurementKinds = [];
      },
    },
  ];
  for (const item of mutations) {
    const input = previewInput();
    item.mutate(input);
    let calls = 0;
    const result = await prepareVerificationPlanPreview(
      input,
      acceptedImport,
      verifiedInventory,
      { prepareVerificationPlan: () => { calls += 1; return plan(); } },
    );
    assert.equal(result.status, "blocked", item.label);
    assert.equal(calls, 0, item.label);
  }
});

test("calendar-invalid prerequisite timestamps block before the planner port", async () => {
  for (const timestamp of [
    "2026-02-29T12:00:00Z",
    "2026-04-31T12:00:00Z",
    "2026-07-22T12:00:00+14:01",
  ]) {
    const input = previewInput((value) => {
      value.confirmedHardware.confirmedAt = timestamp;
    });
    let calls = 0;
    const result = await prepareVerificationPlanPreview(
      input,
      acceptedImport,
      verifiedInventory,
      { prepareVerificationPlan: () => { calls += 1; return plan(); } },
    );
    assert.equal(result.status, "blocked", timestamp);
    assert.equal(calls, 0, timestamp);
  }
});

test("expired import requires the process-local confirmation transition", async () => {
  let calls = 0;
  const port = {
    prepareVerificationPlan() {
      calls += 1;
      return plan();
    },
  };
  const unconfirmed = inspect("inspect", "2026-07-24T13:00:00Z");
  assert.equal(unconfirmed.status, "accepted");
  if (unconfirmed.status !== "accepted") throw new Error("inspection fixture failed");
  assert.equal(unconfirmed.canImport, false);
  const blocked = await prepareVerificationPlanPreview(
    previewInput(),
    unconfirmed as ImportAllowedInspectionV1,
    verifiedInventory,
    port,
  );
  assert.equal(blocked.status, "blocked");
  assert.equal(calls, 0);

  const confirmed = inspect(
    "confirm-expired-import",
    "2026-07-24T13:00:00Z",
  );
  assert.equal(confirmed.status, "accepted");
  if (!isImportAllowedByInspection(confirmed)) {
    throw new Error("confirmed inspection fixture failed");
  }
  const preview = await prepareVerificationPlanPreview(
    previewInput(),
    confirmed,
    verifiedInventory,
    port,
  );
  assert.equal(preview.status, "ok");
  assert.equal(calls, 1);
  assert.equal(preview.grantsExecutionAuthorization, false);
});

test("copied and fabricated upstream states cannot reach M-J", async () => {
  let calls = 0;
  const port = {
    prepareVerificationPlan() {
      calls += 1;
      return plan();
    },
  };
  for (const imported of [
    structuredClone(acceptedImport),
    {
      ...structuredClone(acceptedImport),
      canImport: true,
      status: "accepted",
    },
  ]) {
    const result = await prepareVerificationPlanPreview(
      previewInput(),
      imported as ImportAllowedInspectionV1,
      verifiedInventory,
      port,
    );
    assert.equal(result.status, "blocked");
  }
  for (const selection of [
    structuredClone(verifiedInventory),
    {
      ...structuredClone(verifiedInventory),
      requestId: "fabricated",
    },
  ]) {
    const result = await prepareVerificationPlanPreview(
      previewInput(),
      acceptedImport,
      selection,
      port,
    );
    assert.equal(result.status, "blocked");
  }
  assert.equal(calls, 0);
});

test("tampered bundle fails its M-A canonical validation before the port", async () => {
  let calls = 0;
  const result = await prepareVerificationPlanPreview(
    previewInput(),
    inspect("inspect", "2026-07-22T13:00:00Z", (bundle) => {
      bundle.handoff.selectedCandidate.artifact.bytes += 1;
    }) as ImportAllowedInspectionV1,
    verifiedInventory,
    { prepareVerificationPlan: () => { calls += 1; return plan(); } },
  );
  assert.equal(result.status, "blocked");
  assert.equal(calls, 0);
});

test("accessor-bearing port and input objects are rejected without invoking getters", async () => {
  let getterCalls = 0;
  let portCalls = 0;
  const accessorPort = Object.defineProperty({}, "prepareVerificationPlan", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return () => {
        portCalls += 1;
        return plan();
      };
    },
  });
  const result = await prepareVerificationPlanPreview(
    previewInput(),
    acceptedImport,
    verifiedInventory,
    accessorPort as { prepareVerificationPlan: () => VerificationPlanEnvelope },
  );
  assert.equal(result.status, "unavailable");
  assert.equal(getterCalls, 0);
  assert.equal(portCalls, 0);

  const accessorInput = Object.defineProperty(
    { action: "prepare-verification" },
    "verificationPlanId",
    {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "plan-requested";
      },
    },
  );
  const inputResult = await prepareVerificationPlanPreview(
    accessorInput as PrepareVerificationPlanPortInputV1,
    acceptedImport,
    verifiedInventory,
    { prepareVerificationPlan: () => { portCalls += 1; return plan(); } },
  );
  assert.equal(["blocked", "error"].includes(inputResult.status), true);
  assert.equal(getterCalls, 0);
  assert.equal(portCalls, 0);
});

test("inventory copy drift in hash, bytes or registry identity fails closed", async () => {
  for (const drift of [
    (value: VerifiedInventorySelectionV1) => { value.sha256 = "b".repeat(64); },
    (value: VerifiedInventorySelectionV1) => { value.fileSizeBytes += 1; },
    (value: VerifiedInventorySelectionV1) => {
      value.identity.artifact.revision = "other-revision";
    },
  ]) {
    const selection = structuredClone(verifiedInventory);
    drift(selection);
    let calls = 0;
    const result = await prepareVerificationPlanPreview(
      previewInput(),
      acceptedImport,
      selection,
      { prepareVerificationPlan: () => { calls += 1; return plan(); } },
    );
    assert.equal(result.status, "blocked");
    assert.equal(calls, 0);
  }
});

test("plan identity, path, hash and canonical runtime drift are blocked", async () => {
  const mutations: Array<(value: TypedEnvelope<"verification-plan">) => void> = [
    (value) => { value.data.verificationPlanId = "wrong-plan"; },
    (value) => { value.data.hardwareTargetId = "wrong-hardware"; },
    (value) => {
      value.data.candidateId = "wrong-candidate";
      value.data.benchmarkPlan!.candidateId = "wrong-candidate";
    },
    (value) => { value.data.benchmarkPlan!.artifactPath = "C:\\other.gguf"; },
    (value) => { value.data.benchmarkPlan!.expectedArtifactSha256 = "b".repeat(64); },
    (value) => { value.data.benchmarkPlan!.runtime.contextTokens += 1; },
    (value) => { value.data.benchmarkPlan!.benchmarkPlanId = "other-benchmark"; },
    (value) => { value.data.benchmarkPlan!.protocolId = "other-protocol"; },
    (value) => { value.data.benchmarkPlan!.measuredRuns += 1; },
    (value) => { value.data.benchmarkPlan!.measurementKinds = ["memory"]; },
    (value) => { value.data.benchmarkPlan!.preflight.power = "battery"; },
  ];
  for (const mutate of mutations) {
    const returned = plan();
    mutate(returned);
    const result = await prepareVerificationPlanPreview(
      previewInput(),
      acceptedImport,
      verifiedInventory,
      { prepareVerificationPlan: () => returned },
    );
    assert.equal(result.status, "blocked");
    assert.equal("reasonCode" in result.plan
      ? result.plan.reasonCode
      : null, "orchestrator.verification-preview.plan-binding-invalid");
  }
});

test("malformed, wrong-contract, thrown and hostile port results are contained", async () => {
  const cases: Array<() => unknown> = [
    () => ({ status: "ok" }),
    () => ({
      ...plan(),
      contract: "verification-result",
    }),
    () => new Proxy({}, { get() { throw new Error("hostile"); } }),
  ];
  for (const value of cases) {
    const result = await prepareVerificationPlanPreview(
      previewInput(),
      acceptedImport,
      verifiedInventory,
      { prepareVerificationPlan: () => value() as VerificationPlanEnvelope },
    );
    assert.equal(["blocked", "error"].includes(result.status), true);
  }
  const thrown = await prepareVerificationPlanPreview(
    previewInput(),
    acceptedImport,
    verifiedInventory,
    { prepareVerificationPlan: () => { throw new Error("port"); } },
  );
  assert.equal(thrown.status, "error");
});

test("accessor-bearing and cyclic planner results are rejected before AJV or cloning", async () => {
  let getterCalls = 0;
  const accessorResult = structuredClone(plan());
  Object.defineProperty(accessorResult, "data", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return plan().data;
    },
  });
  const accessor = await prepareVerificationPlanPreview(
    previewInput(),
    acceptedImport,
    verifiedInventory,
    {
      prepareVerificationPlan: () =>
        accessorResult as unknown as VerificationPlanEnvelope,
    },
  );
  assert.equal(accessor.status, "error");
  assert.equal(getterCalls, 0);
  assert.equal("reasonCode" in accessor.plan
    ? accessor.plan.reasonCode
    : null, "orchestrator.verification-preview.port-hostile");

  const cyclic = plan() as TypedEnvelope<"verification-plan">
    & { cycle?: unknown };
  cyclic.cycle = cyclic;
  const cycle = await prepareVerificationPlanPreview(
    previewInput(),
    acceptedImport,
    verifiedInventory,
    { prepareVerificationPlan: () => cyclic },
  );
  assert.equal(cycle.status, "error");
  assert.equal("reasonCode" in cycle.plan
    ? cycle.plan.reasonCode
    : null, "orchestrator.verification-preview.port-hostile");
});

test("hostile caller inputs are contained and cannot reach the port", async () => {
  const hostile = new Proxy({}, { get() { throw new Error("hostile"); } });
  let calls = 0;
  const port = {
    prepareVerificationPlan() {
      calls += 1;
      return plan();
    },
  };
  for (const args of [
    [hostile, acceptedImport, verifiedInventory],
    [previewInput(), hostile, verifiedInventory],
    [previewInput(), acceptedImport, hostile],
  ]) {
    const result = await prepareVerificationPlanPreview(
      args[0] as PrepareVerificationPlanPortInputV1,
      args[1] as ImportAllowedInspectionV1,
      args[2] as VerifiedInventorySelectionV1,
      port,
    );
    assert.equal(["blocked", "error"].includes(result.status), true);
  }
  assert.equal(calls, 0);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  isIntactVerifiedInventorySelection,
  previewRunnerPermissions,
  scanRunnerInventory,
  selectVerifiedInventoryArtifact,
} from "../../lib/orchestrator/runner";
import type {
  RunnerInventoryPortResultV1,
  ScanRunnerInventoryInputV1,
} from "../../lib/orchestrator/runner";

const HASH = "a".repeat(64);
const provenance = {
  source: { id: "registry-fixture", version: "1", revision: null, url: null },
  retrievedAt: "2026-07-23T00:00:00Z",
  observedAt: null,
  method: "imported" as const,
  hardwareMatch: "not-applicable" as const,
  configurationMatch: "exact" as const,
  scope: { taskFamily: null, taskPackId: null, promptId: null, harnessId: null },
  sampleCount: null,
  measurement: null,
  rawSourceRecordRef: null,
};

function inventory(
  status: "ok" | "partial" | "unavailable" = "ok",
  resolution: RunnerInventoryPortResultV1["data"]["artifacts"][number]["resolution"] = {
    status: "verified",
    identity: {
      modelFamily: { modelFamilyId: "family-qwen", displayName: "Qwen" },
      artifact: {
        artifactId: "artifact-qwen-q4",
        repository: "org/model",
        revision: "rev",
        filename: "model-q4.gguf",
        sha256: HASH,
        bytes: 4_000,
        format: "gguf",
        quantization: "Q4_K_M",
        license: "apache-2.0",
        status: "promoted",
      },
      provenance: [provenance],
      registryMetadata: {
        publisher: "org",
        baseModel: "qwen",
        model: "qwen-q4",
        maxContextTokens: 32_768,
        chatTemplate: "chatml",
        licenseSourceUrl: "https://example.invalid/license",
        fieldProvenance: {
          sha256: {
            sourceUrl: "https://example.invalid/artifact",
            retrievedAt: "2026-07-23T00:00:00Z",
            kind: "registry",
          },
        },
      },
    },
  },
): RunnerInventoryPortResultV1 {
  return {
    status,
    data: {
      registrySnapshotId: "registry-1",
      registryLastIngestSucceededAt: "2026-07-23T00:00:00Z",
      stores: [{ kind: "lm-studio", path: "C:/models", exists: true, truncated: false }],
      artifacts: [{
        path: "C:/models/model-q4.gguf",
        store: "lm-studio",
        label: "model-q4.gguf",
        fileSizeBytes: 4_000,
        sha256: HASH,
        resolution,
      }],
      duplicateGroups: [],
      unreadable: [],
      provenance: "scanned-locally",
    },
    warnings: status === "partial" ? ["one store was unreadable"] : [],
  };
}

const request: ScanRunnerInventoryInputV1 = {
  action: "scan-model-stores",
  requestId: "inventory-request-1",
  extraDirectories: ["C:/models"],
};

test("permission preview is immutable information and never authorization", () => {
  const preview = previewRunnerPermissions();
  assert.equal(preview.grantsAuthorization, false);
  assert.equal(preview.actions.every((action) =>
    action.state === "not-requested"
    && action.requiresSeparateExplicitAction
    && action.network === false
    && action.upload === false
    && action.loadsModel === false), true);
  assert.equal(Object.isFrozen(preview), true);
  assert.equal(Object.isFrozen(preview.actions[0]), true);
  assert.equal(preview.actions.find((action) =>
    action.actionId === "probe-existing-tool")?.executesLocalProcess, true);
});

test("explicit scan freezes port input and preserves ok exactly", async () => {
  let seen: Readonly<ScanRunnerInventoryInputV1> | undefined;
  const result = inventory();
  const session = await scanRunnerInventory(request, {
    scanModelStores(input) {
      seen = input;
      assert.equal(Object.isFrozen(input), true);
      assert.equal(Object.isFrozen(input.extraDirectories), true);
      return result;
    },
  });
  assert.equal(session.result.status, "ok");
  assert.deepEqual(session.result, result);
  assert.notEqual(session.result, result);
  assert.equal(Object.isFrozen(session), true);
  assert.deepEqual(request.extraDirectories, ["C:/models"]);
  assert.ok(seen);
});

test("partial and unavailable inventory are never promoted", async () => {
  for (const status of ["partial", "unavailable"] as const) {
    const session = await scanRunnerInventory(request, {
      scanModelStores: () => inventory(status),
    });
    assert.equal(session.result.status, status);
  }
});

test("port throw and malformed output become contained errors", async () => {
  const thrown = await scanRunnerInventory(request, {
    scanModelStores() { throw new Error("boom"); },
  });
  assert.equal(thrown.result.status, "error");
  assert.equal("reasonCode" in thrown.result
    && thrown.result.reasonCode, "orchestrator.inventory-port-failed");

  const malformed = await scanRunnerInventory(request, {
    scanModelStores: () => (
      { ...inventory(), surprise: true } as RunnerInventoryPortResultV1
    ),
  });
  assert.equal(malformed.result.status, "error");
  assert.equal("reasonCode" in malformed.result
    && malformed.result.reasonCode, "orchestrator.inventory-port-invalid");
});

test("unknown action, duplicate directories and hostile input never invoke port", async () => {
  let calls = 0;
  const ports = { scanModelStores: () => { calls += 1; return inventory(); } };
  const wrong = await scanRunnerInventory(
    { ...request, action: "inspect-import" } as unknown as ScanRunnerInventoryInputV1,
    ports,
  );
  assert.equal(wrong.result.status, "blocked");
  const duplicate = await scanRunnerInventory(
    { ...request, extraDirectories: ["C:/models", "C:/models"] },
    ports,
  );
  assert.equal(duplicate.result.status, "blocked");
  const hostile = new Proxy({}, { get() { throw new Error("hostile"); } });
  const rejected = await scanRunnerInventory(hostile as ScanRunnerInventoryInputV1, ports);
  assert.equal(rejected.result.status, "blocked");
  assert.equal(calls, 0);
});

test("verified selection binds exact outer and registry identity", async () => {
  const session = await scanRunnerInventory(request, {
    scanModelStores: () => inventory(),
  });
  const selected = selectVerifiedInventoryArtifact(
    session,
    "C:/models/model-q4.gguf",
  );
  assert.equal(selected.status, "ok");
  if (selected.status !== "ok") return;
  assert.equal(selected.data.sha256, HASH);
  assert.equal(selected.data.identity.artifact.artifactId, "artifact-qwen-q4");
  assert.equal(Object.isFrozen(selected.data.identity), true);
  assert.equal(isIntactVerifiedInventorySelection(selected.data), true);
  assert.equal(isIntactVerifiedInventorySelection(structuredClone(selected.data)), false);
});

test("size candidates, ambiguity and unavailable resolutions stay unselectable", async () => {
  for (const resolution of [
    { status: "candidateBySize" as const, candidates: [] },
    {
      status: "ambiguousIdentity" as const,
      candidates: [],
      reasonCode: "inventory.identity-ambiguous",
      message: "multiple matches",
    },
    {
      status: "unavailable" as const,
      reasonCode: "inventory.identity-unavailable",
      message: "no identity",
    },
  ]) {
    const session = await scanRunnerInventory(request, {
      scanModelStores: () => inventory("ok", resolution),
    });
    const selected = selectVerifiedInventoryArtifact(
      session,
      "C:/models/model-q4.gguf",
    );
    assert.equal(selected.status, "blocked");
    assert.equal("reasonCode" in selected
      && selected.reasonCode, "orchestrator.inventory-artifact-not-verified");
  }
});

test("unavailable inventory cannot select even if it contains a verified-looking row", async () => {
  const session = await scanRunnerInventory(request, {
    scanModelStores: () => inventory("unavailable"),
  });
  const selected = selectVerifiedInventoryArtifact(
    session,
    "C:/models/model-q4.gguf",
  );
  assert.equal(selected.status, "blocked");
  assert.equal("reasonCode" in selected
    && selected.reasonCode, "orchestrator.inventory-unavailable");
});

test("outer hash, byte-size and snapshot bindings fail closed", async () => {
  for (const mutate of [
    (value: RunnerInventoryPortResultV1) => { value.data.artifacts[0].sha256 = "b".repeat(64); },
    (value: RunnerInventoryPortResultV1) => { value.data.artifacts[0].fileSizeBytes = 4_001; },
    (value: RunnerInventoryPortResultV1) => { value.data.registrySnapshotId = null; },
  ]) {
    const value = inventory();
    mutate(value);
    const session = await scanRunnerInventory(request, {
      scanModelStores: () => value,
    });
    const selected = selectVerifiedInventoryArtifact(
      session,
      "C:/models/model-q4.gguf",
    );
    assert.equal(selected.status, "blocked");
    assert.equal("reasonCode" in selected
      && selected.reasonCode, "orchestrator.inventory-identity-binding-invalid");
  }
});

test("copied, mutated and duplicate-path sessions cannot select", async () => {
  const session = await scanRunnerInventory(request, {
    scanModelStores: () => inventory(),
  });
  const copy = structuredClone(session);
  assert.equal(selectVerifiedInventoryArtifact(
    copy,
    "C:/models/model-q4.gguf",
  ).status, "blocked");

  const duplicateValue = inventory();
  duplicateValue.data.artifacts.push(structuredClone(duplicateValue.data.artifacts[0]));
  const duplicate = await scanRunnerInventory(request, {
    scanModelStores: () => duplicateValue,
  });
  const selected = selectVerifiedInventoryArtifact(
    duplicate,
    "C:/models/model-q4.gguf",
  );
  assert.equal(selected.status, "blocked");
  assert.equal("reasonCode" in selected
    && selected.reasonCode, "orchestrator.inventory-artifact-path-ambiguous");
});

test("accessor-bearing port output is rejected without invoking its getter", async () => {
  let getterCalls = 0;
  const value = inventory() as RunnerInventoryPortResultV1 & { surprise?: string };
  Object.defineProperty(value, "status", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "ok";
    },
  });
  const session = await scanRunnerInventory(request, {
    scanModelStores: () => value,
  });
  assert.equal(session.result.status, "error");
  assert.equal(getterCalls, 0);
});

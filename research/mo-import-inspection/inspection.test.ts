import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  inspectRunnerImportBundle,
  isImportAllowedByInspection,
  isIntactAcceptedRunnerImportInspection,
} from "../../lib/orchestrator/runner-import";

const fixtureUrl = new URL(
  "../../docs/contracts/fixtures/runner-import-bundle.ok.json",
  import.meta.url,
);

async function fixture(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(fixtureUrl, "utf8")) as Record<string, unknown>;
}

test("a fresh exact bundle is inspectable and importable without granting execution", async () => {
  const bundle = await fixture();
  const result = inspectRunnerImportBundle({
    bundleEnvelope: bundle,
    now: "2026-07-23T11:59:59Z",
    intent: "inspect",
  });
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  assert.equal(result.disposition, "fresh");
  assert.equal(result.canInspect, true);
  assert.equal(result.canImport, true);
  assert.equal(result.expired, false);
  assert.equal(result.sideEffectAuthorization, false);
  assert.equal(result.executionAuthorization, false);
  assert.equal(isIntactAcceptedRunnerImportInspection(result), true);
  assert.equal(isImportAllowedByInspection(result), true);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.bundle), true);
});

test("expiry is informational: inspection remains available but import awaits confirmation", async () => {
  const result = inspectRunnerImportBundle({
    bundleEnvelope: await fixture(),
    now: "2026-07-23T12:00:00Z",
    intent: "inspect",
  });
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  assert.equal(result.disposition, "expired-awaiting-confirmation");
  assert.equal(result.expired, true);
  assert.equal(result.canInspect, true);
  assert.equal(result.canImport, false);
  assert.equal(result.requiresExpiryConfirmation, true);
  assert.match(result.warnings.join(" "), /expired.*informational.*confirm/i);
  assert.equal(isImportAllowedByInspection(result), false);
});

test("explicit expired-import confirmation permits import but never execution", async () => {
  const result = inspectRunnerImportBundle({
    bundleEnvelope: await fixture(),
    now: "2026-07-24T12:00:00Z",
    intent: "confirm-expired-import",
  });
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  assert.equal(result.disposition, "expired-confirmed");
  assert.equal(result.canImport, true);
  assert.equal(result.requiresExpiryConfirmation, false);
  assert.equal(result.sideEffectAuthorization, false);
  assert.equal(result.executionAuthorization, false);
  assert.equal(isImportAllowedByInspection(result), true);
});

test("confirmation intent on a fresh bundle adds no authority", async () => {
  const result = inspectRunnerImportBundle({
    bundleEnvelope: await fixture(),
    now: "2026-07-22T13:00:00Z",
    intent: "confirm-expired-import",
  });
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  assert.equal(result.disposition, "fresh");
  assert.equal(result.canImport, true);
  assert.equal(result.executionAuthorization, false);
});

test("tampered outer content and nested handoff content are blocked", async () => {
  const outer = await fixture();
  const outerData = outer.data as Record<string, unknown>;
  const receipt = outerData.compatibilityAdmission as Record<string, unknown>;
  receipt.candidateId = "tampered-candidate";
  assert.equal(inspectRunnerImportBundle({
    bundleEnvelope: outer,
    now: "2026-07-22T13:00:00Z",
    intent: "inspect",
  }).status, "blocked");

  const nested = await fixture();
  const nestedData = nested.data as Record<string, unknown>;
  const handoff = nestedData.handoff as Record<string, unknown>;
  handoff.handoffId = "tampered-handoff";
  assert.equal(inspectRunnerImportBundle({
    bundleEnvelope: nested,
    now: "2026-07-22T13:00:00Z",
    intent: "inspect",
  }).status, "blocked");
});

test("wrong bundle contract, unknown versions and schema additions are blocked", async () => {
  for (const mutate of [
    (value: Record<string, unknown>) => { value.contract = "runner-handoff"; },
    (value: Record<string, unknown>) => { value.schemaVersion = 2; },
    (value: Record<string, unknown>) => {
      (value.data as Record<string, unknown>).importBundleVersion = 2;
    },
    (value: Record<string, unknown>) => { value.unexpected = true; },
  ]) {
    const bundle = await fixture();
    mutate(bundle);
    const result = inspectRunnerImportBundle({
      bundleEnvelope: bundle,
      now: "2026-07-22T13:00:00Z",
      intent: "inspect",
    });
    assert.equal(result.status, "blocked");
    assert.equal(result.canInspect, false);
    assert.equal(result.canImport, false);
  }
});

test("unavailable and error envelopes cannot masquerade as importable data", async () => {
  for (const status of ["unavailable", "blocked", "error"] as const) {
    const result = inspectRunnerImportBundle({
      bundleEnvelope: {
        schemaVersion: 1,
        contract: "runner-import-bundle",
        status,
        reasonCode: "fixture.none",
        message: "No bundle.",
        recoverableActions: [],
        provenance: [],
        warnings: [],
      },
      now: "2026-07-22T13:00:00Z",
      intent: "inspect",
    });
    assert.equal(result.status, "blocked");
  }
});

test("invalid time, intent and extra input fields fail closed", async () => {
  const bundle = await fixture();
  for (const input of [
    { bundleEnvelope: bundle, now: "not-a-time", intent: "inspect" },
    { bundleEnvelope: bundle, now: "2026-02-29T13:00:00Z", intent: "inspect" },
    { bundleEnvelope: bundle, now: "2026-04-31T13:00:00Z", intent: "inspect" },
    { bundleEnvelope: bundle, now: "2026-07-22T13:00:00+14:01", intent: "inspect" },
    { bundleEnvelope: bundle, now: "2026-07-22T13:00:00Z", intent: "execute" },
    {
      bundleEnvelope: bundle,
      now: "2026-07-22T13:00:00Z",
      intent: "inspect",
      authorization: true,
    },
  ]) {
    const result = inspectRunnerImportBundle(
      input as Parameters<typeof inspectRunnerImportBundle>[0],
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.executionAuthorization, false);
  }
});

test("getters, proxies, cycles and custom prototypes are contained", async () => {
  let getterRuns = 0;
  const getter = await fixture();
  Object.defineProperty(getter, "data", {
    enumerable: true,
    get() {
      getterRuns += 1;
      return {};
    },
  });
  assert.doesNotThrow(() => inspectRunnerImportBundle({
    bundleEnvelope: getter,
    now: "2026-07-22T13:00:00Z",
    intent: "inspect",
  }));
  assert.equal(getterRuns, 0);

  const proxy = new Proxy({}, {
    getPrototypeOf() {
      throw new Error("hostile");
    },
  });
  assert.doesNotThrow(() => inspectRunnerImportBundle({
    bundleEnvelope: proxy,
    now: "2026-07-22T13:00:00Z",
    intent: "inspect",
  }));

  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  assert.equal(inspectRunnerImportBundle({
    bundleEnvelope: cycle,
    now: "2026-07-22T13:00:00Z",
    intent: "inspect",
  }).status, "blocked");

  assert.equal(inspectRunnerImportBundle({
    bundleEnvelope: Object.create({ inherited: true }),
    now: "2026-07-22T13:00:00Z",
    intent: "inspect",
  }).status, "blocked");
});

test("the accepted snapshot is isolated and mutation invalidates its process-local brand", async () => {
  const source = await fixture();
  const result = inspectRunnerImportBundle({
    bundleEnvelope: source,
    now: "2026-07-22T13:00:00Z",
    intent: "inspect",
  });
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  (source.data as Record<string, unknown>).contentHash = "0".repeat(64);
  assert.notEqual(result.bundle.contentHash, "0".repeat(64));
  assert.equal(isIntactAcceptedRunnerImportInspection(structuredClone(result)), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import { admitFitProfile } from "../../lib/assessment";
import { collectionFixture } from "./fixtures";
import { deriveProposedProfile } from "./derive";

test("exact repeated synthetic observations derive one explicitly unreviewed profile", () => {
  const fixture = collectionFixture();
  const result = deriveProposedProfile(fixture);
  assert.equal(result.kind, "proposed-unreviewed");
  if (result.kind !== "proposed-unreviewed") return;
  assert.equal(result.record.mode, "split");
  if (result.record.mode !== "split") return;
  assert.equal(result.record.allocation.maxContextTokens, 16_384);
  assert.equal(result.record.allocation.device.computeFixedBytes, 300 * 1024 ** 2);
  assert.equal(result.record.allocation.host.computeFixedBytes, 16 * 1024 ** 2);
  assert.equal(
    result.record.allocation.host.computeContextBytesAtReference,
    4 * 1024 ** 2,
  );
  assert.match(result.warning, /machinery only/i);

  const admission = admitFitProfile({
    record: result.record,
    reviewedManifest: {
      schemaVersion: 1,
      manifestId: "empty-production-trust-root",
      manifestVersion: "1",
      reviewedAt: "2026-07-23T12:00:00.000Z",
      reviewedBy: "test-only",
      entries: [],
    },
    candidate: fixture.candidate,
    compatibilityReceipt: fixture.compatibilityReceipt,
    hardwareTarget: fixture.hardwareTarget,
  });
  assert.equal(admission.kind, "blocked");
  if (admission.kind === "blocked") {
    assert.equal(admission.reasonCode, "fit-profile.untrusted-source");
  }
});

test("disagreeing repetitions cannot be reduced to a profile", () => {
  const fixture = collectionFixture();
  const attempt = fixture.contexts[0]!.attempts[1]!;
  if (attempt.status === "completed") attempt.device.computeBytes += 1;
  const result = deriveProposedProfile(fixture);
  assert.equal(result.kind, "blocked");
  if (result.kind === "blocked") {
    assert.equal(
      result.reasonCode,
      "fit-profile-collection.repeat-disagreement",
    );
  }
});

test("failed attempts remain visible and block profile derivation", () => {
  const fixture = collectionFixture();
  fixture.contexts[0]!.attempts[1] = {
    attemptId: "synthetic-4096-2",
    observedAt: "2026-07-23T10:01:00.000Z",
    rawSourceRecordRef: "fixture://synthetic-machinery-only/4096/2",
    status: "failed",
    reasonCode: "fixture.capacity-failure",
    device: null,
    host: null,
  };
  const result = deriveProposedProfile(fixture);
  assert.equal(result.kind, "blocked");
  if (result.kind === "blocked") {
    assert.equal(
      result.reasonCode,
      "fit-profile-collection.incomplete-attempt",
    );
  }
});

test("nonlinear context observations remain unavailable", () => {
  const fixture = collectionFixture();
  for (const attempt of fixture.contexts[1]!.attempts) {
    if (attempt.status === "completed") attempt.device.contextBytes += 1;
  }
  const result = deriveProposedProfile(fixture);
  assert.equal(result.kind, "blocked");
  if (result.kind === "blocked") {
    assert.equal(
      result.reasonCode,
      "fit-profile-collection.scaling-unsupported",
    );
  }
});

test("caller-asserted local measurement cannot cross the absent capture boundary", () => {
  const fixture = collectionFixture();
  fixture.evidenceClassification = "local-measurement";
  const result = deriveProposedProfile(fixture);
  assert.equal(result.kind, "blocked");
  if (result.kind === "blocked") {
    assert.equal(
      result.reasonCode,
      "fit-profile-collection.trusted-capture-boundary-unavailable",
    );
  }
});

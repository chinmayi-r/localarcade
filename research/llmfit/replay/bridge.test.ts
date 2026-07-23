import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCapturedReplayReport,
  loadRetainedCapture,
  normalizeEligibleCapture,
} from "./bridge";

test("verifies the retained capture and blocks dishonest normalization", async () => {
  const report = buildCapturedReplayReport(await loadRetainedCapture());

  assert.equal(report.integrity.status, "verified");
  assert.equal(report.integrity.scope, "retained-byte-integrity");
  assert.ok(report.integrity.files.every((file) => file.valid));
  assert.deepEqual(
    report.integrity.files.map((file) => file.file),
    [
      "pin.json",
      "raw-system.json",
      "raw-recommend-coding.json",
      "raw-exit-codes.json",
      "raw-invalid-enums-exit.json",
    ],
  );
  assert.equal(report.executionProvenance.status, "asserted-not-attested");
  assert.equal(report.capture?.systemEchoMatchesRecommendation, true);
  assert.equal(report.capture?.candidateCount, 3);
  assert.equal(report.normalization.status, "blocked");
  assert.equal(report.normalization.invoked, false);
  assert.equal(report.normalization.result, null);
  assert.equal(
    report.normalization.reasonCode,
    "llmfit.captured-replay.independent-input-incomplete",
  );

  const facts = new Map(
    report.capture?.inputFacts.map((fact) => [fact.field, fact]),
  );
  assert.equal(
    facts.get("task.interactionStyle")?.source,
    "not-retained",
  );
  assert.equal(
    facts.get("hardware.accelerators[0].displayName")?.source,
    "host-detected",
  );
  assert.equal(
    facts.get("hardware.accelerators[0].deviceMemoryBytes")
      ?.independentlySupplied,
    true,
  );
  assert.equal(facts.get("fixture.capturedAt")?.value, null);
  assert.match(report.conclusion, /asserted, not cryptographically attested/);
});

test("refuses to interpret a byte-modified capture", async () => {
  const capture = await loadRetainedCapture();
  capture["raw-recommend-coding.json"] = Buffer.concat([
    capture["raw-recommend-coding.json"],
    Buffer.from(" "),
  ]);

  const report = buildCapturedReplayReport(capture);
  assert.equal(report.integrity.status, "failed");
  assert.equal(report.capture, null);
  assert.equal(report.normalization.invoked, false);
  assert.equal(
    report.normalization.reasonCode,
    "llmfit.captured-replay.integrity-mismatch",
  );
});

test("normalization guard cannot cover known blockers", () => {
  const result = normalizeEligibleCapture(null, null, [
    {
      reasonCode: "llmfit.captured-replay.required-fact-not-retained",
      field: "task.interactionStyle",
      message: "not retained",
    },
  ]);
  assert.equal(result, null);
});

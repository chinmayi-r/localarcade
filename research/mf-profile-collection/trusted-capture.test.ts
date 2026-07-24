import assert from "node:assert/strict";
import test from "node:test";
import { recordContentSha256 } from "../../lib/assessment/record-digest";
import { collectionFixture } from "./fixtures";
import { deriveProposedProfile } from "./derive";
import {
  deriveProposedProfileFromRunnerCapture,
  validateRunnerFitProfileCapture,
  type RunnerFitProfileCaptureV1,
} from "./trusted-capture";

function captureFixture(): RunnerFitProfileCaptureV1 {
  const collection = collectionFixture();
  const contexts: RunnerFitProfileCaptureV1["contexts"] = collection.contexts.map(
    (context) => ({
      contextTokens: context.contextTokens,
      attempts: context.attempts.map((attempt) => {
        if (attempt.status !== "completed") {
          throw new Error("fixture requires completed collection attempts");
        }
        return structuredClone(attempt);
      }),
    }),
  );
  for (const context of contexts) {
    const exemplar = context.attempts[0]!;
    context.attempts.push({
      ...structuredClone(exemplar),
      attemptId: `${exemplar.attemptId}-third`,
      observedAt: "2026-07-23T10:02:00.000Z",
      rawSourceRecordRef: `runner-fit-profile-capture://capture-fixture/${context.contextTokens}/3`,
    });
    for (const [index, attempt] of context.attempts.entries()) {
      attempt.rawSourceRecordRef =
        `runner-fit-profile-capture://capture-fixture/${context.contextTokens}/${index + 1}`;
    }
  }
  const capture = {
    schemaVersion: 1,
    contract: "runner-fit-profile-capture",
    captureId: "capture-fixture",
    captureVersion: "1",
    capturedAt: "2026-07-23T10:03:00.000Z",
    consent: {
      action: "capture-fit-profile",
      acknowledgedAt: "2026-07-23T10:00:00.000Z",
      localProcessExecutionAcknowledged: true,
      grantsServingAuthorization: false,
      grantsRecommendationAuthorization: false,
    },
    candidate: structuredClone(collection.candidate),
    compatibilityReceipt: structuredClone(collection.compatibilityReceipt),
    hardwareTarget: structuredClone(collection.hardwareTarget),
    bindings: {
      ...structuredClone(collection.bindings),
      selectedArtifactSha256: collection.candidate.artifact.sha256,
    },
    artifact: {
      canonicalPath: "C:\\Models\\fixture.gguf",
      sha256: collection.candidate.artifact.sha256,
      bytes: collection.candidate.artifact.bytes,
    },
    tool: {
      id: "llama-fit-params",
      version: "b10061 (5d5306bf3)",
      executableSha256: "c".repeat(64),
      probeProtocolId: "llama-cpp-version-v1",
    },
    command: {
      protocolId: "llama-fit-params-memory-breakdown-v1",
      argvTemplate: ["-m", "C:\\Models\\fixture.gguf", "-c", "{contextTokens}", "-fitp", "on"],
    },
    runPath: "gpu",
    contexts,
  } satisfies Omit<RunnerFitProfileCaptureV1, "contentHash">;
  return {
    ...capture,
    contentHash: recordContentSha256(capture),
  };
}

test("a consented runner receipt binds complete producer content and derives only proposed evidence", () => {
  const capture = captureFixture();
  const validated = validateRunnerFitProfileCapture(capture);
  assert.equal(validated.kind, "ok");
  if (validated.kind !== "ok") return;
  assert.equal(validated.value.contexts[0]!.attempts.length, 3);

  const derived = deriveProposedProfileFromRunnerCapture(capture);
  assert.equal(derived.kind, "proposed-unreviewed");
  if (derived.kind !== "proposed-unreviewed") return;
  assert.match(derived.warning, /proposed-unreviewed/);
  assert.match(derived.record.provenance[0]!.rawSourceRecordRef!, /runnerCaptureSha256=/);
});

test("caller-asserted local measurement still cannot bypass the trusted capture receipt", () => {
  const collection = collectionFixture();
  collection.evidenceClassification = "local-measurement";
  const result = deriveProposedProfile(collection);
  assert.equal(result.kind, "blocked");
  if (result.kind === "blocked") {
    assert.equal(
      result.reasonCode,
      "fit-profile-collection.trusted-capture-boundary-unavailable",
    );
  }
});

test("trusted capture rejects forged consent, producer drift, same-ID mutation and incomplete repetitions", () => {
  const cases: Array<[string, (capture: any) => void]> = [
    ["unknown field", (capture) => { capture.hiddenDefault = true; }],
    ["forged consent", (capture) => { capture.consent.grantsServingAuthorization = true; }],
    ["non-capture tool", (capture) => { capture.tool.id = "llama-cli"; }],
    ["same ID candidate mutation", (capture) => {
      capture.candidate.runtime.batchSize = (capture.candidate.runtime.batchSize ?? 0) + 1;
    }],
    ["artifact substitution", (capture) => { capture.artifact.sha256 = "b".repeat(64); }],
    ["only two repetitions", (capture) => { capture.contexts[0].attempts.pop(); }],
    ["failed repetition", (capture) => {
      capture.contexts[1].attempts[2].status = "failed";
      capture.contexts[1].attempts[2].reasonCode = "runner-failed";
      capture.contexts[1].attempts[2].device = null;
      capture.contexts[1].attempts[2].host = null;
    }],
  ];
  for (const [label, mutate] of cases) {
    const capture = captureFixture();
    mutate(capture);
    const result = validateRunnerFitProfileCapture(capture);
    assert.equal(result.kind, "blocked", label);
  }
});

test("trusted capture rejects a rehashed receipt that changes the fixed context protocol", () => {
  const capture = captureFixture();
  capture.contexts[1]!.contextTokens = 8_192;
  const snapshot = structuredClone(capture) as Record<string, unknown>;
  delete snapshot.contentHash;
  capture.contentHash = recordContentSha256(snapshot);
  const result = validateRunnerFitProfileCapture(capture);
  assert.equal(result.kind, "blocked");
  if (result.kind === "blocked") {
    assert.ok(result.issues.includes("contexts.fixedProtocol"));
  }
});

test("validation is deterministic and leaves caller data untouched", () => {
  const capture = captureFixture();
  const before = structuredClone(capture);
  assert.deepEqual(
    validateRunnerFitProfileCapture(capture),
    validateRunnerFitProfileCapture(capture),
  );
  assert.deepEqual(capture, before);
});

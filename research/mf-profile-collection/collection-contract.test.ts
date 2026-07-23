import assert from "node:assert/strict";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { recordContentSha256 } from "../../lib/assessment/record-digest";
import schema from "./collection-bundle-v1.schema.json";
import { collectionFixture } from "./fixtures";
import { validateCollectionBundle } from "./validator";

test("the versioned synthetic raw bundle carries full producers and canonical bindings", () => {
  const fixture = collectionFixture();
  const validateSchema = addFormats(
    new Ajv2020({ allErrors: true, strict: true }),
  ).compile(schema);
  assert.equal(
    validateSchema(fixture),
    true,
    JSON.stringify(validateSchema.errors),
  );
  const result = validateCollectionBundle(fixture);
  assert.equal(result.kind, "ok");
  if (result.kind !== "ok") return;
  assert.equal(result.value.evidenceClassification, "synthetic-machinery-only");
  assert.equal(
    result.value.bindings.candidateContentSha256,
    recordContentSha256(result.value.candidate),
  );
  assert.equal(result.value.contexts.length, 2);
  assert.equal(result.value.contexts[0]!.attempts.length, 2);
});

test("malformed, incomplete and identity-drifted collection bundles fail closed", () => {
  const cases: Array<[string, (fixture: any) => void]> = [
    ["unknown version", (fixture) => { fixture.schemaVersion = 2; }],
    ["unknown field", (fixture) => { fixture.hiddenDefault = true; }],
    ["empty tool ID", (fixture) => { fixture.tool.id = ""; }],
    ["invalid tool digest", (fixture) => { fixture.tool.executableSha256 = "bad"; }],
    ["empty argv", (fixture) => { fixture.command.argv = []; }],
    ["missing runtime context", (fixture) => { fixture.contexts[0].contextTokens = 8_192; }],
    ["one context", (fixture) => { fixture.contexts = [fixture.contexts[0]]; }],
    ["duplicate attempt", (fixture) => {
      fixture.contexts[1].attempts[0].attemptId =
        fixture.contexts[0].attempts[0].attemptId;
    }],
    ["negative allocation", (fixture) => {
      fixture.contexts[0].attempts[0].device.modelBytes = -1;
    }],
    ["artifact drift", (fixture) => {
      fixture.candidate.artifact.sha256 = "b".repeat(64);
    }],
    ["receipt drift", (fixture) => {
      fixture.compatibilityReceipt.candidateId = "other";
    }],
    ["hardware drift", (fixture) => {
      fixture.hardwareTarget.memory.unified = true;
    }],
    ["unsupported run path", (fixture) => { fixture.runPath = "cpu-offload"; }],
  ];
  for (const [label, mutate] of cases) {
    const fixture = collectionFixture();
    mutate(fixture);
    assert.equal(validateCollectionBundle(fixture).kind, "blocked", label);
  }
});

test("same-ID content mutation is rejected by full-content binding", () => {
  const fixture = collectionFixture();
  const originalId = fixture.collectionId;
  fixture.candidate.runtime.batchSize =
    (fixture.candidate.runtime.batchSize ?? 0) + 1;
  assert.equal(fixture.collectionId, originalId);
  const result = validateCollectionBundle(fixture);
  assert.equal(result.kind, "blocked");
  if (result.kind === "blocked") {
    assert.ok(result.issues.includes("bindings.candidateContentSha256"));
  }
});

test("validation is deterministic and input-immutable", () => {
  const fixture = collectionFixture();
  const before = structuredClone(fixture);
  assert.deepEqual(
    validateCollectionBundle(fixture),
    validateCollectionBundle(fixture),
  );
  assert.deepEqual(fixture, before);
});

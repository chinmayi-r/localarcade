import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  canonicalRecordJson,
  recordContentSha256,
} from "../../lib/assessment/record-digest";

function nodeSha256(value: unknown): string {
  return createHash("sha256")
    .update(canonicalRecordJson(value), "utf8")
    .digest("hex");
}

test("canonical record JSON sorts object keys recursively and preserves arrays", () => {
  const left = {
    z: "last",
    nested: { omega: 2, alpha: 1 },
    list: [{ beta: true, alpha: false }, "tail"],
    a: "first",
  };
  const right = {
    a: "first",
    list: [{ alpha: false, beta: true }, "tail"],
    nested: { alpha: 1, omega: 2 },
    z: "last",
  };

  assert.equal(
    canonicalRecordJson(left),
    '{"a":"first","list":[{"alpha":false,"beta":true},"tail"],"nested":{"alpha":1,"omega":2},"z":"last"}',
  );
  assert.equal(canonicalRecordJson(left), canonicalRecordJson(right));
  assert.equal(recordContentSha256(left), recordContentSha256(right));
});

test("pure SHA-256 matches Node for ASCII, Unicode, and block boundaries", () => {
  const fixtures: unknown[] = [
    {},
    { message: "Local Arcade" },
    { emoji: "🌲🎮", combining: "e\u0301", scripts: "日本語 العربية" },
    { exactBlockBoundary: "x".repeat(41) },
    { multipleBlocks: "configuration-field-".repeat(20) },
    ["ordered", 0, false, null, { nested: "✓" }],
  ];

  for (const fixture of fixtures) {
    assert.equal(
      recordContentSha256(fixture),
      nodeSha256(fixture),
      canonicalRecordJson(fixture),
    );
  }
});

test("canonical record JSON follows JSON omission and array-null behavior", () => {
  assert.equal(
    canonicalRecordJson({
      retained: true,
      omitted: undefined,
      array: [undefined, Symbol("ignored"), () => "ignored"],
      finite: 7,
      nonFinite: Number.POSITIVE_INFINITY,
    }),
    '{"array":[null,null,null],"finite":7,"nonFinite":null,"retained":true}',
  );
});

test("canonical record JSON rejects unsupported top-level and cyclic values", () => {
  assert.throws(() => canonicalRecordJson(undefined), TypeError);
  assert.throws(() => canonicalRecordJson(BigInt(1)), TypeError);

  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalRecordJson(cyclic), TypeError);
});

import assert from "node:assert/strict";
import test from "node:test";
import type { DisplayValue } from "../lib/recommendation";

const valid: DisplayValue = {
  text: "12.0 GB",
  provenance: { kind: "evidence", badge: "estimated", sourceUrls: ["https://example.com/source"], note: "Test evidence." },
};

// @ts-expect-error M5: a displayed number without provenance must not compile.
const badgeLessNumber: DisplayValue = { text: "12.0 GB" };

test("evidence display values retain their typed badge and source", () => {
  assert.equal(valid.provenance.badge, "estimated");
  assert.equal(valid.provenance.sourceUrls.length, 1);
  assert.equal(badgeLessNumber.text, "12.0 GB");
});

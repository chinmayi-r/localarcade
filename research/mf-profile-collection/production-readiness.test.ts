import assert from "node:assert/strict";
import test from "node:test";
import { productionReadiness } from "./readiness";

test("production readiness passes by reporting explicit unavailability", () => {
  const result = productionReadiness();
  assert.equal(result.status, "unavailable");
  assert.equal(result.reasonCode, "fit.production-profile-unavailable");
  assert.equal(result.productionProfile, null);
  assert.equal(result.selectedPolicy, null);
  assert.ok(result.missing.includes(
    "owner decision: per-machine versus hardware-equivalence scope",
  ));
});

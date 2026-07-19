import assert from "node:assert/strict";
import test from "node:test";
import registryJson from "../registry/generated/artifacts.json";
import lifecycleGolden from "./fixtures/registry-lifecycle-golden.json";
import { assertRegistryFresh, assessRegistryFreshness, isRecommendableArtifact, REGISTRY_MAX_AGE_MS } from "../lib/registry";
import type { ArtifactRegistryRecord, RegistrySnapshot } from "../lib/registry";

const snapshot = registryJson as RegistrySnapshot;

test("a registry at the seven-day boundary is fresh and a stale registry fails", () => {
  const succeededAt = Date.parse("2026-07-19T00:00:00.000Z");
  assert.deepEqual(assessRegistryFreshness("2026-07-19T00:00:00.000Z", succeededAt + REGISTRY_MAX_AGE_MS), { fresh: true, ageMs: REGISTRY_MAX_AGE_MS });
  const stale = assessRegistryFreshness("2026-07-19T00:00:00.000Z", succeededAt + REGISTRY_MAX_AGE_MS + 1);
  assert.equal(stale.fresh, false);
  if (!stale.fresh) assert.match(stale.reason, /older than 7 days/);
  assert.throws(() => assertRegistryFresh("2026-07-19T00:00:00.000Z", succeededAt + REGISTRY_MAX_AGE_MS + 1), /older than 7 days/);
});

test("invalid and future success timestamps fail closed", () => {
  assert.equal(assessRegistryFreshness("invalid", Date.now()).fresh, false);
  assert.equal(assessRegistryFreshness("2026-07-20T00:00:00.000Z", Date.parse("2026-07-19T00:00:00.000Z")).fresh, false);
});

test("triage lifecycle golden excludes new artifacts from recommendations", () => {
  const artifact = snapshot.artifacts[0];
  for (const [status, expected] of Object.entries(lifecycleGolden)) {
    assert.equal(isRecommendableArtifact({ ...artifact, status } as ArtifactRegistryRecord), expected.recommendable, status);
  }
});

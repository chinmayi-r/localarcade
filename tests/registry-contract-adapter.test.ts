import assert from "node:assert/strict";
import test from "node:test";
import candidateFixture from "../docs/contracts/fixtures/exact-configuration-candidate.ok.json";
import registryJson from "../registry/generated/artifacts.json";
import { toRegistryArtifactIdentity, toRegistryArtifactSnapshot } from "../lib/registry";
import { validateContract } from "../lib/contracts";
import type { ContractEnvelope } from "../lib/contracts";
import type { RegistrySnapshot } from "../lib/registry";

const snapshot = registryJson as RegistrySnapshot;
const artifact = snapshot.artifacts[0];
const freshNow = Date.parse(snapshot.lastIngestSucceededAt) + 1_000;

test("M-C maps every immutable artifact identity field without manufacturing runtime identity", () => {
  const mapped = toRegistryArtifactIdentity(artifact);
  assert.equal(mapped.kind, "ok");
  if (mapped.kind !== "ok") return;

  assert.deepEqual(mapped.value.artifact, {
    artifactId: artifact.id,
    repository: `${artifact.publisher}/${artifact.repository}`,
    revision: artifact.revision,
    filename: artifact.fileName,
    sha256: artifact.sha256,
    bytes: artifact.fileSizeBytes,
    format: artifact.format,
    quantization: artifact.quantization,
    license: artifact.license.id,
    status: "promoted",
  });
  assert.deepEqual(mapped.value.modelFamily, { modelFamilyId: artifact.family, displayName: artifact.model });
  assert.deepEqual(mapped.value.registryMetadata.fieldProvenance, artifact.provenance);
  assert.equal(mapped.value.provenance.length, 15);
  assert.deepEqual(new Set(mapped.value.provenance.map((item) => item.rawSourceRecordRef?.split("#")[1])).size, 15);
  assert.ok(mapped.value.provenance.every((item) => item.method === "imported" && item.measurement === null));
  assert.equal("runtime" in mapped.value, false);

  const envelope = structuredClone(candidateFixture) as unknown as ContractEnvelope;
  assert.equal(envelope.status, "ok");
  assert.equal(envelope.contract, "exact-configuration-candidate");
  if (envelope.status !== "ok" || envelope.contract !== "exact-configuration-candidate") return;
  envelope.data.modelFamily = mapped.value.modelFamily;
  envelope.data.artifact = mapped.value.artifact;
  envelope.data.provenance = mapped.value.provenance;
  envelope.provenance = mapped.value.provenance;
  assert.deepEqual(validateContract(envelope), { ok: true, value: envelope });
});

test("M-C blocks lifecycle promotion and contract-incompatible serialization", () => {
  const triage = toRegistryArtifactIdentity({ ...artifact, status: "triage" });
  assert.equal(triage.kind, "blocked");
  if (triage.kind === "blocked") assert.equal(triage.reasonCode, "registry.artifact-not-promoted");

  const uppercaseHash = toRegistryArtifactIdentity({ ...artifact, sha256: artifact.sha256.toUpperCase() });
  assert.equal(uppercaseHash.kind, "blocked");
  if (uppercaseHash.kind === "blocked") {
    assert.equal(uppercaseHash.reasonCode, "registry.artifact-contract-incompatible");
    assert.match(uppercaseHash.missing.join(" "), /lowercase SHA-256/);
  }
});

test("M-C snapshot boundary preserves freshness, lifecycle, quarantine, order and source identity", () => {
  const triageArtifact = { ...snapshot.artifacts[1], id: `${snapshot.artifacts[1].id}-triage`, status: "triage" as const };
  const quarantine = {
    repository: "example/quarantined",
    revision: "a".repeat(40),
    code: "missing-license" as const,
    reason: "License was absent.",
    sourceUrl: "https://example.invalid/quarantined",
    recordedAt: snapshot.generatedAt,
  };
  const source: RegistrySnapshot = { ...snapshot, artifacts: [artifact, triageArtifact], quarantine: [quarantine] };
  const before = JSON.stringify(source);
  const mapped = toRegistryArtifactSnapshot(source, freshNow);
  assert.equal(mapped.kind, "ok");
  if (mapped.kind !== "ok") return;

  assert.deepEqual(mapped.value.artifacts.map((item) => item.artifact.artifactId), [artifact.id]);
  assert.deepEqual(mapped.value.lifecycle, { promotedArtifactIds: [artifact.id], triageArtifactIds: [triageArtifact.id] });
  assert.deepEqual(mapped.value.quarantine, [quarantine]);
  assert.equal(mapped.value.snapshotId, source.snapshotId);
  assert.equal(JSON.stringify(source), before);
});

test("M-C snapshot boundary fails closed for stale and invalid snapshots", () => {
  const stale = toRegistryArtifactSnapshot(snapshot, Date.parse(snapshot.lastIngestSucceededAt) + 8 * 24 * 60 * 60 * 1_000);
  assert.equal(stale.kind, "blocked");
  if (stale.kind === "blocked") assert.equal(stale.reasonCode, "registry.snapshot-not-fresh");

  const invalid = toRegistryArtifactSnapshot({ ...snapshot, schemaVersion: 5 } as unknown as RegistrySnapshot, freshNow);
  assert.equal(invalid.kind, "blocked");
  if (invalid.kind === "blocked") assert.equal(invalid.reasonCode, "registry.snapshot-invalid");
});

test("the generated promoted registry maps completely and deterministically", () => {
  const first = toRegistryArtifactSnapshot(snapshot, freshNow);
  const second = toRegistryArtifactSnapshot(snapshot, freshNow);
  assert.deepEqual(first, second);
  assert.equal(first.kind, "ok");
  if (first.kind === "ok") assert.equal(first.value.artifacts.length, snapshot.artifacts.length);
});

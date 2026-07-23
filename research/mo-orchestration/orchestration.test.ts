import assert from "node:assert/strict";
import test from "node:test";
import hardwareFixture from "../../docs/contracts/fixtures/hardware-target.ok.json";
import {
  handoffContentHash,
  runnerImportBundleContentHash,
  validateContract,
} from "../../lib/contracts";
import type { TypedEnvelope } from "../../lib/contracts";
import {
  createRunnerImportBundle,
  createRunnerHandoff,
  findConfigurations,
  getExactConfigurationDetail,
} from "../../lib/orchestrator";
import type {
  CandidateUniversePortResult,
  FinderUseCaseInput,
} from "../../lib/orchestrator";
import {
  candidateEntry,
  portfolioInput,
} from "../mh-portfolio/fixtures";

function completeInput(): FinderUseCaseInput {
  const candidates = portfolioInput([
    candidateEntry({
      id: "qwen-q4",
      artifactId: "artifact-qwen-q4",
      family: "qwen",
      position: 0,
    }),
    candidateEntry({
      id: "qwen-q5",
      artifactId: "artifact-qwen-q5",
      family: "qwen",
      position: 1,
    }),
    candidateEntry({
      id: "gemma-q4",
      artifactId: "artifact-gemma-q4",
      family: "gemma",
      position: 2,
    }),
  ]);
  return {
    request: candidates.request,
    hardware: structuredClone(hardwareFixture) as TypedEnvelope<"hardware-target">,
    policy: candidates.policy,
  };
}

function availableUniverse(): CandidateUniversePortResult {
  return {
    status: "ok",
    universe: portfolioInput([
      candidateEntry({
        id: "qwen-q4",
        artifactId: "artifact-qwen-q4",
        family: "qwen",
        position: 0,
      }),
      candidateEntry({
        id: "qwen-q5",
        artifactId: "artifact-qwen-q5",
        family: "qwen",
        position: 1,
      }),
      candidateEntry({
        id: "gemma-q4",
        artifactId: "artifact-gemma-q4",
        family: "gemma",
        position: 2,
      }),
    ]).universe,
  };
}

test("U27 unavailable is propagated without calling M-H or manufacturing data", async () => {
  const unavailable: CandidateUniversePortResult = {
    status: "unavailable",
    reasonCode: "fit.production-profile-unavailable",
    message: "No reviewed production fit profile and policy are admitted.",
    recoverableActions: ["Review and approve a measured profile policy."],
    provenance: [],
    warnings: ["Synthetic profiles are not production data."],
  };
  const session = await findConfigurations(completeInput(), {
    loadCandidateUniverse: () => unavailable,
  });
  assert.equal(session.portfolio.status, "unavailable");
  assert.equal(session.portfolio.reasonCode, unavailable.reasonCode);
  assert.deepEqual(session.portfolio.recoverableActions, unavailable.recoverableActions);
  assert.deepEqual(session.portfolio.warnings, unavailable.warnings);
  assert.equal(session.universe, null);
  assert.deepEqual(session.ledger, []);
});

test("blocked and error port states are never promoted", async () => {
  for (const status of ["blocked", "error"] as const) {
    const session = await findConfigurations(completeInput(), {
      loadCandidateUniverse: () => ({
        status,
        reasonCode: `fixture.${status}`,
        message: `${status} fixture`,
        recoverableActions: [],
        provenance: [],
        warnings: [],
      }),
    });
    assert.equal(session.portfolio.status, status);
    assert.equal(session.portfolio.reasonCode, `fixture.${status}`);
  }
});

test("matching hardware and request reach M-H through immediate plain-DTO admission", async () => {
  let calls = 0;
  const session = await findConfigurations(completeInput(), {
    loadCandidateUniverse: (request, hardware) => {
      calls += 1;
      assert.equal(request.data.hardwareTargetId, hardware.data.hardwareTargetId);
      return availableUniverse();
    },
  });
  assert.equal(calls, 1);
  assert.ok(session.portfolio.status === "ok" || session.portfolio.status === "partial");
  assert.equal(session.portfolio.data.outcome, "unranked-compatible");
  assert.equal(session.portfolio.data.items.length, 2);
  assert.equal(session.ledger.length, 3);
  assert.ok(session.universe);
});

test("mismatched finder identity blocks before the universe port", async () => {
  const input = completeInput();
  input.request.data.hardwareTargetId = "other-hardware";
  let calls = 0;
  const session = await findConfigurations(input, {
    loadCandidateUniverse: () => {
      calls += 1;
      return availableUniverse();
    },
  });
  assert.equal(calls, 0);
  assert.equal(session.portfolio.status, "blocked");
  assert.equal(session.portfolio.reasonCode, "orchestrator.finder-input-invalid");
});

test("non-plain provider data and thrown ports fail closed", async () => {
  let session = await findConfigurations(completeInput(), {
    loadCandidateUniverse: () => {
      throw new Error("port failed");
    },
  });
  assert.equal(session.portfolio.status, "error");
  assert.equal(
    session.portfolio.reasonCode,
    "orchestrator.candidate-universe-port-failed",
  );

  const hostile = Object.create(null) as CandidateUniversePortResult;
  session = await findConfigurations(completeInput(), {
    loadCandidateUniverse: () => hostile,
  });
  assert.equal(session.portfolio.status, "error");
  assert.equal(
    session.portfolio.reasonCode,
    "orchestrator.candidate-universe-port-invalid",
  );

  const reflectionProxy = new Proxy({}, {
    getPrototypeOf(): never {
      throw new Error("hostile reflection");
    },
  });
  session = await findConfigurations(completeInput(), {
    loadCandidateUniverse: () =>
      reflectionProxy as unknown as CandidateUniversePortResult,
  });
  assert.equal(session.portfolio.status, "error");

  session = await findConfigurations(completeInput(), {
    loadCandidateUniverse: () => ({
      status: "partial",
      reasonCode: 7,
    }) as unknown as CandidateUniversePortResult,
  });
  assert.equal(session.portfolio.status, "error");
  assert.equal(
    session.portfolio.reasonCode,
    "orchestrator.candidate-universe-port-invalid",
  );
});

test("exact detail binds the selected candidate and exposes same-family quantization alternatives", async () => {
  const session = await findConfigurations(completeInput(), {
    loadCandidateUniverse: () => availableUniverse(),
  });
  assert.ok(session.portfolio.status === "ok" || session.portfolio.status === "partial");
  const selected = session.portfolio.data.items.find((item) =>
    item.modelFamilyId === "qwen");
  assert.ok(selected);
  const detail = getExactConfigurationDetail(session, selected.candidateId);
  assert.ok(detail.status === "ok" || detail.status === "partial");
  assert.equal(detail.data.candidate.data.candidateId, selected.candidateId);
  assert.equal(detail.data.assessment.data.assessmentId, selected.assessmentId);
  assert.equal(detail.data.alternatives.length, 1);
  assert.notEqual(detail.data.alternatives[0].candidateId, selected.candidateId);
});

test("detail rejects a candidate that was not selected", async () => {
  const session = await findConfigurations(completeInput(), {
    loadCandidateUniverse: () => availableUniverse(),
  });
  const detail = getExactConfigurationDetail(session, "not-selected");
  assert.equal(detail.status, "blocked");
  assert.equal(detail.reasonCode, "orchestrator.candidate-not-selected");
});

test("finder sessions and exact details cannot be copied, mutated or forged", async () => {
  const input = completeInput();
  const session = await findConfigurations(input, {
    loadCandidateUniverse: () => availableUniverse(),
  });
  assert.ok(session.portfolio.status === "ok" || session.portfolio.status === "partial");
  assert.throws(() => {
    const entry = session.universe?.entries[0];
    if (entry?.kind === "candidate") entry.candidate.artifact.sha256 = "f".repeat(64);
  });

  const copiedSession = structuredClone(session);
  const selected = session.portfolio.data.items[0];
  let detail = getExactConfigurationDetail(copiedSession, selected.candidateId);
  assert.equal(detail.status, "blocked");
  assert.equal(detail.reasonCode, "orchestrator.finder-session-invalid");

  detail = getExactConfigurationDetail(session, selected.candidateId);
  assert.ok(detail.status === "ok" || detail.status === "partial");
  const forged = structuredClone(detail);
  if (forged.status === "ok" || forged.status === "partial") {
    forged.data.candidate.data.candidateId = "forged-candidate";
    forged.data.assessment.data.candidateId = "forged-candidate";
  }
  const handoff = createRunnerHandoff({
    handoffId: "handoff-forged",
    now: "2026-07-23T12:00:00.000Z",
    hardware: input.hardware,
    request: input.request,
    detail: forged,
  });
  assert.equal(handoff.status, "blocked");
  assert.equal(handoff.reasonCode, "orchestrator.detail-integrity-invalid");
});

test("handoff binds the full finder request and hardware snapshots, not IDs alone", async () => {
  const input = completeInput();
  const session = await findConfigurations(input, {
    loadCandidateUniverse: () => availableUniverse(),
  });
  assert.ok(session.portfolio.status === "ok" || session.portfolio.status === "partial");
  const detail = getExactConfigurationDetail(
    session,
    session.portfolio.data.items[0].candidateId,
  );

  const changedRequest = structuredClone(input.request);
  changedRequest.data.task.family = "writing";
  let handoff = createRunnerHandoff({
    handoffId: "handoff-changed-request",
    now: "2026-07-23T12:00:00.000Z",
    hardware: input.hardware,
    request: changedRequest,
    detail,
  });
  assert.equal(handoff.status, "blocked");
  assert.equal(handoff.reasonCode, "orchestrator.handoff-snapshot-mismatch");

  const changedHardware = structuredClone(input.hardware);
  changedHardware.data.memory.totalRamBytes += 1;
  handoff = createRunnerHandoff({
    handoffId: "handoff-changed-hardware",
    now: "2026-07-23T12:00:00.000Z",
    hardware: changedHardware,
    request: input.request,
    detail,
  });
  assert.equal(handoff.status, "blocked");
  assert.equal(handoff.reasonCode, "orchestrator.handoff-snapshot-mismatch");
});

test("every public M-O use case contains hostile reflection and null inputs", async () => {
  const hostile = new Proxy({}, {
    getPrototypeOf(): never {
      throw new Error("hostile reflection");
    },
  });
  assert.doesNotThrow(() =>
    getExactConfigurationDetail(
      hostile as unknown as Awaited<ReturnType<typeof findConfigurations>>,
      "candidate",
    ));
  const detail = getExactConfigurationDetail(
    hostile as unknown as Awaited<ReturnType<typeof findConfigurations>>,
    "candidate",
  );
  assert.equal(detail.status, "error");

  assert.doesNotThrow(() =>
    createRunnerHandoff(hostile as unknown as Parameters<typeof createRunnerHandoff>[0]));
  let handoff = createRunnerHandoff(
    hostile as unknown as Parameters<typeof createRunnerHandoff>[0],
  );
  assert.equal(handoff.status, "error");

  const input = completeInput();
  handoff = createRunnerHandoff({
    handoffId: "handoff-null",
    now: "2026-07-23T12:00:00.000Z",
    hardware: input.hardware,
    request: input.request,
    detail: null as unknown as Parameters<typeof createRunnerHandoff>[0]["detail"],
  });
  assert.equal(handoff.status, "error");

  for (const malformed of [
    {
      status: "wat",
      reasonCode: 7,
      message: null,
      recoverableActions: null,
      provenance: null,
      warnings: null,
    },
    {
      status: "blocked",
      reasonCode: 7,
      message: null,
      recoverableActions: null,
      provenance: null,
      warnings: null,
    },
  ]) {
    handoff = createRunnerHandoff({
      handoffId: "handoff-malformed-detail",
      now: "2026-07-23T12:00:00.000Z",
      hardware: input.hardware,
      request: input.request,
      detail: malformed as unknown as Parameters<
        typeof createRunnerHandoff
      >[0]["detail"],
    });
    assert.equal(handoff.status, "error");
    assert.ok(validateContract(handoff).ok);
  }
});

test("partial assessment recovery metadata survives detail and handoff unchanged", async () => {
  const input = completeInput();
  const partialUniverse = portfolioInput([
    candidateEntry({
      id: "partial-candidate",
      artifactId: "artifact-partial",
      family: "partial-family",
      position: 0,
      partialMissing: ["performance.generationTokensPerSecond"],
    }),
  ]).universe;
  const session = await findConfigurations(input, {
    loadCandidateUniverse: () => ({ status: "ok", universe: partialUniverse }),
  });
  assert.ok(session.portfolio.status === "ok" || session.portfolio.status === "partial");
  const detail = getExactConfigurationDetail(
    session,
    session.portfolio.data.items[0].candidateId,
  );
  assert.equal(detail.status, "partial");
  const expectedActions = [...detail.recoverableActions];
  const handoff = createRunnerHandoff({
    handoffId: "handoff-partial",
    now: "2026-07-23T12:00:00.000Z",
    hardware: input.hardware,
    request: input.request,
    detail,
  });
  assert.equal(handoff.status, "partial");
  assert.deepEqual(handoff.completeness.recoverableActions, expectedActions);
});

test("handoff creation requires canonical UTC time and contains date overflow", async () => {
  const input = completeInput();
  const session = await findConfigurations(input, {
    loadCandidateUniverse: () => availableUniverse(),
  });
  assert.ok(session.portfolio.status === "ok" || session.portfolio.status === "partial");
  const detail = getExactConfigurationDetail(
    session,
    session.portfolio.data.items[0].candidateId,
  );
  for (const now of ["July 23 2026", "9999-12-31T23:59:59.999Z"]) {
    assert.doesNotThrow(() => createRunnerHandoff({
      handoffId: "handoff-bad-time",
      now,
      hardware: input.hardware,
      request: input.request,
      detail,
    }));
    const handoff = createRunnerHandoff({
      handoffId: "handoff-bad-time",
      now,
      hardware: input.hardware,
      request: input.request,
      detail,
    });
    assert.equal(handoff.status, "blocked");
  }
});

test("current approved handoff is canonical, non-authorizing and exactly 24 hours", async () => {
  const input = completeInput();
  const session = await findConfigurations(input, {
    loadCandidateUniverse: () => availableUniverse(),
  });
  assert.ok(session.portfolio.status === "ok" || session.portfolio.status === "partial");
  const selected = session.portfolio.data.items[0];
  const detail = getExactConfigurationDetail(session, selected.candidateId);
  const handoff = createRunnerHandoff({
    handoffId: "handoff-mo-proof",
    now: "2026-07-23T12:00:00.000Z",
    hardware: input.hardware,
    request: input.request,
    detail,
  });
  assert.ok(handoff.status === "ok" || handoff.status === "partial");
  assert.ok(validateContract(handoff).ok);
  assert.equal(handoff.data.containsModelData, false);
  assert.equal(handoff.data.sideEffectAuthorization, false);
  assert.equal(
    Date.parse(handoff.data.expiresAt) - Date.parse(handoff.data.createdAt),
    24 * 60 * 60 * 1_000,
  );
  assert.equal(handoffContentHash(handoff.data), handoff.data.contentHash);
});

test("handoff binding drift blocks rather than reconstructing identity", async () => {
  const input = completeInput();
  const session = await findConfigurations(input, {
    loadCandidateUniverse: () => availableUniverse(),
  });
  assert.ok(session.portfolio.status === "ok" || session.portfolio.status === "partial");
  const detail = getExactConfigurationDetail(
    session,
    session.portfolio.data.items[0].candidateId,
  );
  input.request.data.requestId = "different-request";
  const handoff = createRunnerHandoff({
    handoffId: "handoff-drift",
    now: "2026-07-23T12:00:00.000Z",
    hardware: input.hardware,
    request: input.request,
    detail,
  });
  assert.equal(handoff.status, "blocked");
  assert.equal(handoff.reasonCode, "orchestrator.handoff-snapshot-mismatch");
});

test("portable runner bundle binds the unchanged v1 handoff to its admission receipt", async () => {
  const input = completeInput();
  const session = await findConfigurations(input, {
    loadCandidateUniverse: () => availableUniverse(),
  });
  assert.ok(session.portfolio.status === "ok" || session.portfolio.status === "partial");
  const detail = getExactConfigurationDetail(
    session,
    session.portfolio.data.items[0].candidateId,
  );
  const handoff = createRunnerHandoff({
    handoffId: "handoff-bundle-proof",
    now: "2026-07-23T12:00:00.000Z",
    hardware: input.hardware,
    request: input.request,
    detail,
  });
  const bundle = createRunnerImportBundle(handoff, detail);
  assert.ok(handoff.status === "ok" || handoff.status === "partial");
  assert.ok(bundle.status === "ok" || bundle.status === "partial");
  assert.ok(validateContract(bundle).ok);
  assert.equal(bundle.data.importBundleVersion, 1);
  assert.deepEqual(bundle.data.handoff, handoff.data);
  assert.deepEqual(
    bundle.data.compatibilityAdmission,
    detail.status === "ok" || detail.status === "partial"
      ? detail.data.compatibilityAdmission
      : null,
  );
  assert.equal(
    runnerImportBundleContentHash(bundle.data),
    bundle.data.contentHash,
  );
  assert.equal(bundle.data.handoff.sideEffectAuthorization, false);
});

test("bundle creation rejects handoff/detail binding drift and copied detail state", async () => {
  const input = completeInput();
  const session = await findConfigurations(input, {
    loadCandidateUniverse: () => availableUniverse(),
  });
  assert.ok(session.portfolio.status === "ok" || session.portfolio.status === "partial");
  const detail = getExactConfigurationDetail(
    session,
    session.portfolio.data.items[0].candidateId,
  );
  const copiedDetail = structuredClone(detail);
  const handoff = createRunnerHandoff({
    handoffId: "handoff-bundle-copy",
    now: "2026-07-23T12:00:00.000Z",
    hardware: input.hardware,
    request: input.request,
    detail,
  });
  let bundle = createRunnerImportBundle(handoff, copiedDetail);
  assert.equal(bundle.status, "blocked");
  assert.equal(bundle.reasonCode, "orchestrator.import-bundle-input-invalid");

  assert.ok(handoff.status === "ok" || handoff.status === "partial");
  const copiedHandoff = structuredClone(handoff);
  bundle = createRunnerImportBundle(copiedHandoff, detail);
  assert.equal(bundle.status, "blocked");
  assert.equal(bundle.reasonCode, "orchestrator.import-bundle-input-invalid");
});

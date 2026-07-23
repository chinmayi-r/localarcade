import assert from "node:assert/strict";
import test from "node:test";
import legacyProfiles from "../../registry/evidence/fit-profiles.json";
import {
  admitCapacityPolicy,
  admitFitProfile,
  assessFitEvidence,
} from "../../lib/assessment";
import { validateContract } from "../../lib/contracts";
import { recordContentSha256 } from "../../lib/assessment/record-digest";
import {
  completePolicyAdmissionInput,
  completeProfileAdmissionInput,
} from "./fixtures";

function assertBlocked(
  result: ReturnType<typeof admitFitProfile> | ReturnType<typeof admitCapacityPolicy>,
): asserts result is Extract<typeof result, { kind: "blocked" }> {
  assert.equal(result.kind, "blocked");
  if (result.kind === "blocked") {
    assert.ok(result.reasonCode.trim().length > 0);
    assert.ok(result.message.trim().length > 0);
  }
}

test("complete synthetic records admit typed profile and policy values that feed M-F", () => {
  const profileInput = completeProfileAdmissionInput();
  const policyInput = completePolicyAdmissionInput();
  const profile = admitFitProfile(profileInput);
  const policy = admitCapacityPolicy(policyInput);
  assert.equal(profile.kind, "ok");
  assert.equal(policy.kind, "ok");
  if (profile.kind !== "ok" || policy.kind !== "ok") return;

  assert.deepEqual(profile.value.binding, {
    candidateId: profileInput.candidate.candidateId,
    artifactSha256: profileInput.candidate.artifact.sha256,
    acceleratorId: profileInput.hardwareTarget.accelerators[0].acceleratorId,
    hardwareTargetId: profileInput.hardwareTarget.hardwareTargetId,
    runtime: profileInput.candidate.runtime,
  });
  assert.deepEqual(policy.value.binding, policyInput.record.binding);

  const envelope = assessFitEvidence({
    assessmentId: "assessment-admitted-profile",
    candidate: profileInput.candidate,
    compatibilityReceipt: profileInput.compatibilityReceipt,
    hardwareTarget: profileInput.hardwareTarget,
    desiredContextTokens: profileInput.candidate.runtime.contextTokens,
    fitProfile: profile.value,
    fitPolicy: policy.value,
    evidence: { throughput: null, records: [] },
    upstreamAdvisory: null,
  });
  const validation = validateContract(envelope);
  assert.equal(
    validation.ok,
    true,
    validation.ok ? undefined : validation.errors.join("\n"),
  );
  assert.equal(envelope.status, "partial");
  if (envelope.status === "partial") {
    assert.equal(envelope.data.fit, "good");
    assert.equal(envelope.data.runPath, "gpu");
  }
});

test("the checked legacy registry profile is rejected with exact missing source-scope fields", () => {
  const input = completeProfileAdmissionInput();
  input.record = legacyProfiles.profiles[0] as unknown as typeof input.record;
  const result = admitFitProfile(input);
  assertBlocked(result);
  assert.equal(result.reasonCode, "fit-profile.incomplete");
  assert.deepEqual(result.missing, [
    "schemaVersion",
    "profileId",
    "profileVersion",
    "scope",
    "mode",
    "runPath",
    "allocation",
    "sourceEvidence",
    "provenance",
    "scope.candidateId",
    "scope.artifactSha256",
    "scope.hardwareTargetId",
    "scope.acceleratorId",
    "scope.runtime",
    "scope.runtime.runtimeConfigurationId",
    "scope.runtime.product",
    "scope.runtime.engine",
    "scope.runtime.engineBuild",
    "scope.runtime.backend",
    "scope.runtime.chatTemplate",
    "scope.runtime.contextTokens",
    "scope.runtime.kvCache",
    "scope.runtime.gpuLayers",
    "scope.runtime.batchSize",
    "scope.runtime.microBatchSize",
    "scope.runtime.parallelism",
    "scope.runtime.threads",
    "scope.runtime.flashAttention",
    "scope.runtime.mmap",
    "scope.runtime.sampler",
    "scope.runtime.additionalFlags",
    "scope.runtime.kvCache.key",
    "scope.runtime.kvCache.value",
    "scope.runtime.sampler.temperature",
    "scope.runtime.sampler.topP",
    "scope.runtime.sampler.topK",
    "scope.runtime.sampler.minP",
    "scope.runtime.sampler.seed",
    "sourceEvidence.tool",
    "sourceEvidence.command",
    "sourceEvidence.observations",
  ]);
});

test("complete-looking records outside the injected reviewed manifest stay blocked", () => {
  const profile = completeProfileAdmissionInput();
  profile.record.profileId = "attacker-profile";
  profile.record.allocation.id = "attacker-profile";
  const profileResult = admitFitProfile(profile);
  assertBlocked(profileResult);
  assert.equal(profileResult.reasonCode, "fit-profile.untrusted-source");

  const policy = completePolicyAdmissionInput();
  policy.record.policyId = "attacker-policy";
  policy.record.policyVersion = "999";
  policy.record.safetyMarginBps = 9_999;
  const policyResult = admitCapacityPolicy(policy);
  assertBlocked(policyResult);
  assert.equal(policyResult.reasonCode, "fit-policy.untrusted-source");
});

test("review locks cannot make unknown fields or unsupported observations valid", () => {
  const cases: Array<(input: ReturnType<typeof completeProfileAdmissionInput>) => void> = [
    (input) => { (input.record as any).unknown = true; },
    (input) => { (input.record.scope.runtime as any).unknown = true; },
    (input) => { input.record.sourceEvidence.command = ""; },
    (input) => { input.record.sourceEvidence.tool.id = ""; },
    (input) => { input.record.sourceEvidence.tool.executableSha256 = "invalid"; },
    (input) => { input.record.sourceEvidence.observations = []; },
    (input) => { input.record.sourceEvidence.observations[0]!.device!.contextBytes += 1; },
    (input) => { input.record.sourceEvidence.observations[0]!.host.computeBytes += 1; },
    (input) => { input.record.sourceEvidence.observations[1]!.contextTokens = 4_096; },
    (input) => { input.record.allocation.maxContextTokens = 32_768; },
    (input) => {
      input.record.sourceEvidence.observations =
        [input.record.sourceEvidence.observations[1]!];
    },
    (input) => {
      input.record.sourceEvidence.observations =
        [input.record.sourceEvidence.observations[0]!];
      input.record.allocation.maxContextTokens = 4_096;
    },
  ];
  for (const mutate of cases) {
    const input = completeProfileAdmissionInput();
    mutate(input);
    refreshManifest(input);
    const result = admitFitProfile(input);
    assertBlocked(result);
    assert.notEqual(result.reasonCode, "fit-profile.untrusted-source");
  }
});

test("policy approval and reviewed-manifest status are enforced separately", () => {
  for (const mutate of [
    (input: ReturnType<typeof completePolicyAdmissionInput>) => {
      input.record.approval.decisionId = "";
    },
    (input: ReturnType<typeof completePolicyAdmissionInput>) => {
      input.record.approval.approvedAt = "not-a-timestamp";
    },
    (input: ReturnType<typeof completePolicyAdmissionInput>) => {
      input.record.approval.approvedBy = "";
    },
    (input: ReturnType<typeof completePolicyAdmissionInput>) => {
      (input.record as any).unknown = true;
    },
  ]) {
    const input = completePolicyAdmissionInput();
    mutate(input);
    refreshManifest(input);
    const result = admitCapacityPolicy(input);
    assertBlocked(result);
    assert.notEqual(result.reasonCode, "fit-policy.untrusted-source");
  }

  const wrongStatus = completePolicyAdmissionInput();
  (wrongStatus.reviewedManifest.entries[0] as any).status = "reviewed";
  const statusResult = admitCapacityPolicy(wrongStatus);
  assertBlocked(statusResult);
  assert.equal(statusResult.reasonCode, "fit-policy.untrusted-source");
});

test("artifact and compatibility-receipt mutations cannot admit a profile", () => {
  const candidateArtifactMutations: Array<(input: any) => void> = [
    (input) => { input.candidate.artifact.artifactId = ""; },
    (input) => { input.candidate.artifact.repository = ""; },
    (input) => { input.candidate.artifact.revision = ""; },
    (input) => { input.candidate.artifact.filename = ""; },
    (input) => { input.candidate.artifact.sha256 = "b".repeat(64); },
    (input) => { input.candidate.artifact.bytes = 0; },
    (input) => { input.candidate.artifact.format = ""; },
    (input) => { input.candidate.artifact.quantization = ""; },
    (input) => { input.candidate.artifact.license = ""; },
    (input) => { input.candidate.artifact.status = "triage"; },
    (input) => { input.compatibilityReceipt.candidateId = "different"; },
    (input) => { input.compatibilityReceipt.artifactSha256 = "b".repeat(64); },
    (input) => { input.compatibilityReceipt.runtimeConfigurationId = "different"; },
    (input) => { input.record.scope.artifactSha256 = "b".repeat(64); },
  ];
  for (const mutate of candidateArtifactMutations) {
    const input = completeProfileAdmissionInput();
    mutate(input);
    assertBlocked(admitFitProfile(input));
  }
});

test("every exact runtime field is part of profile admission identity", () => {
  const mutations: Array<(runtime: any) => void> = [
    (runtime) => { runtime.runtimeConfigurationId = "different"; },
    (runtime) => { runtime.product = "ollama"; },
    (runtime) => { runtime.engine = "different"; },
    (runtime) => { runtime.engineBuild = "different"; },
    (runtime) => { runtime.backend = "cpu"; },
    (runtime) => { runtime.chatTemplate = "different"; },
    (runtime) => { runtime.contextTokens += 1; },
    (runtime) => { runtime.kvCache.key = "q8_0"; },
    (runtime) => { runtime.kvCache.value = "q8_0"; },
    (runtime) => { runtime.gpuLayers = 1; },
    (runtime) => { runtime.batchSize = 1; },
    (runtime) => { runtime.microBatchSize = 1; },
    (runtime) => { runtime.parallelism = 2; },
    (runtime) => { runtime.threads = 1; },
    (runtime) => { runtime.flashAttention = false; },
    (runtime) => { runtime.mmap = false; },
    (runtime) => { runtime.sampler.temperature = 0.5; },
    (runtime) => { runtime.sampler.topP = 0.9; },
    (runtime) => { runtime.sampler.topK = 40; },
    (runtime) => { runtime.sampler.minP = 0.1; },
    (runtime) => { runtime.sampler.seed = 42; },
    (runtime) => { runtime.additionalFlags = [{ name: "different", value: null }]; },
  ];
  for (const mutate of mutations) {
    const input = completeProfileAdmissionInput();
    mutate(input.record.scope.runtime);
    assertBlocked(admitFitProfile(input));
  }
});

test("hardware scope, run path, arithmetic and provenance fail closed", () => {
  const mutations: Array<(input: any) => void> = [
    (input) => { input.record.scope.hardwareTargetId = "different"; },
    (input) => { input.record.scope.acceleratorId = "different"; },
    (input) => { input.hardwareTarget.hardwareTargetId = "different"; },
    (input) => { input.hardwareTarget.accelerators[0].acceleratorId = "different"; },
    (input) => { input.record.runPath = "cpu"; },
    (input) => { input.record.mode = "host"; },
    (input) => { input.record.allocation.id = ""; },
    (input) => { input.record.allocation.maxContextTokens = 0; },
    (input) => { input.record.allocation.device.modelBytes = -1; },
    (input) => { input.record.allocation.device.computeFixedBytes = -1; },
    (input) => { input.record.allocation.device.contextBytesAtReference = -1; },
    (input) => { input.record.allocation.device.computeContextBytesAtReference = -1; },
    (input) => { input.record.allocation.device.referenceContextTokens = 0; },
    (input) => { input.record.allocation.host.modelBytes = -1; },
    (input) => { input.record.allocation.host.computeFixedBytes = -1; },
    (input) => { input.record.allocation.host.contextBytesAtReference = -1; },
    (input) => { input.record.allocation.host.computeContextBytesAtReference = -1; },
    (input) => { input.record.allocation.host.referenceContextTokens = 0; },
    (input) => { input.record.provenance = []; },
    (input) => { input.record.provenance[0].source.id = ""; },
    (input) => { input.record.provenance[0].source.url = null; input.record.provenance[0].rawSourceRecordRef = null; },
    (input) => { input.record.provenance[0].method = "preference"; },
    (input) => { input.record.provenance[0].hardwareMatch = "coarse-bucket"; },
    (input) => { input.record.provenance[0].configurationMatch = "family-proxy"; },
  ];
  for (const mutate of mutations) {
    const input = completeProfileAdmissionInput();
    mutate(input);
    assertBlocked(admitFitProfile(input));
  }
});

test("capacity policy identity, bindings, arithmetic and provenance fail closed", () => {
  const mutations: Array<(input: any) => void> = [
    (input) => { input.record.schemaVersion = 2; },
    (input) => { input.record.policyId = ""; },
    (input) => { input.record.policyVersion = ""; },
    (input) => { input.record.binding.hardwareTargetId = "different"; },
    (input) => { input.record.binding.operatingSystem = "linux"; },
    (input) => { input.record.binding.runPath = "cpu"; },
    (input) => { input.record.basis = "other"; },
    (input) => { input.record.deviceReserveBytes = -1; },
    (input) => { input.record.hostReserveBytes = -1; },
    (input) => { input.record.safetyMarginBps = -1; },
    (input) => { input.record.safetyMarginBps = 10_001; },
    (input) => { input.record.safetyMarginBps = 1.5; },
    (input) => { input.record.tightHeadroomBps = 1; },
    (input) => { input.record.provenance = []; },
    (input) => { input.record.provenance[0].source.id = ""; },
    (input) => { input.record.provenance[0].method = "preference"; },
    (input) => { input.hardwareTarget.hardwareTargetId = "different"; },
    (input) => { input.hardwareTarget.os.family = "linux"; },
    (input) => { input.runPath = "cpu"; },
  ];
  for (const mutate of mutations) {
    const input = completePolicyAdmissionInput();
    mutate(input);
    assertBlocked(admitCapacityPolicy(input));
  }
});

test("admission is deterministic and does not mutate raw records", () => {
  const profile = completeProfileAdmissionInput();
  const profileBefore = structuredClone(profile);
  assert.deepEqual(admitFitProfile(profile), admitFitProfile(profile));
  assert.deepEqual(profile, profileBefore);

  const policy = completePolicyAdmissionInput();
  const policyBefore = structuredClone(policy);
  assert.deepEqual(admitCapacityPolicy(policy), admitCapacityPolicy(policy));
  assert.deepEqual(policy, policyBefore);
});

function refreshManifest(
  input:
    | ReturnType<typeof completeProfileAdmissionInput>
    | ReturnType<typeof completePolicyAdmissionInput>,
): void {
  input.reviewedManifest.entries[0]!.contentSha256 =
    recordContentSha256(input.record);
}

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import {
  canonicalJson,
  handoffContentHash,
  parseContract,
  validateContract,
} from "../lib/contracts";
import {
  fromHardwareTarget,
  fromRecommendationRequest,
  toHardwareTarget,
  toRecommendationRequest,
} from "../lib/contracts/adapters/recommendation";
import type { HardwareTarget, RecommendationRequest, RunnerHandoff } from "../lib/contracts";

const fixtureRoot = join(process.cwd(), "docs", "contracts", "fixtures");

async function jsonFiles(directory: string): Promise<string[]> {
  return (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
}

test("TypeScript accepts every shared positive contract fixture", async () => {
  const files = await jsonFiles(fixtureRoot);
  assert.equal(files.length, 18);
  for (const file of files) {
    const result = parseContract(await readFile(join(fixtureRoot, file), "utf8"));
    assert.equal(result.ok, true, `${file}: ${result.ok ? "" : result.errors.join("; ")}`);
  }
});

test("TypeScript rejects every shared negative contract fixture", async () => {
  const directory = join(fixtureRoot, "invalid");
  const files = await jsonFiles(directory);
  assert.equal(files.length, 11);
  for (const file of files) {
    assert.equal(parseContract(await readFile(join(directory, file), "utf8")).ok, false, file);
  }
});

test("canonical serialization is key-order independent and verifies handoff content", async () => {
  assert.equal(canonicalJson({ z: 1, a: { y: 2, x: 3 } }), canonicalJson({ a: { x: 3, y: 2 }, z: 1 }));
  const envelope = JSON.parse(await readFile(join(fixtureRoot, "runner-handoff.ok.json"), "utf8")) as { data: RunnerHandoff };
  assert.equal(handoffContentHash(envelope.data), envelope.data.contentHash);
});

test("recommendation request adapter round-trips representable legacy values", async () => {
  const requestEnvelope = JSON.parse(await readFile(join(fixtureRoot, "recommendation-request.ok.json"), "utf8")) as { data: RecommendationRequest };
  const hardwareEnvelope = JSON.parse(await readFile(join(fixtureRoot, "hardware-target.ok.json"), "utf8")) as { data: HardwareTarget };
  const profile = fromHardwareTarget(hardwareEnvelope.data);
  assert.equal(profile.kind, "ok");
  if (profile.kind !== "ok") return;
  const query = fromRecommendationRequest(requestEnvelope.data, profile.value);
  assert.equal(query.kind, "ok");
  if (query.kind !== "ok") return;
  const mapped = toRecommendationRequest(query.value, {
    requestId: requestEnvelope.data.requestId,
    hardwareTargetId: requestEnvelope.data.hardwareTargetId,
    interactionStyle: requestEnvelope.data.task.interactionStyle,
    scopeLabel: requestEnvelope.data.task.scopeLabel,
    needs: requestEnvelope.data.task.needs,
    allowCpuOffload: requestEnvelope.data.preferences.allowCpuOffload,
    installedOnly: requestEnvelope.data.preferences.installedOnly,
    forcedRuntime: requestEnvelope.data.advanced.forcedRuntime,
    maximumArtifactBytes: requestEnvelope.data.advanced.maximumArtifactBytes,
  });
  assert.deepEqual(mapped, requestEnvelope.data);
});

test("hardware adapter round-trips representable values and blocks lossy mappings", async () => {
  const envelope = JSON.parse(await readFile(join(fixtureRoot, "hardware-target.ok.json"), "utf8")) as { data: HardwareTarget };
  const legacy = fromHardwareTarget(envelope.data);
  assert.equal(legacy.kind, "ok");
  if (legacy.kind !== "ok") return;
  const accelerator = envelope.data.accelerators[0];
  const rebuilt = toHardwareTarget(legacy.value, {
    hardwareTargetId: envelope.data.hardwareTargetId,
    osFamily: envelope.data.os.family,
    osVersion: envelope.data.os.version,
    cpuDisplayName: envelope.data.cpu.displayName,
    logicalCores: envelope.data.cpu.logicalCores,
    totalRamGb: envelope.data.memory.totalRamBytes / 2 ** 30,
    unified: envelope.data.memory.unified,
    acceleratorDisplayName: accelerator.displayName,
    acceleratorVendor: accelerator.vendor,
    backend: accelerator.backend,
    fieldOrigins: envelope.data.fieldOrigins,
  });
  assert.deepEqual(rebuilt, envelope.data);

  const multiple = { ...envelope.data, accelerators: [...envelope.data.accelerators, accelerator] };
  assert.equal(fromHardwareTarget(multiple).kind, "blocked");
  const unknownMemory = { ...envelope.data, accelerators: [{ ...accelerator, deviceMemoryBytes: null }] };
  assert.equal(fromHardwareTarget(unknownMemory).kind, "blocked");
});

test("forward schema versions fail closed", () => {
  assert.equal(validateContract({ schemaVersion: 2, contract: "hardware-target", status: "error" }).ok, false);
});

test("measurement evidence cannot contradict its raw series", async () => {
  const envelope = JSON.parse(await readFile(join(fixtureRoot, "benchmark-result.ok.json"), "utf8"));
  envelope.data.series[1].evidence.measurement.interval = { lower: 170, upper: 180 };
  const result = validateContract(envelope);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join("; "), /interval must equal the measured aggregate range/);
});

test("verification identities and nested statuses fail closed", async () => {
  const plan = JSON.parse(await readFile(join(fixtureRoot, "verification-plan.ok.json"), "utf8"));
  plan.data.quickCheckPlan.runtime.runtimeConfigurationId = plan.data.benchmarkPlan.runtime.runtimeConfigurationId;
  assert.equal(validateContract(plan).ok, false, "one runtime id cannot identify different sampler settings");

  const candidateMismatch = JSON.parse(await readFile(join(fixtureRoot, "verification-plan.ok.json"), "utf8"));
  candidateMismatch.data.quickCheckPlan.candidateId = "different-candidate";
  assert.equal(validateContract(candidateMismatch).ok, false, "nested candidate ids must match");

  const artifactMismatch = JSON.parse(await readFile(join(fixtureRoot, "verification-plan.ok.json"), "utf8"));
  artifactMismatch.data.quickCheckPlan.expectedArtifactSha256 = "b".repeat(64);
  assert.equal(validateContract(artifactMismatch).ok, false, "nested artifact identities must match");

  const result = JSON.parse(await readFile(join(fixtureRoot, "verification-result.ok.json"), "utf8"));
  result.data.quickCheckResult.domainStatus = "failed";
  assert.equal(validateContract(result).ok, false, "completed aggregate cannot contain a failed nested result");

  const emptyResult = JSON.parse(await readFile(join(fixtureRoot, "verification-result.ok.json"), "utf8"));
  emptyResult.data.benchmarkResult = null;
  emptyResult.data.quickCheckResult = null;
  assert.equal(validateContract(emptyResult).ok, false, "completed verification requires evidence");
});

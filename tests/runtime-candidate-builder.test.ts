import assert from "node:assert/strict";
import test from "node:test";
import registryJson from "../registry/generated/artifacts.json";
import { toRegistryArtifactIdentity } from "../lib/registry";
import type { RegistrySnapshot } from "../lib/registry";
import { buildExactConfigurationCandidate, evaluateArtifactCompatibility } from "../lib/runtime";
import type { CandidateBuildInput, CompatibilityAssertion, ProductId, RuntimeBuild } from "../lib/runtime";

const registry = registryJson as RegistrySnapshot;
const artifact = registry.artifacts.find((record) => record.status === "promoted")!;
const mappedArtifact = toRegistryArtifactIdentity(artifact);
assert.equal(mappedArtifact.kind, "ok");
if (mappedArtifact.kind !== "ok") throw new Error("registry fixture must cross M-C");
const registryArtifact = mappedArtifact.value;
const build: RuntimeBuild = {
  engineId: "llama.cpp",
  version: "1.2.0",
  exactBuild: "b10061-5d5306bf3",
  os: "windows",
  cpuArchitecture: "x64",
  backend: "cuda",
  featureFlags: ["cuda"],
};
const compatibility: CompatibilityAssertion = {
  artifactId: artifact.id,
  productId: "llama-cpp",
  engineId: "llama.cpp",
  status: "verified",
  runtimeConstraint: { minVersion: "1.0.0", maxVersion: "2.0.0", exactBuild: "b10061-5d5306bf3" },
  conditions: {
    operatingSystems: ["windows"],
    cpuArchitectures: ["x64"],
    backends: ["cuda"],
    packageLayouts: ["gguf-single"],
    modelArchitectures: ["qwen3"],
    quantizationSchemes: [artifact.quantization],
    requiredFiles: [artifact.fileName],
    limitations: ["Fixture admission only."],
  },
  evidence: [{ url: "https://example.invalid/runtime", checkedAt: "2026-07-22T12:00:00Z", sourceRevision: "fixture" }],
};
const completeInput: CandidateBuildInput = {
  compatibilityAdmissionId: "compatibility-admission-m-e-fixture",
  candidateId: "candidate-m-e-fixture",
  registryArtifact,
  compatibility,
  package: { layout: "gguf-single", files: [artifact.fileName], modelArchitecture: "qwen3" },
  runtime: {
    runtimeConfigurationId: "runtime-m-e-fixture",
    productId: "llama-cpp",
    runtimeBuild: build,
    chatTemplate: artifact.chatTemplate,
    contextTokens: 4096,
    kvCache: { key: "f16", value: "f16" },
    gpuLayers: "all",
    batchSize: 2048,
    microBatchSize: 512,
    parallelism: 1,
    threads: 14,
    flashAttention: true,
    mmap: true,
    sampler: { temperature: null, topP: null, topK: null, minP: null, seed: null },
    additionalFlags: [],
  },
};

test("M-E builds a complete exact candidate without changing artifact or runtime identity", () => {
  const result = buildExactConfigurationCandidate(completeInput);
  assert.equal(result.kind, "ok");
  if (result.kind !== "ok") return;
  assert.equal(result.candidate.artifact.artifactId, registryArtifact.artifact.artifactId);
  assert.equal(result.candidate.artifact.sha256, registryArtifact.artifact.sha256);
  assert.deepEqual(result.candidate.provenance, registryArtifact.provenance);
  assert.equal(result.candidate.runtime.product, "llama-cpp");
  assert.equal(result.candidate.runtime.engine, "llama.cpp");
  assert.equal(result.candidate.runtime.engineBuild, "b10061-5d5306bf3");
  assert.equal(result.candidate.runtime.backend, "cuda");
  assert.deepEqual(result.candidate.runtime.sampler, completeInput.runtime!.sampler);
  assert.deepEqual(result.compatibilityReceipt, {
    compatibilityAdmissionId: "compatibility-admission-m-e-fixture",
    receiptVersion: 1,
    policy: { id: "m-e.compatibility", version: "1" },
    candidateId: "candidate-m-e-fixture",
    artifactId: registryArtifact.artifact.artifactId,
    artifactSha256: registryArtifact.artifact.sha256,
    runtimeConfigurationId: "runtime-m-e-fixture",
    decision: "admitted",
    target: {
      product: "llama-cpp",
      engine: "llama.cpp",
      engineBuild: "b10061-5d5306bf3",
      runtimeVersion: "1.2.0",
      exactBuild: "b10061-5d5306bf3",
      operatingSystem: "windows",
      cpuArchitecture: "x86_64",
      backend: "cuda",
      featureFlags: ["cuda"],
      packageLayout: "gguf-single",
      declaredPackageFiles: [artifact.fileName],
      modelArchitecture: "qwen3",
      quantizationScheme: artifact.quantization,
    },
    assertion: {
      artifactId: artifact.id,
      productId: "llama-cpp",
      engineId: "llama.cpp",
      status: "verified",
      runtimeConstraint: { minVersion: "1.0.0", maxVersion: "2.0.0", exactBuild: "b10061-5d5306bf3" },
      conditions: {
        operatingSystems: ["windows"],
        cpuArchitectures: ["x86_64"],
        backends: ["cuda"],
        modelArchitectures: ["qwen3"],
        packageLayouts: ["gguf-single"],
        quantizationSchemes: [artifact.quantization],
        requiredFiles: [artifact.fileName],
        limitations: ["Fixture admission only."],
      },
      evidence: [{ url: "https://example.invalid/runtime", checkedAt: "2026-07-22T12:00:00Z", sourceRevision: "fixture" }],
    },
  });
});

test("M-E normalizes supported OS and architecture aliases in target and assertion", () => {
  const aliases = [
    ["win32", "amd64", "windows", "x86_64"],
    ["windows", "x86_64", "windows", "x86_64"],
    ["darwin", "arm64", "macos", "aarch64"],
    ["macos", "aarch64", "macos", "aarch64"],
    ["linux", "x64", "linux", "x86_64"],
  ] as const;
  for (const [os, architecture, expectedOs, expectedArchitecture] of aliases) {
    const result = buildExactConfigurationCandidate({
      ...completeInput,
      compatibility: {
        ...compatibility,
        conditions: { ...compatibility.conditions, operatingSystems: [os], cpuArchitectures: [architecture] },
      },
      runtime: { ...completeInput.runtime!, runtimeBuild: { ...build, os, cpuArchitecture: architecture } },
    });
    assert.equal(result.kind, "ok", `${os}/${architecture}`);
    if (result.kind !== "ok") continue;
    assert.equal(result.compatibilityReceipt.target.operatingSystem, expectedOs);
    assert.equal(result.compatibilityReceipt.target.cpuArchitecture, expectedArchitecture);
    assert.deepEqual(result.compatibilityReceipt.assertion.conditions.operatingSystems, [expectedOs]);
    assert.deepEqual(result.compatibilityReceipt.assertion.conditions.cpuArchitectures, [expectedArchitecture]);
  }
});

test("M-E fails closed when an admitted platform identity cannot be normalized", () => {
  for (const [label, os, cpuArchitecture] of [
    ["operating system", "freebsd", "x64"],
    ["CPU architecture", "windows", "riscv64"],
  ] as const) {
    const result = buildExactConfigurationCandidate({
      ...completeInput,
      compatibility: {
        ...compatibility,
        conditions: { ...compatibility.conditions, operatingSystems: [os], cpuArchitectures: [cpuArchitecture] },
      },
      runtime: { ...completeInput.runtime!, runtimeBuild: { ...build, os, cpuArchitecture } },
    });
    assert.equal(result.kind, "blocked", label);
    if (result.kind === "blocked") {
      assert.equal(result.reasonCode, "runtime-incompatible");
      assert.match(result.reasons.join(" "), /not representable/);
    }
  }
});

test("M-E preserves every currently admitted assertion status", () => {
  for (const status of ["verified", "documented", "experimental", "inferred"] as const) {
    const result = buildExactConfigurationCandidate({ ...completeInput, compatibility: { ...compatibility, status } });
    assert.equal(result.kind, "ok", status);
    if (result.kind === "ok") assert.equal(result.compatibilityReceipt.assertion.status, status);
  }
});

test("M-E reports every absent explicit runtime field and never supplies defaults", () => {
  const missingAdmissionId = buildExactConfigurationCandidate({ ...completeInput, compatibilityAdmissionId: "" });
  assert.equal(missingAdmissionId.kind, "blocked");
  if (missingAdmissionId.kind === "blocked") assert.ok(missingAdmissionId.missing.includes("compatibilityAdmissionId"));

  const result = buildExactConfigurationCandidate({ ...completeInput, runtime: { productId: "llama-cpp", runtimeBuild: { ...build, exactBuild: undefined, version: undefined } } });
  assert.equal(result.kind, "blocked");
  if (result.kind !== "blocked") return;
  assert.equal(result.reasonCode, "candidate-incomplete");
  assert.ok(result.missing.includes("runtime.runtimeConfigurationId"));
  assert.ok(result.missing.includes("runtime.runtimeBuild.buildIdentity"));
  assert.ok(result.missing.includes("runtime.chatTemplate"));
  assert.ok(result.missing.includes("runtime.kvCache"));
  assert.ok(result.missing.includes("runtime.sampler"));
});

test("M-E fails closed on incomplete nested settings and schema-invalid numeric values", () => {
  const incomplete = buildExactConfigurationCandidate({
    ...completeInput,
    runtime: {
      ...completeInput.runtime!,
      kvCache: { key: "f16" } as unknown as NonNullable<CandidateBuildInput["runtime"]>["kvCache"],
      sampler: { temperature: null, topP: null } as unknown as NonNullable<CandidateBuildInput["runtime"]>["sampler"],
    },
  });
  assert.equal(incomplete.kind, "blocked");
  if (incomplete.kind === "blocked") {
    assert.ok(incomplete.missing.includes("runtime.kvCache.value"));
    assert.ok(incomplete.missing.includes("runtime.sampler.topK"));
    assert.ok(incomplete.missing.includes("runtime.sampler.minP"));
    assert.ok(incomplete.missing.includes("runtime.sampler.seed"));
  }

  const invalidNumbers = buildExactConfigurationCandidate({
    ...completeInput,
    runtime: {
      ...completeInput.runtime!,
      contextTokens: 1.5,
      batchSize: 0,
      sampler: { temperature: -1, topP: 2, topK: -1, minP: Number.NaN, seed: 1.5 },
    },
  });
  assert.equal(invalidNumbers.kind, "blocked");
  if (invalidNumbers.kind === "blocked") {
    for (const field of ["runtime.contextTokens", "runtime.batchSize", "runtime.sampler.temperature", "runtime.sampler.topP", "runtime.sampler.topK", "runtime.sampler.minP", "runtime.sampler.seed"]) {
      assert.ok(invalidNumbers.missing.includes(field), field);
    }
  }
});

test("M-E blocks unknown runtime products instead of throwing at the catalog boundary", () => {
  const result = buildExactConfigurationCandidate({
    ...completeInput,
    runtime: { ...completeInput.runtime!, productId: "unknown-product" as ProductId },
  });
  assert.equal(result.kind, "blocked");
  if (result.kind === "blocked") {
    assert.equal(result.reasonCode, "runtime-incompatible");
    assert.match(result.reasons.join(" "), /not present in the runtime catalog/);
  }
});

test("M-E fails closed when compatibility evidence is unknown or incomplete", () => {
  const unknown = buildExactConfigurationCandidate({ ...completeInput, compatibility: { ...compatibility, status: "unknown" } });
  assert.equal(unknown.kind, "blocked");
  if (unknown.kind === "blocked") assert.equal(unknown.reasonCode, "compatibility-unknown");

  const unsourced = buildExactConfigurationCandidate({ ...completeInput, compatibility: { ...compatibility, evidence: [] } });
  assert.equal(unsourced.kind, "blocked");
  if (unsourced.kind === "blocked") {
    assert.equal(unsourced.reasonCode, "compatibility-unknown");
    assert.match(unsourced.missing.join(" "), /no source evidence/);
  }

  const missingPackageEvidence = buildExactConfigurationCandidate({ ...completeInput, package: undefined });
  assert.equal(missingPackageEvidence.kind, "blocked");
  if (missingPackageEvidence.kind === "blocked") {
    assert.equal(missingPackageEvidence.reasonCode, "candidate-incomplete");
    assert.ok(missingPackageEvidence.missing.includes("package.layout"));
    assert.ok(missingPackageEvidence.missing.includes("package.files"));
  }
});

test("M-E rejects runtime context beyond the admitted artifact limit", () => {
  const result = buildExactConfigurationCandidate({
    ...completeInput,
    runtime: { ...completeInput.runtime!, contextTokens: registryArtifact.registryMetadata.maxContextTokens + 1 },
  });
  assert.equal(result.kind, "blocked");
  if (result.kind === "blocked") {
    assert.equal(result.reasonCode, "runtime-incompatible");
    assert.match(result.reasons.join(" "), /exceeds artifact maximum/);
  }
});

test("M-E rejects product, engine, backend, package and build incompatibilities", () => {
  const cases: Array<[string, CandidateBuildInput]> = [
    ["product", { ...completeInput, compatibility: { ...compatibility, productId: "ollama" as const } }],
    ["engine", { ...completeInput, runtime: { ...completeInput.runtime!, runtimeBuild: { ...build, engineId: "mlx-lm" as const } } }],
    ["backend", { ...completeInput, runtime: { ...completeInput.runtime!, runtimeBuild: { ...build, backend: "metal" as const } } }],
    ["package", { ...completeInput, package: { layout: "hf-transformers" as const, files: [artifact.fileName], modelArchitecture: "qwen3" } }],
    ["build", { ...completeInput, runtime: { ...completeInput.runtime!, runtimeBuild: { ...build, exactBuild: "different-build" } } }],
  ];
  for (const [label, input] of cases) {
    const result = buildExactConfigurationCandidate(input);
    assert.equal(result.kind, "blocked", label);
    if (result.kind === "blocked") assert.equal(result.reasonCode, "runtime-incompatible", label);
  }
});

test("version constraints are numeric and ambiguous versions remain unknown", () => {
  const tooOld = evaluateArtifactCompatibility(compatibility, {
    artifactId: artifact.id, productId: "llama-cpp", runtimeBuild: { ...build, version: "0.9.0" },
    packageLayout: "gguf-single", packageFiles: [artifact.fileName], quantizationScheme: artifact.quantization,
  });
  assert.equal(tooOld.compatible, false);
  assert.match(tooOld.reasons.join(" "), /minimum/);

  const ambiguous = evaluateArtifactCompatibility({ ...compatibility, runtimeConstraint: { minVersion: "release-1" } }, {
    artifactId: artifact.id, productId: "llama-cpp", runtimeBuild: { ...build, version: "nightly", exactBuild: undefined },
    packageLayout: "gguf-single", packageFiles: [artifact.fileName], quantizationScheme: artifact.quantization,
  });
  assert.equal(ambiguous.compatible, false);
  assert.match(ambiguous.unknowns.join(" "), /cannot be safely compared/);
});

test("M-E rejects a backend that v1 cannot represent instead of translating it to other", () => {
  const syclAssertion = { ...compatibility, conditions: { ...compatibility.conditions, backends: ["sycl" as const] } };
  const result = buildExactConfigurationCandidate({
    ...completeInput,
    compatibility: syclAssertion,
    runtime: { ...completeInput.runtime!, runtimeBuild: { ...build, backend: "sycl" } },
  });
  assert.equal(result.kind, "blocked");
  if (result.kind === "blocked") assert.match(result.reasons.join(" "), /contract adapter or version change/);
});

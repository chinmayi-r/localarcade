import type { ExactConfigurationCandidate, Provenance, RuntimeConfiguration } from "../contracts";
import type { ArtifactRegistryRecord } from "../registry/types";
import { products } from "./catalog";
import { evaluateArtifactCompatibility } from "./compatibility";
import type { ArtifactPackageLayout, CompatibilityAssertion, ProductId, RuntimeBuild } from "./types";

export type ExplicitRuntimeSettings = {
  runtimeConfigurationId?: string;
  productId?: ProductId;
  runtimeBuild?: RuntimeBuild;
  chatTemplate?: string | null;
  contextTokens?: number;
  kvCache?: { key: string | null; value: string | null };
  gpuLayers?: number | "all" | null;
  batchSize?: number | null;
  microBatchSize?: number | null;
  parallelism?: number | null;
  threads?: number | null;
  flashAttention?: boolean | null;
  mmap?: boolean | null;
  sampler?: RuntimeConfiguration["sampler"];
  additionalFlags?: RuntimeConfiguration["additionalFlags"];
};

export type CandidateBuildInput = {
  candidateId?: string;
  modelFamily?: { modelFamilyId: string; displayName: string };
  artifact?: ArtifactRegistryRecord;
  runtime?: ExplicitRuntimeSettings;
  compatibility?: CompatibilityAssertion;
  package?: {
    layout?: ArtifactPackageLayout;
    files?: string[];
    modelArchitecture?: string;
  };
  provenance?: Provenance[];
};

export type CandidateBuildResult =
  | { kind: "ok"; candidate: ExactConfigurationCandidate }
  | { kind: "blocked"; reasonCode: "candidate-incomplete" | "compatibility-unknown" | "runtime-incompatible"; message: string; missing: string[]; reasons: string[] };

const runtimeFields = [
  "runtimeConfigurationId", "productId", "runtimeBuild", "chatTemplate", "contextTokens", "kvCache", "gpuLayers",
  "batchSize", "microBatchSize", "parallelism", "threads", "flashAttention", "mmap", "sampler", "additionalFlags",
] as const;

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function buildExactConfigurationCandidate(input: CandidateBuildInput): CandidateBuildResult {
  const missing: string[] = [];
  if (!input.candidateId) missing.push("candidateId");
  if (!input.modelFamily?.modelFamilyId) missing.push("modelFamily.modelFamilyId");
  if (!input.modelFamily?.displayName) missing.push("modelFamily.displayName");
  if (!input.artifact) missing.push("artifact");
  if (!input.compatibility) missing.push("compatibility");
  if (!input.provenance?.length) missing.push("provenance");
  if (!input.package?.layout) missing.push("package.layout");
  if (!input.package?.files) missing.push("package.files");
  if (!input.runtime) {
    missing.push("runtime");
  } else {
    for (const field of runtimeFields) {
      if (!hasOwn(input.runtime, field) || input.runtime[field] === undefined) missing.push(`runtime.${field}`);
    }
    if (!input.runtime.runtimeConfigurationId) missing.push("runtime.runtimeConfigurationId");
    if (!input.runtime.productId) missing.push("runtime.productId");
    if (!input.runtime.runtimeBuild?.engineId) missing.push("runtime.runtimeBuild.engineId");
    if (!input.runtime.runtimeBuild?.exactBuild && !input.runtime.runtimeBuild?.version) missing.push("runtime.runtimeBuild.buildIdentity");
    if (!input.runtime.runtimeBuild?.os) missing.push("runtime.runtimeBuild.os");
    if (!input.runtime.runtimeBuild?.cpuArchitecture) missing.push("runtime.runtimeBuild.cpuArchitecture");
    if (!input.runtime.runtimeBuild?.backend) missing.push("runtime.runtimeBuild.backend");
    if (!input.runtime.contextTokens || input.runtime.contextTokens < 1) missing.push("runtime.contextTokens");
  }
  if (input.artifact) {
    if (input.artifact.status !== "promoted") missing.push("artifact.status:promoted");
    if (!input.artifact.id) missing.push("artifact.artifactId");
    if (!input.artifact.publisher) missing.push("artifact.publisher");
    if (!input.artifact.repository) missing.push("artifact.repository");
    if (!input.artifact.revision) missing.push("artifact.revision");
    if (!input.artifact.fileName) missing.push("artifact.filename");
    if (!/^[a-f0-9]{64}$/.test(input.artifact.sha256)) missing.push("artifact.sha256");
    if (input.artifact.fileSizeBytes < 1) missing.push("artifact.bytes");
    if (!input.artifact.format) missing.push("artifact.format");
    if (!input.artifact.quantization) missing.push("artifact.quantization");
    if (!input.artifact.license.id) missing.push("artifact.license");
  }
  if (missing.length) {
    return { kind: "blocked", reasonCode: "candidate-incomplete", message: "Exact candidate identity is incomplete.", missing: [...new Set(missing)], reasons: [] };
  }

  const artifact = input.artifact!;
  const runtime = input.runtime!;
  const build = runtime.runtimeBuild!;
  const productId = runtime.productId!;
  const product = products[productId];
  if (!product.engineIds.includes(build.engineId)) {
    return {
      kind: "blocked", reasonCode: "runtime-incompatible", message: "The product does not expose the selected engine.", missing: [],
      reasons: [`Product ${productId} does not expose engine ${build.engineId}.`],
    };
  }
  if (runtime.contextTokens! > artifact.maxContextTokens) {
    return {
      kind: "blocked", reasonCode: "runtime-incompatible", message: "The requested runtime context exceeds the artifact limit.", missing: [],
      reasons: [`Context ${runtime.contextTokens} exceeds artifact maximum ${artifact.maxContextTokens}.`],
    };
  }

  const compatibility = evaluateArtifactCompatibility(input.compatibility!, {
    artifactId: artifact.id,
    productId,
    runtimeBuild: build,
    packageLayout: input.package?.layout,
    packageFiles: input.package?.files,
    modelArchitecture: input.package?.modelArchitecture,
    quantizationScheme: artifact.quantization,
  });
  if (!compatibility.compatible) {
    const unknown = compatibility.unknowns.length > 0;
    return {
      kind: "blocked",
      reasonCode: unknown ? "compatibility-unknown" : "runtime-incompatible",
      message: unknown ? "Runtime compatibility cannot be established from the available evidence." : "The artifact and runtime route are incompatible.",
      missing: compatibility.unknowns,
      reasons: compatibility.reasons,
    };
  }

  if (build.backend === "sycl" || build.backend === "xpu") {
    return { kind: "blocked", reasonCode: "runtime-incompatible", message: "The selected backend is not representable in the v1 candidate contract.", missing: [], reasons: [`Backend ${build.backend} requires a contract adapter or version change.`] };
  }

  return {
    kind: "ok",
    candidate: {
      candidateId: input.candidateId!,
      modelFamily: input.modelFamily!,
      artifact: {
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
      },
      runtime: {
        runtimeConfigurationId: runtime.runtimeConfigurationId!,
        product: productId,
        engine: build.engineId,
        engineBuild: build.exactBuild ?? build.version!,
        backend: build.backend,
        chatTemplate: runtime.chatTemplate!,
        contextTokens: runtime.contextTokens!,
        kvCache: runtime.kvCache!,
        gpuLayers: runtime.gpuLayers!,
        batchSize: runtime.batchSize!,
        microBatchSize: runtime.microBatchSize!,
        parallelism: runtime.parallelism!,
        threads: runtime.threads!,
        flashAttention: runtime.flashAttention!,
        mmap: runtime.mmap!,
        sampler: runtime.sampler!,
        additionalFlags: runtime.additionalFlags!,
      },
      provenance: input.provenance!,
    },
  };
}

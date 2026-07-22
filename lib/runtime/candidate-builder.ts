import type { ExactConfigurationCandidate, RuntimeConfiguration } from "../contracts";
import type { RegistryArtifactIdentityV1 } from "../registry/contracts";
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
  registryArtifact?: RegistryArtifactIdentityV1;
  runtime?: ExplicitRuntimeSettings;
  compatibility?: CompatibilityAssertion;
  package?: {
    layout?: ArtifactPackageLayout;
    files?: string[];
    modelArchitecture?: string;
  };
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

function isIntegerAtLeast(value: unknown, minimum: number): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum;
}

function isNullableIntegerAtLeast(value: unknown, minimum: number): boolean {
  return value === null || isIntegerAtLeast(value, minimum);
}

function isNullableNumberInRange(value: unknown, minimum: number, maximum = Number.POSITIVE_INFINITY): boolean {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum);
}

export function buildExactConfigurationCandidate(input: CandidateBuildInput): CandidateBuildResult {
  const missing: string[] = [];
  if (!input.candidateId) missing.push("candidateId");
  if (!input.registryArtifact) missing.push("registryArtifact");
  if (!input.compatibility) missing.push("compatibility");
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
    if (!isIntegerAtLeast(input.runtime.contextTokens, 1)) missing.push("runtime.contextTokens");
    if (input.runtime.kvCache !== undefined) {
      if (!hasOwn(input.runtime.kvCache, "key")) missing.push("runtime.kvCache.key");
      if (!hasOwn(input.runtime.kvCache, "value")) missing.push("runtime.kvCache.value");
    }
    if (input.runtime.sampler !== undefined) {
      for (const field of ["temperature", "topP", "topK", "minP", "seed"] as const) {
        if (!hasOwn(input.runtime.sampler, field)) missing.push(`runtime.sampler.${field}`);
      }
    }
    if (input.runtime.gpuLayers !== undefined && input.runtime.gpuLayers !== "all" && !isNullableIntegerAtLeast(input.runtime.gpuLayers, 0)) missing.push("runtime.gpuLayers");
    for (const field of ["batchSize", "microBatchSize", "parallelism", "threads"] as const) {
      if (input.runtime[field] !== undefined && !isNullableIntegerAtLeast(input.runtime[field], 1)) missing.push(`runtime.${field}`);
    }
    if (input.runtime.sampler !== undefined) {
      if (!isNullableNumberInRange(input.runtime.sampler.temperature, 0)) missing.push("runtime.sampler.temperature");
      if (!isNullableNumberInRange(input.runtime.sampler.topP, 0, 1)) missing.push("runtime.sampler.topP");
      if (!isNullableIntegerAtLeast(input.runtime.sampler.topK, 0)) missing.push("runtime.sampler.topK");
      if (!isNullableNumberInRange(input.runtime.sampler.minP, 0, 1)) missing.push("runtime.sampler.minP");
      if (input.runtime.sampler.seed !== null && !Number.isInteger(input.runtime.sampler.seed)) missing.push("runtime.sampler.seed");
    }
    if (input.runtime.additionalFlags !== undefined) {
      for (const [index, flag] of input.runtime.additionalFlags.entries()) {
        if (!flag.name) missing.push(`runtime.additionalFlags.${index}.name`);
        if (!hasOwn(flag, "value")) missing.push(`runtime.additionalFlags.${index}.value`);
      }
    }
  }
  if (missing.length) {
    return { kind: "blocked", reasonCode: "candidate-incomplete", message: "Exact candidate identity is incomplete.", missing: [...new Set(missing)], reasons: [] };
  }

  const registryArtifact = input.registryArtifact!;
  const artifact = registryArtifact.artifact;
  const runtime = input.runtime!;
  const build = runtime.runtimeBuild!;
  const productId = runtime.productId!;
  const product = products[productId];
  if (!product) {
    return {
      kind: "blocked", reasonCode: "runtime-incompatible", message: "The selected runtime product is unsupported.", missing: [],
      reasons: [`Product ${productId} is not present in the runtime catalog.`],
    };
  }
  if (!product.engineIds.includes(build.engineId)) {
    return {
      kind: "blocked", reasonCode: "runtime-incompatible", message: "The product does not expose the selected engine.", missing: [],
      reasons: [`Product ${productId} does not expose engine ${build.engineId}.`],
    };
  }
  if (runtime.contextTokens! > registryArtifact.registryMetadata.maxContextTokens) {
    return {
      kind: "blocked", reasonCode: "runtime-incompatible", message: "The requested runtime context exceeds the artifact limit.", missing: [],
      reasons: [`Context ${runtime.contextTokens} exceeds artifact maximum ${registryArtifact.registryMetadata.maxContextTokens}.`],
    };
  }

  const compatibility = evaluateArtifactCompatibility(input.compatibility!, {
    artifactId: artifact.artifactId,
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
      modelFamily: registryArtifact.modelFamily,
      artifact,
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
      provenance: registryArtifact.provenance,
    },
  };
}

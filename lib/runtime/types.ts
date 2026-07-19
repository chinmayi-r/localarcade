export type ProductId = "llama-cpp" | "ollama" | "lm-studio" | "jan" | "mlx-lm" | "vllm";
export type EngineId = "llama.cpp" | "mlx-lm" | "mlx-swift-lm" | "vllm-native" | "vllm-transformers" | "vllm-gguf-plugin";
export type AccelerationBackend = "cpu" | "cuda" | "rocm" | "metal" | "vulkan" | "sycl" | "xpu";
export type ArtifactPackageLayout = "gguf-single" | "gguf-split" | "hf-transformers" | "mlx-lm" | "mlx-swift-lm" | "ollama-package";
export type CompatibilityStatus = "verified" | "documented" | "experimental" | "inferred" | "unknown" | "unsupported";

export type Product = {
  id: ProductId;
  label: string;
  kind: "engine-and-cli" | "desktop-app" | "app-and-daemon" | "framework-cli" | "serving-engine";
  engineIds: EngineId[];
};

export type RuntimeBuild = {
  engineId: EngineId;
  version?: string;
  exactBuild?: string;
  os: string;
  cpuArchitecture: string;
  backend: AccelerationBackend;
  featureFlags: string[];
};

export type CompatibilityAssertion = {
  artifactId: string;
  productId: ProductId;
  engineId: EngineId;
  status: CompatibilityStatus;
  runtimeConstraint: {
    minVersion?: string;
    maxVersion?: string;
    exactBuild?: string;
  };
  conditions: {
    operatingSystems?: string[];
    cpuArchitectures?: string[];
    backends?: AccelerationBackend[];
    modelArchitectures?: string[];
    packageLayouts?: ArtifactPackageLayout[];
    quantizationSchemes?: string[];
    requiredFiles?: string[];
    limitations?: string[];
  };
  evidence: Array<{
    url: string;
    checkedAt: string;
    sourceRevision?: string;
  }>;
};

export type InstallRoute = {
  productId: ProductId;
  artifactId: string;
  method: "pull" | "import" | "local-path" | "convert";
  commandTemplate?: string;
  requiresConversion: boolean;
};

export type ExecutionPlan = {
  artifactId: string;
  productId: ProductId;
  runtimeBuild: RuntimeBuild;
  contextTokens: number;
  kvCacheQuantization?: string;
  gpuLayers?: number | "all";
  batchSize?: number;
};

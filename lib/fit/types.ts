export type KvCacheQuantization = "f32" | "f16" | "bf16" | "q8_0" | "q5_0" | "q5_1" | "q4_0" | "q4_1" | "iq4_nl";

export type KvComponentProfile = {
  quantization: KvCacheQuantization;
  referenceContextTokens: number;
  bytesAtReferenceContext: number;
};

export type FitArtifact = {
  id: string;
  weightBytes: number;
  maxContextTokens: number;
  runtimeComputeBufferBytes: number;
  kvCache: {
    key: KvComponentProfile[];
    value: KvComponentProfile[];
  };
};

export type FitHardware = {
  physicalMemoryBytes: number;
  osReserveBytes: number;
  displayReserveBytes: number;
  safetyMarginBps: number;
};

export type KvCacheSelection = KvCacheQuantization | {
  key: KvCacheQuantization;
  value: KvCacheQuantization;
};

export type FitBreakdown = {
  weightsBytes: number;
  kvCacheBytes: number;
  runtimeComputeBufferBytes: number;
  osReserveBytes: number;
  displayReserveBytes: number;
  safetyMarginBytes: number;
};

export type FitResult = {
  fits: boolean;
  requiredBytes: number;
  physicalMemoryBytes: number;
  breakdown: FitBreakdown;
  reasons: string[];
};

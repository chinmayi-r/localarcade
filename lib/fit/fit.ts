import type { FitArtifact, FitHardware, FitResult, KvCacheQuantization, KvCacheSelection, KvComponentProfile } from "./types";

/**
 * Pure capacity calculation. All runtime-dependent values are explicit inputs;
 * this function does not infer architecture, offload, batch or backend costs.
 */
export function fit(
  artifact: FitArtifact,
  hardware: FitHardware,
  contextTokens: number,
  kvQuantization: KvCacheSelection,
): FitResult {
  validateArtifact(artifact);
  validateHardware(hardware);
  positiveSafeInteger(contextTokens, "Context tokens");

  const selection = typeof kvQuantization === "string"
    ? { key: kvQuantization, value: kvQuantization }
    : kvQuantization;
  const keyProfile = findProfile(artifact.kvCache.key, selection.key, "key", artifact.id);
  const valueProfile = findProfile(artifact.kvCache.value, selection.value, "value", artifact.id);
  const kvCacheBytes = safeAdd(
    scaleProfile(keyProfile, contextTokens),
    scaleProfile(valueProfile, contextTokens),
    "KV cache",
  );
  const workloadBytes = safeAdd(artifact.weightBytes, kvCacheBytes, "workload");
  const workloadWithBuffers = safeAdd(workloadBytes, artifact.runtimeComputeBufferBytes, "workload buffers");
  const safetyMarginBytes = ceilRatio(workloadWithBuffers, hardware.safetyMarginBps, 10_000);
  const requiredBytes = [workloadWithBuffers, hardware.osReserveBytes, hardware.displayReserveBytes, safetyMarginBytes]
    .reduce((total, value) => safeAdd(total, value, "required memory"), 0);
  const reasons: string[] = [];
  if (contextTokens > artifact.maxContextTokens) reasons.push(`Requested context ${contextTokens} exceeds the artifact limit ${artifact.maxContextTokens}.`);
  if (requiredBytes > hardware.physicalMemoryBytes) reasons.push(`Required memory ${requiredBytes} exceeds physical memory ${hardware.physicalMemoryBytes}.`);

  return {
    fits: reasons.length === 0,
    requiredBytes,
    physicalMemoryBytes: hardware.physicalMemoryBytes,
    breakdown: {
      weightsBytes: artifact.weightBytes,
      kvCacheBytes,
      runtimeComputeBufferBytes: artifact.runtimeComputeBufferBytes,
      osReserveBytes: hardware.osReserveBytes,
      displayReserveBytes: hardware.displayReserveBytes,
      safetyMarginBytes,
    },
    reasons,
  };
}

function scaleProfile(profile: KvComponentProfile, contextTokens: number) {
  return ceilRatio(profile.bytesAtReferenceContext, contextTokens, profile.referenceContextTokens);
}

function findProfile(profiles: KvComponentProfile[], quantization: KvCacheQuantization, component: string, artifactId: string) {
  const matches = profiles.filter((profile) => profile.quantization === quantization);
  if (matches.length !== 1) throw new TypeError(`${artifactId} requires exactly one ${component} KV profile for ${quantization}.`);
  return matches[0];
}

function validateArtifact(artifact: FitArtifact) {
  if (!artifact.id.trim()) throw new TypeError("Artifact id is required.");
  positiveSafeInteger(artifact.weightBytes, "Weight bytes");
  positiveSafeInteger(artifact.maxContextTokens, "Maximum context tokens");
  nonNegativeSafeInteger(artifact.runtimeComputeBufferBytes, "Runtime/compute buffer bytes");
  if (!artifact.kvCache.key.length || !artifact.kvCache.value.length) throw new TypeError("Key and value KV profiles are required.");
  for (const profile of [...artifact.kvCache.key, ...artifact.kvCache.value]) {
    positiveSafeInteger(profile.referenceContextTokens, "KV reference context");
    positiveSafeInteger(profile.bytesAtReferenceContext, "KV reference bytes");
  }
}

function validateHardware(hardware: FitHardware) {
  positiveSafeInteger(hardware.physicalMemoryBytes, "Physical memory bytes");
  nonNegativeSafeInteger(hardware.osReserveBytes, "OS reserve bytes");
  nonNegativeSafeInteger(hardware.displayReserveBytes, "Display reserve bytes");
  nonNegativeSafeInteger(hardware.safetyMarginBps, "Safety margin basis points");
  if (hardware.safetyMarginBps > 10_000) throw new TypeError("Safety margin cannot exceed 10000 basis points.");
}

function ceilRatio(value: number, numerator: number, denominator: number) {
  const result = (BigInt(value) * BigInt(numerator) + BigInt(denominator) - BigInt(1)) / BigInt(denominator);
  const number = Number(result);
  if (!Number.isSafeInteger(number)) throw new RangeError("Calculated memory exceeds the safe integer range.");
  return number;
}

function safeAdd(left: number, right: number, label: string) {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new RangeError(`${label} exceeds the safe integer range.`);
  return result;
}

function positiveSafeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${label} must be a positive safe integer.`);
}

function nonNegativeSafeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label} must be a non-negative safe integer.`);
}

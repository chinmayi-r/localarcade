import assert from "node:assert/strict";
import test from "node:test";
import { fit } from "../lib/fit";
import type { FitArtifact, FitHardware } from "../lib/fit";

const MIB = 1024 ** 2;
const artifact: FitArtifact = {
  id: "fixture/model-Q4_K_M.gguf",
  weightBytes: 5_000 * MIB,
  maxContextTokens: 131_072,
  runtimeComputeBufferBytes: 640 * MIB,
  kvCache: {
    key: [
      { quantization: "f16", referenceContextTokens: 4096, bytesAtReferenceContext: 512 * MIB },
      { quantization: "q8_0", referenceContextTokens: 4096, bytesAtReferenceContext: 272 * MIB },
    ],
    value: [
      { quantization: "f16", referenceContextTokens: 4096, bytesAtReferenceContext: 512 * MIB },
      { quantization: "q8_0", referenceContextTokens: 4096, bytesAtReferenceContext: 272 * MIB },
    ],
  },
};
const hardware: FitHardware = { physicalMemoryBytes: 24 * 1024 ** 3, osReserveBytes: 1024 * MIB, displayReserveBytes: 512 * MIB, safetyMarginBps: 1000 };

test("required memory increases monotonically with context", () => {
  let previous = 0;
  for (let context = 1; context <= artifact.maxContextTokens; context += 257) {
    const required = fit(artifact, { ...hardware, physicalMemoryBytes: 2 ** 50 }, context, "f16").requiredBytes;
    assert.ok(required >= previous, `${context} tokens`);
    previous = required;
  }
});

test("no accepted input can fit above physical memory", () => {
  for (const physicalMib of [1024, 4096, 8192, 12_288, 16_384, 24_576, 65_536]) {
    for (const context of [512, 2048, 8192, 32_768, 131_072]) {
      const result = fit(artifact, { ...hardware, physicalMemoryBytes: physicalMib * MIB }, context, "q8_0");
      assert.ok(!result.fits || result.requiredBytes <= result.physicalMemoryBytes);
    }
  }
});

test("the byte breakdown sums exactly to required memory", () => {
  const result = fit(artifact, hardware, 8192, "f16");
  assert.equal(result.requiredBytes, Object.values(result.breakdown).reduce((sum, value) => sum + value, 0));
  assert.equal(result.breakdown.kvCacheBytes, 2048 * MIB);
});

test("OS, display and safety reserves are explicit rather than platform guesses", () => {
  const without = fit(artifact, { ...hardware, osReserveBytes: 0, displayReserveBytes: 0, safetyMarginBps: 0 }, 4096, "f16");
  const withReserves = fit(artifact, hardware, 4096, "f16");
  assert.ok(withReserves.requiredBytes > without.requiredBytes);
  assert.equal(withReserves.breakdown.osReserveBytes, hardware.osReserveBytes);
  assert.equal(withReserves.breakdown.displayReserveBytes, hardware.displayReserveBytes);
});

test("mixed K/V quantizations use independently sourced profiles", () => {
  const result = fit(artifact, hardware, 4096, { key: "q8_0", value: "f16" });
  assert.equal(result.breakdown.kvCacheBytes, (272 + 512) * MIB);
});

test("missing KV profiles fail closed", () => {
  assert.throws(() => fit(artifact, hardware, 4096, "q4_0"), /exactly one key KV profile/);
});

test("catalog context limits and physical limits independently prevent a fit", () => {
  const overContext = fit(artifact, { ...hardware, physicalMemoryBytes: 2 ** 50 }, artifact.maxContextTokens + 1, "f16");
  assert.equal(overContext.fits, false);
  assert.match(overContext.reasons.join(" "), /artifact limit/);
  const overMemory = fit(artifact, { ...hardware, physicalMemoryBytes: MIB }, 512, "f16");
  assert.equal(overMemory.fits, false);
  assert.match(overMemory.reasons.join(" "), /exceeds physical memory/);
});

test("invalid or unsafe numeric inputs are rejected", () => {
  assert.throws(() => fit(artifact, hardware, 0, "f16"), /positive safe integer/);
  assert.throws(() => fit(artifact, { ...hardware, safetyMarginBps: 10_001 }, 4096, "f16"), /cannot exceed/);
  assert.throws(() => fit({ ...artifact, weightBytes: Number.MAX_VALUE }, hardware, 4096, "f16"), /positive safe integer/);
});

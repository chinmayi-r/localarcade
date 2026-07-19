import assert from "node:assert/strict";
import test from "node:test";
import { fit } from "../lib/fit";
import type { FitArtifact, KvCacheQuantization } from "../lib/fit";
import goldensJson from "./fixtures/llama-cpp-memory-goldens.json";

type Golden = {
  id: string;
  sourceUrl: string;
  contextTokens: number;
  keyQuant: KvCacheQuantization;
  valueQuant: KvCacheQuantization;
  keyMib: number;
  valueMib: number;
  runtimeMib: number;
};

const MIB = 1024 ** 2;
const goldens = goldensJson as Golden[];

test("ten llama.cpp allocation-log goldens reproduce reported KV components", () => {
  assert.equal(goldens.length, 10);
  for (const golden of goldens) {
    assert.match(golden.sourceUrl, /^https:\/\/github\.com\/ggml-org\/llama\.cpp\/(?:issues|discussions)\/\d+$/);
    const keyBytes = Math.round(golden.keyMib * MIB);
    const valueBytes = Math.round(golden.valueMib * MIB);
    const artifact: FitArtifact = {
      id: golden.id,
      weightBytes: MIB,
      maxContextTokens: golden.contextTokens,
      runtimeComputeBufferBytes: Math.round(golden.runtimeMib * MIB),
      kvCache: {
        key: [{ quantization: golden.keyQuant, referenceContextTokens: golden.contextTokens, bytesAtReferenceContext: keyBytes }],
        value: [{ quantization: golden.valueQuant, referenceContextTokens: golden.contextTokens, bytesAtReferenceContext: valueBytes }],
      },
    };
    const result = fit(artifact, { physicalMemoryBytes: 2 ** 50, osReserveBytes: 0, displayReserveBytes: 0, safetyMarginBps: 0 }, golden.contextTokens, { key: golden.keyQuant, value: golden.valueQuant });
    assert.equal(result.breakdown.kvCacheBytes, keyBytes + valueBytes, golden.id);
    assert.equal(result.breakdown.runtimeComputeBufferBytes, Math.round(golden.runtimeMib * MIB), golden.id);
  }
});

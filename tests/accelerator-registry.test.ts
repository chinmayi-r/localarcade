import assert from "node:assert/strict";
import test from "node:test";
import { acceleratorSnapshot, accelerators, deriveMemory, findAccelerator, validateAcceleratorSnapshot } from "../lib/accelerators";
import { throughputPriors } from "../lib/priors";

test("every accelerator entry is fully sourced and valid", () => {
  assert.deepEqual(validateAcceleratorSnapshot(acceleratorSnapshot), []);
  assert.ok(accelerators.length >= 11);
  for (const entry of accelerators) {
    assert.match(entry.sourceUrl, /^https:\/\/www\.(nvidia|apple)\.com\//);
  }
});

test("single-variant devices derive one confident memory value", () => {
  const derived = deriveMemory("nvidia-geforce-rtx-4090-gpu", accelerators);
  assert.equal(derived.kind, "single-variant");
  if (derived.kind !== "single-variant") return;
  assert.equal(derived.memoryGb, 24);
  assert.equal(derived.variant.memoryType, "GDDR6X");
});

test("multi-variant devices present every sourced option, never one guess", () => {
  const ti4060 = deriveMemory("nvidia-geforce-rtx-4060-ti-gpu", accelerators);
  assert.equal(ti4060.kind, "multiple-variants");
  if (ti4060.kind !== "multiple-variants") return;
  assert.deepEqual(ti4060.variants.map((variant) => variant.memoryGb), [8, 16]);

  const m5pro = deriveMemory("apple-m5-pro", accelerators);
  assert.equal(m5pro.kind, "multiple-variants");
  if (m5pro.kind !== "multiple-variants") return;
  assert.deepEqual(m5pro.variants.map((variant) => variant.memoryGb), [16, 24, 32, 48, 64]);
});

test("unknown accelerators fail closed to manual memory entry", () => {
  const derived = deriveMemory("amd-radeon-rx-9070-xt-gpu", accelerators);
  assert.equal(derived.kind, "unknown-accelerator");
});

test("shared ids agree with throughput priors on family and kind", () => {
  for (const prior of throughputPriors) {
    const entry = findAccelerator(prior.accelerator.id, accelerators);
    if (!entry) continue;
    assert.equal(entry.family, prior.accelerator.family, `${entry.id}: family mismatch between registries`);
    assert.equal(entry.kind, prior.accelerator.kind, `${entry.id}: kind mismatch between registries`);
    const variantMemories = entry.memoryVariants.map((variant) => variant.memoryGb);
    assert.ok(variantMemories.includes(prior.accelerator.memoryGb), `${entry.id}: prior memory ${prior.accelerator.memoryGb} GB is not a vendor-sourced variant`);
  }
});

test("apple silicon is integrated, never pooled as discrete gpu", () => {
  for (const entry of accelerators.filter((candidate) => candidate.vendor === "apple")) {
    assert.equal(entry.kind, "integrated");
  }
});

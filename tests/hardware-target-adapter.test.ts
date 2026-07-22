import assert from "node:assert/strict";
import test from "node:test";
import { resolveManualHardware, type ManualHardwareInput } from "../lib/hardware";

const GIB = 1024 ** 3;

function manual(overrides: Partial<ManualHardwareInput> = {}): ManualHardwareInput {
  return {
    hardwareTargetId: "hw-manual",
    os: { family: "windows", version: "11" },
    cpu: { displayName: "Fixture CPU", logicalCores: 16 },
    memory: {
      totalRamBytes: 32 * GIB,
      availableRamBytes: null,
      unified: false,
      totalRamConfirmed: true,
    },
    accelerators: [{
      acceleratorId: "nvidia-geforce-rtx-4090-gpu",
      displayName: "NVIDIA GeForce RTX 4090",
      vendor: "nvidia",
      backend: "cuda",
      deviceMemoryBytes: 24 * GIB,
      memoryConfirmed: true,
    }],
    ...overrides,
  };
}

test("known manually confirmed hardware maps to a ready target", () => {
  const result = resolveManualHardware(manual());
  assert.equal(result.state, "ready");
  assert.equal(result.target?.accelerators[0].acceleratorId, "nvidia-geforce-rtx-4090-gpu");
  assert.equal(result.target?.fieldOrigins["/accelerators/0/deviceMemoryBytes"], "confirmed");
  assert.deepEqual(Object.keys(result.target?.fieldOrigins ?? {}).sort(), [
    "/accelerators",
    "/accelerators/0/acceleratorId",
    "/accelerators/0/backend",
    "/accelerators/0/count",
    "/accelerators/0/deviceMemoryBytes",
    "/accelerators/0/displayName",
    "/accelerators/0/kind",
    "/accelerators/0/vendor",
    "/cpu/displayName",
    "/cpu/logicalCores",
    "/hardwareTargetId",
    "/memory/availableRamBytes",
    "/memory/totalRamBytes",
    "/memory/unified",
    "/os/family",
    "/os/version",
  ]);
});

test("multi-variant hardware is ambiguous until a sourced value is confirmed", () => {
  const result = resolveManualHardware(manual({
    accelerators: [{
      acceleratorId: "nvidia-geforce-rtx-4060-ti-gpu",
      displayName: "NVIDIA GeForce RTX 4060 Ti",
      vendor: "nvidia",
      backend: "cuda",
      deviceMemoryBytes: null,
      memoryConfirmed: false,
    }],
  }));
  assert.equal(result.state, "confirmation-required");
  assert.deepEqual(result.reasonCodes, ["hardware.memory-variant-ambiguous"]);
  assert.deepEqual(result.confirmationFields, ["/accelerators/0/deviceMemoryBytes"]);
  assert.equal(result.target?.accelerators[0].deviceMemoryBytes, null, "adapter must not choose 8 or 16 GB");
  assert.deepEqual(result.memoryVariantOptions.map((option) => option.bytes), [8 * GIB, 16 * GIB]);
});

test("a registry mismatch preserves the entered value and requires confirmation", () => {
  const result = resolveManualHardware(manual({
    accelerators: [{
      acceleratorId: "nvidia-geforce-rtx-4090-gpu",
      displayName: "NVIDIA GeForce RTX 4090",
      vendor: "nvidia",
      backend: "cuda",
      deviceMemoryBytes: 8 * GIB,
      memoryConfirmed: true,
    }],
  }));
  assert.equal(result.state, "confirmation-required");
  assert.ok(result.reasonCodes.includes("hardware.device-memory-registry-mismatch"));
  assert.equal(result.target?.accelerators[0].deviceMemoryBytes, 8 * GIB);
});

test("unknown hardware remains manually representable without a fabricated stable id", () => {
  const result = resolveManualHardware(manual({
    accelerators: [{
      acceleratorId: "not-in-registry",
      displayName: "Owner supplied GPU",
      vendor: "amd",
      backend: "rocm",
      deviceMemoryBytes: 20 * GIB,
      memoryConfirmed: true,
    }],
  }));
  assert.equal(result.state, "confirmation-required");
  assert.ok(result.reasonCodes.includes("hardware.unknown-accelerator"));
  assert.equal(result.target?.accelerators[0].acceleratorId, null);
  assert.equal(result.target?.accelerators[0].deviceMemoryBytes, 20 * GIB);
  assert.ok(result.confirmationFields.includes("/accelerators/0/acceleratorId"));
});

test("multiple devices are preserved and require an explicit selection", () => {
  const first = manual().accelerators[0];
  const result = resolveManualHardware(manual({ accelerators: [first, { ...first, count: 1 }] }));
  assert.equal(result.target?.accelerators.length, 2);
  assert.ok(result.reasonCodes.includes("hardware.multiple-device-selection-required"));
  assert.ok(result.confirmationFields.includes("/accelerators"));
});

test("manual values do not become confirmed merely by being present", () => {
  const input = manual();
  input.memory.totalRamConfirmed = false;
  input.accelerators[0].memoryConfirmed = false;
  const result = resolveManualHardware(input);
  assert.equal(result.state, "confirmation-required");
  assert.equal(result.target?.fieldOrigins["/memory/totalRamBytes"], "self-reported");
  assert.equal(result.target?.fieldOrigins["/accelerators/0/deviceMemoryBytes"], "self-reported");
});

test("invalid manual values fail closed instead of emitting an invalid M-A target", () => {
  const input = manual();
  input.memory.totalRamBytes = 0;
  input.accelerators[0].count = 0;
  const result = resolveManualHardware(input);
  assert.equal(result.state, "unavailable");
  assert.equal(result.target, null);
  assert.deepEqual(result.reasonCodes, ["hardware.invalid-manual-input"]);
  assert.ok(result.confirmationFields.includes("/memory/totalRamBytes"));
  assert.ok(result.confirmationFields.includes("/accelerators/0/count"));
});

test("Apple unified memory remains one shared pool and is never silently added", () => {
  const result = resolveManualHardware(manual({
    os: { family: "macos", version: "26" },
    memory: {
      totalRamBytes: 24 * GIB,
      availableRamBytes: null,
      unified: true,
      totalRamConfirmed: true,
    },
    accelerators: [{
      acceleratorId: "apple-m5",
      displayName: "Apple M5",
      vendor: "apple",
      backend: "metal",
      deviceMemoryBytes: 24 * GIB,
      memoryConfirmed: true,
    }],
  }));
  assert.equal(result.state, "ready");
  assert.equal(result.target?.memory.totalRamBytes, 24 * GIB);
  assert.equal(result.target?.accelerators[0].deviceMemoryBytes, 24 * GIB);
  assert.equal(result.target?.memory.unified, true);
  assert.equal("combinedMemoryBytes" in (result.target?.memory ?? {}), false);
});

test("contradictory Apple unified-memory capacities require confirmation", () => {
  const result = resolveManualHardware(manual({
    os: { family: "macos", version: "26" },
    memory: {
      totalRamBytes: 16 * GIB,
      availableRamBytes: null,
      unified: true,
      totalRamConfirmed: true,
    },
    accelerators: [{
      acceleratorId: "apple-m5",
      displayName: "Apple M5",
      vendor: "apple",
      backend: "metal",
      deviceMemoryBytes: 24 * GIB,
      memoryConfirmed: true,
    }],
  }));
  assert.equal(result.state, "confirmation-required");
  assert.ok(result.reasonCodes.includes("hardware.unified-memory-mismatch"));
});

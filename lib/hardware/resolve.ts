import { accelerators as defaultRegistry, findAccelerator } from "../accelerators";
import type { AcceleratorEntry } from "../accelerators";
import type {
  AcceleratorBackend,
  AcceleratorVendor,
  HardwareTarget,
  Origin,
  OsFamily,
} from "../contracts";

const GIB = 1024 ** 3;

export type HardwareResolutionState = "ready" | "confirmation-required" | "unavailable";

export type HardwareResolution = {
  state: HardwareResolutionState;
  target: HardwareTarget | null;
  reasonCodes: string[];
  confirmationFields: string[];
  memoryVariantOptions: MemoryVariantOption[];
  warnings: string[];
};

export type MemoryVariantOption = {
  field: string;
  bytes: number;
  note: string | null;
  sourceUrl: string;
};

export type ManualAcceleratorInput = {
  acceleratorId: string | null;
  displayName: string;
  vendor: AcceleratorVendor;
  backend: AcceleratorBackend;
  deviceMemoryBytes: number | null;
  memoryConfirmed: boolean;
  count?: number;
};

export type ManualHardwareInput = {
  hardwareTargetId: string;
  os: { family: OsFamily; version: string | null };
  cpu: { displayName: string | null; logicalCores: number | null };
  memory: {
    totalRamBytes: number;
    availableRamBytes: number | null;
    unified: boolean | null;
    totalRamConfirmed: boolean;
  };
  accelerators: ManualAcceleratorInput[];
};

/**
 * Maps the no-install website's explicit form values to M-A. This function has
 * no detection or I/O path. Registry variants are validation choices only:
 * they are never inserted as if the user had confirmed them.
 */
export function resolveManualHardware(
  input: ManualHardwareInput,
  registry: AcceleratorEntry[] = defaultRegistry,
): HardwareResolution {
  const reasonCodes: string[] = [];
  const confirmationFields: string[] = [];
  const memoryVariantOptions: MemoryVariantOption[] = [];
  const warnings: string[] = [];

  const invalidFields = invalidManualFields(input);
  if (invalidFields.length > 0) {
    return {
      state: "unavailable",
      target: null,
      reasonCodes: ["hardware.invalid-manual-input"],
      confirmationFields: invalidFields,
      memoryVariantOptions,
      warnings: ["Hardware values must use non-empty identities and valid whole-byte capacities."],
    };
  }
  const fieldOrigins: Record<string, Origin> = {
    "/hardwareTargetId": "imported",
    "/os/family": "self-reported",
    "/os/version": input.os.version === null ? "unknown" : "self-reported",
    "/cpu/displayName": input.cpu.displayName === null ? "unknown" : "self-reported",
    "/cpu/logicalCores": input.cpu.logicalCores === null ? "unknown" : "self-reported",
    "/memory/totalRamBytes": input.memory.totalRamConfirmed ? "confirmed" : "self-reported",
    "/memory/availableRamBytes": input.memory.availableRamBytes === null ? "unknown" : "self-reported",
    "/memory/unified": input.memory.unified === null ? "unknown" : "self-reported",
    "/accelerators": "self-reported",
  };

  if (!input.memory.totalRamConfirmed) {
    reasonCodes.push("hardware.total-memory-confirmation-required");
    confirmationFields.push("/memory/totalRamBytes");
  }

  const mapped = input.accelerators.map((accelerator, index) => {
    const prefix = `/accelerators/${index}`;
    const entry = accelerator.acceleratorId === null
      ? undefined
      : findAccelerator(accelerator.acceleratorId, registry);

    let stableId: string | null = entry?.id ?? null;
    const displayName = entry?.marketingName ?? accelerator.displayName;
    const vendor: AcceleratorVendor = entry?.vendor ?? accelerator.vendor;
    const backend: AcceleratorBackend = entry
      ? backendForVendor(entry.vendor)
      : accelerator.backend;

    fieldOrigins[`${prefix}/acceleratorId`] = entry ? "imported" : "unknown";
    fieldOrigins[`${prefix}/displayName`] = entry ? "imported" : "self-reported";
    fieldOrigins[`${prefix}/kind`] = entry ? "imported" : "self-reported";
    fieldOrigins[`${prefix}/vendor`] = entry ? "imported" : "self-reported";
    fieldOrigins[`${prefix}/backend`] = entry ? "imported" : "self-reported";
    fieldOrigins[`${prefix}/deviceMemoryBytes`] = accelerator.memoryConfirmed
      ? "confirmed"
      : accelerator.deviceMemoryBytes === null ? "unknown" : "self-reported";
    fieldOrigins[`${prefix}/count`] = "self-reported";

    if (entry) {
      memoryVariantOptions.push(...entry.memoryVariants.map((variant) => ({
        field: `${prefix}/deviceMemoryBytes`,
        bytes: Math.round(variant.memoryGb * GIB),
        note: variant.note ?? null,
        sourceUrl: entry.sourceUrl,
      })));
    }

    if (!entry) {
      stableId = null;
      reasonCodes.push("hardware.unknown-accelerator");
      confirmationFields.push(`${prefix}/acceleratorId`);
      warnings.push(`${displayName || "Unknown accelerator"} is not in the vendor-sourced registry.`);
      if (!accelerator.memoryConfirmed || accelerator.deviceMemoryBytes === null) {
        confirmationFields.push(`${prefix}/deviceMemoryBytes`);
      }
    } else if (accelerator.deviceMemoryBytes === null) {
      reasonCodes.push(entry.memoryVariants.length > 1
        ? "hardware.memory-variant-ambiguous"
        : "hardware.device-memory-confirmation-required");
      confirmationFields.push(`${prefix}/deviceMemoryBytes`);
    } else if (!matchesVariant(accelerator.deviceMemoryBytes, entry)) {
      reasonCodes.push("hardware.device-memory-registry-mismatch");
      confirmationFields.push(`${prefix}/deviceMemoryBytes`);
      warnings.push(`${entry.marketingName} memory does not match a sourced registry variant.`);
    } else if (!accelerator.memoryConfirmed) {
      reasonCodes.push("hardware.device-memory-confirmation-required");
      confirmationFields.push(`${prefix}/deviceMemoryBytes`);
    }

    if (entry?.vendor === "apple" && input.memory.unified !== true) {
      reasonCodes.push("hardware.unified-memory-confirmation-required");
      confirmationFields.push("/memory/unified");
    }
    if (
      entry?.vendor === "apple"
      && input.memory.unified === true
      && accelerator.deviceMemoryBytes !== null
      && accelerator.deviceMemoryBytes !== input.memory.totalRamBytes
    ) {
      reasonCodes.push("hardware.unified-memory-mismatch");
      confirmationFields.push("/memory/totalRamBytes", `${prefix}/deviceMemoryBytes`);
      warnings.push("Apple unified memory is one shared pool; system and device capacities must not be added together.");
    }

    return {
      acceleratorId: stableId,
      displayName,
      kind: vendor,
      vendor,
      backend,
      deviceMemoryBytes: accelerator.deviceMemoryBytes,
      count: accelerator.count ?? 1,
    };
  });

  if (mapped.length > 1) {
    reasonCodes.push("hardware.multiple-device-selection-required");
    confirmationFields.push("/accelerators");
  }

  const target: HardwareTarget = {
    hardwareTargetId: input.hardwareTargetId,
    os: input.os,
    cpu: input.cpu,
    memory: {
      totalRamBytes: input.memory.totalRamBytes,
      availableRamBytes: input.memory.availableRamBytes,
      unified: input.memory.unified,
    },
    accelerators: mapped,
    fieldOrigins,
  };

  return {
    state: reasonCodes.length === 0 ? "ready" : "confirmation-required",
    target,
    reasonCodes: unique(reasonCodes),
    confirmationFields: unique(confirmationFields),
    memoryVariantOptions,
    warnings: unique(warnings),
  };
}

function invalidManualFields(input: ManualHardwareInput): string[] {
  const invalid: string[] = [];
  if (input.hardwareTargetId.trim() === "") invalid.push("/hardwareTargetId");
  if (input.cpu.logicalCores !== null && !isPositiveInteger(input.cpu.logicalCores)) {
    invalid.push("/cpu/logicalCores");
  }
  if (!isPositiveInteger(input.memory.totalRamBytes)) invalid.push("/memory/totalRamBytes");
  if (
    input.memory.availableRamBytes !== null
    && (!isNonNegativeInteger(input.memory.availableRamBytes)
      || input.memory.availableRamBytes > input.memory.totalRamBytes)
  ) {
    invalid.push("/memory/availableRamBytes");
  }
  input.accelerators.forEach((accelerator, index) => {
    if (accelerator.displayName.trim() === "") invalid.push(`/accelerators/${index}/displayName`);
    if (accelerator.deviceMemoryBytes !== null && !isPositiveInteger(accelerator.deviceMemoryBytes)) {
      invalid.push(`/accelerators/${index}/deviceMemoryBytes`);
    }
    if (!isPositiveInteger(accelerator.count ?? 1)) invalid.push(`/accelerators/${index}/count`);
  });
  return unique(invalid);
}

function isPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function matchesVariant(bytes: number, entry: AcceleratorEntry): boolean {
  return entry.memoryVariants.some((variant) => bytes === Math.round(variant.memoryGb * GIB));
}

function backendForVendor(vendor: AcceleratorEntry["vendor"]): AcceleratorBackend {
  return vendor === "nvidia" ? "cuda" : "metal";
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export type MemoryPoolProfile = {
  modelBytes: number;
  computeFixedBytes: number;
  contextBytesAtReference: number;
  computeContextBytesAtReference: number;
  referenceContextTokens: number;
};

export type TwoPoolFitProfile = {
  id: string;
  maxContextTokens: number;
  device: MemoryPoolProfile;
  host: MemoryPoolProfile;
};

export type TwoPoolHardware = {
  devicePhysicalBytes: number;
  hostPhysicalBytes: number;
  deviceReserveBytes: number;
  hostReserveBytes: number;
  safetyMarginBps: number;
};

export type MemoryPoolBreakdown = {
  modelBytes: number;
  contextBytes: number;
  computeBytes: number;
  reserveBytes: number;
  safetyMarginBytes: number;
  requiredBytes: number;
  physicalBytes: number;
  fits: boolean;
};

export type TwoPoolFitResult = {
  fits: boolean;
  device: MemoryPoolBreakdown;
  host: MemoryPoolBreakdown;
  reasons: string[];
};

/** Pure device+host capacity check for partial-offload configurations. */
export function fitMemoryPools(profile: TwoPoolFitProfile, hardware: TwoPoolHardware, contextTokens: number): TwoPoolFitResult {
  positive(profile.maxContextTokens, "Maximum context");
  positive(contextTokens, "Context");
  validateHardware(hardware);
  const device = fitPool(profile.device, hardware.devicePhysicalBytes, hardware.deviceReserveBytes, hardware.safetyMarginBps, contextTokens);
  const host = fitPool(profile.host, hardware.hostPhysicalBytes, hardware.hostReserveBytes, hardware.safetyMarginBps, contextTokens);
  const reasons: string[] = [];
  if (contextTokens > profile.maxContextTokens) reasons.push(`Requested context ${contextTokens} exceeds profile limit ${profile.maxContextTokens}.`);
  if (!device.fits) reasons.push(`Device pool requires ${device.requiredBytes} bytes but has ${device.physicalBytes}.`);
  if (!host.fits) reasons.push(`Host pool requires ${host.requiredBytes} bytes but has ${host.physicalBytes}.`);
  return { fits: reasons.length === 0, device, host, reasons };
}

function fitPool(profile: MemoryPoolProfile, physicalBytes: number, reserveBytes: number, safetyMarginBps: number, contextTokens: number): MemoryPoolBreakdown {
  for (const [value, label] of [[profile.modelBytes, "Model"], [profile.computeFixedBytes, "Fixed compute"], [profile.contextBytesAtReference, "Context reference"], [profile.computeContextBytesAtReference, "Compute context reference"]] as const) nonNegative(value, label);
  positive(profile.referenceContextTokens, "Reference context");
  const contextBytes = scale(profile.contextBytesAtReference, contextTokens, profile.referenceContextTokens);
  const computeBytes = add(profile.computeFixedBytes, scale(profile.computeContextBytesAtReference, contextTokens, profile.referenceContextTokens));
  const workload = add(add(profile.modelBytes, contextBytes), computeBytes);
  const safetyMarginBytes = scale(workload, safetyMarginBps, 10_000);
  const requiredBytes = add(add(workload, reserveBytes), safetyMarginBytes);
  return { modelBytes: profile.modelBytes, contextBytes, computeBytes, reserveBytes, safetyMarginBytes, requiredBytes, physicalBytes, fits: requiredBytes <= physicalBytes };
}

function validateHardware(hardware: TwoPoolHardware) {
  positive(hardware.devicePhysicalBytes, "Device memory");
  positive(hardware.hostPhysicalBytes, "Host memory");
  nonNegative(hardware.deviceReserveBytes, "Device reserve");
  nonNegative(hardware.hostReserveBytes, "Host reserve");
  nonNegative(hardware.safetyMarginBps, "Safety margin");
  if (hardware.safetyMarginBps > 10_000) throw new TypeError("Safety margin cannot exceed 10000 basis points.");
}

function scale(value: number, numerator: number, denominator: number) {
  const result = (BigInt(value) * BigInt(numerator) + BigInt(denominator) - BigInt(1)) / BigInt(denominator);
  const converted = Number(result);
  if (!Number.isSafeInteger(converted)) throw new RangeError("Memory calculation exceeds the safe integer range.");
  return converted;
}

function add(left: number, right: number) {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new RangeError("Memory calculation exceeds the safe integer range.");
  return result;
}

function positive(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${label} must be a positive safe integer.`);
}

function nonNegative(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label} must be a non-negative safe integer.`);
}

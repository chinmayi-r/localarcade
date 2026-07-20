export type AcceleratorVendor = "nvidia" | "apple";
export type AcceleratorKind = "gpu" | "integrated";

export type AcceleratorMemoryVariant = {
  memoryGb: number;
  memoryType?: string;
  /** Vendor-page qualifier when a size is tied to a specific configuration. */
  note?: string;
};

export type AcceleratorEntry = {
  id: string;
  vendor: AcceleratorVendor;
  marketingName: string;
  kind: AcceleratorKind;
  /** Aligns with `lib/priors` accelerator families for evidence matching. */
  family: string;
  memoryVariants: AcceleratorMemoryVariant[];
  /** Only present when the vendor page states one unambiguous figure. */
  memoryBandwidthGBps?: number;
  sourceUrl: string;
  retrievedAt: string;
};

export type AcceleratorSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  accelerators: AcceleratorEntry[];
};

/**
 * Memory derivation for the finder. Manual confirmation is always retained in
 * the UI; this only controls how confidently the field can be pre-filled.
 */
export type MemoryDerivation =
  | { kind: "single-variant"; memoryGb: number; variant: AcceleratorMemoryVariant; sourceUrl: string }
  | { kind: "multiple-variants"; variants: AcceleratorMemoryVariant[]; sourceUrl: string }
  | { kind: "unknown-accelerator"; reason: string };

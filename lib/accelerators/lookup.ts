import type { AcceleratorEntry, MemoryDerivation } from "./types";

export function findAccelerator(id: string, entries: AcceleratorEntry[]): AcceleratorEntry | undefined {
  return entries.find((entry) => entry.id === id);
}

/**
 * Derives memory options for a selected accelerator. Fails closed on unknown
 * ids: the finder must fall back to manually confirmed memory, never to a
 * guessed value (AGENTS.md: a platform label does not identify the device).
 */
export function deriveMemory(id: string, entries: AcceleratorEntry[]): MemoryDerivation {
  const entry = findAccelerator(id, entries);
  if (!entry) return { kind: "unknown-accelerator", reason: `No vendor-sourced entry for "${id}"; memory must be entered and confirmed manually.` };
  if (entry.memoryVariants.length === 1) {
    return { kind: "single-variant", memoryGb: entry.memoryVariants[0].memoryGb, variant: entry.memoryVariants[0], sourceUrl: entry.sourceUrl };
  }
  return { kind: "multiple-variants", variants: entry.memoryVariants, sourceUrl: entry.sourceUrl };
}

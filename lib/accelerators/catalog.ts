import snapshotJson from "../../registry/generated/accelerators.json";
import type { AcceleratorSnapshot } from "./types";

export const acceleratorSnapshot = snapshotJson as AcceleratorSnapshot;
export const accelerators = acceleratorSnapshot.accelerators;

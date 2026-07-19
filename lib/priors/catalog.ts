import snapshotJson from "../../registry/generated/throughput-priors.json";
import type { ThroughputPriorSnapshot } from "./types";

export const throughputPriorSnapshot = snapshotJson as ThroughputPriorSnapshot;
export const throughputPriors = throughputPriorSnapshot.priors;

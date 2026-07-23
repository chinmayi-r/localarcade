import type { ProductionReadiness } from "./types";

export function productionReadiness(): ProductionReadiness {
  return {
    schemaVersion: 1,
    status: "unavailable",
    reasonCode: "fit.production-profile-unavailable",
    message:
      "No reviewed production profile and owner-approved capacity policy are available.",
    missing: [
      "reviewed production profile manifest entry",
      "owner-approved capacity policy manifest entry",
      "owner decision: per-machine versus hardware-equivalence scope",
      "owner-approved collection and false-fit/no-fit protocol",
    ],
    productionProfile: null,
    selectedPolicy: null,
  };
}

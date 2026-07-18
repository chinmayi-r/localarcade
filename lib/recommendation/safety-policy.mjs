/**
 * Product policy for recommendation and verification routing.
 * This module deliberately contains no device access or download code.
 */

export const dimensions = Object.freeze({
  hardware: ["complete", "partial", "unsupported"],
  evidence: ["exact", "similar", "metadata", "none"],
  runner: ["available", "absent", "declined"],
  artifact: ["exact-candidate", "compatible-other", "unverified", "none"],
  network: ["online-unmetered", "online-metered", "offline"],
});

export const blockingConditions = Object.freeze([
  "insufficient-storage",
  "artifact-hash-mismatch",
  "unsupported-runtime",
  "license-not-accepted",
  "battery-low",
  "thermal-pressure",
  "memory-pressure",
  "device-in-use",
]);

const blockerMessages = Object.freeze({
  "insufficient-storage": "Free storage before downloading or loading this artifact.",
  "artifact-hash-mismatch": "The local file does not match the expected artifact. Do not execute it.",
  "unsupported-runtime": "This runtime cannot execute the selected artifact on this platform.",
  "license-not-accepted": "Accept the model license at its source before downloading or running it.",
  "battery-low": "Connect power or explicitly override the battery safeguard.",
  "thermal-pressure": "Wait for the device to cool before benchmarking.",
  "memory-pressure": "Close memory-heavy applications or select a smaller artifact.",
  "device-in-use": "Wait for an idle window or explicitly start the run now.",
});

function rankingFor(state) {
  if (state.hardware === "partial") {
    return { kind: "none", label: "Hardware details needed", confidence: "none", reason: "Minimum memory and accelerator details are missing." };
  }
  if (state.hardware === "unsupported") {
    return { kind: "compatibility-only", label: "Research preview", confidence: "none", reason: "The platform is not yet covered by the performance model." };
  }
  switch (state.evidence) {
    case "exact":
      return { kind: "verified", label: "Verified match", confidence: "high", reason: "Evidence matches hardware, runtime, artifact, settings, and task." };
    case "similar":
      return { kind: "community", label: "Community-tested", confidence: "medium", reason: "Evidence comes from comparable, not identical, configurations." };
    case "metadata":
      return { kind: "estimated", label: "Estimated top five", confidence: "low", reason: "Ranking uses fit calculations and public artifact evidence." };
    case "none":
      return { kind: "compatibility-only", label: "Compatible models", confidence: "none", reason: "There is not enough evidence to order compatible candidates." };
    default:
      throw new TypeError(`Unknown evidence state: ${state.evidence}`);
  }
}

function benchmarkFor(state) {
  if (state.runner === "declined") return { action: "none", reason: "The user declined the runner. Do not ask again in this session." };
  if (state.runner === "absent") return { action: "offer-runner", reason: "Recommendations work without installation; the runner is optional." };
  if (state.hardware !== "complete") return { action: "none", reason: "Benchmarking is unavailable until the platform is supported and detected." };

  if (state.artifact === "unverified") {
    return { action: "verify-artifact", reason: "Hash and metadata must be verified before execution." };
  }
  if (state.artifact === "exact-candidate") {
    return { action: "offer-exact-test", reason: "Verify the selected recommendation on this machine." };
  }
  if (state.artifact === "compatible-other") {
    return { action: "offer-existing-test", reason: "Test the installed artifact without requiring a download." };
  }
  if (state.network === "offline") {
    return { action: "none", reason: "No compatible artifact is installed and the device is offline." };
  }
  if (state.network === "online-metered") {
    return { action: "offer-metered-download", reason: "Show exact size and cost warning; require artifact-specific consent." };
  }
  return { action: "offer-download", reason: "Show exact artifact, source, hash, size, and license; require artifact-specific consent." };
}

/**
 * @param {{hardware:string,evidence:string,runner:string,artifact:string,network:string,
 * blockers?:string[], downloadConsent?:boolean, runConsent?:boolean}} state
 */
export function decideRecommendation(state) {
  for (const [dimension, allowed] of Object.entries(dimensions)) {
    if (!allowed.includes(state[dimension])) throw new TypeError(`Unknown ${dimension} state: ${state[dimension]}`);
  }

  const ranking = rankingFor(state);
  let benchmark = benchmarkFor(state);
  const blocker = (state.blockers ?? []).find((value) => blockingConditions.includes(value));

  if (blocker && !["none", "offer-runner"].includes(benchmark.action)) {
    benchmark = { action: "blocked", blocker, reason: blockerMessages[blocker] };
  }

  const downloadAuthorized = Boolean(state.downloadConsent) && ["offer-download", "offer-metered-download"].includes(benchmark.action) && !blocker;
  const runAuthorized = Boolean(state.runConsent) && ["offer-exact-test", "offer-existing-test"].includes(benchmark.action) && !blocker;

  return {
    ranking,
    benchmark,
    authorization: {
      mayDownload: downloadAuthorized,
      mayExecute: runAuthorized,
    },
    claims: {
      maySayBest: false,
      maySayVerified: ranking.kind === "verified",
      mustShowProvenance: true,
      mustShowUncertainty: true,
    },
  };
}

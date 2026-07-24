/**
 * Research bridge from the shared runner receipt to the raw M-F collection
 * machinery. The shared receipt contract itself lives below M-F so every
 * consumer, including the desktop surface, validates the same content.
 */
export {
  RUNNER_FIT_PROFILE_CAPTURE_CONTRACT,
  RUNNER_FIT_PROFILE_CAPTURE_PROTOCOL,
  RUNNER_FIT_PROFILE_CAPTURE_SCHEMA_VERSION,
  validateRunnerFitProfileCapture,
} from "../../lib/assessment/runner-fit-profile-capture";
export type {
  RunnerFitProfileCaptureAttempt,
  RunnerFitProfileCapturePool,
  RunnerFitProfileCaptureV1,
  TrustedCaptureValidation,
} from "../../lib/assessment/runner-fit-profile-capture";

import {
  validateRunnerFitProfileCapture,
  type RunnerFitProfileCaptureV1,
} from "../../lib/assessment/runner-fit-profile-capture";
import { deriveProposedProfile } from "./derive";
import type { ProfileCollectionBundleV1, ProfileDerivation } from "./types";

/**
 * Converts a verified runner receipt into the existing raw collection shape.
 * The resulting M-F record remains `proposed-unreviewed`: manifest review is
 * a separate, explicit admission boundary.
 */
export function deriveProposedProfileFromRunnerCapture(
  value: unknown,
): ProfileDerivation {
  const validation = validateRunnerFitProfileCapture(value);
  if (validation.kind === "blocked") return validation;
  const capture = validation.value;
  const bundle: ProfileCollectionBundleV1 = toCollectionBundle(capture);
  const result = deriveProposedProfile(bundle, {
    trustedCaptureContentHash: capture.contentHash,
  });
  if (result.kind === "proposed-unreviewed") {
    return {
      ...result,
      warning:
        "Runner-owned local capture is content-bound but remains proposed-unreviewed; it cannot recommend until an exact reviewed profile manifest admits it.",
    };
  }
  return result;
}

function toCollectionBundle(
  capture: RunnerFitProfileCaptureV1,
): ProfileCollectionBundleV1 {
  return {
    schemaVersion: 1,
    contract: "mf-profile-collection-bundle",
    collectionId: capture.captureId,
    collectionVersion: capture.captureVersion,
    evidenceClassification: "local-measurement",
    candidate: structuredClone(capture.candidate),
    compatibilityReceipt: structuredClone(capture.compatibilityReceipt),
    hardwareTarget: structuredClone(capture.hardwareTarget),
    bindings: {
      candidateContentSha256: capture.bindings.candidateContentSha256,
      compatibilityReceiptContentSha256:
        capture.bindings.compatibilityReceiptContentSha256,
      hardwareTargetContentSha256: capture.bindings.hardwareTargetContentSha256,
      artifactSha256: capture.bindings.artifactSha256,
    },
    tool: {
      id: capture.tool.id,
      version: capture.tool.version,
      executableSha256: capture.tool.executableSha256,
    },
    command: { argv: structuredClone(capture.command.argvTemplate) },
    runPath: "gpu",
    contexts: structuredClone(capture.contexts),
  };
}

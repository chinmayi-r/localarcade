/**
 * Versioned M-J/M-O planning policy for the approved existing-engine slice.
 *
 * M-P supplies only opaque producer handles and a local sequence number. It
 * does not choose prompts, checks, run counts, protocols, or measurement kinds.
 * The Rust M-J boundary independently rejects any drift from its fixed checks
 * and protocol limits.
 */
export const VERIFICATION_PLAN_POLICY_V1 =
  "local-arcade-existing-engine-verification-v1";

export type VerificationPlanPolicyInput = Readonly<{
  importHandle: string;
  hardwareHandle: string;
  selectionHandle: string;
  benchmarkToolHandle: string;
  quickCheckToolHandle: string;
}>;

export function createVerificationPlanRequestV1(
  input: VerificationPlanPolicyInput,
): Record<string, unknown> {
  for (const [field, value] of Object.entries(input)) {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`m-o.verification-policy.${field}-required`);
    }
  }
  return {
    policyId: VERIFICATION_PLAN_POLICY_V1,
    importHandle: input.importHandle,
    hardwareHandle: input.hardwareHandle,
    selectionHandle: input.selectionHandle,
    benchmarkToolHandle: input.benchmarkToolHandle,
    quickCheckToolHandle: input.quickCheckToolHandle,
  };
}

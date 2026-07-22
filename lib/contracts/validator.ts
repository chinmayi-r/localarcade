import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "../../docs/contracts/local-arcade-first-slice-v1.schema.json";
import { handoffContentHash } from "./canonical";
import type { ContractEnvelope, RecommendationPortfolio, RunnerHandoff, VerificationPlan } from "./types";

const validateSchema = addFormats(new Ajv2020({ allErrors: true, strict: true })).compile(schema);
export type ContractValidation = { ok: true; value: ContractEnvelope } | { ok: false; errors: string[] };

function semanticErrors(value: ContractEnvelope): string[] {
  if (value.status !== "ok" && value.status !== "partial") return [];
  const errors: string[] = [];
  if (value.contract === "recommendation-portfolio") {
    const portfolio = value.data as RecommendationPortfolio;
    const families = portfolio.items.map((item) => item.modelFamilyId);
    if (new Set(families).size !== families.length) errors.push("portfolio model families must be distinct");
  }
  if (value.contract === "runner-handoff") {
    const handoff = value.data as RunnerHandoff;
    if (Date.parse(handoff.expiresAt) - Date.parse(handoff.createdAt) !== 86_400_000) errors.push("handoff expiry must be exactly 24 hours");
    if (handoff.contentHash !== handoffContentHash(handoff)) errors.push("handoff contentHash does not match its canonical snapshot");
  }
  if (value.contract === "verification-plan") {
    const plan = value.data as VerificationPlan;
    if (plan.benchmarkPlan === null && plan.quickCheckPlan === null) errors.push("verification plan must contain at least one typed plan");
  }
  return errors;
}

export function validateContract(value: unknown): ContractValidation {
  if (!validateSchema(value)) {
    return { ok: false, errors: (validateSchema.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`) };
  }
  const envelope = value as ContractEnvelope;
  const errors = semanticErrors(envelope);
  return errors.length ? { ok: false, errors } : { ok: true, value: envelope };
}

export function parseContract(json: string): ContractValidation {
  try { return validateContract(JSON.parse(json)); }
  catch (error) { return { ok: false, errors: [error instanceof Error ? error.message : "invalid JSON"] }; }
}

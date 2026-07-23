import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "../../docs/contracts/local-arcade-first-slice-v1.schema.json";
import { canonicalJson, handoffContentHash } from "./canonical";
import type { BenchmarkResult, ContractEnvelope, MeasurementSeries, RecommendationPortfolio, RunnerHandoff, VerificationPlan, VerificationResult } from "./types";

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
    for (const nested of [plan.benchmarkPlan, plan.quickCheckPlan]) {
      if (nested !== null && nested.candidateId !== plan.candidateId) errors.push("verification plan candidateId must match every nested plan");
    }
    if (plan.benchmarkPlan !== null && plan.quickCheckPlan !== null) {
      if (plan.benchmarkPlan.artifactPath !== plan.quickCheckPlan.artifactPath
        || plan.benchmarkPlan.expectedArtifactSha256 !== plan.quickCheckPlan.expectedArtifactSha256) {
        errors.push("verification plan artifact path and hash must match across nested plans");
      }
      if (plan.benchmarkPlan.runtime.runtimeConfigurationId === plan.quickCheckPlan.runtime.runtimeConfigurationId
        && canonicalJson(plan.benchmarkPlan.runtime) !== canonicalJson(plan.quickCheckPlan.runtime)) {
        errors.push("one runtimeConfigurationId cannot identify different runtime values");
      }
    }
  }
  if (value.contract === "benchmark-result") errors.push(...measurementSeriesErrors((value.data as BenchmarkResult).series));
  if (value.contract === "verification-result") {
    const result = value.data as VerificationResult;
    const benchmark = result.benchmarkResult;
    if (benchmark !== null) errors.push(...measurementSeriesErrors(benchmark.series));
    for (const nested of [result.benchmarkResult, result.quickCheckResult]) {
      if (nested !== null && nested.candidateId !== result.candidateId) errors.push("verification result candidateId must match every nested result");
    }
    if (result.domainStatus === "completed" && [result.benchmarkResult, result.quickCheckResult]
      .some((nested) => nested !== null && nested.domainStatus !== "completed")) {
      errors.push("completed verification result cannot contain an incomplete nested result");
    }
  }
  return errors;
}

function measurementSeriesErrors(series: MeasurementSeries[]): string[] {
  const errors: string[] = [];
  for (const item of series) {
    const measurement = item.evidence.measurement;
    if (item.evidence.sampleCount !== item.measuredSamples.length) errors.push(`${item.kind} sampleCount must equal measuredSamples length`);
    if (measurement === null) continue;
    if (measurement.unit !== item.unit) errors.push(`${item.kind} evidence unit must equal series unit`);
    if (item.aggregate !== null && measurement.confidence === null && measurement.interval !== null
      && (measurement.interval.lower !== item.aggregate.minimum || measurement.interval.upper !== item.aggregate.maximum)) {
      errors.push(`${item.kind} unqualified evidence interval must equal the measured aggregate range`);
    }
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

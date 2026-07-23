import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "../../docs/contracts/local-arcade-first-slice-v1.schema.json";
import { canonicalJson, handoffContentHash, runnerImportBundleContentHash } from "./canonical";
import type { BenchmarkResult, CompatibilityAdmissionReceipt, ContractEnvelope, MeasurementSeries, RecommendationPortfolio, RunnerHandoff, RunnerImportBundle, VerificationPlan, VerificationResult } from "./types";

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
    errors.push(...runnerHandoffErrors(value.data as RunnerHandoff));
  }
  if (value.contract === "compatibility-admission-receipt") {
    errors.push(...compatibilityReceiptErrors(value.data as CompatibilityAdmissionReceipt));
  }
  if (value.contract === "runner-import-bundle") {
    const bundle = value.data as RunnerImportBundle;
    errors.push(...runnerHandoffErrors(bundle.handoff));
    errors.push(...compatibilityReceiptErrors(bundle.compatibilityAdmission));
    errors.push(...runnerImportBundleErrors(bundle));
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
    if (result.domainStatus === "completed" && result.benchmarkResult === null && result.quickCheckResult === null) {
      errors.push("completed verification result must contain at least one typed result");
    }
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

function runnerHandoffErrors(handoff: RunnerHandoff): string[] {
  const errors: string[] = [];
  if (Date.parse(handoff.expiresAt) - Date.parse(handoff.createdAt) !== 86_400_000) errors.push("handoff expiry must be exactly 24 hours");
  if (handoff.contentHash !== handoffContentHash(handoff)) errors.push("handoff contentHash does not match its canonical snapshot");
  return errors;
}

function runnerImportBundleErrors(bundle: RunnerImportBundle): string[] {
  const errors: string[] = [];
  const candidate = bundle.handoff.selectedCandidate;
  const receipt = bundle.compatibilityAdmission;
  if (bundle.contentHash !== runnerImportBundleContentHash(bundle)) errors.push("runner import contentHash does not match its canonical snapshot");
  if (receipt.candidateId !== candidate.candidateId) errors.push("runner import receipt candidateId must match handoff candidateId");
  if (receipt.artifactId !== candidate.artifact.artifactId) errors.push("runner import receipt artifactId must match handoff artifactId");
  if (receipt.artifactSha256 !== candidate.artifact.sha256) errors.push("runner import receipt artifactSha256 must match handoff artifactSha256");
  if (receipt.runtimeConfigurationId !== candidate.runtime.runtimeConfigurationId) errors.push("runner import receipt runtimeConfigurationId must match handoff runtimeConfigurationId");
  if (receipt.target.product !== candidate.runtime.product) errors.push("runner import receipt product must match handoff runtime product");
  if (receipt.target.engine !== candidate.runtime.engine) errors.push("runner import receipt engine must match handoff runtime engine");
  if (receipt.target.engineBuild !== candidate.runtime.engineBuild) errors.push("runner import receipt engineBuild must match handoff runtime engineBuild");
  if (receipt.target.operatingSystem !== bundle.handoff.hardwareTarget.os.family) errors.push("runner import receipt operatingSystem must match handoff hardware target");
  if (receipt.target.backend !== candidate.runtime.backend) errors.push("runner import receipt backend must match handoff runtime backend");
  if (receipt.target.quantizationScheme !== candidate.artifact.quantization) errors.push("runner import receipt quantization must match handoff artifact quantization");
  return errors;
}

function compatibilityReceiptErrors(receipt: CompatibilityAdmissionReceipt): string[] {
  const errors: string[] = [];
  const { assertion, target } = receipt;
  if (assertion.artifactId !== receipt.artifactId) errors.push("compatibility assertion artifactId must match receipt artifactId");
  if (assertion.productId !== target.product) errors.push("compatibility assertion productId must match target product");
  if (assertion.engineId !== target.engine) errors.push("compatibility assertion engineId must match target engine");
  if ((target.exactBuild ?? target.runtimeVersion) !== target.engineBuild) errors.push("compatibility target build identity must match engineBuild");
  const checks: Array<[string[] | null, string | null, string]> = [
    [assertion.conditions.operatingSystems, target.operatingSystem, "operating system"],
    [assertion.conditions.cpuArchitectures, target.cpuArchitecture, "CPU architecture"],
    [assertion.conditions.backends, target.backend, "backend"],
    [assertion.conditions.packageLayouts, target.packageLayout, "package layout"],
    [assertion.conditions.modelArchitectures, target.modelArchitecture, "model architecture"],
    [assertion.conditions.quantizationSchemes, target.quantizationScheme, "quantization scheme"],
  ];
  for (const [allowed, actual, label] of checks) {
    if (allowed !== null && (actual === null || !allowed.includes(actual))) errors.push(`compatibility target ${label} must satisfy the assertion`);
  }
  if (assertion.conditions.requiredFiles !== null
    && assertion.conditions.requiredFiles.some((file) => !target.declaredPackageFiles.includes(file))) {
    errors.push("compatibility target must contain every assertion-required package file");
  }
  if (target.declaredPackageFiles.some((file) => file.startsWith("/") || file.includes("\\") || file.split("/").includes("..") || /^[a-zA-Z]:/.test(file))) {
    errors.push("declared package files must be normalized relative members");
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

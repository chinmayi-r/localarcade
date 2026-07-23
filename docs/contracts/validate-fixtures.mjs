import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const directory = path.dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(fs.readFileSync(path.join(directory, "local-arcade-first-slice-v1.schema.json"), "utf8"));
const validate = addFormats(new Ajv2020({ allErrors: true, strict: true })).compile(schema);

function jsonFiles(folder) {
  return fs.readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(folder, entry.name)).sort();
}

const validFiles = jsonFiles(path.join(directory, "fixtures"));
const invalidFiles = jsonFiles(path.join(directory, "fixtures", "invalid"));
const failures = [];
const semanticNegativeCases = [];

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function semanticErrors(envelope) {
  const errors = [];
  if ((envelope.status === "ok" || envelope.status === "partial") && envelope.contract === "recommendation-portfolio") {
    const families = envelope.data.items.map((item) => item.modelFamilyId);
    if (new Set(families).size !== families.length) errors.push("portfolio model families must be distinct");
  }
  if ((envelope.status === "ok" || envelope.status === "partial") && envelope.contract === "runner-handoff") {
    const created = Date.parse(envelope.data.createdAt);
    const expires = Date.parse(envelope.data.expiresAt);
    if (expires - created !== 24 * 60 * 60 * 1000) errors.push("handoff expiry must be exactly 24 hours");
    const payload = structuredClone(envelope.data);
    const claimed = payload.contentHash;
    delete payload.contentHash;
    const actual = crypto.createHash("sha256").update(canonicalJson(payload)).digest("hex");
    if (claimed !== actual) errors.push("handoff contentHash does not match its canonical snapshot");
  }
  if ((envelope.status === "ok" || envelope.status === "partial") && envelope.contract === "compatibility-admission-receipt") {
    const { assertion, target } = envelope.data;
    if (assertion.artifactId !== envelope.data.artifactId) errors.push("compatibility assertion artifactId must match receipt artifactId");
    if (assertion.productId !== target.product) errors.push("compatibility assertion productId must match target product");
    if (assertion.engineId !== target.engine) errors.push("compatibility assertion engineId must match target engine");
    if ((target.exactBuild ?? target.runtimeVersion) !== target.engineBuild) errors.push("compatibility target build identity must match engineBuild");
    for (const [allowed, actual, label] of [
      [assertion.conditions.operatingSystems, target.operatingSystem, "operating system"],
      [assertion.conditions.cpuArchitectures, target.cpuArchitecture, "CPU architecture"],
      [assertion.conditions.backends, target.backend, "backend"],
      [assertion.conditions.packageLayouts, target.packageLayout, "package layout"],
      [assertion.conditions.modelArchitectures, target.modelArchitecture, "model architecture"],
      [assertion.conditions.quantizationSchemes, target.quantizationScheme, "quantization scheme"],
    ]) {
      if (allowed !== null && (actual === null || !allowed.includes(actual))) errors.push(`compatibility target ${label} must satisfy the assertion`);
    }
    if (assertion.conditions.requiredFiles !== null
        && assertion.conditions.requiredFiles.some((file) => !target.declaredPackageFiles.includes(file))) {
      errors.push("compatibility target must contain every assertion-required package file");
    }
    if (target.declaredPackageFiles.some((file) => file.startsWith("/") || file.includes("\\") || file.split("/").includes("..") || /^[a-zA-Z]:/.test(file))) {
      errors.push("declared package files must be normalized relative members");
    }
  }
  if ((envelope.status === "ok" || envelope.status === "partial") && envelope.contract === "verification-plan") {
    const plan = envelope.data;
    if (plan.benchmarkPlan === null && plan.quickCheckPlan === null) {
      errors.push("verification plan must contain at least one typed plan");
    }
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
  if ((envelope.status === "ok" || envelope.status === "partial") && envelope.contract === "verification-result") {
    const result = envelope.data;
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
  if (envelope.status === "ok" || envelope.status === "partial") {
    const benchmark = envelope.contract === "benchmark-result"
      ? envelope.data
      : envelope.contract === "verification-result" ? envelope.data.benchmarkResult : null;
    for (const series of benchmark?.series ?? []) {
      if (series.evidence.sampleCount !== series.measuredSamples.length) errors.push(`${series.kind} sampleCount must equal measuredSamples length`);
      const measurement = series.evidence.measurement;
      if (measurement && measurement.unit !== series.unit) errors.push(`${series.kind} evidence unit must equal series unit`);
      if (series.aggregate && measurement?.confidence === null && measurement.interval
          && (measurement.interval.lower !== series.aggregate.minimum || measurement.interval.upper !== series.aggregate.maximum)) {
        errors.push(`${series.kind} unqualified evidence interval must equal the measured aggregate range`);
      }
    }
  }
  return errors;
}

for (const file of validFiles) {
  const fixture = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!validate(fixture)) {
    failures.push(`${path.basename(file)} should be valid: ${JSON.stringify(validate.errors)}`);
  } else {
    for (const error of semanticErrors(fixture)) failures.push(`${path.basename(file)}: ${error}`);
  }
}

const planFixture = JSON.parse(fs.readFileSync(path.join(directory, "fixtures", "verification-plan.ok.json"), "utf8"));
const resultFixture = JSON.parse(fs.readFileSync(path.join(directory, "fixtures", "verification-result.ok.json"), "utf8"));
const compatibilityFixture = JSON.parse(fs.readFileSync(path.join(directory, "fixtures", "compatibility-admission-receipt.ok.json"), "utf8"));
for (const [name, base, mutate] of [
  ["runtime-id-conflict", planFixture, (value) => {
    value.data.quickCheckPlan.runtime.runtimeConfigurationId = value.data.benchmarkPlan.runtime.runtimeConfigurationId;
  }],
  ["nested-candidate-mismatch", planFixture, (value) => { value.data.quickCheckPlan.candidateId = "different-candidate"; }],
  ["nested-artifact-mismatch", planFixture, (value) => { value.data.quickCheckPlan.expectedArtifactSha256 = "b".repeat(64); }],
  ["completed-nested-status-mismatch", resultFixture, (value) => { value.data.quickCheckResult.domainStatus = "failed"; }],
  ["completed-empty-result", resultFixture, (value) => {
    value.data.benchmarkResult = null;
    value.data.quickCheckResult = null;
  }],
  ["compatibility-assertion-target-mismatch", compatibilityFixture, (value) => {
    value.data.assertion.productId = "different-product";
  }],
  ["compatibility-required-file-missing", compatibilityFixture, (value) => {
    value.data.target.declaredPackageFiles = ["different.gguf"];
  }],
]) {
  const value = structuredClone(base);
  mutate(value);
  semanticNegativeCases.push([name, value]);
}
for (const [name, fixture] of semanticNegativeCases) {
  if (validate(fixture) && semanticErrors(fixture).length === 0) failures.push(`${name} semantic negative should be rejected but passed`);
}

const runtimesById = new Map();
function recordRuntime(runtime, source) {
  if (!runtime) return;
  const serialized = canonicalJson(runtime);
  const previous = runtimesById.get(runtime.runtimeConfigurationId);
  if (previous && previous.serialized !== serialized) {
    failures.push(`runtimeConfigurationId ${runtime.runtimeConfigurationId} differs between ${previous.source} and ${source}`);
  } else {
    runtimesById.set(runtime.runtimeConfigurationId, { serialized, source });
  }
}
for (const file of validFiles) {
  const envelope = JSON.parse(fs.readFileSync(file, "utf8"));
  const data = envelope.data;
  recordRuntime(data?.runtime, path.basename(file));
  recordRuntime(data?.selectedCandidate?.runtime, path.basename(file));
  recordRuntime(data?.benchmarkPlan?.runtime, path.basename(file));
  recordRuntime(data?.quickCheckPlan?.runtime, path.basename(file));
}
for (const file of invalidFiles) {
  const fixture = JSON.parse(fs.readFileSync(file, "utf8"));
  if (validate(fixture) && semanticErrors(fixture).length === 0) {
    failures.push(`${path.basename(file)} should be rejected but passed`);
  }
}
if (validFiles.length === 0 || invalidFiles.length === 0) failures.push("both fixture sets must be non-empty");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${validFiles.length} positive fixtures, rejected ${invalidFiles.length} negative fixtures and ${semanticNegativeCases.length} semantic negative cases.`);
}

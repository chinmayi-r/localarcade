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
  if ((envelope.status === "ok" || envelope.status === "partial") && envelope.contract === "verification-plan") {
    if (envelope.data.benchmarkPlan === null && envelope.data.quickCheckPlan === null) {
      errors.push("verification plan must contain at least one typed plan");
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
  console.log(`Validated ${validFiles.length} positive fixtures and rejected ${invalidFiles.length} negative fixtures.`);
}

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const directory = dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(await readFile(join(directory, "apple-reference-record.schema.json"), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function semanticErrors(record) {
  const errors = [];
  for (const observation of record.observations) {
    if (observation.classification === "measurement" && observation.samples.length === 0) errors.push(`${observation.metric}: measurement requires samples`);
    if (observation.classification === "unknown" && (observation.samples.length > 0 || observation.interval !== null)) errors.push(`${observation.metric}: unknown cannot contain a value`);
    if (observation.interval && observation.interval.lower > observation.interval.upper) errors.push(`${observation.metric}: interval is reversed`);
  }
  if (record.illustrative && record.comparisonEligibility.eligible) errors.push("illustrative records cannot be comparison eligible");
  if (record.source.dataUse === "terms-unresolved" && record.comparisonEligibility.eligible) errors.push("records with unresolved data terms cannot be comparison eligible");
  if (record.comparisonEligibility.eligible) {
    const required = [
      [record.source.dataUse === "redistribution-approved" ? true : null, "approved row-level data use"],
      [record.hardware.machineModelIdentifier, "machine model"], [record.hardware.chipName, "chip name"], [record.hardware.chipVariant, "chip variant"],
      [record.hardware.gpuCoreCount, "GPU core count"], [record.hardware.availableMemoryBytes, "available memory"], [record.hardware.osVersion, "OS version"],
      [record.runtime.product, "runtime product"], [record.runtime.productVersion, "product version"], [record.runtime.engine, "engine"], [record.runtime.engineBuild, "engine build"],
      [record.runtime.backend, "backend"], [record.runtime.backendVersion, "backend version"], [record.runtime.artifact.repository, "artifact repository"],
      [record.runtime.artifact.revision, "artifact revision"], [record.runtime.artifact.filename, "artifact filename"], [record.runtime.artifact.sha256, "artifact hash"],
      [record.runtime.artifact.format, "artifact format"], [record.runtime.artifact.quantization, "artifact quantization"], [record.runtime.contextTokens, "context"],
      [record.runtime.kvCache.key, "K-cache type"], [record.runtime.kvCache.value, "V-cache type"], [record.runtime.kvCache.maximumTokens, "KV-cache limit"],
      [record.runtime.gpuLayers, "GPU-layer split"], [record.runtime.batchSize, "batch size"], [record.runtime.microBatchSize, "microbatch size"],
      [record.runtime.threads, "thread count"], [record.runtime.flashAttention, "flash-attention state"], [record.runtime.mmap, "mmap state"],
      [record.protocol.harnessId, "harness"], [record.protocol.promptId, "prompt"], [record.protocol.promptTokens, "prompt-token count"],
      [record.protocol.generatedTokens, "generated-token count"], [record.protocol.warmupRuns, "warmup count"], [record.protocol.seedStrategy === "unknown" ? null : record.protocol.seedStrategy, "seed strategy"],
      [record.protocol.powerState === "unknown" ? null : record.protocol.powerState, "power state"], [record.protocol.thermalState === "unknown" ? null : record.protocol.thermalState, "thermal state"],
      [record.protocol.concurrentLoad === "unknown" ? null : record.protocol.concurrentLoad, "concurrent-load state"],
    ];
    for (const [value, label] of required) if (value === null || value === undefined) errors.push(`comparison eligibility requires ${label}`);
    if (!record.observations.some((observation) => observation.classification === "measurement")) errors.push("comparison eligibility requires at least one measurement");
  }
  return errors;
}

async function readFixture(name) {
  return JSON.parse(await readFile(join(directory, "fixtures", name), "utf8"));
}

const valid = await readFixture("illustrative-reference.valid.json");
assert.equal(validateSchema(valid), true, JSON.stringify(validateSchema.errors));
assert.deepEqual(semanticErrors(valid), []);

const invalid = await readFixture("missing-identity.invalid.json");
assert.equal(validateSchema(invalid), true, "negative fixture must reach semantic validation");
assert.ok(semanticErrors(invalid).length >= 8, "negative fixture must fail closed on missing comparison identity");

const inventory = JSON.parse(await readFile(join(directory, "sources.json"), "utf8"));
assert.equal(new Set(inventory.sources.map((source) => source.id)).size, inventory.sources.length, "source IDs must be unique");
for (const source of inventory.sources) {
  assert.equal(new URL(source.url).protocol, "https:", `${source.id} must use HTTPS`);
  assert.ok(source.kind && source.use && source.dataReuse, `${source.id} must declare use and data disposition`);
}

console.log(`Apple research records: 1 valid fixture accepted; 1 semantic-negative fixture rejected; ${inventory.sources.length} primary sources inventoried.`);

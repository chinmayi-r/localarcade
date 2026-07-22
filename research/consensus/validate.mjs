import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const here = dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(readFileSync(join(here, "scenario.schema.json"), "utf8"));
const corpus = JSON.parse(readFileSync(join(here, "scenarios.json"), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function semanticErrors(value) {
  const errors = [];
  const sourceIds = new Set();
  for (const source of value.sources ?? []) {
    if (sourceIds.has(source.id)) errors.push(`duplicate source id: ${source.id}`);
    sourceIds.add(source.id);
    if (source.retrievedAt > value.asOf) errors.push(`source ${source.id} retrieved after corpus asOf`);
  }
  const scenarioIds = new Set();
  for (const scenario of value.scenarios ?? []) {
    if (scenarioIds.has(scenario.id)) errors.push(`duplicate scenario id: ${scenario.id}`);
    scenarioIds.add(scenario.id);
    if (scenario.status === "procedural-only" && scenario.mustConsider.length) errors.push(`procedural-only ${scenario.id} names candidates`);
    if (scenario.status === "sourced-prior" && !scenario.mustConsider.length) errors.push(`sourced-prior ${scenario.id} has no candidates`);
    const candidateIds = new Set();
    for (const candidate of scenario.mustConsider) {
      if (candidateIds.has(candidate.id)) errors.push(`duplicate candidate ${scenario.id}/${candidate.id}`);
      candidateIds.add(candidate.id);
      for (const sourceId of candidate.sourceIds) if (!sourceIds.has(sourceId)) errors.push(`unknown source ${sourceId}`);
    }
    for (const rule of scenario.mustNotRecommend) {
      for (const sourceId of rule.sourceIds) if (!sourceIds.has(sourceId)) errors.push(`unknown source ${sourceId}`);
    }
  }
  return errors;
}

function errorsFor(value) {
  const errors = [];
  if (!validateSchema(value)) errors.push(...validateSchema.errors.map((error) => `${error.instancePath || "/"} ${error.message}`));
  return errors.concat(semanticErrors(value));
}

const errors = errorsFor(corpus);
if (errors.length) throw new Error(`consensus corpus invalid:\n${errors.join("\n")}`);
const invalidFiles = readdirSync(join(here, "invalid")).filter((file) => file.endsWith(".json"));
for (const file of invalidFiles) {
  const fixture = JSON.parse(readFileSync(join(here, "invalid", file), "utf8"));
  if (!errorsFor(fixture).length) throw new Error(`invalid fixture accepted: ${file}`);
}
console.log(`Validated ${corpus.scenarios.length} consensus scenarios and rejected ${invalidFiles.length} invalid fixtures.`);

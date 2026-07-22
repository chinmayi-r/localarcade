import { readFile, readdir } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schema = JSON.parse(await readFile(new URL("./comparison-v1.schema.json", import.meta.url), "utf8"));
const validateSchema = addFormats(new Ajv2020({ allErrors: true, strict: true })).compile(schema);

function semanticErrors(value) {
  const errors = [];
  const sourceIds = new Set();
  for (const source of value.sources ?? []) {
    if (sourceIds.has(source.sourceId)) errors.push(`duplicate source: ${source.sourceId}`);
    sourceIds.add(source.sourceId);
    if (source.retrievalPrecision === "date" && !source.retrievedAt.endsWith("T00:00:00Z")) errors.push(`date-only source must use deterministic midnight UTC: ${source.sourceId}`);
  }
  const hardware = value.scenario?.hardware;
  if (hardware?.acceleratorVendor === "unknown") {
    if (hardware.acceleratorModel !== null) errors.push("unknown accelerator vendor must not have an invented model");
    if (value.scenario.constraints.allowedBackends.length) errors.push("unknown accelerator vendor must not have invented backends");
  }
  const guardCodes = new Set();
  for (const guard of value.scenario?.guards ?? []) {
    if (guardCodes.has(guard.code)) errors.push(`duplicate guard: ${guard.code}`);
    guardCodes.add(guard.code);
    for (const id of guard.sourceIds) if (!sourceIds.has(id)) errors.push(`unknown guard source: ${id}`);
  }
  const expectationIds = new Set();
  for (const expectation of value.scenario?.expectations ?? []) {
    if (expectationIds.has(expectation.expectationId)) errors.push(`duplicate expectation: ${expectation.expectationId}`);
    expectationIds.add(expectation.expectationId);
    for (const id of expectation.sourceIds) if (!sourceIds.has(id)) errors.push(`unknown expectation source: ${id}`);
  }
  for (const result of value.systemResults ?? []) {
    const facets = Object.values(result.mappingFacets);
    const derived = facets.includes("unsupported") ? "unsupported" : facets.includes("lossy") ? "lossy" : "exact";
    if (result.inputMapping !== derived) errors.push(`${result.systemId} inputMapping must equal worst facet ${derived}`);
    if (value.scenario.task.latencyPreference === "patient" && result.mappingFacets.task === "lossy" && !result.mappingAdjustments.some((item) => item.code === "PATIENT_TO_INTERACTIVE" && item.facet === "task")) errors.push(`${result.systemId} patient mapping loss requires PATIENT_TO_INTERACTIVE`);
    const assessed = new Set(result.guardAssessments.map((item) => item.guardCode));
    for (const code of guardCodes) if (!assessed.has(code)) errors.push(`${result.systemId} missing guard assessment: ${code}`);
    for (const code of assessed) if (!guardCodes.has(code)) errors.push(`${result.systemId} assesses unknown guard: ${code}`);
    if (hardware?.acceleratorVendor === "unknown" && result.candidates.length) errors.push(`${result.systemId} invented candidates for unknown hardware`);
    const candidateIds = new Set();
    const ranks = new Set();
    for (const candidate of result.candidates) {
      if (candidateIds.has(candidate.candidateId)) errors.push(`${result.systemId} duplicate candidate: ${candidate.candidateId}`);
      candidateIds.add(candidate.candidateId);
      if (candidate.disposition === "recommended" && candidate.rank === null) errors.push(`${candidate.candidateId} recommended without rank`);
      if (candidate.disposition === "excluded" && !candidate.exclusionCodes.length) errors.push(`${candidate.candidateId} excluded without stable code`);
      if (candidate.rank !== null) {
        if (ranks.has(candidate.rank)) errors.push(`${result.systemId} duplicate rank: ${candidate.rank}`);
        ranks.add(candidate.rank);
      }
      for (const observation of Object.values(candidate.observations)) {
        if (observation.lower > observation.upper) errors.push(`${candidate.candidateId} observation interval reversed`);
        for (const id of observation.sourceIds) if (!sourceIds.has(id)) errors.push(`${candidate.candidateId} unknown observation source: ${id}`);
      }
    }
  }
  return errors;
}

export function errorsFor(value) {
  const errors = [];
  if (!validateSchema(value)) errors.push(...validateSchema.errors.map((error) => `${error.instancePath || "/"} ${error.message}`));
  return errors.concat(semanticErrors(value));
}

const fixtureNames = await readdir(new URL("./fixtures/", import.meta.url));
let validCount = 0;
let invalidCount = 0;
for (const name of fixtureNames.filter((item) => item.endsWith(".json"))) {
  const fixture = JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
  const errors = errorsFor(fixture);
  if (name.endsWith(".valid.json")) {
    if (errors.length) throw new Error(`${name} rejected:\n${errors.join("\n")}`);
    validCount++;
  } else if (name.endsWith(".invalid.json")) {
    if (!errors.length) throw new Error(`${name} was accepted`);
    invalidCount++;
  }
}
console.log(`Validated ${validCount} comparison fixtures and rejected ${invalidCount} invalid fixtures.`);

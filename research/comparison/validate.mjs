import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schema = JSON.parse(await readFile(new URL("./comparison-v1.schema.json", import.meta.url), "utf8"));
const validFixture = JSON.parse(await readFile(new URL("./fixtures/smoke.valid.json", import.meta.url), "utf8"));
const invalidFixture = JSON.parse(await readFile(new URL("./fixtures/forward-version.invalid.json", import.meta.url), "utf8"));
const validate = addFormats(new Ajv2020({ allErrors: true, strict: true })).compile(schema);

if (!validate(validFixture)) {
  throw new Error(`valid research fixture rejected: ${JSON.stringify(validate.errors)}`);
}
if (validate(invalidFixture)) {
  throw new Error("forward research interchange version was accepted");
}

console.log("Validated research comparison v1 smoke fixture and rejected forward version.");

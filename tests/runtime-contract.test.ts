import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCompatibility, products } from "../lib/runtime/index";
import type { CompatibilityAssertion, ProductId, RuntimeBuild } from "../lib/runtime/index";

test("every supported product is distinct from its underlying engine", () => {
  const ids = Object.keys(products) as ProductId[];
  assert.deepEqual(ids.sort(), ["jan", "llama-cpp", "lm-studio", "mlx-lm", "ollama", "vllm"]);
  assert.deepEqual(products["lm-studio"].engineIds, ["llama.cpp", "mlx-lm"]);
  assert.deepEqual(products.jan.engineIds, ["llama.cpp", "mlx-swift-lm"]);
  assert.equal(products.vllm.kind, "serving-engine");
});

const assertion: CompatibilityAssertion = {
  artifactId: "artifact-1",
  productId: "lm-studio",
  engineId: "llama.cpp",
  status: "documented",
  runtimeConstraint: {},
  conditions: { operatingSystems: ["windows"], backends: ["cuda"], packageLayouts: ["gguf-single"] },
  evidence: [{ url: "https://example.com/runtime", checkedAt: "2026-07-19T00:00:00.000Z" }],
};
const build: RuntimeBuild = { engineId: "llama.cpp", version: "1.0", os: "windows", cpuArchitecture: "x64", backend: "cuda", featureFlags: [] };

test("compatibility is evaluated against a runtime build, not a file extension alone", () => {
  assert.deepEqual(evaluateCompatibility(assertion, build), { compatible: true, status: "documented", reasons: [], unknowns: [] });
  const wrongBackend = evaluateCompatibility(assertion, { ...build, backend: "metal" });
  assert.equal(wrongBackend.compatible, false);
  assert.match(wrongBackend.reasons.join(" "), /Backend metal/);
});

test("unknown compatibility fails closed", () => {
  const decision = evaluateCompatibility({ ...assertion, status: "unknown" }, { ...build, version: undefined });
  assert.equal(decision.compatible, false);
  assert.match(decision.unknowns.join(" "), /No compatibility evidence/);
  assert.match(decision.unknowns.join(" "), /version is unknown/);
});

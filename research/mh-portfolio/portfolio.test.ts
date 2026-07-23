import assert from "node:assert/strict";
import test from "node:test";
import { validateContract } from "../../lib/contracts";
import { buildRecommendationPortfolio } from "../../lib/portfolio";
import type { BuildRecommendationPortfolioInputV1 } from "../../lib/portfolio";
import {
  candidateEntry,
  portfolioInput,
  requestEnvelope,
  taskEvidence,
  upstreamGap,
} from "./fixtures";

test("one to five distinct fitting families produce an M-A-valid unranked portfolio without padding", () => {
  for (let count = 1; count <= 5; count++) {
    const entries = Array.from({ length: count }, (_, index) =>
      candidateEntry({
        id: `candidate-${index}`,
        family: `family-${index}`,
        position: index,
      }));
    const result = buildRecommendationPortfolio(portfolioInput(entries));
    assert.ok(validateContract(result.envelope).ok);
    assert.ok(result.envelope.status === "ok" || result.envelope.status === "partial");
    assert.equal(result.envelope.data.outcome, "unranked-compatible");
    assert.equal(result.envelope.data.items.length, count);
    assert.ok(result.envelope.data.items.every((item) => item.role === null));
    assert.equal(result.ledger.length, count);
    assert.ok(result.ledger.every((row) => row.disposition === "selected"));
  }
});

test("family representative uses evidence dominance before requested priority", () => {
  const sparse = candidateEntry({
    id: "sparse",
    family: "same-family",
    position: 0,
    generationRange: { low: 100, high: 120 },
  });
  const supported = candidateEntry({
    id: "supported",
    family: "same-family",
    position: 1,
    generationRange: { low: 10, high: 20 },
    evidence: [taskEvidence("supported", 0.5, 0.7)],
  });
  const input = portfolioInput([sparse, supported]);
  input.request.data.preferences.priority = "speed";
  const result = buildRecommendationPortfolio(input);
  assert.ok(result.envelope.status === "ok" || result.envelope.status === "partial");
  assert.equal(result.envelope.data.items[0].candidateId, "supported");
  assert.deepEqual(
    result.ledger.find((row) => row.candidateId === "sparse")?.reasonCodes,
    ["portfolio.family-deduplicated"],
  );
});

test("supported priority uses non-overlapping ranges but overlapping evidence falls through", () => {
  const slower = candidateEntry({
    id: "slow",
    family: "same-family",
    position: 0,
    generationRange: { low: 10, high: 20 },
  });
  const faster = candidateEntry({
    id: "fast",
    family: "same-family",
    position: 1,
    generationRange: { low: 30, high: 40 },
  });
  const input = portfolioInput([slower, faster]);
  input.request.data.preferences.priority = "speed";
  let result = buildRecommendationPortfolio(input);
  assert.ok(result.envelope.status === "ok" || result.envelope.status === "partial");
  assert.equal(result.envelope.data.items[0].candidateId, "fast");

  assert.ok(slower.assessment.status === "ok" || slower.assessment.status === "partial");
  slower.assessment.data.performance.generationTokensPerSecond = { low: 20, high: 35 };
  for (const item of slower.assessment.data.evidence.generationSpeed) {
    if (item.measurement !== null) {
      item.measurement.interval = { lower: 20, upper: 35 };
    }
  }
  const overlapping = portfolioInput([slower, faster]);
  overlapping.request.data.preferences.priority = "speed";
  result = buildRecommendationPortfolio(overlapping);
  assert.ok(result.envelope.status === "ok" || result.envelope.status === "partial");
  assert.equal(result.envelope.data.items[0].candidateId, "slow");
});

test("quality and lightest priorities use only their supported direct dimensions", () => {
  const lowQuality = candidateEntry({
    id: "low-quality",
    family: "same-family",
    position: 0,
    evidence: [taskEvidence("low-quality", 0.2, 0.3)],
    totalRequiredBytes: 100,
  });
  const highQuality = candidateEntry({
    id: "high-quality",
    family: "same-family",
    position: 1,
    evidence: [taskEvidence("high-quality", 0.8, 0.9)],
    totalRequiredBytes: 200,
  });
  const quality = portfolioInput([lowQuality, highQuality]);
  quality.request.data.preferences.priority = "quality";
  let result = buildRecommendationPortfolio(quality);
  assert.ok(result.envelope.status === "ok" || result.envelope.status === "partial");
  assert.equal(result.envelope.data.items[0].candidateId, "high-quality");

  const lightest = portfolioInput([lowQuality, highQuality]);
  lightest.request.data.preferences.priority = "lightest";
  result = buildRecommendationPortfolio(lightest);
  assert.ok(result.envelope.status === "ok" || result.envelope.status === "partial");
  assert.equal(result.envelope.data.items[0].candidateId, "low-quality");
});

test("reviewed familiarity then frozen catalog position resolve otherwise unsupported ties", () => {
  const familiar = candidateEntry({
    id: "familiar",
    family: "same-family",
    position: 1,
    familiarityOrdinal: 5,
  });
  const lessFamiliar = candidateEntry({
    id: "less-familiar",
    family: "same-family",
    position: 0,
    familiarityOrdinal: 1,
  });
  let result = buildRecommendationPortfolio(portfolioInput([lessFamiliar, familiar]));
  assert.ok(result.envelope.status === "ok" || result.envelope.status === "partial");
  assert.equal(result.envelope.data.items[0].candidateId, "familiar");

  familiar.familiarity = null;
  lessFamiliar.familiarity = null;
  result = buildRecommendationPortfolio(portfolioInput([familiar, lessFamiliar]));
  assert.ok(result.envelope.status === "ok" || result.envelope.status === "partial");
  assert.equal(result.envelope.data.items[0].candidateId, "less-familiar");
});

test("family alternatives remain explicit in the exhaustive ledger", () => {
  const first = candidateEntry({ id: "quant-a", family: "family-a", position: 0 });
  const second = candidateEntry({ id: "quant-b", family: "family-a", position: 1 });
  const result = buildRecommendationPortfolio(portfolioInput([first, second]));
  assert.equal(result.ledger.length, 2);
  assert.equal(result.ledger.filter((row) => row.disposition === "selected").length, 1);
  const alternative = result.ledger.find((row) => row.disposition === "excluded");
  assert.ok(alternative?.reasonCodes.includes("portfolio.family-deduplicated"));
  assert.match(alternative?.details.join(" ") ?? "", /representative/);
});

test("coverage-gap, nothing-fits, and mixed partial are kept distinct", () => {
  const gap = buildRecommendationPortfolio(portfolioInput([upstreamGap()]));
  assert.ok(gap.envelope.status === "ok" || gap.envelope.status === "partial");
  assert.equal(gap.envelope.data.outcome, "coverage-gap");
  assert.equal(gap.envelope.status, "partial");

  const noFit = buildRecommendationPortfolio(portfolioInput([
    candidateEntry({ id: "no-fit", fit: "does-not-fit" }),
  ]));
  assert.ok(noFit.envelope.status === "ok" || noFit.envelope.status === "partial");
  assert.equal(noFit.envelope.data.outcome, "nothing-fits");

  const mixed = buildRecommendationPortfolio(portfolioInput([
    candidateEntry({ id: "fit", position: 0 }),
    upstreamGap("artifact-gap", 1),
  ]));
  assert.equal(mixed.envelope.status, "partial");
  assert.ok(mixed.envelope.status === "partial");
  assert.equal(mixed.envelope.data.outcome, "unranked-compatible");
  assert.equal(mixed.envelope.data.items.length, 1);
  assert.equal(mixed.ledger.length, 2);
});

test("more than five survivors never pads and records every omitted family", () => {
  const entries = Array.from({ length: 7 }, (_, index) =>
    candidateEntry({
      id: `candidate-${index}`,
      family: `family-${index}`,
      position: index,
    }));
  const result = buildRecommendationPortfolio(portfolioInput(entries));
  assert.ok(result.envelope.status === "ok" || result.envelope.status === "partial");
  assert.equal(result.envelope.data.items.length, 5);
  assert.equal(result.ledger.length, 7);
  assert.equal(
    result.ledger.filter((row) => row.reasonCodes.includes("portfolio.family-limit")).length,
    2,
  );
});

test("unsupported needs and installed-only facts exclude rather than assume support", () => {
  const unknownCapability = candidateEntry({
    id: "unknown-capability",
    capabilities: { vision: null },
  });
  const capabilityInput = portfolioInput([unknownCapability]);
  capabilityInput.request.data.task.needs = ["vision"];
  let result = buildRecommendationPortfolio(capabilityInput);
  assert.ok(result.envelope.status === "ok" || result.envelope.status === "partial");
  assert.equal(result.envelope.data.outcome, "coverage-gap");
  assert.ok(result.ledger[0].reasonCodes.includes("portfolio.capability-unknown.vision"));

  const unknownInstall = candidateEntry({ id: "unknown-install", installed: null });
  const installedInput = portfolioInput([unknownInstall]);
  installedInput.request.data.preferences.installedOnly = true;
  result = buildRecommendationPortfolio(installedInput);
  assert.ok(result.envelope.status === "ok" || result.envelope.status === "partial");
  assert.ok(result.ledger[0].reasonCodes.includes("portfolio.installed-state-unknown"));
});

test("identity, snapshot, hardware and context drift fail closed", () => {
  const mutations: Array<(input: ReturnType<typeof portfolioInput>) => void> = [
    (input) => { input.universe.requestId = "wrong-request"; },
    (input) => { input.universe.hardwareTargetId = "wrong-hardware"; },
    (input) => { input.universe.entries[0].catalogReference.snapshotId = "wrong-snapshot"; },
    (input) => {
      const entry = input.universe.entries[0];
      if (entry.kind === "candidate") entry.candidate.artifact.sha256 = "f".repeat(64);
    },
  ];
  for (const mutate of mutations) {
    const input = portfolioInput([candidateEntry()]);
    mutate(input);
    const result = buildRecommendationPortfolio(input);
    assert.equal(result.envelope.status, "blocked");
    assert.equal(result.envelope.reasonCode, "portfolio.input-invalid");
    assert.ok(validateContract(result.envelope).ok);
  }
});

test("every consequential M-E and M-F binding is rechecked", () => {
  const mutations: Array<(entry: ReturnType<typeof candidateEntry>) => void> = [
    (entry) => { entry.compatibilityReceipt.candidateId = "other-candidate"; },
    (entry) => { entry.compatibilityReceipt.artifactId = "other-artifact"; },
    (entry) => { entry.compatibilityReceipt.artifactSha256 = "f".repeat(64); },
    (entry) => { entry.compatibilityReceipt.runtimeConfigurationId = "other-runtime"; },
    (entry) => { entry.compatibilityReceipt.target.product = "other-product"; },
    (entry) => { entry.compatibilityReceipt.target.engine = "other-engine"; },
    (entry) => { entry.compatibilityReceipt.target.engineBuild = "other-build"; },
    (entry) => { entry.compatibilityReceipt.target.backend = "cpu"; },
    (entry) => { entry.compatibilityReceipt.target.quantizationScheme = "other-quant"; },
    (entry) => {
      assert.ok(entry.assessment.status === "ok" || entry.assessment.status === "partial");
      entry.assessment.data.candidateId = "other-candidate";
    },
    (entry) => {
      assert.ok(entry.assessment.status === "ok" || entry.assessment.status === "partial");
      entry.assessment.data.hardwareTargetId = "other-hardware";
    },
  ];
  for (const mutate of mutations) {
    const entry = candidateEntry();
    mutate(entry);
    const result = buildRecommendationPortfolio(portfolioInput([entry]));
    assert.equal(result.envelope.status, "blocked");
    assert.equal(result.envelope.reasonCode, "portfolio.input-invalid");
  }
});

test("unavailable M-F output remains a coverage gap with its reason in the ledger", () => {
  const entry = candidateEntry();
  entry.assessment = {
    schemaVersion: 1,
    contract: "fit-evidence-assessment",
    status: "unavailable",
    reasonCode: "fit.profile-unavailable",
    message: "No reviewed profile is admitted.",
    recoverableActions: [],
    provenance: [],
    warnings: [],
  };
  const result = buildRecommendationPortfolio(portfolioInput([entry]));
  assert.ok(result.envelope.status === "ok" || result.envelope.status === "partial");
  assert.equal(result.envelope.data.outcome, "coverage-gap");
  assert.ok(result.ledger[0].reasonCodes.includes("fit.profile-unavailable"));
});

test("reviewed familiarity and exact M-G evidence cannot cross candidate identity", () => {
  const familiar = candidateEntry({
    id: "familiar",
    familiarityOrdinal: 2,
    evidence: [taskEvidence("familiar", 0.8, 0.9)],
  });
  assert.ok(familiar.familiarity);
  familiar.familiarity.candidateId = "different-candidate";
  let result = buildRecommendationPortfolio(portfolioInput([familiar]));
  assert.equal(result.envelope.status, "blocked");

  const evidenceDrift = candidateEntry({
    id: "evidence-owner",
    evidence: [taskEvidence("different-candidate", 0.8, 0.9)],
  });
  result = buildRecommendationPortfolio(portfolioInput([evidenceDrift]));
  assert.equal(result.envelope.status, "blocked");
});

test("context drift is explicitly excluded and never presented as compatible", () => {
  const entry = candidateEntry();
  entry.candidate.runtime.contextTokens += 1;
  const input = portfolioInput([entry]);
  const result = buildRecommendationPortfolio(input);
  assert.ok(result.envelope.status === "ok" || result.envelope.status === "partial");
  assert.equal(result.envelope.data.outcome, "nothing-fits");
  assert.ok(result.ledger[0].reasonCodes.includes("portfolio.context-mismatch"));
});

test("process-local composition brand rejects M-E or M-F mutation after admission", () => {
  let input = portfolioInput([candidateEntry()]);
  let entry = input.universe.entries[0];
  assert.equal(entry.kind, "candidate");
  entry.candidate.runtime.batchSize =
    (entry.candidate.runtime.batchSize ?? 0) + 1;
  let result = buildRecommendationPortfolio(input);
  assert.equal(result.envelope.status, "blocked");

  input = portfolioInput([candidateEntry()]);
  entry = input.universe.entries[0];
  assert.equal(entry.kind, "candidate");
  assert.ok(entry.assessment.status === "ok" || entry.assessment.status === "partial");
  entry.assessment.data.memoryPools.device.requiredBytes += 1;
  result = buildRecommendationPortfolio(input);
  assert.equal(result.envelope.status, "blocked");
});

test("contradictory exact task-success evidence and unattributed gaps fail closed", () => {
  const contradictory = candidateEntry({
    id: "contradictory",
    evidence: [
      taskEvidence("contradictory", 0.2, 0.3),
      taskEvidence("contradictory", 0.8, 0.9),
    ],
  });
  let result = buildRecommendationPortfolio(portfolioInput([contradictory]));
  assert.equal(result.envelope.status, "blocked");

  const gap = upstreamGap();
  gap.provenance = [];
  result = buildRecommendationPortfolio(portfolioInput([gap]));
  assert.equal(result.envelope.status, "blocked");
});

test("a hostile throwing universe getter returns a blocked envelope without re-reading it", () => {
  const hostile = {
    request: requestEnvelope(),
    get universe(): never {
      throw new Error("hostile getter");
    },
    policy: { policyVersion: 1, methodologyVersion: "hostile" },
  };
  assert.doesNotThrow(() =>
    buildRecommendationPortfolio(
      hostile as unknown as BuildRecommendationPortfolioInputV1,
    ));
  const result = buildRecommendationPortfolio(
    hostile as unknown as BuildRecommendationPortfolioInputV1,
  );
  assert.equal(result.envelope.status, "blocked");
  assert.deepEqual(result.ledger, []);
});

test("size, CPU-offload, forced-runtime, unknown fit and tight fit policies are explicit", () => {
  const tooLarge = candidateEntry({ id: "too-large" });
  let input = portfolioInput([tooLarge]);
  input.request.data.advanced.maximumArtifactBytes = tooLarge.candidate.artifact.bytes - 1;
  let result = buildRecommendationPortfolio(input);
  assert.ok(result.envelope.status === "ok" || result.envelope.status === "partial");
  assert.ok(result.ledger[0].reasonCodes.includes("portfolio.artifact-too-large"));

  const offload = candidateEntry({ id: "offload" });
  assert.ok(offload.assessment.status === "ok" || offload.assessment.status === "partial");
  offload.assessment.data.runPath = "cpu-offload";
  input = portfolioInput([offload]);
  input.request.data.preferences.allowCpuOffload = false;
  result = buildRecommendationPortfolio(input);
  assert.ok(result.ledger[0].reasonCodes.includes("portfolio.cpu-offload-disallowed"));

  input = portfolioInput([candidateEntry({ id: "forced" })]);
  input.request.data.advanced.forcedRuntime = "llama-cpp";
  result = buildRecommendationPortfolio(input);
  assert.ok(result.envelope.status === "ok" || result.envelope.status === "partial");
  assert.equal(result.envelope.data.outcome, "coverage-gap");
  assert.ok(result.ledger[0].reasonCodes.includes("portfolio.forced-runtime-semantics-unresolved"));

  for (const fit of ["unknown", "tight"] as const) {
    result = buildRecommendationPortfolio(portfolioInput([
      candidateEntry({ id: `fit-${fit}`, fit }),
    ]));
    assert.ok(result.envelope.status === "ok" || result.envelope.status === "partial");
    assert.equal(result.envelope.data.outcome, "coverage-gap");
    assert.ok(result.ledger[0].reasonCodes.some((reason) => reason.includes(fit)));
  }
});

test("ranked outcomes and roles are unreachable across every approved priority", () => {
  for (const priority of ["balanced", "quality", "speed", "long-context", "lightest"] as const) {
    const input = portfolioInput([
      candidateEntry({
        id: `candidate-${priority}`,
        family: `family-${priority}`,
        evidence: [taskEvidence(`candidate-${priority}`, 0.8, 0.9)],
      }),
    ]);
    input.request.data.preferences.priority = priority;
    const result = buildRecommendationPortfolio(input);
    assert.ok(result.envelope.status === "ok" || result.envelope.status === "partial");
    assert.notEqual(result.envelope.data.outcome, "ranked");
    assert.ok(result.envelope.data.items.every((item) => item.role === null));
  }
});

test("permuting universe entries does not change semantic output and inputs remain immutable", () => {
  const entries = [
    candidateEntry({ id: "candidate-c", family: "family-c", position: 2 }),
    candidateEntry({ id: "candidate-a", family: "family-a", position: 0 }),
    candidateEntry({ id: "candidate-b", family: "family-b", position: 1 }),
  ];
  const firstInput = portfolioInput(entries);
  const firstSnapshot = structuredClone(firstInput);
  const secondInput = portfolioInput([...entries].reverse());
  const first = buildRecommendationPortfolio(firstInput);
  const second = buildRecommendationPortfolio(secondInput);
  assert.deepEqual(firstInput, firstSnapshot);
  assert.ok(first.envelope.status === "ok" || first.envelope.status === "partial");
  assert.ok(second.envelope.status === "ok" || second.envelope.status === "partial");
  assert.deepEqual(first.envelope.data, second.envelope.data);
  assert.deepEqual(
    [...first.ledger].sort((a, b) => a.artifactId.localeCompare(b.artifactId)),
    [...second.ledger].sort((a, b) => a.artifactId.localeCompare(b.artifactId)),
  );
});

test("the receipt must exhaustively cover the frozen artifact set", () => {
  const input = portfolioInput([candidateEntry()]);
  input.universe.registrySnapshot.artifactIds.push("artifact-without-row");
  const result = buildRecommendationPortfolio(input);
  assert.equal(result.envelope.status, "blocked");
  assert.ok(result.ledger[0].reasonCodes.includes("portfolio.input-invalid"));
});

test("a future malformed entry kind fails closed instead of throwing", () => {
  const input = portfolioInput([candidateEntry()]);
  (input.universe.entries[0] as { kind: string }).kind = "future-entry";
  assert.doesNotThrow(() => buildRecommendationPortfolio(input));
  const result = buildRecommendationPortfolio(input);
  assert.equal(result.envelope.status, "blocked");
});

test("request fixture factory returns an independently mutable M-A envelope", () => {
  const left = requestEnvelope();
  const right = requestEnvelope();
  left.data.requestId = "changed";
  assert.notEqual(left.data.requestId, right.data.requestId);
  assert.ok(validateContract(right).ok);
});

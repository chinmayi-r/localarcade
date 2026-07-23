import { validateContract } from "../contracts";
import type {
  ContractEnvelope,
  Need,
  Provenance,
  RecommendationPortfolio,
} from "../contracts";
import type { NormalizedEvidenceComponent } from "../evidence";
import type {
  BuildRecommendationPortfolioInputV1,
  CandidateDispositionV1,
  CandidateUniverseReceiptV1,
  PortfolioCandidateEntryV1,
  PortfolioUniverseEntryV1,
  RecommendationPortfolioEnvelope,
  RecommendationPortfolioResultV1,
  ReviewedFamiliaritySignalV1,
} from "./types";

export type {
  BuildRecommendationPortfolioInputV1,
  CandidateDispositionV1,
  CandidateUniverseReceiptV1,
  FitAssessmentEnvelope,
  CandidateEligibilityFactsV1,
  CatalogReferenceV1,
  PortfolioCandidateEntryV1,
  PortfolioDisposition,
  PortfolioPolicyV1,
  PortfolioUniverseEntryV1,
  PortfolioUpstreamGapEntryV1,
  RecommendationPortfolioEnvelope,
  RecommendationPortfolioResultV1,
  ReviewedFamiliaritySignalV1,
} from "./types";

const NEEDS: Need[] = [
  "tool-use",
  "structured-output",
  "vision",
  "embeddings",
  "offline",
];

const ENTRY_KEYS = {
  candidate: [
    "kind",
    "artifactId",
    "candidate",
    "compatibilityReceipt",
    "assessment",
    "evidence",
    "familiarity",
    "catalogReference",
    "eligibility",
  ],
  "upstream-gap": [
    "kind",
    "artifactId",
    "modelFamilyId",
    "reasonCode",
    "message",
    "catalogReference",
    "provenance",
  ],
} as const;

const admittedCandidateEntries = new WeakMap<object, string>();

type EligibleCandidate = {
  entry: PortfolioCandidateEntryV1;
  row: CandidateDispositionV1;
  assessment: Extract<
    PortfolioCandidateEntryV1["assessment"],
    { status: "ok" | "partial" }
  >;
  unresolved: string[];
  selectionBasis: string[];
};

/**
 * Creates the process-local M-E/M-F composition brand consumed by M-H.
 *
 * This is deliberately not a wire receipt or a request-controlled trust claim.
 * The future M-O assembler must call it immediately after it receives the
 * candidate, compatibility receipt and assessment from their owning modules.
 * M-H then rejects copied or mutated producer content.
 */
export function admitPortfolioCandidateEntry(
  entry: PortfolioCandidateEntryV1,
): PortfolioCandidateEntryV1 {
  admittedCandidateEntries.set(entry, stableJson(entry));
  return entry;
}

export function buildRecommendationPortfolio(
  input: BuildRecommendationPortfolioInputV1,
): RecommendationPortfolioResultV1 {
  try {
    return buildRecommendationPortfolioValidated(input);
  } catch {
    return {
      envelope: failure(
        "blocked",
        "portfolio.input-invalid",
        "M-H rejected a malformed candidate-universe input.",
      ),
      ledger: [],
    };
  }
}

function buildRecommendationPortfolioValidated(
  input: BuildRecommendationPortfolioInputV1,
): RecommendationPortfolioResultV1 {
  const initialLedger = input.universe.entries.map(initialRow);
  const inputProblems = validateInput(input);
  if (inputProblems.length > 0) {
    for (const row of initialLedger) {
      row.disposition = row.disposition === "upstream-gap"
        ? "upstream-gap"
        : "unsupported";
      row.reasonCodes.push("portfolio.input-invalid");
      row.details.push(...inputProblems);
    }
    return {
      envelope: failure(
        "blocked",
        "portfolio.input-invalid",
        "M-H rejected an invalid or inconsistently bound candidate universe.",
      ),
      ledger: initialLedger,
    };
  }

  const request = input.request.data;
  const candidates: EligibleCandidate[] = [];
  let assessedNothingFits = false;
  let coverageGap = input.universe.entries.length === 0;

  input.universe.entries.forEach((entry, index) => {
    const row = initialLedger[index];
    if (entry.kind === "upstream-gap") {
      coverageGap = true;
      return;
    }

    const assessment = entry.assessment;
    if (!isDataAssessment(assessment)) {
      row.disposition = "unsupported";
      row.reasonCodes.push(
        assessment.reasonCode || "portfolio.assessment-unavailable",
      );
      row.details.push(assessment.message);
      coverageGap = true;
      return;
    }

    const hardReasons = hardConstraintReasons(entry, request);
    if (hardReasons.length > 0) {
      const unresolvedConstraint = hardReasons.some(isCoverageReason);
      row.disposition = unresolvedConstraint ? "unsupported" : "excluded";
      row.reasonCodes.push(...hardReasons);
      row.details.push(unresolvedConstraint
        ? "A required candidate fact or policy meaning is unavailable."
        : "The candidate failed an explicit request constraint.");
      if (unresolvedConstraint) coverageGap = true;
      if (hardReasons.includes("portfolio.fit-does-not-fit")) {
        assessedNothingFits = true;
      }
      return;
    }

    candidates.push({
      entry,
      row,
      assessment,
      unresolved: [
        ...(assessment.status === "partial"
          ? assessment.completeness.missing
          : []),
        ...entry.evidence.flatMap((result) =>
          result.kind === "unsupported"
            ? result.reasons
            : result.kind === "lossy"
              ? result.reasons
              : []),
      ],
      selectionBasis: [],
    });
  });

  const representatives = chooseFamilyRepresentatives(candidates, request);
  const ordered = orderRepresentatives(representatives, request);
  const selected = ordered.slice(0, 5);
  const omittedAtLimit = ordered.slice(5);

  for (const candidate of selected) {
    candidate.row.disposition = "selected";
    candidate.row.reasonCodes.push("portfolio.selected-unranked");
    candidate.row.reasonCodes.push(...candidate.selectionBasis.map((basis) =>
      `portfolio.selection.${basis}`));
    candidate.row.details.push(
      `Selection basis: ${candidate.selectionBasis.join("; ")}.`,
    );
    if (candidate.unresolved.length > 0) {
      candidate.row.reasonCodes.push("portfolio.evidence-partial");
      candidate.row.details.push(
        `Unresolved evidence: ${candidate.unresolved.join(", ")}.`,
      );
    }
  }
  for (const candidate of omittedAtLimit) {
    candidate.row.disposition = "excluded";
    candidate.row.reasonCodes.push("portfolio.family-limit");
    candidate.row.details.push(
      "The approved portfolio contains at most five model families.",
    );
  }

  const selectedForOutput = [...selected].sort((left, right) =>
    left.entry.candidate.modelFamily.modelFamilyId.localeCompare(
      right.entry.candidate.modelFamily.modelFamilyId,
    )
    || left.entry.candidate.candidateId.localeCompare(
      right.entry.candidate.candidateId,
    )
    || left.assessment.data.assessmentId.localeCompare(
      right.assessment.data.assessmentId,
    ));
  const provenance = uniqueProvenance([
    ...input.request.provenance,
    ...selectedForOutput.flatMap(candidateProvenance),
    ...input.universe.entries
      .filter((entry) => entry.kind === "upstream-gap")
      .flatMap((entry) => entry.provenance),
  ]);
  const missing = unique([
    ...(input.universe.entries.length === 0
      ? ["universe.registrySnapshot.artifactIds"]
      : []),
    ...input.universe.entries
      .filter((entry) => entry.kind === "upstream-gap")
      .map((entry) => `universe.entries.${entry.artifactId}`),
    ...initialLedger
      .filter((row) => row.disposition === "unsupported")
      .map((row) => `universe.entries.${row.artifactId}`),
    ...selectedForOutput.flatMap((candidate) => candidate.unresolved),
  ]);

  let portfolio: RecommendationPortfolio;
  if (selected.length > 0) {
    portfolio = {
      requestId: request.requestId,
      outcome: "unranked-compatible",
      message: missing.length > 0
        ? "Compatible starting configurations are shown without a rank; some evidence remains unavailable."
        : "Compatible starting configurations are shown without a universal rank.",
      items: selectedForOutput.map(toPortfolioItem),
      methodologyVersion: input.policy.methodologyVersion,
    };
  } else if (coverageGap) {
    portfolio = {
      requestId: request.requestId,
      outcome: "coverage-gap",
      message: "The candidate universe lacks enough exact evidence to return a safe configuration.",
      items: [],
      methodologyVersion: input.policy.methodologyVersion,
    };
  } else {
    portfolio = {
      requestId: request.requestId,
      outcome: "nothing-fits",
      message: assessedNothingFits
        ? "Every completely assessed configuration failed the confirmed fit or request constraints."
        : "No configuration satisfies every confirmed request constraint.",
      items: [],
      methodologyVersion: input.policy.methodologyVersion,
    };
  }

  const envelope: RecommendationPortfolioEnvelope = {
    schemaVersion: 1,
    contract: "recommendation-portfolio",
    status: missing.length > 0 ? "partial" : "ok",
    data: portfolio,
    provenance,
    completeness: missing.length > 0
      ? {
          complete: false,
          missing,
          warnings: [
            "Missing evidence was preserved and did not become a weak score.",
          ],
          recoverableActions: [
            "Provide exact scoped evidence for the listed universe entries.",
          ],
        }
      : {
          complete: true,
          missing: [],
          warnings: [],
          recoverableActions: [],
        },
  };
  const validation = validateContract(envelope);
  if (!validation.ok) {
    return {
      envelope: failure(
        "error",
        "portfolio.output-invalid",
        `M-H produced an invalid M-A envelope: ${validation.errors.join(" ")}`,
      ),
      ledger: initialLedger,
    };
  }
  return { envelope, ledger: initialLedger };
}

function validateInput(input: BuildRecommendationPortfolioInputV1): string[] {
  const issues: string[] = [];
  if (!exactKeys(input, ["request", "universe", "policy"])) {
    issues.push("input fields are not the exact v1 shape.");
  }
  if (!exactKeys(input.policy, ["policyVersion", "methodologyVersion"])) {
    issues.push("policy fields are not the exact v1 shape.");
  }
  if (input.policy.policyVersion !== 1) {
    issues.push("policy.policyVersion must be 1.");
  }
  if (!nonEmpty(input.policy.methodologyVersion)) {
    issues.push("policy.methodologyVersion is required.");
  }

  const requestValidation = validateContract(input.request);
  if (!requestValidation.ok
    || input.request.contract !== "recommendation-request"
    || input.request.status !== "ok") {
    issues.push("request must be a complete valid recommendation-request ok envelope.");
  }

  const universe = input.universe;
  if (!exactKeys(universe, [
    "receiptVersion",
    "universeId",
    "requestId",
    "hardwareTargetId",
    "registrySnapshot",
    "entries",
  ]) || !exactKeys(universe.registrySnapshot, ["snapshotId", "artifactIds"])) {
    issues.push("universe receipt fields are not the exact v1 shape.");
  }
  if (universe.receiptVersion !== 1
    || !nonEmpty(universe.universeId)
    || !nonEmpty(universe.registrySnapshot.snapshotId)) {
    issues.push("universe receipt identity is invalid.");
  }
  if (universe.requestId !== input.request.data.requestId) {
    issues.push("universe.requestId does not match the request.");
  }
  if (universe.hardwareTargetId !== input.request.data.hardwareTargetId) {
    issues.push("universe.hardwareTargetId does not match the request.");
  }

  const artifactIds = universe.registrySnapshot.artifactIds;
  if (artifactIds.length !== new Set(artifactIds).size
    || artifactIds.some((id) => !nonEmpty(id))) {
    issues.push("registrySnapshot.artifactIds must be unique non-empty IDs.");
  }
  const entryIds = universe.entries.map((entry) => entry.artifactId);
  if (entryIds.length !== new Set(entryIds).size) {
    issues.push("universe entries must contain one row per artifact ID.");
  }
  if (!sameSet(artifactIds, entryIds)) {
    issues.push(
      "universe entries must exhaustively equal the frozen snapshot artifact IDs.",
    );
  }
  for (const entry of universe.entries) {
    issues.push(...validateEntry(entry, universe));
  }
  return issues;
}

function validateEntry(
  entry: PortfolioUniverseEntryV1,
  universe: CandidateUniverseReceiptV1,
): string[] {
  const issues: string[] = [];
  if (entry.kind !== "candidate" && entry.kind !== "upstream-gap") {
    return ["universe entry kind is unsupported."];
  }
  if (!exactKeys(entry, ENTRY_KEYS[entry.kind])
    || !exactKeys(entry.catalogReference, ["snapshotId", "position"])) {
    issues.push(`${entry.artifactId}: entry fields are not the exact v1 shape.`);
  }
  if (entry.catalogReference.snapshotId
      !== universe.registrySnapshot.snapshotId
    || !Number.isSafeInteger(entry.catalogReference.position)
    || entry.catalogReference.position
      !== universe.registrySnapshot.artifactIds.indexOf(entry.artifactId)) {
    issues.push(`${entry.artifactId}: catalog reference is invalid.`);
  }
  if (entry.kind === "upstream-gap") {
    if (!nonEmpty(entry.reasonCode) || !nonEmpty(entry.message)
      || (entry.modelFamilyId !== null && !nonEmpty(entry.modelFamilyId))
      || entry.provenance.length === 0
      || entry.provenance.some((item) => !validProvenance(item))) {
      issues.push(`${entry.artifactId}: upstream gap is malformed.`);
    }
    return issues;
  }

  if (entry.artifactId !== entry.candidate.artifact.artifactId) {
    issues.push(`${entry.artifactId}: candidate artifact binding mismatch.`);
  }
  if (admittedCandidateEntries.get(entry) !== stableJson(entry)) {
    issues.push(
      `${entry.artifactId}: candidate entry lacks an intact process-local M-E/M-F composition brand.`,
    );
  }
  issues.push(...contractIssues("exact-configuration-candidate", entry.candidate));
  issues.push(...contractIssues(
    "compatibility-admission-receipt",
    entry.compatibilityReceipt,
  ));
  const assessmentValidation = validateContract(entry.assessment);
  if (!assessmentValidation.ok
    || entry.assessment.contract !== "fit-evidence-assessment") {
    issues.push(`${entry.artifactId}: assessment envelope is invalid.`);
  }

  const receipt = entry.compatibilityReceipt;
  if (!receiptBindsCandidate(receipt, entry.candidate)) {
    issues.push(`${entry.artifactId}: M-E receipt does not bind the candidate.`);
  }
  if (!exactKeys(entry.eligibility, ["installed", "capabilities"])
    || !exactKeys(entry.eligibility.capabilities, NEEDS)) {
    issues.push(`${entry.artifactId}: eligibility fields are not the exact v1 shape.`);
  }
  if ((entry.assessment.status === "ok"
      || entry.assessment.status === "partial")
    && (entry.assessment.data.candidateId !== entry.candidate.candidateId
      || entry.assessment.data.hardwareTargetId !== universe.hardwareTargetId)) {
    issues.push(`${entry.artifactId}: M-F assessment binding mismatch.`);
  }
  if (!validEligibility(entry)) {
    issues.push(`${entry.artifactId}: eligibility facts are incomplete.`);
  }
  if (entry.familiarity !== null
    && (!exactKeys(entry.familiarity, [
      "signalVersion",
      "signalId",
      "modelFamilyId",
      "candidateId",
      "artifactId",
      "ordinal",
      "ordinalDirection",
      "reviewedBy",
      "reviewedAt",
      "provenance",
    ]) || !validFamiliarity(entry.familiarity, entry))) {
    issues.push(`${entry.artifactId}: familiarity signal is invalid.`);
  }
  for (const result of entry.evidence) {
    if (result.kind !== "exact"
      && result.kind !== "lossy"
      && result.kind !== "unsupported") {
      issues.push(`${entry.artifactId}: M-G result kind is unsupported.`);
      continue;
    }
    if (!exactKeys(
      result,
      result.kind === "exact"
        ? ["kind", "value"]
        : ["kind", result.kind === "lossy" ? "value" : "reasons", ...(result.kind === "lossy" ? ["reasons"] : [])],
    )) {
      issues.push(`${entry.artifactId}: M-G result fields are not the exact shape.`);
      continue;
    }
    if (result.kind === "unsupported") {
      if (!result.reasons.length || result.reasons.some((reason) => !nonEmpty(reason))) {
        issues.push(`${entry.artifactId}: unsupported M-G result needs reasons.`);
      }
      continue;
    }
    if (result.value.candidateId !== entry.candidate.candidateId
      || result.value.hardwareTargetId !== universe.hardwareTargetId
      || !validEvidenceComponent(result.value)
      || (result.kind === "lossy"
        && (!result.reasons.length
          || result.reasons.some((reason) => !nonEmpty(reason))))) {
      issues.push(`${entry.artifactId}: M-G evidence is invalid or misbound.`);
    }
  }
  if (hasContradictoryExactTaskEvidence(entry)) {
    issues.push(`${entry.artifactId}: exact task-success evidence contradicts itself.`);
  }
  return issues;
}

function hardConstraintReasons(
  entry: PortfolioCandidateEntryV1,
  request: BuildRecommendationPortfolioInputV1["request"]["data"],
): string[] {
  const assessment = entry.assessment;
  if (!isDataAssessment(assessment)) {
    return ["portfolio.assessment-unavailable"];
  }
  const reasons: string[] = [];
  if (assessment.data.fit === "does-not-fit") {
    reasons.push("portfolio.fit-does-not-fit");
  } else if (assessment.data.fit === "unknown") {
    reasons.push("portfolio.fit-unknown");
  } else if (assessment.data.fit === "tight") {
    reasons.push("portfolio.fit-tight-unapproved");
  }
  if (assessment.data.hardwareTargetId !== request.hardwareTargetId) {
    reasons.push("portfolio.hardware-mismatch");
  }
  if (entry.candidate.runtime.contextTokens
      !== request.task.derivedContextTokens) {
    reasons.push("portfolio.context-mismatch");
  }
  if (!request.preferences.allowCpuOffload
    && assessment.data.runPath === "cpu-offload") {
    reasons.push("portfolio.cpu-offload-disallowed");
  }
  if (request.preferences.installedOnly && entry.eligibility.installed !== true) {
    reasons.push(entry.eligibility.installed === false
      ? "portfolio.not-installed"
      : "portfolio.installed-state-unknown");
  }
  if (request.advanced.forcedRuntime !== null) {
    reasons.push("portfolio.forced-runtime-semantics-unresolved");
  }
  if (request.advanced.maximumArtifactBytes !== null
    && entry.candidate.artifact.bytes
      > request.advanced.maximumArtifactBytes) {
    reasons.push("portfolio.artifact-too-large");
  }
  for (const need of request.task.needs) {
    const support = entry.eligibility.capabilities[need];
    if (support !== true) {
      reasons.push(support === false
        ? `portfolio.capability-unsupported.${need}`
        : `portfolio.capability-unknown.${need}`);
    }
  }
  return reasons;
}

function chooseFamilyRepresentatives(
  candidates: EligibleCandidate[],
  request: BuildRecommendationPortfolioInputV1["request"]["data"],
): EligibleCandidate[] {
  const byFamily = new Map<string, EligibleCandidate[]>();
  for (const candidate of candidates) {
    const family = candidate.entry.candidate.modelFamily.modelFamilyId;
    const values = byFamily.get(family) ?? [];
    values.push(candidate);
    byFamily.set(family, values);
  }

  const representatives: EligibleCandidate[] = [];
  for (const values of byFamily.values()) {
    const ordered = orderRepresentatives(values, request);
    const representative = ordered[0];
    representatives.push(representative);
    for (const alternative of ordered.slice(1)) {
      alternative.row.disposition = "excluded";
      alternative.row.reasonCodes.push("portfolio.family-deduplicated");
      alternative.row.details.push(
        `The family representative is ${representative.entry.candidate.candidateId}; basis: ${representative.selectionBasis.join("; ")}.`,
      );
    }
  }
  return representatives;
}

function orderRepresentatives(
  candidates: EligibleCandidate[],
  request: BuildRecommendationPortfolioInputV1["request"]["data"],
): EligibleCandidate[] {
  const layers = evidenceLayers(candidates);
  return layers.flatMap((layer, layerIndex) =>
    [...layer]
      .sort((left, right) => {
        const priority = priorityComparison(left, right, request);
        if (priority !== 0) return priority;
        const familiarity = familiarityComparison(left, right);
        if (familiarity !== 0) return familiarity;
        const catalog = left.entry.catalogReference.position
          - right.entry.catalogReference.position;
        if (catalog !== 0) return catalog;
        return left.entry.candidate.candidateId.localeCompare(
          right.entry.candidate.candidateId,
        );
      })
      .map((candidate) => ({
        ...candidate,
        selectionBasis: [
          `exact-evidence-layer-${layerIndex + 1}`,
          `direct-priority-${request.preferences.priority}`,
          ...(candidate.entry.familiarity === null
            ? []
            : ["reviewed-familiarity-tiebreak"]),
          `non-semantic-catalog-position-${candidate.entry.catalogReference.position}`,
        ],
      })));
}

/**
 * Set dominance only: more independently supported channels can win, but
 * channel counts are never combined into a weighted score.
 */
function evidenceDominates(
  left: EligibleCandidate,
  right: EligibleCandidate,
): boolean {
  const leftChannels = supportedChannels(left);
  const rightChannels = supportedChannels(right);
  const leftSuperset = [...rightChannels].every((key) => leftChannels.has(key));
  return leftSuperset && leftChannels.size > rightChannels.size;
}

function evidenceLayers(candidates: EligibleCandidate[]): EligibleCandidate[][] {
  const remaining = [...candidates];
  const layers: EligibleCandidate[][] = [];
  while (remaining.length > 0) {
    const layer = remaining.filter((candidate) =>
      !remaining.some((other) =>
        other !== candidate && evidenceDominates(other, candidate)));
    layers.push(layer);
    const selected = new Set(layer);
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      if (selected.has(remaining[index])) remaining.splice(index, 1);
    }
  }
  return layers;
}

function supportedChannels(candidate: EligibleCandidate): Set<string> {
  const assessment = candidate.assessment.data;
  const channels = new Set<string>();
  if (assessment.evidence.fit.some(exactEligibleProvenance)) {
    channels.add("fit-memory");
  }
  if (exactAssessmentRange(
    assessment.performance.promptTokensPerSecond,
    assessment.evidence.promptSpeed,
  ) !== null) {
    channels.add("prompt-throughput");
  }
  if (exactAssessmentRange(
    assessment.performance.generationTokensPerSecond,
    assessment.evidence.generationSpeed,
  ) !== null) {
    channels.add("generation-throughput");
  }
  if (exactAssessmentRange(
    assessment.performance.timeToFirstTokenMs,
    assessment.evidence.timeToFirstToken,
  ) !== null) {
    channels.add("time-to-first-token");
  }
  for (const result of candidate.entry.evidence) {
    if (result.kind === "exact"
      && result.value.provenance.some(exactEligibleProvenance)) {
      channels.add(result.value.metric);
    }
  }
  return channels;
}

function priorityComparison(
  left: EligibleCandidate,
  right: EligibleCandidate,
  request: BuildRecommendationPortfolioInputV1["request"]["data"],
): number {
  switch (request.preferences.priority) {
    case "speed":
      return higherNonOverlappingRange(
        exactAssessmentRange(
          left.assessment.data.performance.generationTokensPerSecond,
          left.assessment.data.evidence.generationSpeed,
        ),
        exactAssessmentRange(
          right.assessment.data.performance.generationTokensPerSecond,
          right.assessment.data.evidence.generationSpeed,
        ),
      );
    case "quality":
      return higherNonOverlappingRange(
        taskQualityRange(left, request.task.family),
        taskQualityRange(right, request.task.family),
      );
    case "long-context":
      return compareNumber(
        right.entry.candidate.runtime.contextTokens,
        left.entry.candidate.runtime.contextTokens,
      );
    case "lightest":
      if (!supportedChannels(left).has("fit-memory")
        || !supportedChannels(right).has("fit-memory")) {
        return 0;
      }
      return compareNumber(
        totalRequiredBytes(left),
        totalRequiredBytes(right),
      );
    case "balanced":
      return 0;
  }
}

function taskQualityRange(
  candidate: EligibleCandidate,
  taskFamily: string,
): { low: number; high: number } | null {
  const intervals = candidate.entry.evidence
    .filter((result) => result.kind === "exact")
    .map((result) => result.value)
    .filter((value) =>
      value.metric === "task-success"
      && value.provenance.some((item) =>
        item.scope.taskFamily === taskFamily
        && exactEligibleProvenance(item)))
    .flatMap((value) =>
      value.provenance.flatMap((item) => {
        const measurement = item.measurement;
        return item.scope.taskFamily === taskFamily
          && exactEligibleProvenance(item)
          && measurement?.interval !== null
          && measurement?.interval !== undefined
          ? [{
              low: measurement.interval.lower,
              high: measurement.interval.upper,
            }]
          : [];
      }));
  return intervals.length === 1 ? intervals[0] : null;
}

function higherNonOverlappingRange(
  left: { low: number; high: number } | null,
  right: { low: number; high: number } | null,
): number {
  if (left === null || right === null) return 0;
  if (left.low > right.high) return -1;
  if (right.low > left.high) return 1;
  return 0;
}

function exactAssessmentRange(
  range: { low: number; high: number } | null,
  provenance: Provenance[],
): { low: number; high: number } | null {
  if (range === null) return null;
  return provenance.some((item) =>
    exactEligibleProvenance(item)
    && item.measurement?.interval?.lower === range.low
    && item.measurement.interval.upper === range.high)
    ? range
    : null;
}

function exactEligibleProvenance(value: Provenance): boolean {
  return value.configurationMatch === "exact"
    && (value.hardwareMatch === "exact"
      || value.hardwareMatch === "not-applicable")
    && value.measurement?.eligible === true;
}

function familiarityComparison(
  left: EligibleCandidate,
  right: EligibleCandidate,
): number {
  const leftOrdinal = left.entry.familiarity?.ordinal;
  const rightOrdinal = right.entry.familiarity?.ordinal;
  if (leftOrdinal === undefined || rightOrdinal === undefined) return 0;
  return compareNumber(rightOrdinal, leftOrdinal);
}

function totalRequiredBytes(candidate: EligibleCandidate): number {
  const pools = candidate.assessment.data.memoryPools;
  return pools.device.requiredBytes + pools.host.requiredBytes;
}

function toPortfolioItem(candidate: EligibleCandidate) {
  const assessment = candidate.assessment.data;
  const why = [
    assessment.fit === "good"
      ? "The exact configuration passed the admitted fit assessment."
      : "The exact configuration has an admitted fit assessment.",
    `Selection used ${candidate.selectionBasis.join(", ")}; catalog position is deterministic and non-semantic.`,
  ];
  const caveats = [
    candidate.unresolved.length > 0
      ? `Evidence remains unresolved: ${unique(candidate.unresolved).join(", ")}.`
      : "No universal quality ordering is claimed.",
  ];
  return {
    role: null,
    modelFamilyId: candidate.entry.candidate.modelFamily.modelFamilyId,
    candidateId: candidate.entry.candidate.candidateId,
    assessmentId: assessment.assessmentId,
    why,
    caveats,
  };
}

function candidateProvenance(candidate: EligibleCandidate): Provenance[] {
  return uniqueProvenance([
    ...candidate.entry.candidate.provenance,
    ...candidate.assessment.provenance,
    ...candidate.entry.evidence.flatMap((result) =>
      result.kind === "unsupported" ? [] : result.value.provenance),
    ...(candidate.entry.familiarity?.provenance ?? []),
  ]);
}

function initialRow(entry: PortfolioUniverseEntryV1): CandidateDispositionV1 {
  if (entry.kind === "upstream-gap") {
    return {
      artifactId: entry.artifactId,
      modelFamilyId: entry.modelFamilyId,
      candidateId: null,
      assessmentId: null,
      disposition: "upstream-gap",
      reasonCodes: [entry.reasonCode],
      details: [entry.message],
    };
  }
  if (entry.kind !== "candidate") {
    const future = entry as unknown as {
      artifactId?: unknown;
      kind?: unknown;
    };
    return {
      artifactId: nonEmpty(future.artifactId)
        ? future.artifactId
        : "unknown-artifact",
      modelFamilyId: null,
      candidateId: null,
      assessmentId: null,
      disposition: "unsupported",
      reasonCodes: ["portfolio.entry-kind-unsupported"],
      details: [`Unsupported universe entry kind: ${String(future.kind)}.`],
    };
  }
  return {
    artifactId: entry.artifactId,
    modelFamilyId: entry.candidate.modelFamily.modelFamilyId,
    candidateId: entry.candidate.candidateId,
    assessmentId: entry.assessment.status === "ok"
        || entry.assessment.status === "partial"
      ? entry.assessment.data.assessmentId
      : null,
    disposition: "unsupported",
    reasonCodes: [],
    details: [],
  };
}

function isDataAssessment(
  assessment: PortfolioCandidateEntryV1["assessment"],
): assessment is Extract<
  PortfolioCandidateEntryV1["assessment"],
  { status: "ok" | "partial" }
> {
  return assessment.status === "ok" || assessment.status === "partial";
}

function contractIssues(
  contract:
    | "exact-configuration-candidate"
    | "compatibility-admission-receipt",
  data: unknown,
): string[] {
  const validation = validateContract({
    schemaVersion: 1,
    contract,
    status: "ok",
    data,
    provenance: [],
    completeness: {
      complete: true,
      missing: [],
      warnings: [],
      recoverableActions: [],
    },
  });
  return validation.ok ? [] : validation.errors;
}

function receiptBindsCandidate(
  receipt: PortfolioCandidateEntryV1["compatibilityReceipt"],
  candidate: PortfolioCandidateEntryV1["candidate"],
): boolean {
  return receipt.receiptVersion === 1
    && receipt.policy.id === "m-e.compatibility"
    && receipt.policy.version === "1"
    && receipt.decision === "admitted"
    && receipt.candidateId === candidate.candidateId
    && receipt.artifactId === candidate.artifact.artifactId
    && receipt.artifactSha256 === candidate.artifact.sha256
    && receipt.runtimeConfigurationId
      === candidate.runtime.runtimeConfigurationId
    && receipt.target.product === candidate.runtime.product
    && receipt.target.engine === candidate.runtime.engine
    && receipt.target.engineBuild === candidate.runtime.engineBuild
    && receipt.target.backend === candidate.runtime.backend
    && receipt.target.quantizationScheme === candidate.artifact.quantization
    && receipt.assertion.artifactId === candidate.artifact.artifactId
    && receipt.assertion.productId === candidate.runtime.product
    && receipt.assertion.engineId === candidate.runtime.engine;
}

function validEligibility(entry: PortfolioCandidateEntryV1): boolean {
  return (entry.eligibility.installed === null
      || typeof entry.eligibility.installed === "boolean")
    && exactKeys(entry.eligibility.capabilities, NEEDS)
    && NEEDS.every((need) => {
      const value = entry.eligibility.capabilities[need];
      return value === null || typeof value === "boolean";
    });
}

function validFamiliarity(
  signal: ReviewedFamiliaritySignalV1,
  entry: PortfolioCandidateEntryV1,
): boolean {
  return signal.signalVersion === 1
    && nonEmpty(signal.signalId)
    && signal.modelFamilyId === entry.candidate.modelFamily.modelFamilyId
    && signal.candidateId === entry.candidate.candidateId
    && signal.artifactId === entry.candidate.artifact.artifactId
    && Number.isSafeInteger(signal.ordinal)
    && signal.ordinal >= 0
    && signal.ordinalDirection === "higher-is-more-familiar"
    && nonEmpty(signal.reviewedBy)
    && Number.isFinite(Date.parse(signal.reviewedAt))
    && signal.provenance.length > 0
    && signal.provenance.every((item) =>
      validProvenance(item)
      && item.method === "imported"
      && item.configurationMatch === "exact"
      && (item.hardwareMatch === "not-applicable"
        || item.hardwareMatch === "exact")
      && nonEmpty(item.source.id)
      && (nonEmpty(item.source.url) || nonEmpty(item.rawSourceRecordRef)));
}

function validEvidenceComponent(value: NormalizedEvidenceComponent): boolean {
  return exactKeys(value, [
    "candidateId",
    "hardwareTargetId",
    "metric",
    "claim",
    "provenance",
  ])
    && nonEmpty(value.candidateId)
    && (value.hardwareTargetId === null || nonEmpty(value.hardwareTargetId))
    && [
      "fit-memory",
      "prompt-throughput",
      "generation-throughput",
      "time-to-first-token",
      "task-latency",
      "stability",
      "energy-per-task",
      "task-success",
      "operator-intervention-rate",
      "response-preference",
      "experience-preference",
    ].includes(value.metric)
    && ["estimated", "measured", "community", "verified", "preference"]
      .includes(value.claim)
    && value.provenance.length > 0
    && value.provenance.every(validProvenance);
}

function validProvenance(value: Provenance): boolean {
  const carrier: ContractEnvelope = {
    schemaVersion: 1,
    contract: "fit-evidence-assessment",
    status: "unavailable",
    reasonCode: "portfolio.provenance-validation",
    message: "Provenance validation carrier.",
    recoverableActions: [],
    provenance: [value],
    warnings: [],
  };
  return validateContract(carrier).ok;
}

function failure(
  status: "blocked" | "error",
  reasonCode: string,
  message: string,
): RecommendationPortfolioEnvelope {
  return {
    schemaVersion: 1,
    contract: "recommendation-portfolio",
    status,
    reasonCode,
    message,
    recoverableActions: [],
    provenance: [],
    warnings: [],
  };
}

function exactKeys(
  value: unknown,
  expected: readonly string[],
): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length
    && actual.every((key, index) => key === wanted[index]);
}

function sameSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const values = new Set(left);
  return right.every((item) => values.has(item));
}

function isCoverageReason(reason: string): boolean {
  return reason.includes("unknown")
    || reason.includes("unresolved")
    || reason === "portfolio.fit-tight-unapproved"
    || reason === "portfolio.assessment-unavailable";
}

function compareNumber(left: number, right: number): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function uniqueProvenance(values: Provenance[]): Provenance[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = JSON.stringify(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasContradictoryExactTaskEvidence(
  entry: PortfolioCandidateEntryV1,
): boolean {
  const byTask = new Map<string, Set<string>>();
  for (const result of entry.evidence) {
    if (result.kind !== "exact" || result.value.metric !== "task-success") {
      continue;
    }
    for (const provenance of result.value.provenance) {
      const interval = provenance.measurement?.interval;
      const task = provenance.scope.taskFamily;
      if (!exactEligibleProvenance(provenance)
        || !nonEmpty(task)
        || interval === null
        || interval === undefined) {
        continue;
      }
      const intervals = byTask.get(task) ?? new Set<string>();
      intervals.add(`${interval.lower}:${interval.upper}`);
      byTask.set(task, intervals);
    }
  }
  return [...byTask.values()].some((intervals) => intervals.size > 1);
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}

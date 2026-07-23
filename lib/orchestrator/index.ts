import {
  validateContract,
  withRunnerImportBundleContentHash,
  withHandoffContentHash,
} from "../contracts";
import type {
  ContractEnvelope,
  Provenance,
  RunnerHandoff,
} from "../contracts";
import {
  admitPortfolioCandidateEntry,
  buildRecommendationPortfolio,
} from "../portfolio";
import type {
  CandidateUniverseReceiptV1,
  PortfolioCandidateEntryV1,
  RecommendationPortfolioEnvelope,
} from "../portfolio";
import type {
  CandidateUniversePortResult,
  CreateRunnerHandoffInputV1,
  ExactConfigurationDetailResultV1,
  FinderPorts,
  FinderSessionV1,
  FinderUseCaseInput,
  OrchestratorFailure,
  RunnerHandoffEnvelope,
  RunnerImportBundleEnvelope,
} from "./types";

const finderSessionBrands = new WeakMap<object, string>();
const exactDetailBrands = new WeakMap<object, string>();
const runnerHandoffBrands = new WeakMap<object, string>();
const runnerHandoffDetailBindings = new WeakMap<object, string>();
const finderSessionBindings = new WeakMap<object, {
  request: string;
  hardware: string;
}>();
const exactDetailBindings = new WeakMap<object, {
  request: string;
  hardware: string;
}>();

export type {
  CandidateUniversePortResult,
  CreateRunnerHandoffInputV1,
  ExactConfigurationDetailResultV1,
  ExactConfigurationDetailV1,
  FinderPorts,
  FinderSessionV1,
  FinderUseCaseInput,
  HardwareTargetEnvelope,
  OrchestratorFailure,
  RecommendationRequestEnvelope,
  RunnerHandoffEnvelope,
  RunnerImportBundleEnvelope,
} from "./types";

export * from "./context";
export * from "./runner";
export * from "./runner-import";
export * from "./verification-preview";

export async function findConfigurations(
  input: FinderUseCaseInput,
  ports: FinderPorts,
): Promise<FinderSessionV1> {
  try {
    return sealSession(await findConfigurationsInternal(input, ports));
  } catch {
    return sealSession(failedFinderSession(
      "orchestrator.finder-input-or-port-invalid",
      "Finder orchestration rejected a hostile or malformed input.",
    ));
  }
}

async function findConfigurationsInternal(
  input: FinderUseCaseInput,
  ports: FinderPorts,
): Promise<FinderSessionV1> {
  const inputFailure = validateFinderInput(input);
  if (inputFailure !== null) {
    return {
      portfolio: portfolioFailure(inputFailure),
      ledger: [],
      universe: null,
    };
  }
  const requestSnapshot = structuredClone(input.request);
  const hardwareSnapshot = structuredClone(input.hardware);
  deepFreeze(requestSnapshot);
  deepFreeze(hardwareSnapshot);

  let portResult: CandidateUniversePortResult;
  try {
    portResult = await ports.loadCandidateUniverse(
      requestSnapshot,
      hardwareSnapshot,
    );
  } catch {
    return {
      portfolio: portfolioFailure({
        status: "error",
        reasonCode: "orchestrator.candidate-universe-port-failed",
        message: "The candidate-universe provider failed.",
        recoverableActions: ["Retry without changing the confirmed request."],
        provenance: [],
        warnings: [],
      }),
      ledger: [],
      universe: null,
    };
  }

  if (!isPlainData(portResult)) {
    return {
      portfolio: portfolioFailure(invalidPortResult()),
      ledger: [],
      universe: null,
    };
  }
  if (portResult.status !== "ok") {
    if (!validFailure(portResult)) {
      return failedFinderSession(
        "orchestrator.candidate-universe-port-invalid",
        "The candidate-universe provider returned a malformed failure.",
      );
    }
    return {
      portfolio: portfolioFailure(portResult),
      ledger: [],
      universe: null,
    };
  }

  let universe: CandidateUniverseReceiptV1;
  try {
    universe = structuredClone(portResult.universe);
  } catch {
    return {
      portfolio: portfolioFailure(invalidPortResult()),
      ledger: [],
      universe: null,
    };
  }
  for (const entry of universe.entries) {
    if (entry.kind === "candidate") {
      admitPortfolioCandidateEntry(entry);
    }
  }
  const result = buildRecommendationPortfolio({
    request: requestSnapshot,
    universe,
    policy: input.policy,
  });
  const session: FinderSessionV1 = {
    portfolio: result.envelope,
    ledger: result.ledger,
    universe: result.envelope.status === "blocked"
        || result.envelope.status === "error"
      ? null
      : universe,
  };
  deepFreeze(session);
  finderSessionBrands.set(session, stableJson(session));
  finderSessionBindings.set(session, {
    request: stableJson(requestSnapshot),
    hardware: stableJson(hardwareSnapshot),
  });
  return session;
}

export function getExactConfigurationDetail(
  session: FinderSessionV1,
  candidateId: string,
): ExactConfigurationDetailResultV1 {
  try {
    return getExactConfigurationDetailInternal(session, candidateId);
  } catch {
    return failure(
      "error",
      "orchestrator.detail-input-hostile",
      "Exact configuration detail rejected a hostile or malformed input.",
      [],
    );
  }
}

function getExactConfigurationDetailInternal(
  session: FinderSessionV1,
  candidateId: string,
): ExactConfigurationDetailResultV1 {
  if (!isPlainData(session) || !nonEmpty(candidateId)) {
    return failure(
      "blocked",
      "orchestrator.detail-input-invalid",
      "Exact configuration detail requires a valid finder session and candidate ID.",
      [],
    );
  }
  if (finderSessionBrands.get(session) !== stableJson(session)) {
    return failure(
      "blocked",
      "orchestrator.finder-session-invalid",
      "The finder session is copied, untrusted or changed after portfolio admission.",
      [],
    );
  }
  const portfolio = session.portfolio;
  if (!isDataPortfolio(portfolio)) {
    return copyFailure(portfolio);
  }
  if (session.universe === null) {
    return failure(
      "error",
      "orchestrator.detail-universe-missing",
      "The finder session did not retain its frozen candidate universe.",
      portfolio.provenance,
    );
  }
  const item = portfolio.data.items.find((value) =>
    value.candidateId === candidateId);
  if (item === undefined) {
    return failure(
      "blocked",
      "orchestrator.candidate-not-selected",
      "The requested configuration is not part of this portfolio.",
      portfolio.provenance,
    );
  }
  const entry = session.universe.entries.find((value) =>
    value.kind === "candidate"
    && value.candidate.candidateId === candidateId);
  if (entry === undefined || entry.kind !== "candidate") {
    return failure(
      "error",
      "orchestrator.selected-candidate-missing",
      "The selected configuration is absent from the frozen universe.",
      portfolio.provenance,
    );
  }
  if ((entry.assessment.status !== "ok"
      && entry.assessment.status !== "partial")
    || entry.assessment.data.assessmentId !== item.assessmentId) {
    return failure(
      "error",
      "orchestrator.selected-assessment-mismatch",
      "The selected configuration and assessment no longer match.",
      portfolio.provenance,
    );
  }

  const candidateEnvelope: Extract<
    ContractEnvelope,
    { contract: "exact-configuration-candidate"; status: "ok" | "partial" }
  > = {
    schemaVersion: 1,
    contract: "exact-configuration-candidate",
    status: "ok",
    data: entry.candidate,
    provenance: entry.candidate.provenance,
    completeness: {
      complete: true,
      missing: [],
      warnings: [],
      recoverableActions: [],
    },
  };
  if (!validateContract(candidateEnvelope).ok) {
    return failure(
      "error",
      "orchestrator.candidate-output-invalid",
      "The selected configuration is not a valid M-A candidate.",
      portfolio.provenance,
    );
  }
  const missing = entry.assessment.status === "partial"
    ? [...entry.assessment.completeness.missing]
    : [];
  const alternatives = session.universe.entries
    .filter((value): value is PortfolioCandidateEntryV1 =>
      value.kind === "candidate"
      && value.candidate.candidateId !== candidateId
      && value.candidate.modelFamily.modelFamilyId === item.modelFamilyId)
    .map((value) => {
      const disposition = session.ledger.find((row) =>
        row.candidateId === value.candidate.candidateId);
      return {
        candidateId: value.candidate.candidateId,
        artifactId: value.artifactId,
        quantization: value.candidate.artifact.quantization,
        disposition: disposition?.disposition ?? "unsupported",
        reasonCodes: [...(disposition?.reasonCodes
          ?? ["orchestrator.alternative-disposition-missing"])],
      };
    })
    .sort((left, right) =>
      left.quantization.localeCompare(right.quantization)
      || left.candidateId.localeCompare(right.candidateId));
  const detail: ExactConfigurationDetailResultV1 = {
    status: missing.length > 0 ? "partial" : "ok",
    data: {
      requestId: portfolio.data.requestId,
      candidate: candidateEnvelope,
      compatibilityAdmission: entry.compatibilityReceipt,
      assessment: entry.assessment,
      alternatives,
    },
    provenance: uniqueProvenance([
      ...portfolio.provenance,
      ...entry.candidate.provenance,
      ...entry.assessment.provenance,
    ]),
    missing,
    warnings: entry.assessment.status === "partial"
      ? [...entry.assessment.completeness.warnings]
      : [],
    recoverableActions: entry.assessment.status === "partial"
      ? [...entry.assessment.completeness.recoverableActions]
      : [],
  };
  deepFreeze(detail);
  exactDetailBrands.set(detail, stableJson(detail));
  const binding = finderSessionBindings.get(session);
  if (binding !== undefined) exactDetailBindings.set(detail, binding);
  return detail;
}

export function createRunnerImportBundle(
  handoff: RunnerHandoffEnvelope,
  detail: ExactConfigurationDetailResultV1,
): RunnerImportBundleEnvelope {
  try {
    if ((handoff.status !== "ok" && handoff.status !== "partial")
      || !isDataDetail(detail)
      || exactDetailBrands.get(detail) !== stableJson(detail)
      || runnerHandoffBrands.get(handoff) !== stableJson(handoff)
      || runnerHandoffDetailBindings.get(handoff) !== stableJson(detail)) {
      return importBundleFailure(
        "blocked",
        "orchestrator.import-bundle-input-invalid",
        "Import bundle creation requires the intact selected detail and a data handoff.",
      );
    }
    const handoffValidation = validateContract(handoff);
    if (!handoffValidation.ok
      || handoff.data.selectedCandidate.candidateId
        !== detail.data.candidate.data.candidateId
      || handoff.data.evidenceSummary.assessmentId
        !== detail.data.assessment.data.assessmentId) {
      return importBundleFailure(
        "blocked",
        "orchestrator.import-bundle-binding-mismatch",
        "The handoff no longer matches the selected detail and assessment.",
      );
    }
    const data = withRunnerImportBundleContentHash({
      importBundleVersion: 1,
      handoff: handoff.data,
      compatibilityAdmission: detail.data.compatibilityAdmission,
    });
    const envelope: RunnerImportBundleEnvelope = {
      schemaVersion: 1,
      contract: "runner-import-bundle",
      status: handoff.status,
      data,
      provenance: [...handoff.provenance],
      completeness: structuredClone(handoff.completeness),
    };
    const validation = validateContract(envelope);
    return validation.ok
      ? deepFreeze(envelope)
      : importBundleFailure(
        "blocked",
        "orchestrator.import-bundle-output-invalid",
        `The portable import bundle failed M-A validation: ${validation.errors.join(" ")}`,
      );
  } catch {
    return importBundleFailure(
      "error",
      "orchestrator.import-bundle-input-hostile",
      "Import bundle creation rejected a hostile or malformed input.",
    );
  }
}

export function createRunnerHandoff(
  input: CreateRunnerHandoffInputV1,
): RunnerHandoffEnvelope {
  try {
    return createRunnerHandoffInternal(input);
  } catch {
    return runnerFailure(
      "error",
      "orchestrator.handoff-input-hostile",
      "Runner handoff creation rejected a hostile or malformed input.",
      [],
    );
  }
}

function createRunnerHandoffInternal(
  input: CreateRunnerHandoffInputV1,
): RunnerHandoffEnvelope {
  if (!isPlainData(input)
    || !nonEmpty(input.handoffId)
    || !Number.isFinite(Date.parse(input.now))) {
    return runnerFailure(
      "blocked",
      "orchestrator.handoff-input-invalid",
      "Runner handoff creation requires a valid ID and creation time.",
      [],
    );
  }
  if (!isDataDetail(input.detail)) {
    if (!validFailure(input.detail)) {
      return runnerFailure(
        "error",
        "orchestrator.handoff-detail-invalid",
        "Runner handoff creation rejected a malformed detail failure.",
        [],
      );
    }
    return runnerFailure(
      input.detail.status,
      input.detail.reasonCode,
      input.detail.message,
      input.detail.provenance,
      input.detail.recoverableActions,
      input.detail.warnings,
    );
  }
  if (exactDetailBrands.get(input.detail) !== stableJson(input.detail)) {
    return runnerFailure(
      "blocked",
      "orchestrator.detail-integrity-invalid",
      "Runner handoff creation requires the intact detail selected by this M-O process.",
      input.detail.provenance,
    );
  }
  const detailBinding = exactDetailBindings.get(input.detail);
  if (detailBinding === undefined
    || detailBinding.request !== stableJson(input.request)
    || detailBinding.hardware !== stableJson(input.hardware)) {
    return runnerFailure(
      "blocked",
      "orchestrator.handoff-snapshot-mismatch",
      "The request or hardware snapshot differs from the finder evaluation.",
      input.detail.provenance,
    );
  }
  const hardwareValidation = validateContract(input.hardware);
  const requestValidation = validateContract(input.request);
  const candidate = input.detail.data.candidate.data;
  const assessment = input.detail.data.assessment.data;
  if (!hardwareValidation.ok
    || !requestValidation.ok
    || input.request.data.hardwareTargetId
      !== input.hardware.data.hardwareTargetId
    || input.detail.data.requestId !== input.request.data.requestId
    || assessment.candidateId !== candidate.candidateId
    || assessment.hardwareTargetId !== input.hardware.data.hardwareTargetId) {
    return runnerFailure(
      "blocked",
      "orchestrator.handoff-binding-mismatch",
      "The request, hardware, candidate and assessment do not bind to one handoff.",
      input.detail.provenance,
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.now)) {
    return runnerFailure(
      "blocked",
      "orchestrator.handoff-time-invalid",
      "Runner handoff creation time must be canonical UTC RFC 3339.",
      input.detail.provenance,
    );
  }
  const createdAt = new Date(input.now).toISOString();
  const expiresMs = Date.parse(createdAt) + 24 * 60 * 60 * 1_000;
  if (createdAt !== input.now
    || !Number.isFinite(expiresMs)
    || new Date(expiresMs).getUTCFullYear() > 9999) {
    return runnerFailure(
      "blocked",
      "orchestrator.handoff-time-invalid",
      "Runner handoff creation time cannot produce the required 24-hour interval.",
      input.detail.provenance,
    );
  }
  const expiresAt = new Date(expiresMs).toISOString();
  const handoff = withHandoffContentHash({
    handoffId: input.handoffId,
    schemaVersion: 1,
    createdAt,
    expiresAt,
    recommendationRequest: input.request.data,
    hardwareTarget: input.hardware.data,
    selectedCandidate: candidate,
    evidenceSummary: assessment,
    containsModelData: false,
    sideEffectAuthorization: false,
  } satisfies Omit<RunnerHandoff, "contentHash">);
  const envelope: RunnerHandoffEnvelope = {
    schemaVersion: 1,
    contract: "runner-handoff",
    status: input.detail.status,
    data: handoff,
    provenance: input.detail.provenance,
    completeness: input.detail.status === "partial"
      ? {
        complete: false,
        missing: input.detail.missing,
        warnings: input.detail.warnings,
        recoverableActions: input.detail.recoverableActions,
      }
      : {
        complete: true,
        missing: [],
        warnings: [],
        recoverableActions: [],
      },
  };
  const validation = validateContract(envelope);
  if (validation.ok) {
    deepFreeze(envelope);
    runnerHandoffBrands.set(envelope, stableJson(envelope));
    runnerHandoffDetailBindings.set(envelope, stableJson(input.detail));
    return envelope;
  }
  return runnerFailure(
      "error",
      "orchestrator.handoff-output-invalid",
      `M-O produced an invalid runner handoff: ${validation.errors.join(" ")}`,
      input.detail.provenance,
    );
}

function validateFinderInput(
  input: FinderUseCaseInput,
): OrchestratorFailure | null {
  if (!isPlainData(input)) return invalidFinderInput();
  const requestValidation = validateContract(input.request);
  const hardwareValidation = validateContract(input.hardware);
  if (!requestValidation.ok
    || !hardwareValidation.ok
    || input.request.contract !== "recommendation-request"
    || input.hardware.contract !== "hardware-target"
    || input.request.status !== "ok"
    || input.hardware.status !== "ok"
    || input.request.data.hardwareTargetId
      !== input.hardware.data.hardwareTargetId
    || input.policy.policyVersion !== 1
    || !nonEmpty(input.policy.methodologyVersion)) {
    return invalidFinderInput();
  }
  return null;
}

function invalidFinderInput(): OrchestratorFailure {
  return failure(
    "blocked",
    "orchestrator.finder-input-invalid",
    "Finder orchestration requires matching complete hardware and request envelopes.",
    [],
  );
}

function invalidPortResult(): OrchestratorFailure {
  return failure(
    "error",
    "orchestrator.candidate-universe-port-invalid",
    "The candidate-universe provider returned a non-plain or malformed result.",
    [],
  );
}

function portfolioFailure(
  value: OrchestratorFailure,
): RecommendationPortfolioEnvelope {
  const envelope: RecommendationPortfolioEnvelope = {
    schemaVersion: 1,
    contract: "recommendation-portfolio",
    ...value,
  };
  return validateContract(envelope).ok
    ? envelope
    : {
      schemaVersion: 1,
      contract: "recommendation-portfolio",
      status: "error",
      reasonCode: "orchestrator.failure-envelope-invalid",
      message: "M-O rejected an invalid failure envelope.",
      recoverableActions: [],
      provenance: [],
      warnings: [],
    };
}

function failedFinderSession(
  reasonCode: string,
  message: string,
): FinderSessionV1 {
  return {
    portfolio: portfolioFailure(failure(
      "error",
      reasonCode,
      message,
      [],
    )),
    ledger: [],
    universe: null,
  };
}

function sealSession(session: FinderSessionV1): FinderSessionV1 {
  deepFreeze(session);
  finderSessionBrands.set(session, stableJson(session));
  return session;
}

function runnerFailure(
  status: OrchestratorFailure["status"],
  reasonCode: string,
  message: string,
  provenance: Provenance[],
  recoverableActions: string[] = [],
  warnings: string[] = [],
): RunnerHandoffEnvelope {
  const envelope: RunnerHandoffEnvelope = {
    schemaVersion: 1,
    contract: "runner-handoff",
    status,
    reasonCode,
    message,
    recoverableActions,
    provenance,
    warnings,
  };
  return validateContract(envelope).ok
    ? envelope
    : {
      schemaVersion: 1,
      contract: "runner-handoff",
      status: "error",
      reasonCode: "orchestrator.failure-envelope-invalid",
      message: "M-O rejected an invalid runner-handoff failure envelope.",
      recoverableActions: [],
      provenance: [],
      warnings: [],
    };
}

function importBundleFailure(
  status: "blocked" | "error",
  reasonCode: string,
  message: string,
): RunnerImportBundleEnvelope {
  return {
    schemaVersion: 1,
    contract: "runner-import-bundle",
    status,
    reasonCode,
    message,
    recoverableActions: [],
    provenance: [],
    warnings: [],
  };
}

function failure(
  status: OrchestratorFailure["status"],
  reasonCode: string,
  message: string,
  provenance: Provenance[],
): OrchestratorFailure {
  return {
    status,
    reasonCode,
    message,
    recoverableActions: [],
    provenance,
    warnings: [],
  };
}

function copyFailure(
  value: Extract<ContractEnvelope, {
    status: "unavailable" | "blocked" | "error";
  }>,
): OrchestratorFailure {
  return {
    status: value.status,
    reasonCode: value.reasonCode,
    message: value.message,
    recoverableActions: [...value.recoverableActions],
    provenance: [...value.provenance],
    warnings: [...value.warnings],
  };
}

function isDataPortfolio(
  value: RecommendationPortfolioEnvelope,
): value is Extract<RecommendationPortfolioEnvelope, {
  status: "ok" | "partial";
}> {
  return value.status === "ok" || value.status === "partial";
}

function isDataDetail(
  value: ExactConfigurationDetailResultV1,
): value is Extract<ExactConfigurationDetailResultV1, {
  status: "ok" | "partial";
}> {
  return value.status === "ok" || value.status === "partial";
}

function validFailure(value: unknown): value is OrchestratorFailure {
  if (!isPlainData(value) || typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<OrchestratorFailure>;
  if (candidate.status !== "unavailable"
    && candidate.status !== "blocked"
    && candidate.status !== "error") {
    return false;
  }
  const envelope: RecommendationPortfolioEnvelope = {
    schemaVersion: 1,
    contract: "recommendation-portfolio",
    status: candidate.status,
    reasonCode: candidate.reasonCode as string,
    message: candidate.message as string,
    recoverableActions: candidate.recoverableActions as string[],
    provenance: candidate.provenance as Provenance[],
    warnings: candidate.warnings as string[],
  };
  return validateContract(envelope).ok;
}

function isPlainData(value: unknown, seen = new Set<object>()): boolean {
  if (value === null
    || typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean") {
    return true;
  }
  if (typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== Array.prototype) {
    return false;
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const valid = Object.values(descriptors).every((descriptor) =>
    "value" in descriptor && isPlainData(descriptor.value, seen));
  seen.delete(value);
  return valid;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

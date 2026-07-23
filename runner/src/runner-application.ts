import { createVerificationPlanRequestV1 } from "./verification-plan-policy-v1";

export type InvokePort = <T>(
  command: string,
  payload?: Record<string, unknown>,
) => Promise<T>;

export type SurfaceStatus =
  | "idle"
  | "loading"
  | "ready"
  | "blocked"
  | "unavailable"
  | "partial"
  | "error";

export type HardwareDifference = {
  field: string;
  imported: string | null;
  resolved: string | null;
  kind: string;
  reasonCode: string;
};

export type HardwareEvaluation = {
  evaluationHandle: string;
  state: "ready" | "confirmation-required" | "blocked" | "unavailable";
  reasonCodes: string[];
  confirmationFields: string[];
  differences: HardwareDifference[];
  warnings: string[];
  previewOnly: boolean;
  grantsExecutionAuthorization: boolean;
};

export type InventoryArtifact = {
  path: string;
  store: string;
  label: string;
  fileSizeBytes: number;
  sha256: string | null;
  resolution: {
    status:
      | "verified"
      | "candidateBySize"
      | "ambiguousIdentity"
      | "unavailable";
    [key: string]: unknown;
  };
};

export type InventoryScan = {
  inventoryHandle: string;
  result: {
    status: "ok" | "partial" | "unavailable";
    data: {
      registrySnapshotId: string | null;
      registryLastIngestSucceededAt: string | null;
      artifacts: InventoryArtifact[];
      duplicateGroups: string[][];
      unreadable: { path: string; reason: string }[];
      stores: { kind: string; path: string; exists: boolean; truncated: boolean }[];
      provenance: string;
    };
    warnings: string[];
  };
};

export type VerificationPlanPreview = {
  preparedHandle: string;
  plan: Record<string, unknown>;
  artifact: { path: string; sha256: string };
  benchmarkTool: { path: string; sha256: string } | null;
  quickCheckTool: { path: string; sha256: string } | null;
  warnings: string[];
  previewOnly: boolean;
  grantsExecutionAuthorization: boolean;
};

export type LifecycleSnapshot = {
  version: number;
  executionId: string;
  verificationPlanId: string;
  candidateId: string;
  sequence: number;
  state: "queued" | "running" | "stop-requested" | "terminal";
  phase:
    | "queued"
    | "integrity-recheck"
    | "model-loading"
    | "benchmark-warmup"
    | "benchmark-measured"
    | "quick-check"
    | "finalizing"
    | "complete";
  phaseCurrent: number;
  phaseTotal: number;
  retainedSeries: number;
  retainedChecks: number;
  elapsedMs: number;
  updatedAt: string;
  diagnosticCodes: string[];
};

export type VerificationResult = {
  verificationResultId: string;
  verificationPlanId: string;
  candidateId: string;
  domainStatus:
    | "completed"
    | "failed"
    | "timed-out"
    | "cancelled"
    | "oom"
    | "stopped";
  benchmarkResult: Record<string, unknown> | null;
  quickCheckResult: Record<string, unknown> | null;
};

const LIFECYCLE_STATES = new Set<LifecycleSnapshot["state"]>([
  "queued",
  "running",
  "stop-requested",
  "terminal",
]);
const LIFECYCLE_PHASES = new Set<LifecycleSnapshot["phase"]>([
  "queued",
  "integrity-recheck",
  "model-loading",
  "benchmark-warmup",
  "benchmark-measured",
  "quick-check",
  "finalizing",
  "complete",
]);
const RESULT_STATUSES = new Set<VerificationResult["domainStatus"]>([
  "completed",
  "failed",
  "timed-out",
  "cancelled",
  "oom",
  "stopped",
]);

export type RunnerSurfaceState = {
  status: SurfaceStatus;
  stage:
    | "welcome"
    | "hardware"
    | "inventory"
    | "plan"
    | "permission"
    | "progress"
    | "result"
    | "failure";
  reasonCodes: string[];
  message: string;
  importHandle?: string;
  expired?: boolean;
  hardwareEvaluation?: HardwareEvaluation;
  hardwareHandle?: string;
  inventory?: InventoryScan;
  selectionHandle?: string;
  benchmarkToolHandle?: string;
  quickCheckToolHandle?: string;
  plan?: VerificationPlanPreview;
  executionHandle?: string;
  lifecycle?: LifecycleSnapshot;
  result?: VerificationResult;
};

type ToolProbe = {
  toolHandle: string;
  kind: "benchmark" | "quick-check";
  canonicalPath: string;
  sha256: string;
  sizeBytes: number;
  modifiedUnixNanos: string;
  observedProduct: string;
  observedEngine: string;
  observedEngineBuild: string;
  probeProtocolId: string;
  observedAt: string;
  previewOnly: boolean;
  grantsExecutionAuthorization: boolean;
  childWriteIsolationEnforced: boolean;
  childNetworkIsolationEnforced: boolean;
};

type HardwareConfirmation = {
  hardwareHandle: string;
  hardwareTargetId: string;
  resolvedTarget: Record<string, unknown>;
  effectiveTarget: Record<string, unknown>;
  differences: HardwareDifference[];
  acknowledgedReasonCodes: string[];
  acknowledgedConfirmationFields: string[];
  warnings: string[];
  previewOnly: boolean;
  grantsExecutionAuthorization: boolean;
};

const HARDWARE_STATES = new Set<HardwareEvaluation["state"]>([
  "ready",
  "confirmation-required",
  "blocked",
  "unavailable",
]);
const INVENTORY_STATUSES = new Set<InventoryScan["result"]["status"]>([
  "ok",
  "partial",
  "unavailable",
]);
const INVENTORY_RESOLUTIONS = new Set<
  InventoryArtifact["resolution"]["status"]
>(["verified", "candidateBySize", "ambiguousIdentity", "unavailable"]);

function runtimeRecord(
  value: unknown,
  reason: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw [reason];
  }
  return value as Record<string, unknown>;
}

function nonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function stringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function lowercaseSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return keys.every((key) => allowed.includes(key));
}

export function reasonCodes(error: unknown): string[] {
  if (Array.isArray(error)) return error.map(String);
  if (typeof error === "string") return [error];
  if (error instanceof Error) return [error.message];
  return ["m-p.runner.unexpected-error"];
}

export function statusForReasons(reasons: string[]): SurfaceStatus {
  const joined = reasons.join(" ").toLowerCase();
  if (joined.includes("unavailable")) return "unavailable";
  if (
    joined.includes("blocked") ||
    joined.includes("required") ||
    joined.includes("mismatch") ||
    joined.includes("invalid") ||
    joined.includes("unsupported") ||
    joined.includes("stale") ||
    joined.includes("consumed") ||
    joined.includes("mutation")
  ) {
    return "blocked";
  }
  return "error";
}

export class RunnerApplication {
  readonly #invoke: InvokePort;
  #state: RunnerSurfaceState = {
    status: "idle",
    stage: "welcome",
    reasonCodes: [],
    message: "Nothing is scanned or run until you choose it.",
  };

  constructor(invoke: InvokePort) {
    this.#invoke = invoke;
  }

  snapshot(): RunnerSurfaceState {
    return structuredClone(this.#state);
  }

  async importBundle(bundleJson: string, confirmExpired = false): Promise<RunnerSurfaceState> {
    return this.#attempt("welcome", "Validating the handoff without scanning this machine…", async () => {
      if (!bundleJson.trim()) throw ["m-p.import.bundle-required"];
      const preview = await this.#invoke<{
        importHandle: string;
        expired: boolean;
        warnings: string[];
        previewOnly: boolean;
        grantsExecutionAuthorization: boolean;
      }>("admit_runner_import_bundle_preview", { bundleJson, confirmExpired });
      this.#assertImportPreview(preview);
      if (!preview.previewOnly || preview.grantsExecutionAuthorization) {
        throw ["m-p.import.preview-authority-invalid"];
      }
      this.#state = {
        status: preview.expired ? "partial" : "ready",
        stage: "hardware",
        reasonCodes: preview.warnings,
        message: preview.expired
          ? "The handoff is expired. It may be inspected, but it authorizes no execution."
          : "Handoff accepted for inspection. The website has not checked this machine.",
        importHandle: preview.importHandle,
        expired: preview.expired,
      };
    });
  }

  async evaluateHardware(): Promise<RunnerSurfaceState> {
    return this.#attempt("hardware", "Reading hardware only after this action…", async () => {
      const importHandle = this.#required("importHandle");
      const evaluation = await this.#invoke<HardwareEvaluation>(
        "evaluate_hardware_confirmation_preview",
        { importHandle },
      );
      this.#assertHardwareEvaluation(evaluation);
      if (!evaluation.previewOnly || evaluation.grantsExecutionAuthorization) {
        throw ["m-p.hardware.preview-authority-invalid"];
      }
      this.#state.hardwareEvaluation = evaluation;
      this.#state.reasonCodes = evaluation.reasonCodes;
      this.#state.status =
        evaluation.state === "ready"
          ? "ready"
          : evaluation.state === "confirmation-required"
            ? "partial"
            : evaluation.state;
      this.#state.message =
        evaluation.state === "ready"
          ? "Detected facts match the imported target."
          : evaluation.state === "confirmation-required"
            ? "Review and acknowledge every listed difference."
            : "Hardware confirmation cannot continue.";
    });
  }

  async confirmHardware(acknowledgeDifferences: boolean): Promise<RunnerSurfaceState> {
    return this.#attempt("hardware", "Binding the reviewed hardware facts…", async () => {
      const evaluation = this.#state.hardwareEvaluation;
      if (!evaluation) throw ["m-p.hardware.evaluation-required"];
      if (evaluation.state === "blocked" || evaluation.state === "unavailable") {
        throw [
          `m-p.hardware.confirmation-${evaluation.state}`,
          ...evaluation.reasonCodes,
        ];
      }
      if (
        evaluation.state === "confirmation-required" &&
        !acknowledgeDifferences
      ) {
        throw ["m-p.hardware.exact-acknowledgement-required"];
      }
      const acknowledgement =
        evaluation.state === "confirmation-required"
          ? {
              reasonCodes: evaluation.reasonCodes,
              confirmationFields: evaluation.confirmationFields,
            }
          : null;
      const confirmed = await this.#invoke<HardwareConfirmation>(
        "confirm_hardware_confirmation_preview",
        {
          evaluationHandle: evaluation.evaluationHandle,
          acknowledgement,
        },
      );
      this.#assertHardwareConfirmation(confirmed);
      this.#state.hardwareHandle = confirmed.hardwareHandle;
      this.#state.stage = "inventory";
      this.#state.status = "ready";
      this.#state.reasonCodes = [];
      this.#state.message = "Hardware target confirmed. No model files have been opened.";
    });
  }

  async scanInventory(extraDirectories: string[]): Promise<RunnerSurfaceState> {
    return this.#attempt("inventory", "Scanning named local directories read-only…", async () => {
      this.#required("hardwareHandle");
      const inventory = await this.#invoke<InventoryScan>("scan_inventory_preview", {
        extraDirectories: extraDirectories.filter((value) => value.trim()),
      });
      this.#assertInventory(inventory);
      this.#state.inventory = inventory;
      this.#state.reasonCodes = inventory.result.warnings;
      this.#state.status =
        inventory.result.status === "ok" ? "ready" : inventory.result.status;
      this.#state.message = inventory.result.data.artifacts.length
        ? "Inventory results are local and read-only. Select one verified artifact."
        : "No supported local model artifact was found.";
    });
  }

  async selectArtifact(selectedPath: string): Promise<RunnerSurfaceState> {
    return this.#attempt("inventory", "Rechecking the selected artifact identity…", async () => {
      if (!selectedPath.trim()) throw ["m-p.inventory.selection-required"];
      const inventoryHandle = this.#state.inventory?.inventoryHandle ??
        (() => {
          throw ["m-p.inventory.scan-required"];
        })();
      const matches = this.#state.inventory?.result.data.artifacts.filter(
        (artifact) => artifact.path === selectedPath,
      ) ?? [];
      if (matches.length !== 1) {
        throw [
          matches.length === 0
            ? "m-p.inventory.selection-not-in-scan"
            : "m-p.inventory.selection-path-ambiguous",
        ];
      }
      const artifact = matches[0];
      const payload = {
        importHandle: this.#required("importHandle"),
        inventoryHandle,
        selectedPath,
      };
      let selected: { selectionHandle: string };
      if (artifact.resolution.status === "verified") {
        const verified = await this.#invoke<{
          selectionHandle: string;
          selectedPath: string;
          artifactId: string;
          sha256: string;
        }>(
          "select_inventory_preview",
          payload,
        );
        if (
          !nonemptyString(verified.selectionHandle) ||
          verified.selectedPath !== selectedPath ||
          !nonemptyString(verified.artifactId) ||
          !lowercaseSha256(verified.sha256)
        ) {
          throw ["m-p.inventory.selection-preview-invalid"];
        }
        selected = verified;
      } else if (artifact.resolution.status === "candidateBySize") {
        const promotion = await this.#invoke<{
          selectionHandle: string;
          previewOnly: boolean;
          grantsExecutionAuthorization: boolean;
          status: string;
          selectedPath: string;
          artifactId: string;
          sha256: string;
          bytes: number;
        }>("hash_selected_inventory_file_preview", payload);
        if (
          !nonemptyString(promotion.selectionHandle) ||
          !promotion.previewOnly ||
          promotion.grantsExecutionAuthorization ||
          promotion.status !== "verified" ||
          promotion.selectedPath !== selectedPath ||
          !nonemptyString(promotion.artifactId) ||
          !lowercaseSha256(promotion.sha256) ||
          !Number.isSafeInteger(promotion.bytes) ||
          promotion.bytes < 1
        ) {
          throw ["m-p.inventory.hash-preview-authority-invalid"];
        }
        selected = promotion;
      } else {
        throw ["m-p.inventory.selection-not-verifiable"];
      }
      this.#state.selectionHandle = selected.selectionHandle;
      this.#state.status = "ready";
      this.#state.message =
        artifact.resolution.status === "candidateBySize"
          ? "The explicitly selected file was hashed and exactly matched the promoted artifact."
          : "Exact artifact identity verified for this handoff.";
    });
  }

  async probeTools(
    benchmarkPath: string,
    quickCheckPath: string,
  ): Promise<RunnerSurfaceState> {
    return this.#attempt("plan", "Inspecting the selected executable identities…", async () => {
      this.#required("selectionHandle");
      if (!benchmarkPath.trim() || !quickCheckPath.trim()) {
        throw ["m-p.tools.both-paths-required"];
      }
      const benchmark = await this.#invoke<ToolProbe>("probe_existing_tool_preview", {
        kind: "benchmark",
        selectedPath: benchmarkPath,
      });
      this.#assertToolProbe(benchmark, "benchmark");
      const quick = await this.#invoke<ToolProbe>("probe_existing_tool_preview", {
        kind: "quick-check",
        selectedPath: quickCheckPath,
      });
      this.#assertToolProbe(quick, "quick-check");
      this.#state.benchmarkToolHandle = benchmark.toolHandle;
      this.#state.quickCheckToolHandle = quick.toolHandle;
      this.#state.status = "ready";
      this.#state.reasonCodes = [
        ...(!benchmark.childNetworkIsolationEnforced ||
        !quick.childNetworkIsolationEnforced
          ? ["m-j.child-network-isolation-not-enforced"]
          : []),
        ...(!benchmark.childWriteIsolationEnforced ||
        !quick.childWriteIsolationEnforced
          ? ["m-j.child-write-isolation-not-enforced"]
          : []),
      ];
      this.#state.message =
        "Executable paths, hashes, and reported builds were checked. This is not execution authorization.";
    });
  }

  async prepareVerification(): Promise<RunnerSurfaceState> {
    return this.#attempt("plan", "Preparing a non-authorizing execution preview…", async () => {
      const plan = await this.#invoke<VerificationPlanPreview>(
        "prepare_verification_plan_preview",
        {
          request: createVerificationPlanRequestV1({
            importHandle: this.#required("importHandle"),
            hardwareHandle: this.#required("hardwareHandle"),
            selectionHandle: this.#required("selectionHandle"),
            benchmarkToolHandle: this.#required("benchmarkToolHandle"),
            quickCheckToolHandle: this.#required("quickCheckToolHandle"),
          }),
        },
      );
      this.#assertPlanPreview(plan);
      if (!plan.previewOnly || plan.grantsExecutionAuthorization) {
        throw ["m-p.plan.preview-authority-invalid"];
      }
      this.#state.plan = plan;
      this.#state.stage = "permission";
      this.#state.status = "ready";
      this.#state.reasonCodes = plan.warnings;
      this.#state.message =
        "Review the exact plan. It will load the selected model and keep this machine busy.";
    });
  }

  async startExecution(consent: {
    localProcess: boolean;
    modelLoad: boolean;
    machineBusy: boolean;
  }): Promise<RunnerSurfaceState> {
    return this.#attempt("permission", "Crossing the one-use execution boundary…", async () => {
      if (!consent.localProcess || !consent.modelLoad || !consent.machineBusy) {
        throw ["m-p.execution.all-consents-required"];
      }
      const started = await this.#invoke<{
        executionHandle: string;
        snapshot: LifecycleSnapshot;
      }>("start_verification_execution", {
        request: {
          preparedHandle: this.#state.plan?.preparedHandle ??
            (() => {
              throw ["m-p.execution.prepared-plan-required"];
            })(),
          acknowledgeLocalProcessExecution: consent.localProcess,
          acknowledgeModelLoad: consent.modelLoad,
          acknowledgeMachineMayBeBusy: consent.machineBusy,
        },
      });
      if (!nonemptyString(started.executionHandle)) {
        throw ["m-p.execution.start-preview-invalid"];
      }
      this.#state.executionHandle = started.executionHandle;
      this.#admitLifecycle(started.snapshot);
      this.#state.stage = "progress";
      this.#state.status = "loading";
      this.#state.reasonCodes = started.snapshot.diagnosticCodes;
      this.#state.message = "Verification started. No result is claimed until admitted output arrives.";
    });
  }

  async refreshExecution(): Promise<RunnerSurfaceState> {
    return this.#attempt("progress", "Refreshing runner-owned progress…", async () => {
      const executionHandle = this.#required("executionHandle");
      const lifecycle = await this.#invoke<LifecycleSnapshot>(
        "get_verification_execution_status",
        { request: { executionHandle } },
      );
      if (!this.#admitLifecycle(lifecycle)) {
        this.#state.status = "loading";
        this.#state.message =
          "A delayed progress response was ignored; the newest runner state remains visible.";
        return;
      }
      this.#state.reasonCodes = lifecycle.diagnosticCodes;
      if (lifecycle.state !== "terminal") {
        this.#state.status =
          lifecycle.state === "stop-requested" ? "partial" : "loading";
        this.#state.message = `${lifecycle.phase}: ${lifecycle.phaseCurrent} of ${lifecycle.phaseTotal}`;
        return;
      }
      const result = await this.#invoke<{
        snapshot: LifecycleSnapshot;
        verificationResult: VerificationResult | null;
      }>("get_verification_execution_result", {
        request: { executionHandle },
      });
      if (!this.#admitLifecycle(result.snapshot)) {
        this.#state.status = "blocked";
        this.#state.reasonCodes = ["m-p.execution.result-snapshot-regressed"];
        this.#state.message =
          "A result tied to an older lifecycle snapshot was rejected.";
        return;
      }
      if (
        result.snapshot.state !== "terminal" ||
        result.snapshot.phase !== "complete"
      ) {
        throw ["m-p.execution.result-snapshot-not-terminal"];
      }
      if (!result.verificationResult) {
        this.#state.stage = "failure";
        this.#state.status = "error";
        this.#state.reasonCodes = [
          ...result.snapshot.diagnosticCodes,
          "m-p.execution.terminal-result-unavailable",
        ];
        this.#state.message = "The run ended without an admissible result.";
        return;
      }
      this.#assertResult(result.verificationResult);
      if (
        result.verificationResult.verificationPlanId !==
          result.snapshot.verificationPlanId ||
        result.verificationResult.candidateId !== result.snapshot.candidateId
      ) {
        throw ["m-p.execution.result-identity-mismatch"];
      }
      this.#state.result = structuredClone(result.verificationResult);
      const completed = result.verificationResult.domainStatus === "completed";
      const retainedEvidence =
        result.verificationResult.benchmarkResult !== null ||
        result.verificationResult.quickCheckResult !== null;
      this.#state.stage = completed ? "result" : "failure";
      this.#state.status = completed
        ? "ready"
        : retainedEvidence
          ? "partial"
          : "error";
      this.#state.message = completed
        ? "Measured on this machine under the displayed exact settings."
        : retainedEvidence
          ? "The run did not complete. Admitted partial observations remain visible."
          : "The run did not complete and produced no admissible observation.";
    });
  }

  async stopExecution(): Promise<RunnerSurfaceState> {
    return this.#attempt("progress", "Requesting a safe stop…", async () => {
      const executionHandle = this.#required("executionHandle");
      const lifecycle = await this.#invoke<LifecycleSnapshot>(
        "stop_verification_execution",
        { request: { executionHandle } },
      );
      if (!this.#admitLifecycle(lifecycle)) {
        this.#state.status = "partial";
        this.#state.message =
          "A delayed stop response was ignored; the newest runner state remains visible.";
        return;
      }
      this.#state.status = lifecycle.state === "terminal" ? "partial" : "loading";
      this.#state.message =
        lifecycle.state === "terminal"
          ? "The run was already finished. Its terminal result is unchanged."
          : "Stop requested. Completed observations will be retained.";
    });
  }

  async #attempt(
    stage: RunnerSurfaceState["stage"],
    loadingMessage: string,
    operation: () => Promise<void>,
  ): Promise<RunnerSurfaceState> {
    this.#state.stage = stage;
    this.#state.status = "loading";
    this.#state.reasonCodes = [];
    this.#state.message = loadingMessage;
    try {
      await operation();
    } catch (error) {
      const reasons = reasonCodes(error);
      this.#state.status = statusForReasons(reasons);
      this.#state.reasonCodes = reasons;
      this.#state.message = "This step could not continue. No later permission was granted.";
    }
    return this.snapshot();
  }

  #required(
    field:
      | "importHandle"
      | "hardwareHandle"
      | "selectionHandle"
      | "benchmarkToolHandle"
      | "quickCheckToolHandle"
      | "executionHandle",
  ): string {
    const value = this.#state[field];
    if (!value) throw [`m-p.${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}-required`];
    return value;
  }

  #assertImportPreview(value: {
    importHandle: string;
    expired: boolean;
    warnings: string[];
    previewOnly: boolean;
    grantsExecutionAuthorization: boolean;
  }): void {
    const record = runtimeRecord(value, "m-p.import.preview-invalid");
    if (
      !hasOnlyKeys(record, [
        "importHandle",
        "expired",
        "warnings",
        "previewOnly",
        "grantsExecutionAuthorization",
      ]) ||
      !nonemptyString(value.importHandle) ||
      typeof value.expired !== "boolean" ||
      !stringList(value.warnings) ||
      typeof value.previewOnly !== "boolean" ||
      typeof value.grantsExecutionAuthorization !== "boolean"
    ) {
      throw ["m-p.import.preview-invalid"];
    }
  }

  #assertHardwareEvaluation(value: HardwareEvaluation): void {
    const record = runtimeRecord(value, "m-p.hardware.preview-invalid");
    const differencesValid =
      Array.isArray(value.differences) &&
      value.differences.every(
        (difference) => {
          const differenceRecord = runtimeRecord(
            difference,
            "m-p.hardware.preview-invalid",
          );
          return (
          hasOnlyKeys(differenceRecord, [
            "field",
            "imported",
            "resolved",
            "kind",
            "reasonCode",
          ]) &&
          nonemptyString(difference.field) &&
          (difference.imported === null ||
            typeof difference.imported === "string") &&
          (difference.resolved === null ||
            typeof difference.resolved === "string") &&
          ["informational", "normalized", "confirmation-required"].includes(
            difference.kind,
          ) &&
          nonemptyString(difference.reasonCode)
          );
        },
      );
    if (
      !hasOnlyKeys(record, [
        "evaluationHandle",
        "state",
        "reasonCodes",
        "confirmationFields",
        "differences",
        "warnings",
        "previewOnly",
        "grantsExecutionAuthorization",
      ]) ||
      !nonemptyString(value.evaluationHandle) ||
      !HARDWARE_STATES.has(value.state) ||
      !stringList(value.reasonCodes) ||
      !stringList(value.confirmationFields) ||
      !differencesValid ||
      !stringList(value.warnings) ||
      typeof value.previewOnly !== "boolean" ||
      typeof value.grantsExecutionAuthorization !== "boolean"
    ) {
      throw ["m-p.hardware.preview-invalid"];
    }
  }

  #assertHardwareConfirmation(value: HardwareConfirmation): void {
    const record = runtimeRecord(
      value,
      "m-p.hardware.confirmation-preview-invalid",
    );
    if (
      !hasOnlyKeys(record, [
        "hardwareHandle",
        "hardwareTargetId",
        "resolvedTarget",
        "effectiveTarget",
        "differences",
        "acknowledgedReasonCodes",
        "acknowledgedConfirmationFields",
        "warnings",
        "previewOnly",
        "grantsExecutionAuthorization",
      ]) ||
      !nonemptyString(value.hardwareHandle) ||
      !nonemptyString(value.hardwareTargetId) ||
      !runtimeRecord(
        value.resolvedTarget,
        "m-p.hardware.confirmation-preview-invalid",
      ) ||
      !runtimeRecord(
        value.effectiveTarget,
        "m-p.hardware.confirmation-preview-invalid",
      ) ||
      !Array.isArray(value.differences) ||
      !stringList(value.acknowledgedReasonCodes) ||
      !stringList(value.acknowledgedConfirmationFields) ||
      !stringList(value.warnings) ||
      !value.previewOnly ||
      value.grantsExecutionAuthorization
    ) {
      throw ["m-p.hardware.confirmation-preview-invalid"];
    }
  }

  #assertInventory(value: InventoryScan): void {
    const root = runtimeRecord(value, "m-p.inventory.scan-preview-invalid");
    const result = runtimeRecord(
      value.result,
      "m-p.inventory.scan-preview-invalid",
    );
    const data = runtimeRecord(
      value.result?.data,
      "m-p.inventory.scan-preview-invalid",
    );
    const artifacts = data.artifacts;
    const artifactsValid =
      Array.isArray(artifacts) &&
      artifacts.every((artifactValue) => {
        const artifact = runtimeRecord(
          artifactValue,
          "m-p.inventory.scan-preview-invalid",
        );
        const resolution = runtimeRecord(
          artifact.resolution,
          "m-p.inventory.scan-preview-invalid",
        );
        return (
          hasOnlyKeys(artifact, [
            "path",
            "store",
            "label",
            "fileSizeBytes",
            "sha256",
            "resolution",
          ]) &&
          nonemptyString(artifact.path) &&
          nonemptyString(artifact.store) &&
          nonemptyString(artifact.label) &&
          Number.isSafeInteger(artifact.fileSizeBytes) &&
          Number(artifact.fileSizeBytes) >= 0 &&
          (artifact.sha256 === null || lowercaseSha256(artifact.sha256)) &&
          INVENTORY_RESOLUTIONS.has(
            resolution.status as InventoryArtifact["resolution"]["status"],
          ) &&
          hasOnlyKeys(
            resolution,
            resolution.status === "verified"
              ? ["status", "identity"]
              : resolution.status === "candidateBySize"
                ? ["status", "candidates"]
                : ["status", "candidates", "reasonCode", "message"],
          )
        );
      });
    if (
      !hasOnlyKeys(root, ["inventoryHandle", "result"]) ||
      !hasOnlyKeys(result, ["status", "data", "warnings"]) ||
      !hasOnlyKeys(data, [
        "registrySnapshotId",
        "registryLastIngestSucceededAt",
        "stores",
        "artifacts",
        "duplicateGroups",
        "unreadable",
        "provenance",
      ]) ||
      !nonemptyString(value.inventoryHandle) ||
      !INVENTORY_STATUSES.has(value.result?.status) ||
      !artifactsValid ||
      !Array.isArray(data.unreadable) ||
      !Array.isArray(data.stores) ||
      !Array.isArray(data.duplicateGroups) ||
      !nonemptyString(data.provenance) ||
      !stringList(value.result?.warnings)
    ) {
      throw ["m-p.inventory.scan-preview-invalid"];
    }
  }

  #assertToolProbe(
    value: ToolProbe,
    expectedKind: ToolProbe["kind"],
  ): void {
    const record = runtimeRecord(value, "m-p.tools.probe-preview-invalid");
    if (
      !hasOnlyKeys(record, [
        "toolHandle",
        "kind",
        "canonicalPath",
        "sha256",
        "sizeBytes",
        "modifiedUnixNanos",
        "observedProduct",
        "observedEngine",
        "observedEngineBuild",
        "probeProtocolId",
        "observedAt",
        "previewOnly",
        "grantsExecutionAuthorization",
        "childWriteIsolationEnforced",
        "childNetworkIsolationEnforced",
      ]) ||
      !nonemptyString(value.toolHandle) ||
      value.kind !== expectedKind ||
      !nonemptyString(value.canonicalPath) ||
      !lowercaseSha256(value.sha256) ||
      !Number.isSafeInteger(value.sizeBytes) ||
      value.sizeBytes < 1 ||
      !nonemptyString(value.modifiedUnixNanos) ||
      !nonemptyString(value.observedProduct) ||
      !nonemptyString(value.observedEngine) ||
      !nonemptyString(value.observedEngineBuild) ||
      !nonemptyString(value.probeProtocolId) ||
      !nonemptyString(value.observedAt) ||
      !value.previewOnly ||
      value.grantsExecutionAuthorization ||
      typeof value.childWriteIsolationEnforced !== "boolean" ||
      typeof value.childNetworkIsolationEnforced !== "boolean"
    ) {
      throw ["m-p.tools.probe-preview-invalid"];
    }
  }

  #assertPlanPreview(value: VerificationPlanPreview): void {
    const root = runtimeRecord(value, "m-p.plan.preview-invalid");
    const plan = runtimeRecord(value.plan, "m-p.plan.preview-invalid");
    const benchmarkPlan = runtimeRecord(
      plan.benchmarkPlan,
      "m-p.plan.preview-invalid",
    );
    const quickCheckPlan = runtimeRecord(
      plan.quickCheckPlan,
      "m-p.plan.preview-invalid",
    );
    const checked = (identity: unknown): boolean => {
      const record = runtimeRecord(identity, "m-p.plan.preview-invalid");
      return (
        nonemptyString(record.path) && lowercaseSha256(record.sha256)
      );
    };
    if (
      !hasOnlyKeys(root, [
        "preparedHandle",
        "plan",
        "artifact",
        "benchmarkTool",
        "quickCheckTool",
        "warnings",
        "previewOnly",
        "grantsExecutionAuthorization",
      ]) ||
      !nonemptyString(value.preparedHandle) ||
      !nonemptyString(plan.verificationPlanId) ||
      !nonemptyString(plan.candidateId) ||
      !nonemptyString(benchmarkPlan.benchmarkPlanId) ||
      benchmarkPlan.candidateId !== plan.candidateId ||
      !nonemptyString(quickCheckPlan.quickCheckPlanId) ||
      quickCheckPlan.candidateId !== plan.candidateId ||
      !checked(value.artifact) ||
      (value.benchmarkTool !== null && !checked(value.benchmarkTool)) ||
      (value.quickCheckTool !== null && !checked(value.quickCheckTool)) ||
      !stringList(value.warnings) ||
      typeof value.previewOnly !== "boolean" ||
      typeof value.grantsExecutionAuthorization !== "boolean"
    ) {
      throw ["m-p.plan.preview-invalid"];
    }
  }

  #admitLifecycle(incoming: LifecycleSnapshot): boolean {
    this.#assertLifecycle(incoming);
    const current = this.#state.lifecycle;
    if (!current) {
      this.#state.lifecycle = structuredClone(incoming);
      return true;
    }
    if (
      incoming.executionId !== current.executionId ||
      incoming.verificationPlanId !== current.verificationPlanId ||
      incoming.candidateId !== current.candidateId
    ) {
      throw ["m-p.execution.lifecycle-identity-mismatch"];
    }
    if (incoming.sequence < current.sequence) return false;
    if (
      incoming.sequence === current.sequence &&
      JSON.stringify(incoming) !== JSON.stringify(current)
    ) {
      throw ["m-p.execution.same-sequence-mutation"];
    }
    this.#state.lifecycle = structuredClone(incoming);
    return true;
  }

  #assertLifecycle(value: LifecycleSnapshot): void {
    const counts = [
      value.sequence,
      value.phaseCurrent,
      value.phaseTotal,
      value.retainedSeries,
      value.retainedChecks,
      value.elapsedMs,
    ];
    if (
      !hasOnlyKeys(runtimeRecord(value, "m-p.execution.lifecycle-invalid"), [
        "version",
        "executionId",
        "verificationPlanId",
        "candidateId",
        "sequence",
        "state",
        "phase",
        "phaseCurrent",
        "phaseTotal",
        "retainedSeries",
        "retainedChecks",
        "elapsedMs",
        "updatedAt",
        "diagnosticCodes",
      ]) ||
      value.version !== 1 ||
      !value.executionId ||
      !value.verificationPlanId ||
      !value.candidateId ||
      !LIFECYCLE_STATES.has(value.state) ||
      !LIFECYCLE_PHASES.has(value.phase) ||
      !Number.isFinite(Date.parse(value.updatedAt)) ||
      (value.state === "queued" && value.phase !== "queued") ||
      (value.state === "terminal" && value.phase !== "complete") ||
      (value.phase === "complete" && value.state !== "terminal") ||
      counts.some((count) => !Number.isSafeInteger(count) || count < 0) ||
      value.phaseCurrent > value.phaseTotal ||
      !Array.isArray(value.diagnosticCodes) ||
      value.diagnosticCodes.some((code) => typeof code !== "string")
    ) {
      throw ["m-p.execution.lifecycle-invalid"];
    }
  }

  #assertResult(value: VerificationResult): void {
    const nestedResult = (
      nested: Record<string, unknown> | null,
      kind: "benchmark" | "quick-check",
    ): boolean => {
      if (nested === null) return true;
      if (
        !hasOnlyKeys(
          nested,
          kind === "benchmark"
            ? [
                "benchmarkResultId",
                "benchmarkPlanId",
                "candidateId",
                "domainStatus",
                "series",
                "calibrationEligible",
                "calibrationExclusions",
                "diagnostics",
              ]
            : [
                "quickCheckResultId",
                "quickCheckPlanId",
                "candidateId",
                "domainStatus",
                "checks",
              ],
        )
      ) {
        return false;
      }
      const plan = runtimeRecord(
        this.#state.plan?.plan,
        "m-p.execution.result-invalid",
      );
      const planned = runtimeRecord(
        plan[kind === "benchmark" ? "benchmarkPlan" : "quickCheckPlan"],
        "m-p.execution.result-invalid",
      );
      const idField =
        kind === "benchmark" ? "benchmarkResultId" : "quickCheckResultId";
      const planField =
        kind === "benchmark" ? "benchmarkPlanId" : "quickCheckPlanId";
      const observations = kind === "benchmark" ? "series" : "checks";
      const plannedObservations =
        kind === "benchmark" ? planned.measurementKinds : planned.checks;
      const plannedKeys = Array.isArray(plannedObservations)
        ? plannedObservations.map((item) =>
            kind === "benchmark"
              ? item
              : JSON.stringify({
                  checkId: runtimeRecord(
                    item,
                    "m-p.execution.result-invalid",
                  ).checkId,
                  criterion: runtimeRecord(
                    item,
                    "m-p.execution.result-invalid",
                  ).criterion,
                }),
          )
        : [];
      const observedKeys = Array.isArray(nested[observations])
        ? (nested[observations] as unknown[]).map((item) => {
            const observation = runtimeRecord(
              item,
              "m-p.execution.result-invalid",
            );
            return kind === "benchmark"
              ? observation.kind
              : JSON.stringify({
                  checkId: observation.checkId,
                  criterion: observation.criterion,
                });
          })
        : [];
      const benchmarkCountsMatch =
        kind !== "benchmark" ||
        (Number.isSafeInteger(planned.warmupRuns) &&
          Number.isSafeInteger(planned.measuredRuns) &&
          Number(planned.measuredRuns) > 0 &&
          Array.isArray(nested[observations]) &&
          (nested[observations] as unknown[]).every((item) => {
            const series = runtimeRecord(
              item,
              "m-p.execution.result-invalid",
            );
            return (
              Array.isArray(series.warmupSamples) &&
              series.warmupSamples.length === planned.warmupRuns &&
              Array.isArray(series.measuredSamples) &&
              series.measuredSamples.length === planned.measuredRuns
            );
          }));
      const resultMetadataValid =
        kind !== "benchmark" ||
        (typeof nested.calibrationEligible === "boolean" &&
          stringList(nested.calibrationExclusions) &&
          stringList(nested.diagnostics));
      return (
        nonemptyString(nested[idField]) &&
        nonemptyString(nested[planField]) &&
        nested[planField] === planned[planField] &&
        nested.candidateId === value.candidateId &&
        RESULT_STATUSES.has(
          nested.domainStatus as VerificationResult["domainStatus"],
        ) &&
        Array.isArray(nested[observations]) &&
        plannedKeys.length > 0 &&
        JSON.stringify(observedKeys) === JSON.stringify(plannedKeys) &&
        benchmarkCountsMatch &&
        resultMetadataValid &&
        this.#validResultObservations(
          nested[observations] as unknown[],
          kind,
        )
      );
    };
    if (
      !hasOnlyKeys(
        runtimeRecord(value, "m-p.execution.result-invalid"),
        [
          "verificationResultId",
          "verificationPlanId",
          "candidateId",
          "domainStatus",
          "benchmarkResult",
          "quickCheckResult",
        ],
      ) ||
      !value.verificationResultId ||
      !value.verificationPlanId ||
      !value.candidateId ||
      !RESULT_STATUSES.has(value.domainStatus) ||
      !nestedResult(value.benchmarkResult, "benchmark") ||
      !nestedResult(value.quickCheckResult, "quick-check") ||
      (value.domainStatus === "completed" &&
        (value.benchmarkResult === null ||
          value.quickCheckResult === null ||
          value.benchmarkResult.domainStatus !== "completed" ||
          value.quickCheckResult.domainStatus !== "completed"))
    ) {
      throw ["m-p.execution.result-invalid"];
    }
  }

  #validResultObservations(
    values: unknown[],
    kind: "benchmark" | "quick-check",
  ): boolean {
    if (values.length === 0) return false;
    if (kind === "benchmark") {
      return values.every((value) => {
        const series = runtimeRecord(value, "m-p.execution.result-invalid");
        const aggregate = runtimeRecord(
          series.aggregate,
          "m-p.execution.result-invalid",
        );
        return (
          hasOnlyKeys(series, [
            "kind",
            "unit",
            "warmupSamples",
            "measuredSamples",
            "aggregate",
            "completion",
            "stability",
            "evidence",
          ]) &&
          ["prompt-processing", "generation", "stability"].includes(
            String(series.kind),
          ) &&
          [
            "bytes",
            "tokens-per-second",
            "milliseconds",
            "probability",
            "joules",
            "boolean",
            "count",
            "other",
          ].includes(String(series.unit)) &&
          Array.isArray(series.warmupSamples) &&
          series.warmupSamples.every(
            (sample) => typeof sample === "number" && Number.isFinite(sample),
          ) &&
          Array.isArray(series.measuredSamples) &&
          series.measuredSamples.length > 0 &&
          series.measuredSamples.every(
            (sample) => typeof sample === "number" && Number.isFinite(sample),
          ) &&
          hasOnlyKeys(aggregate, ["minimum", "maximum", "median"]) &&
          [aggregate.minimum, aggregate.maximum, aggregate.median].every(
            (sample) => typeof sample === "number" && Number.isFinite(sample),
          ) &&
          series.completion === "completed" &&
          ["stable", "unstable", "insufficient-samples", "not-applicable"]
            .includes(String(series.stability)) &&
          this.#validObservationEvidence(series.evidence, "measurement")
        );
      });
    }
    return values.every((value) => {
      const check = runtimeRecord(value, "m-p.execution.result-invalid");
      return (
        hasOnlyKeys(check, [
          "checkId",
          "criterion",
          "status",
          "explanation",
          "localDiagnostics",
          "evidence",
        ]) &&
        nonemptyString(check.checkId) &&
        nonemptyString(check.criterion) &&
        ["pass", "fail", "not-run"].includes(String(check.status)) &&
        nonemptyString(check.explanation) &&
        (check.localDiagnostics === null ||
          typeof check.localDiagnostics === "string") &&
        this.#validObservationEvidence(check.evidence, "objective-check")
      );
    });
  }

  #validObservationEvidence(
    value: unknown,
    method: "measurement" | "objective-check",
  ): boolean {
    const evidence = runtimeRecord(value, "m-p.execution.result-invalid");
    const source = runtimeRecord(
      evidence.source,
      "m-p.execution.result-invalid",
    );
    const scope = runtimeRecord(
      evidence.scope,
      "m-p.execution.result-invalid",
    );
    const measurement = runtimeRecord(
      evidence.measurement,
      "m-p.execution.result-invalid",
    );
    const interval =
      measurement.interval === null
        ? null
        : runtimeRecord(
            measurement.interval,
            "m-p.execution.result-invalid",
          );
    const optionalString = (item: unknown): boolean =>
      item === null || typeof item === "string";
    return (
      hasOnlyKeys(evidence, [
        "source",
        "retrievedAt",
        "observedAt",
        "method",
        "hardwareMatch",
        "configurationMatch",
        "scope",
        "sampleCount",
        "measurement",
        "rawSourceRecordRef",
      ]) &&
      hasOnlyKeys(source, ["id", "version", "revision", "url"]) &&
      nonemptyString(source.id) &&
      optionalString(source.version) &&
      optionalString(source.revision) &&
      optionalString(source.url) &&
      optionalString(evidence.retrievedAt) &&
      optionalString(evidence.observedAt) &&
      evidence.method === method &&
      evidence.hardwareMatch === "exact" &&
      evidence.configurationMatch === "exact" &&
      hasOnlyKeys(scope, [
        "taskFamily",
        "taskPackId",
        "promptId",
        "harnessId",
      ]) &&
      optionalString(scope.taskFamily) &&
      optionalString(scope.taskPackId) &&
      optionalString(scope.promptId) &&
      optionalString(scope.harnessId) &&
      (evidence.sampleCount === null ||
        (Number.isSafeInteger(evidence.sampleCount) &&
          Number(evidence.sampleCount) >= 0)) &&
      hasOnlyKeys(measurement, [
        "unit",
        "interval",
        "confidence",
        "eligible",
        "eligibilityReasons",
      ]) &&
      [
        "bytes",
        "tokens-per-second",
        "milliseconds",
        "probability",
        "joules",
        "boolean",
        "count",
        "other",
      ].includes(String(measurement.unit)) &&
      (interval === null ||
        (hasOnlyKeys(interval, ["lower", "upper"]) &&
          typeof interval.lower === "number" &&
          Number.isFinite(interval.lower) &&
          typeof interval.upper === "number" &&
          Number.isFinite(interval.upper) &&
          interval.lower <= interval.upper)) &&
      (measurement.confidence === null ||
        (typeof measurement.confidence === "number" &&
          Number.isFinite(measurement.confidence))) &&
      (measurement.eligible === null ||
        typeof measurement.eligible === "boolean") &&
      stringList(measurement.eligibilityReasons) &&
      optionalString(evidence.rawSourceRecordRef)
    );
  }
}

import {
  type InventoryArtifact,
  type RunnerSurfaceState,
} from "./runner-application";
import { createRunnerApplication } from "./runner-composition";

const application = createRunnerApplication();
let pollTimer: number | undefined;
let renderedStatus: RunnerSurfaceState["status"] | undefined;

function element<T extends HTMLElement>(selector: string): T {
  const value = document.querySelector<T>(selector);
  if (!value) throw new Error(`Missing required runner element: ${selector}`);
  return value;
}

function value(selector: string): string {
  return element<HTMLInputElement | HTMLTextAreaElement>(selector).value;
}

function checked(selector: string): boolean {
  return element<HTMLInputElement>(selector).checked;
}

function setBusy(busy: boolean): void {
  for (const control of document.querySelectorAll<
    HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >("button, input, select, textarea")) {
    control.disabled = busy && control.dataset.allowWhileRunning !== "true";
  }
}

function textList(values: string[]): string {
  return values.length ? values.join("\n") : "None.";
}

function hardwareStateLabel(
  state: NonNullable<RunnerSurfaceState["hardwareEvaluation"]>["state"],
): string {
  switch (state) {
    case "ready":
      return "Ready";
    case "confirmation-required":
      return "Please review one detail";
    case "blocked":
      return "Needs more hardware information";
    case "unavailable":
      return "Hardware check unavailable";
  }
}

function inventoryStatusLabel(
  status: InventoryArtifact["resolution"]["status"],
): string {
  switch (status) {
    case "verified":
      return "Ready to check";
    case "candidateBySize":
      return "Found · one-time file check needed";
    case "ambiguousIdentity":
      return "Needs review";
    case "unavailable":
      return "Not supported";
  }
}

function expertJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function renderHardwareTarget(value: Record<string, unknown> | null): string {
  if (!value) return "Hardware details are unavailable.";
  const os = value.os as Record<string, unknown> | undefined;
  const cpu = value.cpu as Record<string, unknown> | undefined;
  const memory = value.memory as Record<string, unknown> | undefined;
  const accelerators = Array.isArray(value.accelerators)
    ? (value.accelerators as Array<Record<string, unknown>>)
    : [];
  const totalRam = Number(memory?.totalRamBytes);
  const ram = Number.isFinite(totalRam)
    ? `${(totalRam / 2 ** 30).toFixed(1)} GiB RAM`
    : "RAM unavailable";
  const devices = accelerators.length
    ? accelerators
        .map((item) => {
          const bytes = Number(item.deviceMemoryBytes);
          const capacity = Number.isFinite(bytes)
            ? ` · ${(bytes / 2 ** 30).toFixed(1)} GiB`
            : "";
          return `${String(item.displayName ?? "Unknown accelerator")}${capacity} · ${String(item.backend ?? "backend unknown")}`;
        })
        .join("\n")
    : "No accelerator reported";
  return [
    `${String(os?.family ?? "Unknown OS")} · ${String(cpu?.displayName ?? "Unknown CPU")}`,
    ram,
    devices,
  ].join("\n");
}

function renderInventory(state: RunnerSurfaceState): void {
  const select = element<HTMLSelectElement>("#artifact-path");
  select.replaceChildren(new Option("Choose a model found on this PC", ""));
  const artifacts = state.inventory?.result.data.artifacts ?? [];
  for (const artifact of artifacts) {
    const selectable =
      artifact.resolution.status === "verified" ||
      artifact.resolution.status === "candidateBySize";
    const option = new Option(
      `${artifact.label} — ${inventoryStatusLabel(artifact.resolution.status)}`,
      artifact.path,
    );
    option.disabled = !selectable;
    select.add(option);
  }
  element("#inventory-empty").hidden = artifacts.length > 0;
  element("#inventory-results").textContent = artifacts.length
    ? artifacts.map(renderArtifact).join("\n")
    : "No supported models were found in the folders checked.";
  element<HTMLButtonElement>("#select-artifact-button").disabled =
    select.value.length === 0;
  const checkPanel = element<HTMLDetailsElement>("#model-check-panel");
  checkPanel.hidden = !state.selectionHandle;
  if (state.selectionHandle && checkPanel.dataset.revealed !== "true") {
    checkPanel.open = true;
    checkPanel.dataset.revealed = "true";
  }
}

function renderArtifact(artifact: InventoryArtifact): string {
  const size = (artifact.fileSizeBytes / 2 ** 30).toFixed(2);
  return `${artifact.label}\n${size} GiB · ${inventoryStatusLabel(artifact.resolution.status)}`;
}

function render(state: RunnerSurfaceState): void {
  document.body.dataset.stage = state.stage;
  const banner = element("#state-banner");
  banner.dataset.status = state.status;
  banner.textContent = state.message;
  banner.hidden = state.status === "idle";
  banner.setAttribute(
    "aria-live",
    state.status === "blocked" || state.status === "error"
      ? "assertive"
      : "polite",
  );
  if (
    renderedStatus !== state.status &&
    (state.status === "blocked" || state.status === "error")
  ) {
    banner.focus();
  }
  renderedStatus = state.status;
  element("#reason-codes").textContent = textList(state.reasonCodes);
  element("#technical-status").hidden = state.reasonCodes.length === 0;

  for (const section of document.querySelectorAll<HTMLElement>("[data-stage-section]")) {
    const stages = section.dataset.stageSection?.split(" ") ?? [];
    section.hidden = !stages.includes(state.stage);
  }

  const expired = element("#expired-warning");
  expired.hidden = !state.expired;

  if (state.hardwareEvaluation) {
    const evaluation = state.hardwareEvaluation;
    element("#hardware-state").textContent = hardwareStateLabel(evaluation.state);
    element("#hardware-summary").textContent = renderHardwareTarget(
      evaluation.resolvedTarget,
    );
    element("#hardware-differences").textContent = evaluation.differences.length
      ? evaluation.differences
          .map(
            (difference) =>
              `${difference.kind.toUpperCase()} · ${difference.field}\nimported: ${difference.imported ?? "unknown"}\nresolved: ${difference.resolved ?? "unknown"}\n${difference.reasonCode}`,
          )
          .join("\n\n")
      : evaluation.warnings.length
        ? evaluation.warnings.join("\n")
        : "No material differences.";
    const acknowledgementRequired =
      evaluation.state === "confirmation-required";
    element<HTMLInputElement>("#ack-hardware").disabled =
      !acknowledgementRequired;
    element<HTMLInputElement>("#ack-hardware").checked =
      evaluation.state === "ready";
    element<HTMLButtonElement>("#confirm-hardware-button").disabled =
      evaluation.state === "blocked" || evaluation.state === "unavailable";
    element("#hardware-ack-row").hidden = !acknowledgementRequired;
    element("#hardware-review").hidden =
      evaluation.differences.length === 0 && evaluation.warnings.length === 0;
    element("#hardware-ack-label").textContent =
      state.journey === "manual"
        ? "Use the one CUDA graphics card shown above for this check"
        : "I reviewed the hardware difference shown above";
  }
  element("#detect-button").hidden = state.journey === "manual";

  if (state.inventory) renderInventory(state);

  if (state.plan) {
    element("#plan-summary").textContent =
      `Model: ${state.plan.artifact.path}\n` +
      `Speed measurement: ${state.plan.benchmarkTool ? "ready" : "unavailable"}\n` +
      `Compatibility checks: ${state.plan.quickCheckTool ? "ready" : "unavailable"}\n` +
      "The speed measurement runs first, followed by three small checks.";
    element("#plan-expert").textContent = expertJson(state.plan);
  }

  if (state.fitProfileCapture) {
    const capture = state.fitProfileCapture;
    const candidate = capture.candidate;
    const runtime =
      typeof candidate.runtime === "object" && candidate.runtime !== null
        ? (candidate.runtime as Record<string, unknown>)
        : {};
    element("#capture-summary").textContent =
      `Model: ${capture.artifact.path}\n` +
      `Runtime: llama.cpp ${String(runtime.engineBuild ?? "unavailable")}\n` +
      `Graphics: ${String(runtime.backend ?? "unavailable")}\n` +
      `Work sizes: ${capture.contextTokens.join(" and ")} tokens\n` +
      `${capture.repetitionsPerContext} measurements at each work size\n` +
      "This measures memory use only; it does not change or serve the model.";
    element("#capture-expert").textContent = expertJson(capture);
  }

  if (state.fitProfileCaptureReceipt) {
    const receipt = state.fitProfileCaptureReceipt;
    const attemptCount = receipt.contexts.reduce(
      (total, context) => total + context.attempts.length,
      0,
    );
    element("#capture-result-summary").textContent =
      `Memory check completed\n` +
      `Work sizes: ${receipt.contexts.map((item) => item.contextTokens).join(" and ")} tokens\n` +
      `Completed measurements: ${attemptCount}\n` +
      "These results are saved only in this running session.";
    element("#capture-result-expert").textContent = expertJson(receipt);
  }

  if (state.lifecycle) {
    const lifecycle = state.lifecycle;
    element("#progress-label").textContent =
      `${lifecycle.phase} · ${lifecycle.phaseCurrent} of ${lifecycle.phaseTotal}`;
    element<HTMLProgressElement>("#progress").max = Math.max(
      lifecycle.phaseTotal,
      1,
    );
    element<HTMLProgressElement>("#progress").value = lifecycle.phaseCurrent;
    element("#progress-detail").textContent =
      `Elapsed: ${(lifecycle.elapsedMs / 1000).toFixed(1)} s\n` +
      `Retained measurement series: ${lifecycle.retainedSeries}\n` +
      `Retained checks: ${lifecycle.retainedChecks}\n` +
      `State: ${lifecycle.state}\n` +
      `Sequence: ${lifecycle.sequence}`;
  }

  if (state.result) {
    const result = state.result;
    element("#result-heading").textContent =
      result.domainStatus === "completed"
        ? "Model check completed"
        : "Model check ended early";
    element("#result-summary").textContent =
      `Status: ${result.domainStatus}\n` +
      `Speed measurement: ${result.benchmarkResult ? "completed" : "not available"}\n` +
      `Compatibility checks: ${result.quickCheckResult ? "completed" : "not available"}`;
    element("#result-expert").textContent = expertJson(result);
  }

  setBusy(state.status === "loading" && state.stage !== "progress");
}

async function run(operation: () => Promise<RunnerSurfaceState>): Promise<void> {
  const pending = operation();
  render(application.snapshot());
  render(await pending);
}

function startPolling(): void {
  if (pollTimer !== undefined) window.clearTimeout(pollTimer);
  const poll = async (): Promise<void> => {
    const state = await application.refreshExecution();
    render(state);
    if (
      state.stage === "result" ||
      state.stage === "failure" ||
      state.status === "blocked" ||
      state.status === "unavailable" ||
      state.status === "error"
    ) {
      pollTimer = undefined;
      return;
    }
    pollTimer = window.setTimeout(poll, 500);
  };
  pollTimer = window.setTimeout(poll, 500);
}

window.addEventListener("DOMContentLoaded", () => {
  render(application.snapshot());

  element("#manual-start-button").addEventListener("click", () =>
    run(() => application.startManualSetup()),
  );
  element("#import-button").addEventListener("click", () =>
    run(() =>
      application.importBundle(value("#bundle-json"), checked("#confirm-expired")),
    ),
  );
  element("#detect-button").addEventListener("click", () =>
    run(() => application.evaluateHardware()),
  );
  element("#confirm-hardware-button").addEventListener("click", () =>
    run(() => application.confirmHardware(checked("#ack-hardware"))),
  );
  element("#scan-button").addEventListener("click", () =>
    run(() => application.scanInventory([value("#extra-dir")])),
  );
  element("#artifact-path").addEventListener("change", () => {
    element<HTMLButtonElement>("#select-artifact-button").disabled =
      value("#artifact-path").length === 0;
  });
  element("#select-artifact-button").addEventListener("click", () =>
    run(() => application.selectArtifact(value("#artifact-path"))),
  );
  element("#prepare-capture-button").addEventListener("click", () =>
    run(() =>
      application.prepareFitProfileCapture(
        value("#fit-profile-path"),
        `local-capture-${crypto.randomUUID()}`,
        Number(value("#capture-context")),
      ),
    ),
  );
  element("#probe-tools-button").addEventListener("click", () =>
    run(() =>
      application.probeTools(
        value("#benchmark-path"),
        value("#quick-check-path"),
      ),
    ),
  );
  element("#prepare-plan-button").addEventListener("click", () =>
    run(() => application.prepareVerification()),
  );
  element("#execute-capture-button").addEventListener("click", () =>
    run(() => application.executeFitProfileCapture(checked("#consent-capture"))),
  );
  element("#start-button").addEventListener("click", async () => {
    const pending = application.startExecution({
      localProcess: checked("#consent-process"),
      modelLoad: checked("#consent-load"),
      machineBusy: checked("#consent-busy"),
    });
    render(application.snapshot());
    const state = await pending;
    render(state);
    if (state.stage === "progress") startPolling();
  });
  element("#stop-button").addEventListener("click", () =>
    run(() => application.stopExecution()),
  );
  element("#refresh-button").addEventListener("click", () =>
    run(() => application.refreshExecution()),
  );
});

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

function expertJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function renderInventory(state: RunnerSurfaceState): void {
  const select = element<HTMLSelectElement>("#artifact-path");
  select.replaceChildren(new Option("Choose a verified artifact", ""));
  const artifacts = state.inventory?.result.data.artifacts ?? [];
  for (const artifact of artifacts) {
    const selectable =
      artifact.resolution.status === "verified" ||
      artifact.resolution.status === "candidateBySize";
    const option = new Option(
      `${artifact.label} — ${artifact.resolution.status}${
        artifact.resolution.status === "candidateBySize"
          ? " (explicit hash required)"
          : ""
      }`,
      artifact.path,
    );
    option.disabled = !selectable;
    select.add(option);
  }
  element("#inventory-empty").hidden = artifacts.length > 0;
  element("#inventory-results").textContent = artifacts.length
    ? artifacts.map(renderArtifact).join("\n")
    : "No artifacts were returned. No model was substituted.";
}

function renderArtifact(artifact: InventoryArtifact): string {
  const size = (artifact.fileSizeBytes / 2 ** 30).toFixed(2);
  return `${artifact.resolution.status.toUpperCase()} · ${artifact.label} · ${size} GiB\n${artifact.path}`;
}

function render(state: RunnerSurfaceState): void {
  document.body.dataset.stage = state.stage;
  const banner = element("#state-banner");
  banner.dataset.status = state.status;
  banner.textContent = state.message;
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

  for (const section of document.querySelectorAll<HTMLElement>("[data-stage-section]")) {
    const stages = section.dataset.stageSection?.split(" ") ?? [];
    section.hidden = !stages.includes(state.stage);
  }

  const expired = element("#expired-warning");
  expired.hidden = !state.expired;

  if (state.hardwareEvaluation) {
    const evaluation = state.hardwareEvaluation;
    element("#hardware-state").textContent = evaluation.state;
    element("#hardware-differences").textContent = evaluation.differences.length
      ? evaluation.differences
          .map(
            (difference) =>
              `${difference.kind.toUpperCase()} · ${difference.field}\nimported: ${difference.imported ?? "unknown"}\nresolved: ${difference.resolved ?? "unknown"}\n${difference.reasonCode}`,
          )
          .join("\n\n")
      : "No material differences.";
    element<HTMLInputElement>("#ack-hardware").disabled =
      evaluation.state !== "confirmation-required";
    element<HTMLInputElement>("#ack-hardware").checked =
      evaluation.state === "ready";
  }

  if (state.inventory) renderInventory(state);

  if (state.plan) {
    element("#plan-summary").textContent =
      `Artifact: ${state.plan.artifact.path}\n` +
      `SHA-256: ${state.plan.artifact.sha256}\n` +
      `Benchmark tool: ${state.plan.benchmarkTool?.path ?? "unavailable"}\n` +
      `Quick-check tool: ${state.plan.quickCheckTool?.path ?? "unavailable"}\n` +
      "Order: benchmark first, then three fixed mechanical checks.";
    element("#plan-expert").textContent = expertJson(state.plan);
  }

  if (state.fitProfileCapture) {
    const capture = state.fitProfileCapture;
    element("#capture-summary").textContent =
      `Capture: ${capture.captureId}\n` +
      `Artifact: ${capture.artifact.path}\n` +
      `Artifact SHA-256: ${capture.artifact.sha256}\n` +
      `Tool: ${capture.tool.path}\n` +
      `Tool SHA-256: ${capture.tool.sha256}\n` +
      `Contexts: ${capture.contextTokens.join(", ")} tokens\n` +
      `Repetitions: ${capture.repetitionsPerContext} per context\n` +
      "Result: proposed-unreviewed exact-scope evidence only.";
    element("#capture-expert").textContent = expertJson(capture);
  }

  if (state.fitProfileCaptureReceipt) {
    const receipt = state.fitProfileCaptureReceipt;
    const attemptCount = receipt.contexts.reduce(
      (total, context) => total + context.attempts.length,
      0,
    );
    element("#capture-result-summary").textContent =
      `Capture: ${receipt.captureId}\n` +
      `Content SHA-256: ${receipt.contentHash}\n` +
      `Contexts: ${receipt.contexts.map((item) => item.contextTokens).join(", ")} tokens\n` +
      `Completed attempts: ${attemptCount}\n` +
      "Status: proposed-unreviewed evidence. It cannot recommend or serve a model.";
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
        ? "Verification result"
        : "Verification ended with retained evidence";
    element("#result-summary").textContent =
      `Status: ${result.domainStatus}\n` +
      `Candidate: ${result.candidateId}\n` +
      `Benchmark: ${result.benchmarkResult ? "present" : "not available"}\n` +
      `Mechanical checks: ${result.quickCheckResult ? "present" : "not available"}`;
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
  element("#select-artifact-button").addEventListener("click", () =>
    run(() => application.selectArtifact(value("#artifact-path"))),
  );
  element("#prepare-capture-button").addEventListener("click", () =>
    run(() =>
      application.prepareFitProfileCapture(
        value("#fit-profile-path"),
        value("#capture-id"),
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

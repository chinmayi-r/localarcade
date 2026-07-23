// Preserved R1–R4 surface. Its raw execution commands are intentionally no
// longer registered; M-P uses runner-application.ts through the new main.ts.
import { invoke } from "@tauri-apps/api/core";

type RunnerIdentity = {
  name: string;
  version: string;
  milestone: string;
  capabilities: string[];
};

type GpuReconciliation =
  | {
      status: "known";
      detectedName: string;
      detectedMemoryGb: number;
      acceleratorId: string;
      family: string;
      kind: string;
      memoryMatchesVendorVariant: boolean;
      vendorVariantsGb: number[];
      provenance: string;
    }
  | {
      status: "unknown";
      detectedName: string;
      detectedMemoryGb: number;
      reason: string;
      provenance: string;
    };

type HardwareReport = {
  os: string;
  arch: string;
  cpuName: string;
  totalMemoryGb: number;
  gpus: GpuReconciliation[];
  gpuDetectionUnavailableReason: string | null;
  provenance: string;
};

function el(id: string): HTMLElement | null {
  return document.querySelector(id);
}

function renderGpu(gpu: GpuReconciliation): string {
  if (gpu.status === "unknown") {
    return `${gpu.detectedName} — ${gpu.detectedMemoryGb} GB detected. Not in the vendor registry: ${gpu.reason}`;
  }
  const memory = gpu.memoryMatchesVendorVariant
    ? `${gpu.detectedMemoryGb} GB (matches a vendor variant: ${gpu.vendorVariantsGb.join("/")} GB)`
    : `${gpu.detectedMemoryGb} GB detected — does NOT match vendor variants (${gpu.vendorVariantsGb.join("/")} GB); please confirm manually`;
  return `${gpu.detectedName} — ${memory} · registry: ${gpu.acceleratorId}`;
}

type RegistryMatch =
  | { status: "verified"; artifactId: string }
  | { status: "candidateBySize"; artifactIds: string[] }
  | { status: "none" };

type FoundArtifact = {
  path: string;
  store: string;
  label: string;
  fileSizeBytes: number;
  sha256: string | null;
  registryMatch: RegistryMatch;
};

type ScanReport = {
  stores: { kind: string; path: string; exists: boolean; truncated: boolean }[];
  artifacts: FoundArtifact[];
  duplicateGroups: string[][];
  unreadable: { path: string; reason: string }[];
  provenance: string;
};

type PreflightReport = {
  cpuLoadPercent: number;
  availableMemoryGb: number;
  availableMemoryPercent: number;
  acPower: boolean | null;
  thermalCelsius: number | null;
  thermalUnavailableReason: string | null;
  warnings: string[];
  requiresConfirmation: boolean;
  provenance: string;
};

function renderPreflight(report: PreflightReport): string[] {
  const power = report.acPower === null ? "unknown" : report.acPower ? "AC power" : "battery";
  const thermal = report.thermalCelsius === null
    ? `unknown (${report.thermalUnavailableReason ?? "sensor unavailable"})`
    : `${report.thermalCelsius.toFixed(1)} °C`;
  return [
    `Preflight (${report.provenance}): CPU ${report.cpuLoadPercent.toFixed(1)}% · available RAM ${report.availableMemoryGb.toFixed(1)} GB (${report.availableMemoryPercent.toFixed(1)}%) · power ${power} · thermal ${thermal}`,
    ...report.warnings.map((warning) => `Condition: ${warning}`),
  ];
}

function gb(bytes: number): string {
  return (bytes / 2 ** 30).toFixed(1) + " GB";
}

function renderMatch(match: RegistryMatch): string {
  if (match.status === "verified") return `identity verified: ${match.artifactId}`;
  if (match.status === "candidateBySize") return `size matches ${match.artifactIds.length} registry artifact(s) — identity unverified until hashed`;
  return "not in the artifact registry";
}

window.addEventListener("DOMContentLoaded", async () => {
  const identityEl = el("#identity");
  if (identityEl) {
    const id = await invoke<RunnerIdentity>("runner_identity");
    identityEl.textContent = `${id.name} v${id.version} — milestone ${id.milestone}. Capabilities: ${
      id.capabilities.length ? id.capabilities.join(", ") : "none"
    }. Every capability runs only after its labeled action. No downloads, uploads, listening sockets, updater, or external network calls.`;
  }

  el("#detect-button")?.addEventListener("click", async () => {
    const output = el("#detection-output");
    if (!output) return;
    output.textContent = "Reading OS hardware APIs…";
    const report = await invoke<HardwareReport>("detect_hardware");
    const lines = [
      `Everything below was detected on this machine just now and stays on this machine.`,
      `OS: ${report.os} (${report.arch})`,
      `CPU: ${report.cpuName}`,
      `RAM: ${report.totalMemoryGb} GB`,
    ];
    if (report.gpuDetectionUnavailableReason) {
      lines.push(`GPU: ${report.gpuDetectionUnavailableReason}`);
    } else if (!report.gpus.length) {
      lines.push("GPU: no dedicated adapters detected.");
    } else {
      for (const gpu of report.gpus) lines.push(`GPU: ${renderGpu(gpu)}`);
    }
    output.textContent = lines.join("\n");
  });

  el("#scan-button")?.addEventListener("click", async () => {
    const output = el("#scan-output");
    if (!output) return;
    const extraDir = (document.querySelector("#extra-dir") as HTMLInputElement | null)?.value ?? "";
    output.textContent = "Reading store directories…";
    const report = await invoke<ScanReport>("scan_model_stores", {
      extraDirectories: extraDir ? [extraDir] : [],
    });
    const lines = ["Everything below was read locally just now and stays on this machine."];
    for (const store of report.stores) {
      lines.push(`Store ${store.kind}: ${store.path} — ${store.exists ? "scanned" : "not present"}${store.truncated ? " (TRUNCATED at listing cap)" : ""}`);
    }
    if (!report.artifacts.length) {
      lines.push(
        "No model artifacts found. That's normal on a machine without local models yet — the Local Arcade website can recommend a first configuration for this hardware; guided setup arrives in a later runner milestone.",
      );
    }
    for (const artifact of report.artifacts) {
      lines.push(`• [${artifact.store}] ${artifact.label} — ${gb(artifact.fileSizeBytes)} — ${renderMatch(artifact.registryMatch)}`);
    }
    if (report.duplicateGroups.length) {
      lines.push(`Possible duplicates (${report.duplicateGroups.length} group(s)):`);
      for (const group of report.duplicateGroups) lines.push("  = " + group.join("  |  "));
    }
    if (report.unreadable.length) {
      lines.push("Unreadable entries (listed, never silently skipped):");
      for (const entry of report.unreadable) lines.push(`  ! ${entry.path} — ${entry.reason}`);
    }
    output.textContent = lines.join("\n");
  });

  el("#bench-button")?.addEventListener("click", async () => {
    const output = el("#bench-output");
    if (!output) return;
    const engineDir = (document.querySelector("#bench-engine-dir") as HTMLInputElement | null)?.value ?? "";
    const modelPath = (document.querySelector("#bench-model-path") as HTMLInputElement | null)?.value ?? "";
    if (!engineDir || !modelPath) {
      output.textContent = "Both the engine folder and the model path are required.";
      return;
    }
    try {
      output.textContent = "Sampling system conditions…";
      const preflight = await invoke<PreflightReport>("benchmark_preflight");
      const accepted = (document.querySelector("#bench-confirm-conditions") as HTMLInputElement | null)?.checked ?? false;
      if (preflight.requiresConfirmation && !accepted) {
        output.textContent = [...renderPreflight(preflight), "Review these conditions, then check the confirmation box to run anyway."].join("\n");
        return;
      }
      output.textContent = [...renderPreflight(preflight), "Running llama-bench — the model is loading and your machine will be busy…"].join("\n");
      const report = await invoke<{
        engine: string;
        engineBuild: string;
        backends: string;
        gpuInfo: string;
        modelType: string;
        kvCache: string;
        gpuLayers: number;
        batchSize: number;
        ubatchSize: number;
        threads: number;
        flashAttention: number;
        mmap: boolean;
        measurements: { kind: string; tokens: number; tokensPerSecond: number; repeatability: string; relativeRange: number | null; qualityReason: string }[];
        measurementQuality: string;
        qualityReasons: string[];
        preflight: PreflightReport;
        calibrationEligibility: { eligible: boolean; reasons: string[] };
        provenance: string;
      }>("run_benchmark", { request: { engineDir, modelPath, acceptAdverseConditions: accepted } });
      const lines = [
        ...renderPreflight(report.preflight),
        report.provenance === "verified-local"
          ? "Measured repeatedly on this machine (verified-local) — all metrics were stable."
          : "Measured on this machine (conditioned-local) — preserve this observation, but do not use it as a verified baseline.",
        `Engine: ${report.engine} ${report.engineBuild} · ${report.backends} · ${report.gpuInfo}`,
        `Model: ${report.modelType} · KV ${report.kvCache} · GPU layers ${report.gpuLayers}`,
        `Benchmark config: batch ${report.batchSize} · ubatch ${report.ubatchSize} · threads ${report.threads} · flash-attn ${report.flashAttention} · mmap ${report.mmap}`,
      ];
      for (const measurement of report.measurements) {
        const spread = measurement.relativeRange === null ? "" : ` · range/median ${(measurement.relativeRange * 100).toFixed(1)}%`;
        lines.push(`${measurement.kind}: ${measurement.tokensPerSecond.toFixed(1)} tokens/s (${measurement.tokens} tokens) · ${measurement.repeatability}${spread}`);
      }
      for (const reason of report.qualityReasons) lines.push(`Condition: ${reason}`);
      if (report.calibrationEligibility.eligible) {
        lines.push("Calibration baseline: eligible for machine-adjusted estimates.");
      } else {
        lines.push("Calibration baseline: INELIGIBLE. This remains an exact local observation only.");
        for (const reason of report.calibrationEligibility.reasons) lines.push(`Baseline reason: ${reason}`);
      }
      output.textContent = lines.join("\n");
    } catch (error) {
      output.textContent = `Benchmark did not complete: ${String(error)}`;
    }
  });

  el("#quick-task-button")?.addEventListener("click", async () => {
    const output = el("#bench-output");
    if (!output) return;
    const engineDir = (document.querySelector("#bench-engine-dir") as HTMLInputElement | null)?.value ?? "";
    const modelPath = (document.querySelector("#bench-model-path") as HTMLInputElement | null)?.value ?? "";
    if (!engineDir || !modelPath) {
      output.textContent = "Both the engine folder and the model path are required.";
      return;
    }
    try {
      output.textContent = "Sampling system conditions…";
      const preflight = await invoke<PreflightReport>("benchmark_preflight");
      const accepted = (document.querySelector("#bench-confirm-conditions") as HTMLInputElement | null)?.checked ?? false;
      if (preflight.requiresConfirmation && !accepted) {
        output.textContent = [...renderPreflight(preflight), "Review these conditions, then check the confirmation box to run anyway."].join("\n");
        return;
      }
      output.textContent = [...renderPreflight(preflight), "Running three fixed tasks sequentially through llama-cli…"].join("\n");
      const report = await invoke<{
        engine: string;
        engineBuild: string;
        modelPath: string;
        settings: string;
        results: { id: string; label: string; passed: boolean; explanation: string; output: string }[];
        preflight: PreflightReport;
        claim: string;
      }>("run_quick_tasks", { request: { engineDir, modelPath, acceptAdverseConditions: accepted } });
      const lines = [
        ...renderPreflight(report.preflight),
        `Mechanical checks only (${report.claim}) — not a general model-quality score.`,
        `Engine: ${report.engine} ${report.engineBuild}`,
        `Model: ${report.modelPath}`,
        `Settings: ${report.settings}`,
      ];
      for (const result of report.results) {
        lines.push(`${result.passed ? "PASS" : "MISS"} · ${result.label}: ${result.explanation}`);
        lines.push(`  Output: ${result.output}`);
      }
      output.textContent = lines.join("\n");
    } catch (error) {
      output.textContent = `Quick tasks did not complete: ${String(error)}`;
    }
  });
});

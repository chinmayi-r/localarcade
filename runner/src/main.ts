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

window.addEventListener("DOMContentLoaded", async () => {
  const identityEl = el("#identity");
  if (identityEl) {
    const id = await invoke<RunnerIdentity>("runner_identity");
    identityEl.textContent = `${id.name} v${id.version} — milestone ${id.milestone}. Capabilities: ${
      id.capabilities.length ? id.capabilities.join(", ") : "none"
    }. No scanning, no downloads, no execution, no network calls.`;
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
});

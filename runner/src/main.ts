import { invoke } from "@tauri-apps/api/core";

type RunnerIdentity = {
  name: string;
  version: string;
  milestone: string;
  capabilities: string[];
};

window.addEventListener("DOMContentLoaded", async () => {
  const target = document.querySelector("#identity");
  if (!target) return;
  const id = await invoke<RunnerIdentity>("runner_identity");
  target.textContent = `${id.name} v${id.version} — milestone ${id.milestone}. ` +
    (id.capabilities.length
      ? `Capabilities: ${id.capabilities.join(", ")}.`
      : "This build detects nothing, scans nothing, downloads nothing, and makes no network calls.");
});

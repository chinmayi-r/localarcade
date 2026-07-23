import { createHash } from "node:crypto";
import type { RunnerHandoff, RunnerImportBundle } from "./types";

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

export function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function handoffContentHash(handoff: RunnerHandoff): string {
  const snapshot = Object.fromEntries(Object.entries(handoff).filter(([key]) => key !== "contentHash"));
  return sha256Canonical(snapshot);
}

export function withHandoffContentHash(handoff: Omit<RunnerHandoff, "contentHash">): RunnerHandoff {
  return { ...handoff, contentHash: sha256Canonical(handoff) };
}

export function runnerImportBundleContentHash(bundle: RunnerImportBundle): string {
  const snapshot = Object.fromEntries(Object.entries(bundle).filter(([key]) => key !== "contentHash"));
  return sha256Canonical(snapshot);
}

export function withRunnerImportBundleContentHash(
  bundle: Omit<RunnerImportBundle, "contentHash">,
): RunnerImportBundle {
  return { ...bundle, contentHash: sha256Canonical(bundle) };
}

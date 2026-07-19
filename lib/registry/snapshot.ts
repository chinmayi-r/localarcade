import { createHash } from "node:crypto";
import type { ArtifactRegistryRecord, QuarantineRecord, RegistrySnapshot } from "./types";
import { validateRegistrySnapshot } from "./validation";

export function buildRegistrySnapshot(generatedAt: string, artifacts: ArtifactRegistryRecord[], quarantine: QuarantineRecord[]): RegistrySnapshot {
  const orderedArtifacts = [...artifacts].sort((a, b) => a.id.localeCompare(b.id));
  const orderedQuarantine = [...quarantine].sort((a, b) => `${a.repository}/${a.fileName ?? ""}/${a.code}`.localeCompare(`${b.repository}/${b.fileName ?? ""}/${b.code}`));
  const content = { generatedAt, artifacts: orderedArtifacts, quarantine: orderedQuarantine, accelerators: [], compatibilityAssertions: [] };
  const snapshotId = `hugging-face-${createHash("sha256").update(JSON.stringify(content)).digest("hex").slice(0, 16)}`;
  const snapshot: RegistrySnapshot = { schemaVersion: 3, snapshotId, ...content };
  const issues = validateRegistrySnapshot(snapshot);
  if (issues.length) throw new TypeError(issues.join(" "));
  return snapshot;
}

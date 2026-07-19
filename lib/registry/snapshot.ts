import { createHash } from "node:crypto";
import type { ArtifactRegistryRecord, QuarantineRecord, RegistrySnapshot } from "./types";
import { validateRegistrySnapshot } from "./validation";

export function buildRegistrySnapshot(generatedAt: string, lastIngestSucceededAt: string, artifacts: ArtifactRegistryRecord[], quarantine: QuarantineRecord[]): RegistrySnapshot {
  const orderedArtifacts = [...artifacts].sort((a, b) => a.id.localeCompare(b.id));
  const orderedQuarantine = [...quarantine].sort((a, b) => `${a.repository}/${a.fileName ?? ""}/${a.code}`.localeCompare(`${b.repository}/${b.fileName ?? ""}/${b.code}`));
  const content = { generatedAt, lastIngestSucceededAt, artifacts: orderedArtifacts, quarantine: orderedQuarantine, accelerators: [], compatibilityAssertions: [] };
  const identityArtifacts = orderedArtifacts.map((artifact) => Object.fromEntries(Object.entries(artifact).filter(([key]) => key !== "status")));
  const identityContent = { ...content, artifacts: identityArtifacts };
  const snapshotId = `hugging-face-${createHash("sha256").update(JSON.stringify(identityContent)).digest("hex").slice(0, 16)}`;
  const snapshot: RegistrySnapshot = { schemaVersion: 4, snapshotId, ...content };
  const issues = validateRegistrySnapshot(snapshot);
  if (issues.length) throw new TypeError(issues.join(" "));
  return snapshot;
}

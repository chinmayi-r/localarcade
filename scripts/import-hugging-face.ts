import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { artifactFromHuggingFace, type HuggingFaceArtifactSource, type HuggingFaceModelResponse } from "../lib/registry/importers/hugging-face";
import { validateRegistrySnapshot } from "../lib/registry/validation";
import type { RegistrySnapshot } from "../lib/registry/types";

const sourcePath = new URL("../registry/sources/hugging-face.json", import.meta.url);
const outputPath = new URL("../registry/generated/hugging-face.json", import.meta.url);
const sources = JSON.parse(await readFile(sourcePath, "utf8")) as HuggingFaceArtifactSource[];
const retrievedAt = new Date().toISOString();

const artifacts = [];
for (const source of sources) {
  const endpoint = `https://huggingface.co/api/models/${source.repoId}/revision/${source.revision}?blobs=true`;
  const response = await fetch(endpoint, { headers: { "User-Agent": "LocalArcade/0.1 registry importer" } });
  if (!response.ok) throw new Error(`Hugging Face returned ${response.status} for ${source.repoId}.`);
  artifacts.push(artifactFromHuggingFace(source, await response.json() as HuggingFaceModelResponse, retrievedAt));
}

const digest = createHash("sha256").update(sources.map((source) => `${source.repoId}@${source.revision}:${source.fileName}`).join("\n")).digest("hex").slice(0, 16);
const snapshot: RegistrySnapshot = {
  schemaVersion: 2,
  snapshotId: `hugging-face-${digest}`,
  generatedAt: retrievedAt,
  artifacts,
  accelerators: [],
  compatibilityAssertions: [],
};

const issues = validateRegistrySnapshot(snapshot);
if (issues.length) throw new TypeError(issues.join(" "));
await mkdir(new URL("../registry/generated/", import.meta.url), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`Imported ${artifacts.length} pinned Hugging Face artifact(s).`);

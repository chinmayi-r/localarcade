import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { admitHuggingFaceRepository } from "../lib/registry/importers/hugging-face";
import type { HuggingFaceModelResponse } from "../lib/registry/importers/hugging-face";
import { buildRegistrySnapshot } from "../lib/registry/snapshot";
import type { HuggingFaceDiscoveryLock, HuggingFaceDiscoveryPolicy } from "../lib/registry/discovery/hugging-face";
import type { ArtifactRegistryRecord, RegistrySnapshot } from "../lib/registry";

const policyPath = new URL("../registry/policy/hugging-face.json", import.meta.url);
const lockPath = new URL("../registry/locks/hugging-face.json", import.meta.url);
const outputPath = new URL("../registry/generated/artifacts.json", import.meta.url);
const policyText = await readFile(policyPath, "utf8");
const policy = JSON.parse(policyText) as HuggingFaceDiscoveryPolicy;
const lock = JSON.parse(await readFile(lockPath, "utf8")) as HuggingFaceDiscoveryLock;
const policySha256 = createHash("sha256").update(policyText).digest("hex");
const previous = await readPreviousSnapshot(outputPath);
if (lock.schemaVersion !== 1 || lock.policySha256 !== policySha256) throw new Error("Discovery lock does not match the current policy; run npm run discover first.");
if (!lock.repositories.length) throw new Error("Discovery lock is empty; the previous snapshot was preserved.");

const artifacts = [];
const quarantine = [];
for (const repository of lock.repositories) {
  const endpoint = `https://huggingface.co/api/models/${repository.repoId}/revision/${repository.revision}?blobs=true`;
  const response = await fetchJsonWithRetry<HuggingFaceModelResponse>(endpoint);
  const admitted = admitHuggingFaceRepository(repository, response, lock.discoveredAt);
  const allowed = repository.allowedFiles ? new Set(repository.allowedFiles) : undefined;
  artifacts.push(...admitted.artifacts.filter((artifact) => !allowed || allowed.has(artifact.fileName)));
  quarantine.push(...admitted.quarantine.filter((record) => !allowed || (record.fileName !== undefined && allowed.has(record.fileName))));
}

const families = new Set(artifacts.map((artifact) => artifact.family));
if (artifacts.length < policy.minimumArtifacts) throw new Error(`Admission produced ${artifacts.length} artifacts; policy requires ${policy.minimumArtifacts}. Previous snapshot preserved.`);
if (families.size < policy.minimumFamilies) throw new Error(`Admission produced ${families.size} families; policy requires ${policy.minimumFamilies}. Previous snapshot preserved.`);
const previousById = new Map(previous?.artifacts.map((artifact) => [artifact.id, artifact]));
const reconciled: ArtifactRegistryRecord[] = artifacts.map((artifact) => ({ ...artifact, status: previousById.get(artifact.id)?.status ?? "triage" }));
const admittedIds = new Set(reconciled.map((artifact) => artifact.id));
for (const artifact of previous?.artifacts ?? []) if (!admittedIds.has(artifact.id)) reconciled.push(artifact);
const snapshot = buildRegistrySnapshot(lock.discoveredAt, new Date().toISOString(), reconciled, quarantine);
await writeAtomically(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Admitted ${snapshot.artifacts.length} artifacts across ${families.size} families; quarantined ${snapshot.quarantine.length} records.`);

async function fetchJsonWithRetry<T>(url: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "LocalArcade/0.1 ingestion" } });
      if (response.ok) return await response.json() as T;
      if (response.status < 500 && response.status !== 429) throw new Error(`Hugging Face returned ${response.status} for ${url}.`);
      lastError = new Error(`Hugging Face returned ${response.status} for ${url}.`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }
  throw lastError instanceof Error ? lastError : new Error(`Unable to fetch ${url}.`);
}

async function readPreviousSnapshot(path: URL) {
  try {
    return JSON.parse(await readFile(path, "utf8")) as RegistrySnapshot;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function writeAtomically(path: URL, contents: string) {
  await mkdir(new URL("./", path), { recursive: true });
  const temporary = new URL(`${path.pathname}.tmp-${process.pid}`, path);
  await writeFile(temporary, contents, "utf8");
  await rename(temporary, path);
}

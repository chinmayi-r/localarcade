import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { selectDiscoveredRepositories, selectRequiredArtifactRepository } from "../lib/registry/discovery/hugging-face";
import type { HuggingFaceDiscoveryLock, HuggingFaceDiscoveryPolicy, HuggingFaceListModel } from "../lib/registry/discovery/hugging-face";

const policyPath = new URL("../registry/policy/hugging-face.json", import.meta.url);
const lockPath = new URL("../registry/locks/hugging-face.json", import.meta.url);
const policyText = await readFile(policyPath, "utf8");
const policy = JSON.parse(policyText) as HuggingFaceDiscoveryPolicy;
validatePolicy(policy);

const repositories = [];
for (const publisher of policy.publishers) {
  const query = new URLSearchParams({
    author: publisher.id,
    filter: policy.requiredTag,
    pipeline_tag: policy.pipelineTag,
    sort: "downloads",
    direction: "-1",
    limit: String(Math.max(publisher.maxRepositories * 4, 40)),
    full: "true",
  });
  const models = await fetchJson<HuggingFaceListModel[]>(`https://huggingface.co/api/models?${query}`);
  repositories.push(...selectDiscoveredRepositories(publisher, policy, models));
}

for (const required of policy.requiredArtifacts ?? []) {
  const publisherId = required.repoId.split("/")[0];
  const publisher = policy.publishers.find((item) => item.id === publisherId);
  if (!publisher) throw new Error(`Required artifact publisher is not trusted: ${required.repoId}`);
  const model = await fetchJson<HuggingFaceListModel>(`https://huggingface.co/api/models/${required.repoId}`);
  repositories.push(selectRequiredArtifactRepository(publisher, policy, model, required.fileName));
}

const uniqueRepositories = [...new Map(repositories.map((repository) => [repository.repoId, repository])).values()]
  .sort((a, b) => a.repoId.localeCompare(b.repoId));
if (!uniqueRepositories.length) throw new Error("Discovery returned no eligible repositories; the previous lock was preserved.");

const lock: HuggingFaceDiscoveryLock = {
  schemaVersion: 1,
  discoveredAt: new Date().toISOString(),
  policySha256: createHash("sha256").update(policyText).digest("hex"),
  repositories: uniqueRepositories,
};
await writeAtomically(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
console.log(`Discovered and pinned ${lock.repositories.length} Hugging Face repositories.`);

function validatePolicy(value: HuggingFaceDiscoveryPolicy) {
  if (value.schemaVersion !== 1 || !value.publishers.length) throw new TypeError("Unsupported or empty Hugging Face discovery policy.");
  if (new Set(value.publishers.map((publisher) => publisher.id)).size !== value.publishers.length) throw new TypeError("Publisher ids must be unique.");
  if (value.minimumArtifacts < 40 || value.minimumFamilies < 8) throw new TypeError("M1 policy floors cannot be weakened below 40 artifacts and 8 families.");
  const required = value.requiredArtifacts ?? [];
  if (new Set(required.map((item) => `${item.repoId}/${item.fileName}`)).size !== required.length) throw new TypeError("Required artifacts must be unique.");
  for (const item of required) {
    if (!/^[^/]+\/[^/]+$/.test(item.repoId) || !item.fileName.endsWith(".gguf")) throw new TypeError(`Invalid required artifact: ${item.repoId}/${item.fileName}`);
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { "User-Agent": "LocalArcade/0.1 discovery" } });
  if (!response.ok) throw new Error(`Hugging Face returned ${response.status} for ${url}.`);
  return await response.json() as T;
}

async function writeAtomically(path: URL, contents: string) {
  await mkdir(new URL("./", path), { recursive: true });
  const temporary = new URL(`${path.pathname}.tmp-${process.pid}`, path);
  await writeFile(temporary, contents, "utf8");
  await rename(temporary, path);
}

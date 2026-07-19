import type { ArtifactRegistryRecord } from "../types";
import { validateArtifactRegistryRecord } from "../validation";

export type HuggingFaceArtifactSource = {
  repoId: string;
  revision: string;
  fileName: string;
  family: string;
  model: string;
  quantization: string;
};

type HuggingFaceSibling = {
  rfilename: string;
  size?: number;
  lfs?: { sha256?: string; size?: number };
};

export type HuggingFaceModelResponse = {
  id: string;
  sha: string;
  cardData?: { license?: string };
  gguf?: { context_length?: number };
  siblings?: HuggingFaceSibling[];
};

export function artifactFromHuggingFace(
  source: HuggingFaceArtifactSource,
  response: HuggingFaceModelResponse,
  retrievedAt: string,
): ArtifactRegistryRecord {
  if (response.id !== source.repoId) throw new TypeError(`Expected ${source.repoId}, received ${response.id}.`);
  if (response.sha !== source.revision) throw new TypeError(`Expected pinned revision ${source.revision}, received ${response.sha}.`);

  const file = response.siblings?.find((candidate) => candidate.rfilename === source.fileName);
  if (!file) throw new TypeError(`Pinned artifact does not exist: ${source.fileName}.`);
  if (!file.lfs?.sha256) throw new TypeError(`Pinned artifact lacks an LFS SHA-256: ${source.fileName}.`);
  const fileSizeBytes = file.lfs.size ?? file.size;
  if (!fileSizeBytes) throw new TypeError(`Pinned artifact lacks a byte size: ${source.fileName}.`);
  if (!response.gguf?.context_length) throw new TypeError(`Repository lacks parsed GGUF context metadata.`);
  if (!response.cardData?.license) throw new TypeError(`Repository model card lacks a license id.`);
  if (!response.siblings?.some((candidate) => candidate.rfilename === "LICENSE")) {
    throw new TypeError(`Pinned revision does not contain a LICENSE file.`);
  }

  const [publisher, repository] = source.repoId.split("/");
  if (!publisher || !repository) throw new TypeError(`Repository id must contain publisher/repository.`);
  const revisionRoot = `https://huggingface.co/${source.repoId}`;
  const record: ArtifactRegistryRecord = {
    id: `${source.repoId}/${source.fileName}@${source.revision}`,
    publisher,
    repository,
    revision: source.revision,
    fileName: source.fileName,
    sha256: file.lfs.sha256,
    family: source.family,
    model: source.model,
    format: "GGUF",
    quantization: source.quantization,
    fileSizeBytes,
    maxContextTokens: response.gguf.context_length,
    license: {
      id: response.cardData.license,
      sourceUrl: `${revisionRoot}/blob/${source.revision}/LICENSE`,
    },
    source: {
      url: `${revisionRoot}/tree/${source.revision}`,
      retrievedAt,
    },
  };

  const issues = validateArtifactRegistryRecord(record);
  if (issues.length) throw new TypeError(issues.join(" "));
  return record;
}

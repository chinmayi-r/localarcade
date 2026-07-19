import { createHash } from "node:crypto";
import type { DiscoveredRepository } from "../discovery/hugging-face";
import type { ArtifactRegistryRecord, FieldProvenance, QuarantineCode, QuarantineRecord } from "../types";
import { validateArtifactRegistryRecord } from "../validation";

type HuggingFaceSibling = {
  rfilename: string;
  size?: number;
  lfs?: { sha256?: string; size?: number };
};

export type HuggingFaceModelResponse = {
  id: string;
  sha: string;
  tags?: string[];
  cardData?: { license?: string; base_model?: string | string[] };
  gguf?: { context_length?: number; chat_template?: string };
  siblings?: HuggingFaceSibling[];
};

export type AdmissionResult = {
  artifacts: ArtifactRegistryRecord[];
  quarantine: QuarantineRecord[];
};

const SPLIT_GGUF = /-\d{5}-of-\d{5}\.gguf$/i;
const QUANTIZATION = /(?:^|[-._])((?:IQ\d(?:_[A-Z0-9]+)+)|(?:Q\d(?:_[A-Z0-9]+)+)|BF16|F16|F32|MXFP4)(?:\.gguf)$/i;

export function admitHuggingFaceRepository(source: DiscoveredRepository, response: HuggingFaceModelResponse, retrievedAt: string): AdmissionResult {
  if (response.id !== source.repoId) throw new TypeError(`Expected ${source.repoId}, received ${response.id}.`);
  if (response.sha !== source.revision) throw new TypeError(`Expected pinned revision ${source.revision}, received ${response.sha}.`);
  const sourceUrl = apiUrl(source.repoId, source.revision);
  const siblings = response.siblings ?? [];
  const ggufFiles = siblings.filter((file) => file.rfilename.toLowerCase().endsWith(".gguf"));
  if (!ggufFiles.length) return { artifacts: [], quarantine: [quarantine(source, retrievedAt, "no-gguf-files", "Pinned repository contains no GGUF files.", sourceUrl)] };

  const baseModel = source.baseModelHint ?? baseModelFromResponse(response);
  const licenseId = response.cardData?.license;
  const licenseFile = siblings.find((file) => /^license(?:\.(?:md|txt))?$/i.test(file.rfilename));
  const readme = siblings.find((file) => file.rfilename.toLowerCase() === "readme.md");
  const licenseSourceUrl = licenseFile
    ? blobUrl(source.repoId, source.revision, licenseFile.rfilename)
    : readme && licenseId ? blobUrl(source.repoId, source.revision, readme.rfilename) : undefined;
  const contextLength = response.gguf?.context_length;
  const chatTemplate = response.gguf?.chat_template;
  const artifacts: ArtifactRegistryRecord[] = [];
  const quarantined: QuarantineRecord[] = [];

  for (const file of ggufFiles) {
    const fileUrl = blobUrl(source.repoId, source.revision, file.rfilename);
    const reject = (code: QuarantineCode, reason: string) => quarantined.push(quarantine(source, retrievedAt, code, reason, fileUrl, file.rfilename));
    if (SPLIT_GGUF.test(file.rfilename)) { reject("split-package-unsupported", "Split GGUF packages require package-level identity and are deferred from M1 admission."); continue; }
    if (/mmproj|projector/i.test(file.rfilename)) { reject("unsupported-file-role", "Projection/helper GGUF is not a standalone model artifact."); continue; }
    const quantization = quantizationFromFilename(file.rfilename);
    if (!quantization) { reject("unrecognized-quantization", "Quantization could not be derived by the strict filename rule."); continue; }
    if (!file.lfs?.sha256) { reject("missing-sha256", "Hugging Face LFS metadata does not provide SHA-256."); continue; }
    const fileSizeBytes = file.lfs.size ?? file.size;
    if (!fileSizeBytes) { reject("missing-file-size", "Hugging Face file metadata does not provide byte size."); continue; }
    if (!baseModel) { reject("missing-base-model", "No base-model relation is present in Hub tags or card metadata."); continue; }
    if (!licenseId) { reject("missing-license", "Model card metadata does not provide a license id."); continue; }
    if (!licenseSourceUrl) { reject("missing-license-source", "Pinned revision provides neither a license file nor a model card carrying the license metadata."); continue; }
    if (!contextLength) { reject("missing-context", "Parsed GGUF metadata does not provide context length."); continue; }
    if (!chatTemplate) { reject("missing-chat-template", "Parsed GGUF metadata does not provide a chat template."); continue; }

    const [publisher, repository] = source.repoId.split("/");
    const apiProvenance = provenance(sourceUrl, retrievedAt, "hub-api");
    const record: ArtifactRegistryRecord = {
      id: `${source.repoId}/${file.rfilename}@${source.revision}`,
      publisher,
      repository,
      revision: source.revision,
      fileName: file.rfilename,
      sha256: file.lfs.sha256,
      fileSizeBytes,
      format: "GGUF",
      quantization,
      baseModel,
      family: baseModel,
      model: baseModel.split("/").at(-1) ?? baseModel,
      maxContextTokens: contextLength,
      chatTemplate,
      status: "triage",
      license: { id: licenseId, sourceUrl: licenseSourceUrl },
      provenance: {
        id: provenance(fileUrl, retrievedAt, "identity-derivation"),
        publisher: apiProvenance,
        repository: apiProvenance,
        revision: apiProvenance,
        fileName: provenance(fileUrl, retrievedAt, "hub-lfs"),
        sha256: provenance(fileUrl, retrievedAt, "hub-lfs"),
        fileSizeBytes: provenance(fileUrl, retrievedAt, "hub-lfs"),
        format: provenance(fileUrl, retrievedAt, "schema-constant"),
        quantization: provenance(fileUrl, retrievedAt, "filename-derivation"),
        baseModel: provenance(sourceUrl, retrievedAt, "model-card"),
        family: provenance(sourceUrl, retrievedAt, "base-model-derivation"),
        model: provenance(sourceUrl, retrievedAt, "base-model-derivation"),
        license: provenance(licenseSourceUrl, retrievedAt, "model-card"),
        maxContextTokens: provenance(sourceUrl, retrievedAt, "gguf-metadata"),
        chatTemplate: provenance(sourceUrl, retrievedAt, "gguf-metadata"),
      },
    };
    const issues = validateArtifactRegistryRecord(record);
    if (issues.length) throw new TypeError(`${record.id}: ${issues.join(" ")}`);
    artifacts.push(record);
  }

  return { artifacts, quarantine: quarantined };
}

export function quantizationFromFilename(fileName: string) {
  return fileName.match(QUANTIZATION)?.[1]?.toUpperCase();
}

export function chatTemplateSha256(template: string) {
  return createHash("sha256").update(template).digest("hex");
}

function baseModelFromResponse(response: HuggingFaceModelResponse) {
  const card = response.cardData?.base_model;
  if (typeof card === "string") return card;
  if (Array.isArray(card)) return card[0];
  const quantized = response.tags?.find((tag) => tag.startsWith("base_model:quantized:"));
  if (quantized) return quantized.slice("base_model:quantized:".length);
  return response.tags?.find((tag) => tag.startsWith("base_model:"))?.slice("base_model:".length);
}

function provenance(sourceUrl: string, retrievedAt: string, kind: FieldProvenance["kind"]): FieldProvenance {
  return { sourceUrl, retrievedAt, kind };
}

function quarantine(source: DiscoveredRepository, recordedAt: string, code: QuarantineCode, reason: string, sourceUrl: string, fileName?: string): QuarantineRecord {
  return { repository: source.repoId, revision: source.revision, fileName, code, reason, sourceUrl, recordedAt };
}

function apiUrl(repoId: string, revision: string) {
  return `https://huggingface.co/api/models/${repoId}/revision/${revision}?blobs=true`;
}

function blobUrl(repoId: string, revision: string, fileName: string) {
  return `https://huggingface.co/${repoId}/blob/${revision}/${fileName.split("/").map(encodeURIComponent).join("/")}`;
}

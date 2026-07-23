export type TrustedPublisher = {
  id: string;
  kind: "official-model-org" | "trusted-quantizer";
  maxRepositories: number;
};

export type HuggingFaceDiscoveryPolicy = {
  schemaVersion: 1;
  publishers: TrustedPublisher[];
  requiredTag: "gguf";
  pipelineTag: "text-generation";
  excludeNamePatterns: string[];
  minimumArtifacts: number;
  minimumFamilies: number;
  requiredArtifacts?: Array<{ repoId: string; fileName: string }>;
};

export type DiscoveredRepository = {
  repoId: string;
  revision: string;
  publisher: string;
  publisherKind: TrustedPublisher["kind"];
  baseModelHint?: string;
  /** Explicitly reviewed files outside the popularity cap; ingestion admits only these files. */
  allowedFiles?: string[];
};

export type HuggingFaceDiscoveryLock = {
  schemaVersion: 1;
  discoveredAt: string;
  policySha256: string;
  repositories: DiscoveredRepository[];
};

export type HuggingFaceListModel = {
  id: string;
  sha?: string;
  gated?: boolean | string;
  private?: boolean;
  pipeline_tag?: string;
  tags?: string[];
};

export function selectDiscoveredRepositories(
  publisher: TrustedPublisher,
  policy: HuggingFaceDiscoveryPolicy,
  models: HuggingFaceListModel[],
): DiscoveredRepository[] {
  const exclusions = policy.excludeNamePatterns.map((pattern) => new RegExp(pattern, "i"));
  return models
    .filter((model) => model.id.startsWith(`${publisher.id}/`))
    .filter((model) => model.sha && /^[a-f0-9]{40,64}$/i.test(model.sha))
    .filter((model) => !model.private && !model.gated)
    .filter((model) => model.pipeline_tag === policy.pipelineTag)
    .filter((model) => model.tags?.includes(policy.requiredTag))
    .filter((model) => !exclusions.some((pattern) => pattern.test(model.id)))
    .slice(0, publisher.maxRepositories)
    .map((model) => ({
      repoId: model.id,
      revision: model.sha!,
      publisher: publisher.id,
      publisherKind: publisher.kind,
      baseModelHint: baseModelFromTags(model.tags),
    }));
}

/** Exact human-reviewed artifact inclusions keep every trust check except the
 * popularity query's pipeline tag, which publishers do not set consistently. */
export function selectRequiredArtifactRepository(
  publisher: TrustedPublisher,
  policy: HuggingFaceDiscoveryPolicy,
  model: HuggingFaceListModel,
  fileName: string,
): DiscoveredRepository {
  const exclusions = policy.excludeNamePatterns.map((pattern) => new RegExp(pattern, "i"));
  if (model.id !== `${publisher.id}/${model.id.split("/").slice(1).join("/")}`
      || !model.id.startsWith(`${publisher.id}/`)
      || !model.sha?.match(/^[a-f0-9]{40,64}$/i)
      || model.private
      || model.gated
      || !model.tags?.includes(policy.requiredTag)
      || exclusions.some((pattern) => pattern.test(model.id))) {
    throw new TypeError(`Required artifact repository failed trust policy: ${model.id}`);
  }
  return {
    repoId: model.id,
    revision: model.sha,
    publisher: publisher.id,
    publisherKind: publisher.kind,
    baseModelHint: baseModelFromTags(model.tags),
    allowedFiles: [fileName],
  };
}

export function baseModelFromTags(tags: string[] | undefined) {
  const quantized = tags?.find((tag) => tag.startsWith("base_model:quantized:"));
  if (quantized) return quantized.slice("base_model:quantized:".length);
  const base = tags?.find((tag) => tag.startsWith("base_model:") && !tag.startsWith("base_model:quantized:"));
  return base?.slice("base_model:".length);
}

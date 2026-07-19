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
};

export type DiscoveredRepository = {
  repoId: string;
  revision: string;
  publisher: string;
  publisherKind: TrustedPublisher["kind"];
  baseModelHint?: string;
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

export function baseModelFromTags(tags: string[] | undefined) {
  const quantized = tags?.find((tag) => tag.startsWith("base_model:quantized:"));
  if (quantized) return quantized.slice("base_model:quantized:".length);
  const base = tags?.find((tag) => tag.startsWith("base_model:") && !tag.startsWith("base_model:quantized:"));
  return base?.slice("base_model:".length);
}

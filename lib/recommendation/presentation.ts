import type { EvidenceClaim } from "../evidence";
import { recommendationPolicy } from "./policy";
import type { RecommendationItem, RecommendationOutcome } from "./types";

export type DisplayProvenance =
  | { kind: "evidence"; badge: EvidenceClaim; sourceUrls: string[]; note: string }
  | { kind: "sourced"; badge: "sourced"; sourceUrls: string[]; note: string }
  | { kind: "configuration"; badge: "configuration"; sourceUrls: string[]; note: string }
  | { kind: "unavailable"; badge: "unavailable"; sourceUrls: []; note: string };

/** UI components accept this wrapper, never a bare numeric/string metric. */
export type DisplayValue = {
  text: string;
  provenance: DisplayProvenance;
};

export type RecommendationCardView = {
  id: string;
  model: string;
  summary: string;
  rank: DisplayValue;
  fit: DisplayValue;
  speed: DisplayValue;
  maxContext: DisplayValue;
  downloadSize: DisplayValue;
  fields: Array<{ label: string; value: DisplayValue }>;
  alternativeCount: DisplayValue;
};

export function presentRecommendation(item: RecommendationItem, outcomeKind: RecommendationOutcome["kind"], index: number): RecommendationCardView {
  const { artifact } = item.candidate;
  const artifactUrl = artifact.provenance.sha256.sourceUrl;
  const fitSources = [artifactUrl, item.candidate.fitProfileSourceUrl];
  const runtimeSource = [item.candidate.fitProfileSourceUrl];
  return {
    id: item.candidate.id,
    model: artifact.model,
    summary: `${artifact.quantization} · ${artifact.format} · ${item.candidate.runtime.product}`,
    rank: outcomeKind === "ranked"
      ? evidenceValue(String(index + 1).padStart(2, "0"), "preference", [], "Position produced by the selected ranking strategy.")
      : unavailableValue("—", "No rank is claimed."),
    fit: evidenceValue(item.memoryPools
      ? `${formatGib(item.memoryPools.device.requiredBytes)} GB VRAM + ${formatGib(item.memoryPools.host.requiredBytes)} GB RAM`
      : `${formatGib(item.fit.requiredBytes)} GB`, "estimated", fitSources, `Byte-level estimate with a ${recommendationPolicy.safetyMarginBps / 100}% safety margin.`),
    speed: item.throughput.kind === "range"
      ? evidenceValue(`${item.throughput.ranges.generationTokensPerSecond.min}–${item.throughput.ranges.generationTokensPerSecond.max} tok/s`, "community", item.throughput.sourceUrls, `${item.throughput.sampleCount} observed samples · ${item.throughput.hardwareMatch} hardware match.`)
      : unavailableValue("No matched evidence", item.throughput.reason),
    maxContext: evidenceValue(`${formatContext(item.maxFeasibleContextTokens)} tokens`, "estimated", fitSources, "Largest context that passes the same fit profile and safety policy."),
    downloadSize: sourcedValue(`${formatGib(artifact.fileSizeBytes)} GB`, [artifact.provenance.fileSizeBytes.sourceUrl], "Exact admitted artifact file size."),
    fields: [
      field("Model", sourcedValue(artifact.model, [artifact.provenance.model.sourceUrl], "Pinned registry metadata.")),
      field("Quantization", sourcedValue(artifact.quantization, [artifact.provenance.quantization.sourceUrl], "Derived from the admitted filename.")),
      field("Artifact", sourcedValue(`${artifact.publisher}/${artifact.repository}/${artifact.fileName}`, [artifactUrl], "Pinned artifact revision.")),
      field("Revision", sourcedValue(artifact.revision, [artifact.provenance.revision.sourceUrl], "Immutable repository revision.")),
      field("Artifact hash", sourcedValue(`sha256:${artifact.sha256}`, [artifactUrl], "Exact artifact identity.")),
      field("License", sourcedValue(artifact.license.id, [artifact.license.sourceUrl], "License declared by the source repository.")),
      field("Product", configurationValue(item.candidate.runtime.product, runtimeSource)),
      field("Engine", configurationValue(item.candidate.runtime.engine, runtimeSource)),
      field("Runtime build", configurationValue(item.candidate.runtime.build, runtimeSource)),
      field("Backend", configurationValue(item.candidate.runtime.backend, runtimeSource)),
      field("Context", configurationValue(`${formatContext(item.contextTokens)} tokens`, fitSources)),
      field("KV cache", configurationValue(typeof item.candidate.runtime.kvCache === "string" ? item.candidate.runtime.kvCache : `${item.candidate.runtime.kvCache.key}/${item.candidate.runtime.kvCache.value}`, runtimeSource)),
      field("GPU layers", configurationValue(item.candidate.runtime.gpuLayers.toString(), runtimeSource)),
      field("Batch", configurationValue(item.candidate.runtime.batchSize.toLocaleString("en-US"), runtimeSource)),
      ...(item.memoryPools ? [
        field("Device memory required", evidenceValue(`${formatGib(item.memoryPools.device.requiredBytes)} GB`, "estimated", fitSources, "Device pool checked independently.")),
        field("System RAM required", evidenceValue(`${formatGib(item.memoryPools.host.requiredBytes)} GB`, "estimated", fitSources, "Host pool checked independently.")),
      ] : []),
    ],
    alternativeCount: sourcedValue(item.alternatives.length.toString(), item.alternatives.flatMap((candidate) => [candidate.artifact.provenance.id.sourceUrl]), "Same-family configurations nested under this card."),
  };
}

export function catalogAgeValue(generatedAt: string, sourceUrl: string, now = Date.now()): DisplayValue {
  const elapsedHours = Math.max(0, Math.floor((now - Date.parse(generatedAt)) / 3_600_000));
  const text = elapsedHours < 1 ? "Updated less than 1 hour ago" : `Updated ${elapsedHours} hour${elapsedHours === 1 ? "" : "s"} ago`;
  return sourcedValue(text, [sourceUrl], `Registry snapshot generated ${generatedAt}.`);
}

function field(label: string, value: DisplayValue) {
  return { label, value };
}

function evidenceValue(text: string, badge: EvidenceClaim, sourceUrls: string[], note: string): DisplayValue {
  return { text, provenance: { kind: "evidence", badge, sourceUrls, note } };
}

function sourcedValue(text: string, sourceUrls: string[], note: string): DisplayValue {
  return { text, provenance: { kind: "sourced", badge: "sourced", sourceUrls, note } };
}

function configurationValue(text: string, sourceUrls: string[]): DisplayValue {
  return { text, provenance: { kind: "configuration", badge: "configuration", sourceUrls, note: "Setting scoped to this runtime configuration." } };
}

function unavailableValue(text: string, note: string): DisplayValue {
  return { text, provenance: { kind: "unavailable", badge: "unavailable", sourceUrls: [], note } };
}

function formatGib(bytes: number) {
  return (bytes / 1_024 ** 3).toFixed(1);
}

function formatContext(tokens: number) {
  return tokens.toLocaleString("en-US");
}

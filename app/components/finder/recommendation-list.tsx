import type { Recommendation } from "@/lib/recommendation";

type Props = {
  recommendations: Recommendation[];
  selectedId: string | null;
  onSelect(id: string): void;
};

export function RecommendationList({ recommendations, selectedId, onSelect }: Props) {
  if (!recommendations.length) {
    return <div className="empty-state"><span>NO SAFE MATCHES</span><h2>Nothing in the prototype catalog fits these constraints.</h2><p>Reduce the desired context, choose more memory, or wait for broader artifact coverage. The list will not be padded with configurations unlikely to load.</p></div>;
  }

  return <div className="recommendation-list">
    {recommendations.map((recommendation) => {
      const selected = selectedId === recommendation.artifact.id;
      return <article className={`recommendation-card ${selected ? "selected" : ""}`} key={recommendation.artifact.id}>
        <button type="button" className="card-main" onClick={() => onSelect(recommendation.artifact.id)} aria-expanded={selected}>
          <span className="rank">{String(recommendation.rank).padStart(2, "0")}</span>
          <span className="artifact-name"><b>{recommendation.artifact.model}</b><small>{recommendation.artifact.quantization} · {recommendation.artifact.format} · {recommendation.artifact.runtime}</small></span>
          <Metric label="Est. memory" value={`${recommendation.requiredMemoryGb.toFixed(1)} GB`} />
          <Metric label="Est. speed" value={`${recommendation.estimatedTokensPerSecond[0]}–${recommendation.estimatedTokensPerSecond[1]} tok/s`} />
          <Metric label="Run at" value={`${recommendation.configuration.contextK}K context`} />
          <span className="disclosure">{selected ? "−" : "+"}</span>
        </button>
        {selected && <div className="card-evidence">
          <div className="configuration-identity">
            <span>RECOMMENDED CONFIGURATION</span>
            <dl>
              <ConfigurationValue label="Model" value={recommendation.artifact.model} />
              <ConfigurationValue label="Quantization" value={recommendation.artifact.quantization} />
              <ConfigurationValue label="Format" value={recommendation.artifact.format} />
              <ConfigurationValue label="Runtime" value={recommendation.configuration.runtime} />
              <ConfigurationValue label="Context" value={`${recommendation.configuration.contextK}K recommended · ${recommendation.artifact.maxContextK}K catalog maximum`} />
              <ConfigurationValue label="Artifact" value={recommendation.configuration.artifactRepository && recommendation.configuration.artifactFileName ? `${recommendation.configuration.artifactRepository}/${recommendation.configuration.artifactFileName}` : undefined} href={recommendation.configuration.artifactSourceUrl} />
              <ConfigurationValue label="Revision" value={recommendation.configuration.artifactRevision} />
              <ConfigurationValue label="Artifact hash" value={recommendation.configuration.artifactSha256} />
              <ConfigurationValue label="License" value={recommendation.configuration.licenseId} href={recommendation.configuration.licenseSourceUrl} />
              <ConfigurationValue label="Runtime build" value={recommendation.configuration.runtimeBuild} />
              <ConfigurationValue label="Backend" value={recommendation.configuration.backend} />
              <ConfigurationValue label="KV cache" value={recommendation.configuration.kvCacheQuantization} />
              <ConfigurationValue label="GPU layers" value={recommendation.configuration.gpuLayers?.toString()} />
              <ConfigurationValue label="Batch" value={recommendation.configuration.batchSize?.toString()} />
            </dl>
          </div>
          <div><span>EVIDENCE LEVEL</span><b>{recommendation.artifact.identity ? "Artifact verified · ranking prototype" : "Prototype estimate"}</b><p>{recommendation.artifact.identity ? "File identity comes from a pinned source. Speed and task ranking are still unmeasured prototype values." : "No measurement on your machine. Unsourced configuration fields are withheld."}</p></div>
          {recommendation.explanation.map((explanation, index) => <div key={explanation}><span>FACTOR {String(index + 1).padStart(2, "0")}</span><p>{explanation}</p></div>)}
        </div>}
      </article>;
    })}
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <span className="metric"><small>{label}</small><b>{value}</b></span>;
}

function ConfigurationValue({ label, value, href }: { label: string; value?: string; href?: string }) {
  return <div><dt>{label}</dt><dd className={value ? undefined : "not-sourced"}>{value && href ? <a href={href} target="_blank" rel="noreferrer">{value} ↗</a> : value ?? "Not sourced yet"}</dd></div>;
}

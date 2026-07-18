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
          <Metric label="Max context" value={`${recommendation.artifact.maxContextK}K`} />
          <span className="disclosure">{selected ? "−" : "+"}</span>
        </button>
        {selected && <div className="card-evidence">
          <div><span>EVIDENCE LEVEL</span><b>Prototype estimate</b><p>No measurement on your machine.</p></div>
          {recommendation.explanation.map((explanation, index) => <div key={explanation}><span>FACTOR {String(index + 1).padStart(2, "0")}</span><p>{explanation}</p></div>)}
        </div>}
      </article>;
    })}
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <span className="metric"><small>{label}</small><b>{value}</b></span>;
}


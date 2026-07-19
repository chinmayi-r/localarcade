import type { RecommendationOutcome } from "@/lib/recommendation";

type Props = {
  outcome: RecommendationOutcome;
  selectedId: string | null;
  onSelect(id: string): void;
};

const roleLabels = {
  "primary-match": "Primary match",
  "quality-option": "Quality option",
  "fast-option": "Fast option",
  "long-context-option": "Long-context option",
  "memory-efficient-option": "Memory-efficient option",
};

export function RecommendationList({ outcome, selectedId, onSelect }: Props) {
  if (outcome.kind === "nothing-fits") return <EmptyState eyebrow="NO SAFE MATCHES" title="No sourced configuration fits these constraints." message={outcome.message} />;

  return <>
    <div className="outcome-note"><b>{outcome.kind === "ranked" ? "RANKED" : outcome.kind === "contradictory" ? "CONSTRAINT CONFLICT" : "UNRANKED SHORTLIST"}</b><span>{outcome.message}</span></div>
    <div className="recommendation-list">
      {outcome.items.map((item, index) => {
        const { artifact } = item.candidate;
        const selected = selectedId === item.candidate.id;
        const speed = item.throughput.kind === "range"
          ? `${item.throughput.ranges.generationTokensPerSecond.min}–${item.throughput.ranges.generationTokensPerSecond.max} tok/s`
          : "No matched evidence";
        return <article className={`recommendation-card ${selected ? "selected" : ""}`} key={item.candidate.id}>
          <button type="button" className="card-main" onClick={() => onSelect(item.candidate.id)} aria-expanded={selected}>
            <span className="rank">{outcome.kind === "ranked" ? String(index + 1).padStart(2, "0") : "—"}</span>
            <span className="artifact-name"><b>{artifact.model}</b><small>{artifact.quantization} · {artifact.format} · {item.candidate.runtime.product}</small></span>
            <Metric label="Estimated fit" value={`${(item.fit.requiredBytes / 1024 ** 3).toFixed(1)} GB`} />
            <Metric label="Community speed" value={speed} />
            <Metric label={item.role ? "Role" : "Context"} value={item.role ? roleLabels[item.role] : `${item.contextTokens / 1024}K tokens`} />
            <span className="disclosure">{selected ? "−" : "+"}</span>
          </button>
          {selected && <div className="card-evidence">
            <div className="configuration-identity">
              <span>CONFIGURATION IDENTITY</span>
              <dl>
                <ConfigurationValue label="Model" value={artifact.model} />
                <ConfigurationValue label="Quantization" value={artifact.quantization} />
                <ConfigurationValue label="Artifact" value={`${artifact.publisher}/${artifact.repository}/${artifact.fileName}`} href={artifact.provenance.sha256.sourceUrl} />
                <ConfigurationValue label="Revision" value={artifact.revision} />
                <ConfigurationValue label="Artifact hash" value={`sha256:${artifact.sha256}`} />
                <ConfigurationValue label="License" value={artifact.license.id} href={artifact.license.sourceUrl} />
                <ConfigurationValue label="Product" value={item.candidate.runtime.product} />
                <ConfigurationValue label="Engine" value={item.candidate.runtime.engine} />
                <ConfigurationValue label="Runtime build" value={item.candidate.runtime.build} />
                <ConfigurationValue label="Backend" value={item.candidate.runtime.backend} />
                <ConfigurationValue label="Context" value={`${item.contextTokens / 1024}K tokens`} />
                <ConfigurationValue label="KV cache" value={typeof item.candidate.runtime.kvCache === "string" ? item.candidate.runtime.kvCache : `${item.candidate.runtime.kvCache.key}/${item.candidate.runtime.kvCache.value}`} />
                <ConfigurationValue label="GPU layers" value={item.candidate.runtime.gpuLayers.toString()} />
                <ConfigurationValue label="Batch" value={item.candidate.runtime.batchSize.toString()} />
              </dl>
            </div>
            <div><span>FIT EVIDENCE</span><b>Estimated · sourced profile</b><p>Byte-level fit combines the exact artifact size with a cited runtime allocation profile and a 10% safety margin.</p><a href={item.candidate.fitProfileSourceUrl} target="_blank" rel="noreferrer">Allocation source ↗</a></div>
            <div><span>THROUGHPUT EVIDENCE</span><b>{item.throughput.kind === "range" ? `${item.throughput.confidence} confidence` : "Unavailable"}</b><p>{item.throughput.kind === "range" ? `Observed range from ${item.throughput.sampleCount} samples; not measured on this machine.` : item.throughput.reason}</p></div>
            <div><span>ALTERNATE CONFIGURATIONS</span><b>{item.alternatives.length}</b><p>Variants from the same model family are nested here rather than occupying additional result slots.</p></div>
          </div>}
        </article>;
      })}
    </div>
  </>;
}

function EmptyState({ eyebrow, title, message }: { eyebrow: string; title: string; message: string }) {
  return <div className="empty-state"><span>{eyebrow}</span><h2>{title}</h2><p>{message} The list is not padded with configurations lacking the required evidence.</p></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <span className="metric"><small>{label}</small><b>{value}</b></span>;
}

function ConfigurationValue({ label, value, href }: { label: string; value: string; href?: string }) {
  return <div><dt>{label}</dt><dd>{href ? <a href={href} target="_blank" rel="noreferrer">{value} ↗</a> : value}</dd></div>;
}

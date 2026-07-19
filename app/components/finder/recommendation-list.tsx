"use client";

import { useState } from "react";
import { presentRecommendation } from "@/lib/recommendation";
import type { DisplayValue, RecommendationOutcome, RecommendationQuery } from "@/lib/recommendation";

type Props = {
  outcome: RecommendationOutcome;
  query: RecommendationQuery;
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

export function RecommendationList({ outcome, query, selectedId, onSelect }: Props) {
  if (outcome.kind === "nothing-fits") return <EmptyState eyebrow="NO SAFE MATCHES" title="No sourced configuration fits these constraints." message={outcome.message} />;

  return <>
    <div className="outcome-note"><b>{outcome.kind === "ranked" ? "RANKED" : outcome.kind === "contradictory" ? "CONSTRAINT CONFLICT" : "UNRANKED SHORTLIST"}</b><span>{outcome.message}</span></div>
    <div className="recommendation-list">
      {outcome.items.map((item, index) => {
        const view = presentRecommendation(item, outcome.kind, index);
        const selected = selectedId === item.candidate.id;
        return <article className={`recommendation-card ${selected ? "selected" : ""}`} key={item.candidate.id}>
          <button type="button" className="card-main" onClick={() => onSelect(item.candidate.id)} aria-expanded={selected}>
            <span className="rank">{view.rank.text}</span>
            <span className="artifact-name"><b>{view.model}</b><small>{view.summary} · download {view.downloadSize.text}</small></span>
            <EvidenceMetric label="Estimated fit" value={view.fit} />
            <EvidenceMetric label="Generation speed" value={view.speed} />
            <EvidenceMetric label={item.role ? "Role" : "Max feasible context"} value={item.role ? configurationDisplay(roleLabels[item.role]) : view.maxContext} />
            <span className="disclosure">{selected ? "−" : "+"}</span>
          </button>
          {selected && <div className="card-evidence">
            <div className="configuration-identity">
              <span>CONFIGURATION IDENTITY</span>
              <dl>{view.fields.map((field) => <ConfigurationValue key={field.label} label={field.label} value={field.value} />)}</dl>
            </div>
            <EvidencePanel title="FIT EVIDENCE" value={view.fit} body="Weights, KV cache, runtime buffers and the editable safety policy are included." />
            <EvidencePanel title="THROUGHPUT EVIDENCE" value={view.speed} body="Prompt speed, generation speed and time-to-first-token stay separate in the stored prior." />
            <div><span>ALTERNATE CONFIGURATIONS</span><b>{view.alternativeCount.text} <EvidenceBadge value={view.alternativeCount} /></b><p>{view.alternativeCount.provenance.note}</p></div>
            <RequestConfigurationButton candidateId={item.candidate.id} query={query} />
          </div>}
        </article>;
      })}
    </div>
  </>;
}

function EvidenceMetric({ label, value }: { label: string; value: DisplayValue }) {
  return <span className="metric"><small>{label}</small><b>{value.text}</b><EvidenceBadge value={value} /></span>;
}

function EvidencePanel({ title, value, body }: { title: string; value: DisplayValue; body: string }) {
  const href = value.provenance.sourceUrls[0];
  return <div><span>{title}</span><b>{value.text} <EvidenceBadge value={value} /></b><p>{body} {value.provenance.note}</p>{href && <a href={href} target="_blank" rel="noreferrer">Evidence source ↗</a>}</div>;
}

function EvidenceBadge({ value }: { value: DisplayValue }) {
  return <em className={`evidence-badge ${value.provenance.kind}`}>{value.provenance.badge}</em>;
}

function EmptyState({ eyebrow, title, message }: { eyebrow: string; title: string; message: string }) {
  return <div className="empty-state"><span>{eyebrow}</span><h2>{title}</h2><p>{message} The list is not padded with configurations lacking the required evidence.</p></div>;
}

function ConfigurationValue({ label, value }: { label: string; value: DisplayValue }) {
  const href = value.provenance.sourceUrls[0];
  return <div><dt>{label}</dt><dd>{href ? <a href={href} target="_blank" rel="noreferrer">{value.text} ↗</a> : value.text}<EvidenceBadge value={value} /></dd></div>;
}

function RequestConfigurationButton({ candidateId, query }: { candidateId: string; query: RecommendationQuery }) {
  const [saved, setSaved] = useState(false);
  function saveLocally() {
    const key = "local-arcade:configuration-requests:v1";
    const current = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown[];
    current.push({ candidateId, hardware: query.hardware, task: query.task, strategy: query.strategy, contextK: query.desiredContextK, requestedAt: new Date().toISOString() });
    window.localStorage.setItem(key, JSON.stringify(current.slice(-100)));
    setSaved(true);
  }
  return <div className="request-configuration"><span>EVIDENCE COVERAGE</span><b>{saved ? "Saved on this device" : "Need a better-matched benchmark?"}</b><p>This request stays in this browser. It is not submitted or uploaded.</p><button type="button" onClick={saveLocally} disabled={saved}>{saved ? "Saved locally" : "Save evidence request"}</button></div>;
}

function configurationDisplay(text: string): DisplayValue {
  return { text, provenance: { kind: "configuration", badge: "configuration", sourceUrls: [], note: "Role assigned by the selected ranking strategy." } };
}

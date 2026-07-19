"use client";

import { createElement, useMemo, useRef, useState } from "react";
import { ConfigurationPanel } from "./components/finder/configuration-panel";
import { RecommendationList } from "./components/finder/recommendation-list";
import { LocalhostQuickTest } from "./components/quick-test/localhost-quick-test";
import { catalogAgeValue, recommend, rankingStrategies, recommendationCatalogMetadata } from "@/lib/recommendation";
import type { RecommendationQuery } from "@/lib/recommendation";

const initialQuery: RecommendationQuery = {
  hardware: { platform: "cpu", availableMemoryGb: 32 },
  task: "general",
  desiredContextK: 16,
  strategy: "balanced",
};

export function ArenaApp() {
  const [draftQuery, setDraftQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState<RecommendationQuery | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const outcome = useMemo(() => submittedQuery ? recommend(submittedQuery) : null, [submittedQuery]);
  const strategy = submittedQuery ? rankingStrategies[submittedQuery.strategy] : null;
  const catalogAge = catalogAgeValue(recommendationCatalogMetadata.lastIngestSucceededAt, recommendationCatalogMetadata.sourceUrl);

  function submitQuery() {
    setSubmittedQuery(draftQuery);
    setSelectedId(null);
    window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  return (
    <div className="website-shell">
      <header className="site-header">
        <a href="#top" className="site-brand" aria-label="Local Arcade home"><span>LA</span><b>Local Arcade</b></a>
        <nav aria-label="Website navigation">
          <a href="#finder">Find models</a>
          <a href="#quick-test">Quick test</a>
          <a href="#method">How it works</a>
          <span>Runner · planned</span>
        </nav>
      </header>

      <main id="top">
        <section className="finder-hero" aria-labelledby="finder-title">
          <div className="configuration-field">
            {createElement("la-constellation", { seed: "19", density: "145", bloom: "0.34" })}
          </div>
          <div className="finder-intro">
            <span className="eyebrow">LOCAL MODEL FINDER</span>
            <h1 id="finder-title">What should you run on your computer?</h1>
            <p>Enter the available hardware and the job the model needs to do. Local Arcade returns configurations that fit—not just model names.</p>
          </div>

          <ConfigurationPanel query={draftQuery} onChange={setDraftQuery} onSubmit={submitQuery} hasResults={submittedQuery !== null} />
          <p className="prototype-note"><i /> CURRENT COVERAGE: CPU · LLAMA.CPP · LLAMA 3.2 1B · No measurements from your machine. No account or download required.</p>
        </section>

        {submittedQuery && strategy && outcome && (
          <section className="results-section" id="results" ref={resultsRef}>
            <div className="results-heading">
              <div><span className="eyebrow">YOUR MATCHES</span><h2>{outcome.items.length} sourced configurations</h2></div>
              <div className="result-summary"><b>{strategy.label}</b><span>{submittedQuery.hardware.availableMemoryGb} GB · {submittedQuery.desiredContextK}K context · {submittedQuery.task}</span><span className="catalog-age">{catalogAge.text} · {catalogAge.provenance.badge}</span></div>
            </div>
            <RecommendationList outcome={outcome} query={submittedQuery} selectedId={selectedId} onSelect={(id) => setSelectedId(selectedId === id ? null : id)} />
          </section>
        )}

        <LocalhostQuickTest />

        <section className="method-section" id="method">
          <div className="method-intro"><span className="eyebrow">WHAT THE RESULT MEANS</span><h2>A recommendation is a complete setup.</h2><p>Quantization, app, engine build, context and memory settings can change whether the same model fits or performs well. Local Arcade keeps them separate and attached to the recommendation.</p></div>
          <div className="confidence-panel">
            <div><span>BACKED NOW</span><b>Artifact identity and fit math</b><p>Pinned artifact revisions, hashes, file sizes and licenses feed explicit runtime-scoped memory calculations.</p></div>
            <div><span>LIMITED COVERAGE</span><b>Ranking evidence</b><p>Results remain unranked when comparable task or throughput evidence is missing. Empty results are expected while sourced coverage grows.</p></div>
            <div><span>SUPPORTED ROUTES</span><b>Apps and engines stay separate</b><p>Adapters cover llama.cpp, Ollama, LM Studio, Jan, MLX LM and vLLM. Compatibility is evaluated per route; no app is silently assumed.</p></div>
          </div>
        </section>
      </main>

      <footer className="site-footer"><span>LOCAL ARCADE / OPEN-SOURCE TOOL</span><span>NO ACCOUNT · NO TELEMETRY · NO DOWNLOAD</span><a href="mailto:hello@localarcade.dev">CONTACT ↗</a></footer>
    </div>
  );
}

"use client";

import { createElement, useMemo, useRef, useState } from "react";
import { ConfigurationPanel } from "./components/finder/configuration-panel";
import { RecommendationList } from "./components/finder/recommendation-list";
import { recommend, rankingStrategies } from "@/lib/recommendation";
import type { RecommendationQuery } from "@/lib/recommendation";

const initialQuery: RecommendationQuery = {
  hardware: { platform: "nvidia", availableMemoryGb: 24 },
  task: "coding",
  desiredContextK: 32,
  strategy: "balanced",
};

export function ArenaApp() {
  const [draftQuery, setDraftQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState<RecommendationQuery | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const recommendations = useMemo(() => submittedQuery ? recommend(submittedQuery) : [], [submittedQuery]);
  const strategy = submittedQuery ? rankingStrategies[submittedQuery.strategy] : null;

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
          <p className="prototype-note"><i /> PROTOTYPE DATA · NOT A PUBLISHED LEADERBOARD · No measurements from your machine. No account or download required.</p>
        </section>

        {submittedQuery && strategy && (
          <section className="results-section" id="results" ref={resultsRef}>
            <div className="results-heading">
              <div><span className="eyebrow">YOUR MATCHES</span><h2>{recommendations.length} configurations fit</h2></div>
              <div className="result-summary"><b>{strategy.label}</b><span>{submittedQuery.hardware.availableMemoryGb} GB · {submittedQuery.desiredContextK}K context · {submittedQuery.task}</span></div>
            </div>
            <RecommendationList recommendations={recommendations} selectedId={selectedId} onSelect={(id) => setSelectedId(selectedId === id ? null : id)} />
          </section>
        )}

        <section className="method-section" id="method">
          <div className="method-intro"><span className="eyebrow">WHAT THE RESULT MEANS</span><h2>A recommendation is a complete setup.</h2><p>Quantization, app, engine build, context and memory settings can change whether the same model fits or performs well. Local Arcade keeps them separate and attached to the recommendation.</p></div>
          <div className="confidence-panel">
            <div><span>BACKED NOW</span><b>Fit and ranking logic</b><p>Memory constraints, ranking preferences, context eligibility, family deduplication and fail-closed behavior are implemented and tested.</p></div>
            <div><span>NOT BACKED YET</span><b>Recommendation evidence</b><p>Artifact sizes, task scores and speed ranges currently come from an isolated prototype catalog, not machine measurements.</p></div>
            <div><span>SUPPORTED ROUTES</span><b>Apps and engines stay separate</b><p>Adapters cover llama.cpp, Ollama, LM Studio, Jan, MLX LM and vLLM. Compatibility is evaluated per route; no app is silently assumed.</p></div>
          </div>
        </section>
      </main>

      <footer className="site-footer"><span>LOCAL ARCADE / PUBLIC PROTOTYPE</span><span>NO ACCOUNT · NO TELEMETRY · NO DOWNLOAD</span><a href="mailto:hello@localarcade.dev">CONTACT ↗</a></footer>
    </div>
  );
}

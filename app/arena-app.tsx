"use client";

import { createElement, useMemo, useState } from "react";
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
  const [query, setQuery] = useState(initialQuery);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const recommendations = useMemo(() => recommend(query), [query]);
  const strategy = rankingStrategies[query.strategy];

  function changeQuery(next: RecommendationQuery) {
    setQuery(next);
    setSelectedId(null);
  }

  return (
    <main className="application-shell">
      <header className="app-header">
        <a href="#results" className="app-brand" aria-label="Local Arena home"><span>LA</span><div><b>LOCAL ARENA</b><small>MODEL + CONFIGURATION FINDER</small></div></a>
        <div className="prototype-flag"><i /> PROTOTYPE DATA · NOT A PUBLISHED LEADERBOARD</div>
        <nav aria-label="Application navigation"><a className="active" href="#results">Finder</a><a href="#method">Method</a><span>Runner · planned</span></nav>
      </header>

      <div className="app-body">
        <ConfigurationPanel query={query} onChange={changeQuery} />
        <section className="workspace" id="results">
          <div className="configuration-field">
            {createElement("la-constellation", { seed: "19", density: "155", bloom: "0.38" })}
          </div>
          <div className="workspace-heading">
            <div className="workspace-intro"><span className="section-code">WEB FINDER / LIVE</span><h1>Find a configuration for this machine.</h1><p>Choose the hardware you have and what you want to do. Results update immediately; no download required.</p></div>
            <div className="result-provenance"><span>RANKING MODE</span><b>{strategy.label}</b><p>{strategy.description}</p></div>
          </div>

          <div className="list-header"><span>RANK / ARTIFACT</span><span>MEMORY</span><span>SPEED</span><span>CONTEXT</span><span /></div>
          <RecommendationList recommendations={recommendations} selectedId={selectedId} onSelect={(id) => setSelectedId(selectedId === id ? null : id)} />

          <section className="confidence-panel" id="method">
            <div><span>WHAT IS BACKED</span><b>Application logic</b><p>Memory constraints, strategy selection, family deduplication and fail-closed safety behavior are implemented and tested.</p></div>
            <div><span>WHAT IS NOT BACKED YET</span><b>Recommendation evidence</b><p>Artifact sizes, task scores and speed ranges currently come from an isolated prototype catalog.</p></div>
            <div><span>NEXT DATA MILESTONE</span><b>Versioned artifact registry</b><p>Immutable revisions, hashes, licenses, sources, runtime support and field-level confidence.</p></div>
          </section>
        </section>
      </div>

      <footer className="app-footer"><span>LOCAL ARENA / PUBLIC PROTOTYPE</span><span>NO ACCOUNT · NO TELEMETRY · NO DOWNLOAD</span><a href="mailto:hello@localarena.dev">CONTACT ↗</a></footer>
    </main>
  );
}

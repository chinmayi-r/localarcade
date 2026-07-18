"use client";

import { useMemo, useState } from "react";

const battles = [
  {
    prompt: "Turn these notes into a clear reply to a customer whose order is late. Keep it under 70 words.",
    context: "Support writing · Apple M2 · 16 GB · llama.cpp",
    a: "I’m sorry your order hasn’t arrived yet. I checked the tracking and it’s still moving, but later than expected. I’ve added a note to your order and will monitor it. If there’s no update within 48 hours, reply here and we’ll make it right.",
    b: "We apologize for the delay. Your package is in transit. Please continue to monitor the tracking information. Contact support if the package does not arrive.",
  },
  {
    prompt: "Extract the product, color, and requested action: ‘Can I swap the navy TrailShell jacket for the same one in moss?’",
    context: "Structured extraction · RTX 4060 · 8 GB VRAM · Ollama",
    a: '{ "product": "TrailShell jacket", "color": "navy", "action": "exchange for moss" }',
    b: '{ "item": "TrailShell", "current_color": "navy", "requested_color": "moss", "intent": "exchange" }',
  },
];

const devices = [
  ["Apple M2 · 16 GB", "142 runs", "98.7%"],
  ["RTX 4060 · 8 GB", "96 runs", "97.9%"],
  ["Snapdragon X Elite", "61 runs", "94.2%"],
];

export function ArenaApp() {
  const [battleIndex, setBattleIndex] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const battle = battles[battleIndex];
  const progress = useMemo(() => 1842 + battleIndex + (choice ? 1 : 0), [battleIndex, choice]);

  function vote(value: string) {
    if (choice) return;
    setChoice(value);
  }

  function nextBattle() {
    setBattleIndex((current) => (current + 1) % battles.length);
    setChoice(null);
  }

  return (
    <main>
      <nav className="nav shell" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Local Arena home"><span className="brand-mark">LA</span> Local Arena <span className="alpha">ALPHA</span></a>
        <div className="nav-links"><a href="#arena">Arena</a><a href="#fleet">Fleet</a><a href="#method">Method</a></div>
        <button className="nav-cta" onClick={() => document.querySelector("#join")?.scrollIntoView({ behavior: "smooth" })}>Contribute a device</button>
      </nav>

      <section className="hero shell" id="top">
        <div className="eyebrow"><span className="live-dot" /> 73 devices benchmarking now</div>
        <h1>Which local model<br /><em>actually works</em> on your machine?</h1>
        <p className="hero-copy">Blind human preference, real hardware telemetry, and deployable model artifacts—measured together.</p>
        <div className="hero-actions"><a className="primary" href="#arena">Vote on a battle <span>↓</span></a><a className="text-link" href="#fleet">Explore the fleet →</a></div>
        <div className="signal-grid" aria-label="Network summary">
          <div><strong>1,842</strong><span>verified comparisons</span></div>
          <div><strong>24</strong><span>hardware buckets</span></div>
          <div><strong>11</strong><span>model artifacts</span></div>
          <div><strong>100%</strong><span>results reproducible</span></div>
        </div>
      </section>

      <section className="arena-section" id="arena">
        <div className="shell">
          <div className="section-heading"><div><span className="kicker">LIVE ARENA</span><h2>Judge the output, not the logo.</h2></div><div className="battle-count">Comparison <strong>{progress.toLocaleString()}</strong></div></div>
          <div className="prompt-card"><span>PROMPT</span><p>{battle.prompt}</p><small>{battle.context}</small></div>
          <div className="responses">
            {(["a", "b"] as const).map((side) => (
              <button className={`response ${choice === side ? "selected" : ""}`} onClick={() => vote(side)} key={side} aria-pressed={choice === side}>
                <span className="response-label">RESPONSE {side.toUpperCase()}</span><p>{battle[side]}</p><span className="pick">{choice === side ? "Selected ✓" : "This is better"}</span>
              </button>
            ))}
          </div>
          <div className="vote-row">
            <button className="tie" onClick={() => vote("tie")} disabled={Boolean(choice)}>Tie / both fail</button>
            {choice && <div className="vote-confirm">Vote recorded locally for this demo. <button onClick={nextBattle}>Next battle →</button></div>}
            <p>Model identities stay hidden until the study closes.</p>
          </div>
        </div>
      </section>

      <section className="fleet shell" id="fleet">
        <div className="section-heading"><div><span className="kicker">REAL-WORLD COVERAGE</span><h2>A lab made of machines people own.</h2></div><p>Every published result includes the artifact hash, runtime, configuration, and hardware evidence required to reproduce it.</p></div>
        <div className="fleet-layout">
          <div className="device-list">
            {devices.map(([name, runs, reliability], index) => <div className="device" key={name}><span className="device-index">0{index + 1}</span><div><strong>{name}</strong><span>{runs} this week</span></div><div className="reliability"><strong>{reliability}</strong><span>valid</span></div></div>)}
          </div>
          <div className="matrix" aria-label="Example benchmark matrix"><div className="matrix-head"><span>ARTIFACT</span><span>TOK/S</span><span>WIN RATE</span></div><div><strong>Qwen3 8B · Q4_K_M</strong><span>31.4</span><span className="good">64%</span></div><div><strong>Llama 3.2 3B · Q6_K</strong><span>46.8</span><span>51%</span></div><div><strong>Gemma 3 4B · Q4_K_M</strong><span>39.1</span><span>57%</span></div><small>Example data · not a published claim</small></div>
        </div>
      </section>

      <section className="method" id="method"><div className="shell"><span className="kicker">TRUST BY DESIGN</span><h2>No vibes-only leaderboard.</h2><div className="principles"><article><b>01</b><h3>Attested runs</h3><p>Hardware and runtime details are detected by the runner. Self-reported context is labeled separately.</p></article><article><b>02</b><h3>Artifact-level identity</h3><p>Every result points to an exact weight hash, quantization, runtime version, and inference settings.</p></article><article><b>03</b><h3>Visible uncertainty</h3><p>Sample size, invalid runs, confidence intervals, and methodology ship beside every ranking.</p></article></div></div></section>

      <section className="join shell" id="join"><div><span className="kicker">BUILD THE MAP WITH US</span><h2>Your machine is a missing data point.</h2><p>The runner never downloads a model or starts a job without your approval. Set storage, bandwidth, schedule, and power limits before contributing.</p></div>{joined ? <div className="joined" role="status"><span>✓</span><strong>You’re on the early-access list.</strong><p>We’ll ask before collecting any device details.</p></div> : <form onSubmit={(event) => { event.preventDefault(); setJoined(true); }}><label htmlFor="email">Email for runner access</label><div><input id="email" type="email" required placeholder="you@company.com" autoComplete="email" /><button type="submit">Request access</button></div><small>No device fingerprinting on this page. No spam.</small></form>}</section>
      <footer className="shell"><a className="brand" href="#top"><span className="brand-mark">LA</span> Local Arena</a><p>Open measurements for local AI, under real conditions.</p><div><a href="#method">Methodology</a><a href="#join">Runner safety</a><a href="mailto:hello@localarena.dev">Contact</a></div></footer>
    </main>
  );
}

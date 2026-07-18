"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

type Platform = "nvidia" | "apple" | "amd" | "cpu";
type Task = "coding" | "general" | "writing" | "extraction";
type Priority = "balanced" | "quality" | "speed" | "context";

type CatalogModel = {
  name: string;
  quant: string;
  footprint: number;
  context: number;
  speed: number;
  scores: Record<Task, number>;
};

const catalog: CatalogModel[] = [
  { name: "Qwen3 0.6B", quant: "Q8_0", footprint: 0.8, context: 32, speed: 98, scores: { coding: 42, general: 48, writing: 44, extraction: 62 } },
  { name: "Llama 3.2 1B", quant: "Q8_0", footprint: 1.3, context: 16, speed: 88, scores: { coding: 45, general: 54, writing: 52, extraction: 61 } },
  { name: "Qwen3 1.7B", quant: "Q6_K", footprint: 1.7, context: 32, speed: 76, scores: { coding: 58, general: 59, writing: 55, extraction: 70 } },
  { name: "Phi-4 Mini 3.8B", quant: "Q4_K_M", footprint: 2.6, context: 16, speed: 64, scores: { coding: 68, general: 63, writing: 57, extraction: 74 } },
  { name: "Gemma 3 4B", quant: "Q4_K_M", footprint: 2.9, context: 32, speed: 59, scores: { coding: 63, general: 70, writing: 68, extraction: 72 } },
  { name: "Llama 3.1 8B", quant: "Q4_K_M", footprint: 5.4, context: 32, speed: 45, scores: { coding: 69, general: 75, writing: 77, extraction: 75 } },
  { name: "Qwen 3.5 9B", quant: "Q4_K_M", footprint: 6.2, context: 64, speed: 41, scores: { coding: 78, general: 78, writing: 74, extraction: 83 } },
  { name: "Gemma 3 12B", quant: "Q4_K_M", footprint: 8.1, context: 64, speed: 34, scores: { coding: 75, general: 82, writing: 83, extraction: 79 } },
  { name: "GPT-OSS 20B", quant: "MXFP4", footprint: 12.3, context: 64, speed: 28, scores: { coding: 86, general: 84, writing: 79, extraction: 87 } },
  { name: "Mistral Small 24B", quant: "Q4_K_M", footprint: 15.6, context: 64, speed: 23, scores: { coding: 84, general: 86, writing: 88, extraction: 84 } },
  { name: "Qwen 3.5 27B", quant: "Q4_K_M", footprint: 17.8, context: 64, speed: 20, scores: { coding: 90, general: 88, writing: 85, extraction: 91 } },
  { name: "Qwen3 32B", quant: "Q4_K_M", footprint: 21.2, context: 64, speed: 17, scores: { coding: 89, general: 89, writing: 87, extraction: 90 } },
];

const platformLabels: Record<Platform, string> = {
  nvidia: "NVIDIA GPU",
  apple: "Apple Silicon",
  amd: "AMD GPU",
  cpu: "CPU only",
};

const tasks: Array<{ id: Task; label: string; note: string }> = [
  { id: "coding", label: "Coding", note: "edits + debugging" },
  { id: "general", label: "General", note: "chat + research" },
  { id: "writing", label: "Writing", note: "draft + rewrite" },
  { id: "extraction", label: "Extraction", note: "JSON + classify" },
];

function runtimeFor(platform: Platform) {
  if (platform === "apple") return "MLX · preview";
  return "llama.cpp · preview";
}

export function ArenaApp() {
  const [platform, setPlatform] = useState<Platform>("nvidia");
  const [memory, setMemory] = useState(24);
  const [task, setTask] = useState<Task>("coding");
  const [priority, setPriority] = useState<Priority>("balanced");
  const [showResults, setShowResults] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const rankings = useMemo(() => {
    const usableMemory = platform === "cpu" ? memory * 0.72 : memory * 0.86;
    return catalog
      .filter((model) => model.footprint <= usableMemory)
      .map((model) => {
        const contextScore = Math.min(model.context, 64) / 64 * 100;
        const speedScore = Math.min(model.speed * (24 / Math.max(memory, 4)) ** 0.18, 100);
        const qualityScore = model.scores[task];
        const weights: Record<Priority, [number, number, number]> = {
          balanced: [0.54, 0.28, 0.18],
          quality: [0.74, 0.14, 0.12],
          speed: [0.38, 0.5, 0.12],
          context: [0.42, 0.14, 0.44],
        };
        const [qualityWeight, speedWeight, contextWeight] = weights[priority];
        return { ...model, resultScore: qualityScore * qualityWeight + speedScore * speedWeight + contextScore * contextWeight, predictedSpeed: Math.max(3, Math.round(model.speed * (24 / Math.max(memory, 4)) ** 0.16 * (platform === "cpu" ? 0.18 : platform === "apple" ? 0.72 : platform === "amd" ? 0.82 : 1))) };
      })
      .sort((a, b) => b.resultScore - a.resultScore)
      .slice(0, 5);
  }, [memory, platform, priority, task]);

  function revealResults(event: React.FormEvent) {
    event.preventDefault();
    setShowResults(true);
    window.setTimeout(() => document.querySelector("#results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  }

  return (
    <main>
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="Local Arena home"><span>LA</span><b>LOCAL ARENA</b></a>
        <div className="top-status"><i /> PUBLIC PROTOTYPE · SEED DATA</div>
        <nav aria-label="Primary navigation"><a href="#finder">Finder</a><a href="#method">Method</a><a href="#arena">Arena</a></nav>
      </header>

      <section className="hero" id="top">
        <Image className="atlas-art" src="/local-arena-atlas.png" alt="An original orbital atlas of model and hardware configurations" fill priority sizes="100vw" />
        <div className="hero-shade" />
        <div className="hero-copy">
          <span className="overline">THE LOCAL MODEL FIELD GUIDE</span>
          <h1>Find what<br /><em>runs here.</em></h1>
          <p>A rough top five for your machine and your work—before you download a single model.</p>
          <a href="#finder" className="quiet-link">configure this machine <span>↓</span></a>
        </div>
        <div className="hero-caption"><span>01 / MAP</span><p>Hardware × artifact × runtime × task</p></div>
      </section>

      <section className="finder" id="finder">
        <div className="section-intro">
          <span className="overline">01 / ROUGH LEADERBOARD</span>
          <h2>What are you<br />working with?</h2>
          <p>No account. No runner. No telemetry. Start with an estimate, then choose whether to verify it.</p>
        </div>
        <form className="config-panel" onSubmit={revealResults}>
          <fieldset><legend>01 · ACCELERATOR</legend><div className="choice-grid platform-grid">
            {(Object.keys(platformLabels) as Platform[]).map((item) => <button type="button" key={item} className={platform === item ? "active" : ""} onClick={() => { setPlatform(item); setShowResults(false); }}>{platformLabels[item]}<small>{item === "apple" ? "unified memory" : item === "cpu" ? "system RAM" : "dedicated VRAM"}</small></button>)}
          </div></fieldset>
          <fieldset><legend>02 · AVAILABLE {platform === "apple" || platform === "cpu" ? "MEMORY" : "VRAM"}</legend><div className="memory-row">
            {[4, 8, 12, 16, 24, 32, 64, 128].map((size) => <button type="button" key={size} className={memory === size ? "active" : ""} onClick={() => { setMemory(size); setShowResults(false); }}>{size}<small>GB</small></button>)}
          </div></fieldset>
          <fieldset><legend>03 · PRIMARY TASK</legend><div className="choice-grid task-grid">
            {tasks.map((item) => <button type="button" key={item.id} className={task === item.id ? "active" : ""} onClick={() => { setTask(item.id); setShowResults(false); }}>{item.label}<small>{item.note}</small></button>)}
          </div></fieldset>
          <fieldset><legend>04 · OPTIMIZE FOR</legend><div className="priority-row">
            {(["balanced", "quality", "speed", "context"] as Priority[]).map((item) => <label key={item}><input type="radio" name="priority" value={item} checked={priority === item} onChange={() => { setPriority(item); setShowResults(false); }} /><span>{item}</span></label>)}
          </div></fieldset>
          <button className="find-button" type="submit"><span>Generate rough top five</span><b>↗</b></button>
          <p className="form-note">Prototype catalog · illustrative fit and speed estimates · no production claims</p>
        </form>
      </section>

      {showResults && <section className="results" id="results" aria-live="polite">
        <div className="results-header"><div><span className="overline">ESTIMATED · LOW CONFIDENCE</span><h2>Your rough top five.</h2></div><div className="machine-summary"><span>THIS CONFIGURATION</span><strong>{platformLabels[platform]} · {memory} GB</strong><small>{tasks.find((item) => item.id === task)?.label} · {priority}</small></div></div>
        <div className="result-table">
          <div className="result-labels"><span>RANK / ARTIFACT</span><span>EST. FIT</span><span>EST. SPEED</span><span>CONTEXT</span><span>RUNTIME</span><span /></div>
          {rankings.map((model, index) => <article className="model-row" key={model.name}>
            <div className="model-name"><b>0{index + 1}</b><div><strong>{model.name}</strong><span>{model.quant}</span></div></div>
            <span>{model.footprint.toFixed(1)} GB</span><span>{model.predictedSpeed}–{Math.round(model.predictedSpeed * 1.22)} tok/s</span><span>up to {model.context}K</span><span>{runtimeFor(platform)}</span>
            <button onClick={() => setSelectedModel(selectedModel === model.name ? null : model.name)} aria-expanded={selectedModel === model.name} aria-controls={`evidence-${index}`}>{selectedModel === model.name ? "CLOSE" : "WHY THIS RANKS"}</button>
            {selectedModel === model.name && <div className="model-evidence" id={`evidence-${index}`}><div><b>FIT BASIS</b><p>{model.footprint.toFixed(1)} GB estimated artifact footprint stays below the {Math.round((platform === "cpu" ? .72 : .86) * 100)}% memory safety margin.</p></div><div><b>TASK BASIS</b><p>Prototype {tasks.find((item) => item.id === task)?.label.toLowerCase()} score: {model.scores[task]}/100. This is seeded data, not a published benchmark.</p></div><div><b>OPEN QUESTION</b><p>Exact speed, stability, and quality remain unverified on this configuration.</p></div></div>}
          </article>)}
        </div>
        {rankings.length < 5 && <p className="result-warning">Only {rankings.length} catalog artifacts fit the selected safety margin. We will not pad the list with configurations unlikely to load.</p>}
        <div className="evidence-strip"><div><b>WHAT THIS IS</b><p>A directional ranking from estimated fit and a seeded prototype catalog.</p></div><div><b>WHAT THIS ISN’T</b><p>A measurement on your machine or a claim that rank #1 is objectively best.</p></div><div className="planned-status"><b>RUNNER STATUS</b><p>Planned after threat modeling and an independent security review.</p></div></div>
      </section>}

      <section className="method" id="method">
        <div className="method-title"><span className="overline">02 / EVIDENCE LADDER</span><h2>Confidence is earned,<br />not implied.</h2></div>
        <div className="evidence-levels"><article><span>Ⅰ</span><h3>Estimated</h3><p>Fit calculations, public artifact metadata, and seeded evaluation evidence.</p><small>AVAILABLE NOW</small></article><article><span>Ⅱ</span><h3>Community-tested</h3><p>Observed on comparable hardware with visible sample size and uncertainty.</p><small>AS THE FLEET GROWS</small></article><article><span>Ⅲ</span><h3>Verified match</h3><p>The same artifact, runtime, settings, task, and qualifying hardware.</p><small>EXACT EVIDENCE ONLY</small></article></div>
      </section>

      <section className="arena" id="arena"><div><span className="overline">03 / THE ARENA</span><h2>Recommendations first.<br />Research second.</h2></div><div className="arena-card"><span>OPTIONAL CONTRIBUTION · PLANNED</span><p>After you get a useful answer, compare precomputed outputs or verify a model you actually want. Your vote will improve one specific hardware-and-task bucket.</p><a href="#method">Read the current decision contract <b>→</b></a></div></section>

      <footer><a className="wordmark" href="#top"><span>LA</span><b>LOCAL ARENA</b></a><p>Find what runs here.</p><div><a href="#finder">Finder</a><a href="#method">Decision policy</a><a href="mailto:hello@localarena.dev">Contact</a></div></footer>
    </main>
  );
}

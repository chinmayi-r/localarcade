import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RecommendationList } from "../app/components/finder/recommendation-list";
import { ConfigurationPanel } from "../app/components/finder/configuration-panel";
import { catalogAgeValue, recommend, recommendationCatalogMetadata } from "../lib/recommendation";
import type { RecommendationOutcome, RecommendationQuery } from "../lib/recommendation";

const query: RecommendationQuery = { hardware: { platform: "cpu", availableMemoryGb: 32 }, task: "general", desiredContextK: 16, strategy: "balanced" };

test("finder offers exact sourced accelerator selection while retaining manual entry", () => {
  const gpuQuery: RecommendationQuery = { ...query, hardware: { platform: "nvidia", availableMemoryGb: 8 } };
  const html = renderToStaticMarkup(<ConfigurationPanel query={gpuQuery} onChange={() => undefined} onSubmit={() => undefined} hasResults={false} />);
  assert.match(html, /Exact device \(recommended\)/);
  assert.match(html, /RTX 3060 Laptop/);
  assert.match(html, /Other \/ enter memory manually/);
});

test("M5 cards expose evidence badges, sources, complete settings and a local request action", () => {
  const outcome = recommend(query);
  assert.equal(outcome.kind, "unranked");
  const html = renderToStaticMarkup(<RecommendationList outcome={outcome} query={query} selectedId={outcome.items[0].candidate.id} onSelect={() => undefined} />);
  assert.match(html, /estimated/i);
  assert.match(html, /unavailable/i);
  assert.match(html, /sourced/i);
  assert.match(html, /Runtime build/);
  assert.match(html, /KV cache/);
  assert.match(html, /GPU layers/);
  assert.match(html, /Save evidence request/);
  assert.match(html, /stays in this browser/);
});

test("exact GPU card exposes independent VRAM and system RAM requirements", () => {
  const gpuQuery: RecommendationQuery = {
    hardware: { platform: "nvidia", acceleratorId: "nvidia-geforce-rtx-3060-laptop-gpu", availableMemoryGb: 6, systemMemoryGb: 16 },
    task: "general",
    desiredContextK: 16,
    strategy: "balanced",
  };
  const outcome = recommend(gpuQuery);
  assert.equal(outcome.kind, "unranked");
  const html = renderToStaticMarkup(<RecommendationList outcome={outcome} query={gpuQuery} selectedId={outcome.items[0].candidate.id} onSelect={() => undefined} />);
  assert.match(html, /GB VRAM \+ .* GB RAM/);
  assert.match(html, /Device memory required/);
  assert.match(html, /System RAM required/);
  assert.match(html, /b10061 \(5d5306bf3\)/);
});

test("Tree A outcome states have distinct rendered messages", () => {
  const base = recommend(query);
  assert.ok(base.items.length);
  const outcomes: Array<[RecommendationOutcome, RegExp]> = [
    [{ kind: "unranked", items: base.items, message: "Insufficient ordering evidence." }, /UNRANKED SHORTLIST/],
    [{ kind: "contradictory", items: base.items, message: "Requested constraints conflict." }, /CONSTRAINT CONFLICT/],
    [{ kind: "ranked", items: base.items, message: "Evidence-backed order." }, /RANKED/],
    [{ kind: "nothing-fits", items: [], message: "No fit." }, /NO SAFE MATCHES/],
    [{ kind: "no-coverage", items: [], message: "Coverage gap." }, /COVERAGE GAP — NOT YOUR MACHINE/],
  ];
  for (const [outcome, expected] of outcomes) {
    const html = renderToStaticMarkup(<RecommendationList outcome={outcome} query={query} selectedId={null} onSelect={() => undefined} />);
    assert.match(html, expected);
  }
});

test("catalog freshness is source-bearing and deterministic", () => {
  const generated = Date.parse(recommendationCatalogMetadata.lastIngestSucceededAt);
  const value = catalogAgeValue(recommendationCatalogMetadata.lastIngestSucceededAt, recommendationCatalogMetadata.sourceUrl, generated + 5 * 3_600_000);
  assert.equal(value.text, "Updated 5 hours ago");
  assert.equal(value.provenance.badge, "sourced");
  assert.ok(value.provenance.sourceUrls.length);
});

test("evidence requests are browser-local and have no network submission path", async () => {
  const source = await readFile(new URL("../app/components/finder/recommendation-list.tsx", import.meta.url), "utf8");
  assert.match(source, /window\.localStorage/);
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|sendBeacon/);
  assert.match(source, /not submitted or uploaded/i);
});

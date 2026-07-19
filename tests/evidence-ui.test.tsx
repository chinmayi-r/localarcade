import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RecommendationList } from "../app/components/finder/recommendation-list";
import { catalogAgeValue, recommend, recommendationCatalogMetadata } from "../lib/recommendation";
import type { RecommendationOutcome, RecommendationQuery } from "../lib/recommendation";

const query: RecommendationQuery = { hardware: { platform: "cpu", availableMemoryGb: 32 }, task: "general", desiredContextK: 16, strategy: "balanced" };

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

test("Tree A outcome states have distinct rendered messages", () => {
  const base = recommend(query);
  assert.ok(base.items.length);
  const outcomes: Array<[RecommendationOutcome, RegExp]> = [
    [{ kind: "unranked", items: base.items, message: "Insufficient ordering evidence." }, /UNRANKED SHORTLIST/],
    [{ kind: "contradictory", items: base.items, message: "Requested constraints conflict." }, /CONSTRAINT CONFLICT/],
    [{ kind: "ranked", items: base.items, message: "Evidence-backed order." }, /RANKED/],
    [{ kind: "nothing-fits", items: [], message: "No fit." }, /NO SAFE MATCHES/],
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

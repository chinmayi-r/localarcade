import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QuickTestStatus } from "../app/components/quick-test/localhost-quick-test";

test("unreachable localhost state is explicit and does not claim a measurement", () => {
  const html = renderToStaticMarkup(<QuickTestStatus state={{ kind: "error", message: "Check CORS and the server." }} />);
  assert.match(html, /LOCAL ENDPOINT UNREACHABLE/);
  assert.match(html, /No measurement was recorded/);
  assert.match(html, /Check CORS and the server/);
});

test("idle state states the explicit-action and in-memory boundary", () => {
  const html = renderToStaticMarkup(<QuickTestStatus state={{ kind: "idle" }} />);
  assert.match(html, /No requests have been made/);
  assert.match(html, /consent action/i);
  assert.match(html, /remain in memory/i);
});

test("M7 browser client has no Local Arcade proxy or persistence path", async () => {
  const component = await readFile(new URL("../app/components/quick-test/localhost-quick-test.tsx", import.meta.url), "utf8");
  const runner = await readFile(new URL("../lib/quick-test/run.ts", import.meta.url), "utf8");
  assert.match(component, /runQuickTest\(configuration\)/);
  assert.match(runner, /fetchImpl\(endpoint/);
  assert.doesNotMatch(component + runner, /\/api\/quick|localStorage|sessionStorage|sendBeacon|XMLHttpRequest/);
  assert.match(component, /does not proxy, receive, or upload/i);
});

test("every measured result number is accompanied by an evidence badge", async () => {
  const source = await readFile(new URL("../app/components/quick-test/localhost-quick-test.tsx", import.meta.url), "utf8");
  assert.match(source, /averageTaskDurationMs[\s\S]*EvidenceBadge label="measured"/);
  assert.match(source, /result\.durationMs[\s\S]*EvidenceBadge label="measured"/);
  assert.match(source, /passedTasks[\s\S]*EvidenceBadge label="measured"/);
  assert.match(source, /hardwareDescription[\s\S]*EvidenceBadge label="self-reported"/);
});

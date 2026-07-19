import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("M6 scheduled refresh is pinned, review-gated and wired to the build", async () => {
  const workflow = await readFile(new URL("../.github/workflows/registry-refresh.yml", import.meta.url), "utf8");
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const candidates = await readFile(new URL("../lib/recommendation/catalog/real-candidates.ts", import.meta.url), "utf8");
  assert.match(workflow, /cron: "17 5 \* \* 1,4"/);
  assert.match(workflow, /npm run discover/);
  assert.match(workflow, /npm run ingest/);
  assert.match(workflow, /gh pr create/);
  assert.doesNotMatch(workflow, /uses:\s*[^\s]+@v\d/);
  for (const use of workflow.matchAll(/uses:\s*[^@\s]+@([^\s]+)/g)) assert.match(use[1], /^[a-f0-9]{40}$/, use[0]);
  assert.match(packageJson.scripts.build, /registry:freshness/);
  assert.match(candidates, /isRecommendableArtifact/);
});

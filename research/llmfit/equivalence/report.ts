import scenariosJson from "./fixtures/scenarios.json";
import { compareFitScenario } from "./harness";
import type { EquivalenceScenario } from "./types";

const results = (scenariosJson as EquivalenceScenario[]).map(compareFitScenario);

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
} else {
  process.stdout.write("M-B non-production fit equivalence corpus\n\n");
  for (const result of results) {
    const local = result.local
      ? `upstream=${String(result.upstream.fits)}/${String(result.upstream.requiredBytes)} local=${result.local.fits}/${result.local.requiredBytes}`
      : "no lossless Local Arcade invocation";
    process.stdout.write(`${result.outcome.toUpperCase().padEnd(15)} ${result.scenarioId}\n  ${local}\n`);
    for (const reason of result.reasons) process.stdout.write(`  - ${reason}\n`);
  }
}

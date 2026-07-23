import { loadCapabilityManifest, summarizeCapabilities, validateCapabilityManifest } from "./manifest";

const manifest = await loadCapabilityManifest();
const issues = await validateCapabilityManifest(manifest);
if (issues.length) {
  console.error("Capability proof manifest is invalid:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify({ productBoundary: manifest.productBoundary, capabilities: summarizeCapabilities(manifest) }, null, 2)}\n`);
} else {
  const mark = { passed: "PASS", partial: "PART", missing: "MISS", deferred: "DEFR", "not-applicable": " N/A" };
  console.log("Local Arcade capability handoff board");
  console.log("A green core is not a green subsystem.");
  console.log("");
  console.log("HANDLES");
  for (const item of manifest.productBoundary.handles) console.log(`  + ${item}`);
  console.log("DOES NOT HANDLE");
  for (const item of manifest.productBoundary.doesNotHandle) console.log(`  - ${item}`);
  console.log("");
  console.log("CAPABILITY                                 REF   CORE  BOUND HANDOFF USER");
  for (const capability of manifest.capabilities) {
    const name = capability.name.padEnd(42).slice(0, 42);
    console.log(
      `${name} ${capability.architectureRef.padEnd(5)} ${mark[capability.gates.core.status]} ` +
      `${mark[capability.gates.boundary.status]} ${mark[capability.gates.handoff.status]} ` +
      `${mark[capability.gates.userDemo.status]}`,
    );
  }
  console.log("");
  console.log("GAPS BLOCKING A REAL HANDOFF OR USER DEMONSTRATION");
  for (const capability of manifest.capabilities) {
    const gaps = Object.entries(capability.gates)
      .filter(([, gate]) => gate.status === "partial" || gate.status === "missing")
      .map(([gateName, gate]) => `${gateName}: ${gate.gap}`);
    if (!gaps.length) continue;
    console.log(`  ${capability.name} (${capability.architectureRef})`);
    for (const gap of gaps) console.log(`    - ${gap}`);
  }
}

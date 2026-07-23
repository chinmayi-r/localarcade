import { buildInterfaceProofReport } from "./report";

const report = await buildInterfaceProofReport();
const json = process.argv.includes("--json");

if (json) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  console.log("Local Arcade interface proof meeting");
  console.log("Production behavior changed: no");
  console.log("");
  console.log(`Boundary: ${report.rankingCurrent.boundary}`);
  console.log(`Required input: ${report.rankingCurrent.requiredInputs.join(", ")}`);
  for (const proof of report.rankingCurrent.cases) {
    console.log("");
    console.log(`CASE ${proof.name}`);
    console.log(`  input  ${JSON.stringify(proof.input)}`);
    console.log(`  output ${JSON.stringify(proof.output)}`);
    for (const assertion of proof.assertions) {
      console.log(`  [${assertion.status === "pass" ? "PASS" : "GAP"}] ${assertion.claim}`);
      console.log(`         ${assertion.evidence}`);
    }
  }
  console.log("");
  console.log("CURRENT BOUNDARY GAPS");
  for (const gap of report.rankingCurrent.boundaryGaps) {
    console.log(`  [GAP] ${gap.claim}`);
    console.log(`        ${gap.evidence}`);
  }
  console.log("");
  console.log(`Research comparison fixture: ${report.rankingResearchComparison.fixture}`);
  console.log(`Research comparison input: ${JSON.stringify(report.rankingResearchComparison.inputSummary)}`);
  console.log(`Research comparison output: ${JSON.stringify(report.rankingResearchComparison.output, null, 2)}`);
}

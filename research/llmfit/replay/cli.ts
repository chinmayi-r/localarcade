import { reportFromRetainedCapture } from "./bridge";

const report = await reportFromRetainedCapture();
const json = process.argv.includes("--json");

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("llmfit captured-replay proof");
  console.log(`integrity: ${report.integrity.status}`);
  console.log(
    `raw candidates: ${report.capture?.candidateCount ?? "not inspected"}`,
  );
  console.log(`normalization: ${report.normalization.status}`);
  console.log(`normalization invoked: ${report.normalization.invoked}`);
  for (const blocker of report.normalization.blockers) {
    console.log(`- ${blocker.field}: ${blocker.reasonCode}`);
  }
  console.log(report.conclusion);
}


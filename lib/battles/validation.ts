import type { BattlePair, Vote } from "./types";

const battleKinds = new Set(["response", "experience"]);
const voteChoices = new Set(["a", "b", "tie", "both-bad"]);
const voterClasses = new Set(["prompter", "third-party"]);
const voteIntegrities = new Set(["accepted", "excluded"]);
const promptSources = new Set(["curated", "own-prompt"]);

/** Fail closed: an empty issue list is the only publishable state. */
export function validateBattlePair(pair: BattlePair): string[] {
  const issues: string[] = [];
  if (!pair.id) issues.push("pair id is required");
  if (!pair.bucketId) issues.push("bucket id is required");
  if (!battleKinds.has(pair.kind)) issues.push(`unknown battle kind: ${String(pair.kind)}`);
  if (!promptSources.has(pair.promptSource)) issues.push(`unknown prompt source: ${String(pair.promptSource)}`);
  if (!pair.promptId) issues.push("prompt id is required");
  for (const [label, side] of [["a", pair.a], ["b", pair.b]] as const) {
    if (!side?.configurationId) issues.push(`side ${label}: configuration id is required`);
    if (!side?.outputRef) issues.push(`side ${label}: output ref is required`);
    if (!side?.generation?.engineBuild) issues.push(`side ${label}: engine build is required`);
    if (side?.generation?.completed !== true) issues.push(`side ${label}: generation is not complete — a DNF is a stability result, not a battle (D2X)`);
  }
  if (pair.a?.configurationId && pair.a.configurationId === pair.b?.configurationId) {
    issues.push("a pair must compare two distinct configurations");
  }
  return issues;
}

export function validateVote(vote: Vote, pairsById: Map<string, BattlePair>): string[] {
  const issues: string[] = [];
  if (!vote.id) issues.push("vote id is required");
  if (!voteChoices.has(vote.choice)) issues.push(`unknown vote choice: ${String(vote.choice)}`);
  if (!voterClasses.has(vote.voterClass)) issues.push(`unknown voter class: ${String(vote.voterClass)}`);
  if (!voteIntegrities.has(vote.integrity)) issues.push(`unknown integrity state: ${String(vote.integrity)}`);
  const pair = pairsById.get(vote.pairId);
  if (!pair) issues.push(`vote references unknown pair: ${vote.pairId}`);
  else if (pair.kind !== vote.kind) issues.push(`vote kind ${vote.kind} does not match pair kind ${pair.kind} — response and experience signals never blend`);
  return issues;
}

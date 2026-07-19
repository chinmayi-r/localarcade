import assert from "node:assert/strict";
import test from "node:test";
import { computeBucketRating, defaultRatingPolicy } from "../lib/battles";
import type { BattleKind, BattlePair, RatingPolicy, Vote, VoteChoice, VoterClass } from "../lib/battles";

const policy: RatingPolicy = { ...defaultRatingPolicy, minEffectiveVotesForLive: 4 };

function pair(id: string, aConfig: string, bConfig: string, overrides: Partial<BattlePair> = {}): BattlePair {
  return {
    id,
    bucketId: "apple-silicon/16GB",
    kind: "response",
    promptId: `prompt-${id}`,
    promptSource: "curated",
    a: { configurationId: aConfig, outputRef: `${id}-a`, generation: { engineBuild: "llama.cpp-b100", completed: true, samplingParams: { temperature: 0 } } },
    b: { configurationId: bConfig, outputRef: `${id}-b`, generation: { engineBuild: "llama.cpp-b100", completed: true, samplingParams: { temperature: 0 } } },
    ...overrides,
  };
}

function vote(id: string, pairId: string, choice: VoteChoice, voterClass: VoterClass = "prompter", overrides: Partial<Vote> = {}): Vote {
  return { id, pairId, kind: "response", choice, voterClass, integrity: "accepted", ...overrides };
}

const scope = { bucketId: "apple-silicon/16GB", kind: "response" as BattleKind };

test("hand-computed Bradley–Terry: 3-1 wins gives a strength ratio of 3", () => {
  const pairs = [pair("p1", "qwen", "gemma")];
  const votes = [vote("v1", "p1", "a"), vote("v2", "p1", "a"), vote("v3", "p1", "a"), vote("v4", "p1", "b")];
  const table = computeBucketRating(pairs, votes, scope, policy);
  assert.equal(table.status, "live");
  if (table.status !== "live") return;
  const byId = Object.fromEntries(table.entries.map((entry) => [entry.configurationId, entry]));
  // BT maximum likelihood for a single pairing reproduces the observed win rate:
  // s_qwen / (s_qwen + s_gemma) = 3/4, so the strength ratio is exactly 3.
  assert.ok(Math.abs(byId.qwen.strength / byId.gemma.strength - 3) < 1e-6);
  assert.equal(byId.qwen.weightedWins, 3);
  assert.equal(byId.qwen.weightedLosses, 1);
});

test("equal wins give equal strengths", () => {
  const pairs = [pair("p1", "qwen", "gemma")];
  const votes = [vote("v1", "p1", "a"), vote("v2", "p1", "b"), vote("v3", "p1", "a"), vote("v4", "p1", "b")];
  const table = computeBucketRating(pairs, votes, scope, policy);
  assert.equal(table.status, "live");
  if (table.status !== "live") return;
  assert.ok(Math.abs(table.entries[0].strength - table.entries[1].strength) < 1e-9);
});

test("a tie is half a win for each side: one win plus one tie gives ratio 3", () => {
  const pairs = [pair("p1", "qwen", "gemma")];
  const votes = [vote("v1", "p1", "a"), vote("v2", "p1", "tie"), vote("v3", "p1", "a"), vote("v4", "p1", "tie")];
  // Effective wins: qwen 2 + 1 = 3, gemma 0 + 1 = 1 → ratio 3.
  const table = computeBucketRating(pairs, votes, scope, policy);
  assert.equal(table.status, "live");
  if (table.status !== "live") return;
  const byId = Object.fromEntries(table.entries.map((entry) => [entry.configurationId, entry]));
  assert.ok(Math.abs(byId.qwen.strength / byId.gemma.strength - 3) < 1e-6);
  assert.equal(byId.qwen.weightedTies, 2);
  assert.equal(byId.qwen.weightedWins, 2);
});

test("voter-class weights: one prompter vote equals two third-party votes", () => {
  const pairs = [pair("p1", "qwen", "gemma")];
  const votes = [
    vote("v1", "p1", "a", "prompter"),
    vote("v2", "p1", "b", "third-party"),
    vote("v3", "p1", "b", "third-party"),
    vote("v4", "p1", "a", "prompter"),
    vote("v5", "p1", "b", "third-party"),
    vote("v6", "p1", "b", "third-party"),
  ];
  // Weighted wins: qwen 2×1.0 = 2, gemma 4×0.5 = 2 → equal strengths, and the
  // effective vote count is weighted too: 2×1.0 + 4×0.5 = 4 ≥ threshold.
  const table = computeBucketRating(pairs, votes, scope, policy);
  assert.equal(table.status, "live");
  if (table.status !== "live") return;
  assert.equal(table.effectiveVotes, 4);
  assert.ok(Math.abs(table.entries[0].strength - table.entries[1].strength) < 1e-9);
});

test("both-bad is recorded but adds no preference signal", () => {
  const pairs = [pair("p1", "qwen", "gemma")];
  const votes = [vote("v1", "p1", "a"), vote("v2", "p1", "a"), vote("v3", "p1", "a"), vote("v4", "p1", "a"), vote("v5", "p1", "both-bad")];
  const table = computeBucketRating(pairs, votes, scope, policy);
  assert.equal(table.status, "live");
  if (table.status !== "live") return;
  assert.equal(table.bothBadVotes, 1);
  assert.equal(table.effectiveVotes, 4);
});

test("D8 threshold: below the policy minimum the table is collecting, never live", () => {
  const pairs = [pair("p1", "qwen", "gemma")];
  const votes = [vote("v1", "p1", "a"), vote("v2", "p1", "b")];
  const table = computeBucketRating(pairs, votes, scope, policy);
  assert.equal(table.status, "collecting");
  if (table.status !== "collecting") return;
  assert.equal(table.effectiveVotes, 2);
  assert.equal(table.requiredVotes, 4);
  assert.ok(table.provisionalEntries.length === 2);
});

test("bucket isolation: votes from another bucket never leak in", () => {
  const pairs = [pair("p1", "qwen", "gemma"), pair("p2", "qwen", "gemma", { bucketId: "nvidia-dgpu/8-12GB" })];
  const votes = [vote("v1", "p1", "a"), vote("v2", "p2", "b"), vote("v3", "p2", "b"), vote("v4", "p2", "b")];
  const table = computeBucketRating(pairs, votes, scope, policy);
  assert.notEqual(table.status, "unavailable");
  if (table.status === "unavailable") return;
  assert.equal(table.effectiveVotes, 1);
});

test("response and experience signals never blend", () => {
  const pairs = [pair("p1", "qwen", "gemma"), pair("p2", "qwen", "gemma", { kind: "experience" })];
  const votes = [vote("v1", "p1", "a"), vote("v2", "p2", "b", "prompter", { kind: "experience" })];
  const responseTable = computeBucketRating(pairs, votes, scope, policy);
  const experienceTable = computeBucketRating(pairs, votes, { ...scope, kind: "experience" }, policy);
  assert.notEqual(responseTable.status, "unavailable");
  assert.notEqual(experienceTable.status, "unavailable");
  if (responseTable.status === "unavailable" || experienceTable.status === "unavailable") return;
  assert.equal(responseTable.effectiveVotes, 1);
  assert.equal(experienceTable.effectiveVotes, 1);
});

test("excluded votes are ignored by the rating", () => {
  const pairs = [pair("p1", "qwen", "gemma")];
  const votes = [vote("v1", "p1", "a"), vote("v2", "p1", "b", "prompter", { integrity: "excluded" })];
  const table = computeBucketRating(pairs, votes, scope, policy);
  assert.notEqual(table.status, "unavailable");
  if (table.status === "unavailable") return;
  assert.equal(table.effectiveVotes, 1);
});

test("bootstrap bands are deterministic and narrow as evidence grows", () => {
  const pairs = [pair("p1", "qwen", "gemma")];
  const few = [vote("v1", "p1", "a"), vote("v2", "p1", "a"), vote("v3", "p1", "a"), vote("v4", "p1", "b")];
  const many = Array.from({ length: 40 }, (_, index) => vote(`m${index}`, "p1", index % 4 === 3 ? "b" : "a"));
  const fewTable = computeBucketRating(pairs, few, scope, policy);
  const fewTableAgain = computeBucketRating(pairs, few, scope, policy);
  assert.deepEqual(fewTable, fewTableAgain);
  const manyTable = computeBucketRating(pairs, many, scope, policy);
  if (fewTable.status === "unavailable" || manyTable.status === "unavailable") return assert.fail("tables unexpectedly unavailable");
  const entriesOf = (table: typeof fewTable) => (table.status === "live" ? table.entries : table.status === "collecting" ? table.provisionalEntries : []);
  const fewQwen = entriesOf(fewTable).find((entry) => entry.configurationId === "qwen")!;
  const manyQwen = entriesOf(manyTable).find((entry) => entry.configurationId === "qwen")!;
  assert.ok(fewQwen.ci.lower <= fewQwen.strength && fewQwen.strength <= fewQwen.ci.upper);
  assert.ok(manyQwen.ci.upper - manyQwen.ci.lower < fewQwen.ci.upper - fewQwen.ci.lower);
});

test("no votes yields an explicit unavailable state, never an empty ranking", () => {
  const table = computeBucketRating([pair("p1", "qwen", "gemma")], [], scope, policy);
  assert.equal(table.status, "unavailable");
});

import assert from "node:assert/strict";
import test from "node:test";
import { validateBattlePair, validateVote } from "../lib/battles";
import type { BattlePair, Vote } from "../lib/battles";

function validPair(): BattlePair {
  return {
    id: "p1",
    bucketId: "apple-silicon/16GB",
    kind: "response",
    promptId: "prompt-1",
    promptSource: "curated",
    a: { configurationId: "qwen", outputRef: "p1-a", generation: { engineBuild: "llama.cpp-b100", completed: true, samplingParams: {} } },
    b: { configurationId: "gemma", outputRef: "p1-b", generation: { engineBuild: "llama.cpp-b100", completed: true, samplingParams: {} } },
  };
}

test("a valid pair produces no issues", () => {
  assert.deepEqual(validateBattlePair(validPair()), []);
});

test("a DNF generation is rejected as a battle (D2X)", () => {
  const pair = validPair();
  pair.b.generation.completed = false;
  const issues = validateBattlePair(pair);
  assert.ok(issues.some((issue) => issue.includes("stability result")));
});

test("a pair must compare two distinct configurations", () => {
  const pair = validPair();
  pair.b.configurationId = pair.a.configurationId;
  assert.ok(validateBattlePair(pair).some((issue) => issue.includes("distinct")));
});

test("unknown battle kind fails closed", () => {
  const pair = { ...validPair(), kind: "vibes" as never };
  assert.ok(validateBattlePair(pair).some((issue) => issue.includes("unknown battle kind")));
});

test("votes fail closed on unknown enums, unknown pairs, and kind mismatches", () => {
  const pairs = new Map([["p1", validPair()]]);
  const base: Vote = { id: "v1", pairId: "p1", kind: "response", choice: "a", voterClass: "prompter", integrity: "accepted" };
  assert.deepEqual(validateVote(base, pairs), []);
  assert.ok(validateVote({ ...base, choice: "meh" as never }, pairs).some((issue) => issue.includes("unknown vote choice")));
  assert.ok(validateVote({ ...base, voterClass: "bot" as never }, pairs).some((issue) => issue.includes("unknown voter class")));
  assert.ok(validateVote({ ...base, pairId: "ghost" }, pairs).some((issue) => issue.includes("unknown pair")));
  assert.ok(validateVote({ ...base, kind: "experience" }, pairs).some((issue) => issue.includes("never blend")));
});

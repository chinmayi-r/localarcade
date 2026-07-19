import type { QuickTaskId } from "./types";

export type QuickTaskDefinition = {
  id: QuickTaskId;
  label: string;
  prompt: string;
  maxTokens: number;
  score(output: string): { passed: boolean; explanation: string };
};

export const quickTaskSuite: readonly QuickTaskDefinition[] = [
  {
    id: "json-schema",
    label: "JSON structure",
    prompt: "Return only this data as one JSON object with exactly these keys and value types: project is the string Orchid, count is the number 3, and ready is the boolean true. Do not use markdown.",
    maxTokens: 60,
    score(output) {
      try {
        const value = JSON.parse(output.trim()) as unknown;
        const valid = isPlainRecord(value)
          && Object.keys(value).sort().join(",") === "count,project,ready"
          && value.project === "Orchid"
          && value.count === 3
          && value.ready === true;
        return valid
          ? { passed: true, explanation: "Valid JSON with the exact required keys, values, and types." }
          : { passed: false, explanation: "The response parsed, but it did not match the required object shape exactly." };
      } catch {
        return { passed: false, explanation: "The response was not valid standalone JSON." };
      }
    },
  },
  {
    id: "format-constraints",
    label: "Format constraints",
    prompt: "Return exactly these three lines, in this order, with no bullets, code fence, introduction, or trailing text:\nALPHA=red\nBRAVO=green\nCHARLIE=blue",
    maxTokens: 40,
    score(output) {
      const normalized = output.trim().replace(/\r\n/g, "\n");
      const passed = normalized === "ALPHA=red\nBRAVO=green\nCHARLIE=blue";
      return passed
        ? { passed: true, explanation: "All line and ordering constraints were followed exactly." }
        : { passed: false, explanation: "The response added, removed, reordered, or changed required text." };
    },
  },
  {
    id: "fact-preservation",
    label: "Fact preservation",
    prompt: "Source facts: Project Cedar launched in 2024. It has 17 contributors. Its license is Apache-2.0. Write one plain-text sentence that preserves all three facts. Do not add facts.",
    maxTokens: 60,
    score(output) {
      const text = output.trim();
      const hasFacts = /Cedar/i.test(text) && /2024/.test(text) && /17/.test(text) && /Apache-2\.0/i.test(text);
      const oneLine = text.length > 0 && !/[\r\n]/.test(text);
      return hasFacts && oneLine
        ? { passed: true, explanation: "All required facts were retained in one line." }
        : { passed: false, explanation: "At least one required fact or the one-line constraint was missing." };
    },
  },
] as const;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Persona walkthrough harness: feeds each persona's exact finder inputs
 * through the real recommendation engine and prints what they would see.
 * Run: npx tsx scripts/persona-walkthrough.ts
 * Output is a simulation aid, not evidence; nothing here is uploaded or stored.
 */
import { recommend } from "../lib/recommendation";
import type { RecommendationQuery } from "../lib/recommendation";

type Persona = {
  name: string;
  competence: string;
  intent: string;
  query: RecommendationQuery;
};

const personas: Persona[] = [
  {
    name: "Priya",
    competence: "total newcomer — heard about local AI yesterday, doesn't know what VRAM or GGUF mean",
    intent: "wants a private chatbot on her 16 GB office laptop (Intel iGPU only)",
    query: {
      hardware: { platform: "cpu", availableMemoryGb: 16 },
      task: "general",
      desiredContextK: 16,
      strategy: "balanced",
    },
  },
  {
    name: "Marcus",
    competence: "casual intermediate — LM Studio user, knows '7B Q4' folklore, doesn't know KV cache",
    intent: "wants a coding helper on his RTX 4060 Ti 8 GB gaming PC",
    query: {
      hardware: { platform: "nvidia", availableMemoryGb: 8 },
      task: "coding",
      desiredContextK: 16,
      strategy: "quality",
    },
  },
  {
    name: "Ravi",
    competence: "power user — llama.cpp + llama-swap, tunes -ngl and context, distrusts benchmarks",
    intent: "checks whether the tool knows anything he doesn't about his RTX 3060 Laptop 6 GB rig",
    query: {
      hardware: { platform: "nvidia", availableMemoryGb: 6 },
      task: "coding",
      desiredContextK: 32,
      strategy: "speed",
    },
  },
];

for (const persona of personas) {
  console.log(`\n=== ${persona.name} (${persona.competence})`);
  console.log(`    intent: ${persona.intent}`);
  console.log(`    inputs: ${JSON.stringify(persona.query)}`);
  const outcome = recommend(persona.query);
  console.log(`    outcome kind: ${outcome.kind}`);
  console.log(`    ${JSON.stringify(outcome, null, 2).split("\n").slice(0, 40).join("\n    ")}`);
}

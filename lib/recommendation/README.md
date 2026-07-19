# Recommendation engine

This folder owns recommendation behavior. UI components must call `recommend()` and must not recreate fit or ranking logic.

## Where to change things

| Change | File |
|---|---|
| Add or tune Balanced, Fastest, Quality, Long Context or Lightest sorting | `strategies.ts` |
| Add a future energy/cost strategy | `strategies.ts` and `types.ts` |
| Change memory safety margins or context-memory calculation | `eligibility/memory.ts` |
| Replace prototype artifacts with sourced records | Admit records through `lib/registry`, then add a production registry adapter |
| Change family deduplication or result count | `engine.ts` |
| Change download/run consent and safety routing | `safety-policy.mjs` |
| Change domain shapes | `types.ts` |

## Production gate

`demo-artifacts.ts` is not evidence. A production registry entry must contain immutable source revision, file hash, size, license provenance, runtime compatibility evidence, retrieval time and field-level confidence. Until then, the UI must say “prototype” and “seeded data.”

Do not add a “cheapest” strategy until cost has a defined unit. Possible future units include energy per output token, amortized hardware cost or total task latency; these are not interchangeable.

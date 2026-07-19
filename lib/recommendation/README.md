# Recommendation engine

This folder owns recommendation behavior. UI components call `recommend()` and do not recreate fit or ranking logic. The engine consumes exact registry records, explicit runtime-scoped fit profiles and product-isolated throughput priors.

Start with [`ALGORITHM.md`](ALGORITHM.md) for the full pipeline and the safest file to edit for each kind of behavior change.

## Where to change things

| Change | File |
|---|---|
| Add or tune Balanced, Fastest, Quality, Long Context or Lightest sorting | `strategies.ts` |
| Add a future energy/cost strategy | `strategies.ts` and `types.ts` |
| Change memory safety margins or context-memory calculation | `engine.ts` for policy; `lib/fit` for arithmetic |
| Add sourced configurations | Admit records through `lib/registry`, then add an explicit profile in `catalog/real-candidates.ts` |
| Change family deduplication or result count | `engine.ts` |
| Change download/run consent and safety routing | `safety-policy.mjs` |
| Change domain shapes | `types.ts` |

## Production gate

Production contains no demo catalog. Sparse coverage is intentional: a configuration enters the production candidate set only when artifact identity, fit inputs and runtime identity are explicit. Missing comparative evidence produces Tree A6X's unranked shortlist, never an invented score.

Do not add a “cheapest” strategy until cost has a defined unit. Possible future units include energy per output token, amortized hardware cost or total task latency; these are not interchangeable.

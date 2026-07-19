# Recommendation algorithm

This is the edit map for the website recommender. The pipeline is intentionally split so data, fit math, ranking policy and display evidence can change independently.

## Pipeline

1. `catalog/real-candidates.ts` joins an immutable registry artifact to one sourced runtime/fit profile. Adding a model name to the registry does **not** make it recommendable.
2. `candidate-evaluation.ts` filters by hardware kind, calls the pure `lib/fit` calculation, finds the maximum feasible context and asks `lib/priors` for a product- and engine-matched throughput range.
3. `ranking.ts` nests variants from the same family, detects unsupported ties and selects distinct top-five roles.
4. `strategies.ts` contains the user-selectable scoring formulas. A missing input returns `undefined`, which forces an unranked shortlist.
5. `engine.ts` owns the Tree A outcomes: ranked, unranked, contradictory constraints and nothing fits.
6. `presentation.ts` converts raw values to display values carrying evidence/source/configuration provenance. Components cannot accept a bare metric.

## Common edits

| Change | File |
|---|---|
| Safety margin, result count, fallback context or tie threshold | `policy.ts` |
| Balanced/quality/speed/context/lightest formula | `strategies.ts` |
| Hardware matching and fit/profile lookup | `candidate-evaluation.ts` |
| Family dedupe, tie behavior or top-five roles | `ranking.ts` |
| Outcome wording and state transitions | `engine.ts` |
| Badges, number formatting and evidence notes | `presentation.ts` |
| Admit another real configuration | `catalog/real-candidates.ts` after adding sourced profile/compatibility evidence |

Policy values are product choices. Benchmark and catalog values are evidence. Do not put observed numbers in `policy.ts` or scoring preferences in registry data.

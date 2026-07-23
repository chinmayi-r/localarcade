# Proposed module ownership boundaries

This is a review artifact, not authorization to create worktrees or implementation lanes. Ownership is proposed from `docs/modular-architecture-v2.md`, current import boundaries, passing tests, and the recovered Wave 0 discussion [O1].

## Ownership map

| Module | Owns | May depend on | Current files to preserve as inputs | Files that must move only after adapters exist | Must not own | Evidence |
|---|---|---|---|---|---|---|
| M-A | Versioned C1–C12 schemas, enums, validation, TS/Rust fixtures | none | all existing `types.ts`; Rust request/report structs | none initially—extract by compatibility tests | ranking rules, I/O, UI labels | [O1][O2] |
| M-B | llmfit invocation/FFI/subprocess translation and version pin | M-A | `docs/llmfit-core-adoption-audit.md` | selected fit internals only after equivalence | product ranking or evidence policy | [O3] |
| M-C | Artifact/model identities, discovery, admission, lifecycle, snapshots | M-A | `lib/registry/**`, `registry/**`, registry scripts/tests | candidate assembly now in recommendation | UI, fit conclusions, ranking | [O4] |
| M-D | Hardware catalog, detection adapters, memory reconciliation | M-A, M-C | `lib/accelerators/**`, `hardware.rs`, tests | accelerator selection data now imported by UI | recommendation ordering | [O5] |
| M-E | Products, engines, builds, compatibility, serving configuration | M-A, M-C | `lib/runtime/**`, runtime tests | runtime/candidate joins in `real-candidates.ts` | fit/ranking/UI | [O6] |
| M-F | Memory fit, performance envelopes, uncertainty | M-A, M-B, M-C, M-D, M-E, M-G | `lib/fit/**`, `lib/priors/**`, goldens/properties | fit evaluation now in `candidate-evaluation.ts` | evidence admission, final ranking | [O7] |
| M-G | Evidence normalization, provenance, scope, claim derivation | M-A | `lib/evidence/**`, sourced prior/profile validations | separate profile/prior schemas after contract freeze | ranking preferences, collection UI | [O8] |
| M-H | Safe shortlist/ranking/explanations from complete inputs | M-A, M-C–M-G | engine, policy, ranking, strategies, safety policy | presentation and candidate assembly | registry ingestion, hardware detection, direct UI | [O9] |
| M-I | Consent-gated read-only local model inventory | M-A, M-C, M-E | `model_store.rs`, inventory adapter and explicit selected-file hash boundary | M-O opaque scan/selection handles | benchmark execution, downloads, implicit broad hashing | [O10] |
| M-J | Preflight, fixed existing-engine protocols/process control, exact benchmark and mechanical-check observation records | M-A, M-D, M-E, M-I | preflight/benchmark plus execution protocol/process/result adapter | fixed quick-check execution only after admitted benchmark load evidence | arbitrary prompts, comparison/history, recommendation/rating/download UI; no T7 sandbox claim | [O11][O17] |
| M-K | Private Solo Arena execution plans/results/history | M-A, M-E, M-I, M-J | mechanical scorer fixtures from quick-test code | runner quick-task flow after C6/C7 freeze | public aggregation, automatic contribution | [O11][O12] |
| M-L | Public pair creation, consent/review payload, contribution lifecycle | M-A, M-C, M-E, M-K | battle validation concepts only | none before approval | rating math, silent upload | [O12] |
| M-M | Bucketed aggregation/rating/confidence | M-A, M-G, M-L | `lib/battles/**`, tests | no surface files | pair execution, identity collection | [O12] |
| M-N | Public evidence read/write service and abuse controls | M-A, M-C, M-G, M-M | no current source | no work until API/storage approval | local runner privileges | [O13] |
| M-O | Use cases, orchestration, consent sequencing, cross-module DTOs | M-A and approved domain interfaces | `lib/orchestrator/**`; process-local preview/lifecycle/execution service, server-owned fixed-plan policy and typed transport | non-authorizing preview/hash promotion plus opaque execution commands consumed by the desktop application facade | domain algorithms, low-level process mechanics or component styling | [O14][O17] |
| M-P | Website, desktop, future CLI/API adapters and presenters | M-A, M-O only | accessible form/card behavior, `runner-application.ts`, thin rendering, Forest assets | Tauri composition isolated in `runner-composition.ts`; legacy website still directly invokes recommendation | fit/ranking/evidence logic or direct store/process imports | [O14][O15][O18] |

## Conflict zones requiring single-lane ownership

| Conflict zone | Current overlap | Proposed owner | Required handoff test | Evidence |
|---|---|---|---|---|
| Shared identity/enums | TS modules and Rust structs independently define related identities | M-A | cross-language serialized fixtures for C1–C12 | [O2] |
| Candidate construction | `real-candidates.ts` imports registry JSON and fit profile while living in recommendation | M-C/M-E/M-G adapters assembled by M-O | candidate fixture accepted by M-H without imports from data stores | [O4][O6][O9] |
| Hardware choice | UI imports accelerator catalog and derives memory | M-D exposed through M-O | surface contract test proves no M-P→M-D import | [O5][O14] |
| Fit decision | candidate evaluator combines selection, fit, priors and evidence | M-F calculates; M-H decides ordering | golden equivalence across adapter split | [O7][O9] |
| Presentation | `lib/recommendation/presentation.ts` is domain-adjacent but UI-specific | M-P presenter fed by M-O DTO | badge/source type test stays compile-enforced | [O9][O15] |
| Runner IPC | Preserved legacy source names retired raw invokes; active `main.ts` imports only the M-P facade/composition root | M-O command/use-case facade consumed by `runner-application.ts` | boundary test proves raw registrations/routes absent and active UI cannot import stores/process modules | [O11][O14][O17][O18] |
| Verification execution | Legacy raw functions are preserved but no longer registered | M-O owns fixed-plan construction and one-use consent/worker/status/transport; M-J owns protocol/process/result admission; M-P validates and renders unchanged views | 80 combined Rust library, 19 M-P consumer and 11 boundary tests | [O17][O18] |
| Quick tasks | Browser M7 suite, runner M-J fixed checks and proposed M-K arbitrary Arena all overlap | M-J owns fixed verification check plans/execution/observations; M-K owns arbitrary prompts, paired streaming, comparison and history | combined benchmark→fixed-check result passes through M-O without creating C6/C7 Arena claims | [O11][O12][O17] |
| Battle vocabulary | `lib/battles` combines validation and aggregation before M-L exists | M-L owns contribution records; M-M owns rating | invalid/DNF records rejected at both boundary fixtures | [O12] |

## Recommended preservation sequence

1. Freeze or correct C1–C12 in M-A before moving ownership. Existing tests become compatibility fixtures, not obstacles to the pivot [O1][O2].
2. Wrap M-C, M-D, M-E, M-F, M-G, M-H and M-I behind interfaces while their current tests remain green [O4–O10].
3. Resolve llmfit and complete the minimum M-J adapter boundary without pretending full R4 is done [O3][O11].
4. Decide whether the first build slice needs private Arena (M-K). Public contribution/aggregation/service (M-L–M-N) remain separately gated [O12][O13].
5. Add M-O and require all surfaces to use it. Replace M-P shells only after W/D inventories and the website arrival contract are approved [O14][O15].

This sequence preserves validated, fail-closed behavior and still permits a later “nuclear” replacement of obsolete shells. Replacement should occur after contract tests prove equivalent or intentionally changed behavior, not before provenance is approved [O16].

## Evidence index

- **[O1]** `docs/modular-architecture-v2.md`; recovered session line 11962 (M-A–M-P/Wave 0 proposal).
- **[O2]** current TS type files, Rust request/report structs, `docs/system-operation-graph.md` C1–C12.
- **[O3]** `docs/llmfit-core-adoption-audit.md`; no llmfit code reference.
- **[O4]** `lib/registry/**`, registry scripts/data/tests.
- **[O5]** `lib/accelerators/**`, `hardware.rs`, `configuration-panel.tsx` import.
- **[O6]** `lib/runtime/**`, `real-candidates.ts`.
- **[O7]** `lib/fit/**`, `lib/priors/**`, `candidate-evaluation.ts`, passing fit/throughput tests.
- **[O8]** `lib/evidence/**`, evidence tests, local fit profile.
- **[O9]** `lib/recommendation/**`, recommendation tests and direct app imports.
- **[O10]** `model_store.rs`, its integration tests and read-only boundary test.
- **[O11]** runner preflight/benchmark/quick-task sources and tests; R4 status.
- **[O12]** `lib/quick-test/**`, `lib/battles/**`, recovered session line 11917 (private Arena important; public Arena optional).
- **[O13]** source inventory (no public service); draft API/design docs explicitly withhold authorization.
- **[O14]** direct import/IPC scan and absence of an orchestrator source.
- **[O15]** app/runner surface source, evidence UI/product contract tests, conflicting screen inventories.
- **[O16]** 2026-07-22 root/runner green gates and user-requested preservation-before-replacement sequence.
- **[O17]** U33–U37 decisions and `execution_{protocol,process,result_adapter,lifecycle,service,transport}.rs`;
  15 service, 5 transport and 79 combined library tests on 2026-07-23.
- **[O18]** `runner/src/runner-application.ts`,
  `runner/src/runner-composition.ts`, active/preserved desktop sources,
  `tests/runner-surface.test.ts`, runner boundary tests and local responsive
  browser inspection.

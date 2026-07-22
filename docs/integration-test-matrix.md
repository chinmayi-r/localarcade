# Integration test matrix

Observed on the preserved dirty tree, 2026-07-22. A green cell proves only the named behavior; env-gated live tests can pass without executing external binaries when their variables are absent [T1].

## Current gates

| Gate | Result | Evidence / limitation |
|---|---|---|
| Root `npm.cmd run typecheck` | pass | Current TS contracts compile [T1]. |
| Root `npm.cmd run lint` | pass | Static lint over app/lib/tests/worker/design-system [T1]. |
| Root test suite | pass, 119 tests | 94 TS/TSX + 25 MJS boundary tests [T1]. |
| Registry freshness + production build | pass | Registry reported 38 hours old; vinext build completed with only chunk-size/classification warnings [T1]. |
| Documentation UTF-8/links | pass, 51 Markdown files | `npm.cmd run docs:validate` rejects invalid UTF-8, mojibake markers, and missing relative targets [T20]. |
| Approved schema/fixtures | pass, 18 positive + 11 rejected negative | `npm.cmd run contracts:validate` compiles Draft 2020-12, checks portfolio/handoff/verification invariants, and proves invalid version/enum/required/hash/additional-field/semantic cases fail [T20]. |
| Runner typecheck/fmt/Clippy | pass | Rust Clippy uses `-D warnings` [T1]. |
| Runner Rust tests | pass, 26 tests | 17 unit + 1 benchmark live target + 7 model-store + 1 quick-task live target; live behavior env-dependent [T1]. |
| Runner Vite build | pass | Thin desktop frontend builds [T1]. |

## Current capability matrix

| Boundary / behavior | Unit / contract | Integration | Live / E2E | Current result | Gap before target architecture | Evidence |
|---|---|---|---|---|---|---|
| M-C discovery→lock→ingest→snapshot | importer, contract, generated | workflow boundary | build freshness | covered/pass | no M-C adapter contract or external API | [T2] |
| Artifact exact-file trust route | generated test | discovery/ingest scripts | none | covered/pass | review UI and service provenance not covered | [T2] |
| M-D accelerator identity→memory variants | accelerator tests | website form render | runner live detection unit | covered/pass on current paths | cross-language/common contract and non-Windows GPU detection | [T3] |
| M-D detection→registry reconciliation | Rust unit fixtures | live detection test | developer machine evidence in ledger | covered/pass | macOS/Linux adapters, multi-device orchestration | [T3] |
| M-E product→engine→build compatibility | runtime contract | candidate catalog use | none | covered/pass | installed serving-config import | [T4] |
| M-F artifact/settings→single-pool fit | golden/property/purity | recommendation engine | none | covered/pass | llmfit equivalence and adapter interface | [T5] |
| M-F exact device→VRAM+RAM fit | two-pool tests | recommendation/UI | checked-in local profile | covered/pass | evidence publication path and broader profiles | [T5] |
| M-G record→claim/scope | evidence contract/type tests | UI badges/sources | none | covered/pass | unified C3/C4/C8 and contribution normalization | [T6] |
| M-F/G scoped prior→throughput envelope | prior/boundary tests | recommendation | sourced external rows checked in | covered/pass | no service refresh/normalization adapter | [T7] |
| M-H query→coverage/no-fit/shortlist | engine goldens | website result render | empty-state E2E | covered/pass | surface still calls M-H directly; no M-O | [T8] |
| M-H exact hardware isolation | engine tests | exact UI flow | none | covered/pass | shared platform/device contracts | [T8] |
| M-P value→badge/source display | type/UI tests | recommendation cards | component render only | covered/pass | approved W-screen integration/visual regression | [T9] |
| Consent policy→benchmark availability | policy tests | runner checkbox/preflight code | no automated desktop DOM flow | partial/pass | M-O use-case test and native UI automation | [T10] |
| M-I request→read-only store scan | Rust helpers | fixture store integration | optional live home scan | covered/pass | hash-upgrade consent and M-O call | [T11] |
| M-J preflight→confirmation gate | Rust unit | benchmark/quick-task functions | no platform matrix | covered/pass for current Windows adapter | thermal and GPU load sensors; macOS/Linux | [T12] |
| M-J checked llama-bench→exact observation | parser/repeatability tests | env-gated live target | optional real binary/model | partial/pass | env not evidenced in this run; artifact hash, bundled engine, sandbox | [T12] |
| M-J quick tasks→mechanical result | scorer/parser tests | env-gated live target | optional real binary/model | partial/pass | not C6/C7 Solo Arena, no history/comparison | [T12] |
| Runner no-network/no-write/spawn boundary | source boundary tests | Cargo capability/CSP checks | none | covered/pass | sandbox enforcement and updater/download remain future | [T13] |
| M-M pair/vote→bucketed rating | validation/rating | boundary keeps app dark | none | covered/pass/dark | no M-L producer, service, abuse/revocation | [T14] |
| Retired M7 browser→loopback endpoint | endpoint/suite tests | quick-test UI render | mocked fetch | covered/pass but dormant | retire after task migration | [T15] |
| M-O use case→domain adapters | none | none | none | missing | required before any new surface integration | [T16] |
| M-K private Arena plan→execution→result/history | legacy scorer fragments | none | recovered prototype only | missing | C6/C7, local history, comparison and provenance | [T17] |
| M-L contribution consent→pair payload→revocation | battle validation only | none | prototype only | missing | complete contribution lifecycle | [T17] |
| M-N service read/write→abuse controls | none | none | none | missing | API/storage/auth/rate-limit/retention decisions | [T17] |

## Required adapter and integration tests before implementation can replace current paths

| Priority | Proposed test | Modules | Acceptance behavior | Why required | Evidence |
|---|---|---|---|---|---|
| 1 | C1–C12 cross-language fixture suite | M-A, all | TS and Rust accept/reject identical canonical JSON; enum/version drift fails | shared contract does not exist | [T16] |
| 2 | Existing fit vs M-B adapter equivalence | M-B/M-F | goldens/properties remain within explicitly approved tolerances; unsupported profiles fail closed | llmfit adoption is unresolved | [T5][T18] |
| 3 | Registry/runtime/evidence→complete candidate adapter | M-C/E/G/H | M-H receives immutable complete candidates without importing stores | current assembly is inside M-H | [T8][T16] |
| 4 | Surface import boundary | M-O/M-P | no file under `app/` or runner frontend imports/invokes M-C–M-N directly | current violations are mechanical | [T16] |
| 5 | Finder use-case contract | M-D/F/H/O/P | manual and exact hardware inputs produce honest coverage/no-fit/results and task-derived context | protects useful website slice during shell replacement | [T3][T8][T9] |
| 6 | Inventory→benchmark identity handoff | M-I/J/O | selected file hash/build/settings survive unchanged into observation | artifact binding is missing | [T11][T12] |
| 7 | Adverse/unknown preflight platform matrix | M-D/J/O | unknown telemetry never becomes “safe”; consent is scoped to one run | current sensors are partial | [T12] |
| 8 | Solo Arena execution/result/history | M-J/K/O/P | C6 plan yields C7 result with exact config, mechanical metrics and local-only history | private Arena is proposed V1 but absent | [T17] |
| 9 | Contribution review/revocation | M-K/L/N/P | default is no upload; payload preview exact; revoke/delete semantics tested | public contribution must remain separate | [T17] |
| 10 | Rating ingestion isolation | M-L/M/M-N | only validated, consented, bucket-compatible records reach M-M | dark rating core currently lacks producer boundary | [T14] |
| 11 | Website/runner product-honesty E2E | M-O/P | website never claims detection/measurement; runner distinguishes estimate/community/local measurement | explicit repository contract | [T9][T10] |
| 12 | Screen contract accessibility/responsiveness | M-P | approved W/D states, keyboard/focus/error/empty/loading, defined breakpoints | current inventories conflict and visual behavior is under-tested | [T19] |

## Tests that should survive a shell replacement

Preserve registry, accelerator, runtime, fit, evidence, throughput, recommendation, inventory, benchmark, security-boundary and battle-math tests. Rework component selectors/imports as necessary, but retain their truth assertions. Retire M7-specific UI/endpoint tests only after equivalent runner/M-K task coverage exists [T2–T15].

## Evidence index

- **[T1]** full root and runner gate output on 2026-07-22.
- **[T2]** registry/importer/generated/freshness/workflow tests and scripts.
- **[T3]** accelerator test, website configuration panel test, runner hardware source/tests.
- **[T4]** runtime contract test and runtime source.
- **[T5]** fit goldens/properties/purity/two-pool tests and local profile.
- **[T6]** evidence contract/type/UI tests.
- **[T7]** throughput prior/boundary tests.
- **[T8]** recommendation engine/policy tests and direct app import.
- **[T9]** evidence UI, empty-state and product-contract tests.
- **[T10]** safety policy tests and runner frontend/direct command flow.
- **[T11]** model-store source/integration/root boundary tests.
- **[T12]** preflight/benchmark/quick-task source and Rust tests; R4 ledger limitations.
- **[T13]** root runner-boundary test, Tauri capabilities/CSP/Cargo dependencies.
- **[T14]** battle rating/validation/boundary tests and dark flag.
- **[T15]** M7 status and quick-test source/UI tests.
- **[T16]** source import/IPC audit and absence of M-A/M-O implementations.
- **[T17]** recovered session lines 11846–11917, recovered prototypes, source inventory for M-K–M-N.
- **[T18]** llmfit adoption audit and no current code integration.
- **[T19]** conflicting interface/screen inventories and current lack of visual/native UI automation.
- **[T20]** `docs/validate-documentation.mjs` and
  `docs/contracts/validate-fixtures.mjs`, run successfully on 2026-07-22.

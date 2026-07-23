# Integration test matrix

Observed on the preserved dirty tree, 2026-07-22. A green cell proves only the named behavior; env-gated live tests can pass without executing external binaries when their variables are absent [T1].

## Current gates

| Gate | Result | Evidence / limitation |
|---|---|---|
| Root `npm.cmd run typecheck` | pass | Current TS contracts compile [T1]. |
| Root `npm.cmd run lint` | pass | Static lint over app/lib/tests/worker/design-system [T1]. |
| Root test suite | pass, 191 tests | 155 TS/TSX + 36 MJS boundary tests on the current assembled tree [T1][T21]. |
| Registry freshness + production build | pass | Registry reported 38 hours old; vinext build completed with only chunk-size/classification warnings [T1]. |
| Documentation UTF-8/links | pass, 80 Markdown files | `npm.cmd run docs:validate` rejects invalid UTF-8, mojibake markers, and missing relative targets [T20][T22]. |
| Approved schema/fixtures | pass, 20 positive + 12 rejected schema negatives + 12 semantic negatives | `npm.cmd run contracts:validate` compiles Draft 2020-12, checks portfolio/handoff/import/verification/admission invariants, and proves invalid version/enum/required/hash/additional-field/semantic cases fail [T20]. |
| Runner typecheck/fmt/Clippy | pass | Rust Clippy uses `-D warnings` [T1]. |
| Runner Rust library tests | pass, 80 tests in latest targeted pass | Includes service, transport, protocol, result, lifecycle, process, preview, explicit inventory hash promotion and preserved cores [T1][T21][T25]. |
| Runner Vite build | pass | Thin desktop frontend builds [T1]. |
| U33–U37 execution service fixtures | pass, 15 tests | Includes genuine M-J preparation reachability, benchmark→fixed-check order, quick-only block, sampler preservation, stop during checks, malformed-later prefix preservation for both benchmark and quick checks, terminal stop idempotence, replay/cross-ID/backend mismatch/malformed output/one-active-run; fake `ProcessRunner`, not a live model [T25]. |
| Typed execution transport fixtures | pass, 4 tests | All acknowledgements required, caller execution facts rejected at deserialization, forged preview handles grant nothing, and stale/restart-lost references fail closed [T25]. |
| Combined Rust library execution slice | pass, 80 tests | Includes protocol, result adapter, lifecycle, service, transport, suspended Windows launcher, canonical path guard, Job Object assignment, bounded output and cancellation [T25]. |

## Current capability matrix

| Boundary / behavior | Unit / contract | Integration | Live / E2E | Current result | Gap before target architecture | Evidence |
|---|---|---|---|---|---|---|
| M-A v1 JSON/envelope/handoff/admission/import boundary | TS/Rust DTO, schema and semantic validation | same 20 positive/12 schema-negative corpus plus 12 semantic mutations | none required | covered/pass | U28 bundle keeps handoff v1 unchanged and hashes the exact receipt; integrity is not authenticity | [T21] |
| U30 task→context→complete request | 12 direct/composition tests plus one purity proof | none | none | boundary/pass | numeric v1 mappings are reviewable implementation heuristics, not measured defaults | [T24] |
| U29 fresh/expired/tampered import | 10 behavior/adversarial tests plus one purity proof | none | none | boundary/pass | expiry is informational; expired import needs confirmation and never grants execution | [T24] |
| M-O permission preview and M-I inventory selection | 11 TypeScript behavior/adversarial tests plus one purity proof; Rust preview tests | seven process-local preview commands plus typed M-P desktop consumer | deterministic desktop surface and browser inspection | boundary/pass; handoff/partial; user/partial | exact statuses preserved; only intact exact verified identity proceeds; no native external-model chain | [T24][T26] |
| M-O verification-plan preview | 14 TypeScript prerequisite/output/adversarial tests plus one purity proof; 5 Rust unit, 3 Rust integration, 12 U31, 6 U32 and 20 M-J focused tests | process-local U31/U32/M-I/M-J Rust adapter, preview/execution IPC and typed M-P facade | deterministic D1–D6 desktop surface; no native external-model run | boundary/pass; handoff/partial; user/partial | preview remains non-authorizing; fixture/process proofs and browser inspection do not prove a live model | [T24][T25][T26] |
| M-C discovery→lock→ingest→snapshot | importer, contract, generated | workflow boundary | build freshness | covered/pass | no M-C adapter contract or external API | [T2] |
| Artifact exact-file trust route | generated test | discovery/ingest scripts | none | covered/pass | review UI and service provenance not covered | [T2] |
| M-D accelerator identity→memory variants | accelerator tests | website form render | runner live detection unit | covered/pass on current paths | cross-language/common contract and non-Windows GPU detection | [T3] |
| M-D detection→registry reconciliation | Rust unit fixtures | live detection test | developer machine evidence in ledger | covered/pass | macOS/Linux adapters, multi-device orchestration | [T3] |
| M-E product→engine→build compatibility | runtime contract | candidate catalog use | none | covered/pass | installed serving-config import | [T4] |
| M-F artifact/settings→single-pool fit | golden/property/purity | recommendation engine | none | covered/pass | llmfit equivalence and adapter interface | [T5] |
| M-F exact device→VRAM+RAM fit | two-pool tests | recommendation/UI | checked-in local profile | covered/pass | evidence publication path and broader profiles | [T5] |
| M-G record→claim/scope | evidence contract/type tests | UI badges/sources | none | covered/pass | unified C3/C4/C8 and contribution normalization | [T6] |
| M-F/G scoped prior→throughput envelope | prior/boundary tests | recommendation | sourced external rows checked in | covered/pass | no service refresh/normalization adapter | [T7] |
| M-H exhaustive universe→coverage/no-fit/unranked portfolio | 23 isolated behavior tests plus one purity/import proof | legacy website result render only | legacy empty-state E2E | boundary/pass; handoff/partial | new boundary is synthetic and surface still calls the legacy engine directly; no M-O or real U27 input | [T8][T23] |
| M-H exact identity and producer-content isolation | post-admission M-E/M-F mutation, snapshot, hardware, evidence and familiarity binding tests | exact legacy UI flow only | none | boundary/pass | process-local brand is not a wire receipt; M-O must compose plain DTOs immediately | [T23] |
| M-P value→badge/source display | type/UI tests | recommendation cards | component render only | covered/pass | approved W-screen integration/visual regression | [T9] |
| M-P typed desktop D1–D6 flow | 19 deterministic application-facade tests; 11 runner boundary tests | exact approved import bytes plus M-O preview/start/status/stop/result commands through a separate composition root; full result DTO and planned-set admission | local visual inspection at desktop and 390 px; no native external-model run | core/pass; boundary/pass; handoff/pass with fixtures; user/partial | website remains legacy, CLI absent, the approved import fixture has no proven live artifact/tool execution path, restart recovery absent | [T25] |
| Consent policy→benchmark availability | policy tests | runner checkbox/preflight code | no automated desktop DOM flow | partial/pass | M-O use-case test and native UI automation | [T10] |
| M-I request→read-only store scan | Rust helpers | fixture store integration plus M-O exact-path selection and explicit one-file hash promotion | optional live home scan | covered/pass; handoff/partial | native user walkthrough for partial/ambiguous states; strong non-Windows selected-file guard | [T11] |
| M-J preflight→confirmation gate | Rust unit plus process-local U31/preview integration | locally sampled preview preflight | no platform matrix | covered/pass for current Windows preview | thermal and GPU load sensors; strong non-Windows identity guard | [T12] |
| M-J checked llama-bench→exact observation | parser/repeatability tests | env-gated live target | optional real binary/model | partial/pass | env not evidenced in this run; artifact hash, bundled engine, sandbox | [T12] |
| U33–U37 prepared verification → bounded benchmark → fixed checks → terminal result | 15 fake-runner service tests; 79 combined Rust library tests | opaque typed process-local start/status/stop/result transport, including idempotent terminal stop | not run | boundary/pass; handoff/partial | frontend and restart recovery absent; quick-only blocked; no live model claim; Job Object is lifecycle control rather than T7 isolation | [T25] |
| M-J fixed quick tasks→mechanical result | protocol/parser/scorer and combined service tests | runs only after admitted benchmark load receipt | optional real binary/model not evidenced | boundary/pass; live/partial | not C6/C7 Solo Arena, no arbitrary prompt, history or comparison; pinned llama-cli fixture missing | [T12][T25] |
| Runner no-network/no-write/spawn boundary | source boundary tests | Cargo capability/CSP checks | none | covered/pass | sandbox enforcement and updater/download remain future | [T13] |
| M-M pair/vote→bucketed rating | validation/rating | boundary keeps app dark | none | covered/pass/dark | no M-L producer, service, abuse/revocation | [T14] |
| Retired M7 browser→loopback endpoint | endpoint/suite tests | quick-test UI render | mocked fetch | covered/pass but dormant | retire after task migration | [T15] |
| M-O finder→M-H→detail→v1 handoff→U28 bundle | 16 synthetic behavior tests plus purity proof | typed runner execution transport exists separately; no frontend wiring | none | boundary/partial | U27 blocks real data and no production consumer joins the finder and runner paths | [T16][T24][T25] |
| M-K private Arena plan→execution→result/history | legacy scorer fragments | none | recovered prototype only | missing | C6/C7, local history, comparison and provenance | [T17] |
| M-L contribution consent→pair payload→revocation | battle validation only | none | prototype only | missing | complete contribution lifecycle | [T17] |
| M-N service read/write→abuse controls | none | none | none | missing | API/storage/auth/rate-limit/retention decisions | [T17] |

## Required adapter and integration tests before implementation can replace current paths

| Priority | Proposed test | Modules | Acceptance behavior | Why required | Evidence |
|---|---|---|---|---|---|
| 1 | C1–C12 cross-language fixture suite | M-A, all | TS and Rust accept/reject identical canonical JSON; enum/version drift fails | shared contract does not exist | [T16] |
| 2 | Existing fit vs M-B adapter equivalence | M-B/M-F | goldens/properties remain within explicitly approved tolerances; unsupported profiles fail closed | llmfit adoption is unresolved | [T5][T18] |
| 3 | Registry/runtime/evidence→complete candidate adapter | M-C/E/G/H | M-H receives immutable complete candidates without importing stores | current assembly is inside M-H | [T8][T16] |
| 3a | Consensus sanity benchmark | M-B–M-H research | sourced consensus candidates are considered or receive machine-readable scoped exclusion reasons; unsafe candidates never pass | catches inexplicable divergence without treating consensus as truth | [T22] |
| 3b | Measured audition comparison | M-B–M-H research | llmfit/current/constraint/Pareto/diversity baselines receive equivalent inputs and report calibration, regret, justified disagreement and test cost separately | Local Arcade's claimed improvement is unproven | [T22] |
| 4 | Surface import boundary | M-O/M-P | no file under `app/` or runner frontend imports/invokes M-C–M-N directly | current violations are mechanical | [T16] |
| 5 | Finder use-case contract | M-D/F/H/O/P | manual and exact hardware inputs produce honest coverage/no-fit/results and task-derived context | protects useful website slice during shell replacement | [T3][T8][T9] |
| 6 | Inventory→verification preview identity handoff | M-I/J/O | selected file hash/build/settings survive unchanged into non-authorizing plan preview | preview and typed combined execution are fixture-covered; frontend, restart recovery, pinned live proof and T7 isolation remain gated | [T11][T12][T24][T25] |
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
- **[T25]** 2026-07-23 `execution_service` (12), `execution_transport` (4) and combined Rust `--lib` (73) output; `runner/src-tauri/src/{execution_lifecycle,execution_protocol,execution_process,execution_result_adapter,execution_service,execution_transport}.rs`; root invoke-boundary assertions.
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
- **[T23]** `research/mh-portfolio/portfolio.test.ts`,
  `research/mh-portfolio/boundary.test.mjs` and `npm.cmd run proof:mh`.
- **[T24]** `lib/orchestrator/**`,
  `research/mo-orchestration/orchestration.test.ts`,
  `research/mo-orchestration/boundary.test.mjs` and `npm.cmd run proof:mo`.
- **[T14]** battle rating/validation/boundary tests and dark flag.
- **[T15]** M7 status and quick-test source/UI tests.
- **[T16]** source import/IPC audit, approved M-A contracts and the process-local
  M-O preview facade; production surfaces still bypass M-O.
- **[T17]** recovered session lines 11846–11917, recovered prototypes, source inventory for M-K–M-N.
- **[T18]** llmfit adoption audit and no current code integration.
- **[T19]** conflicting interface/screen inventories and current lack of visual/native UI automation.
- **[T20]** `docs/validate-documentation.mjs` and
  `docs/contracts/validate-fixtures.mjs`, run successfully on 2026-07-22.
- **[T21]** `lib/contracts/**`, `runner/src-tauri/src/contracts.rs`,
  `tests/contracts-*`, `runner/src-tauri/tests/contracts_v1.rs`, and the final
  M-A root/runner gates on 2026-07-22.
- **[T22]** `docs/ranking-and-audition-research-plan.md`, the current llmfit
  repository, Anubis repository/live analysis, and cited ranking research.

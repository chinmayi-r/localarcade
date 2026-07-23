# M-A–M-P module status and file classification

Audit date: 2026-07-22. “Module” means the proposed target in `docs/modular-architecture-v2.md`; it does not imply current conformance [S1]. Dispositions are recommendations only. Nothing was retired or removed.

## Module summary

| Module | Proposed responsibility | Current implementation | Status / recommendation | Evidence |
|---|---|---|---|---|
| M-A | Shared first-slice v1 contracts | Approved DTOs, envelopes, canonical handoff serialization and validation now exist in isolated TypeScript and Rust packages; legacy hardware/recommendation mappings are explicit and fail closed | complete for the approved first slice; preserve legacy types behind adapters until their owning module checkpoints | [S1][S2][S18] |
| M-B | llmfit core adapter | No code imports llmfit | missing; decide integration and licensing first | [S3] |
| M-C | Model/artifact registry | Strong registry discovery/import/snapshot/freshness implementation | reuse behind an M-C interface; generated data remains generated | [S4] |
| M-D | Hardware inventory/reconciliation | Sourced accelerator catalog, Windows runner detection, M-A target adapter and sealed U31 material-fact confirmation | preserve fail-closed adapters; add non-Windows implementations and remove UI coupling | [S5] |
| M-E | Runtime/build compatibility | Runtime catalog plus recommendation-owned real candidate assembly | revise boundaries; preserve validation/compatibility | [S6] |
| M-F | Fit and performance estimation | Pure memory fit, two-pool fit, scoped priors | reuse behind adapter; compare/replace internals with llmfit only after equivalence tests | [S7] |
| M-G | Evidence normalization/provenance | Strong scoped evidence types/validation; fit profile is separately shaped JSON | reuse core; proposed shared evidence shape remains in review | [S8] |
| M-H | Compatibility-only recommendation portfolio | New isolated exhaustive-universe boundary plus tested legacy ranker | use `lib/portfolio/` for the approved first slice; preserve legacy behavior until M-O/surfaces replace it | [S9][S19] |
| M-I | Local model inventory | Read-only runner model-store scan plus exact registry/inventory adapter, process-local verified selection and explicit one-file hash promotion for a retained size candidate | preserve behind M-O; keep broad/implicit hashing prohibited | [S10] |
| M-J | Benchmarking/verification | Existing-engine preparation plus fixed benchmark and quick-check protocols, guarded process boundary, official load admission and exact mechanical observations | combined producer proven with fixtures; quick-only remains blocked; pinned live tool/model evidence, T7 sandbox and trustworthy telemetry remain missing | [S11][S21] |
| M-K | Solo Arena execution/results | No general execution plan/result or private Arena history | missing; quick-task scorers are reusable mechanics only | [S11][S12] |
| M-L | Public pair/contribution intake | No pair-generation, consent payload, revocation, or service | missing; battle validation is only a possible downstream core | [S12] |
| M-M | Aggregation/rating | Dark validated pairs/votes and bucketed Bradley–Terry | reuse behind adapter; no surface until M-L and approval | [S12] |
| M-N | Public evidence service | No public service/API/storage | missing | [S1][S13] |
| M-O | Application orchestrator | Prior pure/preview boundaries plus one-use execution transport, explicit inventory hash promotion and server-owned fixed-plan construction; typed desktop facade consumes it while the website remains legacy | preserve service/transport; migrate other surfaces only through separately reviewed checkpoints | [S13][S20][S21][S22] |
| M-P | Surface adapters | Legacy website plus typed D1–D6 Tauri desktop workflow with fail-closed producer DTO/lifecycle/result admission; CLI absent | preserve desktop facade; migrate website only after real M-O portfolio and add CLI in a separate checkpoint | [S13][S14][S22] |

## Production source files

Coverage abbreviations refer to the exact tests in the following section. `Gates` means typecheck/lint/build plus applicable boundary tests passed [S14].

| File | Module | Current behavior | Coverage | Disposition | Evidence |
|---|---|---|---|---|---|
| `build/sites-vite-plugin.ts` | M-P deployment adapter | Private Sites/Vite build integration | root build | reuse unchanged | [S15] |
| `design-system/colors.css` | M-P shared tokens | Authoritative Forest palette variables | lint/build via consumers; visual untested | reuse unchanged | [S15] |
| `app/arena-app.tsx` | M-P (direct M-H) | Owns finder submission/result shell and calls `recommend()` | E2E, UI, product | revise | [S13][S14] |
| `app/chatgpt-auth.ts` | M-P | Reads optional host auth context without domain logic | typecheck/build | reuse unchanged | [S15] |
| `app/components/finder/configuration-panel.tsx` | M-P (direct M-D/M-H) | Hardware/task form with exact accelerator and manual memory | evidence UI | revise behind M-O | [S13][S14] |
| `app/components/finder/recommendation-list.tsx` | M-P (direct M-H) | Renders outcomes and provenance-bearing cards | evidence UI, empty state | revise behind M-O; preserve display semantics | [S14] |
| `app/components/quick-test/localhost-quick-test.tsx` | M-P, retired | Dormant browser localhost task surface | quick-test UI | retire after runner migration | [S16] |
| `app/globals.css` | M-P | Forest-themed responsive website styling/motif | lint/build; visual untested | revise with approved screen contract | [S15] |
| `app/layout.tsx` | M-P | Root metadata/layout | build | reuse/revise with approved naming | [S15] |
| `app/page.tsx` | M-P | Mounts the current arena/finder app | build/E2E | revise after W-screen freeze | [S15] |
| `lib/accelerators/catalog.ts` | M-D | Sourced exact accelerator catalog | accelerator registry | reuse behind adapter | [S5] |
| `lib/accelerators/index.ts` | M-D | Public accelerator exports | accelerator registry/typecheck | revise as adapter export | [S5] |
| `lib/accelerators/lookup.ts` | M-D | Exact lookup and memory-variant derivation | accelerator registry | reuse unchanged internally | [S5] |
| `lib/accelerators/types.ts` | M-A/M-D | Accelerator identity/provenance types | accelerator/typecheck | revise into shared contract | [S2][S5] |
| `lib/accelerators/validation.ts` | M-D | Fail-closed catalog validation | accelerator registry | reuse unchanged | [S5] |
| `lib/contracts/types.ts` | M-A | Approved first-slice v1 DTOs and envelopes | shared corpus/typecheck | reuse unchanged as the v1 TypeScript wire authority | [S18] |
| `lib/contracts/canonical.ts` | M-A | Deterministic canonical JSON and handoff SHA-256 | contract corpus | reuse unchanged | [S18] |
| `lib/contracts/validator.ts` | M-A | Draft 2020-12 plus cross-record semantic validation, including compatibility admission and the separately hashed runner import bundle | 20 positive/12 schema-negative fixtures plus 12 semantic negatives | reuse unchanged | [S18] |
| `lib/contracts/adapters/recommendation.ts` | M-A adapter | Lossless current hardware/request translations and explicit blocked mappings | adapter round-trip/rejection tests | reuse until M-D/M-H adapters supersede it | [S18] |
| `lib/contracts/index.ts` | M-A | Core-only TypeScript exports | import-boundary test | reuse unchanged | [S18] |
| `lib/battles/flag.ts` | M-M | Keeps battle feature dark | battle boundary | reuse unchanged until approval | [S12] |
| `lib/battles/index.ts` | M-M | Public dark-core exports | battle tests | revise as M-M adapter | [S12] |
| `lib/battles/policy.ts` | M-M | Editable vote/rating thresholds | battle rating | reuse unchanged | [S12] |
| `lib/battles/rating.ts` | M-M | Bucketed weighted Bradley–Terry/bootstrap bands | battle rating | reuse unchanged | [S12] |
| `lib/battles/types.ts` | M-A/M-M | Pair/vote/rating types | battle tests/typecheck | revise into shared C10/C11 contracts | [S2][S12] |
| `lib/battles/validation.ts` | M-M (possible M-L input) | Rejects invalid/DNF/mismatched pairs/votes | battle validation | reuse behind M-M boundary | [S12] |
| `lib/evidence/index.ts` | M-G | Public evidence exports | evidence tests | revise as M-G adapter | [S8] |
| `lib/evidence/scope-policy.ts` | M-G | Metric pooling/scope policy | evidence contract | reuse unchanged | [S8] |
| `lib/evidence/types.ts` | M-A/M-G | Evidence identity, claims, methods, scopes | evidence/type tests | revise into C3/C4/C8 | [S2][S8] |
| `lib/evidence/validation.ts` | M-G | Fail-closed evidence admission/claim derivation | evidence contract | reuse unchanged | [S8] |
| `lib/fit/fit.ts` | M-F | Pure single-pool memory estimate | fit golden/property/purity | reuse behind adapter | [S7] |
| `lib/fit/index.ts` | M-F | Fit API exports | fit tests | revise as adapter export | [S7] |
| `lib/fit/memory-pools.ts` | M-F | Independent discrete/integrated VRAM+RAM fit | two-pool fit | reuse unchanged internally | [S7] |
| `lib/fit/types.ts` | M-A/M-F | Fit input/breakdown types | fit/typecheck | revise into C5 | [S2][S7] |
| `lib/priors/catalog.ts` | M-F/M-G | Sourced throughput prior records | throughput priors | reuse behind evidence adapter | [S7] |
| `lib/priors/estimate.ts` | M-F | Exact/family scoped envelope lookup | throughput priors/boundary | reuse unchanged | [S7] |
| `lib/priors/index.ts` | M-F | Prior API exports | throughput tests | revise as adapter export | [S7] |
| `lib/priors/types.ts` | M-A/M-F/M-G | Prior and estimate types | throughput/typecheck | revise into shared contracts | [S2][S7] |
| `lib/priors/validation.ts` | M-G | Fail-closed prior validation | throughput priors | reuse unchanged | [S7] |
| `lib/quick-test/endpoint-policy.ts` | retired M7 | Enforces exact loopback-only URLs | quick-test | reuse only as reference; retire browser path | [S16] |
| `lib/quick-test/index.ts` | retired M7 | Exports browser quick-test API | quick-test | retire after useful task definitions migrate | [S16] |
| `lib/quick-test/run.ts` | retired M7 | Sequential browser fetch to loopback endpoint | quick-test/boundary | retire after replacement | [S16] |
| `lib/quick-test/suite.ts` | M-K precursor | Three deterministic task definitions/scorers | quick-test | reuse behind new adapter | [S16] |
| `lib/quick-test/types.ts` | M-A/M-K precursor | Legacy endpoint/task report types | quick-test/typecheck | revise; do not duplicate C6/C7 | [S2][S16] |
| `lib/recommendation/candidate-evaluation.ts` | M-H with M-D/M-F | Hardware filtering, fit, throughput and evidence evaluation | recommendation engine | revise to consume adapters | [S9][S13] |
| `lib/recommendation/catalog/real-candidates.ts` | M-E/M-C/M-G | Joins registry/runtime/evidence into candidates | recommendation/registry | revise; move assembly out of M-H | [S6][S9] |
| `lib/recommendation/engine.ts` | M-H | Fail-closed outcome production/dedupe/shortlist | recommendation engine | reuse behind M-O | [S9] |
| `lib/recommendation/index.ts` | M-H | Recommendation public API | recommendation tests | revise so surfaces use M-O | [S9][S13] |
| `lib/recommendation/policy.ts` | M-H | Result/evidence thresholds | recommendation tests | reuse unchanged | [S9] |
| `lib/recommendation/presentation.ts` | M-P presenter | Converts outcomes to provenance-bearing display values | evidence UI | revise into surface presenter | [S9] |
| `lib/recommendation/ranking.ts` | M-H | Role labels, ordering, family dedupe | recommendation engine | reuse unchanged | [S9] |
| `lib/recommendation/safety-policy.mjs` | M-H | Pure consent/safety decision tree | recommendation policy | reuse unchanged | [S9] |
| `lib/recommendation/strategies.ts` | M-H | Strategy definitions/scoring | recommendation engine | reuse unchanged | [S9] |
| `lib/recommendation/types.ts` | M-A/M-H | Query/candidate/outcome/display contracts | typecheck/recommendation/UI | revise into C1/C2/C5 | [S2][S9] |
| `lib/portfolio/types.ts` | M-H | Internal exhaustive-universe, policy, reviewed-familiarity and disposition-ledger types over approved M-A DTOs | isolated M-H typecheck/behavior proof | reuse behind M-O; do not promote the internal ledger or brand to an M-A wire contract without approval | [S19] |
| `lib/portfolio/index.ts` | M-H | Compatibility-only portfolio selection, process-local M-E/M-F composition integrity, complete ledger and M-A envelope validation | 23 behavior tests and purity/import proof | reuse behind M-O; real use waits for U27 | [S19] |
| `lib/context-policy/types.ts`, `lib/context-policy/index.ts` | below M-O | Versioned novice task-to-context planning policy and exact expert override; numeric v1 mappings are reviewable heuristics, not measurements | 8 direct behavior/adversarial cases within the 12-test U30 suite plus purity proof | reuse behind M-O; M-P must not invent defaults | [S20] |
| `lib/orchestrator/context.ts` | M-O | Composes policy output with explicit needs/preferences into a complete validated M-A request | 4 composition/adversarial cases within the 12-test U30 suite | reuse; unsupported inputs remain non-data | [S20] |
| `lib/orchestrator/types.ts` | M-O | Internal finder port/session, exact-detail aggregate and current handoff use-case types | isolated M-O typecheck/behavior proof | reuse as internal boundary; do not promote aggregates to M-A without approval | [S20] |
| `lib/orchestrator/index.ts` | M-O | Status-preserving finder composition, branded session/detail/handoff integrity, exact detail, canonical non-authorizing v1 handoff and U28 bundle creation | 16 behavior tests and purity/import proof | preserve; no production wiring yet | [S20] |
| `lib/orchestrator/runner-import-types.ts`, `lib/orchestrator/runner-import.ts` | M-O | U29 exact bundle inspection; expired bundles remain inspectable and require confirmation before import; no import grants execution | 10 behavior/adversarial tests plus boundary proof | preserve; execution authorization remains impossible | [S20] |
| `lib/orchestrator/runner-types.ts`, `lib/orchestrator/runner.ts` | M-O over M-I | Non-authorizing permission preview, status-preserving inventory port and branded verified-only selection | 11 behavior/adversarial tests plus boundary proof | preserve behind future runner composition | [S20] |
| `lib/orchestrator/verification-preview-types.ts`, `lib/orchestrator/verification-preview.ts` | M-O over M-J | Requires explicit structural mirrors of Rust M-J confirmed hardware, observed tool, preflight and plan settings; validates a non-authorizing output against intact import/inventory state | 14 behavior/adversarial tests plus boundary proof | partial seam; producer-authenticated hardware/tool receipts and TypeScript→Rust adapter remain absent | [S20] |
| `lib/registry/discovery/hugging-face.ts` | M-C | HF metadata discovery with exact-file route | importer/generated | reuse behind source adapter | [S4] |
| `lib/registry/freshness.ts` | M-C | Pure seven-day fail-closed freshness gate | registry freshness | reuse unchanged | [S4] |
| `lib/registry/importers/hugging-face.ts` | M-C | Immutable/provenance-aware admission | importer/registry contract | reuse unchanged | [S4] |
| `lib/registry/index.ts` | M-C | Registry public exports | registry tests | revise as M-C interface | [S4] |
| `lib/registry/snapshot.ts` | M-C | Deterministic snapshot/lifecycle preservation | registry contract/generated | reuse unchanged | [S4] |
| `lib/registry/types.ts` | M-A/M-C | Artifact/source/lifecycle types | registry/typecheck | revise into C2/C3 | [S2][S4] |
| `lib/registry/validation.ts` | M-C/M-G | Fail-closed artifact/accelerator validation | registry contract | reuse unchanged | [S4] |
| `lib/runtime/catalog.ts` | M-E | Products, engines and builds | runtime contract | reuse behind adapter | [S6] |
| `lib/runtime/compatibility.ts` | M-E | Build-scoped compatibility evaluation | runtime contract | reuse unchanged | [S6] |
| `lib/runtime/index.ts` | M-E | Runtime exports | runtime tests | revise as M-E interface | [S6] |
| `lib/runtime/types.ts` | M-A/M-E | Product/engine/build compatibility types | runtime/typecheck | revise into C2 | [S2][S6] |
| `runner/src/main.ts`, `runner/src/runner-application.ts`, `runner/src/runner-composition.ts`, `runner/src/verification-plan-policy-v1.ts` | M-P over M-O | D1–D6 rendering delegates use cases to one injected facade; M-P sends only opaque handles and a policy ID, validates full producer DTOs/lifecycle/results, and never constructs plan contents | 19 state/use-case tests, 11 boundary tests, typecheck/build and local responsive inspection | preserve; add native live-model proof and recovery only in later checkpoints | [S21][S22] |
| `runner/index.html`, `runner/src/styles.css` | M-P | Approved compact Forest desktop states, explicit permission previews, expert detail and responsive configuration-field motif | runner build; desktop/390 px local browser inspection | preserve; add native accessibility/visual regression harness later | [S15][S22] |
| `runner/legacy-index.html`, `runner/src/legacy-runner-surface.ts`, `runner/src/legacy-styles.css` | historical M-P/R1–R4 | Preserved pre-M-P shell and retired raw-command callers, excluded from the active entry point | boundary test proves active facade has no retired routes | retire only after explicit deletion authorization | [S13][S22] |
| `runner/src-tauri/src/main.rs` | M-P composition | Starts Tauri library | Cargo gates | reuse unchanged | [S15] |
| `runner/src-tauri/src/contracts.rs` | M-A | Rust mirror DTOs, typed validation, canonical serialization and handoff integrity | shared corpus/Clippy/fmt | reuse unchanged as the v1 Rust wire boundary | [S18] |
| `runner/src-tauri/src/lib.rs` | M-O composition plus preserved legacy functions | Registers seven non-authorizing preview and four opaque execution commands behind process-local state; legacy raw benchmark/quick functions are preserved but no longer registered | Cargo/root boundary | preserve typed facade; frontend migration and legacy-code retirement need later proof | [S13][S21] |
| `runner/src-tauri/src/hardware.rs` | M-D | Read-only Windows DXGI/system detection and registry reconciliation | Rust unit/live | reuse behind platform adapter | [S5] |
| `runner/src-tauri/src/hardware_target.rs` | M-D | Adapts detected hardware into the M-A target with explicit unavailable/confirmation states | Rust adapter tests | reuse unchanged behind M-O | [S5] |
| `runner/src-tauri/src/hardware_confirmation.rs` | M-D/U31 | Compares complete imported/detected material facts and seals acknowledged receipts process-locally | 12 focused adversarial tests | reuse unchanged; fail closed when material facts are unknown | [S5][S20] |
| `runner/src-tauri/src/model_store.rs` | M-I | Read-only Ollama/LM Studio/extra GGUF scan | Rust integration/root boundary | reuse behind adapter | [S10] |
| `runner/src-tauri/src/model_store/inventory.rs` | M-I | Preserves scan status; hashes only an explicitly selected retained size candidate under a system file guard; promotes only one exact registry identity | 13 Rust contract/equivalence/adverse tests | reuse behind M-O; non-Windows strong guard remains unavailable | [S10] |
| `runner/src-tauri/src/preflight.rs` | M-J | CPU/RAM/AC checks; unknown thermal/GPU telemetry | Rust unit | revise/add platform telemetry adapters | [S11] |
| `runner/src-tauri/src/benchmark.rs` | M-J | Checked existing llama-bench spawn, exact samples/repeatability/calibration gate | Rust unit/live/root boundary | reuse behind adapter | [S11] |
| `runner/src-tauri/src/quick_task.rs` | M-J/M-K precursor | Checked llama-cli spawn and mechanical task results | Rust unit/live/root boundary | reuse mechanics; revise into execution plan/result | [S11] |
| `runner/src-tauri/src/existing_tool_probe.rs` | M-J/U32 | Windows guarded identity probe for fixed allowlisted `--version`; proves path/hash/reported build only | 6 integration + 3 adversarial unit tests | reuse behind M-O; keep non-Windows unavailable until equally strong guard exists | [S11][S20] |
| `runner/src-tauri/src/verification.rs` | M-J | Binds sealed hardware, exact M-I selection, M-E receipt, guarded tools, runtime and preflight into typed plan/result | 20 focused adapter tests | reuse; keep execution/result orchestration separately gated | [S11] |
| `runner/src-tauri/src/preview_adapter.rs` | M-O | Validates U28/U29 import and assembles process-local U31/U32/M-I/M-J plan previews without authorization | 5 unit + 3 integration + root boundary tests | reuse as the approved preview facade; no surface wiring yet | [S20] |
| `runner/src-tauri/src/execution_protocol.rs` | M-J | Fixed `llama-bench-v1` per-repetition argv/caps and fixed quick-check translation with exact sealed sampler and no arbitrary flags | protocol unit tests within 73-test library suite | reuse; benchmark validates but does not exercise sampler settings | [S21] |
| `runner/src-tauri/src/execution_process.rs` | M-J/security | Guarded hashes, suspended Windows child, pre-resume Job Object assignment, bounded streams/watchdog/cancel and process-tree cleanup | process unit/adversarial tests within 73-test library suite | reuse as lifecycle control; never claim T7/network/filesystem sandbox | [S21] |
| `runner/src-tauri/src/execution_result_adapter.rs` | M-J | Admits only official benchmark JSON and fixed quick outputs matching sealed identity/runtime facts; preserves valid earlier samples/checks | result-adapter tests within 73-test library suite | reuse; planned facts never substitute for observations | [S21] |
| `runner/src-tauri/src/execution_lifecycle.rs`, `execution_service.rs` | M-O over M-J | One-use moved-prepared authorization, one active worker, benchmark-before-check sequencing, authentic progress, idempotent stop/terminal reads, malformed-later prefix preservation and M-J normalization | 15 service fixtures; 79 combined library tests | partial internal capability; no frontend/live-model proof; quick-only blocked without load evidence | [S21] |
| `runner/src-tauri/src/execution_transport.rs` | M-O | Opaque typed start/status/stop/result facade requiring explicit side-effect acknowledgements and rejecting caller-authored execution facts | 5 transport fixtures plus root invoke-boundary tests and M-P consumer tests | preserve; predictable handles are references and restart-lost references fail closed | [S21][S22] |
| `scripts/check-registry-freshness.ts` | M-C tooling | Build-time freshness gate | registry freshness/build | reuse unchanged | [S4] |
| `scripts/discover-hugging-face.ts` | M-C tooling | Materializes discovery lock | workflow/boundary/generated | reuse behind tool boundary | [S4] |
| `scripts/ingest.ts` | M-C tooling | Deterministic registry generation | registry workflow/generated | reuse unchanged | [S4] |
| `scripts/persona-walkthrough.ts` | M-P QA tooling | Manual/automated current finder walkthrough | persona narrative; not main gate behavior | revise after screen freeze | [S15] |
| `worker/index.ts` | M-P hosting adapter | Cloudflare request handling for website build | typecheck/lint/build | reuse behind deployment boundary | [S15] |
| `public/design-system/constellation.js` | M-P decorative adapter | Low-contrast configuration-field animation | lint/build; no visual regression | reuse motif, revise only with approved design | [S15] |

## Test and fixture files

| File | Module exercised | Coverage / behavior | Disposition | Evidence |
|---|---|---|---|---|
| `tests/accelerator-registry.test.ts` | M-D | provenance, memory variants, fail-closed unknowns | reuse; adapt imports | [S5][S14] |
| `tests/battles-boundary.test.mjs` | M-M/M-P | feature dark and no app import | reuse | [S12][S14] |
| `tests/battles-rating.test.ts` | M-M | rating math, weights, buckets, confidence | reuse unchanged | [S12][S14] |
| `tests/battles-validation.test.ts` | M-M | pair/vote fail-closed validation | reuse unchanged | [S12][S14] |
| `tests/empty-state.e2e.test.tsx` | M-P/M-H | honest zero-data state | reuse behavior; revise harness with UI | [S14] |
| `tests/evidence-contract.test.ts` | M-G | scope, claim derivation, immutable identity | reuse unchanged | [S8][S14] |
| `tests/contracts-v1.test.ts` | M-A | TypeScript shared-corpus, canonical hash, adapter round-trip and rejection coverage | reuse unchanged | [S18] |
| `tests/contracts-boundary.test.mjs` | M-A | Core import/I/O isolation and adapter containment | reuse unchanged | [S18] |
| `tests/evidence-ui.test.tsx` | M-P/M-D/M-F/M-G | exact hardware, evidence badges, independent pools | reuse behavior; revise surface harness | [S14] |
| `tests/evidence-ui-types.test.ts` | M-A/M-G/M-P | rejects badge-less numeric display | reuse unchanged | [S8][S14] |
| `tests/fit-golden.test.ts` | M-F | llama.cpp allocation goldens | reuse; run equivalence against llmfit | [S7][S14] |
| `tests/fit-memory-pools.test.ts` | M-F/M-G | two pools, monotonicity, raw profile identity | reuse unchanged | [S7][S14] |
| `tests/fit-properties.test.ts` | M-F | monotonicity, physical limits, breakdowns | reuse unchanged | [S7][S14] |
| `tests/fit-purity.test.mjs` | M-F | prohibits I/O/environment imports | reuse unchanged | [S7][S14] |
| `tests/hugging-face-importer.test.ts` | M-C | immutable admission and quarantine | reuse unchanged | [S4][S14] |
| `tests/product-contract.test.mjs` | M-A/M-O/M-P | product promises, consent, accessibility | revise after contract freeze; preserve honesty assertions | [S14] |
| `tests/quick-test.test.ts` | retired M7/M-K precursor | loopback policy, deterministic scorers/errors | reuse scorer cases; retire endpoint cases after replacement | [S16] |
| `tests/quick-test-ui.test.tsx` | retired M7/M-P | dormant browser quick-test states/badges | retire after runner migration proof | [S16] |
| `tests/runner-surface.test.ts` | M-P/M-O | Byte-for-byte approved import fixture plus deterministic D1–D6 consumer flow, consent, empty/unavailable/partial/error, stale/replay/stop and immutability | preserve and extend with any new M-P state | [S22] |
| `tests/recommendation-engine.test.ts` | M-H/M-D/M-F | all outcomes, isolation, exact fit, dedupe | reuse; adapt boundary | [S9][S14] |
| `tests/recommendation-policy.test.mjs` | M-H | pure safety/consent tree | reuse unchanged | [S9][S14] |
| `tests/registry-boundary.test.mjs` | M-C | production/workflow import boundaries | reuse; update only for approved interface | [S4][S14] |
| `tests/registry-contract.test.ts` | M-C/M-G | record validation/determinism | reuse unchanged | [S4][S14] |
| `tests/registry-freshness.test.ts` | M-C | stale/future fail-closed | reuse unchanged | [S4][S14] |
| `tests/registry-generated.test.ts` | M-C | scale, provenance, exact-file trust route | reuse unchanged | [S4][S14] |
| `tests/registry-workflow.test.mjs` | M-C | pinned review-gated refresh workflow | reuse unchanged | [S4][S14] |
| `tests/runner-boundary.test.mjs` | M-D/M-I/M-J | no HTTP/socket/update/write; checked spawns | reuse and expand for M-O | [S11][S14] |
| `tests/runtime-contract.test.ts` | M-E | product/engine separation and build compatibility | reuse unchanged | [S6][S14] |
| `tests/throughput-boundary.test.mjs` | M-F/M-G | prevents UI prior reimplementation | reuse; revise for adapter boundary | [S7][S14] |
| `tests/throughput-priors.test.ts` | M-F/M-G | scoped envelope lookup/fail-closed unknowns | reuse unchanged | [S7][S14] |
| `tests/fixtures/llama-cpp-memory-goldens.json` | M-F | sourced memory expected values | reuse as test artifact | [S7] |
| `tests/fixtures/recommendation-engine-goldens.json` | M-H | expected decision leaves | reuse; version with contract | [S9] |
| `tests/fixtures/registry-lifecycle-golden.json` | M-C | lifecycle expected snapshot | reuse unchanged | [S4] |
| `tests/fixtures/unknown-throughput-golden.json` | M-F/M-G | unknown-evidence fail-closed case | reuse unchanged | [S7] |
| `research/mh-portfolio/fixtures.ts`, `portfolio.test.ts`, `boundary.test.mjs`, `tsconfig.json` | M-H proof | synthetic M-E/M-F/M-G handoff, all decision leaves, mutation/contradiction/error regressions and import isolation | reuse as checkpoint proof; illustrative data only | [S19] |
| `research/mo-orchestration/orchestration.test.ts`, `boundary.test.mjs`, `tsconfig.json` | M-O proof | synthetic status propagation, finder/detail/v1-handoff binding and import isolation | reuse as checkpoint proof; not a production handoff | [S20] |
| `research/context-policy/*` | U30/below M-O proof | novice derivation, expert override, full M-A request composition, hostile-input and purity checks | reuse as checkpoint proof; numeric targets remain implementation-selected heuristics | [S20] |
| `research/mo-import-inspection/*` | M-O/U29 proof | fresh, expired, confirmed, tampered, invalid-version and hostile bundle inspection | reuse as checkpoint proof | [S20] |
| `research/mo-runner-orchestration/*` | M-O/M-I proof | permission preview, inventory status propagation and exact verified selection | reuse as checkpoint proof | [S20] |
| `research/mo-verification-preview/*` | M-O/M-J proof | exact structural prerequisite forwarding, no defaults, plan-output/upstream integrity binding and hostile-result containment without execution capability | preserve as the TypeScript structural proof; Rust producer/transport proof now lives in `preview_adapter.rs` | [S20] |
| `research/mf-profile-collection/*` | M-F/U27 research proof | versioned synthetic raw collection, repeated-observation derivation, policy sweep, invalid fixtures and executable production-unavailable result | preserve as non-production machinery; trusted capture and concrete policy need owner approval | [S7][S19] |
| `runner/src-tauri/tests/benchmark_live.rs` | M-J | env-gated real benchmark smoke | reuse; strengthen artifact binding later | [S11][S14] |
| `runner/src-tauri/tests/contracts_v1.rs` | M-A | Rust shared-corpus parity, canonical ordering and forward-version rejection | reuse unchanged | [S18] |
| `runner/src-tauri/tests/hardware_target_adapter.rs` | M-D | detected/manual target mapping, origins and ambiguity | reuse unchanged | [S5] |
| `runner/src-tauri/tests/hardware_confirmation.rs` | M-D/U31 | material-fact binding, unknowns, normalization and exact acknowledgement | reuse unchanged | [S5][S20] |
| `runner/src-tauri/tests/inventory_contracts.rs` | M-I | registry adaptation, exact selection and partial-state preservation | reuse unchanged | [S10] |
| `runner/src-tauri/tests/model_store_scan.rs` | M-I | fixture stores, identity, duplicates, errors, live read-only smoke | reuse unchanged | [S10][S14] |
| `runner/src-tauri/tests/existing_tool_probe.rs` | M-J/U32 | allowlist/path/parser/hash/time/output/identity-drift failures | reuse unchanged | [S11][S20] |
| `runner/src-tauri/tests/verification_adapter.rs` | M-J | complete preparation/result identity, status and evidence gates | reuse unchanged | [S11] |
| `runner/src-tauri/tests/preview_adapter.rs` | M-O | import integrity, local preflight mapping and local inventory-path boundary | reuse unchanged | [S20] |
| `runner/src-tauri/tests/quick_task_live.rs` | M-J/M-K precursor | env-gated configuration-bound task smoke | reuse; strengthen execution/result contract | [S11][S14] |

## Production-support and generated files

These are not domain modules, but they participate in production or tests and are therefore explicitly classified.

| Files | Assignment | Disposition | Evidence |
|---|---|---|---|
| `registry/generated/artifacts.json`, `registry/generated/accelerators.json`, `registry/generated/throughput-priors.json` | M-C/M-D/M-F generated artifacts | regenerate only through reviewed registry workflows | [S4][S5][S7] |
| `registry/locks/hugging-face.json`, `registry/policy/hugging-face.json`, `registry/sources/*.json`, `registry/schema.json`, `registry/evidence/fit-profiles.json` | M-C/M-G data inputs | reuse/revise behind schemas; raw fit evidence needs publication decision | [S4][S8] |
| `public/*`, `public/design-system/*` | M-P static assets | reuse Forest tokens/motif; `file.svg`, `globe.svg`, `window.svg`, `og-v3.png`, and other obsolete/scaffold assets remain preserved pending UI review | [S15] |
| `runner/src/assets/*`, `runner/src-tauri/icons/*` | M-P scaffold/generated assets | generated/scaffold; replace through approved branding pipeline | [S15] |
| `runner/src-tauri/capabilities/default.json`, `tauri.conf.json` | M-P/security composition | reuse unchanged while boundary holds | [S11] |
| `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.mjs`, `next.config.ts`, `postcss.config.mjs`, `vite.config.ts`, `wrangler.jsonc` | build/deployment infrastructure | reuse; revise only for concrete module/deployment need | [S14] |
| `runner/package.json`, `runner/package-lock.json`, `runner/tsconfig.json`, `runner/vite.config.ts`, `runner/src-tauri/Cargo.toml`, `Cargo.lock`, `build.rs` | runner build infrastructure | reuse; Cargo power feature belongs to M-J adapter | [S11][S14] |
| `.github/workflows/*`, `.github/dependabot.yml`, `runner/packaging/*` | CI/release infrastructure | reuse security gates; packaging remains draft until release | [S14] |

## 2026-07-23 current-path verification

The source inventory was regenerated from the current tree rather than relying
on historical counts of 70, 144 or 194, or the immediately prior 200-path
baseline. It contains **212 shipped source/static/data/test paths**:
**159 production paths** and **53 test paths**
(including test JSON fixtures). Production includes `app`, `lib`, `build`,
`worker`, `scripts`, `design-system`, `public`, `registry`,
`runner/index.html`, runner source, and the nine root build-configuration files
classified above. Tests include all root tests/fixtures and all ten Rust
integration-test files. The immediately prior 200-path baseline already
included the three production paths `hardware_confirmation.rs`,
`existing_tool_probe.rs` and `preview_adapter.rs` plus three corresponding Rust
integration-test paths. The current execution checkpoints add six production paths:
`execution_protocol.rs`, `execution_process.rs`, `execution_result_adapter.rs`,
`execution_lifecycle.rs`, `execution_service.rs` and
`execution_transport.rs`. The M-P desktop checkpoint adds five production
paths for the application/composition facade and preserved legacy shell plus
one root surface test. Every one of the 212 paths is
represented either by an exact row above or the explicit `public/*`,
`runner/src/assets/*`, or `runner/src-tauri/icons/*` group; **unrepresented
count: 0** [S17].

Outside this 212-path shipped inventory, but still classified in
“Production-support and generated files,” are package/build configuration,
registry source/generated
data, Tauri capability/configuration, workflows, and packaging. Also excluded:
Markdown and recovered HTML prototypes (documentation/design references),
`docs/contracts/validate-fixtures.mjs` and its candidate fixtures
(documentation validation tooling), dependency/build output (`node_modules`,
`.next`, `runner/dist`, `runner/src-tauri/target`), and Git metadata. These
exclusions do not hide an unclassified production or test implementation.

## Evidence index

- **[S1]** `docs/modular-architecture-v2.md` status and M-A–M-P responsibilities.
- **[S2]** source type files and absence of a shared C1–C12 package.
- **[S3]** `docs/llmfit-core-adoption-audit.md`; code search found no llmfit import/reference.
- **[S4]** `lib/registry/**`, registry data/scripts, registry tests and passing gates.
- **[S5]** `lib/accelerators/**`, `runner/src-tauri/src/hardware.rs`, accelerator/Rust tests.
- **[S6]** `lib/runtime/**`, `lib/recommendation/catalog/real-candidates.ts`, runtime tests.
- **[S7]** `lib/fit/**`, `lib/priors/**`, fit/throughput tests and fixtures.
- **[S8]** `lib/evidence/**`, fit profile JSON, evidence tests.
- **[S9]** `lib/recommendation/**`, recommendation tests, `ALGORITHM.md`.
- **[S10]** `runner/src-tauri/src/model_store.rs` and `model_store_scan.rs`.
- **[S11]** runner preflight/benchmark/quick-task sources, Rust tests, root boundary test, R4 status.
- **[S12]** `lib/battles/**`, battle tests, dark feature flag; no app imports.
- **[S13]** historical import/IPC scan showing direct app→domain and runner
  UI→command calls. It remains evidence for legacy surface bypasses, not for
  current M-O implementation absence.
- **[S14]** 2026-07-22 root and runner `npm.cmd run check`, both exit 0.
- **[S15]** full source/config read and build output; no targeted behavioral test found beyond stated gates.
- **[S19]** `lib/portfolio/**`, `research/mh-portfolio/**` and
  `npm.cmd run proof:mh` (23 behavior tests plus one purity/import proof).
- **[S20]** `lib/orchestrator/**`, `lib/context-policy/**`, the focused
  `research/context-policy/**` and `research/mo-*/**` proofs, and
  `npm.cmd run proof:mo-checkpoint`.
- **[S21]** `runner/src-tauri/src/execution_{protocol,process,result_adapter,lifecycle,service,transport}.rs`;
  15 fake-runner service tests, 5 transport tests and 80 combined Rust library
  tests on 2026-07-23. No pinned external model/tool run was evidenced.
- **[S22]** `runner/src/{runner-application,runner-composition,main}.ts`,
  active and preserved runner HTML/CSS, `tests/runner-surface.test.ts`, the root
  runner boundary test, 19 surface tests and local desktop/390 px browser
  inspection.
- **[S16]** M7 retired status, removed navigation, retained `lib/quick-test` and UI/tests.
- **[S17]** current-tree inventory regenerated 2026-07-23 from the path rules
  named above; exact totals are 212 paths: 159 shipped production/static/data
  paths and 53 root/Rust test paths, with zero unrepresented.
- **[S18]** `lib/contracts/**`, `runner/src-tauri/src/contracts.rs`, the shared
  20-positive/12-negative corpus plus 12 semantic negatives, M-A
  boundary/adapter tests, and passing root
  and runner gates on 2026-07-22.

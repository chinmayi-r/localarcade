# Reuse, revise, retire, and missing

Recommendations only; no file is deleted or deprecated by this report. The unit of preservation is behavior plus tests, not the current folder name [R1].

## Reuse unchanged internally

| Capability / files | Why preserve | Boundary condition | Evidence |
|---|---|---|---|
| Registry admission, validation, deterministic snapshot and freshness (`lib/registry/{freshness,importers,snapshot,validation}.ts`) | Provenance-rich, deterministic and fail-closed | expose through M-C; do not let surfaces import generated data | registry contract/importer/freshness/generated tests [R2] |
| Accelerator lookup/validation (`lib/accelerators/{lookup,validation}.ts`) | Exact variants; unknowns require manual confirmation | expose through M-D | accelerator tests [R3] |
| Runtime compatibility (`lib/runtime/compatibility.ts`) | Separates product, engine, build and artifact compatibility | expose through M-E | runtime contract tests [R4] |
| Fit math (`lib/fit/fit.ts`, `memory-pools.ts`) | Pure, monotonic, explicit reserves and independent memory pools | keep goldens while evaluating llmfit | fit golden/property/purity/two-pool tests [R5] |
| Evidence scope/validation (`lib/evidence/{scope-policy,validation}.ts`) | Prevents estimates from masquerading as measurements | align vocabulary in M-A first | evidence tests [R6] |
| Throughput envelope logic (`lib/priors/{estimate,validation}.ts`) | Correctly scoped ranges and fail-closed unknown hardware | move records behind M-G/M-F | throughput tests [R7] |
| Recommendation ranking/policy primitives (`engine`, `policy`, `ranking`, `strategies`, `safety-policy`) | Honest coverage-vs-fit outcomes, family dedupe, consent safety | feed complete DTOs through M-O | recommendation tests [R8] |
| Read-only model scan (`model_store.rs`) | Consent-gated, bounded, reports errors/duplicates, no writes | M-I adapter | Rust integration and root boundary tests [R9] |
| Benchmark parsing/repeatability/calibration gate (`benchmark.rs`) | Preserves exact raw samples and separates observation from calibration eligibility | M-J adapter; do not call full R4 | Rust unit/live tests and R4 status [R10] |
| Battle rating/validation core (`lib/battles/**`) | Tested bucket isolation, DNF rejection and deterministic confidence | remain dark behind M-M until M-L exists | battle tests/dark boundary [R11] |

## Reuse behind a new adapter

| Current capability | New boundary | Required proof | Evidence |
|---|---|---|---|
| Generated registry and discovery scripts | M-C interface/source adapters | existing deterministic/trust tests unchanged | [R2] |
| Accelerator catalog + Windows DXGI detection | M-D platform adapters | same known/mismatch/unknown fixtures across platforms | [R3] |
| Runtime catalog and candidate identity | M-E | candidate identity includes artifact, build, backend and settings | [R4][R8] |
| Current fit and priors | M-F, optionally backed by M-B | golden equivalence and uncertainty preservation | [R5][R7][R12] |
| Evidence records | M-G shared C3/C4/C8 | compile/runtime fixtures reject unsupported claims | [R6] |
| Recommendation engine | M-H called only by M-O | import-boundary test plus existing golden outcomes | [R8][R13] |
| Model scan | M-I called only by M-O | read-only and consent boundaries unchanged | [R9][R13] |
| Preflight/benchmark | M-J called only by M-O | adverse/unknown states still fail calibration closed | [R10][R13] |
| Mechanical task definitions/scorers | M-K execution plan/result | browser endpoint logic excluded; C6/C7 fixtures added | quick-test and runner task tests [R14] |
| Battle aggregation | M-M | consumes only approved M-L records; never UI data directly | [R11] |

## Revise

| Files / behavior | Reason | Target | Evidence |
|---|---|---|---|
| All duplicated `types.ts` and Rust request/report structs | Shared contracts are fragmented; draft enums are not frozen | M-A C1–C12 with cross-language fixtures | source/type audit [R15] |
| `real-candidates.ts` | Joins registry, runtime and fit evidence inside recommendation | M-C/M-E/M-G adapters assembled by M-O | imports and proposed dependency graph [R13] |
| `candidate-evaluation.ts` | Mixes hardware filtering, fit, prior lookup and recommendation evaluation | M-D/M-F results consumed by M-H | source read and tests [R8] |
| `presentation.ts` | UI-specific display conversion lives in domain folder | M-P presenter fed by M-O DTO | evidence UI tests [R8] |
| `app/arena-app.tsx`, finder components | Direct domain imports and current shell predate approved screen inventory | M-P→M-O only; preserve honesty/accessibility cases | import scan and design conflicts [R13][R16] |
| `runner/src/main.ts`, `runner/src-tauri/src/lib.rs` | Direct command-by-command IPC is the missing orchestrator seam | M-P→M-O facade | invoke/handler scan [R13] |
| `preflight.rs` | Thermal and concurrent-GPU telemetry remain unknown | platform-specific M-J telemetry adapters | R4 ledger and code [R10] |
| Docs entry chain | Requires three absent docs and references nonexistent prototype directory | repair only after owner approves authority conclusions | link audit [R17] |
| Runner threat model | Approval header conflicts with unchecked closing checklist; future capabilities blur current scope | reconcile current/future threat surfaces | threat-model read [R18] |

## Retire after replacement

| Files / surface | Why | Safe retirement gate | Evidence |
|---|---|---|---|
| `app/components/quick-test/localhost-quick-test.tsx` | Removed from navigation/product; browser M7 is explicitly retired | M-K task definitions/results migrated and equivalent scorer tests pass | M7 status, arena-app diff [R14] |
| `lib/quick-test/{endpoint-policy,run,index}.ts` endpoint path | Browser-to-localhost path is no longer a product route | no production imports; useful suite logic extracted; tests rehomed | quick-test source/tests [R14] |
| `tests/quick-test-ui.test.tsx` and endpoint-specific portions of `quick-test.test.ts` | Test a dormant surface | replacement runner/M-K UI and security tests cover intended behavior | [R14] |
| Current website/runner layout shells | Screen inventories conflict and pivot is not frozen | approved W/D contract, M-O boundary, accessibility/honesty regression tests | [R16] |
| Tauri/Vite scaffold logos/assets | Not product design | approved identity asset pipeline | runner asset inventory [R19] |
| Historical M7/old screen instructions as active guidance | They can misdirect new implementation | document authority map approved and successor contracts linked | authority audit [R17] |

“Retire” does not apply to passing correctness-sensitive cores merely because the user is open to a nuclear reset. Replacing those cores would add risk without a product benefit; replacing shells and mixed boundaries after adapters exist is the lower-risk pivot [R1][R20].

## Missing

| Missing item | Blocks | Why it is not satisfied by current code | Evidence |
|---|---|---|---|
| Approved product brief / first slice | Any production implementation checkpoint | referenced file absent; transcript contains proposals and objections, not a frozen slice | [R17][R21] |
| Approved repository audit/worktree plan | Architecture execution | referenced files absent | [R17] |
| Frozen C1–C12 contracts | All module extraction | only draft schemas and fragmented types exist | [R15] |
| M-B llmfit adapter decision | Core-fit replacement/adoption | audit only; no code import or license/integration decision | [R12] |
| Non-Windows hardware adapters | Cross-device runner claim | current GPU enumeration is Windows-only | hardware source/status [R3] |
| Serving configuration import | Complete configuration identity from installed apps | runtime catalog exists, import does not | M-E source audit [R4] |
| Full M-J verification | Trustworthy calibration/release benchmark | no bundled engine, T7 sandbox, thermal/GPU telemetry, artifact binding | [R10] |
| M-K private Solo Arena | Recovered V1 private audition flow | fixed tasks are not a general plan/result/history | [R14][R21] |
| M-L contribution lifecycle | Any public Arena input | no pair generation, payload review, upload or revocation | battle/source audit [R11] |
| M-N public evidence service | Public evidence API | draft endpoints have no implementation/authorization | design docs/source inventory [R16] |
| M-O orchestrator | Surface integration | surfaces directly import/invoke modules | [R13] |
| Reconciled website/desktop screen inventory | Production UI replacement | two docs disagree; prototype arrival conflicts with AGENTS contract | [R16] |
| Verified security contact | Disclosure promise | mailbox change is not corroborated | `SECURITY.md` diff [R22] |
| Publication decision for local fit profile | Public evidence use | checked-in raw/normalized values lack an approved contribution/publication chain | fit profile/decision docs [R6] |

## Preservation decision

Recommended decision for review: **preserve the green data, fit, evidence, recommendation, inventory, benchmark and rating cores; wrap and split them; replace the obsolete/dormant shells and direct orchestration after contracts are approved.** Do not port prototype data or treat screen HTML as code. Do not begin M-L–M-N merely because the dark M-M core exists [R11][R16][R20].

## Evidence index

- **[R1]** user-requested committed→dirty→recovered→proposed→reviewed sequence and no-delete instruction.
- **[R2]** registry source/data/scripts and passing registry tests.
- **[R3]** accelerator source, Windows `hardware.rs`, accelerator/Rust tests.
- **[R4]** runtime source/tests and candidate catalog.
- **[R5]** fit source, goldens, property/purity/two-pool tests.
- **[R6]** evidence source/tests and `fit-profiles.json`.
- **[R7]** prior source and throughput tests.
- **[R8]** recommendation source/tests/algorithm.
- **[R9]** model-store source/integration/boundary tests.
- **[R10]** runner benchmark/preflight sources/tests and `MILESTONE-STATUS.md` R4.
- **[R11]** battle source/tests/dark boundary and absence of M-L.
- **[R12]** llmfit adoption audit and no code reference.
- **[R13]** direct app imports, runner invokes/handlers, no M-O source.
- **[R14]** retired M7 status, dormant browser UI/source/tests, runner quick-task source/tests.
- **[R15]** current type inventory and proposed C1–C12 documents.
- **[R16]** `AGENTS.md`, both screen inventories, interface gates, four recovered prototypes.
- **[R17]** missing-reference audit and interrupted session patch provenance.
- **[R18]** `docs/runner-threat-model.md` conflicting sign-off states and T7 OPEN.
- **[R19]** runner static asset inventory.
- **[R20]** 2026-07-22 root and runner full gates pass.
- **[R21]** recovered session lines 11846–11917 and 11962: proposals, user objection, private/public distinction.
- **[R22]** `git diff SECURITY.md` and no repository verification of mailbox operation.

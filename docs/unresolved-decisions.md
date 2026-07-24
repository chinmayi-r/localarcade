# Unresolved decisions

U1–U7, the actual brief/screen/design content, and all ten first-slice contract
decisions were resolved by product-owner approval on 2026-07-22. This file now
separates those authorities from implementation and security choices that still
lack approval or evidence.

## Resolved or explicitly scoped

| ID | Resolution | Authoritative consequence | Evidence |
|---|---|---|---|
| U1 | `PRODUCT-BRIEF.md` is the concise product authority. | Its actual content is product-owner-approved. | [U1][U2] |
| U2 | The eight Wave 0 reports are the repository audit; no imaginary audit/worktree-plan version should be sought. | Execution direction/order is approved; checkpoints remain explicit. | [U1] |
| U3 | First slice is owned-hardware finder → portfolio → exact detail → separately gated runner handoff. | M-O/M-P work is limited to this path. | [U2][U3] |
| U4 | Website arrival is one immediately usable hardware/task form. | Three equal cards, hero, app chrome and arrival leaderboard are rejected. | [U4] |
| U5 | Private Arena follows finder/verification; public Arena/uploads/voting/service are deferred. | M-K is later local scope; M-L–M-N are excluded from the execution plan. | [U2][U5] |
| U6 | Consolidate the screen inventories into one matrix. | `screen-contract.md` actual content is approved; older inventories/prototypes remain research. | [U6] |
| U7 | Freeze only the smallest first-slice payloads and envelopes. | v1 fields/enums are approved; contribution/service contracts remain excluded. | [U7] |
| U8 | Use the direct `llmfit-core` Rust crate pinned to `v1.1.6` / `aaa2bc179cec214ccdc44501c853b98fba0b343b` behind a Local Arcade-owned explicit-input M-B adapter. | Installed-provider discovery, local benchmark history, embedded community evidence and localmaxxing evidence are disabled. Because upstream unconditionally compiles HTTP/provider/update code and embeds data without a separately established dataset license, the spike remains an isolated library: no runner/product linking or public distribution is approved. The CLI remains research-only; current Local Arcade fit remains active. | Product-owner approval in chat, 2026-07-22; `research/llmfit/`; `crates/llmfit-adapter/`; [U8]. |
| U11 | M-J is Windows-first; reviewed adapters may be added later and other platforms remain honest manual/unknown states. | The first M-J adapter may consume Windows detection/preflight without claiming cross-platform parity. | Product-owner approval of the 2026-07-22 M-I/M-J checkpoint. |
| U12 | M-J uses only explicitly selected, user-supplied existing engines and artifacts with hash/build/backend binding. | No bundled engine, public calibration transfer or full-R4 claim is authorized; unknown telemetry excludes calibration. | Product-owner approval of the 2026-07-22 M-I/M-J checkpoint. |
| U15 | The approved M-J boundary is runner-local and has no runner network/upload/updater path. | T7 child-process isolation remains open; no claim that a user-supplied child cannot access the network is permitted. Downloads, updates and contributions retain separate future gates. | Product-owner approval of the 2026-07-22 M-I/M-J checkpoint; `runner-threat-model.md` T7. |
| U17 | Preserve passing fail-closed cores behind adapters; replace obsolete shells after M-A/M-O and screen approval. | No full repository rewrite is planned; shell replacement remains allowed in its future M-P checkpoint. | [U17] |
| U20 | Public service/API/storage work is deferred, not selected. | Retention, abuse, revocation, cost and security decisions remain mandatory before any future M-N checkpoint. | [U20] |
| U21 | Local Arcade and Lakuna remain separate products and permission boundaries. | Only explicitly versioned vendor-neutral contracts may be shared later. | [U21] |
| U22 | Repair the authority files in this documentation checkpoint. | Broken audit references are replaced with the approved eight-report baseline and new plan. | [U1][U22] |
| U23 | Use a compatibility-only M-H portfolio; no ranking-superiority claim. | Return at most five distinct families, one exact representative configuration per family, after hard compatibility. Prefer stronger exact evidence, then the directly supported user priority; use disclosed reviewed familiarity only as a tie-break and catalog position only for deterministic output. Keep an exhaustive internal disposition ledger, do not pad, and emit unranked-compatible with null roles. Alternatives remain available to the future detail path. | Product-owner approval in chat, 2026-07-23; `docs/DECISIONS.md`; `research/mh-portfolio/`. |
| U25 | Carry M-E admission into M-J as a minimal independently versioned compatibility receipt. | M-E emits the receipt only after successful evaluation; M-J consumes only its validated wrapper and binds exact candidate/artifact hash/runtime/Windows architecture/package facts. It is an internal admission record, not a cryptographic attestation. | Product-owner approval in chat, 2026-07-22; [U25]. |
| U28 | Preserve runner-handoff v1 and add a separately versioned portable import bundle carrying the exact M-E receipt. | Bundle validation must bind handoff, candidate, artifact hash, runtime and receipt; it grants no side-effect authority. | Product-owner approval in chat, 2026-07-23; `docs/DECISIONS.md`. |
| U29 | Handoff expiry is informational. | Expired bundles may be inspected/imported only with a visible warning/confirmation; age grants no authority. Tamper/schema/version failures remain blocked. | Product-owner approval in chat, 2026-07-23; `docs/DECISIONS.md`. |
| U30 | A small versioned policy module below M-O owns novice task→context derivation. | M-P cannot invent context defaults; expert override must be explicit and validated. | Product-owner approval in chat, 2026-07-23; `docs/DECISIONS.md`. |
| U31 | Runner hardware confirmation uses a versioned material-fact comparison, never caller-controlled ID equality alone. | OS family and accelerator identity/vendor/kind/backend/count/capacity plus unified-memory facts bind the target. Available RAM, origins and descriptive OS/CPU details remain visible but non-authoritative. Total RAM normalization v1 permits at most the smaller of 3% of imported total or 1 GiB, retains the lower detected value and requires a visible warning/confirmation; larger contradictions block. | Product-owner approval in chat, 2026-07-23; producer/IPC audit; `docs/DECISIONS.md`. |
| U32 | A pre-execution existing-tool receipt proves selected path/hash and strictly parsed reported llama.cpp build, not actual backend selection. | Planned backend remains sourced from the exact candidate plus validated M-E compatibility receipt. Actual backend evidence is required from the later separately gated model-loading result. The fixed version probe grants no execution authorization and cannot be described as sandboxed. | Product-owner approval in chat, 2026-07-23; producer/IPC audit; `docs/DECISIONS.md`. |
| U33 | Existing-engine execution authority is a separately versioned, one-use process-local receipt created only by consuming the intact prepared-verification handle. | Caller-authored IDs, M-A payloads and previously returned previews cannot create or replay run authority. Start or queued cancellation consumes it; only one run may be running/stop-requested, and stop is idempotent. M-A v1 remains unchanged. | Product-owner approval in chat, 2026-07-23; `runner/src-tauri/src/execution_lifecycle.rs` and focused authorization/lifecycle tests; `docs/DECISIONS.md`. |
| U34 | The official `llama-bench-v1` per-run JSON record is post-load runner evidence for actual backend, engine build, model identity and effective runtime facts. | Observed and planned facts remain separate. Completed exact evidence requires the versioned parser output to match the sealed plan exactly; missing/malformed/mismatched identity blocks that conclusion while preserving honest partial/failure records. Version probes, stderr and caller assertions are insufficient. The additive receipt does not alter M-A v1. | Product-owner approval in chat, 2026-07-23; `runner/src-tauri/src/execution_protocol.rs`; `runner/src-tauri/src/execution_lifecycle.rs` load-match/terminal tests; `docs/DECISIONS.md`. |
| U35 | `llama-bench-v1` uses one bounded child per warmup/measured repetition, with internal repetitions fixed to one and conservative v1 caps. | Progress advances only across authentic child/run records; completed earlier records survive later stop/timeout/crash. Caps are 10 warmups, 20 measured and 24 total. Windows Job Object ownership is lifecycle control, not T7 sandboxing; child network and filesystem/write isolation remain unenforced/false. | Product-owner approval in chat, 2026-07-23; `runner/src-tauri/src/execution_protocol.rs` resolver/cap tests; `runner/src-tauri/src/execution_process.rs` process-boundary/Job Object tests; `docs/DECISIONS.md`. |
| U36 | Split fixed verification checks from private Arena. | M-J owns fixed configuration-bound check execution/observations. M-K owns arbitrary prompts, paired streaming, comparison and history. Combined verification benchmarks before checks; quick-only stays blocked without structured load evidence. | Approved execution checkpoint, 2026-07-23; `docs/DECISIONS.md`; combined service tests. |
| U37 | Expose execution only through opaque typed M-O references. | Start/status/stop/result accept no caller-authored execution facts. Legacy raw invoke registrations are retired while implementation code remains preserved; the typed M-P desktop facade is the first consumer. | Approved execution checkpoint, 2026-07-23; `docs/DECISIONS.md`; transport, surface and root boundary tests. |

## Still unresolved or deferred implementation/security decisions

| ID | Decision | Evidence / conflict | Options | Audit recommendation | Blocks |
|---|---|---|---|---|---|
| U9 | Hosted vs local fit on website | No M-B implementation; website currently computes in TS; proposed docs mention multiple forms [U8][U9]. | Client TS/WASM; server/worker; static precomputed profiles. | Keep website no-install and fail-closed; choose only after performance/privacy/deployment measurements. | Website architecture |
| U10 | M-E serving-configuration source | Recommendations require complete settings, but installed serving-config import is absent [U10]. | Manual entry; adapters for known apps; model-file inference. | Manual confirmed settings first; add explicit app adapters later; never infer complete config from filename. | Runner handoff/verification |
| U13 | Can the checked-in local fit profile be published/recommended? | Exact raw/normalized values and identity are checked in and tested, but there is no approved contribution/publication chain [U13]. | Internal calibration evidence; reviewed registry evidence; remove from production candidates later. | Keep preserved and labeled local evidence; require source review and explicit policy before public publication. | Candidate coverage/public evidence |
| U14 | Security disclosure mailbox | `SECURITY.md` changed to `security@localarcade.dev`; repository cannot verify it exists [U14]. | Confirm mailbox; use another channel; mark TBD. | Confirm before release; do not advertise an unmonitored address. | Public security policy |
| U16 | Disposition of retired M7 code | Navigation is removed and milestone retired; useful task/scorer definitions overlap runner quick tasks [U16]. | Keep indefinitely; delete now; migrate then retire. | Migrate mechanical fixtures into M-K/M-J contracts, prove equivalence, then delete dormant browser surface in an approved checkpoint. | Cleanup only |
| U19 | Where does battle validation belong? | `lib/battles` validates pairs/votes and rates them, but proposed M-L should own contribution intake [U19]. | Keep combined; split validation; duplicate boundary validation. | M-L validates contribution envelope/consent; M-M defensively validates rating input using shared M-A contracts. | M-L/M-M |
| U24 | May Anubis leaderboard records be ingested or redistributed? | Anubis code is GPL-3.0 and its live Apple benchmark analysis is public, but repository code licensing does not by itself establish dataset redistribution terms [U24]. | Reference-only external validation; licensed snapshot ingestion; exclude. | Use reference-only matched comparisons until owner/legal review confirms dataset terms and provenance requirements. | External data ingestion; not reference-only research |
| U26 | What exact headroom semantics, if any, should produce `fit: tight`? | The approved M-A enum contains `tight`, but the fit cores return only hard fit/no-fit and no approved document defines a threshold. M-F therefore emits only `good` or `does-not-fit`. | Leave unused; approve one capacity-headroom rule; define runtime-specific rules after measured validation. | Leave unused until owner approval and measured false-positive/false-negative review; never copy llmfit's label across the blocked family-proxy seam. | Any UI/filter/policy that distinguishes tight from good |
| U27 | Which concrete M-F capacity reserves/margin and reviewed profile-manifest entries are approved for production admission? | The trusted capture protocol is now implemented: an explicit Windows/CUDA runner action binds selected artifact/tool/candidate/receipt/hardware content, captures two fixed contexts with three repetitions each, and returns proposed-unreviewed evidence only. Caller-asserted measurement remains blocked. No live capture has been independently reviewed; no production trust manifest exists; the checked Qwen source still omits complete admissible scope and legacy reserve/margin constants have no approved M-A policy source. | Collect a live capture, independently review its complete record into a manifest, and approve one scoped policy; keep M-F unavailable in production until then. | Evaluate false-fit/no-fit behavior under adverse load; then approve explicit reserve/margin values and reviewed manifest entries. Do not promote synthetic fixtures, request-supplied trust, or legacy defaults. | Real M-F producer and M-H/M-O use |

U9–U10 and U13–U14 remain unresolved at the checkpoint that first consumes
them. U8 is resolved only for the pinned direct-crate desktop M-B spike; U9
still governs website execution. U11/U12/U15 are resolved only for the
constrained M-J boundary recorded
above; their excluded future capabilities remain separately gated. U16 belongs
to the later private-Arena/cleanup sequence; U18 is resolved by U36. U19 and the
implementation/security parts of U20 remain outside the approved first slice.
U23 is resolved for the minimal compatibility-only M-H policy; ranking
superiority remains unproved and any future ranking policy requires a new
matched-evaluation decision. U24 blocks ingestion, not cited external
validation. U26 blocks only a `tight` distinction, not hard fit/no-fit. U27
blocks admitting real M-F inputs, not the proven pure boundary. U25 is
resolved for the approved Windows-first, user-supplied-engine
route. U28–U30 are now resolved for the next M-O checkpoint; their
implementations passed their structural contract, interface and security
gates. U31 and U32 were discovered by the producer/IPC audit and approved on
2026-07-23. Their process-local producers and non-authorizing M-O preview
transport now pass the explicit producer, transport and security gates.
Execution, actual-backend observation and surface wiring remain separate
checkpoints.

U33–U37 resolve the internal authority, post-load identity, bounded
per-repetition process policy, U18 ownership split and opaque typed transport
for the newly opened existing-engine execution checkpoint. They preserve M-A
v1 unchanged and do not authorize production surface wiring. Actual
backend/build becomes exact evidence only through the approved runner-reported
`llama-bench-v1` JSON parser and sealed-plan match; fixed quick checks consume
that receipt and cannot create one.
Windows Job Object ownership provides stop/timeout/process-tree lifecycle
control only; it does not resolve T7 or permit a child network/filesystem
isolation claim.

## Evidence index

- **[U1]** missing-file/link audit for `AGENTS.md`, `README.md`, `docs/README.md`.
- **[U2]** recovered session lines 11738–11917 and 12195; recovery report locates source transcript.
- **[U3]** `docs/community-demand-research.md` and recovered user objection at line 11852.
- **[U4]** root `AGENTS.md` website contract and recovered `local-arcade-website-wireframes.html`.
- **[U5]** recovered product simulator/UI-flow prototypes; dark `lib/battles`; source inventory.
- **[U6]** `docs/interface-design-program.md` and `docs/ui-reference-and-screen-plan.md` screen lists.
- **[U7]** `docs/system-operation-graph.md`, `docs/evidence-ranking-api-ux.md`, current TS/Rust type inventory.
- **[U8]** `docs/llmfit-core-adoption-audit.md`; no code references; green fit tests.
- **[U9]** current website TS execution, proposed architecture/system graph deployment discussion.
- **[U10]** runtime/catalog and model-store source audit; complete-configuration honesty rule.
- **[U11]** recovered cross-device decision; Windows-gated `hardware.rs`/`preflight.rs`; R2 ledger.
- **[U12]** `MILESTONE-STATUS.md` R4, runner threat model T7, benchmark/preflight source/tests.
- **[U13]** `registry/evidence/fit-profiles.json`, real candidate import and associated tests/decisions.
- **[U14]** `SECURITY.md` diff and absence of mailbox-operability evidence.
- **[U15]** runner threat-model header, final checklist and OPEN items.
- **[U16]** M7 ledger, arena-app diff, retained quick-test source/tests and runner quick tasks.
- **[U17]** 2026-07-22 green gates, direct-boundary violations, user nuclear-option statement.
- **[U18]** legacy quick-test suite, runner quick-task source, proposed M-J/M-K definitions.
- **[U19]** `lib/battles/{validation,rating}.ts` and proposed M-L/M-M definitions.
- **[U20]** evidence/API/interface draft no-authorization clauses and absence of service source.
- **[U21]** `G:/Lacuna-demo/SUPERSEDED.md`, active Lakuna search, recovered session line 11772.
- **[U22]** recovered session lines 12167–12184 exact patch calls.
- **[U23]** `docs/ranking-and-audition-research-plan.md`, current llmfit primary repository description, and the pinned llmfit audit.
- **[U24]** Anubis primary repository and live benchmark-analysis pages checked 2026-07-22; no separate dataset license was established in this pass.
- **[U25]** `runner/src-tauri/src/verification.rs`, `lib/runtime/candidate-builder.ts`, M-E/M-J compatibility tests, and the additive M-A admission-receipt schema/fixtures.
- **[U33]** `runner/src-tauri/src/execution_lifecycle.rs`: one-use prepared authorization, single-active-run, monotonic progress, idempotent stop and terminal cross-binding tests.
- **[U34]** `runner/src-tauri/src/execution_protocol.rs` `llama-bench-v1` JSON protocol and expected identity; `runner/src-tauri/src/execution_lifecycle.rs` planned/observed backend-build match and completed-result gates.
- **[U35]** `runner/src-tauri/src/execution_protocol.rs` per-repetition invocation expansion and conservative caps; `runner/src-tauri/src/execution_process.rs` bounded child, watchdog and Windows Job Object lifecycle-control tests.
- **[U36]** combined benchmark/quick service tests and fixed quick protocol/result adapters; `docs/DECISIONS.md`.
- **[U37]** `runner/src-tauri/src/execution_transport.rs`, Tauri command registration and `tests/runner-boundary.test.mjs`.

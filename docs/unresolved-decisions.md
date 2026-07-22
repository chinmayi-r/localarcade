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
| U17 | Preserve passing fail-closed cores behind adapters; replace obsolete shells after M-A/M-O and screen approval. | No full repository rewrite is planned; shell replacement remains allowed in its future M-P checkpoint. | [U17] |
| U20 | Public service/API/storage work is deferred, not selected. | Retention, abuse, revocation, cost and security decisions remain mandatory before any future M-N checkpoint. | [U20] |
| U21 | Local Arcade and Lakuna remain separate products and permission boundaries. | Only explicitly versioned vendor-neutral contracts may be shared later. | [U21] |
| U22 | Repair the authority files in this documentation checkpoint. | Broken audit references are replaced with the approved eight-report baseline and new plan. | [U1][U22] |

## Still unresolved or deferred implementation/security decisions

| ID | Decision | Evidence / conflict | Options | Audit recommendation | Blocks |
|---|---|---|---|---|---|
| U8 | llmfit integration method and scope | Audit recommends adopt/wrap v1.1.6; no code imports it; current pure fit is green [U8]. | Rust library/FFI; subprocess; WASM/hosted; retain bespoke core. | Spike one adapter behind M-B and compare against current goldens before replacement. Decide license/distribution first. | M-B/M-F |
| U9 | Hosted vs local fit on website | No M-B implementation; website currently computes in TS; proposed docs mention multiple forms [U8][U9]. | Client TS/WASM; server/worker; static precomputed profiles. | Keep website no-install and fail-closed; choose only after performance/privacy/deployment measurements. | Website architecture |
| U10 | M-E serving-configuration source | Recommendations require complete settings, but installed serving-config import is absent [U10]. | Manual entry; adapters for known apps; model-file inference. | Manual confirmed settings first; add explicit app adapters later; never infer complete config from filename. | Runner handoff/verification |
| U11 | Cross-platform runner sequence | Vision is every device; current GPU detection is Windows-only and AC preflight uses Win32 [U2][U11]. | Windows first; parallel platform adapters; manual fallback. | Keep core cross-platform contracts now, ship manual confirmation wherever a reviewed adapter is absent, and label platform limits. | M-D/M-J release |
| U12 | Full benchmark trust boundary | R4 existing-engine slice passes, but bundled engine, T7 Windows sandbox, thermal/GPU telemetry, artifact hash binding and calibration transfer are missing [U12]. | Existing-engine only; complete R4; defer benchmark. | Preserve existing-engine observation as developer/advanced path; do not promote calibration or public release until the missing gates close. | Public runner benchmark |
| U13 | Can the checked-in local fit profile be published/recommended? | Exact raw/normalized values and identity are checked in and tested, but there is no approved contribution/publication chain [U13]. | Internal calibration evidence; reviewed registry evidence; remove from production candidates later. | Keep preserved and labeled local evidence; require source review and explicit policy before public publication. | Candidate coverage/public evidence |
| U14 | Security disclosure mailbox | `SECURITY.md` changed to `security@localarcade.dev`; repository cannot verify it exists [U14]. | Confirm mailbox; use another channel; mark TBD. | Confirm before release; do not advertise an unmonitored address. | Public security policy |
| U15 | Runner threat-model sign-off state | Header says approved; closing checklist is unchecked; T7 remains OPEN; future download/upload threats exceed current capabilities [U15]. | Reconcile checklist; split current/future models; revoke approval. | Split current runner boundary from future download/contribution annex and record explicit approvals per capability. | Download, update, contribution, full R4 |
| U16 | Disposition of retired M7 code | Navigation is removed and milestone retired; useful task/scorer definitions overlap runner quick tasks [U16]. | Keep indefinitely; delete now; migrate then retire. | Migrate mechanical fixtures into M-K/M-J contracts, prove equivalence, then delete dormant browser surface in an approved checkpoint. | Cleanup only |
| U18 | Where does quick-task execution belong? | Runner M-J owns current spawn; proposed M-K owns Solo Arena execution/results; legacy M7 owns task definitions [U18]. | All in M-J; all in M-K; split plan/result from execution adapter. | M-K owns C6/C7 plan/result and local history; M-J owns checked measurement/execution adapter. | M-J/M-K ownership |
| U19 | Where does battle validation belong? | `lib/battles` validates pairs/votes and rates them, but proposed M-L should own contribution intake [U19]. | Keep combined; split validation; duplicate boundary validation. | M-L validates contribution envelope/consent; M-M defensively validates rating input using shared M-A contracts. | M-L/M-M |
| U23 | Does Local Arcade materially improve recommendation decisions over llmfit? | Current llmfit already ranks fit/speed/quality/context and incorporates local/community measurements; Local Arcade's claimed advantage has not been evaluated [U8][U23]. | Adopt llmfit ordering; retain current Local Arcade policy; constraint/Pareto/diversity policy; learned ranking later. | Run the non-production comparison checkpoint in `ranking-and-audition-research-plan.md`; do not freeze M-H or M-O audition selection from intuition. | M-H/M-O |
| U24 | May Anubis leaderboard records be ingested or redistributed? | Anubis code is GPL-3.0 and its live Apple benchmark analysis is public, but repository code licensing does not by itself establish dataset redistribution terms [U24]. | Reference-only external validation; licensed snapshot ingestion; exclude. | Use reference-only matched comparisons until owner/legal review confirms dataset terms and provenance requirements. | External data ingestion; not reference-only research |

U8–U15 must be resolved at the checkpoint that first consumes them. U16 and U18 belong to the later private-Arena/cleanup sequence. U19 and the implementation/security parts of U20 remain outside the approved first slice. U23 must be reviewed before M-H/M-O; U24 blocks ingestion, not cited external validation.

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

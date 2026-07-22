# Document authority map

Audit date: 2026-07-22. This is a preservation report, not an implementation authorization.

Post-audit authority update: the product owner approved this report and the
other seven Wave 0 reports as the preservation baseline on 2026-07-22. The
owner subsequently approved the actual content of `PRODUCT-BRIEF.md`,
`screen-contract.md`, and `design-foundation.md`, resolved all ten first-slice
contract decisions, approved the execution-plan direction/order, and authorized
the root-owned M-A checkpoint. The missing standalone
repository-audit document is not to be searched for or recreated; the eight
reports collectively are the repository audit.

## Current authority overlay after preservation/U1–U7 approval

This table supersedes status/missing-reference cells in the preservation-time
inventory below where they differ. The older table remains evidence of the
state that was audited.

| Document(s) | Current status | Current role / consequence |
|---|---|---|
| `AGENTS.md`, `README.md`, `docs/README.md` | authoritative | Repaired orientation and authority chain; all named first-slice documents now exist. |
| `docs/PRODUCT-BRIEF.md` | product-owner-approved authority | Concise product purpose, first slice, boundaries and exclusions. |
| `docs/MILESTONE-STATUS.md`, executable tests/code, `docs/DECISIONS.md`, `docs/SECURITY-LEDGER.md` | authoritative for implemented state | They do not grant future feature scope. |
| Eight Wave 0 audit reports | authoritative preservation baseline | Evidence/classification authority; recommendations become build direction only where owner-approved. |
| `docs/screen-contract.md` | product-owner-approved authority | Sole active website/desktop/CLI screen matrix for the first slice. |
| `docs/design-foundation.md` | product-owner-approved authority | Approved cross-surface foundation; production UI still needs its checkpoint. |
| `docs/contracts/README.md`, schema, fixtures and compatibility reports | product-owner-approved contract | Frozen v1 first-slice boundary for M-A; not yet a production package. |
| `docs/worktree-execution-plan.md` | approved direction/order | M-A is authorized/root-owned; later checkpoints remain separately scoped. |
| `docs/interface-design-program.md`, `docs/ui-reference-and-screen-plan.md` | historical research | Retained/rejected decisions are recorded in `screen-contract.md`; neither is active screen authority. |
| `docs/prototypes/README.md` and four HTML files | historical design reference | Byte-preserved illustrative references; never production code/data. |
| `docs/modular-architecture-v2.md`, `docs/system-operation-graph.md`, `docs/evidence-ranking-api-ux.md` | proposed broader architecture/research | Limited by the approved first slice and frozen v1 contracts. Public-system sections remain deferred. |
| `docs/strategy-and-product-rationale.md` | proposed/contextual rationale | Concurrently added conversation context; its own status explicitly defers to the product brief, implementation audit, and unresolved ledger. It is not build authorization. |
| `docs/repository-audit-2026-07-21.md` | historical/convenience index | Concurrently appeared after U2 approval. It summarizes and links the eight reports but is not a ninth audit authority; its “approve U1–U7” next action is stale. The file is preserved unchanged for owner review. |

## Authority rule

Authority is determined by scope, committed implementation, executable tests, explicit status language, and recovered decisions—not by modification time. At the preservation capture, the repository's intended chain was broken: `AGENTS.md`, `README.md`, and `docs/README.md` required `docs/PRODUCT-BRIEF.md`, `docs/repository-audit-2026-07-21.md`, and `docs/worktree-execution-plan.md`, but none existed [A1]. The current overlay above records the approved repair and makes clear that no standalone repository-audit file is expected. The recovery report is authoritative only for locating the transcript and prototypes; its architecture is a proposal [A2]. The prototypes are design references, not production [A3].

Status meanings: **authoritative** = governs its stated implemented scope; **proposed** = candidate direction; **historical** = records a prior phase; **superseded** = replaced for active use; **incomplete** = needed content or approval is missing; **contradictory** = contains or depends on unresolved conflicts.

## Preservation-time Markdown inventory (status snapshot)

The following table records the state before U1–U7 approval and authority-chain
repair. It is intentionally not rewritten as if missing documents had existed
during the audit; use the current overlay above for present authority.

| Document | Purpose | Product / surface | Status | Evidence | Supersedes / conflicts | Missing references |
|---|---|---|---|---|---|---|
| `AGENTS.md` | Repository-wide product and execution rules | Website, runner, all modules | contradictory | It declares the current website/runner contract but requires two absent documents and M-A–M-P audit evidence [A1]. Its new text came from the interrupted audit [A4]. | Conflicts with the three-entry prototype arrival and older milestone-era navigation [A3]. | `docs/PRODUCT-BRIEF.md`; `docs/repository-audit-2026-07-21.md` |
| `README.md` | Public repository orientation | Whole product | incomplete | Dirty rewrite accurately separates website and runner, but links three absent documents [A1] and was applied in the interrupted audit [A4]. | Supersedes the HEAD README's narrower site description only provisionally. | All three absent documents in [A1] |
| `SECURITY.md` | Disclosure and current security boundary | Website and runner | incomplete | Current boundary matches runner crates/CSP and boundary tests; changed mailbox has no repository evidence of operation [A5]. | Replaces old Local Arena naming. | Verification of `security@localarcade.dev` |
| `design-system/README.md` | Palette and visual primitive usage | Shared visual system | authoritative | Matches `design-system/colors.css` and repository visual contract [A6]. | Conflicts with any prototype styling that departs from Forest palette. | None found |
| `docs/README.md` | Proposed documentation authority/read order | Whole repository | contradictory | Correctly warns against newest-file authority, but references three absent docs and a nonexistent repository `prototypes/` directory [A1]; created by interrupted audit [A4]. | Attempts to demote draft architecture/screens appropriately. | All three absent docs; `prototypes/` |
| `docs/MILESTONE-STATUS.md` | Audited implementation ledger | Current M-1–M9 and R1–R4 | authoritative | Explicitly says it is audited state, not roadmap; current gates pass [A7]. Dirty R4 expansion is not committed and must remain labeled partial. | Overrides milestone completion guesses in narrative docs. | None found |
| `docs/agent-plan.md` | Historical M-1–M9/R1–R4 execution contract | Legacy milestone program | historical | Its named milestones are implemented/retired in the status ledger; M-A–M-P is a later proposed target [A7][A8]. | Superseded as next roadmap by no approved document yet. | No approved successor execution plan |
| `docs/DECISIONS.md` | Decision log for implemented behavior | Website data/fit/ranking and runner | authoritative | Decisions map to current code/tests; dirty 2026-07-20 entries document the uncommitted fit/runner slice [A5][A7]. | Conflicts must be resolved explicitly, not by newer drafts. | None found |
| `docs/SECURITY-LEDGER.md` | Workflow/security audit ledger | CI and runner | authoritative | Rows correspond to checked-in workflows; dirty quick-task row matches current boundary tests [A5]. | None identified. | Hosted execution evidence remains external |
| `docs/evidence-evaluation-contract.md` | Evidence vocabulary, scope, fail-closed rules | Shared evidence and recommendation claims | authoritative | Declared M-1 contract; enforced by `tests/evidence-contract.test.ts` and `tests/evidence-ui-types.test.ts` [A9]. | Its legacy journeys do not freeze proposed screens. | None found |
| `docs/recommendation-decision-system.md` | Safety-policy decision tree | Recommendation behavior | authoritative | Executable policy and tests cover its branches [A10]. | Does not authorize the proposed orchestrator or UI. | None found |
| `docs/decision-tree.md` | Older journey and runner decisions | Website and runner | historical | Retains useful safety branches, but Tree/C labels predate the proposed C1–C12 contracts and M7 is now retired [A7][A8]. | Superseded for future architecture; still evidence for implemented legacy branches. | Approved replacement decision tree |
| `docs/localhost-quick-test.md` | Browser localhost experiment record | Retired website middle tier | historical | Explicitly marked retired; code/tests remain but navigation is removed [A7]. | Superseded by runner quick-task direction. | None found |
| `docs/persona-findings.md` | Manual persona walkthrough evidence | Current website | historical | Records observations and corrected anomaly; it is evidence, not a product contract [A5]. | Older UI findings may not apply after pivot. | Re-run against approved future screens |
| `docs/community-demand-research.md` | Directional community-problem sampling | Product strategy | proposed | Self-limits representativeness and proposes an “already own hardware” first route [A11]. | Tensions with broader three-route prototype and Discover→Audition→Contribute proposal. | Representative validation / owner approval |
| `docs/llmfit-core-adoption-audit.md` | Evaluate llmfit reuse | M-B/M-F design input | proposed | Pins upstream v1.1.6 and recommends adopt/wrap, while no production code imports llmfit [A12]. | Conflicts with treating current bespoke fit as final architecture. | License/integration decision; adapter contract |
| `docs/modular-architecture-v2.md` | M-A–M-P target architecture | All product modules | proposed | Labels itself a design draft and no-authorization document; current code does not conform [A8][A13]. | Conflicts with direct M-P imports into recommendation/accelerators and runner commands. | Approved contracts, dependency audit, implementation checkpoint |
| `docs/evidence-ranking-api-ux.md` | Candidate evidence/ranking/API contract | M-A, M-G, M-H, M-O, M-P | proposed | Explicitly withholds collection/build authorization [A14]. | Vocabulary and endpoint details require reconciliation with implemented evidence types. | Approved C-contracts and API decision |
| `docs/interface-design-program.md` | Approval-gated design program | Website, desktop, public/service | incomplete | Blocks UI/API implementation pending W0/W1 and later gates [A15]. | Screen IDs conflict with `ui-reference-and-screen-plan.md`. | Product-owner gate approvals |
| `docs/ui-reference-and-screen-plan.md` | Reference-backed screen inventory | Website, desktop, API | incomplete | Design research only; W0–W11/D0–D19/API0–14 disagrees with W0–W9/D0–D12/P0–P12 [A15][A16]. | Conflicts with interface program and portions of the recovered prototypes. | Reconciled/frozen inventory |
| `docs/system-operation-graph.md` | End-to-end data/control-flow proposal | M-A–M-P and surfaces | proposed | Declares design draft/no authorization and describes boundaries absent from code [A17]. | Conflicts with current direct UI→domain and UI→Tauri-command paths [A13]. | Approved orchestrator and contract schemas |
| `docs/runner-threat-model.md` | Runner threats and gates | Desktop runner | contradictory | Top says approved, while final sign-off checklist remains unchecked; future download/upload controls exceed current capabilities and Windows GPU sandbox is OPEN [A18]. | Current code is narrower than several modeled capabilities. | T7 Windows sandbox decision; final consistent sign-off |
| `lib/accelerators/README.md` | Current accelerator registry boundary | M-D precursor | authoritative | Matches catalog/lookup/validation and passing accelerator tests [A7]. | Future M-D adapter may supersede layout, not behavior. | Cross-platform adapter plan |
| `lib/battles/README.md` | Dark battle rating/validation core | M-M precursor | authoritative | Matches dark feature flag and passing battle tests [A7]. | Does not implement M-K execution or M-L public intake. | Pair generation, consent, contribution contracts |
| `lib/fit/README.md` | Current pure fit model boundary | M-F precursor | authoritative | Purity, golden, property, and two-pool tests pass [A7]. | Proposed llmfit adapter may replace internals while preserving contract. | Adapter decision |
| `lib/priors/README.md` | Current throughput prior rules | M-F precursor | authoritative | Scope/validation tests pass [A7]. | Proposed evidence graph may relocate records. | None for current scope |
| `lib/recommendation/README.md` | Current recommendation module boundary | M-H precursor | authoritative | Matches engine imports and passing tests [A7][A13]. | Future M-O must mediate surface calls. | Orchestrator contract |
| `lib/recommendation/ALGORITHM.md` | Explain current ranking algorithm | M-H precursor | authoritative | Editable boundaries correspond to implementation/tests [A10]. | Not authority for future screen order or public ranking. | None for current scope |
| `lib/registry/README.md` | Current artifact registry lifecycle | M-C precursor | authoritative | Matches discovery/import/snapshot/freshness tests [A7]. | Future M-C interface may wrap it. | None for current scope |
| `runner/README.md` | Runner scope and gates | Desktop runner | authoritative | Matches current commands, no-network boundary, and passing runner/root gates [A7][A13]. | Replaces Tauri scaffold boilerplate. | Future release/download decisions |
| `runner/packaging/README.md` | Draft packaging instructions | Desktop release | historical | Manifests retain TODO release fields; public release has not happened [A7]. | Superseded when real signed release coordinates exist. | Release URL/version/hashes |

## Audit deliverables created in this review

These files are authoritative only as a record of the 2026-07-22 audit. They do not become product or implementation authority by being newer.

| Document | Purpose | Product / surface | Status | Evidence | Supersedes / conflicts | Missing references |
|---|---|---|---|---|---|---|
| `docs/document-authority-map.md` | Classify every Markdown document and recovered external reference | Whole repository | authoritative | Requested Phase 2 deliverable; based on [A1–A21]. | Supersedes no product document. | Owner review |
| `docs/dirty-file-provenance.md` | Preserve Git state and classify every dirty file | Whole repository | authoritative | Requested Phases 1/3 deliverable; Git/diff/session/test evidence. | Supersedes no source history. | Owner review |
| `docs/module-status.md` | Assign every production source/test to M-A–M-P and a disposition | All modules | proposed | Requested classification; M-A–M-P itself remains proposed. | Conflicts are recorded, not resolved. | Approved C-contracts/architecture |
| `docs/module-ownership.md` | Propose ownership and conflict zones | All modules | proposed | Derived from current imports/tests and target architecture. | Supersedes no approved ownership map. | Owner approval |
| `docs/reuse-revise-retire-missing.md` | Preservation/replacement recommendation | All modules/surfaces | proposed | Requested review decision artifact. | “Retire” is recommendation only. | Owner approval |
| `docs/integration-test-matrix.md` | Map current and missing integration coverage | All modules/surfaces | authoritative | Current gate output and source/test mapping [A7]. | Supersedes no acceptance contract. | Live-env/platform evidence |
| `docs/unresolved-decisions.md` | Collect blockers and recommendations | Product, architecture, security | incomplete | Decisions intentionally await review. | Resolves nothing by itself. | Product-owner decisions |

## Recovered external references

| Reference | Authority | Use in this audit |
|---|---|---|
| `localarcade-transcript-recovery-and-code-recommendation.md` | authoritative for recovery locations; proposed for architecture | Locates two session JSONL files and four prototypes; its recommendations were compared to code/tests [A2]. |
| First-build-slice session `019f7d56…jsonl` | authoritative record of what was said/done; not automatic product approval | Establishes cross-device intent, private-vs-public Arena distinction, M-A–M-P proposal, audit admission, and exact interrupted patch calls [A4][A19]. |
| Four recovered HTML files | design reference only | Establish flows and visual ideas; all contain hard-coded/illustrative outcomes and one conflicts with the current website arrival contract [A3]. |
| `C:/Users/Chinm_user/Documents/LocalArcade/extracted-instructions-and-mermaid-report.md` | recovery aid | Confirms Wave 0/parallel-lane proposal; does not add approval [A20]. |
| `G:/Lacuna-demo` | superseded external project | Its own `SUPERSEDED.md` says it must not govern Local Arcade; active Lakuna contains no LocalArcade coupling [A21]. |

## Evidence index

- **[A1]** `git ls-files`, `rg --files`, and link checks on 2026-07-22; required files absent.
- **[A2]** recovery report, “How to use this report” and prototype/session paths.
- **[A3]** recovered `local-arcade-product-simulator.html`, `local-arcade-ui-flow-preview.html`, `local-arcade-ui-flow.html`, and `local-arcade-website-wireframes.html`; explicit demo/illustrative data and rendered screen flows.
- **[A4]** recovered session lines 12167–12184: patch calls for `.gitignore`, `AGENTS.md`, `README.md`, `docs/README.md`, and the honesty wording in `runner/src/main.ts`.
- **[A5]** `git diff -- <file>` against HEAD `a88c8dc`.
- **[A6]** `design-system/colors.css`, root `AGENTS.md` visual contract.
- **[A7]** 2026-07-22 `npm.cmd run check` in root (119 tests) and `runner/` (26 Rust tests plus checks/builds), both exit 0.
- **[A8]** `docs/modular-architecture-v2.md`, status/no-authorization text and M-A–M-P map.
- **[A9]** `lib/evidence/*`, `tests/evidence-contract.test.ts`, `tests/evidence-ui-types.test.ts`.
- **[A10]** `lib/recommendation/{engine,policy,ranking,strategies,presentation}.ts`, `safety-policy.mjs`, recommendation policy/engine tests.
- **[A11]** `docs/community-demand-research.md`, limitations and proposed first route.
- **[A12]** `docs/llmfit-core-adoption-audit.md`; `rg -i llmfit app lib runner scripts tests` returned no code references.
- **[A13]** import/IPC scan: `app/arena-app.tsx` imports recommendation directly; `configuration-panel.tsx` imports accelerators directly; `runner/src/main.ts` invokes hardware/scan/preflight/benchmark/quick-task commands directly.
- **[A14]** `docs/evidence-ranking-api-ux.md`, status and authorization limits.
- **[A15]** `docs/interface-design-program.md`, W0–W9/D0–D12/P0–P12 and approval gates.
- **[A16]** `docs/ui-reference-and-screen-plan.md`, W0–W11/D0–D19/API0–14.
- **[A17]** `docs/system-operation-graph.md`, status and operation flows.
- **[A18]** `docs/runner-threat-model.md`, header approval, final unchecked checklist, T7 OPEN.
- **[A19]** recovered session lines 11738, 11772, 11846, 11852, 11917, 11962, 11968, 12005, 12057, 12166, 12195.
- **[A20]** `C:/Users/Chinm_user/Documents/LocalArcade/extracted-instructions-and-mermaid-report.md`.
- **[A21]** `G:/Lacuna-demo/SUPERSEDED.md` and active `G:/lakuna-build/lakuna` LocalArcade search.

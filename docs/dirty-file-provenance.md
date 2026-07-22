# Dirty-file provenance

Preservation snapshot taken 2026-07-22 before this report was created. No pre-existing file was changed by this audit.

## Git snapshot

| Item | Recorded value | Evidence |
|---|---|---|
| Branch | `c1-gpu-throughput-priors` | `git branch --show-current` [P1] |
| HEAD | `a88c8dc863b12683a919c991d9ee52ac1042da9a` (`feat: benchmark user's own llama-bench with watchdog (R4 existing-engine)`) | `git rev-parse HEAD`; `git log` [P1] |
| Tracked modifications | 35 files | `git status --short`; `git diff --numstat` [P1] |
| Untracked | 14 files/paths (the evidence directory contains one file) | `git ls-files --others --exclude-standard` [P1] |
| Tracked diff | 9,070 insertions, 8,178 deletions | `git diff --stat` [P1] |
| Generated-registry component | 8,193 insertions, 8,095 deletions; semantically one new promoted artifact, 451 prior IDs unchanged | JSON identity comparison and `git diff` [P2] |
| Root gates | Pass: typecheck, lint, 119 tests, freshness, build | `npm.cmd run check`, 2026-07-22 [P3] |
| Runner gates | Pass: typecheck, fmt, Clippy, 26 Rust tests, build | `npm.cmd run check` in `runner/`, 2026-07-22 [P3] |

Recent history: `a88c8dc` benchmark watchdog; `b28a445` coverage-vs-fit; `e0dd0f5` live scan; `b04e6c8` model scan; `e9ba7ea` hardware detection; `db3eefe` runner scaffold; `639646e` runner decisions; `bddf8a5` accelerator registry; `fa02ee4` priors; `04c3e0a` dark battles [P1].

Classification terms: **complete** means coherent for its narrow dirty slice, not that the future module is complete. **Partial** means additional required behavior or documentation is absent. **Generated** means derived output. **Unclear** means provenance or operational truth cannot be established from repository evidence.

## Tracked modifications

Every row below existed at HEAD.

| File | What changed | Area / module | State | Exercised by | Interrupted-audit provenance | Evidence |
|---|---|---|---|---|---|---|
| `.gitignore` | Ignores the recovered Codex-style source directory/archive | Infrastructure | complete housekeeping | none | yes, exact patch | [P4] |
| `AGENTS.md` | Adds authority/read-order rules; revises website/runner contract | Repository governance | partial: two required docs absent | manual link audit | yes, exact patch | [P4][P5] |
| `README.md` | Reframes Local Arcade as finder + separate runner and adds architecture links | Repository orientation | partial: three links absent | product boundary tests only indirectly | yes, exact replacement | [P4][P5] |
| `SECURITY.md` | Updates name/contact and narrows claims to current runner | Security | unclear mailbox; boundary text complete | `runner-boundary.test.mjs` | no evidence it was patched in interrupted audit turn | [P6][P7] |
| `app/arena-app.tsx` | Removes retired browser quick-test navigation/rendering; passes system RAM | Website / M-P with M-H coupling | complete legacy retirement slice; architecture revision needed | empty-state, evidence UI, product contract | no; already dirty before recovered audit patch | [P6][P7] |
| `app/components/finder/configuration-panel.tsx` | Adds exact accelerator/platform selection, derived variants, explicit VRAM and RAM | Website / M-P, M-D | complete current finder slice; direct M-D import violates proposed M-O | evidence UI, recommendation engine | no | [P6][P7] |
| `docs/DECISIONS.md` | Adds thirteen decisions for exact fit evidence, preflight, repeatability, quick tasks, artifact route | Implemented decision record | complete record for dirty slice | corroborated by relevant tests | no | [P6][P7] |
| `docs/MILESTONE-STATUS.md` | Expands M1/M2/M4/R4 evidence and retires M7 | Status ledger | complete for current dirty slice, but uncommitted | gate suite | no | [P6][P7] |
| `docs/SECURITY-LEDGER.md` | Adds quick-task security row | Security | complete current boundary record | runner boundary test | no | [P6][P7] |
| `docs/agent-plan.md` | Adds M7 retirement/lifecycle note | Historical plan | complete note; plan remains historical | none | no | [P6] |
| `docs/decision-tree.md` | Retires localhost route and redirects task checks to runner | Historical/current safety policy | partial future mapping | policy/product tests | no | [P6][P7] |
| `docs/localhost-quick-test.md` | Marks browser experiment retired | Retired surface | complete historical annotation | quick-test/UI tests remain | no | [P6][P7] |
| `docs/persona-findings.md` | Corrects anomalous throughput interpretation and adds pass 3 | Website research | complete observation record; historical | none automated for narrative | no | [P6] |
| `lib/fit/index.ts` | Exports two-pool fit API | M-F | complete export | fit-memory-pools tests | no | [P6][P7] |
| `lib/recommendation/candidate-evaluation.ts` | Filters by platform/device; applies VRAM+RAM fit and fail-closed missing RAM | M-H/M-F/M-D | complete scoped logic; mixed responsibility under proposed architecture | recommendation engine tests | no | [P6][P7] |
| `lib/recommendation/catalog/real-candidates.ts` | Adds exact Qwen3-4B/RTX 3060 Laptop fit profile candidate | M-E/M-C/M-G | complete narrow evidence admission; raw provenance review remains | recommendation and fit-evidence tests | no | [P6][P7] |
| `lib/recommendation/presentation.ts` | Separates VRAM and system-RAM display | M-P presenter / M-H | complete current display slice | evidence UI tests | no | [P6][P7] |
| `lib/recommendation/types.ts` | Adds platform, accelerator ID, system RAM, two memory pools | Fragmented M-A contract | complete current types; revise into shared C-contracts | typecheck and recommendation tests | no | [P6][P7] |
| `lib/registry/discovery/hugging-face.ts` | Supports exact required artifact-file routes | M-C | complete discovery slice | importer/generated tests | no | [P6][P7] |
| `registry/generated/artifacts.json` | Regenerated registry; adds one Qwen3 Q4_K_M record | M-C | generated | registry generated/contract tests | no | [P2][P7] |
| `registry/locks/hugging-face.json` | Pins exact Qwen revision/file and discovery metadata | M-C | complete lock input | registry generated tests | no | [P6][P7] |
| `registry/policy/hugging-face.json` | Allows exact reviewed artifact route | M-C | complete policy input | registry generated tests | no | [P6][P7] |
| `runner/README.md` | Replaces scaffold boilerplate with actual boundary/gates | Runner docs | complete for current runner; not future release | runner/root gates | no exact recovered-audit patch | [P6][P7] |
| `runner/index.html` | Adds preflight consent and quick-task controls | M-P desktop | complete current thin UI; direct command calls need M-O | runner build/boundary, no DOM behavior test | no | [P6][P7] |
| `runner/src-tauri/Cargo.toml` | Enables Win32 power API | M-J adapter | complete Windows preflight dependency | runner compile/tests | no | [P6][P7] |
| `runner/src-tauri/src/benchmark.rs` | Adds complete identity, samples, repeatability, preflight, calibration eligibility | M-J | complete existing-engine observation slice; partial full R4 | Rust unit/live tests | no | [P6][P7] |
| `runner/src-tauri/src/lib.rs` | Registers preflight and quick-task commands | Current composition; proposed M-O boundary | complete current IPC; revise behind orchestrator | Rust identity tests, root boundary | no | [P6][P7] |
| `runner/src-tauri/tests/benchmark_live.rs` | Accepts verified or conditioned exact observations | M-J test | complete env-gated smoke | Cargo test (skip semantics when env absent) | no | [P6][P7] |
| `runner/src/main.ts` | Adds preflight/benchmark/quick-task UI and direct invokes; corrects capability wording | M-P desktop | partial future UI; current slice works | typecheck/build/boundary | mixed: only honesty sentence is exact interrupted-audit patch | [P4][P6][P7] |
| `scripts/discover-hugging-face.ts` | Reads exact required-file policy | M-C tooling | complete | registry workflow/generated tests | no | [P6][P7] |
| `scripts/ingest.ts` | Filters admitted files by required-file policy | M-C tooling | complete | registry workflow/generated tests | no | [P6][P7] |
| `tests/evidence-ui.test.tsx` | Covers exact accelerator and independent VRAM/RAM display | M-P/M-D/M-F test | complete | root test gate | no | [P6][P7] |
| `tests/recommendation-engine.test.ts` | Covers platform/device isolation and two-pool fail-closed behavior | M-H/M-F test | complete | root test gate | no | [P6][P7] |
| `tests/registry-generated.test.ts` | Covers exact artifact route and trust gates | M-C test | complete | root test gate | no | [P6][P7] |
| `tests/runner-boundary.test.mjs` | Enforces one checked llama-cli spawn and no network/write APIs | M-J security test | complete current boundary | root test gate | no | [P6][P7] |

## Untracked files

Every row below did **not** exist at HEAD (`git cat-file -e HEAD:<path>`/tracked-file check) [P1].

| File | Content / area | State | Exercised by | Interrupted-audit provenance | Evidence |
|---|---|---|---|---|---|
| `docs/README.md` | Proposed authority map/read order | partial/contradictory: missing docs and prototype directory | manual link audit | yes, exact creation | [P4][P5] |
| `docs/community-demand-research.md` | Directional community research | complete research note; proposed product direction | none | no; present before recovered audit patch | [P8] |
| `docs/evidence-ranking-api-ux.md` | Candidate evidence/ranking/API design | proposed, unapproved | none | no | [P8] |
| `docs/interface-design-program.md` | Approval-gated design program | incomplete pending approvals | none | no | [P8] |
| `docs/llmfit-core-adoption-audit.md` | llmfit reuse analysis | proposed; integration unresolved | no llmfit code | no | [P8] |
| `docs/modular-architecture-v2.md` | M-A–M-P target | proposed; current code nonconforming | none | no | [P8] |
| `docs/system-operation-graph.md` | Proposed end-to-end graph | proposed; no authorization | none | no | [P8] |
| `docs/ui-reference-and-screen-plan.md` | Alternative screen inventory | incomplete; conflicts with interface program | none | no | [P8] |
| `lib/fit/memory-pools.ts` | Pure discrete/integrated VRAM+RAM fit | M-F, complete scoped primitive | `fit-memory-pools.test.ts`; recommendation tests | no | [P7][P9] |
| `registry/evidence/fit-profiles.json` | Raw/normalized Qwen3 RTX3060 Laptop 4K/16K observations | M-G/M-F evidence; complete narrow record, publication provenance unresolved | fit-memory-pools and recommendation tests | no | [P7][P9] |
| `runner/src-tauri/src/preflight.rs` | CPU/RAM/AC inspection; thermal/GPU state explicit unknown | M-J, partial adapter coverage | Rust unit tests | no | [P7][P9] |
| `runner/src-tauri/src/quick_task.rs` | Three fixed mechanical llama-cli tasks, one checked spawn | M-J precursor to M-K; complete narrow slice | Rust unit/live and root boundary tests | no | [P7][P9] |
| `runner/src-tauri/tests/quick_task_live.rs` | Env-gated live checked-engine smoke | M-J test, complete smoke harness | Cargo test (no live run without env) | no | [P7][P9] |
| `tests/fit-memory-pools.test.ts` | Independent pools, monotonicity, raw evidence identity | M-F/M-G test, complete | root test gate | no | [P7][P9] |

## Provenance conclusion

The dirty tree contains three distinct layers and must not be treated as one rewrite:

1. **Committed baseline:** HEAD through the existing-engine watchdog (`a88c8dc`) [P1].
2. **Uncommitted implementation slice:** exact artifact admission, two-pool fit evidence, preflight/repeatability, and runner quick tasks. It is coherent and currently green, but only partially satisfies proposed M-J and does not implement M-O [P3][P6][P7].
3. **Interrupted authority audit:** exactly the five file edits established by recovered patch calls. Those edits introduced useful product separation but also broken references [P4][P5].

No timestamp was used as a classification criterion.

## Evidence index

- **[P1]** 2026-07-22 `git status --short`, `git diff --numstat`, `git diff --stat`, `git log -10`, `git ls-files --others --exclude-standard`, branch/HEAD commands.
- **[P2]** parsed HEAD/worktree `registry/generated/artifacts.json`: 451 shared IDs, one added Qwen3-4B Q4_K_M promoted artifact, quarantine count unchanged at 426.
- **[P3]** 2026-07-22 root and runner `npm.cmd run check`, both exit 0.
- **[P4]** recovered first-build-slice session lines 12167–12184 and their exact patch payloads.
- **[P5]** filesystem/link audit: absent `docs/PRODUCT-BRIEF.md`, `docs/repository-audit-2026-07-21.md`, `docs/worktree-execution-plan.md`, and repository `prototypes/`.
- **[P6]** per-file `git diff` against HEAD `a88c8dc`; semantic diff for JSON.
- **[P7]** named root/runner tests and gate output.
- **[P8]** recovered session lines 12005–12057 show these draft documents already present before the interrupted audit patch; each document's own status language.
- **[P9]** full source read of each untracked implementation/test file and its import/command wiring.

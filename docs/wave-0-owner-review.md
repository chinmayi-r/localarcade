# Wave 0 owner review packet

Status: **Approved; reconciliation/commit in progress**, 2026-07-22. No
production behavior or implementation worktree is part of the Wave 0 commit.

## Approval boundary established

- Approved: the eight-report preservation baseline and U1–U7 direction.
- Product-owner-approved: `PRODUCT-BRIEF.md`, `screen-contract.md`,
  `design-foundation.md`, the resolved first-slice schema/fixtures, and the
  direction/dependency order in `worktree-execution-plan.md`.
- Authoritative for current behavior: committed/dirty production code as
  classified, passing tests, `MILESTONE-STATUS.md`, and security/decision
  records in their implemented scope.
- Proposed: M-A–M-P target architecture and all future adapters/orchestration.

## Decisions resolved

The owner approved the brief, W/D/C screen matrix and design foundation, then
resolved platform semantics, lossless provenance, task/priority vocabulary,
artifact-size filtering, exact runtime identity, exact-detail evidence,
portfolio invariants, canonical handoff, split benchmark/quick-check records,
and typed envelope/domain failure semantics. See
[`contracts/compatibility-report.md`](contracts/compatibility-report.md).

## Verification

- `npm.cmd run docs:validate`: 51 Markdown files passed UTF-8, mojibake, and
  relative-link validation.
- `npm.cmd run contracts:validate`: 18 positive fixtures passed; 11 negative
  fixtures were rejected.
- Current path audit: 104 production + 31 test paths; 0 unrepresented.
- Root `npm.cmd run check`: passed typecheck, lint, 119 tests, freshness and build.
- Runner `npm.cmd run check`: passed typecheck, fmt, Clippy, 26 Rust tests and build.

## Proposed isolated commit

Suggested message: `docs: reconcile Wave 0 contracts and verification`

No commit has been created. The proposed commit is documentation/contracts
only, with the two validator dependencies required to reproduce the evidence.

### Include whole files

- `docs/PRODUCT-BRIEF.md`, `docs/README.md`, `docs/community-demand-research.md`,
  `docs/design-foundation.md`, `docs/evidence-ranking-api-ux.md`,
  `docs/interface-design-program.md`, `docs/llmfit-core-adoption-audit.md`,
  `docs/modular-architecture-v2.md`, `docs/repository-audit-2026-07-21.md`,
  `docs/screen-contract.md`, `docs/strategy-and-product-rationale.md`,
  `docs/system-operation-graph.md`, `docs/ui-reference-and-screen-plan.md`,
  `docs/validate-documentation.mjs`, and `docs/worktree-execution-plan.md`.
- All eight approved reports: `docs/document-authority-map.md`,
  `docs/dirty-file-provenance.md`, `docs/module-status.md`,
  `docs/module-dependency.json`, `docs/module-ownership.md`,
  `docs/reuse-revise-retire-missing.md`, `docs/integration-test-matrix.md`, and
  `docs/unresolved-decisions.md`.
- This review packet, every file under `docs/contracts/`, and exactly
  `docs/prototypes/README.md` plus the four recovered HTML files under
  `docs/prototypes/`.

### Include only these tracked-file hunks

- `AGENTS.md`: “Required orientation,” desktop boundary clarification, and the
  milestone-plan orientation hunk.
- `README.md`: all current diff hunks; they are repository orientation/status
  language only.
- `docs/DECISIONS.md`: only the four 2026-07-22 Wave 0 decisions (lines 3–27 in
  the current file). Exclude every 2026-07-20 implementation decision.
- `docs/MILESTONE-STATUS.md`: only the Wave 0 architecture-program table and
  the final “Current next checkpoint” paragraph. Exclude dirty M1/M2/M4/M7/R4
  implementation-row changes.
- `package.json`: only `docs:validate`, `contracts:validate`, `ajv`, and
  `ajv-formats`; `package-lock.json`: the lockfile resolution resulting from
  those two declared dev dependencies.

### Deliberately exclude

- Generated/data changes: `registry/generated/artifacts.json`,
  `registry/locks/hugging-face.json`, `registry/policy/hugging-face.json`, and
  `registry/evidence/fit-profiles.json`.
- Every production or test implementation change under `app/`, `lib/`,
  `runner/`, `scripts/`, and `tests/`, including the untracked memory-pool,
  preflight, quick-task, and live-test files.
- `.gitignore`, `SECURITY.md`, `docs/SECURITY-LEDGER.md`, `docs/agent-plan.md`,
  `docs/decision-tree.md`, `docs/localhost-quick-test.md`,
  `docs/persona-findings.md`, and `runner/README.md`.
- Build outputs, dependency directories, worktrees, staging, and commits.

The exclusion is mechanically evident in `git status --short`: registry and
implementation paths remain separate dirty/untracked entries, while the
candidate commit list contains only documentation, prototypes, validator
scripts, and validator dependency metadata.

## Recommended Wave 1 scope after approval

Preserve the tested domain cores; implement only M-A first-slice DTOs and
lossless adapters for owner-approved fields, then introduce M-O use cases behind
those adapters. Do not replace website/desktop/CLI shells until contract
round-trips and current behavior-equivalence tests pass.

Still prohibited before approval: production edits, implementation worktrees,
M-A/M-O coding, shell replacement, public Arena/service/contribution work,
staging, committing, or broad cleanup/reformatting.

# Local Arcade

Local Arcade helps people find complete local-model configurations that fit
their hardware, verify what actually happens on their machine, compare models
privately, and optionally contribute reproducible public evidence.

The website, desktop runner, public evidence service and developer interfaces
share evidence contracts but have different permissions. The website cannot
inspect a visitor's machine. The desktop app performs local inspection or
execution only after the corresponding explicit action.

## Start here

- [Product brief](docs/PRODUCT-BRIEF.md)
- [Strategy and product rationale](docs/strategy-and-product-rationale.md)
- [Documentation authority map](docs/README.md)
- [Audited implementation status](docs/MILESTONE-STATUS.md)
- [Approved Wave 0 preservation audit](docs/document-authority-map.md)
- [Proposed module/worktree execution plan](docs/worktree-execution-plan.md)
- [Approved consolidated screen contract](docs/screen-contract.md)
- [Approved first-slice shared contracts](docs/contracts/README.md)
- [Prototype handling rules](docs/prototypes/README.md)

## What exists today

- A no-install website finder backed by an immutable artifact registry, pure
  fit calculations, scoped throughput priors and typed evidence presentation.
- A Tauri desktop runner with consented Windows hardware detection, read-only
  local model discovery, controlled llama.cpp benchmarking and three
  mechanically scored quick checks.
- Dark, disconnected battle validation and rating math.
- CI, registry freshness, security-boundary and fail-closed contract tests.

Coverage is deliberately sparse. The current production recommendation adapter
contains only configurations with admitted artifact identity and explicit fit
profiles; the public UI is not yet the approved end-to-end V1 experience.

## Current build progress

This is the candid product-level view. A green internal module does not imply a
complete user journey.

```text
Internal foundations       █████████░  strong
Typed module boundaries    █████████░  direct local capture crosses M-D/M-I/M-E/M-O without exposing its receipts
Desktop runner workflow    █████████░  manual onboarding is user-operable and fixture/visual-proven; no live selected-model or restart proof
Website first slice        ███░░░░░░░  blocked by reviewed portfolio data
Private Arena              ░░░░░░░░░░  not started
Public systems             deferred
Complete user product      █████░░░░░  runner setup is usable; finder data and live-model proof remain
```

“Blocked by reviewed portfolio data” means that the replacement website cannot
yet produce a production recommendation through M-F/M-H. The runner no longer
requires a website-created JSON bundle for its primary journey: a person can
start with **Check this computer**, review detected hardware, choose an existing
local model and `llama-fit-params` executable, select a plain-language context
target, and preview the exact local capture. Website bundle import is preserved
under an advanced disclosure. No live receipt has yet been reviewed into a
production profile manifest or paired with an owner-approved concrete capacity
policy. Synthetic fixtures prove machinery only; neither surface is evidence of
a completed finder-to-live-verification product.

The remaining critical path to the first usable V1 is:

`one live U27 capture → reviewed M-F profile and capacity policy → real M-H
portfolio → M-O finder handoff → W1–W4 website → one live external-model
runner proof`.

The desktop-specific remainder is restart recovery and a user-observable run
against a pinned real model. Private Arena follows this path; public systems
remain deferred.

The executable gate-by-gate view is maintained in the
[capability handoff board](docs/capability-handoff-board.md), while the
[system build assembler](docs/system-build-assembler.md) shows dependency and
parallel-lane progress.

## Local verification

Requires Node.js 22.13 or newer.

```powershell
npm.cmd ci
npm.cmd run check
```

The desktop runner has its own gate suite:

```powershell
Set-Location runner
npm.cmd ci
npm.cmd run check
```

## Definition of done

A change may merge only when it has a concrete user outcome, tests that would
fail if the outcome regressed, no invented production claims, no new
high-severity dependency findings, and passing root and applicable runner
gates. Branch protection should require both `CI / verify` and
`CodeQL / analyze`.

## Product boundary

Local Arcade is independently useful and does not name or expose private
downstream products. Interoperability uses previewable, vendor-neutral
configuration and evidence bundles. Importing such a bundle never upgrades
public evidence into proof for somebody's private workflow.

The runner lives in this repository but remains a separate application,
permission boundary, build and release artifact. See [SECURITY.md](SECURITY.md).

## Recommendation policy

The implemented recommendation and execution branches are specified in
[the recommendation decision system](docs/recommendation-decision-system.md).
The proposed replacement boundaries are documented in
[the modular architecture](docs/modular-architecture-v2.md). Do not assume the
current engine already implements those proposed contracts.

The dependency-ordered implementation sequence is
[the worktree execution plan](docs/worktree-execution-plan.md). It creates no
worktree or authorization by itself; each production checkpoint requires
separate approval.

# Interface proof meetings

Status: **Wave 1 verification aid — no production authority.**

This document makes module progress reviewable like work delivered by separate
teams. A module is not accepted because its implementation exists or its test
count increased. Its review must show an exact input, exact output, rejected
input, preserved uncertainty, downstream consumer and a command that another
person can run.

The executable starting point is:

```powershell
npm.cmd run proof:interfaces
npm.cmd run proof:interfaces -- --json
```

The human form is intended for a review meeting. The JSON form is intended for
diffing, CI artifacts and later M-O end-to-end assertions. Neither command
changes production state.

## Proof meeting contract

Every module review answers these questions in order:

1. What user or upstream fact enters the boundary?
2. Which fields are required, optional, explicitly nullable or forbidden?
3. What normalization is allowed, and what information can it lose?
4. What exact success object leaves the boundary?
5. What exact blocked, unavailable, partial and error objects can leave it?
6. Which stable reason identifies every rejection or missing fact?
7. Which module consumes each output?
8. Can the consumer weaken, replace or hide the status?
9. Which command reproduces the positive and negative examples?
10. What remains unproved?

An interface proof fails if it needs an undocumented default, loses provenance,
turns unknown into a value, turns partial into complete, or describes behavior
that the command does not execute.

## Current team board

| Team boundary | Input shown at review | Output shown at review | Rejection/uncertainty proof | Consumer | Reproducible evidence | State |
|---|---|---|---|---|---|---|
| M-A shared contracts | versioned JSON fixtures | TS and Rust DTOs/envelopes | schema, semantic and forward-version negatives | all adapters; future M-O | `npm.cmd run contracts:validate`; root/runner contract tests | Proven at contract boundary |
| M-B llmfit boundary | equivalent hardware/task/config facts | normalized advisory result | unsupported/lossy mapping | M-F | research checkpoint only | Paused: provider decision required |
| M-C registry | source record and immutable identity facts | admitted/quarantined registry identity | stale, duplicate, incomplete and ambiguous records | M-E, M-I | registry contract/freshness/boundary tests | Proven adapter seam |
| M-D hardware | manual or consented detected facts; for U31, imported target plus a separately resolved target and exact acknowledgement when required | normalized hardware target with origins; process-local confirmation receipt retaining imported/resolved/effective snapshots after material-fact comparison | unknown memory/capacity/unified-memory facts, contradiction, ambiguity, OS/accelerator mismatch, RAM difference beyond tolerance, missing or inexact acknowledgement | M-F; M-J through M-O | hardware target TS/Rust tests; `cargo test --manifest-path runner/src-tauri/Cargo.toml --test hardware_confirmation` | Target adapter and U31 producer core proven; sealed receipt is consumed by the process-local M-O preview assembler |
| M-E runtime candidate | registry identity plus every runtime/package/compatibility fact | exact candidate plus separate admission receipt after success | missing fields, unknown build/backend/package/compatibility | M-F, M-J; future M-O | runtime candidate and M-A receipt tests | Proven adapter seam |
| M-F fit/performance | exact M-E candidate and receipt, confirmed M-D capacities, independently complete runtime-scoped profile with raw observations, injected reviewed-record manifest, separately versioned owner-approved hardware/run-path-bound capacity policy, M-G evidence; M-B optional | admitted profile/policy values and an M-A `fit-evidence-assessment`; isolated U27 machinery can derive only from synthetic-classified repeated observations | unreviewed/incomplete source; caller-asserted local measurement; content-digest drift; identity/policy/evidence mismatch; malformed producer DTOs; unexplained policy; unapproved tight threshold | M-H | `npm.cmd run proof:mf-admission`; `npm.cmd run proof:mf`; `npm.cmd run proof:mf-profile-derivation`; `npm.cmd run proof:mf-production-readiness` | Assessment seam and synthetic collection machinery proven; trusted capture, reviewed production manifest and concrete policy remain unavailable |
| M-G evidence | scoped observation or prior | exact/compatible/lossy/unsupported evidence mapping | identity mismatch, pool loss and unsupported claims | M-F, M-H | evidence adapter/boundary tests | Proven adapter seam |
| M-H portfolio | complete recommendation request; exhaustive frozen universe; process-locally branded exact M-E candidate/receipt and M-F assessment; exact/lossy M-G evidence; reviewed familiarity signal only when present | M-A `recommendation-portfolio` (`unranked-compatible`, `coverage-gap` or `nothing-fits`) plus exhaustive internal candidate disposition ledger | post-admission mutation, identity/snapshot drift, contradictory exact evidence, unattributed gaps, unknown/tight fit, unsupported needs, no fit and no coverage | M-O | `npm.cmd run proof:mh` (23 behavior + 1 purity; every data output M-A-valid) | Isolated compatibility boundary proven with synthetic inputs; no ranked roles or superiority claim; real U27 inputs and M-O consumer remain missing |
| M-I inventory | explicit read-only scan request plus registry; optionally one user-selected retained size candidate | found/candidate/verified items, partial errors, or one non-authorizing exact-hash selection handle | alias, mutation, mismatch, ambiguity, stale identity and invalid registry | M-J through M-O/M-P | 13 inventory contract tests plus preview/surface tests | Proven boundary and deterministic consumer; native walkthrough remains partial |
| M-J verification preparation/execution evidence | sealed U31 hardware receipt, verified inventory, exact candidate/admission, guarded tools and fixed benchmark + quick-check plans with a complete sampler | typed plan; official benchmark JSON admission; fixed mechanically scored check observations after benchmark load admission; planned and observed backend/build/runtime remain separate | every prior mismatch plus malformed/ambiguous runner JSON, model/build/backend/runtime drift, sampler drift, quick identity/output drift and quick-only execution | typed process-local M-O service | existing M-J tests; `cargo test --manifest-path runner/src-tauri/Cargo.toml execution_service --lib`; combined Rust library suite | Genuine M-J preparation reaches combined benchmark→checks execution with fixtures; no pinned live tool/model or user/frontend proof; Job Object is not T7 isolation |
| M-O application use cases | opaque import/hardware/selection/tool handles, versioned plan policy ID and explicit side-effect acknowledgements | server-owned fixed plan plus typed opaque start/status/stop/result views | caller-authored plan/execution facts, replay/cross-ID, restart-lost references, malformed output and backend mismatch | M-P desktop adapter | `cargo test --manifest-path runner/src-tauri/Cargo.toml --lib` (80); focused preview/transport tests | Typed transport and server-owned plan proven and consumed unchanged by M-P fixtures; restart recovery and live model proof remain absent |
| M-P website/desktop/CLI | M-A/M-O responses only; desktop receives typed M-O previews and lifecycle views | approved D1–D6 states with stable status/reason/partial data and fully admitted completed results | import/empty/unavailable/consent/error/stale/replay/stop plus forged DTO, lifecycle and planned-set cases | user | `npx.cmd tsx --test tests/runner-surface.test.ts` (19); `node --test tests/runner-boundary.test.mjs` (11); responsive browser inspection | Desktop Core/Boundary/Handoff proven with deterministic fixtures and User partial; website remains legacy, CLI absent, no external-model run |

“Proven adapter seam” does not mean an end-to-end journey exists. M-O must
eventually demonstrate that the same status and stable reason emitted below it
arrive unchanged at M-P.

## First worked review: current ranking

`npm.cmd run proof:interfaces` executes the current
`lib/recommendation.recommend` boundary with three explicit requests:

- a supported configuration that fits but cannot be honestly ordered;
- an AMD request for which the catalog has no measured coverage;
- a covered CPU request for which nothing fits.

The proof expects three distinct outputs: `unranked`, `no-coverage` and
`nothing-fits`. It also executes the non-production comparison fixture and
shows mapping loss, justified exclusions, silent-miss counts, objective
coverage and unavailable measured metrics without a composite winner.

The review currently exposes four failures of the intended final boundary:

1. ranking still accepts legacy `RecommendationQuery`/`HardwareProfile`, not
   the approved M-A request and hardware target;
2. its output lacks a complete per-candidate disposition and reason-code
   ledger;
3. invalid strategy values throw rather than returning a common envelope;
4. surfaces are not yet forced through M-O.

These findings describe the legacy path. M-F and the compatibility-only M-H
boundary now resolve their isolated seams behind adapters; M-O still must prove
end-to-end status propagation before any surface switches.

## Acceptance rule for later surfaces

Before website, desktop or CLI replacement, one executable proof must inject
each lower-layer `blocked`, `unavailable`, `partial` and `error` fixture through
M-O and assert that M-P receives the same status, stable reason, provenance and
usable partial data. Import-boundary tests must separately prove M-P cannot call
M-C through M-N directly.

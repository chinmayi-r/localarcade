# First-slice worktree execution plan

Status: **Product-owner-approved dependency direction and ordering**, 2026-07-22. The M-A checkpoint is explicitly authorized and root-owned; later checkpoints still require their own visible scope contracts. This plan creates no worktree or branch by itself, and M-A must not use parallel implementation worktrees.

## Outcome

Deliver the approved path without public-system scope:

**owned-hardware website finder → scoped configuration portfolio → exact configuration detail → handoff → separately gated desktop detection/inventory/verification**.

The implementation preserves passing fail-closed cores, introduces versioned adapters and M-O orchestration, and replaces surface shells only after behavior is protected by contract tests.

## Preconditions for any worktree

1. This documentation/design checkpoint is reviewed and closed with all gates green.
2. The preservation baseline and disposition of the currently dirty implementation slice are explicitly recorded; no worktree is cut from an ambiguous or partially integrated tree.
3. The next checkpoint is posted in the exact `AGENTS.md` format with modules, deliverables, forbidden work, commands, evidence and stop conditions.
4. One integration owner controls shared contracts and cross-lane fixture changes.
5. No lane edits another lane's owned files without a visible checkpoint amendment.

## Dependency graph for the approved slice

```text
M-A shared contracts
 ├─ M-C artifact registry adapter
 ├─ M-D hardware adapter
 ├─ M-E runtime/candidate adapter
 └─ M-G evidence adapter
      └─ M-F fit/performance adapter ← M-B decision/spike
           └─ M-H recommendation portfolio

M-A + M-C + M-D + M-E
 ├─ M-I local inventory adapter
 └─ M-J verification adapter

M-C…M-J → M-O application use cases → M-P website and desktop surfaces

M-B + M-C…M-G + frozen comparison corpus
 └─ ranking and audition research → owner-selected M-H policy → M-O
```

M-K private Arena follows this plan in a later program. M-L, M-M surface integration, and M-N are excluded. The existing dark M-M core remains untouched.

## Checkpoint sequence

Each checkpoint runs root `npm.cmd run check`; runner-affecting checkpoints also run `npm.cmd run check` in `runner/`. “Complete” requires its own acceptance evidence before the next checkpoint consumes it.

### Checkpoint 1 — Completing M-A

**Deliverables**

- Move the approved schema and fixtures from documentation authority into a
  small shared contract package without changing their meaning.
- Provide canonical serialization/validation and matching versioned TypeScript
  and Rust DTOs from the same schema/fixture corpus.
- Add valid/invalid golden fixtures for all twelve payloads and five envelope states.
- Add cross-language round-trip, forward/unknown-version, unknown-enum,
  extra-field and required-field rejection tests.
- Implement lossless adapters from current types only where mapping is
  mechanical; unsupported semantics return explicit blocked mappings.
- Establish stable reason-code ownership and schema-version policy.
- Add dependency/import-boundary tests around the M-A package.

**Forbidden**

- No M-B/M-O, UI/CLI changes, private Arena, domain-algorithm changes,
  downloads, execution, updater, telemetry, accounts, uploads, public contracts,
  broad cleanup, test weakening, or lossy translation glue.

**Accept**

- Fixture/schema validation passes in isolation.
- TypeScript and Rust accept/reject the same corpus.
- Approved current→contract→current mappings round-trip losslessly and
  unsupported mappings fail explicitly.
- Dependency/import-boundary tests pass.
- Existing root/runner gates remain green.

**Stop conditions**

- Any requested field expands into contribution, voting, public service, download, updater, or private Arena scope.
- Any mapping would upgrade self-reported/detected data into verified evidence.
- Any approved field would need to be discarded or filled from an assumed default.

### Checkpoint 2 — Completing M-C

**Deliverables**

- Wrap existing registry discovery/admission/snapshot/freshness behind the M-C interface.
- Adapt promoted artifact records to exact-candidate artifact identity without changing registry lifecycle rules.
- Preserve deterministic generation, quarantine, immutable revisions, hashes, licenses and field provenance.

**Forbidden**

- No new publisher promotion, network path in page requests, model download, ranking, or fixture-derived production catalog data.

**Accept**

- Existing registry tests and new M-C contract fixtures pass; generated snapshot semantic identity is unchanged unless separately approved.

### Checkpoint 3 — Completing M-D

**Deliverables**

- Add website-manual and runner-detected hardware-target adapters.
- Preserve exact accelerator registry reconciliation, memory variants, manual confirmation and unknown/mismatch states.
- Add platform adapter seams; unsupported platforms return manual/unavailable states honestly.

**Forbidden**

- No automatic website detection, inferred VRAM, new native permissions, or recommendation logic.

**Accept**

- Known, ambiguous, mismatch, unknown, multiple-device and manual fixtures map identically across boundary tests.
- Current hardware and accelerator tests remain green.

### Checkpoint 4 — Completing M-E

**Deliverables**

- Wrap product/engine/build/backend/package compatibility.
- Build exact configuration candidates from M-C artifact identity plus explicit runtime settings.
- Preserve unknown settings as missing/blocked rather than defaults.

**Forbidden**

- No serving-config filesystem import yet, filename-only complete configuration, fit, ranking or download.

**Accept**

- Complete candidate fixtures pass; incomplete identities fail closed; current runtime tests stay green.

**Stop condition**

- U10 is required before adding serving-product configuration import.

### Checkpoint 5 — Completing M-G

**Deliverables**

- Adapt current evidence method/source/match dimensions to v1 normalized methods without information loss.
- Preserve provenance, uncertainty, exact configuration identity and typed display-claim derivation.
- Map local fit profiles and throughput priors through explicit source adapters.

**Forbidden**

- No public upload/publication, evidence promotion, ranking, or treatment of prototype values as data.

**Accept**

- Existing evidence/throughput/type tests and new mapping/rejection fixtures pass.

### Checkpoint 6 — Resolving and completing M-B

This checkpoint begins with a stop-and-review, not code.

**Required decision**

- Resolve U8/U9: llmfit license/distribution, library vs subprocess vs hosted/client form, version pin and side-effect boundary.

**Deliverables after approval**

- Implement one narrow llmfit adapter or explicitly approve the current fit core as the initial M-B-compatible provider.
- Preserve raw upstream output and attribute it as estimated; never admit artifacts or rank.
- Replay pinned upstream fixtures.

**Forbidden**

- No silent replacement of current fit math, no website network request without approved privacy/deployment contract, and no upstream composite quality/routing claim.

**Accept**

- Pinned replay tests, version-failure tests and root/runner gates pass.

### Checkpoint 7 — Completing M-F

**Deliverables**

- Expose current pure fit/two-pool/prior behavior through the M-F contract.
- Combine exact candidate, hardware, desired context, M-G evidence and approved M-B advisory result.
- Preserve separate device/system pools, performance ranges, blockers and uncertainty.

**Forbidden**

- No role assignment, response-quality inference, evidence-class upgrade or destructive replacement of green fit internals.

**Accept**

- All existing fit/property/golden/purity/throughput tests plus adapter equivalence pass.

### Checkpoint 8 — Ranking and audition research

Status: **Product-owner-approved for execution**, 2026-07-22. This checkpoint
may use parallel research worktrees after the isolated M-A commit.

**Deliverables**

- Re-audit the pinned and then-current llmfit candidate, fit, score, sort and
  benchmark behavior.
- Freeze consensus-sanity and measured-audition scenario corpora with exact
  inputs, source dates, provenance and data-use status.
- Compare llmfit, preserved Local Arcade, hard-constraint/evidence, Pareto and
  diversity-aware non-production baselines over identical representable inputs.
- Use Anubis as reference-only Apple validation until its dataset terms permit
  stronger use.
- Report runnable precision, supported-claim precision, consensus recall,
  diversity, calibration, regret, justified disagreement and decision cost.
- Recommend adoption of llmfit ordering, a minimal Local Arcade policy, or one
  specified M-H algorithm. See `ranking-and-audition-research-plan.md`.

**Parallel ownership after authorization**

- upstream-baseline, ranking-methods, consensus-corpus and apple-validation are
  isolated lanes; the root integration owner owns schemas, harness integration
  and the final comparative report.
- With four active slots, root plus three agents run concurrently; the remaining
  lane starts when a slot completes.

**Forbidden**

- No production ranking, M-H/M-O implementation, click/vote learning, external
  dataset ingestion without approved terms, GPL code copying, or public systems.

**Accept**

- The harness is reproducible, experimental algorithms have no production
  imports, disagreements are machine-explainable, missing evidence fails
  closed, and existing root/runner gates remain green.

**Stop conditions**

- Owner review is required before selecting M-H policy. Failure to demonstrate
  material value over llmfit is a valid result and defaults toward more upstream
  adoption rather than inventing a differentiating score.

### Checkpoint 9 — Completing M-H

**Deliverables**

- Consume an exhaustive, frozen candidate-universe receipt plus exact M-E
  candidate/receipt, M-F assessment and M-G evidence inputs.
- Emit at most five distinct model families with one representative exact
  configuration per family and an exhaustive internal disposition ledger.
- Apply hard compatibility first, then exact evidence, then only a directly
  supported requested priority. Use reviewed familiarity only as a disclosed
  tie-break and catalog position only as a deterministic convention.
- Preserve coverage-gap vs nothing-fits and unranked-compatible; do not invent
  ranked roles when comparative evidence is insufficient.

**Forbidden**

- No weighted “balanced” score, automatic context reduction, public
  leaderboard, universal-best claim, padding, domain I/O, direct surface
  import, or claim of superiority over llmfit.

**Accept**

- Focused tests prove exact identity binding, hard-fit/unknown distinctions,
  family dedupe, representative selection, no padding, exhaustive dispositions,
  deterministic permutation behavior and an M-A-valid output; the import
  boundary excludes legacy recommendation, registry, evidence-store and I/O
  dependencies.

**2026-07-23 checkpoint result:** the owner selected this minimal
compatibility-only policy after the research found no demonstrated ranking
winner. `lib/portfolio/` and `research/mh-portfolio/` implement the isolated
boundary. Synthetic handoff proof is complete; production use remains blocked
by U27 real M-F admission and the absent M-O orchestrator.

### Checkpoint 10 — Completing M-I

**Deliverables**

- Wrap read-only model-store scans behind inventory use-case DTOs.
- Preserve per-file errors, bounded traversal, duplicate grouping, verified-vs-size-candidate distinction and explicit named extra folders.

**Forbidden**

- No scan on launch, write/delete/convert/copy, execution, upload, or automatic hashing of every file.

**Accept**

- Existing integration/security tests plus the approved module-local inventory
  DTO mapping pass. The shared UI/orchestration envelope is deferred to M-O;
  this checkpoint does not expand M-A.

### Checkpoint 11 — Completing the approved existing-engine M-J adapter

**Deliverables**

- Bind preflight, exact artifact path/hash, checked engine build/backend, protocol and declared side effects into `verification-plan`.
- Map benchmark measurements and quick checks into separate typed plan/result
  contracts; the higher-level `verification-result` references both without
  pairing prompt/decode samples or collapsing evidence classes.
- Preserve stopped/failed partial observations and stable reason codes.

**Forbidden**

- No bundled engine, model download, updater, network, upload, claim of full R4, or clean calibration while required telemetry is unknown.

**Accept**

- Existing runner unit/integration/boundary tests and new plan/result fixtures pass.

**Implementation result — 2026-07-22**

- The pure M-J adapter is integrated and passes 15 focused tests plus the full
  runner and root gates. It consumes only M-I-verified identity, rehashes the
  selected artifact/tools, preserves partial typed results and has no IPC or
  network capability.
- U25 is resolved by an independently versioned M-A compatibility-admission
  receipt. M-E preserves its successful assertion and evaluated target facts;
  M-J requires a validated receipt and binds it to exact candidate, artifact
  hash, runtime, Windows architecture and package members. M-O must carry both
  together and may not reconstruct or imply a missing receipt.

**Stop conditions**

- U11/U12/U15 are resolved for this checkpoint as Windows-first,
  user-supplied-existing-engine and runner-no-network only. Stop before any
  cross-platform parity claim, bundled execution, child-network-isolation
  claim, sandbox, updater, download, upload or public benchmark/calibration
  claim; T7 remains open.

### Checkpoint 12 — Completing M-O

**Deliverables**

- Implement use cases for normalize hardware, request recommendations, get exact detail, create/import handoff, inspect hardware/inventory, preview verification, run/stop verification and retrieve result.
- Centralize consent sequencing and map domain failures to common envelopes/reason codes.
- Add canonical handoff serialization/hash/version checks.

**Forbidden**

- No reimplementation of registry, fit, evidence, ranking, scan or benchmark algorithms; no surface styling.

**Accept**

- Use-case integration tests cover every state in `screen-contract.md`.
- Mechanical tests prove M-P is the only future surface consumer and M-O owns orchestration only.

**Current authorized subset — 2026-07-23**

The product owner first approved U28–U32 and opened import validation, permission
preview, inventory orchestration, process-local hardware/tool receipt
production and verification-plan preview. This subset permits the versioned
task-to-context policy below M-O and the minimal non-authorizing Rust/Tauri IPC
facade needed to carry sealed receipts into M-J. It does not authorize
run/stop/result execution, production surface wiring, downloads, network
capability, uploads or public Arena. Those broader Checkpoint 12 deliverables
required a later explicit checkpoint. The subsequent approved U33–U37
checkpoint opened only fixed existing-engine execution and its opaque
process-local transport; production surface wiring remains excluded.

**2026-07-23 partial checkpoint result:** `lib/orchestrator/` implements and
proves the topology-neutral finder→M-H→exact-detail→current-v1-handoff path.
U28 is implemented as a separately versioned, independently hashed bundle
containing the unchanged v1 handoff plus the exact compatibility receipt. U29
validates schema, versions and both content hashes; fresh bundles may be
imported, while expired bundles remain inspectable but require explicit
confirmation before import. Neither path grants execution authority. U30
derives a context planning target below M-O and composes a complete M-A
request; its numeric v1 mappings are implementation-selected, reviewable
heuristics rather than measurements or separately owner-approved truth.
Permission preview and M-I inventory orchestration are proven. U31 compares
complete imported and separately detected material hardware facts and retains
acknowledged receipts process-locally. U32 guards the selected Windows
llama.cpp file across hash/fixed-version-probe/rehash and proves no backend or
authorization. The Rust preview assembler validates the bundle with its own
clock, accepts only sealed U31/U32 and exact M-I handles, samples preflight
locally, calls M-J and returns a non-authorizing plan. Seven preview IPC
commands are registered but absent from the frontend. M-O remains partial
because no production surface or run/progress/stop/result path is wired.

U33–U37 subsequently authorize the fixed existing-engine execution subset of
Checkpoint 12. The runner consumes a moved prepared verification and
runner-owned one-use confirmation; resolves fixed `llama-bench-v1` and
`existing-llama-cli-v1` protocols; runs bounded children sequentially; and
admits benchmark load identity before fixed mechanical checks. The complete
sealed sampler is passed to `llama-cli`; `llama-bench` validates but does not
exercise sampling. Quick-only execution is blocked because it cannot establish
the structured post-load backend/runtime receipt. Four typed opaque
start/status/stop/result commands are registered, while caller-authored
execution facts and legacy raw invoke registrations are excluded. The legacy
implementation functions are preserved. The M-P desktop application facade now
consumes the typed preview and execution commands; the website remains on its
legacy path and the CLI remains absent. Fixture gates pass 15 service, 5
transport and 79 combined Rust library tests.
No live external model or pinned `llama-cli` fixture is claimed. Job Object
ownership remains stop/timeout lifecycle control, not T7 network/filesystem
isolation.

### Checkpoint 13 — Completing website M-P

**Deliverables**

- Replace/revise the website shell with W1–W4 using only M-O/M-A.
- Apply `design-foundation.md`, one-form arrival, novice/expert disclosure, responsive/accessibility states and configuration-field motif.
- Preserve current evidence badges, source links, honest empty/coverage/no-fit behavior and private Sites deployment.

**Forbidden**

- No hero, three-card arrival, persistent app chrome, leaderboard, website detection/measurement claim, runner requirement, prototype data or public Arena.

**Accept**

- W1–W4 state matrix, keyboard/focus/error summary, responsive breakpoints, reduced-motion and product-honesty E2E pass; full root gate passes.

### Checkpoint 14 — Completing desktop M-P and end-to-end handoff

**Deliverables**

- Implement D1–D6 against M-O with separate detection, inventory and run permissions.
- Import and validate the website handoff; preserve manual/website-only alternatives.
- Add native UI integration coverage for permission previews, partial adapters, plan consent, progress, stop, result and failure.

**Forbidden**

- No action on launch, hidden scan, silent substitution, download, upload, public contribution, updater, or unsupported platform claim.

**Accept**

- D1–D6 and W4→D1 handoff fixtures pass; root and runner gates pass; security boundary tests remain green.

**2026-07-23 sequencing correction:** Checkpoint 13 remains dependency-blocked
by U27 because no real admitted M-F/M-H portfolio can feed the website M-O
path. The owner requested the next M-P build after the typed runner transport
was complete. Checkpoint 14 therefore proceeds independently against the
already-proven runner import/preview/execution inputs; it does not claim
Checkpoint 13, W4→D1 production handoff, or website parity complete. The
desktop D1–D6 facade and deterministic handoff tests are implemented; native
external-model proof remains a required remainder.

**2026-07-23 native-handoff batch result:** The user-selected size-candidate
path now has an explicit one-file hash promotion through M-I/M-O; it is
non-authorizing and never runs during a scan. The fixed verification plan is
constructed below M-O from a versioned policy identifier and opaque handles,
not from M-P-authored run counts or checks. M-P validates full completed-result
DTOs and binds measurement kinds, sample counts, check IDs and criteria to the
prepared plan before showing a measured result. U27 research now has
synthetic-only collection, derivation and policy-sweep proofs, but production
admission remains unavailable pending a trusted capture boundary and owner
approval of one concrete capacity policy. No external model was executed.

**2026-07-23 manual-onboarding result:** The approved D1 manual alternative is
now the primary desktop route. **Check this computer** performs only the
explicitly described read-only detection, then the person reviews the detected
machine before separately choosing inventory scan, exact artifact, existing
`llama-fit-params` executable, context target and capture consent. M-O creates
the exact candidate and experimental compatibility receipt below the surface
from those confirmed inputs and its visible fixed v1 capture policy. No website
bundle or user-authored capture ID is required. The unchanged import path is
preserved under an advanced disclosure. Surface, boundary and Rust proofs plus
desktop/390 px browser inspection pass; live-model execution, restart recovery,
downloads, network, upload and website/CLI wiring remain excluded.

## Deferred checkpoints

- CLI implementation: states C1–C5 are frozen as parity requirements, but implementation follows website/desktop unless separately prioritized.
- M-K private Arena: new product checkpoint after finder and verification are accepted; resolve U16/U18 there.
- M-L–M-N and M-M surface/service integration: excluded until an explicit public-system product, consent, security, abuse, retention and revocation program is approved.

## Worktree ownership when authorized

| Lane | Exclusive primary ownership | Shared-file rule |
|---|---|---|
| contracts | M-A package, schema fixtures, reason codes | Integration owner only changes canonical schema |
| registry-runtime | M-C/M-E adapters and tests | Consumes M-A; no UI/recommendation edits |
| hardware-fit-evidence | M-D/M-B/M-F/M-G adapters and tests | M-B choice gets its own checkpoint/branch |
| recommendation | M-H adapter/tests | Receives DTOs; no registry/evidence store imports |
| runner-domain | M-I/M-J adapters/Rust tests | No desktop presentation edits |
| orchestrator | M-O use cases/integration tests | Sole cross-domain composition lane |
| website | website M-P and E2E | M-A/M-O consumers only |
| desktop | desktop M-P/native UI tests | M-A/M-O consumers only |

Parallel work is allowed only after dependency gates are complete. M-C, M-D, M-E and M-G may proceed in separate worktrees after M-A; M-F waits for M-B/M-C–M-G inputs; surfaces wait for M-O.

## Integration and merge policy

- Rebase/merge order follows the checkpoint sequence, not completion speed.
- Every lane states the preservation-baseline commit and schema version it consumed.
- Generated files are reviewed semantically; large serialization churn is not accepted as evidence of changed behavior.
- A checkpoint that discovers new required scope stops and amends its user-visible contract before coding.
- No milestone is complete until its forbidden clauses are mechanically audited and the full applicable gates pass.

# Decisions

## 2026-07-23 — Pin the initial live capture protocol to the proven llama.cpp build

- **Decision:** The initial manual capture admits only llama.cpp build
  `b10061 (5d5306bf3)`. Its fixed command uses the build's real `--mmap` or
  `--no-mmap` switch; the `llama-bench`-specific `-mmp 0|1` spelling must not
  cross into `llama-fit-params`.
- **Evidence:** A real build-10061 invocation rejected the fixture-only
  `-mmp` spelling. After correction, three 8K and three 32K observations
  completed against the promoted Qwen3-4B Q4_K_M artifact on the detected RTX
  3060 Laptop GPU with identical output in each repetition. The packaged
  release binary also remained running through a launch smoke test.
- **Boundary:** Other llama.cpp builds remain unsupported until their exact
  tool grammar and output are independently proven. The observed memory output
  remains proposed-unreviewed evidence and grants no recommendation or serving
  authority.
- **Why:** A build string is not proof that a command-line grammar stayed
  compatible. Pinning the only proven build prevents fixture agreement from
  being mistaken for live interoperability.
- **Reversible:** Yes, by admitting another exact build after its own live
  protocol proof.

## 2026-07-23 — Make local desktop setup primary and bundle import optional

- **Decision:** D1 starts with one explicit **Check this computer** action.
  Website-created runner-import JSON remains supported under an advanced
  disclosure, but it is not required for local capture and is not presented as
  a normal user's starting point.
- **Boundary:** After explicit detection and confirmation, M-O may retain a
  process-local manual-flow handle. A user-selected registry-exact artifact,
  observed `llama-fit-params` build, and visible context choice may be assembled
  below M-O into the existing exact-configuration candidate and experimental
  compatibility-admission receipt. Those records authorize only the separately
  consented U27 capture; they grant no recommendation, serving, download,
  network, upload or public-evidence authority.
- **Hardware rule:** One detected CUDA device may be scoped visibly even when
  integrated display adapters are also present. The user must acknowledge that
  scope. Multiple CUDA devices, missing CUDA facts and unsupported platforms
  remain blocked rather than receiving an invented selection.
- **Fixed capture policy:** The v1 local-capture policy exposes its exact
  runtime/backend, F16 KV cache, full GPU-layer target, batch and micro-batch,
  parallelism, detected thread count, flash-attention, memory-map and two
  context targets in the preview. M-P collects the visible context choice but
  cannot author or silently replace the remaining policy.
- **Why:** The approved D1 contract already permits manual setup, and normal
  local-AI desktop products begin with local model/hardware setup rather than
  requiring a pasted transport envelope. Security receipts remain necessary
  internal evidence, not user concepts.
- **Remainder:** The path is process-local and fixture/visual-proven. It still
  needs one live selected-model capture, reviewed M-F admission, restart
  recovery and a separately approved distribution/runtime strategy.
- **Reversible:** Yes. The unchanged import path and versioned contracts remain
  available.

## 2026-07-23 — Keep native handoff authority below the surface

- **Implementation record:** Hashing a size-only inventory candidate requires
  one explicit user-selected path and returns only a non-authorizing M-O handle.
  The fixed verification plan is constructed in Rust below M-O from a versioned
  policy identifier and opaque producer handles. M-P cannot supply run counts,
  checks, paths or execution facts.
- **Admission rule:** M-P shows a completed measured result only after the full
  result DTO, lifecycle identity, plan IDs, exact measurement kinds and sample
  counts, and exact check IDs/criteria match the retained prepared plan.
- **Research limit:** U27 collection/derivation fixtures are
  `synthetic-machinery-only`. Caller-asserted local measurement remains
  blocked; only the separately bounded runner receipt may enter the raw
  collection bridge. Production readiness remains unavailable.
- **Limits:** This records the reversible implementation boundary; it does not
  approve a production M-F policy, execute a model, claim T7 isolation, or
  complete website/CLI/native user gates.

## 2026-07-23 — Implement U27 as a bounded exact-scope runner capture

- **Decision:** The runner may prepare and execute only an explicitly selected
  existing `llama-fit-params` executable against one hash-verified GGUF
  artifact after imported M-E admission, M-D confirmation and M-I selection
  are retained behind opaque M-O handles. The Windows-first protocol fixes all
  allocation-affecting llama.cpp flags, uses full CUDA offload, captures the
  selected context and four times that context, and requires three completed
  agreeing observations at each context.
- **Binding and permission:** The content-bound v1 receipt carries complete
  candidate, compatibility, hardware, artifact and tool content plus canonical
  SHA-256 bindings. Its one-use preview has no execution grant; a separate
  explicit local-process acknowledgement consumes it. The desktop surface
  verifies the returned receipt before display and labels it
  `proposed-unreviewed`.
- **Limits:** A receipt grants neither recommendation nor serving authority.
  It does not select an artifact, infer missing runtime flags, download or
  upload data, enable network capability, add child isolation, create a
  capacity policy or review a profile manifest. No live U27 run is claimed
  until a person selects an exact local artifact and performs the visible
  consent action.
- **Reversible:** Yes. The protocol is versioned and isolated behind M-O/M-P;
  adding a future platform adapter or capture version cannot relax v1 identity,
  consent, or no-authorization guarantees.

## 2026-07-23 — Advance the dependency-ready desktop M-P slice before website replacement

- **Decision:** Implement the approved D1–D6 desktop state contract against the
  typed M-O preview and execution boundary while leaving the website and CLI
  unchanged. The active UI calls one M-P application facade; only a separate
  composition root knows the Tauri transport. Preserve the prior desktop shell
  as historical source until explicit deletion authorization.
- **Why:** The desktop producer chain is available through M-O. Website
  replacement remains blocked by U27 because a real admitted M-F/M-H portfolio
  is unavailable. Waiting on that unrelated data dependency would leave the
  retired raw desktop calls user-visible despite a proven replacement
  transport.
- **Limits:** Deterministic surface fixtures prove machinery and unchanged
  handoff semantics, not a live external-model run, restart recovery,
  persistence, website/CLI parity, T7 isolation, downloads, network, uploads or
  Arena.
- **Reversible:** Yes. The application facade is injected and the historical
  shell remains preserved.

## 2026-07-23 — Split fixed verification checks from private Arena and expose only opaque execution references

**Decision U36:** M-J owns the fixed, configuration-bound mechanical-check
protocol, execution adapter and checked observations used by verification.
M-K owns future arbitrary-prompt private Arena plans/results, paired streaming,
comparison and local history. A combined verification executes
`llama-bench-v1` first, then the fixed `existing-llama-cli-v1` checks. A
quick-only run remains blocked because `llama-cli` output does not provide the
approved structured post-load backend/runtime receipt. The complete sampler
sealed into the M-J plan is passed exactly to `llama-cli`; `llama-bench`
validates the same runtime but does not exercise sampler settings.

**Decision U37:** M-O exposes typed start/status/stop/result commands using only
opaque process-local preparation/execution references and explicit
side-effect acknowledgements. Caller-authored executable paths, model paths,
argv, clocks, process identifiers, observations and authorization receipts are
not transport inputs. Unknown or restart-lost references fail closed. The
legacy raw benchmark and quick-task functions remain preserved for comparison,
but are no longer registered in Tauri's invoke handler. Registration is not
frontend wiring and grants no execution authority without consuming the sealed
prepared handle.

**Why:** This keeps exact local verification separate from later subjective
auditioning and prevents a frontend request from constructing execution facts.
Requiring benchmark load evidence before fixed checks avoids upgrading a
planned backend into an observed backend.

**Evidence:** `runner/src-tauri/src/execution_protocol.rs`,
`execution_result_adapter.rs`, `execution_service.rs`,
`execution_transport.rs`, the genuine `prepare_verification` reachability test,
combined/stop-during-quick tests, transport deserialization/reference tests and
`tests/runner-boundary.test.mjs`.

**Reversible:** New fixed protocol versions or M-K use cases may be added after
review. Reintroducing caller-authored execution facts, quick-only exact-backend
claims, or raw invoke registrations requires a new security decision.

## 2026-07-23 — Gate existing-engine execution with one-use receipts and runner-reported identity

**Decision U33:** One existing-engine verification run may be authorized only
by consuming the intact process-local prepared-verification handle. The runner
creates a separately versioned one-use authorization receipt from the sealed
plan, candidate, artifact and checked-tool identities; caller-authored IDs or
M-A JSON cannot create or replay that authority. Authorization is consumed by
start or by cancellation while queued. Only one execution may be running or
stop-requested at a time, and stop is idempotent.

**Decision U34:** For `llama-bench-v1`, the official per-run JSON record emitted
by `llama-bench` after model load is the runner-reported evidence for actual
backend, engine build, model identity and effective runtime facts. The parser
and record format are versioned. Observed backend and build remain separate
from the planned values and must exactly match the sealed plan before a
completed run can become exact verification evidence. A version probe, planned
backend, free-form stderr or caller assertion is not post-load evidence.
Missing, malformed, contradictory or mismatched runner identity blocks a
completed exact result while retaining an honest failure or partial record.
The approved M-A v1 plan/result schema remains unchanged; these are additive
runner-internal receipts wrapped around its terminal result.

**Decision U35:** `llama-bench-v1` launches one bounded child for each warmup
and each measured repetition, always with the tool's internal repetition count
fixed to one. This makes progress correspond to completed child boundaries and
allows earlier per-run JSON records to survive a later stop, timeout or crash.
The conservative v1 limits are at most 10 warmups, 20 measured repetitions and
24 total children, with the existing protocol output, timeout and argument
caps. On Windows, a kill-on-close Job Object owns the process tree for stop,
timeout and cleanup. It is lifecycle control only, not a T7 sandbox:
child-process network and filesystem/write isolation remain unenforced and
must be disclosed as false.

**Why:** The approved M-A contracts describe plans and terminal evidence, not
replayable execution permission or live process truth. Process-local one-use
authority prevents a valid preview from becoming a standing credential.
Per-child records provide reviewable progress and partial retention without
inventing samples, while post-load runner identity prevents the planned
configuration from being reported as the configuration that actually loaded.

**Evidence:** `runner/src-tauri/src/execution_lifecycle.rs` and its focused
one-use, monotonicity, identity-match and terminalization tests;
`runner/src-tauri/src/execution_protocol.rs` protocol constants, caps,
single-repetition invocation expansion and boundary tests; and
`runner/src-tauri/src/execution_process.rs` fixed argv, bounded streams,
watchdog and Windows Job Object process-tree control tests. The upstream
[`llama-bench` output documentation](https://github.com/ggml-org/llama.cpp/blob/master/tools/llama-bench/README.md#output-formats)
labels the emitted `backends` value as the run's backend and documents the
per-run JSON identity/settings fields consumed by the versioned parser.

**Reversible:** Yes. Later protocol versions or reviewed platform process
controllers may be added without changing M-A v1. Relaxing exact identity,
one-use authority, limits or isolation disclosures requires a new explicit
security/product decision.

## 2026-07-23 — Admit only independently complete M-F source records

**Decision:** A profile source must independently carry every
allocation-affecting M-E runtime field, exact artifact/candidate/hardware/run
scope, valid allocation facts, retained raw observations and traceable
exact-measurement provenance.
Admission may compare those facts with M-C/M-D/M-E outputs, but may not copy
missing values from them. Capacity policy is a separate versioned record bound
to the hardware target, operating system and run path, with an explicit owner
approval reference and imported provenance. Each exact record must match an
injected reviewed-manifest entry by canonical SHA-256; policy entries require
`owner-approved` status. That manifest is a repository/assembler trust root and
must never be supplied by a user request. Only branded outputs from these pure
admission functions enter the typed M-F assessment input; M-F repeats critical
checks at runtime.

The checked Qwen profile remains preserved legacy evidence. Its internally
consistent 4K/16K arithmetic is not proof of a complete runtime-scoped profile,
and it is rejected with all absent fields named. No production capacity-policy
record is created by this decision.

**Why:** Otherwise a loader could take a partial historical record, copy the
current candidate's missing settings into it, and make the source appear more
specific than the evidence. Keeping profile evidence and reserve policy
separate also prevents old recommendation constants from becoming unattributed
measurement facts.

**Reversible:** Yes. Reviewed real profile records and owner-approved policy
instances can pass the existing boundary without changing M-A or the fit cores.

## 2026-07-22 — Keep M-F profile and capacity facts explicit

**Decision:** M-F accepts only an M-E candidate paired with its admission
receipt, confirmed or detected capacity origins, and a fit profile bound to the
complete runtime configuration, artifact hash, selected accelerator and
hardware scope. Device/host reserves and safety margin arrive in a separately
attributed `confirmed-capacity-minus-reserve` policy. The evaluator never
derives these facts from a model name, GPU label, transient free-RAM sample or
llmfit suggestion.

The existing `good` result means every required pool and context limit passed.
`does-not-fit` means a hard pool or context limit failed. M-F does not emit
`tight`: no product-owner-approved threshold currently defines that label.
Unified-memory split profiles, multi-device aggregation, unsupported M-G
evidence and purported successful M-B advice all fail closed.

**Why:** The preserved arithmetic is reliable precisely because all
runtime-dependent inputs are explicit. The current checked profile omits some
M-E settings that can affect allocation, and M-B has no verified family
crosswalk. Treating either as complete would hide a missing upstream interface.

**Reversible:** Yes. A reviewed profile-admission adapter, unified-memory
profile or approved tightness policy can extend the boundary without replacing
the fit cores or changing existing exact assessments.

## 2026-07-22 — Use a pinned direct llmfit-core M-B provider spike

**Decision:** Implement the isolated M-B provider spike with the direct
`llmfit-core` Rust crate pinned to official release `v1.1.6`, commit
`aaa2bc179cec214ccdc44501c853b98fba0b343b`, behind a Local Arcade-owned
explicit-input adapter. Disable installed-provider discovery, local benchmark
history, embedded community evidence and localmaxxing evidence. Retain the
llmfit CLI subprocess only as a black-box research/regression oracle. Website
execution remains deferred under U9.

The dependency audit found that upstream unconditionally compiles HTTP,
provider, update and sharing code and embeds community/localmaxxing data even
when the selected formula path does not call them. Therefore this checkpoint
keeps the crate outside the runner and every product surface. Linking or public
distribution requires a later security/licensing decision; the current spike
does not weaken the runner's zero-HTTP-client contract.

**Why:** The approved research checkpoint showed that direct core APIs are the
best candidate for controlling inputs, while the CLI mixes partial overrides
with host detection, provider scans and fail-open enum parsing. The adapter
must preserve upstream attribution without admitting artifacts, changing
Local Arcade ranking, upgrading evidence or replacing the passing fit core.

**Reversible:** Yes. M-B is a replaceable provider boundary. A future checkpoint
may replace the crate, change the pin or remove M-B after replay/equivalence
review, but may not silently change the Local Arcade contract or evidence
semantics.

## 2026-07-22 — Require comparative ranking research before M-H/M-O

**Decision:** Approve the non-production ranking/audition research checkpoint
and parallel worktrees after the isolated M-A commit. Treat llmfit as the fit
and recommendation baseline, audit its community-submission pipeline, compare
constraint/Pareto/diversity alternatives on frozen scenarios, and use Anubis as
reference-only Apple evidence until dataset terms permit stronger use.

**Why:** Local Arcade has not proved a recommendation improvement over llmfit.
The algorithm must earn adoption through runnable precision, evidence honesty,
calibration, diversity, regret and decision-cost results rather than aesthetic
preference.

**Reversible:** Yes. A negative result explicitly permits adopting more llmfit
and focusing Local Arcade on exact identity, verification and auditioning.

## 2026-07-23 — Use a compatibility portfolio, not an unproved ranker, for M-H

**Decision:** M-H may return at most five distinct model families and exactly
one representative exact configuration per selected family. It applies hard
compatibility first, then prefers stronger configuration-bound evidence, then
only the user's directly supported priority. Reviewed popularity or familiarity
may break an otherwise unresolved tie only when its source and scope are
disclosed; it is never evidence of quality. A final stable catalog position is
a non-semantic determinism convention. Every candidate must remain visible in
an internal disposition ledger, and an insufficient set must not be padded.
Compatibility-only results use the approved unranked portfolio state and leave
ranked roles null.

**Why:** The non-production research did not demonstrate ranking superiority
over llmfit on matched real inputs. The first slice needs a small, honest set of
complete configurations, not a novel weighted score. Quantization remains part
of each exact configuration: M-H chooses one representative quantization for a
family from admissible fit/evidence facts and the requested priority, while
other quantizations remain explicit alternatives in the ledger for the future
configuration-detail path.

**Reversible:** Yes. A later, separately approved ranking policy may replace
this rule after matched evaluation demonstrates value without weakening fit,
evidence, provenance or no-padding guarantees.

## 2026-07-23 — Preserve handoff v1 and add a portable runner import bundle

**Decision:** Resolve U28 with a separately versioned runner import bundle that
contains the unchanged v1 `runner-handoff` plus the exact M-E
`compatibility-admission-receipt`. The bundle must bind both payloads and fail
closed on version, schema, content-hash, candidate, artifact, runtime or
compatibility drift. It is transport evidence only: it contains no model data
and grants no detection, scan, hashing or execution authority.

**Why:** M-J requires the independently validated compatibility receipt, while
the approved v1 handoff does not contain it. Reconstructing that receipt on the
desktop or relying on a hidden sidecar would break the self-contained portable
trust boundary. A new outer bundle preserves frozen v1 compatibility.

**Reversible:** The bundle can gain a future version after explicit contract
approval. Runner-handoff v1 remains unchanged.

## 2026-07-23 — Treat handoff expiry as informational

**Decision:** Resolve U29 by allowing an expired bundle to be inspected and
imported only with a visible warning/confirmation. Age alone is not execution
authorization and is not a tamper result. Invalid schema/version/content hash
or identity binding remains blocked.

**Why:** The approved handoff describes its 24-hour expiry as informational and
already carries `sideEffectAuthorization: false`. This preserves useful
inspection without weakening integrity or consent boundaries.

**Reversible:** A later version may adopt a harder freshness policy after its
workflow and recovery consequences are reviewed.

## 2026-07-23 — Own novice task-to-context policy below M-O

**Decision:** Resolve U30 with a small, independently versioned policy module
below M-O. It derives a novice context recommendation from task and scope.
Expert settings may supply an explicit validated override. M-P displays and
collects the decision but must not invent token defaults.

**Why:** Context materially changes fit and speed, while novice users generally
cannot choose a raw token count. Keeping the rule below orchestration makes it
testable and replaceable without coupling policy to website components.

**Reversible:** Policy versions and mappings may change after evidence and
owner review; explicit overrides remain attributable.

## 2026-07-22 — M-A is a closed wire boundary with isolated legacy adapters

**Decision:** Implement the approved v1 first-slice DTOs, validation and
canonical handoff serialization as dependency-free TypeScript/Rust contract
cores. Keep current recommendation/hardware translations in an explicit
TypeScript adapter; unsupported or lossy translations return `mapping.*`
blocked results. Reject forward schema versions. Do not expose a Tauri command
or change any production consumer during M-A.

**Why:** This makes the approved contract independently testable in both
languages while preserving the passing legacy domain cores until their owning
module checkpoints. It also prevents a convenience translation from silently
inventing the newly required runtime, provenance or memory fields.

**Reversible:** Yes. Adapter implementations and package layout may change
without changing v1 wire meaning; changing the v1 schema itself requires owner
approval.

## 2026-07-22 — Approve first-slice authorities and resolve contract v1

- **Decision:** Approve the actual content of `PRODUCT-BRIEF.md`,
  `screen-contract.md`, and `design-foundation.md`; approve the dependency
  direction/order in `worktree-execution-plan.md`; and freeze the resolved v1
  schema. V1 separates OS from accelerator kind/vendor/backend, preserves
  lossless provenance and exact runtime/evidence detail, uses current
  task/priority vocabulary, keeps artifact-size filtering without download,
  enforces portfolio invariants, defines a canonical 24-hour informational
  handoff, separates benchmark and quick-check records, and distinguishes
  use-case envelopes from captured run outcomes.
- **Why:** These decisions remove lossy or overloaded seams before M-A and keep
  the first slice honest across website, runner, CLI, TypeScript, and Rust.
- **Reversible:** Breaking field/enum/meaning changes require a new schema
  version and migration fixtures. No production behavior is authorized beyond
  the separately scoped root-owned M-A checkpoint.

## 2026-07-22 — Approve the Wave 0 preservation baseline and first slice

- **Decision:** The eight 2026-07-22 audit reports listed in `docs/README.md` are the repository audit. `docs/PRODUCT-BRIEF.md` is the concise product authority. The first implementation slice is owned-hardware website finder → scoped configuration portfolio → exact configuration detail → handoff to the separately gated desktop runner.
- **Why:** The recovered repository contains valuable passing cores, conflicting design eras, and partial audit edits. A reviewed baseline permits modular progress without treating timestamps, prototypes, or draft architecture as implementation truth.
- **Reversible:** The first-slice sequence may be extended by a later reviewed product decision. Preservation evidence remains historical fact.

## 2026-07-22 — Use one utility-first website arrival

- **Decision:** Arrival presents one immediately usable hardware/task form with one primary action. Secondary journeys may be links. Three equal entry cards, a marketing hero, persistent app chrome, and an arrival leaderboard are rejected.
- **Why:** The website must deliver no-install value immediately and must not resemble a desktop application or imply public ranking evidence before inputs exist.
- **Reversible:** Layout details may change within the same utility contract; changing the arrival model requires a product-brief revision.

## 2026-07-22 — Sequence private Arena after finder and verification; defer public systems

- **Decision:** Private Arena remains planned local product scope after finder and runner verification. Public Arena, uploads, voting, contribution contracts, and public evidence service remain deferred.
- **Why:** Private audition can build on exact local configurations and measurements. Public systems add consent, abuse, retention, revocation, security, and service boundaries that are unnecessary for the first slice.
- **Reversible:** Public work may be opened only through a later explicit contract/security checkpoint.

## 2026-07-22 — Direct consolidation and limit the contract-freeze scope

- **Decision:** Produce one consolidated screen matrix while preserving the two inventories as research, and freeze only the smallest first-slice contract set. The owner subsequently approved the matrix and resolved schema v1. Public contribution/service contracts remain excluded.
- **Why:** A smaller versioned boundary is enough to connect the approved journey, minimizes speculative API commitments, and creates testable seams around passing code.
- **Reversible:** Additive optional fields require review; breaking changes require a new schema version and migration fixtures.

## 2026-07-20 — Separate exact observations from clean calibration baselines

- **Decision:** `verified-local` continues to mean the exact engine/model/configuration produced stable repeated measurements on this machine. A separate `calibrationEligibility` gate controls whether that observation may rescale other recommendations. Calibration fails closed for unstable samples, every adverse preflight condition, unknown power source, unknown thermal/throttling state, or unavailable/active concurrent-GPU telemetry.
- **Why:** A steady competing workload can produce internally repeatable but systematically depressed throughput. That is still a real exact observation, but it is not evidence of the machine's uncontended baseline. Conflating these claims caused the original anomalous run to look more authoritative than it was.
- **Reversible:** Yes. Reviewed telemetry adapters can satisfy individual unknown conditions without changing stored observation identity.

## 2026-07-20 — Do not infer background CPU contention from total in-run CPU use

- **Decision:** The current runner does not label high CPU utilization during inference as external interference.
- **Why:** `llama-bench` legitimately consumes CPU for orchestration and partial offload. Total system CPU load cannot distinguish that work from a compiler or another application without reliable per-process accounting. A misleading monitor would be worse than an explicit telemetry gap.
- **Reversible:** Yes. A future process-attributed sampler can add this evidence.

## 2026-07-20 — Run fixed quick tasks directly through existing llama-cli

- **Decision:** The runner reuses the retired browser experiment's three public prompts and mechanical scoring rules, but replaces its localhost HTTP transport with an exact checked `llama-cli` path from the user-selected existing llama.cpp installation. Tasks run sequentially, at temperature 0 and seed 1, with per-task watchdogs and build-default context/offload/batch settings recorded as such. Reports expose individual outcomes and the immutable claim boundary `mechanical-task-checks-only`; they contain no aggregate quality score.
- **Why:** Starting a local server and adding an HTTP client would expand attack surface for no product benefit. Direct single-turn execution preserves exact engine/model identity and keeps the runner offline. Forced `-ngl` overrides stalled this local `llama-cli` build, while its build defaults completed; task compliance does not require throughput tuning.
- **Reversible:** Yes. A future product adapter can replace the execution transport while retaining the fixed task/scorer contract and claim boundary.

## 2026-07-20 — Drain llama-cli output concurrently

- **Decision:** The quick-task child’s stdout is drained on a dedicated reader thread while the watchdog polls process completion.
- **Why:** A real-machine run exposed a Windows pipe deadlock: `llama-cli` filled stdout with its startup interface while the parent waited for process exit. The same command completed in a terminal. Concurrent draining is the standard subprocess requirement when output can fill a pipe.
- **Reversible:** Yes. Structured output or a future engine adapter could replace the parser and pipe handling.

## 2026-07-20 — Treat benchmark preflight thresholds as conditioning policy

- **Decision:** Before each existing-engine benchmark, sample baseline CPU usage and available system memory, and read Windows AC status through `GetSystemPowerStatus`. CPU load at or above 25%, available RAM below 20%, or confirmed battery operation requires explicit user confirmation and is recorded with the result. These are conservative conditioning thresholds, not claims of unsafe hardware. Unknown power and temperature readings remain visible as unknown. Temperature is not collected on Windows because enabling `sysinfo`'s component path would add WMI/security dependencies for a sensor that is not reliably exposed.
- **Why:** Background load, memory pressure, and battery power can materially distort a benchmark. The runner should prevent accidental baseline promotion without blocking an informed user from capturing a conditioned observation. Inventing a healthy thermal state would be worse than admitting the sensor is unavailable.
- **Reversible:** Yes. Thresholds are isolated in the preflight policy and can be revised from empirical validation; a future reviewed sensor adapter can replace the explicit thermal unknown.

## 2026-07-20 — Separate a local observation from a verified benchmark baseline

- **Decision:** The existing-engine benchmark runs three repetitions per metric by default. A metric is stable only when it has at least three valid samples whose max-minus-min range is no more than 20% of the median. Every metric must be stable for the report to receive `verified-local`; otherwise the valid result is retained as `conditioned-local` with per-metric reasons and raw samples.
- **Why:** One successful process exit proves that an observation occurred, not that it is repeatable enough to calibrate other recommendations. A relative range is scale-independent and auditable. Repeatability does not declare a consistently low result erroneous; comparison with a separately admitted matched baseline would be needed for that judgment.
- **Reversible:** Yes. The threshold and robust statistic can change with validation data while the raw observations and stable/conditioned boundary remain explicit.

## 2026-07-20 — Admit one exact reviewed artifact outside popularity discovery

- **Decision:** Add an explicit-artifact policy route for `unsloth/Qwen3-4B-Instruct-2507-GGUF/Qwen3-4B-Instruct-2507-Q4_K_M.gguf`. The route keeps trusted-publisher, immutable revision, public/ungated, GGUF-tag and exclusion checks, but does not require the repository's missing `pipeline_tag`. Ingestion admits only the named file. It was manually promoted after its upstream LFS SHA-256 matched the local file byte-for-byte.
- **Why:** Popularity-capped discovery omitted the exact artifact already measured on the product owner's machine. Adding the entire repository would admit unrelated variants; relaxing broad pipeline filtering would widen the trust boundary unnecessarily.
- **Reversible:** Yes. Removing the required-artifact row removes it on a future reviewed refresh while the last good snapshot remains preserved by ingestion policy.

## 2026-07-20 — Publish the first exact two-pool GPU configuration

- **Decision:** Add Qwen3-4B-Instruct-2507 Q4_K_M for only `nvidia-geforce-rtx-3060-laptop-gpu`, llama.cpp b10061/commit 5d5306bf3, CUDA, full GPU layers, f16 KV and batch 2048. Store raw 4K/16K `llama-fit-params` observations and their normalized two-pool profile in `registry/evidence/fit-profiles.json`. The finder asks for available system RAM and displays VRAM and RAM requirements separately.
- **Why:** Artifact identity, accelerator identity, runtime configuration and both memory pools are now pinned. No throughput is claimed because the repeated performance observations remain inconsistent.
- **Reversible:** Yes. The candidate and evidence record are isolated and exact-device gated.

## 2026-07-20 — Scope recommendation candidates by platform and measured accelerator

- **Decision:** Every recommendation candidate declares compatible platforms and may restrict itself to exact accelerator registry IDs. Exact-device evidence is unavailable—not generalized—when the user has not selected the matching device. The finder now offers vendor-sourced NVIDIA and Apple device choices while retaining manual memory entry.
- **Why:** The previous `gpu`-only boundary could allow a future CUDA profile to appear for AMD and could not distinguish local RTX 3060 Laptop evidence from generic NVIDIA evidence. That would make a precise-looking but unsupported claim.
- **Reversible:** Yes. Evidence-backed architecture/family matching can be added as an explicit broader match level later.

## 2026-07-20 — Model partial offload as two independent memory pools

- **Decision:** Add a pure two-pool fit primitive that checks device memory and host memory independently, including per-pool model, fixed compute, context-scaled memory, context-scaled compute, reserves and safety margin. It is additive; existing single-pool profiles remain unchanged.
- **Why:** Partial GPU offload can fit VRAM while exhausting system RAM, or vice versa. Adding both numbers into one capacity figure would be dimensionally wrong and could recommend configurations that cannot load.
- **Reversible:** Yes. The primitive is isolated and has no I/O or production candidate consumer yet.

## 2026-07-20 — Treat the 4.3 t/s run as anomalous, not a GPU-layer conclusion

- **Decision:** Do not prioritize llama-swap flag import as the presumed fix for the initial 4.3 t/s generation result. First add complete benchmark configuration identity, then preflight and repeatability classification.
- **Why:** The installed llama.cpp b10061 `llama-bench --help` states that `-ngl` defaults to `-1`, and the captured row reported `n_gpu_layers: -1`. Controlled same-build/model reruns produced 61.4 t/s at `-ngl -1` and 79.9 t/s at `-ngl 99`; both fully offload this 4B model. The initial result is real but unexplained and cannot support Claude's CPU-offload diagnosis.
- **Reversible:** Yes. Exact serving-configuration import remains a useful later comparison feature.

## 2026-07-20 — Do not generalize local fit estimates into GPU recommendations yet

- **Decision:** Accept `llama-fit-params -fitp on` as a trustworthy way to capture build/model/device-scoped memory components, but do not yet turn the local observations into generic NVIDIA recommendations.
- **Why:** Official source for commit `5d5306bf3` defines the output as `(device, model, context, compute)`, and the local Qwen3-8B artifact hash matches the promoted registry record. However, the current candidate schema distinguishes only broad `gpu` kind: a CUDA profile would incorrectly appear for AMD, and it cannot constrain a locally measured profile to an exact accelerator. Partial offload also spans VRAM and system RAM while the current pure fit model has one physical-memory pool.
- **Reversible:** Yes. Add platform/accelerator compatibility and multi-pool fit explicitly before admission.

## 2026-07-20 — Retire the localhost quick test from the public website

- **Decision:** Remove the M7 quick-test entry point and component from the public website. Retain the deterministic task suite, loopback endpoint policy, tests, and dormant component as diagnostic/reusable implementation until the runner consumes or replaces the useful pieces.
- **Why:** The flow requires users who already understand endpoint URLs, model IDs, runtime identity, and CORS, yet yields self-reported identity and weaker measurements than the runner. It does not own a meaningful user question between the zero-install recommender and the verified local runner.
- **Reversible:** Yes. The isolated component can be restored without changing the measurement schema or network boundary.

## 2026-07-20 — R4 existing-engine slice: benchmark the user's own llama-bench under a watchdog

- **Decision:** R4 ships first as an existing-engine slice: the runner spawns exactly one executable — `llama-bench` from a user-chosen engine directory — on a user-chosen model file, with a 600 s watchdog kill, fail-closed JSON parsing, and `verified-local` provenance. The T7 sandbox (AppContainer/Job Object depth) is NOT implemented in this slice; its stop-and-ask remains open and applies to the future bundled-engine path executing downloaded artifacts.
- **Why:** This slice executes the user's own binaries on the user's own files — the same software they run unsandboxed daily — so the watchdog is a strict safety improvement over their status quo while the real sandbox question is decided deliberately. It also required no downloads (which remain gated) and delivered measured truth immediately: live-verified on the dev machine.
- **Reversible:** Yes; the module is isolated, and the bundled-engine path will supersede rather than extend it.

## 2026-07-20 — Persona walkthroughs are a standing gate after every feature

- **Decision:** After each feature, simulate Priya (newcomer), Marcus (intermediate), and Ravi (power user) through the real code paths; record in `docs/persona-findings.md`; fix cheap findings immediately, backlog the rest. Pass 1 already forced the `no-coverage` outcome split.
- **Why:** Product-owner directive (2026-07-20). The first pass caught a product-killing message that all 107 unit tests were blind to.
- **Reversible:** Yes (practice, not code).

## 2026-07-20 — R3 scan: identity is hash-or-candidate, hashing is a separate explicit step

- **Decision:** The model-store scan reads directory listings and metadata only — never file contents. Identity against the admitted registry: an Ollama blob whose digest filename equals a registry sha256 is `verified`; a loose GGUF whose byte size equals a registry artifact is `candidateBySize` and is never upgraded without an actual hash; hashing multi-GB files is deferred to a later explicit per-file action, not done during scans. Ollama is read as plain files (manifests → model-layer digests → blobs), never invoked (I4). Walks are depth- and count-capped with truncation *reported*; unreadable entries (malformed manifests, dangling blobs, permission failures) are listed per-file; an installed-but-empty Ollama is a normal state, not an error. The scan module contains no write APIs, enforced by a source-level boundary test.
- **Why:** Hashing a 20 GB file during a "quick scan" breaks the product promise, and pretending a size match is an identity would be manufactured certainty — the candidate state keeps the evidence ladder honest inside the runner exactly as it works on the website. The empty-Ollama fix came from live verification on the dev machine (Ollama installed, no models pulled — was misreported as unreadable).
- **Reversible:** Yes. Store adapters, caps, and match policy are isolated in `runner/src-tauri/src/model_store.rs`.

## 2026-07-20 — R2 detection: DXGI truth, embedded registry, flag-don't-fix reconciliation

- **Decision:** GPU detection uses DXGI adapter enumeration (`DedicatedVideoMemory`, software adapters excluded); OS/CPU/RAM via `sysinfo`. The vendor accelerator registry is embedded at compile time from `registry/generated/accelerators.json` so runner and website share one source of truth. Reconciliation matches on exact (case-insensitive) marketing name; detected memory is compared to vendor variants with a 1 GB tolerance for DXGI's reserved-segment under-report. A detected value that matches no variant is **flagged, never corrected** to a vendor number; unknown devices fail closed to manual entry (B1X). Non-Windows GPU enumeration returns an explicit unavailability reason. Detection runs only on button press — never on launch.
- **Why:** WMI's `AdapterRAM` caps at 4 GB and is unreliable; DXGI is the accurate native source. Compile-time embedding beats a runtime file read (no filesystem access needed, no drift between surfaces). Flag-don't-fix preserves the provenance rule: `detected` values are what the machine said, not what we wish it said. Live verification on the dev machine confirmed both paths: RTX 3060 Laptop reconciled Known with variant match (5.9 ≈ 6 GB); Intel Iris Xe correctly fell to Unknown/manual.
- **Reversible:** Yes. Enumeration backends, tolerance, and matching are isolated in `runner/src-tauri/src/hardware.rs`; the registry data is shared and separately versioned.

## 2026-07-19 — Runner stack: Tauri 2; updates via installer tools first

- **Decision:** The desktop runner is built on Tauri 2 (Rust core, web UI). Distribution and updates go through package managers (winget/Homebrew) with cosign-signed artifacts and SLSA provenance; the runner ships **no self-update code** initially. Self-updating is a deliberate later milestone with its own threat-model revision — the T2 OPEN item (choosing a TUF-conformant updater) is deferred until that milestone, not resolved silently.
- **Why:** Product-owner choices (2026-07-19) from explicit options. Tauri fits the security posture (small signed binaries, sandbox-friendly, official signed-updater plugin available when needed). Installer-first means zero update-channel attack surface while the fleet is small; "whoever controls updates controls every installed machine" is a risk worth taking on only when the installed base justifies defending it.
- **Reversible:** Framework choice is expensive to reverse (hence asked, not assumed). The update posture is explicitly staged: revisiting it requires a threat-model update and sign-off, per I7/I8 discipline.

## 2026-07-19 — Vendor-sourced accelerator registry with derived memory variants

- **Decision:** `registry/generated/accelerators.json` + `lib/accelerators` hold a deliberately small set (8 NVIDIA desktop cards, Apple M5/M5 Pro/M5 Max) with purchasable memory variants quoted from official vendor spec pages. `deriveMemory()` returns single-variant (confident pre-fill), multiple-variants (user picks from sourced options — RTX 4060 Ti 8/16, all Apple chips), or fails closed to manual entry for unknown ids. Manual memory confirmation is always retained in the UI. Bandwidth is stored only when the vendor states one unambiguous figure (M5: 153 GB/s, M5 Pro: 307 GB/s; M5 Max omitted — two figures by GPU config; NVIDIA omitted — not on spec pages, and deriving it from bus width would be manufactured data). Laptop silicon requires separate entries — desktop rows must never be reused for laptop variants.
- **Why:** AGENTS.md requires that selecting a device derive its memory variants rather than pretending a platform label identifies the machine. Family slugs align with `lib/priors` and a cross-registry test enforces id/family/kind agreement — which also independently re-verified the GPU priors' memory values against vendor pages.
- **Reversible:** Yes. Entries are data; the derivation contract is typed and fail-closed.

## 2026-07-19 — GPU/Apple throughput priors: backend derivation and pooling boundaries

- **Decision:** Nine GPU-class LocalScore result pages (RTX 4090, RTX 5070 Ti, RTX 3070 Ti Laptop, GTX 1660, Apple M1 Pro/M2/M5 Pro) were admitted as throughput priors across all three size bands. Two derivations beyond the page contents: (1) `backend` is recorded as `cuda` for NVIDIA and `metal` for Apple — the result pages don't name the backend, but llamafile's official README documents exactly those GPU paths per vendor (https://github.com/mozilla-ai/llamafile#gpu-support). (2) Apple accelerators use `kind: "integrated"`, not `"gpu"`, so coarse-bucket fallback can never pool unified-memory Apple silicon with discrete NVIDIA cards. Data was extracted from each result page's embedded structured JSON (Next.js `__NEXT_DATA__`), not visually transcribed; envelopes are floored/ceiled to one decimal so they only widen.
- **Why:** The M3 admission rule requires a backend; deriving it from the runtime's official vendor documentation is sourced derivation (same class as filename-derived quantization in M1), whereas omitting GPU results entirely would leave every GPU user with `unavailable` estimates. The integrated/gpu split preserves the M4 pooling-isolation guarantee at the data level. The unknown-GPU golden was updated accordingly: an unknown GPU now inherits *GPU* evidence as a widened low-confidence range — it still cannot inherit CPU rows.
- **Reversible:** Yes. Rows can be removed or re-scoped individually; the derivation rule is documented here and cited per row via source URLs.

## 2026-07-19 — Freeze quick-test page investment until comparison data exists

- **Decision:** No further work on the M7 quick-test page until community/bucket data exists to compare against. The shared modules (quick-task suite, endpoint policy) remain, as the runner reuses them.
- **Why:** Product owner assessment (correct): measured-on-your-own-box numbers duplicate what local tools already show; their value arrives with comparison. The page's real yield was the reusable suite and the CORS/fail-closed groundwork.
- **Reversible:** Yes — it's a prioritization, not a removal.

## 2026-07-19 — M9 rating policy: vote weights, tie handling, and the live threshold

- **Decision:** Prompter votes weigh 1.0 and third-party votes 0.5 in the Bradley–Terry tally; ties enter the solver as half-wins per side while both-bad votes are recorded but carry no preference signal; a bucket's table goes `live` at 50 effective (weighted) votes and is `collecting` below that; confidence bands use a seeded 200-resample percentile bootstrap so results are deterministic. All four values live in `lib/battles/policy.ts` as editable product policy, not in the math.
- **Why:** The prompter knows the intent and standard behind their prompt (the own-prompt design's core rationale), so third-party judgments on curated pairs are discounted rather than equal or excluded. The specific 1.0/0.5 ratio and the 50-vote threshold are product policy choices without empirical backing yet — which is exactly why they are isolated in a policy module where changing them is a one-line, logged edit.
- **Reversible:** Yes. Weights and thresholds are data; tie/both-bad semantics are documented behavior with dedicated tests.

## 2026-07-19 — M8 threat model treats the backend as untrusted and defers two hard choices

- **Decision:** The runner threat model (T6) assumes a fully hostile backend: jobs are data-only, engines arrive exclusively through the signed release channel, and unknown job fields/versions fail closed. Two hard-to-reverse choices are explicitly deferred as OPEN stop-and-asks rather than decided: the TUF-conformant updater implementation (T2-M7) and the Windows GPU-compatible sandbox depth (T7). Consumer hardware attestation (T8) is recorded as an accepted residual risk for the volunteer fleet and a blocker for the vetted enterprise tier.
- **Why:** "Jobs are data" removes the largest single-point compromise (server → fleet code execution) structurally instead of operationally. The deferred items are the two places where a premature pick would be expensive to reverse and where the product owner's platform priorities matter.
- **Reversible:** The OPEN items are by definition undecided; the data-only job contract is a security invariant and should be treated as irreversible without a new threat-model revision and sign-off.

## 2026-07-19 — Keep M7 measurements browser-direct and ephemeral

- **Decision:** The quick-task suite accepts only exact HTTP(S) loopback hosts, calls the OpenAI-compatible chat-completions route directly from the browser after explicit action, runs three requests sequentially, and retains results and optional API credentials only in component memory. Model, product, engine, build and self-reported hardware remain attached to every report.
- **Why:** This delivers measured local evidence without a Local Arcade prompt proxy, account, upload, install or runner. Exact loopback validation prevents the benchmark surface from becoming a general-purpose request client. Sequential requests avoid unnecessary concurrent memory pressure.
- **Reversible:** Yes. The endpoint adapter, suite definitions, scorers and presentation are separate modules. Adding persistence or contribution later requires a new consent and data-contract milestone.

## 2026-07-19 — Withhold generation throughput unless the endpoint reports it

- **Decision:** M7 measures wall-clock request duration for every task. It displays generation tokens per second only when the local endpoint returns a finite positive `timings.predicted_per_second`; token counts alone are not divided by total request time and presented as generation speed.
- **Why:** Total request time includes prompt processing, scheduling, time-to-first-token and generation. Treating it as generation throughput would manufacture a metric, and client-side word or character estimates are tokenizer-dependent.
- **Reversible:** Yes. A future streaming adapter can measure TTFT and token cadence when the exact tokenizer and protocol are pinned.

## 2026-07-19 — Refresh immutable artifacts through a review pull request

- **Decision:** A pinned scheduled workflow runs discovery and ingestion every Monday and Thursday, validates the complete repository, and opens or updates `automation/catalog-refresh` for review. New immutable identities default to `triage`; existing lifecycle status and previously admitted immutable records are retained. Production requires `promoted` status.
- **Why:** Scheduled ingestion should detect upstream change without making new artifacts recommendable or letting a moving repository revision silently remove a configuration with existing evidence. A review branch keeps promotion and generated-data changes auditable.
- **Reversible:** Yes. The schedule, review branch and promotion adapter are explicit; automatic promotion remains forbidden.

## 2026-07-19 — Gate builds on the last complete successful ingest

- **Decision:** Registry schema v4 adds `lastIngestSucceededAt`. The build calls a pure freshness gate and fails after seven days, on invalid timestamps, or on materially future timestamps. `generatedAt` remains the discovery-lock timestamp.
- **Why:** A generated file can look current while its last full admission failed. Separating discovery time from successful completion prevents silent catalog rot and preserves the last good snapshot on failure.
- **Reversible:** Yes. The threshold is centralized, but changing the seven-day contract requires an explicit plan decision.

## 2026-07-19 — Make recommendation policy inspectable and locally editable

- **Decision:** M5 splits candidate evaluation, ranking/role selection, editable policy constants, strategy formulas, state transitions and display provenance into separate named modules, with `lib/recommendation/ALGORITHM.md` as the edit map. User-visible metrics flow through a `DisplayValue` wrapper that requires provenance at compile time.
- **Why:** Ranking logic will evolve as evidence grows. Keeping product policy separate from observations makes later changes reviewable and prevents benchmark numbers from becoming hidden scoring constants.
- **Reversible:** Yes. Each process has a narrow typed boundary and can be replaced independently.

## 2026-07-19 — Keep configuration requests browser-local in M5

- **Decision:** “Save evidence request” stores a bounded record in browser local storage and explicitly says it is not submitted or uploaded.
- **Why:** M5 requires a request stub, but selecting a durable server queue or public API would create an external data contract and consent surface outside this milestone.
- **Reversible:** Yes. A later consented backend can import or replace the local request adapter.

## 2026-07-19 — Keep incomplete real configurations unranked

- **Decision:** M4 removes the demo catalog and admits only configurations that combine an immutable registry artifact, an explicit sourced fit profile and an exact runtime identity. Comparative ordering is emitted only when the selected strategy has compatible evidence; otherwise the website returns an unranked shortlist, a named constraint conflict or a nothing-fits state. The initial production adapter is intentionally limited to the sourced Llama 3.2 1B CPU llama.cpp profile.
- **Why:** Registry breadth alone cannot supply architecture-specific KV memory, runtime buffers, product compatibility, task quality or hardware-scoped throughput. Generalizing one allocation log or LocalScore's llamafile CPU results to GPUs, Ollama, LM Studio or direct llama.cpp would manufacture certainty.
- **Reversible:** Yes. New sourced profile and compatibility adapters can expand production coverage without changing outcome semantics.

## 2026-07-19 — Isolate throughput by accelerator kind and product

- **Decision:** Throughput lookup now requires accelerator kind and runtime product in addition to size band and engine. Coarse fallback stays inside those boundaries; an unknown GPU cannot inherit CPU measurements, and a wrapper such as llamafile cannot be silently merged with direct llama.cpp.
- **Why:** M4 integration exposed that the M3 query shape could pool evidence across materially different hardware and product configurations despite exact rows retaining those fields.
- **Reversible:** Yes. A documented equivalence policy could later authorize specific cross-product transforms, but the default remains fail-closed.

## 2026-07-19 — Seed throughput only from fully identified result pages

- **Decision:** M3 admits LocalScore result pages only when they expose accelerator and memory, model/quantization, runtime version/commit, backend, operating system and the detailed workload samples. Summary-only GPU leaderboard rows remain excluded. Priors store observed min/max envelopes and the query API never returns a point estimate.
- **Why:** The same apparent GPU/model pair can vary substantially with runtime and settings. A smaller CPU-only seed with exact scope is more useful than a broad table that silently blends unlike configurations. Unknown hardware widens across compatible envelopes and is explicitly low confidence.
- **Reversible:** Yes. Identified GPU or other-runtime result imports can expand the table without changing its range-only contract.

## 2026-07-19 — Make fit inputs explicit and runtime-scoped

- **Decision:** The M2 fit function consumes exact weight bytes, sourced per-model K/V cache profiles, runtime/compute-buffer bytes, physical memory, OS/display reserves and a caller-selected safety margin. Missing KV types fail closed; the library does not infer these values from model parameters, GPU names or product labels.
- **Why:** llama.cpp allocation logs and maintainer guidance show that KV memory changes with architecture, context and cache types, while compute buffers also change with batch, flash attention, backend and build. Keeping those values explicit makes the arithmetic reusable without claiming that llama.cpp behavior automatically describes Ollama, LM Studio, MLX or vLLM.
- **Reversible:** Yes. New sourced runtime profiles can be added without changing the pure summation contract; a schema revision can add independently modeled memory pools for partial offload or multi-device topology.

## 2026-07-19 — Pin discovery separately from deterministic admission

- **Decision:** Hugging Face discovery is a mutable, explicit operation governed by an editable trusted-publisher policy. It produces a revision lock; deterministic ingestion consumes only that lock and atomically publishes a fully validated snapshot.
- **Why:** Broad discovery and reproducible builds are different jobs. Separating them prevents upstream catalog movement or partial refresh failures from changing or erasing the last valid artifact registry.
- **Reversible:** Yes. Publishers, discovery ordering and upstream adapters remain data/module choices; admitted artifact identity remains stable.

## 2026-07-19 — Quarantine unsupported GGUF packages in M1

- **Decision:** M1 admits standalone GGUF artifacts and quarantines split packages, projector/helper files, unknown filename quantizations and records missing required evidence. Every admitted artifact stores the parsed chat template and field-level provenance.
- **Why:** Split packages need package-level identity and install semantics that the M1 artifact schema does not yet represent. Inventing or silently inferring missing values would violate the evidence contract.
- **Reversible:** Yes. A later schema version can admit package manifests without changing existing standalone identities.

## 2026-07-19 — Require explicit milestone checkpoints

- **Decision:** Every milestone transition begins with a user-visible scope checkpoint and ends with an audited status update. Adjacent milestones may be batched only when each has separately listed work and gates.
- **Why:** The product owner wants autonomous progress without reviewing tiny increments, while retaining a clear account of what each milestone includes and preventing out-of-order implementation.
- **Reversible:** Yes. The checkpoint format can evolve without changing product data or APIs.

## 2026-07-19 — Separate products, engines and artifact packages

- **Decision:** Local Arcade supports multiple local-model products and engines. Ollama, LM Studio, Jan, llama.cpp, MLX LM and vLLM are modeled as distinct products/routes; engines and exact builds remain separate configuration identity.
- **Why:** The product owner explicitly confirmed multi-runtime support. A GGUF file, a desktop app and an inference engine are not interchangeable, and compatibility changes by build, backend and package layout.
- **Reversible:** Yes. Products and adapters can be added or retired without changing artifact identity.

## 2026-07-19 — Imported artifacts are an evidence cache, not a recommendation allowlist

- **Decision:** Use broad scheduled discovery, strict immutable admission and on-demand resolution. Model-level ranking may cover releases before every artifact variant is cached, but exact size/hash/install/compatibility claims require a resolved admitted artifact. Metadata-only candidates remain unranked when comparative evidence is missing.
- **Why:** Hand-authoring one manifest row per artifact cannot cover hundreds of models. Live upstream requests in the page path would be slow and fragile. Separating discovery, admission and evidence preserves coverage without inventing certainty.
- **Reversible:** Yes. Discovery sources and admission policies are replaceable modules.

## 2026-07-19 — Use tobacco brown for the primary finder action

- **Decision:** The finder action uses `--la-tobacco` rather than the palette's green primary convention. Hover brightens the same brown and does not reuse rust/error semantics.
- **Why:** Explicit product-owner visual direction.
- **Reversible:** Yes.
## 2026-07-23 — Bind runner hardware by material facts, not an ID

- **Decision:** U31 uses a versioned material-fact comparison between the
  imported hardware target and runner resolution. OS family and accelerator
  identity/vendor/kind/backend/count/capacity plus unified-memory facts bind
  the machine. Available RAM, field origins and descriptive OS/CPU differences
  remain visible but are not identity authority. Total RAM normalization v1
  permits at most the smaller of 3% of imported total or 1 GiB, retains the
  lower detected value and requires a visible warning/confirmation. Larger
  contradictions block.
- **Implementation consequence:** Missing unified-memory or device-capacity
  facts block. A vendor registry nominal-capacity difference is visible,
  retains the lower detected capacity and requires the same exact
  reason/field acknowledgement discipline; it is never silently promoted to
  `Ready`.
- **Why:** Exact JSON equality rejects genuine machines because detection and
  self-reporting have different provenance and dynamic fields. Matching only a
  caller-controlled target ID would hide a different machine.
- **Reversible:** Yes. The comparison policy is explicitly versioned; changing
  its material fields or tolerance requires a reviewed decision and regression
  corpus.

## 2026-07-23 — Keep actual backend evidence out of the version probe

- **Decision:** U32 limits the pre-execution existing-tool receipt to the
  selected canonical path, executable hash and strictly parsed reported
  llama.cpp build. Planned backend is carried by the exact candidate and
  validated M-E compatibility receipt. Actual selected backend must come from
  the later separately gated model-loading result.
- **Why:** `--version` can bind reported build text to executable bytes but
  cannot prove which backend a later run selects. Echoing the candidate backend
  as an observation would manufacture evidence.
- **Implementation consequence:** The Windows producer holds a guarded file
  identity across hash/probe/rehash, bounds post-child pipe completion and
  fails closed where an equally strong platform guard is unavailable. It does
  not claim a process-tree sandbox or child network/write isolation.
- **Reversible:** Yes. A future version may add independently supported-backend
  evidence, but it must remain distinct from actual run-time backend evidence.

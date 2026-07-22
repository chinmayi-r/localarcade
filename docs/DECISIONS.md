# Decisions

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

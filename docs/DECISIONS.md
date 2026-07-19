# Decisions

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

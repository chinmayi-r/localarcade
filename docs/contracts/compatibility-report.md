# First-slice contract compatibility report

Status: **Approved contract decisions; implementation mapping audited
2026-07-22**. This is the exact field/enum comparison used by M-A. It does not
claim that current TypeScript or Rust already serializes v1.

Evidence: the [v1 schema](local-arcade-first-slice-v1.schema.json),
[`lib/recommendation/types.ts`](../../lib/recommendation/types.ts),
[`lib/accelerators/types.ts`](../../lib/accelerators/types.ts),
[`lib/fit/types.ts`](../../lib/fit/types.ts),
`lib/fit/memory-pools.ts` (preserved dirty-file evidence; not present in the
approved M-A commit),
[`lib/evidence/types.ts`](../../lib/evidence/types.ts),
[`lib/registry/types.ts`](../../lib/registry/types.ts),
[`lib/runtime/types.ts`](../../lib/runtime/types.ts),
[`lib/priors/types.ts`](../../lib/priors/types.ts), and Rust
[`hardware.rs`](../../runner/src-tauri/src/hardware.rs),
[`model_store.rs`](../../runner/src-tauri/src/model_store.rs),
`runner/src-tauri/src/preflight.rs` (preserved dirty-file evidence; not present
in the approved M-A commit),
[`benchmark.rs`](../../runner/src-tauri/src/benchmark.rs), and
`runner/src-tauri/src/quick_task.rs` (preserved dirty-file evidence; not present
in the approved M-A commit).

## Exact field and enum mapping

| Approved schema fields/enums | Current TypeScript | Current Rust serialization | Classification and required M-A adapter |
|---|---|---|---|
| Envelope `schemaVersion`, 14-value `contract`, `status`, typed `data`, `provenance`; partial `completeness.{complete,missing,warnings,recoverableActions}`; non-data `reasonCode,message,recoverableActions,warnings` | No legacy shared envelope. `RecommendationOutcome.kind` is domain-specific. | Commands return structs or `Result<_, String>`. | **Shared boundary implemented.** M-A supplies DTOs/reason codes. M-O later maps domain unions/free-form errors. Partial data may never be an arbitrary object. |
| Provenance `source.{id,version,revision,url}`, `retrievedAt`, `observedAt`, `method`, `hardwareMatch`, `configurationMatch`, `scope.{taskFamily,taskPackId,promptId,harnessId}`, `sampleCount`, `measurement.{unit,interval,confidence,eligible,eligibilityReasons}`, `rawSourceRecordRef` | `EvidenceRecord` directly supplies method/source, match scopes, interval/unit, sample count, observed time, links, config/hardware/task identity. Registry provenance supplies URL/retrieval/kind. | Hardware/preflight/benchmark expose single provenance strings and report-specific quality/calibration fields. | **Compatible source fields split across records; Rust partial.** Lossless join required. Display claims such as `verified` are derived and never mapped into `method`. Missing dimensions are explicit null/unknown. |
| Hardware `hardwareTargetId`; `os.family windows|macos|linux|other`, `os.version`; CPU; RAM bytes and nullable `unified`; accelerators with `kind/vendor nvidia|amd|apple|intel|cpu|other`, `backend cuda|rocm|metal|vulkan|cpu|other`, memory/count; `fieldOrigins` | `HardwareProfile.platform` means vendor (`nvidia|apple|amd|cpu`), not OS; memory uses GiB; ID/source/CPU/origins absent. Accelerator registry has identity/name/kind/variants. | `HardwareReport` has OS text/arch/CPU/total GiB and GPU reconciliation; no stable target ID/origin map; available RAM is preflight-only. | **Changed semantics and units.** Never map TS `platform` to `os.family`. M-A adapters convert checked GiB→bytes, map registry/reconciliation fields, and mark every origin. Unified memory remains null unless known/confirmed. |
| Request task `family coding|writing|extraction|general|other`, `interactionStyle`, `scopeLabel`, `derivedContextTokens`, `needs tool-use|structured-output|vision|embeddings|offline`; priorities `balanced|quality|speed|long-context|lightest`; offload/installed flags; `forcedRuntime`, `maximumArtifactBytes` | `TaskId` matches coding/writing/general and uses `extraction`; `StrategyId` exactly matches approved priorities. `desiredContextK` needs unit conversion. IDs, interaction/scope/needs/offload/installed/runtime/size absent. | Absent. | **Enums compatible; fields partial/missing.** Preserve `general`; no `chat` rename. Map context K explicitly. `other` requires scope label. Maximum bytes is filtering only and grants no download capability. |
| Candidate root/model family; artifact `artifactId,repository,revision,filename,sha256,bytes,format,quantization,license,status=promoted`; provenance | Registry record has direct/renamed fields: `id`, `fileName`, `fileSizeBytes`, `license.id`; candidate has ID/family. | Model-store result has path/size/optional hash and tagged registry match, not a catalog candidate. | **TS mechanically compatible after renames; Rust identity-only.** Require promoted exact registry identity; never upgrade size-only matches. |
| Runtime `runtimeConfigurationId,product,engine,engineBuild,backend,chatTemplate,contextTokens,kvCache.key/value,gpuLayers,batchSize,microBatchSize,parallelism,threads,flashAttention,mmap,sampler.{temperature,topP,topK,minP,seed},additionalFlags` | Candidate/runtime/ExecutionPlan cover product, engine/build, backend, context, one KV string, layers and batch. Registry has chat template. Micro-batch/parallelism/threads/flash/mmap/sampler/flags absent. | Benchmark report covers build/backend, separate K/V text, layers, batch, ubatch, threads, flash/mmap. Quick task fixes temperature/seed but stores remaining effective settings as prose. | **Partial with serialization breaks.** Join sources without defaults. Split KV explicitly. Preserve unknown as null. Parse no prose into trusted settings. Artifact hash remains candidate identity and is repeated in plans where path binding matters. |
| Fit IDs/status/run path; `memoryPools.device|host` detailed model/context/compute/reserve/margin/required/available bytes; prompt/decode/TTFT ranges; per-channel provenance arrays; blockers | `FitResult` and `MemoryPoolBreakdown` contain compatible detailed byte components; priors retain prompt/decode/TTFT ranges, confidence/scope/sample/source; recommendation joins identities. | Benchmark observations are not fit assessments. | **Mechanically adaptable after joins.** Preserve all detail and evidence dimensions; no range or pool collapse. Current fit algorithms stay unchanged. |
| Portfolio outcome `ranked|unranked-compatible|contradictory-preferences|nothing-fits|coverage-gap`; ≤5 distinct families; nullable role with approved five-role enum; explanations/caveats | Outcomes match except `no-coverage→coverage-gap`. Current roles already are `primary-match|quality-option|fast-option|long-context-option|memory-efficient-option`. Items embed candidate/fit. | Absent. | **Enums mechanically compatible after one rename.** Adapter references candidate/assessment IDs. Ranked needs ≥1; nothing/coverage need zero; unranked/contradictory roles are null. Semantic validator enforces distinct families. |
| Handoff self-contained request/target/candidate/evidence; version/time/24h expiry/content hash; `containsModelData=false`, `sideEffectAuthorization=false` | No handoff type; component types exist. | No handoff type. | **Entire boundary missing.** M-A canonical serializer hashes the snapshot excluding `contentHash`; import/replay performs no side effect. Expired snapshots remain inspectable but cannot start verification until refreshed. |
| Runner import `importBundleVersion=1`, canonical `contentHash`, unchanged nested handoff v1 and compatibility-admission receipt | M-O already holds both producer results process-locally. | M-J already requires the validated receipt independently of the selected candidate. | **Additive U28 boundary implemented.** Hash the complete two-payload snapshot excluding only the bundle hash; cross-bind candidate, artifact ID/hash, runtime ID/build/product/engine/backend, OS and quantization. The bundle grants no execution authorization and does not alter handoff v1. |
| Benchmark plan IDs/path/hash/runtime/protocol/warmups/measured runs/measurement kinds/preflight/side effects | `ExecutionPlan` is useful but lacks path/hash/protocol/preflight. | `BenchmarkRequest` has engine/model paths, token counts, repetitions and adverse-condition acknowledgement; build/backend discovered after execution. | **Partial.** Adapter may populate only checked facts. A request is neither consent nor a complete plan; warmups are distinct and excluded from aggregates. |
| Quick-check plan IDs/path/hash/runtime/check ID+criterion/preflight/side effects | No shared plan. | `QuickTaskRequest` plus fixed private task definitions. | **Partial.** M-A DTO is transport-neutral; adapter exposes public IDs/criteria without converting fixed execution into general quality evidence. |
| Verification plan IDs with nullable typed benchmark/quick-check plans | No aggregate. | Plans are separate calls. | **Missing aggregate.** At least one plan is enforced by M-A semantic validation; no execution permission is embedded. |
| Compatibility admission receipt ID/version/policy/decision; candidate/artifact/runtime bindings; evaluated product/engine/build/OS/architecture/backend/features/package/model/quantization; full assertion and evidence | M-E already evaluates `RuntimeBuild`, `CompatibilityAssertion` and declared package members but previously returned only the candidate. | M-J previously bound candidate/inventory/tool facts but could not establish that M-E admitted the route. | **Additive U25 boundary implemented.** M-E emits only after a successful evaluation; aliases normalize to `windows|macos|linux|other` and `x86_64|aarch64`; unknowns fail closed. M-J consumes a validated receipt and does not reinterpret it as cryptographic proof. |
| Measurement series `kind`, `unit`, separate `warmupSamples`/`measuredSamples`, aggregate, domain completion, stability, per-series evidence | Evidence interval types exist, but no raw series DTO. | Benchmark emits separate prompt/generation rows and raw samples; repeatability is per row. TTFT/memory may be absent. | **Compatible after mechanical reshaping.** Never pair prompt and decode samples. Unknown/unmeasured series are absent, not synthesized. Evidence class resides on each series. |
| Benchmark result IDs/domain status/series/calibration eligibility+exclusions/diagnostics | Evidence can store normalized observations. | `BenchmarkReport` has the corresponding raw fields but no IDs/domain enum. | **Partial.** Domain `failed|timed-out|cancelled|oom|stopped` can live in an `ok`/`partial` envelope when captured; use-case failure is envelope `error`. |
| Quick-check result IDs/domain status; per check `checkId,criterion,status pass|fail|not-run,explanation,localDiagnostics,evidence` | No aggregate. | Result has ID/label, boolean `passed`, explanation/output; no `not-run` variant or provenance object. | **Rename/enum adapter.** `passed→pass|fail`; only explicit absence becomes `not-run`. Local output maps to diagnostics and remains local. Each check carries objective-check provenance. |
| Verification result IDs/domain status plus independently typed nullable benchmark/quick-check results | No aggregate. | Reports are separate. | **Missing aggregate.** Reference/embed both without aggregate evidence class or assumed paired samples. Partial completeness names whichever result is missing. |

## Fields present only in current implementations

These remain preserved unless an approved adapter intentionally carries them
as provenance, diagnostics, additional flags, or a future additive contract:

- Registry publisher/base model/model/max context, per-field provenance,
  retrieval time, license URL, quarantine and compatibility assertions.
- Evidence metric identity, hardware/config fingerprints, task-pack version and
  provenance links beyond one raw-record reference.
- Runtime OS/architecture/feature flags and benchmark model type/quality reason,
  relative range and engine-specific numeric encodings.
- Quick-check label and raw local output (retained as local diagnostics, not a
  portable quality claim).
- Model-store scan path/store/duplicate/unreadable/truncation details, which
  belong to inventory rather than the first-slice handoff.

## Resolved owner decisions

All ten former approval questions are resolved in v1: OS is not vendor
platform; provenance is orthogonal/lossless; task/priority enums match current
product vocabulary; artifact-size filtering remains; runtime identity is
complete and nullable; exact evidence retains every named dimension; portfolio
roles/invariants are fixed; handoff is canonical, side-effect-free and expires
informationally after 24 hours; benchmark and quick checks are separate; and
envelope completion is distinct from captured run outcome.

M-A may implement mechanical mappings only. Any mapping that would discard an
approved field must return an explicit blocked/unavailable mapping rather than
lossy translation glue.

# llmfit-core adoption audit

Status: design input, not implementation authorization.

Current-source check, 2026-07-22: upstream's primary README now describes local
benchmark persistence, community benchmark contribution, JSON recommendations,
and fit/speed/quality/context ranking. That strengthens llmfit as the comparison
baseline and means this pinned v1.1.6 audit must be refreshed before an M-B
integration decision. See `ranking-and-audition-research-plan.md`; no current
production conclusion changed from this source check.

Audited upstream: `AlexsJones/llmfit` v1.1.6 at commit
`7ba90ce0f14756040db658933bfd5c6ad46ed4ea` on 2026-07-21.

Upstream repository: https://github.com/AlexsJones/llmfit

License: MIT. Any copied or substantially derived code must retain the upstream
copyright and license notice. Depending on the crate or invoking its binary is
preferable to copying code.

## Decision

Local Arcade should build above a pinned llmfit engine. It should not begin as
a permanent fork of the complete llmfit application.

- Desktop/native integration should first use either `llmfit-core` directly or
  a pinned `llmfit --json`/REST adapter.
- The website should consume a Local Arcade-owned versioned contract. A hosted
  adapter and an in-process desktop adapter may implement that same contract.
- Local Arcade must not expose upstream structs directly to its UI or persisted
  data. The adapter prevents upstream schema churn and legacy vocabulary from
  becoming Local Arcade's public API.
- Local Arcade retains its exact artifact registry, evidence policy, arena,
  contribution integrity, and consumer experience.
- Downstream tools do not depend on llmfit. A future vendor-neutral interchange
  format may pass an exact configuration candidate out of Local Arcade without
  naming or coupling to any private consumer.

## What explains the rapid attention

The repository was created on 2026-02-15. Its first commit was a small coherent
Rust application: hardware detection, fit logic, a model database, a Python
Hugging Face updater, and a TUI. It was not a fork or an aggregation of many
repositories.

The visible growth is best explained by several effects acting together:

1. **The question is larger than the active-user population.** Many people who
   do not run a local model every day still wonder what their existing computer
   could run or what hardware they should buy. A GitHub star can mean interest,
   aspiration, or bookmarking; it is not an active-user count.
2. **The promise is legible in one sentence.** "One command to find what runs
   on your hardware" communicates an immediate before/after result.
3. **The demo is immediate.** Hardware appears automatically and a populated
   ranked table appears without first teaching the user GGUF, KV cache, or
   offload terminology.
4. **The contribution surface is unusually broad.** Hardware detection bugs,
   model additions, package-manager support, translations, provider adapters,
   and benchmark submissions allow useful small contributions from people with
   different machines.
5. **The maintainer shipped rapidly.** The local checkout contains 1,000 commits
   in approximately five months. Monthly commit counts are 209, 248, 125, 58,
   120, and 240 from February through July. That cadence repeatedly creates new
   release and social-discovery events.
6. **Distribution escaped Reddit.** The project is available through Homebrew,
   Scoop, MacPorts, PyPI/uv, Docker, source builds, and release binaries. It has
   appeared in international technical blogs, local-LLM directories, Hacker
   News discussions, and a Hugging Face/OpenClaw setup path.
7. **GitHub itself becomes a channel.** Stars, forks, frequent releases, and
   contributor activity increase the chance of Trending, recommendation, and
   secondary-news exposure.

GitHub currently exposes roughly 81 contributor records, but this is not an
81-person product team. Commit authorship is concentrated: the maintainer's
multiple identities account for the large majority of commits, the next human
contributor has dozens, and most contributors have single-digit totals. Bots
also appear in the contributor list. The accurate description is "one extremely
active maintainer with a healthy long tail of contributors."

Homebrew reports thousands of recent installs, which is stronger evidence than
stars, but Homebrew install analytics are not unique active-user counts and may
include repeat installations or upgrades.

### Reddit conclusion

Reddit is useful for problem discovery, criticism, hardware edge cases, and a
credible launch demonstration. It is not the only or necessarily the largest
growth channel. A generic launch post is less useful than a concrete artifact:

- a newly released model mapped to common hardware;
- an exact benchmark pack and surprising result;
- a public response/experience battle;
- a hardware buying guide backed by reproducible evidence;
- an upstream integration that solves an existing community request.

Local Arcade should treat Reddit as one feedback/distribution node alongside
GitHub, Hugging Face model communities, runtime communities, package managers,
model/quantizer releases, and eventually a single polished Show HN launch.

## Upstream package architecture

The Rust workspace contains:

| Package | Responsibility |
|---|---|
| `llmfit-core` | Hardware, models, fit, planning, providers, benchmarks, community measurements, quality helpers, sharing |
| `llmfit-tui` | CLI/TUI, REST API, MCP server, NATS publishing |
| `llmfit-desktop` | Tauri desktop surface |
| `llmfit-web` | React/Vite dashboard embedded by `llmfit serve` |
| `llmfit-python` | Python packaging/bindings surface |

`llmfit-core/src/lib.rs` publicly exposes these modules:

```text
analysis  bench       benchmarks  claim    doctor
fit       hardware    models      plan     providers
quality   share       task_bench  update
```

The sections below describe the actual v1.1.6 code, not the older upstream
`AGENTS.md`, which still describes the much smaller first-generation layout.

## 1. Hardware module

### Input

`SystemSpecs::detect()` takes no argument and reads the current machine.
Detection may consult OS APIs and command-line utilities for NVIDIA, AMD,
Apple, Intel, Vulkan, Ascend, CPU, WSL, multi-GPU, and cluster cases.

Programmatic overrides:

```rust
SystemSpecs::with_gpu_memory_override(vram_gb: f64)
SystemSpecs::with_ram_override(ram_gb: f64)
SystemSpecs::with_cpu_core_override(cores: usize)
```

### Output

```rust
SystemSpecs {
  total_ram_gb: f64,
  available_ram_gb: f64,
  total_cpu_cores: usize,
  cpu_name: String,
  has_gpu: bool,
  gpu_vram_gb: Option<f64>,
  total_gpu_vram_gb: Option<f64>,
  gpu_available_gb: Option<f64>,
  gpu_name: Option<String>,
  gpu_count: u32,
  unified_memory: bool,
  backend: GpuBackend,
  gpus: Vec<GpuInfo>,
  cluster_mode: bool,
  cluster_node_count: u32
}
```

Backends are CUDA, Metal, ROCm, Vulkan, SYCL, CPU ARM, CPU x86, and Ascend.
Each `GpuInfo` contains name, optional VRAM, backend, count, and unified-memory
status.

### Internal work

- Reads CPU/RAM through system APIs.
- Attempts platform-specific accelerator detection.
- Represents homogeneous multi-GPU total memory and heterogeneous GPU lists.
- Marks unified memory separately from discrete VRAM.
- Provides memory-size parsing, WSL checks, measured RAM bandwidth, GPU
  bandwidth lookup, compute-capability lookup, and quantization capability
  gates.

### Local Arcade treatment

Adopt as a detection input, not as final verified hardware identity. Local
Arcade must add detection method, source version, driver/runtime details,
confidence, manual corrections, and a stable hardware fingerprint. Website
manual input and desktop detection must normalize into one Local Arcade
`HardwareTarget` contract.

## 2. Models module

### Input

`ModelDatabase::embedded()` loads only the compile-time catalog.
`ModelDatabase::new()` combines the embedded catalog with the local updated
cache. Search takes a string query.

### Output

The principal record is `LlmModel`, containing:

- name and provider;
- human and raw parameter counts;
- minimum/recommended RAM and optional VRAM;
- default quantization and context length;
- use-case text and inferred `UseCase`;
- dense/MoE facts and active-expert facts;
- release date;
- known GGUF repositories;
- inferred/declared capabilities: vision, tool use, audio, TTS;
- languages;
- model format: GGUF, AWQ, GPTQ, AutoRound, MLX, Safetensors, ONNX;
- attention/KV architecture fields;
- license and architecture.

Model helpers estimate disk size, weights plus KV memory, KV cache alone,
best quantization for a memory budget, MoE active/offloaded memory, tensor
parallel compatibility, and inferred attention layout.

### Internal work

- Canonicalizes and deduplicates model names.
- Merges cached and embedded records.
- Infers capabilities and some architecture facts heuristically.
- Supplies quantization bytes/parameter, speed multipliers, and quality
  penalties.

### Local Arcade treatment

Use it for broad candidate discovery and upstream-compatible model facts.
Do not treat `LlmModel` as an exact runnable artifact. It does not by itself
pin repository revision, filename, SHA-256, runtime build, or a verified chat
template. Local Arcade's artifact registry remains the admission boundary.

## 3. Update module

### Input

```rust
UpdateOptions {
  trending_limit: usize,
  downloads_limit: usize,
  token: Option<String>
}
```

`update_model_cache(options, progress_callback)` queries Hugging Face.

### Output

`Result<(new_count, total_cached), String>` and a local model-cache file.
It also supports cache load, save, status path, and clear.

### Side effects

Network access and local cache writes.

### Local Arcade treatment

Do not replace Local Arcade's pinned artifact admission with this mutable
cache. It can supply discovery candidates, which then pass through immutable
revision, license, hash, and exact-artifact admission.

## 4. Runtime providers

### Common input/output interface

```rust
trait ModelProvider {
  fn name(&self) -> &str;
  fn is_available(&self) -> bool;
  fn installed_models(&self) -> HashSet<String>;
  fn start_pull(&self, model_tag: &str) -> Result<PullHandle, String>;
}
```

`PullHandle` streams `Progress`, `Done`, or `Error` events.

Implemented provider families include Ollama, llama.cpp, MLX, Docker Model
Runner, LM Studio, vLLM, and RamaLama. Provider-specific helpers locate
installed models, map Hugging Face names to provider tags, select GGUF files,
download shards, and sometimes delete models.

### Side effects

Provider probes may access localhost APIs, process state, filesystem caches,
and the network. Pull/delete methods mutate model stores.

### Local Arcade treatment

Adopt detection/mapping behind a Local Arcade provider port. Never expose
`start_pull` or deletion merely because it is available upstream. Download and
delete require Local Arcade's artifact-specific consent, hash verification,
threat-model checks, and a recoverable user experience.

## 5. Installed analysis

### Input

```rust
build_model_fits(
  db: &ModelDatabase,
  specs: &SystemSpecs,
  installed: &InstalledIndex,
  context_limit: Option<u32>,
  forced_runtime: Option<InferenceRuntime>
) -> Vec<ModelFit>
```

`InstalledIndex::detect_all()` probes providers concurrently.

### Output

An unsorted `Vec<ModelFit>` with installed markers and any matched measured
throughput.

### Internal work

1. Filters backend-incompatible catalog entries.
2. Analyzes each model against hardware.
3. Marks installation across providers.
4. Looks up throughput in this order:
   - newest local benchmark on this machine;
   - llmfit community submission on matching hardware;
   - matching localmaxxing community median.
5. Applies a median local calibration factor to formula estimates using
   eligible dense-model anchors.

### Local Arcade treatment

Useful as the initial advisory engine. Local Arcade must preserve source
identity and must not relabel all three measured sources as equally verified.

## 6. Fit and recommendation calculations

### Input

```rust
ModelFit::analyze(model, system)
ModelFit::analyze_with_context_limit(model, system, context_limit)
ModelFit::analyze_with_forced_runtime(model, system, context_limit, runtime)
ModelFit::analyze_with_config(model, system, CalcConfig)
```

`CalcConfig` permits context cap, efficiency, per-run-mode speed factors,
per-use-case scoring weights, and DDR bandwidth.

### Output

```rust
ModelFit {
  model,
  fit_level: Perfect | Good | Marginal | TooTight,
  run_mode: Gpu | MoeOffload | CpuOffload | CpuOnly | TensorParallel,
  memory_required_gb,
  memory_available_gb,
  utilization_pct,
  notes,
  moe_offloaded_gb,
  score,
  score_components: { quality, speed, fit, context },
  estimated_tps,
  best_quant,
  use_case,
  runtime,
  installed,
  fits_with_turboquant,
  effective_context_length,
  usable_context,
  estimate_basis,
  measured_tps
}
```

The estimate basis identifies the formula method, assumed bandwidths,
efficiency, context, and local calibration. Ranking helpers sort by composite
score or selected columns.

### Important semantic warning

The default composite weights quality, speed, fit, and context. The quality
component includes model-family reputation, parameter count, quantization
penalty, and task alignment. This is a useful upstream heuristic, not Local
Arcade evidence that one response is better than another.

### Local Arcade treatment

- Adopt fit and estimated-performance results as explicitly attributed
  advisory evidence.
- Retain the individual dimensions.
- Do not publish the upstream composite as Local Arcade's quality ordering.
- Re-rank only under Local Arcade's evidence policy. If the evidence is
  insufficient, return an unranked compatible shortlist.

## 7. Hardware planning

### Input

```rust
PlanRequest {
  context: u32,
  quant: Option<String>,
  target_tps: Option<f64>,
  kv_quant: Option<KvQuant>
}
```

plus an `LlmModel` and `SystemSpecs`.

### Output

`PlanEstimate` includes model/provider, context, quantizations, target speed,
minimum and recommended hardware, GPU/offload/CPU paths, current-machine
status, upgrade deltas, and alternative KV quantizations.

### Local Arcade treatment

Useful for "what hardware would I need?" and advanced what-if views. Every
number remains estimated until a matched measurement exists.

## 8. Kubernetes claim generation

The claim module converts a model plus minimum TPS, efficiency, quantization,
device class, and object name into Kubernetes DRA ResourceClaim YAML. It
calculates a memory floor and bandwidth floor.

This is a real llmfit-core feature but is outside Local Arcade consumer V1.

## 9. Endpoint benchmarking

### Input

```rust
bench_ollama(base_url, model, num_runs, progress_callback)
bench_openai_compat(base_url, model, provider, num_runs, progress_callback)
```

The auto-discovery path probes Ollama, vLLM, MLX, and llama-server and can
enumerate all detected targets. Environment variables may alter endpoint
locations.

### Output

```rust
BenchResult {
  model,
  provider,
  runs: [{
    ttft_ms,
    tps,
    total_ms,
    prompt_tokens,
    output_tokens
  }],
  summary: {
    num_runs,
    avg_ttft_ms,
    avg_tps,
    min_tps,
    max_tps,
    avg_total_ms,
    avg_output_tokens
  }
}
```

### Limitations relevant to Local Arcade

- Uses four built-in prompts in rotation.
- Performs a warm-up request.
- OpenAI-compatible requests are non-streaming, so real TTFT is unavailable.
- Local `BenchResult` does not contain exact artifact hash, runtime version,
  complete engine flags, context parameters, GPU-layer settings, preflight
  conditions, peak memory, power, thermals, or stability history.
- TPS for the OpenAI-compatible path is completion tokens divided by total
  wall time, not a provider-reported decode interval.

### Local Arcade treatment

Reuse endpoint discovery and request mechanics where useful. Wrap every run in
a stronger `MeasurementRun` envelope and add streaming trace capture for the
experience arena. Never upgrade raw `BenchResult` directly to verified.

## 10. Community benchmarks

llmfit-core can:

- fetch localmaxxing benchmark/leaderboard results;
- query by detected or selected hardware;
- consume an embedded cached leaderboard for hardware presets;
- consume benchmark submissions merged into the llmfit repository;
- index local measurements;
- expose measured TPS with sample count, hardware label, and source class.

Leaderboard records may carry model HF ID, engine/version/backend,
quantization, speculative/MTP flags, output and total TPS, TTFT, context,
batch size, peak VRAM, notes, hardware, user, and verification status.

### Local Arcade treatment

These are candidate evidence feeds, not automatically admitted evidence.
Before ingestion, Local Arcade must pin API/schema/version, establish license
and redistribution terms, retain raw provenance, define hardware/configuration
matching, separate speculative decoding, and assign an evidence class.

## 11. Quality and routing helpers

### Input

A YAML `QualityConfig` defines named roles, tests, prompts, regex scoring
rules, maximum tokens, temperature, and speed weight. The runner sends requests
to Ollama or an OpenAI-compatible endpoint.

### Output

- Per-test quality 0-10, TPS, composite, preview, TTFT/wall time, tokens, error.
- Per-role averaged quality, speed, composite, and test count.
- Per-model overall quality, speed, and composite.
- A best model and runner-up per role.
- Optional comparison to embedded frontier baseline scores.

### Internal work

Quality is a clamped sum of regex-rule weights. Routing sorts the resulting
quality/speed composite and selects the maximum.

### Local Arcade treatment

Do not adopt this as a quality evaluator, arena score, or routing authority.
Its useful reusable parts are provider request plumbing and perhaps fixture
execution. Local Arcade requires typed objective verifiers, separate human
preference, and no universal composite.

## 12. Local storage and sharing

llmfit-core stores benchmark payloads locally, indexes the newest compatible
measurement, and can contribute pending results to the upstream repository via
a GitHub pull request. It supports environment/cached tokens and GitHub device
flow.

### Output

`SubmitOutcome` reports PR URL, whether an existing PR was reused, uploaded
files, and skipped files.

### Local Arcade treatment

Do not reuse the GitHub-PR contribution flow as the Local Arcade contributor
network. We may support exporting to llmfit as an explicit user action, but
Local Arcade needs its own preview, consent receipt, integrity checks, queue,
revocation, and battle-generation protocol.

## 13. Diagnostics and task priors

- `doctor` generates a hardware diagnostic Markdown report from raw detector
  outputs without intending to include usernames, hostnames, or serials.
- `task_bench::score(model_name, task)` returns optional embedded task score
  data.

Task scores are upstream priors only. They must not become a Local Arcade
personal or crowd preference verdict.

## 14. Delivery surfaces beyond the core crate

### CLI

Commands include `system`, `doctor`, `claim`, `list`, `fit`, `search`, `info`,
`diff`, `plan`, `recommend`, `download`, `hf-search`, `update`, `run`, `serve`,
and `bench`. Global inputs include manual VRAM/RAM/CPU overrides, context cap,
JSON/CSV output, and an optional community API key.

### REST API

`llmfit serve` exposes:

- `GET /health`
- `GET /api/v1/system`
- `GET /api/v1/models`
- `GET /api/v1/models/top`
- `GET /api/v1/models/{name}`
- runtime, installed-model, download, and plan operations in the implementation

Model queries can filter limit, fit, runtime, use case, provider, search,
sort, context, and forced runtime. API documentation warns that CLI and REST
historically overload some vocabulary differently; this reinforces the need
for a Local Arcade adapter contract.

### MCP

Tools include system specs, recommendations, model search, hardware planning,
runtime discovery, and installed-model discovery.

### NATS

An optional feature publishes system, fit, plan, runtime, and installed-model
events.

## Adoption matrix

| Capability | Decision | Reason |
|---|---|---|
| Hardware detection | Wrap/adopt | Broad platform support; add provenance and correction layer |
| Model discovery | Use as candidate feed | Not exact immutable artifact admission |
| Fit calculation | Adopt as attributed advisor | Preserve formulas and estimate basis; do not call measured |
| Hardware planning | Adopt later | Good what-if primitive, not first-screen requirement |
| Provider discovery | Wrap/adopt | Avoid rebuilding runtime mappings |
| Installed-model scan | Wrap/adopt | Add exact artifact hashing and consent |
| Downloads/deletion | Do not expose initially | Requires Local Arcade security and consent contract |
| Endpoint benchmark | Reuse mechanics, replace envelope | Missing exact identity/preflight/streaming trace |
| Community leaderboard | Candidate source only | Requires license, matching, provenance, and trust audit |
| Composite quality score | Reject | Heuristic is not objective or preference evidence |
| Quality regex suite | Do not use for certification | Useful smoke mechanism only |
| Routing matrix | Reject | Violates criterion separation and evidence thresholds |
| GitHub PR sharing | Optional export only | Not Local Arcade's contribution architecture |
| REST/JSON/MCP | Useful integration surfaces | Must normalize behind versioned Local Arcade API |

## Required proof before dependency adoption

1. Pin the exact upstream version/commit and MIT notices.
2. Add contract fixtures for every upstream value Local Arcade consumes.
3. Demonstrate that an upstream schema change fails the adapter tests.
4. Compare llmfit fit results to Local Arcade's current ten fit goldens.
5. Test NVIDIA, AMD, Apple, CPU-only, unknown GPU, unified memory, and manual
   override cases.
6. Audit every network and filesystem side effect reachable through the chosen
   integration.
7. Decide whether desktop uses the Rust crate or a subprocess JSON boundary.
8. Decide how the no-install website reaches the same engine without copying
   formulas: hosted Local Arcade adapter is the default recommendation.
9. Keep an explicit list of upstream features not exposed by Local Arcade.
10. Re-run the audit before every pinned upstream upgrade.

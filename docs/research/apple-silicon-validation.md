# Apple Silicon validation boundary

Status: non-production research report for the product-owner-approved
ranking/audition comparison checkpoint. This report does not approve an Apple
ranking policy, import external measurements, change M-A, or authorize M-H,
M-O, runner expansion, or UI work.

Primary-source audit date: 2026-07-22. The Anubis source audit is pinned to
commit `8391bd9c75fd7960688e34825d5afd22935ecbbb`.

## Conclusion

Apple Silicon is not one performance bucket. A useful comparison must identify
the machine variant, chip, GPU-core count, unified-memory capacity, memory
available at the run, macOS version, runtime and build, Metal/runtime behavior,
artifact, quantization, context/cache configuration, benchmark protocol and run
conditions. A label such as "M4" or "M4 Pro" is insufficient by itself.

Marketed memory bandwidth is a useful hardware prior, not a measured run value
and not a ranking proxy. Unified memory removes a discrete CPU/GPU copy boundary
for appropriate APIs; it does not make all installed RAM available to a model,
erase OS/application pressure, or guarantee throughput. Actual run measurements
must remain distinct from fit estimates and bandwidth assumptions.

Anubis is valuable reference evidence for Apple coverage and methodology, but
its community rows cannot currently become exact Local Arcade evidence. They
lack immutable artifact identity, runtime build and important settings, and the
community dataset has no separate redistribution terms located in this audit.
No Anubis row was copied into this repository.

## What primary Apple and runtime sources establish

### Unified memory is a topology fact, not an available-memory claim

Apple defines [`MTLDevice.hasUnifiedMemory`](https://developer.apple.com/documentation/metal/mtldevice/hasunifiedmemory)
as whether the GPU shares all memory with the CPU. Apple separately exposes
[`recommendedMaxWorkingSetSize`](https://developer.apple.com/documentation/metal/mtldevice/recommendedmaxworkingsetsize)
as an approximation of the allocation that should not affect runtime
performance and `currentAllocatedSize` as current Metal-resource allocation.
These are different facts:

- installed unified memory describes physical capacity;
- current system availability changes with other processes and memory pressure;
- a Metal working-set recommendation is not the same as free RAM;
- process resident memory is not necessarily the complete system/Metal
  allocation;
- CPU and GPU pools share a physical budget on Apple Silicon and must not be
  added as independent capacities.

The website should continue requesting a confirmed unified-memory variant until
an exact hardware registry exists. The desktop can detect more fields, but it
must retain detected versus confirmed provenance and a timestamp for available
memory.

### Chip and machine variants matter

Apple's [2024 16-inch MacBook Pro specification](https://support.apple.com/en-ca/121554)
lists different M4 Max CPU/GPU variants and different 410 GB/s and 546 GB/s
bandwidth specifications, while M4 Pro is listed at 273 GB/s. Memory capacities
also vary independently. Consequently, neither family nor memory size uniquely
determines GPU cores or bandwidth.

The marketed GB/s value is classified as an assumption when attached to a run.
Apple documents that actual GPU bandwidth can be observed with Instruments and
the Metal debugger's counters in
[Measuring the GPU's use of memory bandwidth](https://developer.apple.com/documentation/xcode/measuring-the-gpus-use-of-memory-bandwidth).
Only that scoped observation is a measurement.

### Workload phase and runtime change the bottleneck

Apple's [M5/MLX study](https://machinelearning.apple.com/research/exploring-llms-mlx-m5)
tested named BF16 and quantized models with `mlx_lm.generate`, a 4,096-token
prompt and 128 generated tokens on similarly configured 24 GB M4 and M5 MacBook
Pro systems. Within that experiment Apple describes first-token work as
compute-bound and subsequent generation as memory-bandwidth-bound. It also says
the M5 Neural Accelerators require a compatible MLX path and macOS 26.2 or later.

That finding is a scoped measurement reference. It does not establish that:

- every model, quantization, context length or runtime is bandwidth-bound;
- marketed bandwidth predicts tokens per second with a stable coefficient;
- a result from MLX transfers to llama.cpp/Ollama/LM Studio;
- an M4/M5 result transfers to Pro, Max or Ultra variants;
- TTFT, prompt processing and decode speed can be collapsed into one metric.

Apple itself advises in
[Tuning your code's performance for Apple silicon](https://developer.apple.com/documentation/apple-silicon/tuning-your-code-s-performance-for-apple-silicon/)
that assumptions can cause regressions and actual-hardware testing is required.

### Runtime identity is part of the experiment

The primary [MLX repository](https://github.com/ml-explore/mlx) states that MLX
arrays use shared memory and CPU/GPU operations do not require transfers. The
[MLX LM repository](https://github.com/ml-explore/mlx-lm) documents quantization,
rotating KV-cache size, prompt caching and a macOS wired-memory limit for models
large relative to RAM. These options affect memory, speed or output behavior.
MLX version, MLX LM version, macOS version, artifact revision and generation
settings therefore belong in comparison identity.

The primary [llama.cpp build guide](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md)
states that Metal is enabled by default on macOS but GPU inference can be
disabled with zero GPU layers. A `metal` label alone does not prove the same
execution path. The exact llama.cpp commit/build, GPU-layer split, KV types,
context, batch/microbatch, threads, flash attention, mmap, template and sampler
settings remain required.

## Anubis community-source audit

The audit examined the source rather than relying on leaderboard presentation:

- [`LeaderboardService.swift`](https://github.com/uncSoft/anubis-oss/blob/8391bd9c75fd7960688e34825d5afd22935ecbbb/anubis/anubis/Services/LeaderboardService.swift)
  defines the submitted client payload;
- [`submit.php`](https://github.com/uncSoft/anubis-oss/blob/8391bd9c75fd7960688e34825d5afd22935ecbbb/leaderboard_site/anubis/api/submit.php)
  defines server admission at the pinned revision;
- [`BenchmarkSession.swift`](https://github.com/uncSoft/anubis-oss/blob/8391bd9c75fd7960688e34825d5afd22935ecbbb/anubis/anubis/Models/BenchmarkSession.swift)
  defines recorded run fields;
- [`SystemMetrics.swift`](https://github.com/uncSoft/anubis-oss/blob/8391bd9c75fd7960688e34825d5afd22935ecbbb/anubis/anubis/Models/SystemMetrics.swift)
  defines chip detection and lookup-derived fields;
- the [live analysis](https://uncsoft.github.io/anubis-oss/analysis.html)
  describes current repeated-run and display methodology.

### Useful fields

The submission shape includes app version, model ID/name, quantization, format,
backend label, prompt, token counts, prompt/evaluation durations, output
throughput, TTFT, context length, peak memory, power/frequency aggregates,
reasoning split, chip/GPU-core/memory/machine identifiers, a methodology
version, and optional repeated-run mean/standard deviation/bootstrap intervals.

These fields can test Apple candidate recall and reveal hypotheses worth local
verification. Repeated runs with a fixed seed are more useful for hardware
variance than single rows; random seeds mix sampler and hardware variance.

### Fields and controls insufficient for exact comparison

The public submission shape does not establish:

- immutable model repository revision, filename or content hash;
- exact runtime product version, engine build or Metal/backend version;
- chat template, separate K/V cache types, GPU-layer split, batch/microbatch,
  threads, flash attention, mmap, sampler and complete flags;
- an immutable prompt/harness identity;
- available memory, concurrent load or AC/battery state;
- comparable thermal condition for every result.

The chip's advertised bandwidth is populated by a source-code lookup and has a
generic fallback. It is not a measured per-run bandwidth counter. Older Anubis
methodology also required a power-scale migration; rows must therefore retain
app and methodology versions rather than pool across versions silently.

### Intake and trust observations

At the pinned revision, official client submissions are HMAC-signed with a
secret omitted from self-built copies; the server requires a completed status,
a display name and a 64-character machine identifier. The machine identifier is
a salted hash of the platform UUID. These controls limit casual direct writes
but are not remote attestation of the model, settings or measurement.

The server computes a recent-submission count but the audited `submit.php` does
not act on it before inserting the row. It also performs no numeric range,
duplicate, artifact, runtime-build or measurement-consistency validation visible
in that file. Local Arcade must not inherit a `verified` claim from admission.

The current app offers manual upload and an optional default-off auto-submit
mode. Once enabled, each successful run/rep can upload without a new per-run
preview. The payload source includes the full prompt. This conflicts with the
January 2026 [privacy page](https://devpadapp.com/anubis/privacy.html), which
states that benchmark data stays local and the app communicates only with
configured inference servers. It also exceeds the README's narrower explanation
that only performance and hardware data are submitted. This is a documentation
and consent concern, not evidence that responses are uploaded.

### License and data-use decision

The repository code is GPL-3.0. No separate license or contributor terms for
community-submitted benchmark rows were located in the repository, submission
UI, API source, analysis page or privacy page examined. A software license does
not by itself establish permission to redistribute user-submitted data.

Disposition: reference the source and public aggregate pages; do not cache,
copy, redistribute, train on or ingest row-level data until the product owner
has reviewed explicit dataset terms or obtained permission. This is a research
stop condition from the approved plan.

## M-A compatibility and adapter requirements

| Research fact | M-A representation | Compatibility or required adapter |
|---|---|---|
| Installed unified memory | `HardwareTarget.memory.totalRamBytes` plus `unified: true` | Compatible when detected/confirmed provenance is retained. |
| Available memory at evaluation time | `HardwareTarget.memory.availableRamBytes` | Compatible, but timestamp belongs in provenance; unknown must remain null. |
| Apple accelerator and Metal | accelerator `kind/vendor: apple`, `backend: metal` | Compatible. `deviceMemoryBytes` should remain null unless an approved Apple adapter defines its unified-memory meaning. |
| Exact chip variant/GPU cores/machine model | display/accelerator IDs only | Needs normalized Apple hardware metadata or an adapter-owned raw hardware record; do not infer from family name. |
| Shared CPU/GPU physical budget | fit `device` and `host` pools | Semantics unresolved: independent pool arithmetic can double-count unified memory. Adapter/policy decision required before Apple fit calibration. |
| Marketed bandwidth | no first-slice field | Keep as an attributed assumption in research/raw provenance; do not put it in measured performance. |
| Exact artifact/runtime | `ExactConfigurationCandidate` | Structurally compatible for MLX and llama.cpp strings/settings; unknown fields stay null. Anubis rows cannot populate the exact identity. |
| Prompt/decode/TTFT measurements | benchmark series and provenance measurement interval | Compatible when protocol, units, warmups and samples are available. Do not pair unrelated prompt/decode rows. |
| Power/frequency/bandwidth counters | no benchmark-series kind | Preserve in a reference/raw record only; expanding first-slice contracts requires owner approval. |
| Thermal/power/concurrent conditions | benchmark preflight | Coarse compatibility; research needs the source state and timing, not an inferred acceptable state. |
| Repeated-run confidence | provenance measurement confidence/interval | Compatible for the aggregate if raw samples, method and sample count survive; Anubis bootstrap method/version must remain attributed. |

## Neutral research record and validation

[`apple-reference-record.schema.json`](../../research/apple/apple-reference-record.schema.json)
is a research-only interchange for the assembler. It forces separate hardware,
runtime, protocol, observations, comparison eligibility and unknowns. Every
observation is classified as `measurement`, `estimate`, `assumption` or
`unknown`. The illustrative fixture deliberately cannot become comparison
evidence; the negative fixture proves a community measurement with unresolved
terms and missing exact identity is rejected.

Run:

```powershell
node research/apple/validate-records.mjs
```

The command validates both fixtures against the JSON Schema and applies semantic
fail-closed checks. [`sources.json`](../../research/apple/sources.json) records
the primary-source inventory and data-use disposition; it contains no external
benchmark rows.

## Assembler fields and next evidence needed

The shared comparison interchange needs these Apple-specific facts without
changing M-A:

- exact machine model, chip variant, GPU cores, installed unified memory,
  available memory observation and macOS version;
- marketed bandwidth as `assumption`, and observed bandwidth only as a separate
  `measurement` with counter/harness identity;
- explicit shared-memory pool relationship so host/device capacities are not
  summed;
- runtime product/version, engine build, backend/Metal version and all relevant
  execution settings;
- immutable artifact identity and format/quantization;
- phase-specific prompt/decode/TTFT samples, warmups and intervals;
- power, thermal, concurrent-load and seed conditions;
- source revision, methodology version, raw-record reference and row-level
  data-use status;
- explicit comparison eligibility and machine-readable missing-field reasons.

Before an Apple scorecard can compare llmfit, current Local Arcade or the
research baselines, the assembler still needs licensed exact-enough observations
or new local measurements using matched configurations. Family-level Anubis
rows may count only as candidate-recall references with exclusions, never as
exact fit or performance truth.

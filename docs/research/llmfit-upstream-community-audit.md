# llmfit upstream and community-result audit

Status: **Completed non-production upstream-baseline research lane**,
2026-07-22. This report does not authorize an llmfit adapter, production
ranking changes, external-data ingestion, caching or redistribution.

## Audit pins and method

This pass inspected the official `AlexsJones/llmfit` Git repository rather
than relying on product copy or the prior Local Arcade summary.

| Snapshot | Revision | Audited state |
|---|---|---|
| Pinned release | [`v1.1.6`](https://github.com/AlexsJones/llmfit/releases/tag/v1.1.6), commit [`aaa2bc179cec214ccdc44501c853b98fba0b343b`](https://github.com/AlexsJones/llmfit/commit/aaa2bc179cec214ccdc44501c853b98fba0b343b) | Released 2026-07-21; the version used by the existing Local Arcade audit |
| Current upstream | [`483e43431f610a210bf810aa0193e6100599a9a0`](https://github.com/AlexsJones/llmfit/commit/483e43431f610a210bf810aa0193e6100599a9a0) | `main` HEAD observed 2026-07-22; six commits after `v1.1.6` |

The relevant fit, benchmark, share, validation, embed and matching code is
unchanged between these snapshots. Current `main` adds two merged community
files (41 result rows) and an unrelated range-filter display change. The
released pin contains 11 submission files and 34 result rows; observed current
`main` contains 13 files and 75 result rows across five exact hardware-name
buckets. Only `llamacpp` and `vllm` occur in those current merged rows even
though the schema also permits Ollama and MLX.

## Conclusion

llmfit has a genuine, explicit community contribution loop:

```text
endpoint benchmark -> local pending JSON -> preview + confirmation
  -> GitHub device login/token -> contributor fork/branch/commit/PR
  -> schema and sanity CI -> maintainer review/merge
  -> next llmfit build embeds rows -> CPU+GPU-name match
  -> heuristic model-tag match -> measured TPS annotation/calibration
```

This is useful upstream work and a good consent/mechanics reference. It is not
an exact-configuration evidence system. The contributed schema retains a
hardware summary, provider model tag and aggregate latency/throughput values,
but drops immutable artifact identity, runtime build and most execution
settings. Its consumer calls a CPU- and GPU-name-only match “identical
hardware,” then heuristically joins model tags and may use the resulting ratio
to calibrate every other dense model estimate on that machine.

Accordingly:

- **candidate applicability:** a merged row may nominate a model family or
  provider tag for resolution;
- **evidence applicability:** it may be shown as attributed, partial community
  performance evidence with its limitations;
- **exact fit/ranking applicability:** blocked until an immutable artifact,
  complete runtime configuration, workload scope and stronger hardware match
  are resolved independently;
- **calibration applicability:** the existing llmfit cross-model calibration
  must not be imported as Local Arcade truth without comparative evaluation.

## Pinned/current recommendation baseline

The current recommendation baseline remains materially stronger than a simple
VRAM filter:

1. It loads an embedded model catalog, filters backend-incompatible entries and
   derives an inference runtime.
2. It caps default estimation context at 8,192 tokens, chooses a quantization
   against the selected memory path and assigns GPU, tensor-parallel, MoE
   offload, CPU offload or CPU-only execution.
3. It computes quality, speed, fit and context components. Default weights vary
   by inferred use case; quality is usually the largest component. Quality
   includes parameter tiers, family/name heuristics, generation/recency,
   quantization and a curated task-family adjustment.
4. It orders runnable rows before `TooTight`, then sorts by the weighted score
   unless the caller selects another column.
5. It annotates estimated TPS from, in precedence order, the newest local run,
   median merged llmfit-community rows and median matching-localmaxxing rows.
   Local and llmfit-community anchors can scale all formula estimates through a
   median measured/estimated ratio clamped to `[0.05, 3.0]`.

Primary source: [`fit.rs`](https://github.com/AlexsJones/llmfit/blob/483e43431f610a210bf810aa0193e6100599a9a0/llmfit-core/src/fit.rs),
[`analysis.rs`](https://github.com/AlexsJones/llmfit/blob/483e43431f610a210bf810aa0193e6100599a9a0/llmfit-core/src/analysis.rs#L151-L247).
The Local Arcade research harness therefore needs to compare against llmfit's
actual candidate generation, fit gate, dynamic quantization, weighted ordering
and measurement calibration—not a caricature of “sort by model size.”

## Community contribution path

### 1. What runs and what is saved locally

`llmfit bench` benchmarks a running Ollama, vLLM, MLX or llama.cpp-compatible
endpoint. The default is three measured requests after one throwaway warmup.
Measured prompts rotate through four built-in prompts; a failed warmup or run
returns an error and is not stored as a failure observation. Individual runs
contain TTFT when the provider exposes it, output TPS, wall time and prompt and
output token counts. The share payload keeps only aggregate values.

Every successful result is written before any sharing step to the platform
local-data directory under `llmfit/benchmarks/pending/`, or under
`LLMFIT_BENCH_STORE` when overridden. The filename is
`<unix-time>-<8-hex-hash>.json`. Sharing later moves it best-effort to
`shared/`; a move failure leaves it pending.

Sources: [`bench.rs`](https://github.com/AlexsJones/llmfit/blob/483e43431f610a210bf810aa0193e6100599a9a0/llmfit-core/src/bench.rs#L8-L141),
[`share.rs` local store](https://github.com/AlexsJones/llmfit/blob/483e43431f610a210bf810aa0193e6100599a9a0/llmfit-core/src/share.rs#L263-L430),
[`main.rs` store call](https://github.com/AlexsJones/llmfit/blob/483e43431f610a210bf810aa0193e6100599a9a0/llmfit-tui/src/main.rs#L2271-L2343).

### 2. Exact shared record

The version-1 schema is closed to unknown properties. A file contains:

| Area | Fields that survive |
|---|---|
| Submission | `schemaVersion`, `submittedAtUnix` |
| Tool | `name`, `version` |
| Hardware | class, hardware name, coarse nearest memory tier, total GPU VRAM, GPU count, unified-memory boolean, CPU name/core count, RAM and coarse OS family |
| Each result | provider model tag, provider, number of runs, average/minimum/maximum output TPS, nullable average TTFT, average wall time and average output-token count |

The schema and generator do **not** retain the prompt texts or prompt-token
average, per-run samples, warmup count, failures, model repository/revision/file
hash/size, explicit quantization, runtime/engine build, backend, context, KV
cache, GPU layers, batch/micro-batch, parallelism, threads, flash attention,
mmap, sampler or effective flags. Quantization is sometimes inferable from a
filename-like model tag, but inference is not identity.

Sources: [`schema.json`](https://github.com/AlexsJones/llmfit/blob/483e43431f610a210bf810aa0193e6100599a9a0/llmfit-core/data/community/schema.json),
[`build_submission`](https://github.com/AlexsJones/llmfit/blob/483e43431f610a210bf810aa0193e6100599a9a0/llmfit-core/src/share.rs#L54-L183),
and an observed [current RTX 2070 Super row](https://github.com/AlexsJones/llmfit/blob/483e43431f610a210bf810aa0193e6100599a9a0/llmfit-core/data/community/nvidia-geforce-rtx-2070-super/1784677844-2ff6ea93.json).

### 3. Explicit opt-in and preview

Benchmarking alone does not upload. It saves locally and suggests
`llmfit bench --share`. Sharing can be combined with a new run, or invoked
later with no model to send the pending backlog. The command:

- prints human-readable result summaries;
- supports `--dry-run`, which prints each complete JSON payload and makes no
  GitHub request;
- asks a default-no `[y/N]` question before submission;
- only skips the question when the user supplies `--yes`;
- leaves files pending on cancellation or submission failure.

`--share --yes` is still explicit command-line opt-in, but it removes the final
interactive consent moment. The TUI separately offers sharing after a local
benchmark; it does not make ordinary browsing an upload action.

Sources: [`main.rs` CLI flags](https://github.com/AlexsJones/llmfit/blob/483e43431f610a210bf810aa0193e6100599a9a0/llmfit-tui/src/main.rs#L784-L842),
[`share_all_pending`](https://github.com/AlexsJones/llmfit/blob/483e43431f610a210bf810aa0193e6100599a9a0/llmfit-core/src/share.rs#L436-L495),
[`community README`](https://github.com/AlexsJones/llmfit/blob/483e43431f610a210bf810aa0193e6100599a9a0/llmfit-core/data/community/README.md).

### 4. Authentication, fork, commit and PR

For a share-bearing benchmark command, credential preflight happens before the
benchmark runs. Token precedence is `GITHUB_TOKEN`, then `GH_TOKEN`, then a
cached device-flow token. Tokens are verified with `GET /user`. An explicitly
provided invalid environment token is a hard error; an invalid cached token is
discarded before interactive reauthentication.

Without a usable token, the bundled public OAuth application starts GitHub's
device flow and requests `public_repo` scope. The token is cached at
`<config>/llmfit/github_token`; Unix permissions are best-effort `0600`, while
the source has no explicit Windows ACL hardening.

The client then uses GitHub REST calls to:

1. identify the account and create or reuse its fork;
2. find the first open PR whose head is `<login>:bench/*`;
3. append content-hash-named files to that branch, or create a new branch from
   upstream `main`;
4. create the commits through the Contents API;
5. reuse an existing open benchmark PR or open a new one against `main`.

File paths are
`llmfit-core/data/community/<hardware-slug>/<local-store-name>.json`. Stable
paths make retries mostly idempotent: an existing path is skipped. The
submission timestamp is rewritten to share time, so it is not necessarily the
measurement time. Current main demonstrates the route with merged PRs
[#787](https://github.com/AlexsJones/llmfit/pull/787) and
[#788](https://github.com/AlexsJones/llmfit/pull/788).

Source: [`share.rs` authentication and GitHub API](https://github.com/AlexsJones/llmfit/blob/483e43431f610a210bf810aa0193e6100599a9a0/llmfit-core/src/share.rs#L512-L1122).

### 5. Validation timing and review

Before upload, generated Rust structs make normal newly produced payloads
well-shaped, and the submitter rejects an unidentified GPU/accelerator or CPU.
It does **not** run the repository JSON Schema or cross-field validator before
creating the branch/PR. Pending JSON is read as generic JSON and, apart from
restamping submission time and checking the hardware identity string, can be
uploaded. The documentation's phrase “asks for confirmation, then opens a
pull request” is accurate; schema validation is a PR gate, not a pre-PR gate.

The `Community Benchmarks` GitHub workflow runs for PRs touching the data
directory and validates the whole directory. It checks:

- two-level path and lowercase hardware slug;
- timestamp/hash filename convention;
- 64 KiB file and 100-result caps;
- Draft-07 schema conformance with no unknown fields;
- share-era/future timestamps;
- broad RAM, VRAM, CPU-core and GPU-count caps;
- `minTps <= avgTps <= maxTps` and positive average TPS.

It does not attest the submitter's machine, rerun inference, validate an
artifact/runtime, detect duplicate measurements with different filenames,
cross-check timing/token arithmetic or flag implausible TPS relative to the
claimed hardware. The workflow provides mechanical validation; the repository
does not define a data-specific review rubric, required reviewer, DCO or CLA.
Observed merges show a maintainer merge after PR creation, but source alone
does not establish protected-branch settings or a guaranteed human review
policy.

Sources: [`validate_community_benchmarks.py`](https://github.com/AlexsJones/llmfit/blob/483e43431f610a210bf810aa0193e6100599a9a0/scripts/validate_community_benchmarks.py),
[`community-benchmarks.yml`](https://github.com/AlexsJones/llmfit/blob/483e43431f610a210bf810aa0193e6100599a9a0/.github/workflows/community-benchmarks.yml).

### 6. Merge, embed and matching

The build script walks every JSON file under a hardware-slug directory, sorts
paths and embeds their parsed JSON into the compiled crate. It only warns and
skips unreadable or invalid JSON at build time; it does not rerun the schema or
sanity checks. Therefore CI/review is the integrity boundary. A merge reaches
users only in a later build/release; there is no live community-data fetch for
this channel.

At consumption time:

- hardware matches only when CPU and GPU strings are case-insensitively equal;
- the matcher ignores OS, RAM, VRAM, GPU count, unified-memory flag and hardware
  class;
- results are joined to the catalog through `tag_matches_model`, the installed
  model-tag heuristic;
- matched result-record averages are medianed;
- reported `sample_count` is the number of matching aggregate result records,
  not the sum of their `numRuns`;
- merged rows outrank localmaxxing medians but are below the user's newest
  matching local row;
- merged and local anchors can calibrate all dense, >=1B model estimates on the
  matched machine by one median ratio.

The phrase “identical hardware” in the source is consequently stronger than
the implemented predicate. A two-GPU row and one-GPU row with the same CPU and
GPU name can match despite different aggregate VRAM. Provider and runtime
differences can also be medianed after heuristic model matching.

Sources: [`build.rs`](https://github.com/AlexsJones/llmfit/blob/483e43431f610a210bf810aa0193e6100599a9a0/llmfit-core/build.rs),
[`benchmarks.rs` community matching](https://github.com/AlexsJones/llmfit/blob/483e43431f610a210bf810aa0193e6100599a9a0/llmfit-core/src/benchmarks.rs#L512-L621),
[`analysis.rs` precedence/calibration](https://github.com/AlexsJones/llmfit/blob/483e43431f610a210bf810aa0193e6100599a9a0/llmfit-core/src/analysis.rs#L165-L247).

## Three measurement channels remain distinguishable

| Channel | Storage/source | Match and aggregation | llmfit source enum | Local Arcade interpretation |
|---|---|---|---|---|
| Local | User's `pending/` and `shared/` JSON | Same CPU+GPU predicate; newest matching aggregate result | `LocalBench` | Locally observed, but still missing exact configuration and raw series |
| llmfit community | PR-reviewed JSON embedded into a later binary | Same CPU+GPU predicate; median of heuristically matched aggregate rows | `CommunityLlmfit` | Attributed community prior; not exact configuration evidence |
| localmaxxing | Separately scraped embedded API cache or live API | Hardware preset plus model+quant filters; median comparable rows | `Community` | External community source with a richer raw schema, different moderation and unresolved data-use terms |

The distinctions survive in `MeasuredSource`, display attribution and
precedence. They become less informative in the common `MeasuredTps` shape:
each collapses to TPS, a count, a hardware label and source. Localmaxxing itself
documents much richer optional model revision, hardware, runtime, context,
batch, engine flags and performance fields, but llmfit's fit annotation uses a
filtered median rather than carrying that full record forward. See
[localmaxxing API documentation](https://www.localmaxxing.com/en/api-docs) and
[`benchmarks.rs`](https://github.com/AlexsJones/llmfit/blob/483e43431f610a210bf810aa0193e6100599a9a0/llmfit-core/src/benchmarks.rs#L375-L510).

## Trust weaknesses

| Weakness | Source evidence | Effect on the comparison |
|---|---|---|
| Self-reporting and no machine attestation | Payload is produced client-side and accepted through a normal contributor PR | Treat numbers as community claims even after schema CI |
| Success-only selection | Failed warmup/run exits; shared schema requires at least one positive result | Cannot estimate OOM/crash/failure rate; survivorship bias |
| Thin configuration identity | Schema omits artifact hash/revision and runtime/settings | Blocks exact transfer and reproducibility |
| Weak hardware identity | Consumer checks only CPU and GPU names | GPU count, memory, OS and other consequential differences can transfer |
| Heuristic model identity | `tag_matches_model` joins provider tags to catalog names | False-positive/false-negative joins and quant/runtime conflation are possible |
| Aggregate-of-aggregates | Per-file averages/min/max replace raw samples; consumer medians record averages | No pooled distribution, run weighting, confidence interval or outlier audit |
| Misleading sample count | Consumer counts matched result records, not their `numRuns` | Displayed count is not the number of inference trials |
| Duplicate resistance is path-local | Stable filenames prevent retry duplication only for the same local file | Re-running or editing creates distinct valid records; no contributor/run dedupe |
| Version drift | Tool version survives, engine/artifact versions do not | Cannot separate harness improvements from runtime/model changes |
| Broad validation bounds | CI checks shape/order and extreme caps, not measurement plausibility | Malicious or accidental plausible-looking values can merge |
| Calibration propagation | One anchor ratio scales all dense estimates on the matched machine | A bad or incomparable anchor affects models that were never measured |
| Selection bias | Contributions require installed/running endpoints and an opt-in GitHub workflow | Contributors and models are not representative of novice users or failures |
| Timestamp semantics | Upload restamps `submittedAtUnix` | It records submission, not observation, time |
| Credential surface | Device flow requests `public_repo` and caches a bearer token | Useful mechanics, but too broad to adopt without a Local Arcade security review |

## License and terms

The llmfit repository is [MIT licensed](https://github.com/AlexsJones/llmfit/blob/483e43431f610a210bf810aa0193e6100599a9a0/LICENSE),
and community JSON is committed inside that repository. No separate dataset
license, contributor attestation, CLA or DCO was found in the repository,
community README, schema, share prompt or contribution guide. The share UI
asks whether to open the PR but does not state downstream reuse, redistribution
or revocation terms.

That supports source inspection and citation. It does **not** provide enough
evidence for this research lane to approve Local Arcade redistribution or
permanent ingestion of contributor rows. The owner must decide the legal/data
policy with appropriate review. Reference-only evaluation against pinned
public files is the safe current boundary.

localmaxxing's website describes itself as MIT licensed and exposes public
query endpoints, while its API documentation does not state a separate
benchmark-dataset license or caching/redistribution grant. llmfit embeds a
scraped cache in its MIT repository, but Local Arcade must not infer that the
upstream project's treatment settles Local Arcade's independent rights. Raw
localmaxxing ingestion remains separately blocked.

## Normalized mapping to M-A and research interchange

The classifications below use the approved research meanings:

- **exact:** representation preserves the source fact and its semantics;
- **lossy:** a useful fact survives, but source scope/detail is absent;
- **unsupported:** constructing the target would invent identity or evidence.

| Upstream value | M-A / research target | Class | Mapping rule and applicability |
|---|---|---|---|
| `tool.name/version`, committed file URL/revision, `submittedAtUnix` | `Provenance.source`, retrieval/submission time, `rawSourceRecordRef` | exact | Preserve `llmfit-community` as its own source. `submittedAtUnix` is not `observedAt`. Candidate/evidence metadata only. |
| CPU name/cores, RAM, OS family, GPU name/count, total VRAM, unified flag | `HardwareTarget` facts | lossy | Convert GB to bytes with declared convention and retain self-reported/community origin. Vendor/backend, stable accelerator identity, per-device memory, OS version and field origins are unresolved. Never claim detected exact hardware. |
| CPU+GPU consumer predicate | provenance `hardwareMatch` | lossy | Record the actual predicate as a partial/name match. Do not map the upstream label “identical hardware” to an M-A exact match. |
| Provider model tag | candidate discovery key/model-family hint | lossy | May enter candidate recall with source attribution; resolve independently to a promoted immutable artifact before fit/ranking. |
| Provider model tag | `ExactConfigurationCandidate.artifact` | unsupported | Repository, immutable revision, SHA-256, bytes, format, license and admission status are absent. |
| `provider` | runtime product/engine hint | lossy | Keep provider label; engine build, backend and all effective settings remain unknown. |
| Shared result aggregate | generation-speed community evidence | lossy | Preserve average and observed min/max in tok/s, `numRuns`, nullable average TTFT and source record. Mark configuration match unknown/partial and calibration ineligible. |
| `minTps/maxTps` | provenance measurement interval | exact value, lossy semantics | These are observed extrema, not a confidence interval; label them accordingly. |
| `numRuns` | provenance sample count | exact | Use the row's `numRuns`, not llmfit's later `MeasuredTps.sample_count`. |
| Per-run benchmark series/warmups | `BenchmarkResult.series` | unsupported | Raw samples and warmup count are not in the shared record. Do not synthesize them from aggregate values. |
| Complete runtime configuration | M-A `RuntimeConfiguration` | unsupported | Chat template, context, K/V cache, layers, batches, threads, sampler and flags are absent. Nulls describe missing fields only where M-A permits; they do not create a runnable configuration. |
| Successful shared row | fit or verification result status | unsupported | It proves one thinly described endpoint run succeeded; it does not establish candidate fit status, stability, failure rate or a complete verification plan/result. |
| llmfit composite score/order | recommendation portfolio ordering | unsupported | It is an evaluation baseline, not an M-A transport mapping or approved M-H policy. |
| localmaxxing `MeasuredTps` median | community performance evidence | lossy | Preserve separate source and preset/match policy. Prefer raw records for research when terms permit; never merge it with llmfit-community provenance. |

### Normalized example

For the current RTX 2070 Super file, a research-only normalized observation may
retain:

```json
{
  "sourceKind": "llmfit-community",
  "sourceRevision": "483e43431f610a210bf810aa0193e6100599a9a0",
  "sourceRecord": "llmfit-core/data/community/nvidia-geforce-rtx-2070-super/1784677844-2ff6ea93.json",
  "hardwareClaim": {
    "cpuName": "AMD Ryzen Threadripper PRO 5945WX 12-Cores",
    "acceleratorName": "NVIDIA GeForce RTX 2070 SUPER",
    "acceleratorCount": 2,
    "totalVramGb": 16,
    "osFamily": "windows",
    "matchPolicy": "case-insensitive CPU name + GPU name only"
  },
  "candidateHint": {
    "providerModelTag": "qwen2.5-coder-7b-instruct-q4_k_m.gguf",
    "provider": "llamacpp"
  },
  "measurementClaim": {
    "generationTokensPerSecond": { "average": 69.87, "observedMin": 59.91, "observedMax": 79.05 },
    "declaredRuns": 3,
    "averageTtftMs": null
  },
  "applicability": {
    "candidate": "resolve-required",
    "evidence": "partial-community-prior",
    "exactConfiguration": "unsupported",
    "calibration": "ineligible"
  }
}
```

This is deliberately not an M-A `ExactConfigurationCandidate` or
`BenchmarkResult`. It supplies a traceable research observation and explicit
blocked mappings without fabricating the missing identity.

## Integration recommendation and open blockers

The comparison harness should implement llmfit community data as a separate
baseline input channel, not fold it into Local Arcade evidence:

1. Pin the release and source revision on every extracted research record.
2. Preserve local, llmfit-community and localmaxxing sources independently.
3. Score candidate recall both with and without community hints.
4. Mark exact-configuration completeness false for all current llmfit shared
   rows.
5. Evaluate whether llmfit's community calibration improves interval accuracy
   or increases regret under hardware/config mismatches.
6. Count unsupported mappings and withheld candidates as results rather than
   silently resolving them through name heuristics.

Owner/security/legal decisions still required before production use:

- whether Local Arcade may cache or redistribute llmfit community JSON;
- whether raw localmaxxing API/cache use is permitted and on what terms;
- whether any Local Arcade contribution feature may reuse GitHub device flow,
  and with what narrower token/storage boundary;
- what exact hardware/configuration predicate makes community performance
  eligible for ranking or calibration;
- whether failures and rejected observations must be captured before a future
  community channel can support reliability claims.

Until those are resolved, this audit supports **reference-only comparative
research**. It does not authorize M-B, M-H, M-O, external ingestion or a public
contribution service.

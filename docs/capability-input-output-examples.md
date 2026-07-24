# Capability input/output examples

Status: **Wave 1 verification evidence — no production authority.**

This is the subsystem review packet a producing team would show to consuming
teams. Every section records what was actually supplied, what actually came
back, how to reproduce it and whether a downstream team can use the result.

The examples are intentionally small. Dummy fixtures prove deterministic
mechanics; live or independently selected scenarios are identified separately.
A schema fixture proves that a shape validates. It does not prove a subsystem
exists to produce that shape.

## Why a gate is partial or missing

| Cause | Meaning | Current examples |
|---|---|---|
| Unfinished dependency work | The existing implementation is sound within its tested responsibility, but its final boundary or consumer has not been built. | Contracts, catalog, hardware, configuration, evidence, inventory and verification handoffs |
| Legacy implementation needs revision | Useful behavior exists, but it predates the approved contracts or hides information required by the new design. | Finder recommendation, direct desktop commands and current presentation |
| Core only | The algorithm works with direct/synthetic inputs, but no complete subsystem admits real inputs and emits consumable results. | Fit/performance and preference rating |
| Not built | No executable producer exists. A proposed schema or design document is not output. | llmfit adapter, private comparison and application workflow |
| Intentionally deferred | Product-owner direction forbids implementing the capability in the current slice. | Public contribution and public evidence service |

None of the missing cells means the entire repository was “built badly.”
Several tested cores are worth preserving. The problem is that earlier status
language sometimes promoted a passing core or adapter into a completed
subsystem. The cases called out as legacy need revision because their output is
insufficient for a safe downstream handoff.

## M-A — Shared data contracts

**Positive fixture input**

```json
{
  "schemaVersion": 1,
  "contract": "hardware-target",
  "status": "ok",
  "data": {
    "hardwareTargetId": "hw-fixture",
    "memory": { "totalRamBytes": 34359738368, "availableRamBytes": 25769803776, "unified": false },
    "accelerators": [{ "acceleratorId": "nvidia-fixture", "backend": "cuda", "deviceMemoryBytes": 12884901888 }]
  }
}
```

**Observed output:** TypeScript and Rust accept the envelope and preserve the
32 GiB RAM, 24 GiB available RAM, 12 GiB accelerator memory, field origins,
provenance and completeness. The canonical fixture contains the complete
objects omitted from the summary above.

**Adverse input:** change `schemaVersion` to `2`, add an undeclared field or
remove a required task field.

**Observed output:** validation fails. Forward versions and extra fields are not
silently accepted.

**Reproduce**

```powershell
npm.cmd run contracts:validate
node --import tsx --test tests/contracts-v1.test.ts
cargo test --manifest-path runner/src-tauri/Cargo.toml --test contracts_v1
```

Evidence: `contracts/fixtures/hardware-target.ok.json`,
`contracts/fixtures/invalid/schema-version.json`, `tests/contracts-v1.test.ts`
and `runner/src-tauri/tests/contracts_v1.rs`.

**Handoff result:** the boundary works, but not every producer or surface is
forced to use it. This is unfinished adoption, not a broken contract core.

## M-B — llmfit advisory adapter

**Real upstream probe input:** pinned llmfit `v1.1.6` at
`aaa2bc179cec214ccdc44501c853b98fba0b343b`, with nominal `12G` GPU memory,
`32G` RAM, `16` CPU cores, coding task, `16384` context, llama.cpp runtime and
three-result limit.

**Observed upstream output:** exit code `0` and three advisory rows. The first
was `bearzi/Qwen3-Coder-Next-oQ8`, `Q2_K`, fit `Good`, llama.cpp, estimated
`35.3` tokens/s, and `9.54 GB` required of nominal `12 GB` GPU memory. This is
an upstream family/configuration hint, not an admitted Local Arcade artifact.
The output also retained the host machine's GPU identity, backend, bandwidth
and other detected facts, so it is not a pure independent-input execution.

**Adverse probe:** invalid `min-fit` and `runtime` strings.

**Observed adverse output:** llmfit still exited `0` and returned a vLLM row.
The research normalizer separately proves exact, lossy, unsupported and
unavailable envelopes and rejects unknown enums, version drift, request/echo
mismatches, invalid numbers and untrusted capture labels.

**Captured replay result:** five retained files match exact SHA-256 values and
the retained exit records are zero. Normalization remains blocked because
available RAM, CPU/GPU identity, backend, GPU count and unified-memory state
were host-detected, while interaction style and an exact capture timestamp were
not retained. The hashes prove retained-byte integrity, not cryptographic
execution attestation.

## U33–U37 — process-local existing-engine verification execution

**Fixture input summary:** a moved sealed M-J `PreparedVerification` containing
one `llama-bench-v1` benchmark plan and three fixed
`existing-llama-cli-v1` checks, checked artifact/tool paths and SHA-256
identities; explicit side-effect acknowledgements; and fake process outputs.
The benchmark rows use official per-run JSON and report the exact model path,
build `b10061 (5d5306bf3)`, CUDA backend, 16,384-token test depth, KV types,
layers, batch/ubatch, threads, flash-attention and mmap settings. The quick
invocations carry the complete sealed temperature/top-p/top-k/min-p/seed
sampler exactly; the benchmark validates those fields but does not exercise
sampling.

**Observed output summary:** the successful fixture produced one authorization
receipt, monotonic per-child progress, one exact post-load backend/build receipt,
then three mechanically scored check observations in plan order. The terminal
M-J result contains the benchmark and quick-check results without a composite
quality claim. Stop during quick checks preserves the completed benchmark and
earlier check observations. Backend mismatch, malformed benchmark JSON,
quick-output identity drift and invalid mechanical output fail closed without
inventing observations. Replay/cross-identity confirmation and a second active
worker fail closed. A quick-only plan is blocked because `llama-cli` does not
produce the approved structured runtime-load/backend receipt.

```powershell
cargo test --manifest-path runner/src-tauri/Cargo.toml execution_service --lib
cargo test --manifest-path runner/src-tauri/Cargo.toml --lib
cargo clippy --manifest-path runner/src-tauri/Cargo.toml --lib --tests -- -D warnings
Push-Location runner; npm.cmd run check; Pop-Location
```

Observed counts in the latest targeted pass: 15/15 execution-service fixtures,
5/5 execution-transport fixtures and 80/80 combined Rust library tests. These
were injected process-boundary fixtures. Env-gated live targets do not prove
that an external model process ran unless their variables and pinned tool/model
fixtures are present. Typed opaque start/status/stop/result commands are
registered, but the frontend does not call them.

**Equivalence examples:** the synthetic comparison corpus shows one agreement
(`7,247,757,312` required bytes in both systems), one explicit disagreement
(upstream fit versus Local Arcade no-fit), and one unrepresentable
heterogeneous multi-GPU topology. It does not demonstrate general equivalence
or ranking superiority.

**Isolated direct-core input:** explicit `32 GiB` total RAM, `24 GiB` available
RAM, 16 logical CPU cores, one named CUDA accelerator with `12 GiB`, `8192`
context, a `qwen` model query, no forced runtime and a fixed `50 GB/s` DDR
assumption.

**Observed isolated output:** the pinned embedded catalog produced 959
backend-compatible `qwen` formula advisories in stable model-identity order.
The first was
`0xBonge/Qwen2.5-0.5B-Instruct-Gensyn-Swarm-flexible_fierce_owl`, fit
`Perfect`, auto-selected llama.cpp, `Q8_0`, `1.035 GiB` required and `400.783`
estimated generation tokens/s. A repeated call and a second process returned
the same ordered result. This is a large unranked family-advisory set, not a
useful portfolio or an exact configuration assessment. The response contains
no installed state, measurement, community/localmaxxing observation or
composite score.

**Isolated adverse inputs:** missing confirmed memory, unknown backend,
heterogeneous devices, contradictory RAM, non-finite values and any forced
runtime all return typed errors before upstream calculation.

**Boundary result:** the TypeScript envelope parser and request validator pass
nine positive/adverse contract tests. The proposed M-B → M-F binder now
returns `llmfit.binding.registry-crosswalk-unverified` even for a structurally
valid declared binding because M-C does not yet verify an upstream-family
crosswalk. The Rust raw DTO also does not match the TypeScript envelope and no
IPC/FFI/JSON normalizer connects them. Those are exposed missing interfaces,
not reconstructed successes.

**Reproduce**

```powershell
npm.cmd run proof:mb
cargo test --manifest-path crates/llmfit-adapter/Cargo.toml --locked `
  explicit_cuda_request_returns_stable_unranked_formula_advisories -- --nocapture
```

Evidence: `research/llmfit/provider-audit/`,
`research/llmfit/normalization/`, `research/llmfit/replay/` and
`research/llmfit/equivalence/`, `research/llmfit/production-contract/`,
`lib/llmfit/` and `crates/llmfit-adapter/`.

**Handoff result:** the isolated direct-core calculation and provider-neutral
boundary are partial. M-F still has no real M-B output to consume. Linking
upstream into the runner would violate its zero-HTTP-client dependency
boundary, and public distribution needs embedded-data licensing review.
Website execution remains unresolved under U9.

## M-C — Model artifact catalog

**Dummy input:** the first promoted record from
`registry/generated/artifacts.json`, including publisher/repository, immutable
revision, filename, lowercase SHA-256, bytes, format, quantization, license and
field provenance.

**Observed output:** `toRegistryArtifactIdentity()` returns `kind: "ok"` with the
same immutable artifact fields, model-family identity and 15 provenance
records. It deliberately does not manufacture a runtime.

**Adverse inputs and outputs**

```text
artifact status = triage
→ blocked / registry.artifact-not-promoted

SHA-256 converted to uppercase
→ blocked / registry.artifact-contract-incompatible
→ missing includes “lowercase SHA-256”

snapshot evaluated eight days after last successful ingestion
→ blocked / registry.snapshot-not-fresh
```

**Reproduce**

```powershell
node --import tsx --test tests/registry-contract-adapter.test.ts
```

Evidence: `tests/registry-contract-adapter.test.ts`.

**Handoff result:** M-E and M-I equivalence tests consume the identity, but
application composition is absent. The catalog boundary is good; its full
handoff is unfinished.

## M-D — Hardware detection and confirmation

**Dummy input**

```text
Windows 11
Fixture CPU / 16 logical cores
32 GiB confirmed RAM
RTX 4090 registry ID
24 GiB confirmed device memory
CUDA
```

**Observed output:** `state: "ready"`; the accelerator identity and 24 GiB value
are preserved, and the device-memory origin is `confirmed`.

**Adverse input:** RTX 4060 Ti selected without choosing its 8 GiB or 16 GiB
variant.

**Observed output**

```text
state: confirmation-required
reasonCodes: [hardware.memory-variant-ambiguous]
confirmationFields: [/accelerators/0/deviceMemoryBytes]
deviceMemoryBytes: null
options: [8 GiB, 16 GiB]
```

Other tested outputs include:

```text
unknown accelerator → confirmation-required; no fabricated stable ID
two devices → selection required; both devices preserved
zero RAM/count → unavailable / hardware.invalid-manual-input
registry memory mismatch → entered value preserved and confirmation required
```

**U31 producer input:** an imported 32 GiB Windows target and a separately
resolved target with the same material accelerator facts but 31.5 GiB detected
RAM.

**Observed producer output**

```text
state: confirmation-required
reasonCodes:
  [m-d.hardware-confirmation.total-ram-normalization-confirmation-required]
confirmationFields: [/memory/totalRamBytes]
effective totalRamBytes: 31.5 GiB
receipt: unavailable until the exact reason and field sets are acknowledged
```

The v1 tolerance is the smaller of three percent of imported total RAM or
1 GiB. The lower capacity is retained. Hardware-target IDs, OS version,
available RAM, CPU description/count and origin differences remain visible but
are not identity authority. OS family, accelerator identity/vendor/kind/backend,
device count/capacity and unified-memory facts are material.

**U31 fail-closed cases**

```text
same hardwareTargetId but Linux instead of Windows → blocked
same hardwareTargetId but Vulkan instead of CUDA → blocked
32 GiB imported versus 30 GiB detected → blocked
unknown accelerator identity → blocked
missing unified-memory or accelerator-capacity fact → blocked
registry-nominal device-memory normalization → exact acknowledgement required
wrong or duplicate acknowledgement sets → blocked
```

**Reproduce**

```powershell
node --import tsx --test tests/hardware-target-adapter.test.ts
cargo test --manifest-path runner/src-tauri/Cargo.toml --test hardware_target_adapter
cargo test --manifest-path runner/src-tauri/Cargo.toml --test hardware_confirmation
```

Evidence: `tests/hardware-target-adapter.test.ts`,
`runner/src-tauri/src/hardware_confirmation.rs` and
`runner/src-tauri/tests/hardware_confirmation.rs`.

**Handoff result:** the target adapter and process-local confirmation producer
are fail-closed. The confirmation receipt retains imported, resolved and
effective snapshots behind an opaque process-local handle. M-F/M-O do not yet
consume that handle through the product workflow, and Windows still has more
live coverage than macOS/Linux.

## M-E — Exact configuration compatibility

**Dummy input:** promoted artifact identity plus explicit llama.cpp build,
CUDA backend, ChatML template, 16,384 context, F16 K/V cache, all GPU layers,
batch/micro-batch, threads, flash-attention, mmap, sampler fields, package
members and successful compatibility evidence.

**Observed output:** an exact `candidate-fixture` containing the immutable
artifact and every runtime setting, plus a separately versioned compatibility
admission receipt bound to the candidate, artifact hash, runtime, platform and
package facts.

**Adverse input:** omit runtime configuration ID, build identity, chat template,
K/V cache and sampler fields.

**Observed output**

```text
kind: blocked
reasonCode: candidate-incomplete
missing:
  runtime.runtimeConfigurationId
  runtime.runtimeBuild.buildIdentity
  runtime.chatTemplate
  runtime.kvCache
  runtime.sampler
```

Unknown products, backends, package layouts, ambiguous versions or compatibility
status also return blocked results rather than defaults.

**Reproduce**

```powershell
node --import tsx --test tests/runtime-candidate-builder.test.ts
```

Evidence: `tests/runtime-candidate-builder.test.ts` and
`contracts/fixtures/exact-configuration-candidate.ok.json`.

**Handoff result:** M-J consumes a validated receipt in tests. M-O still must
carry candidate and receipt together, so this is an unfinished product handoff.

## M-F — Fit and performance assessment

**Executable boundary input:** the proof passes the exact M-E candidate and
compatibility receipt, a confirmed 32 GiB host plus one confirmed 8 GiB CUDA
device, a profile bound to the complete runtime/artifact/device/hardware
identity, an attributed 256 MiB device reserve + 2 GiB host reserve + 5 percent
margin policy, and three exact M-G personal measurements. M-B is absent.

The assessment proof no longer constructs those last two inputs directly.
`admitFitProfile()` and `admitCapacityPolicy()` first require their source
records to identify the exact candidate, artifact SHA-256, complete runtime,
hardware target, selected accelerator, run path, allocation arithmetic and raw
observations, policy version/binding/approval, and traceable M-A provenance.
Each record must exactly match a repository-owned reviewed-manifest entry by
canonical SHA-256; the policy entry must be marked owner-approved. Only their
admitted outputs are accepted by the TypeScript assessment input. The manifest
is an injected trust root, not request data.

**Admission proof input/output**

```text
manifest-locked synthetic runtime-scoped profile + policy
  -> admitted profile + admitted policy
  -> M-F partial assessment (fit good; performance absent)

complete-looking record outside reviewed manifest
  -> blocked: untrusted source

checked Qwen legacy profile
  -> blocked: fit-profile.incomplete
  -> schemaVersion, profileId, mode, runPath, allocation, provenance,
     hardware/candidate scope, and every missing runtime/KV/sampler field named

mutated content/observation/artifact/runtime/hardware/policy/provenance fact
  -> blocked; no admitted value
```

**Observed M-A output**

```text
status: ok
assessmentId: assessment-m-f-proof
candidateId: candidate-fixture
hardwareTargetId: hw-fixture
fit: good
runPath: gpu

device required/available: 5,566,470,554 / 8,589,934,592 bytes
host required/available:   3,270,508,544 / 34,359,738,368 bytes
prompt speed:              150..180 tokens/second
generation speed:          40..55 tokens/second
time to first token:       120..220 milliseconds
taskQuality evidence:      []
blockingReasons:           []
```

The same proof exercises the preserved host-only `fit()` core: a CPU candidate
returns an honest all-zero device pool and one complete host pool.

**Adverse inputs and observed outputs**

```text
device or host capacity too small        -> does-not-fit + named pool reason
no speed evidence                        -> partial + three null ranges
receipt/profile/runtime/hardware drift   -> blocked, no data
unified or multi-device split ambiguity  -> blocked, no data
unattributed reserve/margin policy       -> blocked, no data
nonzero unapproved tight threshold       -> blocked, no data
unsupported/wrong-channel M-G evidence   -> blocked, no data
purported successful M-B binding         -> blocked until M-C crosswalk exists
invalid arithmetic input                 -> typed error, no thrown exception
```

Deterministic-repeat and input-immutability checks pass. The source boundary
imports no UI, recommendation/ranking, runner, network, process or storage
module.

**Reproduce**

```powershell
npm.cmd run proof:mf-admission
npm.cmd run proof:mf
```

Evidence: `lib/assessment/`, `research/mf-profile-admission/`, and
`research/mf-assessment/`.

**Remaining handoff gap:** this proves the real M-F contract boundary, not a
production journey. The admission mechanism exists, but the checked real fit
profile omits several M-E runtime-affecting fields and raw-source bindings;
there is no reviewed production manifest or approved concrete capacity-policy
record, so no checked real pair is admitted. M-B remains optional/unavailable
and M-H still consumes the legacy evaluation shape.

## M-G — Evidence normalization and claim scope

**Dummy input**

```text
metric: generation-throughput
method: measurement
source: personal
hardware match: exact
configuration match: exact
interval: 18–22 tokens/s at 95%
samples: 5
matching artifact/settings/hardware identity
```

**Observed output**

```text
kind: exact
claim: verified
candidateId: candidate-1
hardwareTargetId: hardware-1
measurement: 18–22 tokens/s
confidence: 0.95
sampleCount: 5
```

**Adverse inputs and outputs**

```text
different hardware fingerprint
→ kind: unsupported
→ reason says hardware does not match

no provenance links
→ kind: unsupported
→ reason identifies missing provenance

community coarse bucket with fields v1 cannot preserve
→ kind: lossy
→ claim remains community; lost fields are named
```

**Reproduce**

```powershell
node --import tsx --test tests/evidence-adapters.test.ts tests/evidence-contract.test.ts
```

Evidence: `tests/evidence-adapters.test.ts`.

**Handoff result:** mapping honesty works. The final M-F/M-H consumer boundary
and stable reason vocabulary remain unfinished.

## M-H — Recommendation portfolio

The approved compatibility-only boundary is executable in isolation. The
current website still calls the separate legacy ranker, so this is a subsystem
proof rather than a production user journey.

**Synthetic input**

```text
M-A request: coding, 16K derived context, speed priority
frozen universe: five artifact IDs and exactly five disposition entries
family Qwen: Q4 and Q5 exact configurations
family Gemma, Phi and Llama: one exact configuration each
per candidate: M-E candidate + admission receipt, M-F assessment, M-G evidence
optional reviewed familiarity: candidate/artifact-bound and provenance-bearing
```

The trusted fixture assembler brands the complete M-E/M-F composition
immediately before M-H. Mutating `runtime.batchSize` or an M-F memory-pool value
after that point produces a blocked envelope.

**Observed output**

```text
status: ok or partial (depending on explicit evidence gaps)
outcome: unranked-compatible
items: at most five distinct model families
roles: null
ledger: one row for every frozen artifact, including the unselected
        same-family quantization and every unsupported/upstream-gap entry
```

For two quantizations of one family, hard fit is checked first. Stronger exact
configuration-bound evidence wins; then only the requested priority may
differentiate them. Reviewed familiarity can break a remaining tie, but is
disclosed and never treated as model quality. Q4 is therefore not selected
merely because “Q4 is popular,” and Q5 is not selected merely because its number
is larger. The other quantization remains in the ledger for the future exact
configuration-detail alternatives path.

Adverse fixtures demonstrate `coverage-gap` for unknown/unattributed coverage,
`nothing-fits` only for completely assessed failures, rejection of contradictory
exact task-success records, no padding below five, complete dispositions above
five, and no ranked output under any approved priority.

**Reproduce**

```powershell
npm.cmd run proof:mh
```

Observed: 23 behavior tests and one import/purity test pass. Evidence:
`research/mh-portfolio/portfolio.test.ts` and
`research/mh-portfolio/boundary.test.mjs`.

**Handoff result:** the boundary and synthetic producer handoff are proven.
U27 can now produce a content-bound, proposed-unreviewed capture after a user
selects an exact artifact and existing `llama-fit-params` executable, but it
still prevents a real portfolio because no live capture has been reviewed into
an M-F profile manifest or paired with an approved concrete capacity policy.
M-O/M-P consume the capture only in the desktop path; replacement website and
CLI consumers remain absent. No result here demonstrates ranking superiority
over llmfit.

## M-I — Owned model inventory

There are two distinct demonstrations that must not be conflated.

**Raw scanner input**

```text
explicitly requested Ollama, LM Studio and/or named extra directories
bounded file count and byte budget
```

**Observed raw output:** found artifacts plus unreadable paths and truncation.
A loose GGUF is not hashed automatically and remains a size-only finding.

**Explicit promotion input:** one path selected by the user from the retained
`candidateBySize` scan result.

**Observed promotion output:** the Windows boundary opens the canonical file
read-only, hashes it, verifies unchanged metadata and exact byte size, and
returns one process-local selection handle only when exactly one promoted
registry artifact matches. The handle reports `previewOnly: true` and
`grantsExecutionAuthorization: false`. Alias, mutation, digest mismatch,
ambiguity and non-candidate paths are blocked.

**Adapter input:** raw findings plus a fresh admitted M-C registry snapshot.

**Observed adapter outputs**

```text
exact lowercase SHA-256 + exact byte size + promoted identity
→ verified

byte-size match without exact hash
→ candidate, never verified

multiple generated identities with the same match
→ ambiguous, never selected arbitrarily

stale/invalid registry
→ unavailable registry reconciliation
→ local findings remain visible
```

**Reproduce**

```powershell
cargo test --manifest-path runner/src-tauri/Cargo.toml --test inventory_contracts --test model_store_scan
```

Evidence: `runner/src-tauri/tests/inventory_contracts.rs` and
`runner/src-tauri/tests/model_store_scan.rs`.

**Handoff result:** M-O and M-P now expose the explicit promotion path without
inventing identity or authority. A native user walkthrough covering every
partial/ambiguous state remains unfinished.

## M-J — Local verification

**Dummy preparation input**

```text
confirmed hardware target
exact M-E candidate
validated compatibility admission receipt
verified M-I artifact path and SHA-256
checked llama-bench/llama-cli identities
explicit benchmark and quick-check settings
Windows/current architecture and admitted package members
```

**Observed output:** a typed verification plan bound to
`candidate-fixture`, the artifact path/hash, runtime settings, one warmup and
three measured benchmark runs, explicit side effects and preflight conditions.

**U32 tool-identity producer input**

```text
action: inspect-existing-tool-identity-v1
kind: benchmark
selected path: C:\LocalArcade\tools\llama-bench.exe
only process argument: --version
```

**Observed producer output**

```text
canonical path: C:\LocalArcade\tools\llama-bench.exe
sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
sizeBytes: 42
reported product/engine/build: llama-cpp / llama.cpp / b10061 (5d5306bf3)
probeProtocolId: llama-cpp-version-v1
grantsAuthorization: false
childWriteIsolationEnforced: false
childNetworkIsolationEnforced: false
observed backend: absent
```

The receipt proves the selected file identity and strictly parsed reported
build only. Planned backend remains bound by the exact M-E candidate and
compatibility-admission receipt. The separately gated U33–U37 worker
now obtains actual backend/build/runtime evidence only from admitted official
per-run JSON after model load; the version probe itself still makes no backend
claim.

**Dummy result input:** completed prompt-processing samples `170, 175, 180` and
generation samples `58, 60, 62`.

**Observed output**

```text
domainStatus: completed
prompt median: 175 tokens/s
generation median: 60 tokens/s
calibrationEligible: false
exclusion: thermal and concurrent-GPU telemetry are unknown
```

**Adverse inputs and outputs**

```text
selected file hash differs from admitted artifact
→ blocked / artifact.identity-mismatch

stop after completed benchmark but before quick checks
→ partial / stopped
→ completed benchmark observations preserved

stop after the first completed quick check
→ partial / stopped
→ completed benchmark and first check preserved

quick-only plan
→ blocked / benchmark-plan-required-for-runtime-load-evidence

sampler field missing or changed
→ blocked before spawn; no default is invented

unknown telemetry
→ result remains visible
→ calibration eligibility remains false

wrong executable basename, relative/UNC path or Windows alternate data stream
→ blocked before version inspection

canonical local-drive path
→ established once and preserved byte-for-byte through plan, spawn and report
→ normal `C:\...` and canonical `\\?\C:\...` forms accepted
→ aliases, symlinks, UNC and device routes blocked

malformed version output, stderr, nonzero exit or output above 16 KiB
→ blocked; no build identity receipt

version probe exceeds two-second watchdog
→ child killed and waited; blocked / m-j.tool-probe.timed-out

file metadata or SHA-256 changes during inspection
→ blocked / m-j.tool-probe.identity-drift

path replacement while the identity guard is held
→ blocked on Windows

descendant retains a stdout/stderr pipe after the direct child exits
→ bounded fail-closed return; no process-tree isolation claim
```

**Reproduce**

```powershell
cargo test --manifest-path runner/src-tauri/Cargo.toml --test verification_adapter
cargo test --manifest-path runner/src-tauri/Cargo.toml --test existing_tool_probe
cargo test --manifest-path runner/src-tauri/Cargo.toml execution_service --lib
```

Evidence: `contracts/fixtures/verification-plan.ok.json`,
`contracts/fixtures/verification-result.ok.json`,
`contracts/fixtures/common-partial.json` and
`runner/src-tauri/tests/verification_adapter.rs`,
`runner/src-tauri/src/existing_tool_probe.rs` and
`runner/src-tauri/tests/existing_tool_probe.rs`.

**Handoff result:** verification preparation and the non-authorizing
tool-identity producer enter the process-local M-O preview assembler. A real
M-J `prepare_verification` output is proven to resolve and start; combined
execution sequences benchmark, structured load admission and fixed quick
checks. M-O exposes opaque typed start/status/stop/result commands. The legacy
raw command implementations remain preserved, but their invoke registrations
are retired. The frontend still calls the old command names and therefore is
not wired to the typed path. Live external-model proof, a pinned real
`llama-cli` fixture, restart recovery and T7 child isolation remain absent.

## M-K — Private local comparison

**Desired independent input example**

```text
user prompt at runtime:
“What’s the weather next week?”

two exact owned configurations
no tools supplied
```

**Observed output:** none. There is no arbitrary-prompt input, two-configuration
scheduler, authentic token stream/trace, comparability admission, blind
presentation, vote use case or local history.

The desired event sequence
`prompt-accepted → A tokens/complete → B tokens/complete →
comparability-admitted → sides-randomized → vote-recorded`
is a requirement, not current output.

**Reproduce:** no command exists.

**Handoff result:** no real pair can feed M-M. This capability is not built.

## M-L — Public pair contribution

**Input/output:** none. Public upload, contribution review, revocation and abuse
boundaries are deliberately deferred.

**Reproduce:** no command exists.

**Handoff result:** no output is authorized for M-M or M-N. This is a deliberate
product deferral, not a failed implementation.

## M-M — Preference rating

**Synthetic core input**

```text
bucket: apple-silicon/16GB
kind: response
pair: qwen versus gemma
votes: A, A, A, B
weights: prompter = 1
```

**Observed core output:** weighted Bradley–Terry strengths reproduce a 3:1
Qwen/Gemma strength ratio. Deterministic bootstrap confidence bands are emitted.

**Adverse inputs and outputs**

```text
no accepted votes
→ status: unavailable
→ reason: no accepted votes for this bucket/kind

effective votes below threshold
→ status: collecting
→ provisional entries must not be displayed as an ordering

experience vote supplied to response pair
→ validation issue; signals are not pooled

one side completed = false
→ pair rejected; DNF is a stability result
```

**Reproduce**

```powershell
node --import tsx --test tests/battles-validation.test.ts tests/battles-rating.test.ts
```

Evidence: `tests/battles-rating.test.ts` and
`tests/battles-validation.test.ts`.

**Why this is only a core:** tests construct pairs and votes directly. The pair
shape does not prove exact prompt bytes, artifact/runtime/settings equality,
output authenticity, trace identity or blind randomization. M-K produces no
real admitted pair. The math is useful; the boundary is insufficient.

## M-N — Public evidence service

**Input/output:** none. No approved API, storage, ingestion or abuse-control
implementation exists.

**Reproduce:** no command exists.

**Handoff result:** intentionally deferred.

## M-O — Application workflow and consent

The topology-neutral non-production subset is executable with synthetic
providers and explicit runner-boundary inputs.

**Synthetic success input**

```text
matching M-A hardware-target + recommendation-request
injected exhaustive candidate-universe provider
approved compatibility-only M-H policy
```

**Observed success output**

```text
M-H unranked-compatible portfolio + exhaustive internal ledger
→ retained frozen finder session
→ exact candidate + exact M-F assessment + same-family quantization alternatives
→ canonical v1 runner handoff
   containsModelData: false
   sideEffectAuthorization: false
   expiresAt-createdAt: exactly 24 hours
→ runner-import-bundle v1
   nested handoff: unchanged
   compatibility receipt: exact M-E admission
   contentHash: covers both nested records
```

**Unavailable input:** the candidate provider returns
`fit.production-profile-unavailable` because U27 has no reviewed production
profile/policy.

**Observed unavailable output:** the same unavailable status, reason,
recoverable action and warning; no universe, ledger, portfolio, detail or
handoff is manufactured.

Blocked/error provider states also remain blocked/error. Hardware/request
identity mismatch prevents the provider call. Non-plain DTOs, an unselected
candidate, copied state and handoff identity drift fail closed.

**U30 context-policy examples**

```text
novice coding + few-files → 16,384 planning tokens
novice other + custom     → unavailable
expert override 12,345    → exactly 12,345
```

The numeric novice targets are versioned implementation heuristics under
review, not measurements or owner-approved claims that a model fits. M-O adds
the remaining explicit task fields and validates the complete M-A request;
M-P supplies no fallback default.

**U29 import examples**

```text
fresh valid bundle                → inspectable, importable
expired valid bundle              → inspectable, confirmation required
expired + confirm-expired-import  → importable, executionAuthorization false
hash/schema/version drift         → blocked
```

Expiry never authorizes execution. Exact calendar validation rejects
impossible instants, and accessor-bearing/cyclic inputs are rejected without
executing properties.

**Permission and inventory examples**

The permission preview reports every action as `not-requested`, requires a
separate explicit action, and grants no authorization. The injected inventory
port preserves `ok`, `partial` and `unavailable`; candidate-by-size,
ambiguous, duplicate, copied or outer/registry-identity-drifted artifacts
cannot become a verified selection.

**Process-local verification preview example**

```text
validated runner-import-bundle
→ import handle; expired bundle requires explicit confirmation

consent-triggered local hardware detection + imported target
→ material-fact evaluation
→ exact acknowledgement when required
→ sealed hardware handle

explicit local inventory scan + exact verified artifact path
→ M-I selection handle

explicit allowlisted llama.cpp path + fixed --version probe
→ sealed tool handle; no backend or authorization claim

prepare preview
→ locally sampled preflight
→ M-J plan bound to hardware/candidate/artifact/runtime/tool
→ grantsExecutionAuthorization: false
```

The assembler rejects tampered bundles, unconfirmed expiry, unknown material
hardware facts, inexact acknowledgement, ambiguous inventory, cross-import
hardware or selection handles, wrong tool kinds and selected-file drift.
Preflight comes from the runner process, not the IPC request; concurrent GPU
activity remains `unknown`, so the preview cannot establish calibration
eligibility. Predictable process-local handles are references, never
credentials.

**Reproduce**

```powershell
npm.cmd run proof:mo
npm.cmd run proof:context-policy
npm.cmd run proof:mo-import
npm.cmd run proof:mo-runner
npm.cmd run proof:mo-verification-preview
cargo test --manifest-path runner/src-tauri/Cargo.toml --test preview_adapter
cargo test --manifest-path runner/src-tauri/Cargo.toml execution_service --lib
node --test tests/runner-boundary.test.mjs
```

Or run `npm.cmd run proof:mo-checkpoint` for the complete authorized subset.

**Handoff result:** missing at the frontend consumer boundary. U28–U37, import semantics,
permission preview,
process-local hardware/tool producers, verified inventory selection, the exact
M-J preview, deterministic combined benchmark/fixed-check execution and typed
opaque run/progress/stop/result transport are present. Frontend wiring,
restart recovery, live external-model proof and every production surface
consumer remain absent; T7 is not claimed.

## M-P — Website, desktop and CLI

### Current website finder

**User input:** platform/memory, optional accelerator/system RAM, task, context
and ranking strategy.

**Observed output:** the legacy recommendation outcomes described under M-H,
rendered as result cards or honest empty states. Exact configuration details can
be expanded.

**Limit:** the surface calls the legacy recommender directly. Its “request
configuration” action writes a browser-local evidence request; it is not a
runner handoff.

**Run**

```powershell
npm.cmd run dev
```

### Current desktop

**User inputs:** pasted versioned runner-import bundle; optional expired-bundle
confirmation; explicit hardware detection and exact-difference acknowledgement;
read-only inventory scan and verified artifact selection; separately selected
`llama-bench.exe` and `llama-cli.exe`; non-authorizing plan preview; three
independent execution acknowledgements; stop or refresh.

**Observed outputs:** the M-P application facade consumes only the typed M-O
preview and execution commands. It preserves import expiry, hardware
differences, inventory `ok`/`partial`/`unavailable`, checked paths and hashes,
the exact benchmark-then-fixed-check plan, runner-owned progress, idempotent
stop, retained partial observations and normalized terminal result/status.
Reason codes remain inspectable rather than being replaced with surface text.

**Limits:** nineteen deterministic tests prove machinery and an unchanged M-O
handoff; they do not prove a native external-model run. The approved handoff
fixture does not itself establish a complete sampler plus live matching
artifact/tool path. Restart recovery, persistence, download, network, upload,
arbitrary prompts and streaming Arena remain absent. Preserved legacy source is
not registered or imported by the M-P entry point.

**Run**

```powershell
Set-Location runner
npm.cmd run tauri dev
```

### CLI

**Observed output:** none. C1–C5 are approved screen-contract descriptions, not
an executable CLI.

**Overall handoff result:** the desktop Core, Boundary and deterministic
Handoff gates now pass for D1–D6; its User gate remains partial without a live
native external-model run. The website still bypasses M-O and the CLI remains
missing, so M-P as a whole is partial and website/desktop/CLI equivalence is not
claimed.

The facade also rejects a completed response unless its full DTO shape,
lifecycle identity, plan IDs, measurement kinds, warmup/measured sample counts,
check IDs and check criteria match the retained plan. Invalid results are never
retained in public state.

## What consuming teams may rely on now

| Producer | Current safe dependency |
|---|---|
| Shared contracts | Validated v1 schemas, DTOs, canonical fixtures and fail-closed version handling |
| Artifact catalog | Promoted immutable identities and explicit blocked lifecycle/freshness results |
| Hardware | Ready/confirmation-required/unavailable target resolution with preserved unknowns |
| Configuration | Complete exact candidate and independently validated admission receipt |
| Evidence | Exact/lossy/unsupported mappings without claim upgrades |
| Inventory | Verified identity only at the adapter/test boundary; not current desktop output |
| Verification | Preparation plus deterministic benchmark-then-fixed-check lifecycle/result proof; no pinned live external-model proof or current desktop workflow |
| Fit | M-F admission and DTO boundaries proven; synthetic M-H consumption proven; admitted real data remains partial |
| Recommendation | Compatibility-only M-H boundary proven with synthetic inputs; real data, M-O and production surfaces remain partial |
| Rating | Synthetic-input statistical core only |
| M-B, M-K | Nothing executable as a production/user handoff |
| M-O | Synthetic finder/detail/handoff plus opaque typed process-local combined run/progress/stop/result and U27 capture preview/consent/receipt; consumed unchanged by the desktop facade, while restart recovery and live proof remain missing |
| Public capabilities | Nothing; intentionally deferred |

The next team must not consume a proposed schema as though it were producer
output. A producer becomes ready only when its executable example and consumer
test use the same object.

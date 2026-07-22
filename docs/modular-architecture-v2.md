# Local Arcade modular architecture v2

Status: design draft. This document defines module contracts before UI or
integration implementation. It does not authorize a milestone or replace the
audited status ledger.

Related source audit: [llmfit-core-adoption-audit.md](llmfit-core-adoption-audit.md)

Interface work is governed by
[evidence-ranking-api-ux.md](evidence-ranking-api-ux.md) and the screen-by-screen
[interface-design-program.md](interface-design-program.md).

## Product boundary

Local Arcade is independently useful and does not expose private downstream
products in its public surface.

> Local Arcade helps a person discover exact local-model configurations,
> understand what may fit, measure what actually happens, compare responses and
> lived generation experience, and improve the public map through explicit
> contribution.

A future vendor-neutral interchange package may send an exact Local Arcade
configuration to any private workflow evaluator. Local Arcade neither names the
recipient nor claims that exported public evidence certifies the private workflow.

## Architectural rule

Every module must declare:

1. versioned input;
2. versioned output;
3. side effects;
4. failure outputs;
5. provenance retained;
6. what it is forbidden to decide;
7. an independent command or contract test.

No UI component calculates fit, invents evidence confidence, performs model
matching, or updates ratings. No provider adapter ranks models. No benchmark
runner declares quality. The orchestrator composes modules but does not
reimplement their logic.

## System topology

```text
                         Shared contracts
                               |
          +--------------------+--------------------+
          |                    |                    |
   llmfit adapter       Artifact registry     Evidence policy
          |                    |                    |
          +----------+---------+----------+---------+
                     |                    |
              Candidate builder    Measurement store
                     |                    |
                     +---------+----------+
                               |
                    Recommendation portfolio
                               |
                  +------------+-------------+
                  |                          |
             Website flow              Desktop flow

   Separate evidence production path:

   execution adapter -> measurement/trace -> pair builder -> blind vote
          -> integrity -> bucket rating -> arena presentation
```

Two implementations may satisfy the same engine port:

- hosted Local Arcade service wrapping pinned `llmfit-core` for the no-install
  website;
- in-process or subprocess pinned `llmfit-core` adapter for the desktop app.

The UI sees only Local Arcade contracts, never upstream Rust structs.

## Common envelope

Every module returns one of:

```json
{
  "schemaVersion": 1,
  "status": "ok",
  "data": {},
  "provenance": [],
  "warnings": []
}
```

```json
{
  "schemaVersion": 1,
  "status": "unavailable",
  "reasonCode": "hardware_not_supported",
  "message": "We do not yet have trustworthy coverage for this device.",
  "recoverableActions": ["confirm-memory-manually", "request-coverage"],
  "provenance": []
}
```

```json
{
  "schemaVersion": 1,
  "status": "blocked",
  "reasonCode": "artifact_hash_mismatch",
  "message": "The selected file does not match its expected identity.",
  "recoverableActions": ["choose-another-file", "redownload-from-source"],
  "provenance": []
}
```

`unavailable` means the system lacks evidence or capability. `blocked` means a
safety or integrity rule prevents the requested action. Neither silently falls
back to guessed success.

## Shared contract C1: provenance

```json
{
  "sourceId": "llmfit-core",
  "sourceVersion": "1.1.6",
  "sourceRevision": "7ba90ce0f14756040db658933bfd5c6ad46ed4ea",
  "method": "estimated",
  "retrievedAt": "2026-07-21T20:00:00Z",
  "scope": {
    "hardwareFingerprint": "hw_...",
    "artifactSha256": null,
    "runtimeBuild": null,
    "taskFamily": null
  },
  "sourceUrl": "https://github.com/AlexsJones/llmfit"
}
```

Allowed evidence methods:

- `estimated`
- `community-measured`
- `locally-measured`
- `objective-check`
- `response-preference`
- `experience-preference`
- `self-reported`
- `detected`

`detected` is not the same as verified. A claim becomes verified only under a
metric-specific Local Arcade rule.

## Shared contract C2: hardware target

Website manual selection and desktop detection produce the same object.

```json
{
  "schemaVersion": 1,
  "hardwareTargetId": "hw_01J...",
  "source": "detected",
  "cpu": {
    "name": "AMD Ryzen 7 5800H",
    "logicalCores": 16
  },
  "memory": {
    "totalRamBytes": 34359738368,
    "availableRamBytes": 23622320128,
    "unified": false
  },
  "accelerators": [
    {
      "stableId": "pci:10de:2520",
      "displayName": "NVIDIA GeForce RTX 3060 Laptop GPU",
      "backend": "cuda",
      "deviceMemoryBytes": 6442450944,
      "usableMemoryBytes": 6012954214,
      "count": 1
    }
  ],
  "os": {
    "family": "windows",
    "version": "11"
  },
  "detection": {
    "adapter": "llmfit-core",
    "adapterVersion": "1.1.6",
    "confidence": "detected-unconfirmed",
    "userConfirmed": false
  }
}
```

Manual website input uses `source: "self-reported"`; unavailable fields remain
`null`. The system never inserts a device-memory value merely from the word
"NVIDIA" or "Apple."

## Shared contract C3: model family and exact artifact

These are deliberately separate.

Broad discovery record:

```json
{
  "schemaVersion": 1,
  "modelFamilyId": "qwen3-4b-instruct-2507",
  "displayName": "Qwen3 4B Instruct 2507",
  "upstreamModelId": "Qwen/Qwen3-4B-Instruct-2507",
  "parameterCount": 4000000000,
  "nativeContextTokens": 262144,
  "capabilities": ["text", "tool-use"],
  "license": "apache-2.0",
  "discoverySource": "llmfit-core"
}
```

Runnable artifact identity:

```json
{
  "schemaVersion": 1,
  "artifactId": "artifact_01J...",
  "modelFamilyId": "qwen3-4b-instruct-2507",
  "repository": "unsloth/Qwen3-4B-Instruct-2507-GGUF",
  "revision": "immutable-git-revision",
  "filename": "Qwen3-4B-Instruct-2507-Q4_K_M.gguf",
  "sha256": "...",
  "bytes": 2684354560,
  "format": "gguf",
  "quantization": "Q4_K_M",
  "license": "apache-2.0",
  "chatTemplateId": "template_...",
  "status": "promoted",
  "fieldProvenance": {}
}
```

An llmfit model-family recommendation cannot be downloaded, measured, or
called an exact configuration until Local Arcade resolves it to an admitted
artifact.

## Shared contract C4: runtime configuration

```json
{
  "schemaVersion": 1,
  "runtimeConfigurationId": "runtimecfg_01J...",
  "product": "llama-swap",
  "engine": "llama.cpp",
  "engineBuild": "b10061",
  "backend": "cuda",
  "artifactSha256": "...",
  "contextTokens": 8192,
  "kvCache": { "key": "f16", "value": "f16" },
  "gpuLayers": "all",
  "batchSize": 512,
  "parallelism": 1,
  "sampling": {
    "temperature": 0.2,
    "topP": 0.95,
    "seed": 42
  },
  "extraFlags": [],
  "configurationSource": "imported-llama-swap"
}
```

Unknown values remain `null` and reduce the evidence scope. They are not
filled with likely defaults.

## Shared contract C5: recommendation request

The novice UI compiles plain-language choices into this contract.

```json
{
  "schemaVersion": 1,
  "requestId": "rec_01J...",
  "hardwareTargetId": "hw_01J...",
  "task": {
    "family": "coding",
    "interactionStyle": "interactive",
    "needs": ["tool-use"],
    "desiredContext": "project-files",
    "derivedContextTokens": 16384
  },
  "preference": {
    "priority": "balanced",
    "patience": "normal",
    "allowCpuOffload": false,
    "installedOnly": false
  },
  "advanced": {
    "forcedRuntime": null,
    "maximumDownloadBytes": null,
    "licenseAllowlist": []
  }
}
```

The raw UI labels and derivation rule are preserved, so a user can see why
"project files" became 16K rather than being asked to choose 16K initially.

## Shared contract C6: fit assessment

```json
{
  "schemaVersion": 1,
  "artifactId": "artifact_01J...",
  "runtimeConfigurationId": "runtimecfg_01J...",
  "hardwareTargetId": "hw_01J...",
  "fit": "good",
  "runPath": "gpu",
  "memory": {
    "requiredBytes": 5153960755,
    "availableBytes": 6012954214,
    "utilization": 0.857,
    "breakdown": {
      "weightsBytes": 2684354560,
      "kvCacheBytes": 1610612736,
      "runtimeBytes": 536870912,
      "reserveBytes": 322122547
    }
  },
  "context": {
    "requestedTokens": 16384,
    "usableTokens": 16384,
    "nativeTokens": 262144
  },
  "estimatedPerformance": {
    "generationTokensPerSecond": { "low": 35, "high": 55 },
    "method": "llmfit-bandwidth-model",
    "assumptions": {
      "efficiency": 0.55,
      "memoryBandwidthGBps": 336
    }
  },
  "blockingReasons": [],
  "provenance": []
}
```

Even if upstream supplies one TPS number, the Local Arcade adapter may widen it
to a range according to evidence policy.

## Shared contract C7: recommendation portfolio

```json
{
  "schemaVersion": 1,
  "requestId": "rec_01J...",
  "outcome": "ranked",
  "message": "Five distinct model families fit your confirmed limits.",
  "items": [
    {
      "role": "primary-match",
      "modelFamilyId": "qwen3-4b-instruct-2507",
      "artifactId": "artifact_01J...",
      "runtimeConfigurationId": "runtimecfg_01J...",
      "fitAssessmentId": "fit_01J...",
      "why": [
        "fits entirely in GPU memory at the selected context",
        "supports tool use",
        "has a matched local measurement"
      ],
      "caveats": [
        "response quality has not been established for your prompts"
      ],
      "evidenceSummary": {
        "fit": "locally-measured",
        "speed": "locally-measured",
        "taskQuality": "unknown",
        "responsePreference": "unknown",
        "experiencePreference": "unknown"
      }
    }
  ],
  "methodologyVersion": "portfolio-policy-v1",
  "provenance": []
}
```

`outcome` is one of:

- `ranked`
- `unranked-compatible`
- `contradictory-preferences`
- `nothing-fits`
- `coverage-gap`

A portfolio contains at most five distinct families. Variants nest within a
family. Ranking is allowed only when the requested metric has supporting
evidence.

## Shared contract C8: measurement run

```json
{
  "schemaVersion": 1,
  "measurementRunId": "run_01J...",
  "hardwareTargetId": "hw_01J...",
  "artifactId": "artifact_01J...",
  "runtimeConfigurationId": "runtimecfg_01J...",
  "protocol": {
    "id": "localarcade-interactive-v1",
    "revision": "...",
    "warmupRuns": 1,
    "measuredRuns": 3
  },
  "preflight": {
    "power": "ac",
    "thermal": "unknown",
    "gpuBusy": "false",
    "conditions": ["thermal-telemetry-unavailable"]
  },
  "samples": [
    {
      "ttftMs": 420,
      "generationTokensPerSecond": 48.2,
      "promptTokensPerSecond": 703.1,
      "peakDeviceMemoryBytes": 5583457484,
      "completed": true,
      "tokenTraceRef": "blob_..."
    }
  ],
  "stability": {
    "completedRuns": 3,
    "failedRuns": 0,
    "userAbortedRuns": 0
  },
  "quickChecks": [
    {
      "criterion": "json-schema",
      "status": "pass",
      "verifierVersion": "..."
    }
  ],
  "evidenceClass": "locally-measured",
  "calibrationEligible": false,
  "calibrationExclusions": ["thermal-state-unknown"],
  "provenance": []
}
```

llmfit `BenchResult` may be retained as a raw source record inside this
envelope, but it does not satisfy the complete contract on its own.

## Shared contract C9: battle pair

```json
{
  "schemaVersion": 1,
  "battlePairId": "pair_01J...",
  "battleKind": "response",
  "taskFamily": "writing",
  "promptRef": "blob_...",
  "left": {
    "attemptId": "attempt_...",
    "artifactId": "artifact_...",
    "runtimeConfigurationId": "runtimecfg_...",
    "hardwareBucketId": "bucket_...",
    "outputRef": "blob_...",
    "tokenTraceRef": null
  },
  "right": {
    "attemptId": "attempt_...",
    "artifactId": "artifact_...",
    "runtimeConfigurationId": "runtimecfg_...",
    "hardwareBucketId": "bucket_...",
    "outputRef": "blob_...",
    "tokenTraceRef": null
  },
  "blind": true,
  "publishState": "eligible",
  "integrity": {
    "artifactHashesVerified": true,
    "configurationComparable": true,
    "bothCompleted": true
  }
}
```

For `battleKind: "experience"`, both traces are required and hardware buckets
must match under the experience policy. For response battles, latency is not
shown and hardware may pool only when inference identity is comparable.

## Shared contract C10: vote

```json
{
  "schemaVersion": 1,
  "voteId": "vote_01J...",
  "battlePairId": "pair_01J...",
  "choice": "left",
  "allowedChoices": ["left", "right", "tie", "both-bad", "skip"],
  "voterClass": "third-party",
  "presentedAt": "2026-07-21T20:00:00Z",
  "committedAt": "2026-07-21T20:00:14Z",
  "integritySignals": {
    "minimumDwellMet": true,
    "rateLimitPassed": true,
    "canaryStatus": "not-a-canary"
  },
  "ratingEligibility": "pending-integrity"
}
```

Identity reveal occurs only after the vote commits. A skip has no winner.

## Shared contract C11: rating snapshot

```json
{
  "schemaVersion": 1,
  "ratingSnapshotId": "ratings_01J...",
  "battleKind": "response",
  "taskFamily": "writing",
  "hardwareBucketId": null,
  "method": "bradley-terry",
  "methodVersion": "bt-v1",
  "entries": [
    {
      "configurationGroupId": "configgroup_...",
      "rating": 0.42,
      "confidence": { "low": 0.31, "high": 0.54 },
      "eligibleVotes": 143,
      "dnfCount": 3,
      "displayState": "live"
    }
  ],
  "minimumVoteThreshold": 50,
  "provenance": []
}
```

Response and experience ratings are never averaged together in storage.

## Shared contract C12: contribution preview and receipt

Preview:

```json
{
  "schemaVersion": 1,
  "contributionId": "contrib_01J...",
  "payloadTypes": ["measurement", "response-pair"],
  "included": {
    "hardwareBucket": true,
    "exactArtifactIdentity": true,
    "runtimeConfiguration": true,
    "performanceSamples": true,
    "promptText": false,
    "outputText": true,
    "tokenTrace": false
  },
  "estimatedBytes": 19240,
  "destination": "localarcade-public",
  "expiresAt": "2026-07-21T20:15:00Z"
}
```

Receipt:

```json
{
  "schemaVersion": 1,
  "contributionId": "contrib_01J...",
  "consentVersion": "contribution-consent-v1",
  "previewHash": "sha256:...",
  "submittedAt": "2026-07-21T20:03:00Z",
  "serverReceiptId": "receipt_...",
  "revocationSupported": true
}
```

No contribution happens merely because a benchmark ran.

# Modules

## M-A: Contract package

**Input:** reviewed JSON Schema/TypeScript/Rust definitions.

**Internal work:** schema validation, canonical IDs, enum exhaustiveness,
forward-compatible parsing, fixture generation.

**Output:** versioned contracts C1-C12 plus golden fixtures.

**Side effects:** none.

**Forbidden:** product decisions, hardware probing, ranking, persistence.

**Independent proof:** validate every valid fixture and reject every invalid
fixture without importing application code.

## M-B: llmfit upstream adapter

**Input:** pinned upstream revision, Local Arcade hardware target, model query,
context, optional runtime constraint.

**Internal work:** translate Local Arcade input to `SystemSpecs`/llmfit query;
invoke crate, subprocess, or hosted engine; preserve raw output; normalize
upstream enums and estimates; attach source provenance; apply no Local Arcade
ranking.

**Output:** model-family candidates and attributed raw fit assessments.

**Side effects:** depends on implementation. Native detection may read OS and
provider state; hosted recommendation performs a network request.

**Failure outputs:** upstream unavailable, schema mismatch, unsupported
hardware, timeout, invalid override.

**Forbidden:** exact artifact admission, evidence-class upgrade, downloads,
quality certification.

**Independent proof:** replay pinned upstream fixtures without the website or
desktop app.

## M-C: Exact artifact registry

**Input:** discovered model/repository candidates, trusted-publisher policy,
Hugging Face metadata.

**Internal work:** pin revision; enumerate files; verify filename/size/hash,
license, model family, format, quantization, context/chat-template sources;
quarantine invalid records; preserve last valid snapshot.

**Output:** model families, admitted artifacts, quarantines, freshness state.

**Side effects:** explicit registry refresh performs network reads and atomic
snapshot writes.

**Failure outputs:** missing license/hash, unsupported split package, stale
registry, untrusted publisher, partial refresh.

**Forbidden:** hardware fit, ranking, downloading to a user, model execution.

## M-D: Hardware resolver

**Input:** website manual form or consented desktop detection.

**Internal work:** normalize device identity; reconcile memory variants;
preserve detected versus claimed values; request confirmation where ambiguous;
build hardware fingerprint and evidence scope.

**Output:** C2 `HardwareTarget`.

**Side effects:** desktop reads hardware only after consent; website has none.

**Failure outputs:** unknown device, conflicting memory, partial detection.

**Forbidden:** recommending models or inferring unspecified VRAM.

## M-E: Candidate builder

**Input:** llmfit model-family candidates, admitted artifact registry, runtime
compatibility records, user constraints.

**Internal work:** resolve broad model families to exact artifacts; enumerate
compatible runtime configurations; exclude unpromoted/stale/incompatible
records; retain unresolved gaps.

**Output:** exact candidate configurations or a coverage-gap record.

**Side effects:** none.

**Forbidden:** fit calculation, ranking, downloads.

## M-F: Fit and performance evaluator

**Input:** C2 hardware, C3 artifact, C4 runtime configuration, desired context,
llmfit advisory result, matched measurements.

**Internal work:** calculate/check memory fit; choose evidence scope; attach
estimated range; prefer exact matched measurements without deleting estimates;
return safety blockers separately from recommendation signals.

**Output:** C6 fit assessment.

**Side effects:** none.

**Forbidden:** response-quality claims, preference rank, user-facing role
assignment.

## M-G: Evidence policy

**Input:** metric, source record, hardware/artifact/runtime/task identities.

**Internal work:** validate required identity fields; decide pooling scope;
classify estimated/community/local/objective/preference evidence; reject
incomparable combinations; calculate display eligibility.

**Output:** typed evidence claim or rejection with reason.

**Side effects:** none.

**Forbidden:** generating measurements or votes, ranking directly.

## M-H: Recommendation portfolio

**Input:** user request, exact candidates, fit assessments, evidence claims.

**Internal work:** apply hard compatibility filters; separate safety blockers;
deduplicate model families; detect contradictory preferences; determine whether
ordering is supported; select at most five distinct roles; explain every item.

**Output:** C7 portfolio.

**Side effects:** none.

**Forbidden:** downloading, executing, claiming universal best, padding a list
with unsupported candidates.

## M-I: Runtime inventory

**Input:** explicit consent and provider adapter set.

**Internal work:** detect products; scan/list model stores; normalize provider
names; optionally hash a selected file after separate action; deduplicate exact
artifacts; report unreadable files individually.

**Output:** installed runtime and artifact inventory.

**Side effects:** read-only filesystem and localhost-provider access.

**Forbidden:** executing discovered files, uploading inventory, deleting.

## M-J: Benchmark and trace runner

**Input:** explicit run consent, exact C2/C3/C4 identities, protocol, resource
limits.

**Internal work:** preflight; warm-up; execute pinned tasks; capture streaming
token timestamps, provider timings, memory, conditions, completion/failure;
repeat; calculate stability; retain raw receipts; determine calibration
eligibility separately.

**Output:** C8 measurement run.

**Side effects:** model execution and local result writes; never upload.

**Failure outputs:** OOM, crash, timeout, user abort, adverse conditions,
identity drift, runtime unavailable.

**Forbidden:** general quality claim, automatic contribution, hiding DNF.

## M-K: Solo arena

**Input:** two exact installed configurations, user prompt, execution limits.

**Internal work:** randomize presentation sides; execute sequentially by
default; store attempts and traces locally; show blind pair; commit vote before
identity reveal.

**Output:** private C9 pair and C10 vote.

**Side effects:** local execution and local storage.

**Forbidden:** public upload without a separate contribution preview; parallel
loading by default on constrained hardware.

## M-L: Public pair intake

**Input:** explicitly contributed measurement/pair packages.

**Internal work:** validate consent receipt, hashes, comparable configuration,
hardware bucket, task bounds, duplicate/canary checks, and content policy;
quarantine suspicious input; convert eligible packages to anonymous pairs.

**Output:** eligible/quarantined/rejected C9 pair.

**Side effects:** server persistence.

**Forbidden:** accepting unknown artifacts as verified, publishing private
prompts, treating a one-sided DNF as a battle.

## M-M: Arena voting and ratings

**Input:** eligible blind pair, committed vote, integrity signals.

**Internal work:** preserve response/experience separation; validate vote;
exclude failed integrity; update bucket-scoped Bradley-Terry model; calculate
confidence; enforce minimum display threshold; track DNF separately.

**Output:** C10 vote status and C11 rating snapshot.

**Side effects:** vote and rating persistence.

**Forbidden:** blending response with experience, global score, rating before
threshold, changing a committed vote after reveal.

## M-N: Contribution client

**Input:** locally selected measurements/pairs and contribution choices.

**Internal work:** construct exact payload; redact excluded fields; show preview;
hash preview; record consent; upload; persist receipt; support revoke/stop.

**Output:** C12 preview and receipt.

**Side effects:** network upload only after confirmation.

**Forbidden:** background upload, bundled consent, raw prompt inclusion unless
separately selected.

## M-O: Orchestrator

**Input:** a user intent such as `find`, `benchmark`, `solo-battle`,
`crowd-vote`, or `contribute`.

**Internal work:** call modules in the documented order, carry IDs/provenance,
stop on blocked/unavailable results, and emit state transitions.

**Output:** one UI-facing state contract.

**Side effects:** none directly; side effects occur only through explicit
ports called for authorized user actions.

**Forbidden:** duplicating module decisions, converting an error to a default,
or crossing website/desktop consent boundaries.

## M-P: Presentation adapters

**Input:** orchestrator state only.

**Internal work:** translate contracts into accessible website/desktop/arena
views; progressively disclose technical detail; preserve evidence labels;
emit typed user intents.

**Output:** rendered UI and user-intent events.

**Side effects:** none beyond ordinary local view state.

**Forbidden:** domain calculations or direct calls to llmfit/provider APIs.

# Deterministic flows

## Website finder

```text
1. UI emits manual-hardware intent
2. Hardware resolver -> HardwareTarget
3. UI emits task/preference intent
4. Orchestrator -> RecommendationRequest
5. llmfit adapter -> broad advisory candidates
6. Artifact registry + candidate builder -> exact candidates
7. Fit evaluator -> one FitAssessment per candidate
8. Evidence policy -> typed claims/rejections
9. Portfolio -> ranked/unranked/gap outcome
10. UI renders result and caveats
11. No download, execution, detection, or upload has occurred
```

## Desktop first run

```text
1. UI asks separately for hardware-detection and model-scan consent
2. Hardware resolver -> HardwareTarget or manual mode
3. Runtime inventory -> installed artifacts and unresolved files
4. Same recommendation steps 4-9 as website
5. UI prioritizes zero-download candidates already installed
6. User may explicitly choose benchmark
7. Benchmark runner -> MeasurementRun
8. Evidence policy reclassifies only supported metrics
9. Portfolio refreshes; only this run becomes locally measured
```

## Solo arena

```text
1. User selects two installed exact configurations
2. Solo arena verifies both executable and schedules sequentially
3. Attempt A and B run with identities hidden from presentation
4. Pair is shown; response or experience question is explicit
5. User chooses left/right/tie/both-bad/skip
6. Vote commits
7. Identities reveal
8. Private rating/history updates
9. Nothing uploads
```

## Crowd response arena

```text
1. Public pair intake produces eligible response pair
2. UI hides model identity and latency
3. User commits vote
4. Integrity evaluates vote
5. Rating engine updates only response/task bucket
6. Identity reveals
7. UI shows collecting state or confidence interval
```

## Crowd experience arena

```text
1. Intake requires two completed traces from matched hardware bucket
2. UI replays authentic token cadence
3. User commits experience vote
4. Rating engine updates only experience/hardware/task bucket
5. No response-quality score changes
```

## Contribution

```text
1. User selects specific local records
2. Client constructs preview with field-level inclusion
3. User confirms exact preview
4. Consent receipt binds preview hash and consent version
5. Upload occurs
6. Server validates or quarantines
7. Client stores server receipt and revocation capability
```

# Worktree plan after contracts are approved

Worktree count is not the success metric. Each worktree must own non-overlapping
files, run independently, and consume frozen fixtures.

| Worktree | Owns | Standalone result |
|---|---|---|
| `contracts-v1` | M-A schemas and fixtures | Contract validator |
| `llmfit-adapter` | M-B only | Fixture-to-advisory CLI/test |
| `artifact-registry` | M-C only | Deterministic registry snapshot |
| `hardware-resolver` | M-D only | Manual/detected fixture normalizer |
| `candidate-fit` | M-E/M-F | Candidate-to-fit fixture runner |
| `evidence-portfolio` | M-G/M-H | Request-to-portfolio pure runner |
| `runtime-measurement` | M-I/M-J | Inventory/benchmark local harness |
| `arena-core` | M-L/M-M | Pair/vote/rating test harness |
| `contribution-client` | M-N | Preview/receipt offline harness |
| `website-prototype` | website M-P | Static-fixture finder journey |
| `desktop-prototype` | desktop M-P | Static-fixture first-run journey |
| `solo-arena-prototype` | solo M-P | Static-fixture blind flow |
| `crowd-arena-prototype` | crowd M-P | Static-fixture response/experience flows |
| `integration-shell` | M-O and ports | End-to-end orchestration |

Only `contracts-v1` starts before contract approval. The four UI prototypes may
run in parallel after they share the same fixtures. Backend worktrees do not
edit UI files. The integration worktree begins only after at least one producer
and consumer pass the same contract fixtures.

# Design gates still requiring product-owner approval

1. Hosted llmfit-core adapter for the website versus a future pure/WASM engine.
   Recommendation: hosted versioned adapter first; do not duplicate formulas.
2. First public release surface: finder only, finder plus desktop benchmark, or
   finder plus a seeded crowd arena.
3. Whether Local Arcade imports localmaxxing data and under what license/trust
   classification.
4. Which exact public contribution payloads are accepted at launch.
5. Whether model download is absent from the first desktop release or exposed
   only after the existing threat-model gates are revalidated against llmfit.
6. Which task families seed the response arena.
7. Minimum vote thresholds and voter weighting; these remain policy data, not
   hard-coded product truth.

Until these gates and the user-facing flow documentation are approved, the
existing product should not be refactored around llmfit.

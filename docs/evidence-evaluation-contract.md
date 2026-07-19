# LocalArcade evidence and evaluation contract

Status: M-1 product contract. Settle this document before catalog, ranking,
benchmark-runner, or battle implementation proceeds.

## 1. What LocalArcade ranks

LocalArcade ranks runnable configurations for a stated use case. A configuration
is an immutable artifact plus runtime, prompt template, generation settings,
context policy, and cache/offload settings. A model-family name by itself is not
a rankable object.

The product keeps four questions separate:

1. Will this configuration fit?
2. What performance and reliability has it shown on comparable hardware?
3. How well does it complete this kind of task?
4. Which output or complete interaction do people prefer?

No single observation answers all four questions.

## 2. Evidence has orthogonal dimensions

Every user-visible value records these dimensions independently:

| Dimension | Values |
|---|---|
| Metric | fit, prompt throughput, generation throughput, TTFT, stability, energy, task success, response preference, experience preference |
| Method | estimate, measurement, preference |
| Source | catalog, lab, community, personal |
| Hardware match | exact, calibrated neighbor, coarse bucket, not applicable |
| Configuration match | exact, compatible, family proxy |
| Uncertainty | interval, sample count, and confidence level when available |
| Identity | artifact hash, runtime build, settings fingerprint, timestamp, and provenance links |

User-facing badges are derived claims, not stored truth:

- `estimated`: a model or prior produced a range.
- `measured`: LocalArcade's controlled lab produced the observation.
- `community`: contributor devices produced the observation.
- `verified`: a measurement exactly matches this machine and configuration.
- `preference`: a blind comparison produced the observation.

This prevents a label such as `community` from concealing a coarse hardware
match or a family-level proxy.

## 3. Pooling and hardware conditioning

Response quality is attached to configuration + task, not GPU model. When the
artifact, template, sampler, and relevant settings match, response-preference
and mechanically scored task evidence may pool across hardware.

Fit, latency, throughput, stability, energy, and experience preference are
hardware-conditioned. They may use hierarchical matching:

exact machine and configuration -> same GPU/backend -> calibrated performance
neighbor -> coarse hardware bucket -> estimate only.

Experience-preference votes never leak into the response-quality score. A fast
configuration can win `balanced` or `preferred experience` without being called
more intelligent.

## 4. Ranking and uncertainty

- Filter impossible configurations before scoring.
- Use partial pooling across related tasks/configurations instead of isolated
  Elo tables for every sparse bucket.
- Show confidence intervals and rank groups. Overlapping candidates are shown
  as tied/within noise.
- A top-five result uses distinct model families and distinct roles. Variants
  remain nested in the family card.
- If evidence supports compatibility but not comparative ordering, show an
  unranked shortlist.
- Published strategies name their metric weights and never silently relax a
  hard constraint.

## 5. Benchmark packs: users can bring their own evaluation

A benchmark pack is a versioned, inspectable collection of tasks and scoring
rules. It can contain:

- mechanically checked tasks: schemas, unit tests, exact constraints, fact
  preservation, or tool outcomes;
- blind human-preference tasks with an explicit rubric;
- repeated creative tasks where diversity, voice, or style is the target;
- workload parameters such as context depth, concurrency, temperature profile,
  trial count, and maximum output length.

One-shot accuracy is only one metric. Packs may measure long-session behavior,
instruction retention, recovery from errors, latency at context depth,
reliability across repetitions, and operator interventions.

### Execution choices

Users never need to download every model.

1. **Installed-only:** run the pack against configurations already present.
   This is the default for experienced users and requires no download.
2. **Try one candidate:** download only one explicitly selected artifact after
   showing source, hash, license, exact bytes, temporary storage, and consent.
3. **Community queue:** a shareable, synthetic pack may be dispatched
   asynchronously to opted-in contributor devices. Private prompts are
   ineligible. Results return later; voting can happen immediately once pairs
   exist.
4. **Private fleet/BYOF:** an organization runs the pack on devices it controls.
   LocalArcade orchestrates and aggregates without sending private work to the
   public fleet.

Pack results are private by default. Sharing a pack, prompts, outputs, or result
summary are four separate consent decisions.

## 6. Human experiences

### First-time local-model user

1. Describe a machine and choose a plain-language goal such as private chat,
   writing, coding help, or document extraction.
2. Receive a role-labeled shortlist with fit explanations and honest evidence
   gaps, not a wall of runtime terminology.
3. Choose one recommended experience. Only then see the exact artifact,
   quantization, runtime, size, and expected tradeoffs.
4. In the future desktop app, detect the real machine and offer one explicit
   download. The initial benchmark is part of setup, not extra homework.
5. Open a playground immediately. After useful interaction, optionally rate
   the experience or compare a second candidate.

The novice is never asked to design a benchmark pack before receiving value.

### Practical local-model user

1. Scan existing GGUF, Ollama, and LM Studio inventories with consent.
2. Hash-dedupe artifacts and preserve each runtime/configuration identity.
3. Run a zero-download baseline on the models already owned.
4. Show measured personal results, configuration problems, and one-variable
   tuning suggestions (context, cache, offload, batch, or sampler).
5. Offer a private blind comparison using the user's real prompts. Personal
   preferences remain local unless separately shared.
6. Suggest downloading a missing candidate only when evidence predicts a
   meaningful improvement over what the user already owns.

### Evaluator or workflow owner

1. Start from a built-in task pack or clone one as a readable manifest.
2. Add real tasks, rubrics, repetitions, and generation profiles. Coding,
   creative writing, extraction, and long-context workflows remain separate.
3. Choose installed-only, one candidate, public synthetic queue, or private
   fleet execution.
4. Inspect per-task failures and intervention counts before any aggregate.
5. Save a personal leaderboard tied to the exact pack version. Optionally
   publish the pack or anonymized results through separate previews/consents.

### Creative practitioner

Creative evaluation is not forced into deterministic exact-answer tests. The
user selects a temperature/profile, generates repeated blinded samples, and
votes against a stated rubric such as voice, novelty, constraint adherence, or
editability. Rankings are profile-specific; a low-temperature coding result
cannot stand in for a high-temperature creative-writing experience.

### Fleet or enterprise operator

The operator imports a workload pack, selects target SKUs and concurrency,
runs it on a private fleet or vetted matching devices, and receives pass rates,
latency distributions, stability/DNF rates, energy when measurable, and
escalation/intervention counts. Private payloads never enter the volunteer
fleet.

## 7. Modularity boundary

The core consumes interfaces rather than named providers:

- artifact registry adapter
- hardware detector adapter
- benchmark executor
- observation store
- scorer per metric
- ranking strategy
- pair scheduler
- rating estimator

Provider-specific code stays at the edges. llama.cpp is the canonical initial
executor, but evidence records include runtime identity so another executor can
be added without rewriting ranking logic.

## 8. Safety gates

M-1 may define schemas, pure policy, documentation, and tests only. It may not
download, execute, scan, upload, schedule contributor jobs, or publish battle
data. Those capabilities remain blocked behind explicit consent design and the
runner threat-model milestone.

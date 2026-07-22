# Ranking and audition research plan

Status: **Product-owner-approved non-production research checkpoint**,
2026-07-22. It does not approve a ranking algorithm, change current
recommendations, ingest external data, or authorize M-H/M-O implementation.

## Decision question

Local Arcade has not yet demonstrated a material recommendation improvement
over llmfit. The useful hypothesis is narrower than “better ranking”:

> Given the same owned hardware and task, can Local Arcade reach an exact,
> runnable, evidence-supported configuration that the user later verifies or
> prefers with fewer failed runs and fewer unnecessary comparisons than llmfit
> alone?

If the answer is no, Local Arcade should adopt more of llmfit and concentrate
on exact identity, verification, evidence applicability and private auditioning
instead of maintaining a novel ranking layer.

## Why this checkpoint is required

Current llmfit is already a strong baseline. Its primary repository describes
hardware detection; fit, speed, quality and context scoring; dynamic
quantization; multi-GPU and MoE support; several runtimes; JSON recommendations;
and locally saved/community-shared benchmarks. Its estimates expose their
inputs and can be replaced by measurements on matching hardware
([llmfit repository](https://github.com/AlexsJones/llmfit)).

Anubis is a separate Apple Silicon baseline. It captures output/prefill speed,
TTFT, memory, power, thermals and hardware utilization across OpenAI-compatible
local backends, and its leaderboard preserves chip, model, quantization and
format dimensions ([Anubis repository](https://github.com/uncSoft/anubis-oss)).
Its live analysis now supports repeated-run groups with mean and 95% bootstrap
confidence intervals ([Anubis benchmark analysis](https://uncsoft.github.io/anubis-oss/analysis.html)).

These systems make Local Arcade's superiority a hypothesis to test, not a
premise to encode in a hand-tuned score.

## Research boundaries

Included:

- audit current llmfit candidate generation, constraints, fit calculations,
  score components, sorting, recommendation output and benchmark evidence;
- build a frozen scenario and expected-consideration corpus;
- compare non-production ranking/portfolio baselines over identical inputs;
- use external Apple observations to test fit/performance calibration and
  candidate recall where exact-enough matching is possible;
- report disagreements and the evidence needed to resolve them.

Excluded:

- changing production recommendation behavior;
- training from production clicks, downloads or votes;
- claiming community consensus is ground truth;
- copying Anubis GPL-3.0 implementation;
- ingesting or redistributing an external dataset until its license and terms
  are explicitly approved;
- public Arena, contribution, upload or evidence-service work;
- M-O audition orchestration or M-P surface implementation.

## Two evaluation corpora

### 1. Consensus sanity corpus

This asks whether the systems understand what informed users commonly
consider. Consensus is a dated, sourced prior and may be wrong.

Start with these hardware/task shapes:

- 6 GB NVIDIA laptop GPU, interactive coding;
- 8 GB discrete GPU, general assistant;
- 12 GB discrete GPU, coding with project context;
- 16 GB Apple unified memory, writing and summarization;
- 32 GB Apple unified memory, long-context document work;
- CPU-only laptop, occasional extraction;
- 24 GB workstation GPU, quality-oriented coding;
- unknown accelerator with manually confirmed memory.

For each scenario preserve hardware memory, task, derived context, latency
preference, runtime constraints, candidate source, publication/retrieval date,
and points of disagreement. “Must consider” means the system must either retain
the candidate or emit a machine-readable exclusion reason; it does not mean the
candidate must rank first.

### 2. Measured audition corpus

This asks whether consensus transfers to an exact configuration and whether a
non-consensus candidate is measurably better. Records require, where available:

- hardware/chip and memory;
- immutable model/artifact identity;
- quantization and format;
- runtime/backend/build and relevant settings;
- context and prompt/decode conditions;
- load success, memory, prompt speed, decode speed, TTFT and stability;
- repeated samples or an explicit single-run limitation;
- provenance and redistribution status.

Anubis is an external Apple validation source, not recommendation truth. A
successful submission proves that a scoped configuration ran; it does not by
itself prove response quality or that the configuration is best.

## Compared systems and baselines

Every system receives equivalent representable inputs. Unsupported inputs are
recorded rather than silently approximated.

1. pinned llmfit recommendation/fit output;
2. preserved current Local Arcade behavior;
3. hard constraints plus evidence-applicability filtering;
4. non-dominated/Pareto candidate filtering;
5. diversity-aware top-k selection over the surviving candidates;
6. uncertainty-guided selection of the next verification or comparison.

Do not begin with a learned ranker. There is no representative labeled corpus
yet. Maximal Marginal Relevance is a useful interpretable diversity baseline
([Goldstein and Carbonell, 1998](https://aclanthology.org/X98-1025/)); active
model selection provides a useful formal analogy for choosing the next bounded
probe under uncertainty ([Madani, Lizotte and Greiner, 2012](https://arxiv.org/abs/1207.4138)).
Neither paper is evidence that its method will win this product evaluation.

## Metrics

Report all metrics; do not collapse them into one unpublished weighted score.

- runnable precision;
- consensus recall at five and consensus candidate rank;
- exact-configuration completeness;
- supported-claim precision;
- family/configuration diversity;
- coverage-gap and no-fit honesty;
- measured fit/performance interval calibration;
- novel-success rate;
- justified-disagreement rate;
- regret against the measured or personally preferred result;
- failed downloads/runs/comparisons avoided;
- number, time and declared cost of tests needed to reach the verified choice;
- stability under small input/evidence changes;
- expert reproducibility of every inclusion, exclusion and ordering decision.

Every disagreement is classified as consensus right, system right, both
plausible under different scopes, insufficient evidence, or mechanical/catalog
mismatch.

## Proposed parallel execution

After M-A has an owner-reviewed commit, this research can fan out from that
single baseline:

| Lane | Worktree responsibility | Must not change |
|---|---|---|
| upstream-baseline | Re-audit pinned/current llmfit behavior and capture normalized outputs | production adapters or ranking |
| ranking-methods | Implement non-production constraint, Pareto and diversity baselines | M-H and production policies |
| consensus-corpus | Source and freeze consensus scenarios with dates and disagreement rules | registry promotion or product claims |
| apple-validation | Audit Anubis schema/terms and build reference-only matched Apple comparisons | copy GPL code or ingest unlicensed data |
| integration owner | Own corpus schema, evaluation harness, cross-lane review and final report | invent missing evidence or merge semantic drift |

With four active agent slots, the integration owner plus three lanes run at
once; the fourth research lane starts when a slot completes. No lane edits M-A
contracts without a visible checkpoint amendment.

## Deliverables and acceptance

- version-pinned upstream audit refresh;
- frozen scenario/candidate/observation corpus with source and license metadata;
- reproducible non-production comparison harness;
- llmfit, current Local Arcade, constraint, Pareto and diversity baseline results;
- separate consensus and measured-audition scorecards;
- disagreement report with machine-readable reasons;
- recommendation to adopt llmfit ranking, retain a minimal Local Arcade policy,
  or proceed with a specified M-H algorithm.

Acceptance requires identical scenario inputs, no production imports of the
experimental algorithms, explicit missing-data results, reproducible output,
and passing existing root/runner gates.

## Stop conditions

Stop for owner review before M-H if:

- external terms do not permit the planned data use;
- an exact-enough cross-system input mapping is impossible;
- a proposed metric rewards unsafe or unsupported recommendations;
- Local Arcade does not show a material benefit over llmfit;
- selecting an algorithm requires an unapproved value tradeoff;
- the work would require production recommendation or M-O changes.

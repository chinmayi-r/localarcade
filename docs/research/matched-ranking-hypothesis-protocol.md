# Matched ranking hypothesis protocol

Status: **Proposed experiment contract**, 2026-07-22. This operationalizes the
approved ranking-and-audition research plan. It does not authorize production
ranking, external-data ingestion, runner side effects, or product weights.

## Hypotheses

Primary hypothesis: for the same owned hardware, task and candidate universe,
Local Arcade reaches an equal-or-preferred verified exact configuration with
fewer failed runs and fewer unnecessary comparisons than pinned llmfit alone.

Null hypothesis: Local Arcade provides no material improvement on those
outcomes. Exact-configuration completeness or better explanations alone may be
useful product properties, but they do not prove ranking superiority.

Secondary hypotheses are reported separately:

- Local Arcade rejects more unsupported claims without reducing runnable recall.
- Exact artifact/runtime/settings identity reduces failed or irreproducible runs.
- A small diverse portfolio reaches a preferred configuration with fewer tests
  than a single composite ordering.

## Freeze before observing comparative results

Each experiment release records:

- Local Arcade commit and M-A schema version;
- pinned llmfit source/version and invocation adapter;
- scenario corpus version and holdout assignment;
- exact candidate-universe snapshot;
- artifact revision, filename, hash, format and quantization;
- runtime product, engine/build, backend and relevant settings;
- hardware field values, origins and unknowns;
- tasks, context targets, prompt pack and scoring rules;
- declared primary metrics and owner-approved materiality thresholds.

No ranking weights or thresholds may be tuned against the holdout results.

## Collection tracks

### A. Sourced candidate research

Collect model cards, runtime documentation, exact artifact metadata and dated
community discussion. This track may nominate a family for consideration or a
stable exclusion test. It cannot label a configuration runnable, measured or
preferred.

### B. Matched system output

For every representable scenario, run pinned llmfit and preserved Local Arcade
against the same frozen universe. Store raw output, then normalize every input,
candidate, observation and exclusion as `exact`, `lossy` or `unsupported`.
Unsupported mappings remain in the scorecard and never receive fabricated
defaults.

### C. Controlled local measurement

After separate runner consent, selected exact configurations may be measured on
owned hardware. Record load/failure, memory, prompt throughput, generation
throughput, TTFT, stability, raw samples, preflight conditions and all identity
fields. Warmups remain separate. Failed, stopped, OOM and conditioned runs are
retained rather than dropped.

### D. Private task audition

Configurations that run may enter randomized or blinded comparisons for the
declared task. Preserve left/right randomization, tie, both-bad, skip and DNF;
keep response preference separate from experience preference and mechanical
checks. The owner or recruited participant approves each local run and no
prompt/result uploads occur under this protocol.

Community rows from llmfit, localmaxxing or Anubis remain reference-only until
their data-use terms and exactness satisfy a separately reviewed ingestion
contract.

## Scenario strata

The development corpus should cover at least:

- low-memory NVIDIA laptop/discrete hardware;
- mainstream 8–12 GB discrete hardware;
- 24 GB quality-oriented discrete hardware;
- Apple 16 GB and 32 GB unified-memory systems;
- CPU-only extraction or occasional-use hardware;
- unknown accelerator with manually confirmed memory.

The final holdout must contain scenarios, artifacts or task prompts not used to
choose weights. Missing available hardware is reported as an untested stratum,
not filled with community estimates.

## Scorecards

Report dimensions independently:

- runnable precision and recall where measurements exist;
- consensus recall at five, with stable-exclusion credit;
- exact-configuration completeness;
- supported-claim precision;
- coverage-gap and no-fit honesty;
- measured interval calibration;
- family/configuration diversity;
- failed downloads or runs avoided;
- comparisons, time and declared cost to reach the verified choice;
- regret against the measured or personally preferred result;
- stability under small hardware/task/evidence changes;
- reproducibility of every inclusion, exclusion and ordering decision.

Do not publish a composite winner unless the owner first approves every weight
and its product meaning.

## Analysis and decision outcomes

Every disagreement is classified as consensus right, system right, both
plausible under different scopes, insufficient evidence, or mechanical/catalog
mismatch. Confidence intervals and sample counts accompany reported rates.

The owner chooses among three outcomes after the frozen scorecard:

1. adopt llmfit ordering behind an attributed adapter;
2. retain a minimal Local Arcade constraint/diversity portfolio layer; or
3. approve one specified M-H policy because it met the predeclared threshold.

## Decisions still required before execution

- Material improvement thresholds for failed runs, decision cost and regret.
- Which owned machines cover the initial strata.
- The exact development/holdout split.
- Whether private human auditions use only the product owner or additional
  explicitly consenting participants.
- The pinned llmfit invocation boundary after M-B review.

Until those values are approved, the harness may verify mechanics but must not
claim that either system won.

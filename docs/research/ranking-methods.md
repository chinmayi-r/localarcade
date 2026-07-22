# Non-production ranking-method baselines

Status: implementation report for the product-owner-approved ranking research
checkpoint. The package under `../../research/ranking/` is an evaluation tool,
not M-H, a production policy, or evidence that Local Arcade improves on llmfit.

## Question and inspected baseline

The experiment asks whether a transparent sequence of hard constraints,
non-dominated filtering and diversity-aware selection can reduce failed trials
or unnecessary comparisons relative to the same llmfit inputs and current Local
Arcade behavior.

Current Local Arcade already preserves important safety behavior:

- `lib/recommendation/engine.ts` evaluates fit before ordering, distinguishes a
  catalog coverage gap from no fit, and returns an unranked shortlist when the
  selected metric is missing;
- `lib/recommendation/strategies.ts` exposes individual quality, speed, context
  and memory strategies, but its balanced strategy is a fixed weighted scalar
  (`0.45/0.25/0.15/0.15`) over cohort-normalized values;
- `lib/recommendation/ranking.ts` deduplicates families, rejects unsupported
  speed ties, then fills named slots by separate extrema.

Those observations do not condemn the current implementation. They identify a
reproducible comparison baseline and a product-value choice that this research
lane is forbidden to settle.

## Neutral experiment format

`fixtures/neutral-scenario.json` demonstrates the typed interchange. A scenario
contains dated candidates, hard constraints, objectives and diversity
dimensions. Every numeric observation is a closed interval with a unit, exact
comparison scope, evidence class and at least one source ID. Exact configuration
identity is separate and may be explicitly absent.

This format deliberately does not contain Local Arcade production DTOs or
llmfit-native types. The assembler must map each system into it without silently
inventing fields. The ranking lane needs these eventual assembler fields beyond
its minimal fixture:

- scenario and candidate provenance/license metadata;
- raw upstream exclusion codes and raw score components;
- immutable artifact and runtime configuration identity;
- observed run labels and consensus must-consider labels;
- a declaration of which relevance transform and MMR trade-off an experiment
  used.

## Baselines

### 1. Hard constraints

`applyHardConstraints` accepts a candidate only when every required observation
is present, finite, sourced, unit-matched, scope-matched and its entire interval
satisfies the constraint. For an `at-most` memory limit, for example, the upper
bound must fit. Missing data is a rejection, never an assumed pass.

### 2. Conservative Pareto frontier

`nonDominated` retains candidates for which no other candidate is provably no
worse on every declared objective and strictly better on at least one. Closed
intervals make this stricter than comparing midpoints: overlapping intervals do
not establish dominance. The result is a partial order, not a hidden final rank.

This is motivated by the use of Pareto efficiency for conflicting recommender
objectives in Ribeiro et al., *Multiobjective Pareto-Efficient Approaches for
Recommender Systems*. Their application and metrics do not validate these Local
Arcade objectives; the paper only supports evaluating the non-dominated baseline
([paper record and manuscript](https://dl.acm.org/doi/10.1145/2629350)).

### 3. Diversity-aware top-k

`selectDiverseTopK` is an MMR-style greedy baseline. Each iteration maximizes
an explicitly supplied trade-off between sourced experiment relevance and the
largest categorical similarity to an already selected configuration. Similarity
uses declared dimensions such as family, runtime and quantization.

The package has no default relevance function or trade-off. The caller must
provide both, and results must be reported across sensitivity settings. This
follows the relevance-versus-redundancy framing of Goldstein and Carbonell while
making no claim that text-retrieval MMR is optimal for model configurations
([1998 MMR paper](https://aclanthology.org/X98-1025/)).

## Metrics and comparison protocol

Do not collapse the scorecard into a private weighted score. For identical
scenario inputs, report:

- runnable precision, with unknown run outcomes excluded and counted;
- consensus recall at five and rank/retention of every must-consider candidate;
- exact-configuration completeness;
- supported-claim precision, with unknown support counted separately;
- distinct-family and exact-configuration diversity;
- number and reason of constraint, scope, unit and missing-evidence rejections;
- Pareto-front size and dominated-candidate proofs;
- stability under interval, relevance and trade-off perturbations;
- failed runs, elapsed test time and declared test cost needed to reach a
  verified choice;
- regret only where a measured or personally preferred outcome exists.

The package implements the first four basic label metrics plus distinct-family
count. The assembler still owns full scorecards, perturbation runs, decision
cost and regret because those require the shared corpus and execution outcomes.

## Data still required for a fair llmfit comparison

No llmfit superiority conclusion is possible until the upstream lane supplies:

1. a pinned revision and the exact candidate universe seen by both systems;
2. raw constraint exclusions, fit estimates, score components and ordering;
3. the hardware override, context, task, runtime and quantization inputs that
   llmfit can actually represent;
4. exact community benchmark row identity, scope and source distinction;
5. mappings from llmfit model recommendations to immutable Local Arcade
   artifact/runtime configurations, with unmappable cases retained;
6. measured run outcomes or clearly dated consensus labels for evaluation;
7. evidence that both systems received equivalent inputs, plus unsupported
   input records rather than approximations.

Until then, this lane establishes only executable baselines. If the eventual
scorecards do not show a material reduction in failed trials or comparison cost,
the research plan requires adopting more llmfit rather than inventing an M-H
algorithm.

## Reproduction and boundaries

Run `npm.cmd run research:ranking`. The tests prove missing fit evidence and
scope mismatches are rejected, overlapping intervals do not create dominance,
provable dominance is traceable, MMR parameters are explicit, unknown labels
remain unknown, and the package imports neither production modules nor
side-effect APIs. No production file imports `research/ranking/`.

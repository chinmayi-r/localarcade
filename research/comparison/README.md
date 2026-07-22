# Research comparison interchange

This assembler-owned directory defines how non-production research lanes hand
normalized scenario results to the final comparison. It is outside production
packages and does not authorize a ranking policy.

## Commands

```powershell
node research/comparison/validate.mjs
node --import tsx --test research/comparison/*.test.ts
```

The validator accepts all `*.valid.json` fixtures and proves every
`*.invalid.json` fixture is rejected by JSON Schema or semantic checks. Tests
exercise the deterministic evaluator and import boundaries.

## Preserved distinctions

Version 1 preserves:

- exact, lossy, or unsupported mapping overall and per input/evidence facet;
- considered, recommended, excluded, or unsupported candidates;
- exact, compatible, proxy, or unknown evidence applicability;
- retained, excluded-with-reason, silently-missed, or unjustified consensus
  expectations;
- satisfied, violated, or not-evaluable safety guards;
- family-level identity versus a complete exact configuration;
- observations comparable only under matching unit and scope;
- diversity coverage per declared dimension rather than a hidden score.

Community consensus and successful benchmark submissions are sources, not
ground truth. `runnable` remains `unknown` without a matched run.

## Evaluation behavior

[`harness.ts`](harness.ts) reports expectation, guard, mapping,
configuration-completeness, runnable, objective-coverage and diversity results
separately. It does not choose weights or produce a composite winner.

An expectation is credited when its family is retained or excluded using one
of that expectation's explicitly allowed stable codes. An unrelated exclusion
is `present-but-unjustified`; absence is `silently-missed`.

Date-only retrievals become midnight UTC deterministically while retaining
`retrievalPrecision: date`; midnight is a serialization convention, not an
observed retrieval time. Unknown hardware remains nullable. Semantic validation
rejects a guessed model, backend, or candidate list for an unknown vendor.

A system unable to express `patient` latency marks task mapping `lossy` and
records `PATIENT_TO_INTERACTIVE`. Overall mapping must equal the worst of
hardware, task, constraints, candidate identity and evidence.

## Deliberate limits

- The harness consumes normalized local fixtures and performs no network or
  external-data ingestion.
- Consensus exclusions need candidate-specific allowed codes. A general safety
  guard is not automatically an acceptable exclusion reason.
- Objective coverage establishes comparability, not superiority.
- No file here imports production packages or M-A.

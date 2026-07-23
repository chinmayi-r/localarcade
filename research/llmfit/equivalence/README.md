# M-B fit equivalence research harness

Status: non-production research evidence. This directory does not select an
llmfit integration form, implement the M-B production adapter, or alter current
fit or recommendation behavior.

## Question answered

Given a normalized, upstream-style llmfit fit observation and the facts required
by the current Local Arcade single-pool fit core, does the comparison:

1. agree within an explicit byte tolerance;
2. disagree on fit or required memory; or
3. lack a lossless representation?

The harness never averages contradictory results and never fills an upstream
omission with an assumed default. An unsupported topology is
`unrepresentable`, not a failed or successful fit.

The bundled records are deliberately labelled
`normalized-upstream-style`. They exercise the comparison contract; they are
not claimed to be captured executions of the llmfit binary. A future pinned
replay lane may replace or add captured observations without changing these
outcome rules.

## Inputs and outputs

Each scenario supplies:

- a pinned source identity;
- upstream available/required byte totals and fit result, when exposed;
- topology and facts the upstream result did not expose;
- an exact Local Arcade fit invocation, or explicit mapping blockers;
- absolute and relative byte tolerances;
- the expected outcome.

The output preserves the upstream observation, the complete Local Arcade
component breakdown when invoked, field-level differences, and reasons.

## Reproduce

From the repository root:

```powershell
npx.cmd tsx --test research/llmfit/equivalence/equivalence.test.ts
npx.cmd tsx research/llmfit/equivalence/report.ts
npx.cmd tsx research/llmfit/equivalence/report.ts --json
```

The negative corpus proves rejection of negative tolerances, contradictory
upstream fit facts, unknown topology values, and unrepresentable records that
omit their blocker.

## Current demonstrated outcomes

| Fixture | Outcome | Meaning |
|---|---|---|
| `single-pool-exact-agreement` | agreement | Both systems report the same total and fit result; Local Arcade also exposes its full component breakdown. |
| `single-pool-fit-disagreement` | disagreement | Upstream says fit, while Local Arcade's explicit reserves make the same capacity insufficient. Both results remain visible. |
| `heterogeneous-multi-gpu-unrepresentable` | unrepresentable | The current Local Arcade input cannot express per-device heterogeneous placement, so no local fit is invented. |

This corpus does not establish equivalence with llmfit generally. It establishes
the fail-closed comparison vocabulary and executable review shape required
before captured upstream cases can support an adoption decision.

# Consensus-sanity corpus methodology

Status: **Non-production research artifact**, source snapshot 2026-07-22. This
implements the consensus-corpus lane of the approved
[ranking and audition research plan](../ranking-and-audition-research-plan.md).
It does not approve candidates, change ranking, promote registry records or
authorize external-data ingestion.

## What this corpus tests

The corpus asks whether a recommendation system retains configurations that
informed users would reasonably investigate, or gives a stable machine-readable
reason for excluding them. “Must consider” is not “must recommend,” and never
means “rank first.”

The snapshot is
[`research/consensus/scenarios.json`](../../research/consensus/scenarios.json),
validated by
[`scenario.schema.json`](../../research/consensus/scenario.schema.json) and
[`validate.mjs`](../../research/consensus/validate.mjs).

Run from the repository root:

```powershell
node research/consensus/validate.mjs
```

The validator applies Draft 2020-12 JSON Schema checks and semantic checks for
unique identifiers, valid source references, source dates, and the distinction
between sourced candidate priors and procedural-only blocked states. Negative
fixtures prove duplicate and dangling identifiers are rejected.

## Evidence method

Each scenario freezes hardware memory, task, context target, latency preference,
runtime assumptions and offload assumptions. Candidates cite their sources and
stop at model-family identity when an exact artifact, quantization or runtime
build has not been established.

Sources remain separate evidence classes:

- vendor model cards establish model identity, intended use and advertised
  limits, but not local fit or superiority;
- runtime documentation establishes execution mechanisms, but not performance
  on the scenario hardware;
- community discussions establish dated consideration patterns and lived
  disagreement, but are self-selected, mutable and not controlled benchmarks.

Retrieval dates are explicit. Publication dates remain `null` for continuously
updated repositories. The corpus stores claims and links, not copied datasets
or community submissions.

## Inclusion and exclusion semantics

A strong case needs converging support for why a family belongs in the
consideration set and enough runtime information to describe what remains to be
verified. Every candidate is marked
`family-prior-exact-artifact-unresolved`. Production use would first require an
immutable artifact, quantization, chat template, runtime build, backend, KV
cache, context and settings through M-A-compatible types.

`mustNotRecommend` rules prevent unsafe shortcuts: treating maximum context as
feasible context, double-counting Apple unified memory, or inferring a backend
from a memory number.

## Included cases and honest gaps

This pass includes four strongly sourced candidate cases and one procedural
case:

1. 6 GB NVIDIA laptop GPU, interactive coding;
2. 12 GB discrete GPU, coding with project context;
3. 16 GB Apple unified memory, writing and summarization;
4. 24 GB NVIDIA GPU, quality-oriented coding;
5. unknown accelerator with manually confirmed memory.

The 8 GB general-assistant, 32 GB Apple long-document and CPU-only extraction
shapes remain explicitly omitted. The first lacked a distinct, strong candidate
set in this pass; the Apple case belongs with exact Anubis matching; and the CPU
case lacked a strong dated model-consensus set. Missing cases are preferable to
weakly sourced filler.

## Known disagreements

- Weight fit is not configuration fit. KV cache, runtime buffers, display/OS
  reserve and context can reverse a family expectation.
- Partial CPU offload may allow loading while violating interactive latency.
- Vendor context ceilings do not establish feasibility or useful quality.
- Community interest in Qwen2.5 Coder 32B at 24 GB does not prove coding
  superiority; the cited benchmark explicitly omitted coding tasks.
- Small models may minimize failures while losing task adequacy; only scoped
  verification or private audition can resolve that tradeoff.

## Source register

The JSON register is canonical for evaluation. Key references include the
[Qwen2.5 Coder collection](https://huggingface.co/collections/Qwen/qwen25-coder),
[Gemma 3 4B model card](https://huggingface.co/google/gemma-3-4b-it),
[Phi-4 Mini model card](https://huggingface.co/microsoft/Phi-4-mini-instruct),
[MLX LM documentation](https://github.com/ml-explore/mlx-lm), and
[llama.cpp documentation](https://github.com/ggml-org/llama.cpp). Community
sources are recorded per scenario with publication and retrieval dates.

## Assembler mapping

The shared comparison interchange can map this lane without semantic loss:

| Corpus field | Comparison meaning |
|---|---|
| `hardware` | scenario hardware input |
| `task` | task, context and priority input |
| `assumptions` | runtime/backend constraints and declared unknowns |
| `mustConsider` | expected retention **or stable exclusion**, never expected rank |
| `mustNotRecommend` | safety/compatibility constraint violations |
| `sourceIds` | source references and evidence class |
| `disagreements` | allowed `both-plausible` or `insufficient-evidence` outcomes |

The interchange must retain `identityCompleteness`; otherwise a family prior
could be mistaken for an executable exact configuration. It also needs an
expectation result that distinguishes retained, excluded-with-reason, and
silently-missed. Flattening `mustConsider` into a winner or rank target would be
a schema error.

No production path imports this corpus. Promotion requires another
owner-reviewed checkpoint.

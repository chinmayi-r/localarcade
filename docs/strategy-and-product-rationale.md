# Strategy and product rationale

Status: conversation context and design rationale. This preserves useful
explanations from product discussions; it does not override the product brief,
audited implementation, or unresolved decision ledger.

## The long-term thesis

Local inference is likely to spread across laptops, desktops, phones, servers,
appliances, and products. The difficult consumer question will not be merely
“which model has the highest benchmark?” It will be:

> Which exact configuration can this device run, which one is worth trying for
> this work, and what evidence should change that answer?

Local Arcade aims to become the discovery and audition layer for that decision:
find, narrow, run, compare, explain, and—only with explicit consent—improve a
shared evidence map.

## Why existing products do not erase the opportunity

Google did not win because search was new. It won by making retrieval and
ranking materially more useful and then compounding distribution, speed, trust,
and feedback. PageRank was not a raw popularity list: the source and structure
of an endorsement affected its value.

The Local Arcade analogy is limited but useful. Model downloads and mentions
are discovery/familiarity signals, not quality truth. A stronger trust system
uses reproducible configuration identity, source reliability, comparable
measurements, task scope, contradictions, and independent confirmations.
Familiar models may be visible anchors and tie-breaks; an exploration slot
prevents incumbency from becoming destiny.

The lesson is not “invent a magical PageRank for models.” It is that a product
can enter an existing category by making the core decision substantially more
reliable and easier to act on.

## Competitive boundaries

### Arena-style products

Arena asks which of two outputs a voter prefers for one disclosed prompt. That
is valuable population-level response evidence. It does not determine whether
an exact quantization fits a device, how it performs locally, whether a runtime
template changes it, or whether it works for one person's repeated workflow.

Local Arcade has two distinct Arena concepts:

- **Private Arena:** the person's prompt, selected installed configurations,
  sequential local execution, blind vote, and local history. This can inform
  that person's decision.
- **Public Arena:** licensed public prompts and contributed or remotely hosted
  outputs. A voter can judge correctness, instruction following, clarity, or
  preference because the prompt is visible, even if they did not write it. It
  remains broad population evidence.

Precomputed public pairs let people judge models they cannot run, but only
because another machine already produced the outputs. They prove the generating
configuration, not every local version of the model.

### OpenRouter and hosted catalogs

Hosted catalogs make many model endpoints easy to call. They are useful sources
of discovery and response priors. They do not include every revision, GGUF,
quantization, context/cache choice, runtime build, or local hardware path.
Remote output can preview model character but cannot establish local fit,
latency, stability, thermals, power, or exact-template behavior.

### Not Diamond and custom routers

A hosted router usually chooses an endpoint for each request using provider,
cost, latency, benchmark, or learned preference signals. Local Arcade first
chooses and verifies exact configurations for a device and task, including
whether they are available at all. A future router may consume Local Arcade
evidence, but routing is not the only product.

The differentiation must be proven through successful setup, time to first
useful local response, recommendation adoption, later regret, and preference on
real work—not by describing the product as “quality-first.”

### llmfit

llmfit is strong upstream work for hardware discovery, model knowledge, fit,
planning, and related operations. Local Arcade should adopt or wrap useful core
behavior rather than rewrite it for pride. It still adds a distinct layer:
immutable artifact/runtime identity, evidence policy, safe shortlists, private
auditions, public contribution integrity, cross-surface orchestration, and a
consumer journey.

The adapter must remain replaceable. Current Local Arcade fit math has strong
goldens and properties; llmfit does not replace it until an equivalence spike
explains differences and preserves fail-closed behavior.

### LM Studio, Ollama, llama.cpp and llama-swap

LM Studio is technically a wrapper over runtimes, but discovery, setup, model
lifecycle, chat, serving, and product polish are meaningful value. That analogy
supports Local Arcade: a layer can be valuable without owning model weights or
kernels.

Local Arcade's job is different. It advises across products and configurations,
then verifies and compares them. It should hand off to an existing inference
product where that is the better user experience instead of becoming another
full model runtime by default.

## Hardware and output quality

Hardware primarily changes feasibility and experience: memory fit, load time,
time to first token, throughput, stability, thermals, and power.

With identical artifact, precision, runtime, template, settings, seed, and
decoding, output quality should be mostly hardware-independent. In practice,
hardware forces different quantization, CPU/GPU offload, context, kernels,
precision, or runtime choices, and nondeterminism can change the output.
Therefore evidence keys include configuration and runtime—not just model family.

Response preference may sometimes pool across hardware when inference identity
is comparable. Experience preference, fit, speed, energy, and stability cannot.

## Harnesses and the meaning of quality

A harness can materially change how a model behaves: system instructions,
templates, tool schemas, retrieval, chunking, context construction, retries,
verification, and post-processing all matter. This does not make evaluation
impossible. It changes the experimental unit.

Every result states:

```text
model/artifact + runtime + harness/recipe + task/cases + evaluator + settings
```

Public benchmarks provide priors under their published harnesses. A private
workflow comparison tests the person's real recipe. Harness responsiveness can
be explored later by holding cases and evaluator fixed while varying recipes;
it is not a universal “teachability” badge and does not imply weight training.

## Website, desktop and API roles

- The website answers “what should I consider?” without pretending to inspect
  the visitor's machine.
- The desktop answers “what do I actually have and what happened here?” after
  explicit actions.
- CLI/API surfaces make those same decisions reproducible and composable.
- Public evidence improves broad priors only after explicit contribution.

The first screen should be immediately useful and familiar. Hundreds of models,
raw benchmark controls, contribution concepts, manifests, incumbents, workflows,
or endpoint instructions must not become novice setup tax. Detail is disclosed
when the decision requires it.

## Local Arcade and Lakuna

Local Arcade builds a public/general map of configurations and evidence. Lakuna
may evaluate or learn from a person's private recurring work. They remain
separate. The connection is a vendor-neutral, previewable export whose receiver
selects relevant fields and earns its own conclusions. Local Arcade never needs
a Lakuna-named endpoint, and public users never need to know Lakuna exists.

## What must be demonstrated

The strategy becomes credible only if Local Arcade can beat common alternatives
on measurable user outcomes:

- manual Reddit/model-card research;
- selecting only by popularity or leaderboard rank;
- a hosted-model catalog used as a proxy for local behavior;
- a fit-only tool with no exact evidence or audition loop;
- keeping the current model because comparison is too difficult.

Useful outcome measures include successful-run rate, time to first useful local
response, shortlist comprehension, adoption, repeat use, regret, preference,
and reproducibility of every displayed claim.

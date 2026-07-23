# Local Arcade product brief

Status: **Product-owner-approved first-slice authority**, 2026-07-22. This
document governs product purpose, first-slice scope, surfaces, and exclusions.
It does not by itself authorize an implementation checkpoint.
`MILESTONE-STATUS.md` remains authoritative for implemented state; the eight
Wave 0 reports listed in `README.md` are the preservation audit.

## Purpose

Local Arcade helps a person answer four related questions:

1. What complete local-model configurations are plausible on this device?
2. Which few configurations are worth trying for this kind of work?
3. What actually happened when an exact configuration ran on this machine?
4. Which response and lived generation experience does this person prefer?

The unit of truth is not a model-family name. It is an exact configuration:
artifact and revision, quantization, runtime and build, backend, context, cache
settings, relevant execution settings, hardware scope, task or prompt scope,
and evidence provenance.

## Owner-approved first-slice direction represented in this draft

The first slice is one continuous path:

**owned-hardware website finder → scoped configuration portfolio → exact
configuration detail → handoff to the separately gated desktop runner**.

Private Arena is planned local-product scope after finder and runner
verification. Public Arena, uploads, public voting, contribution and public
evidence service work are deferred and excluded from the execution plan.

## Product surfaces

### No-install website

The website is a finder and evidence browser. It accepts self-reported hardware
and a plain-language goal, narrows the catalog, and returns at most five honest
starting configurations. It may simulate changes to hardware, but it cannot
detect hardware, inspect files, run a model, or claim a local measurement.
Maximum artifact size remains a finder preference and configuration-detail
fact; it does not authorize or imply a website download.

Arrival uses a normal website header, short explanation, one contained
hardware/task form and one primary action, with results below and methodology
later. Secondary journeys may be links. It does not use three equal entry
cards, a marketing hero, persistent app chrome or an arrival leaderboard.

### Desktop application

The desktop app is a separate permission boundary. With a distinct action for
each capability, it can detect hardware, scan supported model stores, resolve
owned artifacts, run controlled checks through approved runtime adapters,
compare two configurations privately, retain local history, and preview any
portable export or contribution before data leaves the device.

For the first slice, detection, read-only inventory and existing-engine
verification remain separate explicit actions. Downloads, contributions,
uploads, public release and updater behavior remain separately gated and are
not authorized by this brief.

### CLI and developer API

CLI and API surfaces expose the same versioned use cases and evidence objects as
the website and desktop app. They are not an inference proxy and do not create a
second ranking implementation.

### Optional public evidence

Public measurements and Arena-style comparisons may improve the shared map
after their identity, consent, integrity, abuse, retention, and revocation
contracts are approved. Public preference is population evidence, not proof for
one person's workflow. Public-service work is not authorized merely because a
dark rating core exists.

## Product promise

Local Arcade narrows a confusing local-model landscape into a small number of
runnable, explainable experiments. It separates:

- hardware fit;
- speed and stability;
- objective task checks;
- response preference;
- experience preference;
- popularity or familiarity;
- missing evidence.

Those channels are never silently collapsed into a universal quality score.
Unknown evidence is not weak evidence, and a familiar model is an anchor or
tie-break—not assumed to be better.

## Relationship to existing products

- `llmfit-core` is a candidate upstream fit/discovery engine behind a Local
  Arcade adapter. Adoption requires a pinned integration and equivalence tests;
  it does not replace Local Arcade's evidence, audition, or product layers.
- LM Studio, Ollama, llama.cpp, llama-swap, MLX LM, Jan and vLLM are distinct
  products, engines, or serving routes. Local Arcade advises and verifies them;
  it is not required to replace them.
- Arena-style systems provide broad response-preference evidence. They do not
  establish exact local fit, speed, runtime behavior, or private-workflow value.
- Hosted catalogs and routers provide remote inference and routing. A hosted
  endpoint is useful prior evidence but is not interchangeable with an exact
  local artifact and runtime configuration.

See [strategy and product rationale](strategy-and-product-rationale.md) for the
longer analogies and competitive boundaries.

## Evidence and honesty invariants

- Every displayed claim states whether it is estimated, community-measured,
  locally measured, objectively checked, preferred, detected, or self-reported.
- Evidence is pooled only when its artifact, runtime, hardware, task, prompt,
  and harness scopes permit it.
- Fit is evaluated before recommendation ordering.
- Unsupported candidates are withheld rather than used to pad a top five.
- Estimates and measurements coexist; new evidence does not erase the prior.
- A failure, timeout, crash, OOM, skipped vote, contradiction, or unknown state
  remains visible.
- No scan, execution, download, upload, or contribution follows from navigation
  alone.
- Prototype values remain visibly illustrative and never enter production
  evidence.

## Relationship to Lakuna

Local Arcade and Lakuna are separate products, repositories, permission
boundaries, and release decisions. Local Arcade does not expose a Lakuna-named
endpoint or public UI. A future receiving product may consume a previewable,
vendor-neutral configuration/evidence bundle and choose the fields it needs.
Importing that bundle never upgrades public evidence into private-workflow
proof.

## What exists now

The audited implementation contains tested registry, hardware, runtime, fit,
throughput, evidence, recommendation, local inventory, benchmark, quick-check,
and dark rating cores. The shared first-slice contract package exists. An
isolated pinned llmfit formula-adapter spike exists, but it is not linked into
a product surface and has no live M-F handoff. A partial non-production M-O
boundary now covers finder/detail/handoff, import validation, context
composition, permission/inventory, verification preview and an opaque typed
process-local execution transport for benchmark-then-fixed-check verification.
The desktop D1–D6 surface now consumes that M-O boundary through a typed
application facade; deterministic surface tests and browser inspection prove
the adapter and inspectable states, not a native external-model run. It remains
unproven against a live external model and is not persistent across runner
restart. The private Arena use case,
public contribution/service layers, approved replacement UI and complete
cross-platform runner do not yet exist as the target architecture defines
them.

The current desktop boundary can explicitly hash one user-selected local
artifact candidate and can validate a server-owned fixed verification plan and
result. This remains non-authorizing until the separate consent gate and is
proven with fixtures, not a live external-model run. The U27 profile-collection
work is synthetic research machinery only; no production fit policy or trusted
measurement source is approved.

See the [documentation authority map](README.md) and approved Wave 0 reports
before reusing or replacing code. The first-slice production contract package
and its approved documentation schema and fixtures live under
[`lib/contracts/`](../lib/contracts/) and
[`contracts/`](contracts/README.md).

## Decisions still required at consuming checkpoints

U1–U7 are resolved. The remaining decisions include:

- website execution/distribution for the pinned llmfit-backed advisory;
- initial platform support and manual fallbacks;
- benchmark trust/release boundary;
- any public contribution, storage, or Arena service.

The live decision ledger is [unresolved-decisions.md](unresolved-decisions.md).
The active surface and visual contracts are [screen-contract.md](screen-contract.md)
and [design-foundation.md](design-foundation.md); the dependency sequence is
[worktree-execution-plan.md](worktree-execution-plan.md).

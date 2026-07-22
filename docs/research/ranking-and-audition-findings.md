# Ranking and audition research findings

Status: **Owner review required**, 2026-07-22. This closes the approved
non-production research fan-out at its documented stop conditions. It does not
approve an M-H policy, production ranking changes, external-data ingestion, or
M-O implementation.

## Decision result

Local Arcade has **not demonstrated a ranking improvement over llmfit**. The
research does show a narrower product advantage worth preserving: Local Arcade
can require exact artifact/runtime/settings identity, keep evidence scope
explicit, fail closed on unknown fit, and hand an inspectable configuration to
a separately gated local verifier. Those are contract and verification
advantages, not proof of a better ordering algorithm.

The current evidence therefore supports neither replacing llmfit wholesale nor
promoting a novel Local Arcade score. The next owner decision is whether to:

1. use a pinned llmfit adapter as an attributed candidate/fit prior while Local
   Arcade owns exact identity, evidence applicability, and verification; or
2. fund a matched evaluation corpus before selecting any M-H ordering policy.

## Completed evidence

| Work | Result | Evidence |
|---|---|---|
| M-A wire boundary | Approved schemas, TypeScript/Rust DTOs, canonical handoff, adapters, cross-runtime validation | commits `55afbb2`, `a7c634f`, `7bddf7e`; [contract README](../contracts/README.md) |
| llmfit baseline/community path | Explicit opt-in PR loop verified; shared rows and consumer matching are too coarse for exact evidence | commit `865cf60`; [upstream/community audit](llmfit-upstream-community-audit.md) |
| Interpretable baselines | Fail-closed constraints, closed-interval Pareto filtering, parameterized diversity; no product weights | commit `5b45c35`; [ranking methods](ranking-methods.md) |
| Consensus corpus | Five sourced/procedural scenarios; must-consider means retain or stably exclude, never rank first | commit `db1f516`; [methodology](consensus-corpus-methodology.md) |
| Apple/Metal boundary | Anubis fields are useful reference evidence but exact artifact/runtime identity and data-use permission are unresolved | commit `af06221`; [Apple validation](apple-silicon-validation.md) |
| Comparison harness | Reproducible separate-dimension scorecards; unknown hardware fails closed; no network or production imports | commit `6732d00`; [harness README](../../research/comparison/README.md) |

## llmfit community results

The contribution sequence is real and user controlled: local benchmark save,
preview with default-no confirmation, GitHub device authentication, fork and
pull request, CI validation, maintainer merge, then release embedding. Local,
`llmfit-community`, and `localmaxxing` sources remain distinguishable.

However, the shared community record omits immutable artifact identity,
runtime build and full settings, raw samples, failures, and sufficient workload
scope. Matching uses CPU/GPU names and heuristic model tags while ignoring
consequential fields such as VRAM, GPU count and OS. Local Arcade may therefore
treat an attributed row as a **scoped community prior**, but must not call it an
exact measurement or silently calibrate every candidate from it. Permanent
ingestion or redistribution remains blocked pending explicit dataset terms.

## Why no comparative winner exists yet

The harness is ready, but a real scorecard requires the same frozen candidate
universe and representable scenario inputs for each system. The checkpoint did
not establish:

- exact configuration mappings for llmfit outputs;
- immutable runtime/artifact identity in community or Anubis rows;
- owner-approved relevance/diversity tradeoffs;
- a measured or personally preferred label corpus;
- permission to ingest or redistribute external community rows.

Filling those gaps with guessed identifiers, inferred memory, or hand-authored
winner labels would make the comparison circular.

## Contract corrections discovered during research

Clean worktrees exposed that the first M-A adapter had compiled against a dirty
legacy `systemMemoryGb` extension. Commit `a7c634f` moved that optional value to
the adapter boundary so clean-baseline typechecking succeeds.

Apple review then found copied prompt-throughput intervals attached to
generation samples in four approved golden envelopes. Commit `7bddf7e` corrects
the generation ranges and makes TypeScript, Rust, and the standalone fixture
validator reject sample-count, unit, or unqualified-interval contradictions.
The fixture corpus remains 18 accepted and 11 rejected; an additional dynamic
negative test now proves this cross-record invariant.

## Owner decisions required

1. Approve or reject a **pinned llmfit-as-prior adapter** for M-B. This grants no
   right to ingest community datasets and no authority to treat its score as
   Local Arcade truth.
2. Decide whether matched local evaluations are worth funding before M-H, or
   whether the first slice should keep a minimal fail-closed portfolio policy.
3. Approve the value tradeoffs, if any, for portfolio relevance versus family,
   runtime, quantization, and evidence diversity. The research implementation
   intentionally supplies no defaults.
4. Obtain explicit data-use terms before caching or redistributing llmfit,
   localmaxxing, or Anubis community rows.
5. Resolve Apple shared-pool representation before an adapter maps host and
   device memory; unified capacity must never be counted twice.

## Recommended next checkpoint

Keep M-H policy selection paused. If the owner approves llmfit as a prior, open
a narrow M-B adapter checkpoint that pins an upstream revision, maps every
field as exact/lossy/unsupported, emits attributed candidate priors only, and
adds no production ordering weights. In parallel, specify a small owner-run
matched evaluation set using owned artifacts and existing-engine verification.

M-O and production surface work remain prohibited until their own explicit
checkpoint and until the consumed domain contracts are stable. Public Arena,
uploads, public voting, and an external evidence service remain deferred.

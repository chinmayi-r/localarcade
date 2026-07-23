# M-B raw-fixture normalization spike

Status: non-production research. This directory does not resolve U8/U9, invoke
llmfit, select a distribution method, or authorize a website/network boundary.
The replay identity is the official `v1.1.6` tag resolved by the provider lane
to commit `aaa2bc179cec214ccdc44501c853b98fba0b343b`. The earlier audit commit
`7ba90ce0f14756040db658933bfd5c6ad46ed4ea` is intentionally rejected.

## Capability boundary

The adapter accepts two separately supplied records:

1. `IndependentAdvisoryInput` contains hardware, task, context, and optional
   runtime constraints chosen without reference to the replay fixture.
2. `RawLlmfitFixture` represents the boundary expected from one pinned upstream
   build. Fixtures in this directory are labeled `synthetic-contract`; they
   were authored to test the boundary and were not captured from an llmfit
   executable. The normalizer accepts only `synthetic-contract`; a future
   captured record must pass a separately designed integrity-receipt boundary
   before this type can be expanded. This prevents callers from gaining trust
   merely by writing `captured-replay` into an invented fixture. This is
   deliberately a fixture port, not a claim that an upstream executable is
   present in this repository.

It emits one of four classifications:

| Classification | Meaning |
|---|---|
| `exact` | Every consumed distinction in the adopted advisory projection has an approved representation. It does not mean the complete upstream record was adopted. |
| `lossy` | The advisory remains usable, but a consumed distinction collapsed; the raw value and a reason remain attached. |
| `unsupported` | The independent request or an upstream semantic cannot be represented safely. No candidate is emitted. |
| `unavailable` | The input, fixture envelope, pinned version, or raw record is invalid/unavailable. No candidate is emitted. |

Successful output is intentionally limited to broad model-family facts and an
attributed fit/performance advisory. It does not contain exact artifact
identity, artifact admission, a Local Arcade evidence upgrade, portfolio roles,
or ranking. The `ignoredUpstreamFields` ledger records that `score` and
`scoreComponents` are intentionally retained only in raw attribution. An
upstream reported TPS observation remains named as upstream
reported rather than being upgraded to a Local Arcade measurement class.
Upstream composite score fields remain only in `rawAttribution`.
Capability strings are exposed only as `upstreamReportedCapabilities`; Local
Arcade does not adopt them as product capabilities or promise tool handling.

## Reproduce

```powershell
npx.cmd tsx research/llmfit/normalization/demo.ts
npx.cmd tsx --test research/llmfit/normalization/adapter.test.ts
```

The first command prints reviewable `exact`, `lossy`, `unsupported`, and
`unavailable` outputs. The focused tests additionally demonstrate malformed
record rejection, complete independent hardware/task/constraint binding,
unknown unified-memory rejection, bounded numerics and safe byte conversion,
empty upstream results, and immutable raw attribution.

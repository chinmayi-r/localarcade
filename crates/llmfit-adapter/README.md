# Local Arcade isolated llmfit adapter

Status: partial M-B implementation spike. This library is intentionally not
linked into the website, desktop runner, CLI or M-F.

## Why it is isolated

The pinned `llmfit-core` crate unconditionally compiles HTTP, provider,
filesystem, update and sharing dependencies and embeds community/localmaxxing
data even when Local Arcade calls none of those paths. Linking it into the
current runner would contradict the runner's zero-HTTP-client dependency
contract.

This crate therefore has no executable, Tauri command, IPC, FFI or UI. It
proves that the approved explicit-input formula path can be called behind a
small replaceable boundary without weakening the runner.

## Allowed upstream path

The implementation uses only:

1. an explicitly constructed and validated `SystemSpecs`;
2. `ModelDatabase::embedded()`;
3. `backend_compatible`;
4. `ModelFit::analyze_with_config` with explicit context and a fixed positive
   DDR-bandwidth assumption.

It does not call hardware detection, installed-provider discovery, local
benchmark history, embedded community lookup, localmaxxing lookup,
calibration, ranking, downloads, updates, sharing, network or child processes.
The source-boundary test rejects those API names.

## Input and output

`AdvisoryRequest` requires explicit total and available RAM, CPU identity and
core count, accelerator topology, memory, backend and context. Unknown,
contradictory or heterogeneous inputs fail closed. Forced runtime is rejected
because upstream `v1.1.6` cannot combine it with the explicit calculation
configuration.

`AdvisoryResponse` applies a stable model-identity order—not a fit, speed or
quality ranking—and returns formula advisory fields only. Runtime and
quantization are suggestions, not
exact configuration identity. The response omits upstream composite scores,
installed state and measured/community evidence.

The TypeScript Local Arcade envelope and proposed M-F crosswalk live in
[`lib/llmfit`](../../lib/llmfit/) and
[`research/llmfit/production-contract`](../../research/llmfit/production-contract/).
No transport currently connects this Rust response to that boundary, so the
real M-B → M-F handoff remains missing.

## Reproduce

From `G:\LocalArcade`:

```powershell
npm.cmd run proof:mb
```

The upstream source is pinned to `v1.1.6`,
`aaa2bc179cec214ccdc44501c853b98fba0b343b`. The retained MIT notice is in
`LICENSES/llmfit-MIT.txt`. Public distribution still requires review of
upstream's embedded data licensing and the transitive dependency surface.

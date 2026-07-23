# Captured llmfit replay proof

Status: isolated non-production research. This bridge reads the retained
provider-audit pin, raw system output and raw coding recommendation. It does not
invoke llmfit, alter production behavior, select M-B distribution, or make the
captured recommendation eligible for Local Arcade ranking.

## Observed output

The five retained evidence files pass exact SHA-256 verification. This proves
the integrity of those retained bytes, not that they were cryptographically
produced by a particular binary, command, time, source checkout or machine.
The documented probe provenance is an audit assertion. The recommendation
contains three llmfit advisory rows, its system echo exactly matches
`raw-system.json`, and the retained commands report exit code `0`. The bridge
summarizes those rows without adopting llmfit's composite score.

Normalization is deliberately **blocked**. The CLI command independently
supplied RAM capacity, GPU-memory capacity, CPU cores, context, use case and
runtime. It did not independently supply available RAM, CPU identity, GPU
identity, backend, GPU count or unified-memory state. Those values came from
host detection. The CLI also accepted no interaction-style input, and the
retained evidence has no exact capture timestamp.

Creating those missing facts merely to satisfy `IndependentAdvisoryInput` and
`RawLlmfitFixture` would make the replay look more independent than it was.
Accordingly, the bridge imports the normalization API but its guard does not
call it for this capture. The result is a useful captured oracle plus an
explicit `llmfit.captured-replay.independent-input-incomplete` blocker—not a
normalized candidate list.

## Exact retained hashes

| File | SHA-256 |
|---|---|
| `pin.json` | `d531913f5551b6bf08ff25594771c96c8ddf55fa1933e45482ec94496fb556c4` |
| `raw-system.json` | `084d04697ee99312fcf690a553c79ce6760f9cd5175ff47434aaca5fbc0d9cd7` |
| `raw-recommend-coding.json` | `994b9fbb44eca28316af1ce983d5e1851339555f124dce5c81d54486a59ae60d` |
| `raw-exit-codes.json` | `3e15ac82119994f0752a7d871073c94a8b1b879764ec9bd39ca02468d72651ed` |
| `raw-invalid-enums-exit.json` | `7353a48fe194d47dc1278001aba6558a999bf25052f29f51c75a5c722e047390` |

## Reproduce

```powershell
npx.cmd tsx research/llmfit/replay/cli.ts
npx.cmd tsx research/llmfit/replay/cli.ts --json
npx.cmd tsx --test research/llmfit/replay/bridge.test.ts
```

The human output lists every missing or host-derived fact. JSON mode emits the
same ledger, exact hashes, captured candidate summaries, normalization status
and conclusion as a machine-readable report.

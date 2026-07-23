# M-B llmfit provider audit

Status: non-production checkpoint evidence. This audit does not authorize an
M-B implementation, change ranking policy, replace Local Arcade fit math, or
resolve the website deployment decision.

## Outcome

The evidence supports proposing the pinned `llmfit-core` Rust crate behind a
Local Arcade-owned adapter for the first M-B implementation spike. That
production integration form still requires the owner/checkpoint decision in
the final section; this research does not select it. Any approved spike must
pin the repository and commit exactly, retain the MIT notice, pass explicit
Local Arcade hardware/task/context input, and emit a Local Arcade advisory
envelope that attributes every estimate to llmfit.

Do **not** adopt `llmfit recommend --json` as the production contract. It is a
useful black-box replay oracle, but it is not a sufficiently controlled
provider boundary:

- it always runs native hardware detection before applying partial overrides;
- its recommendation path scans installed providers and local model stores;
- it reads local, embedded-community and localmaxxing measurement sources;
- invalid `min-fit` and `runtime` strings fail open to marginal/all runtimes;
- its output contains family/provider suggestions and composite ordering, not
  immutable artifact or runtime-build identity;
- the CLI JSON vocabulary is intentionally legacy and differs from its shared
  REST serializer.

The direct crate spike should use an empty installed-provider index and an
explicitly selected evidence policy. If exact parity with the CLI is needed for
research, preserve the raw CLI output separately; do not let hidden local
history or provider discovery enter the first-slice advisory result.

The no-install website remains unresolved. A hosted adapter would introduce a
new network/privacy/deployment boundary, while WASM is not an upstream delivery
surface. No website provider should be selected in this checkpoint.

## Verified pin and license

| Fact | Observed evidence |
|---|---|
| Official repository | `https://github.com/AlexsJones/llmfit.git` |
| Release | `v1.1.6` |
| Release commit | `aaa2bc179cec214ccdc44501c853b98fba0b343b` |
| Current `main` observed 2026-07-22 | `3c8c611bad8222430ae6e302ee04ca9501b9d5c9` |
| Workspace/package version | `1.1.6` |
| License | MIT, Copyright (c) 2026 Alex Jones |

The authoritative tag lookup was:

```powershell
git ls-remote --tags https://github.com/AlexsJones/llmfit.git `
  refs/tags/v1.1.6 refs/tags/v1.1.6^{}
```

It returned `aaa2bc179cec214ccdc44501c853b98fba0b343b`. This matters because
`docs/llmfit-core-adoption-audit.md` currently names
`7ba90ce0f14756040db658933bfd5c6ad46ed4ea`, while the earlier research lane
names the correct release commit. The M-B pin must use the tag-resolved commit,
not either document merely because it is newer.

See [pin.json](pin.json), [the retained upstream license](UPSTREAM-LICENSE.txt)
and [source-file hashes captured from the clean tag](raw-source-hashes.json).

## Invocation options

| Option | Boundary and side effects | Decision |
|---|---|---|
| Direct pinned `llmfit-core` Rust dependency | Can accept constructed `SystemSpecs`; adapter can avoid provider discovery and select which estimates enter output. Compilation/vendor policy and upstream API churn remain adapter concerns. | Research recommendation for owner review; not yet selected. |
| Pinned `llmfit recommend --json` subprocess | Strong process/version boundary and easy raw capture, but it detects hardware, probes localhost providers, scans model stores, reads benchmark history and accepts some invalid enums. No request-JSON input exists. | Retain as a replay oracle, not the production contract. |
| `llmfit serve` REST | Adds a long-lived localhost server, port/bind lifecycle and a much broader endpoint surface. It inherits the same hardware/provider/evidence behavior. | Reject for the first desktop slice. |
| PyPI/`uvx` package | The Python package installs a platform Rust binary; it is not an independent Python fit API. | Same semantics as subprocess, with more packaging indirection. |
| WASM/client-side website | No audited upstream WASM delivery surface. Native detection/provider code is not browser-compatible as-is. | Unsupported. |
| Hosted Local Arcade adapter | Could expose the same Local Arcade contract to the website, but sends the request to a service and creates privacy, cost, availability and deployment decisions. | Leave U9 unresolved; do not implement in M-B. |
| Copy/fork formulas | Creates drift and attribution/maintenance burden despite permissive licensing. | Reject unless a later equivalence result identifies a narrow necessary fork. |

Depending on the crate or invoking the binary is MIT-compatible. Copying or
substantially deriving code requires retaining the included copyright and
license notice.

## Read-only probe

The probe compiled the clean tag and ran:

```text
llmfit --version
llmfit --memory 12G --ram 32G --cpu-cores 16 --max-context 16384 system --json
llmfit --memory 12G --ram 32G --cpu-cores 16 --max-context 16384 recommend
  --limit 3 --use-case coding --min-fit marginal --runtime llamacpp --json
```

All user-data locations were redirected under a temporary audit sandbox. All
provider hosts were redirected to an unused loopback port. No benchmark,
download, update, serve, share or GitHub-authentication command ran.

The positive recommendation returned three coding rows. The first observed row
was `bearzi/Qwen3-Coder-Next-oQ8`, `Q2_K`, `Good`, llama.cpp, estimated
35.3 tokens/s, with 9.54 GB required of the simulated 12 GB VRAM. The other two
rows were 3B coding configurations at `Q8_0`. These are upstream advisory
families/configuration hints, not Local Arcade-admitted exact artifacts.

The nominal overrides are not a fully independent dummy hardware input. The
output retained this machine's detected RTX 3060 Laptop GPU name, CUDA backend
and 360 GB/s bandwidth, while replacing VRAM, RAM and core-count fields. A
downstream team therefore cannot assume that the CLI received only the values
named on the command line.

Raw evidence:

- [version output](raw-version.txt)
- [system output](raw-system.json)
- [coding recommendation output](raw-recommend-coding.json)
- [stderr from the coding run](raw-recommend-coding.stderr.txt)
- [exit codes](raw-exit-codes.json)

## Negative probe

The same binary was invoked with:

```text
--min-fit definitely-invalid --runtime definitely-invalid
```

It exited `0` and returned a vLLM recommendation. In v1.1.6,
an unrecognized minimum-fit value becomes `Marginal`, and an unrecognized
runtime retains all runtimes. Local Arcade's adapter must validate its enums
before invoking upstream and return a typed blocked/error envelope instead.

Evidence:

- [invalid-enum output](raw-recommend-invalid-enums.json)
- [invalid-enum stderr](raw-recommend-invalid-enums.stderr.txt)
- [invalid-enum exit record](raw-invalid-enums-exit.json)

## Side-effect boundary observed in source

The upstream CLI describes recommendation as read-only, meaning it does not
intentionally mutate model/provider state. Its execution surface is still
broader than pure arithmetic:

1. `run_recommend` calls `detect_specs`.
2. It calls `InstalledIndex::detect_all`, which queries/scans Ollama, MLX,
   llama.cpp, Docker Model Runner, LM Studio, vLLM and RamaLama.
3. `build_model_fits` loads local benchmark history, embedded llmfit community
   matches and localmaxxing-derived data.
4. It ranks with llmfit's composite score and serializes legacy CLI JSON.

Primary source anchors at the pinned commit:

- [`run_recommend`](https://github.com/AlexsJones/llmfit/blob/aaa2bc179cec214ccdc44501c853b98fba0b343b/llmfit-tui/src/main.rs#L1360-L1497)
- [`InstalledIndex::detect_all`](https://github.com/AlexsJones/llmfit/blob/aaa2bc179cec214ccdc44501c853b98fba0b343b/llmfit-core/src/analysis.rs#L53-L111)
- [`build_model_fits` evidence inputs](https://github.com/AlexsJones/llmfit/blob/aaa2bc179cec214ccdc44501c853b98fba0b343b/llmfit-core/src/analysis.rs#L156-L198)
- [CLI/shared JSON vocabulary distinction](https://github.com/AlexsJones/llmfit/blob/aaa2bc179cec214ccdc44501c853b98fba0b343b/llmfit-tui/src/display.rs#L781-L813)
- [invalid filter fallbacks](https://github.com/AlexsJones/llmfit/blob/aaa2bc179cec214ccdc44501c853b98fba0b343b/llmfit-tui/src/main.rs#L1400-L1431)
- [MIT license](https://github.com/AlexsJones/llmfit/blob/aaa2bc179cec214ccdc44501c853b98fba0b343b/LICENSE)

## Proposed provider contract decision for owner review

Approve only this narrow decision:

> M-B initially integrates `llmfit-core` v1.1.6 at
> `aaa2bc179cec214ccdc44501c853b98fba0b343b` as an attributed advisory
> provider behind a Local Arcade-owned contract. The adapter accepts explicit
> hardware, task and context input; disables implicit installed-provider
> influence; preserves raw upstream results for proof; rejects unknown inputs;
> never admits artifacts, emits verification eligibility, or supplies final
> portfolio ordering. Existing Local Arcade fit remains active until
> equivalence tests are reviewed.

Still requiring product-owner/checkpoint approval:

- direct crate versus subprocess as the production desktop distribution choice;
- whether local/community/calibration sources are allowed in the M-B advisory;
- the exact subset of upstream model-family fields consumed;
- website local-versus-hosted execution (U9);
- upgrade cadence beyond the pinned release;
- whether the CLI's composite order is retained only as a research baseline.

## Reproduce

From `G:\LocalArcade`:

```powershell
powershell -ExecutionPolicy Bypass -File `
  research\llmfit\provider-audit\probe.ps1
```

The script verifies the exact revision, builds with `--locked`, redirects
provider/user-data paths, records raw stdout/stderr and removes only its own
checked scratch directories. Output values remain host-dependent because
upstream CLI hardware detection precedes the partial overrides.

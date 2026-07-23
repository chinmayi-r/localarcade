# M-B llmfit advisory research checkpoint

Status: non-production evidence. This directory does not change Local Arcade
ranking, select a production integration form, or demonstrate that Local
Arcade ranks better than llmfit.

## What the lanes prove

| Lane | Demonstrated | Not demonstrated |
|---|---|---|
| `provider-audit/` | Official `v1.1.6` pin, MIT license, clean locked build, retained CLI outputs, exit codes, source hashes and observed fail-open enum behavior. | A pure explicit-input provider boundary or a selected production distribution. |
| `normalization/` | Exact/lossy/unsupported/unavailable semantics for synthetic contract fixtures, full request binding, raw attribution and ignored-score ledger. | A captured result eligible for normalization or a production adapter. |
| `replay/` | Exact integrity of five retained files, exit-code evidence, system-echo comparison and fail-closed refusal to invent missing independent inputs. | Cryptographic execution attestation or a normalized captured candidate. |
| `equivalence/` | Executable agreement, disagreement and unrepresentable comparison shapes against the exact pinned source identity. | General equivalence, ranking superiority or captured upstream equivalence. |
| `production-contract/` | Provider-neutral Local Arcade request/envelope validation and a fail-closed M-B → M-F crosswalk blocker. | A live Rust-to-TypeScript transport or an M-C-verified family crosswalk. |

The isolated implementation spike is documented in
[`crates/llmfit-adapter/README.md`](../../crates/llmfit-adapter/README.md).
It calls the pinned pure formula path from explicit inputs, but remains outside
the runner because upstream's unconditional dependency surface conflicts with
the runner's current zero-HTTP-client boundary.

The retained CLI probe returned real upstream advisory output, but the CLI
mixed explicit overrides with host detection and local provider/evidence
discovery. It is therefore a replay oracle, not an approved Local Arcade
provider contract.

## Canonical gate

From `G:\LocalArcade`:

```powershell
npm.cmd run proof:mb
```

The command validates retained evidence, runs every normalization,
equivalence, replay and production-contract test, then formats, lints and tests
the pinned isolated Rust provider. The production root and runner checks remain
separate gates.

## Owner decision needed before implementation

The direct pinned spike and formula-only evidence policy are approved. Before
linking it into a shipped application, resolve the unconditional upstream
HTTP/provider/update dependency surface and embedded-data licensing. Website
execution remains a separate U9 decision.

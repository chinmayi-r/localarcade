# First-slice shared contracts

Status: **Product-owner-approved first-slice contract v1**, 2026-07-22. These fields, enums, semantics, fixtures, and version govern M-A. They do not prove that current TypeScript or Rust implementations already conform.

## Files

- [`local-arcade-first-slice-v1.schema.json`](local-arcade-first-slice-v1.schema.json): JSON Schema 2020-12 envelope and fourteen contract IDs, including the additive U25 admission receipt and U28 runner import bundle.
- [`fixtures/`](fixtures/): valid golden envelopes referenced by the screen contract.
- [`current-type-mapping.md`](current-type-mapping.md): compatibility map and required adapters for existing TypeScript and Rust types.
- [`compatibility-report.md`](compatibility-report.md): exact field/enum comparison and owner decisions.
- [`validate-fixtures.mjs`](validate-fixtures.mjs): reproducible Draft 2020-12 positive/negative fixture validation.

## Approved contract IDs

| Contract ID | Purpose | First-slice producer → consumer |
|---|---|---|
| `hardware-target` | Manual or detected owned-hardware target | W1/M-D → recommendation; D2/M-D → verification |
| `recommendation-request` | Novice task/preferences compiled to explicit context and constraints | W1/M-O → M-H |
| `exact-configuration-candidate` | Immutable artifact plus complete runtime/settings identity | M-C/M-E → M-F/M-H/W3 |
| `fit-evidence-assessment` | Fit, performance envelope, evidence scope, blockers and provenance | M-F/M-G → M-H/W2/W3 |
| `recommendation-portfolio` | Fail-closed role-labeled result set or a common non-ok envelope | M-H/M-O → W2 |
| `runner-handoff` | Versioned, previewable website-to-runner bundle with no model payload | W4/M-O → D1/M-O |
| `benchmark-plan` / `benchmark-result` | Exact performance/stability protocol and separate measurement series | M-J/M-O → D3/D5/C5 |
| `quick-check-plan` / `quick-check-result` | Separate mechanical-task protocol and per-check evidence | M-J/M-O → D3/D5/C5 |
| `verification-plan` / `verification-result` | Higher-level references to the independently typed plans/results | M-J/M-O → D3/D5/C5 |
| `compatibility-admission-receipt` | Versioned M-E admission decision bound to exact candidate, runtime, OS/architecture, package facts and source assertion | M-E → M-J/M-O |
| `runner-import-bundle` | Separately versioned, canonically hashed import object containing the unchanged v1 handoff and its exact M-E admission receipt | M-O → desktop import/M-J |

All contracts use the approved `ok`, `unavailable`, `blocked`, `partial`, or `error` use-case envelope. `partial` retains contract-typed data plus explicit completeness, missing portions, warnings, and recovery actions. Domain run outcomes remain inside typed data. Public contribution, battle/vote/rating, upload, and public-service contracts are excluded.

## Approved versioning rules

- `schemaVersion` is `1` for this approved slice.
- Contract IDs are stable strings. A breaking field/enum/meaning change requires schema version 2 and migration fixtures.
- IDs are opaque strings; prefixes aid diagnostics but are not authorization or proof.
- Byte counts are non-negative integers. Hashes use lowercase 64-character SHA-256 where an exact artifact is required.
- Unknown optional evidence stays absent or `null` only where the schema permits it. Implementations must not invent defaults to satisfy the schema.
- Producers may not emit fields outside the schema. Consumers must fail closed on unknown contract/status values and may tolerate a higher version only through an explicit adapter.

## Validation

Run from the repository root:

```powershell
npm.cmd run contracts:validate
```

The command compiles the Draft 2020-12 schema, validates every positive JSON
fixture, checks cross-field portfolio/handoff invariants, and proves rejection
of twelve fixtures under `fixtures/invalid/`: unsupported schema version,
invalid origin/priority enums, missing required task, malformed artifact hash,
unknown result fields, duplicate portfolio families, invalid handoff expiry,
untyped partial data, an empty verification plan, and the rejected legacy
combined-sample shape, and a non-admitted compatibility decision. Receipt
semantic negatives additionally prove assertion/target and required-package
bindings fail closed. Runner-import semantic negatives prove forward bundle
versions and candidate/artifact/runtime mismatches fail closed while the nested
`runner-handoff` v1 remains unchanged. Receipt-only content drift also
invalidates the bundle-level canonical hash. Existing
root/runner tests remain separate acceptance evidence; these fixtures become
implementation tests only in a future approved M-A checkpoint.

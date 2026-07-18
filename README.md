# Local Arena

A working product prototype for blind local-model comparisons joined with reproducible real-device performance evidence.

## What is implemented

- Instant voting over precomputed, anonymous outputs
- Device-fleet and artifact-level result presentation
- An honest distinction between demonstration and published data
- Consent-first runner positioning and early-access interaction
- Responsive, keyboard-accessible interface
- Type checking, linting, product-contract tests, production build, dependency audit, and CodeQL in CI

## Local verification

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run check
```

## Definition of done

A change may merge only when it has a concrete user outcome, tests that would fail if the outcome regressed, no invented production claims, no new high-severity dependency findings, and a passing production build. Branch protection should require both `CI / verify` and `CodeQL / analyze`.

## Product boundary

This repository is the public preference and reporting surface. A compute runner must live in a separate repository and release process because it executes untrusted model artifacts on contributor hardware. See [SECURITY.md](SECURITY.md) before designing it.

## Recommendation policy

The recommendation and benchmarking branches are specified in [the recommendation decision system](docs/recommendation-decision-system.md). The executable policy fails closed on unknown states, and its tests enumerate all declared state combinations so new branches cannot be added without defined behavior.

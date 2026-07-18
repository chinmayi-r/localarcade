# Local Arena

A browser-application prototype for matching exact local-model configurations to hardware and tasks, with an optional future evidence network.

## What is implemented

- Hardware, context and task configuration
- Swappable Balanced, Quality, Fastest, Long Context and Lightest strategies
- Memory eligibility filtering and model-family deduplication
- An honest distinction between prototype catalog data and published evidence
- Responsive, keyboard-accessible application shell
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

Implementation guidance for changing the catalog, memory model or sorting methods lives beside the engine in [lib/recommendation/README.md](lib/recommendation/README.md).

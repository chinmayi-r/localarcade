# Milestone status

This is an audited state ledger, not a roadmap. Update a row only after checking the milestone's acceptance and forbidden clauses in `agent-plan.md`. Every implementation checkpoint begins from this file.

| Milestone | Status | Evidence | Remaining before completion |
|---|---|---|---|
| M-1 — Evidence foundation | Complete | Evidence types, scope policy and fail-closed contract tests landed in `1426c86`; full gate suite subsequently remains green. | None. |
| M0 — Trusted CI hardening | Complete | Pinned CodeQL, dependency review, Scorecard, Harden Runner, Dependabot, security ledger and zero-data test landed in `6859a07`; no floating `@v` action tags; full gate suite green. | Hosted workflow runs will provide operational confirmation once this source is mirrored to GitHub, but the repository acceptance clauses are satisfied. |
| M1 — Artifact registry | Complete | Trusted-publisher Hub discovery pins 35 repository revisions; deterministic bulk admission produces 451 artifacts across 27 families with complete field provenance and quarantines 426 invalid/unsupported records. Two consecutive ingests produced SHA-256 `1F9BFF8DAC8B8E8D6A009EC7A0205E65C134F34A7CF073B95608BC51E474FC04`; importer, schema, provenance, scale, quarantine and production-boundary tests pass. | None. Generated data remains beside the production demo catalog until M4, as required. |
| M2 — Fit math | Complete | Pure byte-level `fit()` module with explicit weights, K/V profiles, runtime buffers, OS/display reserves and safety margin; 10 sourced llama.cpp allocation-log goldens plus monotonicity, physical-bound, breakdown, mixed-K/V, fail-closed and purity tests. Full gate suite passes with no production consumer wiring. | None. Runtime-specific profiles for registry artifacts are M4 integration data, not M2 arithmetic. |
| M3 — Throughput priors | Not started | Existing seeded speed values are explicitly prototype data. | Entire milestone. |
| M4 — Engine on real data | Not started | Production still imports the demo catalog. | Entire milestone. |
| M5 — Evidence UI | Not started | Prototype labels exist, but compile-enforced evidence-bearing display numbers and A-tree coverage are incomplete. | Entire milestone. |
| M6 — Freshness | Not started | No scheduled catalog freshness gate. | Entire milestone. |
| M7 — Localhost middle tier | Not started | No localhost benchmark UI. | Entire milestone. |
| M8 — Runner threat model | Not started | Threat-model gate remains closed; no download/execution feature is authorized. | Entire milestone plus human sign-off. |
| M9 — Battles model | Not started | Feature remains absent/off. | Entire milestone. |

## Current checkpoint

**Completing M2 — Fit math library: closed.** The next implementation checkpoint is **Completing M3 — Sourced throughput priors**; no M3 work has started.

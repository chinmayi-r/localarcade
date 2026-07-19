# Milestone status

This is an audited state ledger, not a roadmap. Update a row only after checking the milestone's acceptance and forbidden clauses in `agent-plan.md`. Every implementation checkpoint begins from this file.

| Milestone | Status | Evidence | Remaining before completion |
|---|---|---|---|
| M-1 — Evidence foundation | Complete | Evidence types, scope policy and fail-closed contract tests landed in `1426c86`; full gate suite subsequently remains green. | None. |
| M0 — Trusted CI hardening | Complete | Pinned CodeQL, dependency review, Scorecard, Harden Runner, Dependabot, security ledger and zero-data test landed in `6859a07`; no floating `@v` action tags; full gate suite green. | Hosted workflow runs will provide operational confirmation once this source is mirrored to GitHub, but the repository acceptance clauses are satisfied. |
| M1 — Artifact registry | In progress | Registry contracts (`935af8b`), pinned Hub importer (`a192d49`) and runtime-neutral artifact separation (`9d28bee`) exist beside the demo catalog. | Replace per-file manifest with trusted-publisher discovery and bulk admission; add base model, chat template and field-level provenance; deterministic `npm run ingest`; quarantine individual failures; admit at least 40 artifacts across 8 families; audit every M1 acceptance and forbidden clause. |
| M2 — Fit math | Not started | Existing prototype memory arithmetic is production-ineligible and does not satisfy M2. | Entire milestone. |
| M3 — Throughput priors | Not started | Existing seeded speed values are explicitly prototype data. | Entire milestone. |
| M4 — Engine on real data | Not started | Production still imports the demo catalog. | Entire milestone. |
| M5 — Evidence UI | Not started | Prototype labels exist, but compile-enforced evidence-bearing display numbers and A-tree coverage are incomplete. | Entire milestone. |
| M6 — Freshness | Not started | No scheduled catalog freshness gate. | Entire milestone. |
| M7 — Localhost middle tier | Not started | No localhost benchmark UI. | Entire milestone. |
| M8 — Runner threat model | Not started | Threat-model gate remains closed; no download/execution feature is authorized. | Entire milestone plus human sign-off. |
| M9 — Battles model | Not started | Feature remains absent/off. | Entire milestone. |

## Current checkpoint

Process correction only: checkpoint protocol and audited status ledger. The next implementation checkpoint is **Completing M1 — Versioned artifact registry + ingestion**.

# lib/battles

Dark (feature-flagged off) data model and rating math for bucket-scoped blind battles. See `docs/decision-tree.md` Tree D for the product contract this implements.

- `types.ts` — pair, vote and rating-table shapes. Response and experience battles are separate kinds and are never pooled.
- `validation.ts` — fail-closed admission: incomplete generations (DNFs) are stability results, not battles; unknown enums are rejected.
- `policy.ts` — the editable product policy: voter-class weights, the D8 live threshold, bootstrap and solver settings.
- `rating.ts` — weighted Bradley–Terry (Hunter's MM iteration; the Chatbot Arena methodology, arXiv:2403.04132) with deterministic seeded-bootstrap confidence bands. Below the vote threshold the table is `collecting` and entries are provisional only.
- `flag.ts` — `battlesEnabled = false`. Production must not import this package while dark; `tests/battles-boundary.test.mjs` enforces that.

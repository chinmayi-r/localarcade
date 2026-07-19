# Decisions

## 2026-07-19 — Pin discovery separately from deterministic admission

- **Decision:** Hugging Face discovery is a mutable, explicit operation governed by an editable trusted-publisher policy. It produces a revision lock; deterministic ingestion consumes only that lock and atomically publishes a fully validated snapshot.
- **Why:** Broad discovery and reproducible builds are different jobs. Separating them prevents upstream catalog movement or partial refresh failures from changing or erasing the last valid artifact registry.
- **Reversible:** Yes. Publishers, discovery ordering and upstream adapters remain data/module choices; admitted artifact identity remains stable.

## 2026-07-19 — Quarantine unsupported GGUF packages in M1

- **Decision:** M1 admits standalone GGUF artifacts and quarantines split packages, projector/helper files, unknown filename quantizations and records missing required evidence. Every admitted artifact stores the parsed chat template and field-level provenance.
- **Why:** Split packages need package-level identity and install semantics that the M1 artifact schema does not yet represent. Inventing or silently inferring missing values would violate the evidence contract.
- **Reversible:** Yes. A later schema version can admit package manifests without changing existing standalone identities.

## 2026-07-19 — Require explicit milestone checkpoints

- **Decision:** Every milestone transition begins with a user-visible scope checkpoint and ends with an audited status update. Adjacent milestones may be batched only when each has separately listed work and gates.
- **Why:** The product owner wants autonomous progress without reviewing tiny increments, while retaining a clear account of what each milestone includes and preventing out-of-order implementation.
- **Reversible:** Yes. The checkpoint format can evolve without changing product data or APIs.

## 2026-07-19 — Separate products, engines and artifact packages

- **Decision:** Local Arcade supports multiple local-model products and engines. Ollama, LM Studio, Jan, llama.cpp, MLX LM and vLLM are modeled as distinct products/routes; engines and exact builds remain separate configuration identity.
- **Why:** The product owner explicitly confirmed multi-runtime support. A GGUF file, a desktop app and an inference engine are not interchangeable, and compatibility changes by build, backend and package layout.
- **Reversible:** Yes. Products and adapters can be added or retired without changing artifact identity.

## 2026-07-19 — Imported artifacts are an evidence cache, not a recommendation allowlist

- **Decision:** Use broad scheduled discovery, strict immutable admission and on-demand resolution. Model-level ranking may cover releases before every artifact variant is cached, but exact size/hash/install/compatibility claims require a resolved admitted artifact. Metadata-only candidates remain unranked when comparative evidence is missing.
- **Why:** Hand-authoring one manifest row per artifact cannot cover hundreds of models. Live upstream requests in the page path would be slow and fragile. Separating discovery, admission and evidence preserves coverage without inventing certainty.
- **Reversible:** Yes. Discovery sources and admission policies are replaceable modules.

## 2026-07-19 — Use tobacco brown for the primary finder action

- **Decision:** The finder action uses `--la-tobacco` rather than the palette's green primary convention. Hover brightens the same brown and does not reuse rust/error semantics.
- **Why:** Explicit product-owner visual direction.
- **Reversible:** Yes.

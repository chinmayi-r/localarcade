# Decisions

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

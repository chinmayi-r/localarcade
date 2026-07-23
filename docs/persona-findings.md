# Persona walkthroughs

Standing practice (product-owner directive, 2026-07-20): after every feature, simulate users of varying local-LLM competence through the *real* code paths, record findings, fix the cheap ones immediately, backlog the rest. The runnable harness for the website engine is `scripts/persona-walkthrough.ts`.

## Personas

| Persona | Competence | Setup |
|---|---|---|
| **Priya** | Total newcomer — heard about local AI yesterday; VRAM/GGUF mean nothing | 16 GB office laptop, Intel iGPU only |
| **Marcus** | Casual intermediate — LM Studio user, knows "7B Q4" folklore, not KV cache | Gaming PC, RTX 4060 Ti 8 GB |
| **Ravi** | Power user — llama.cpp + llama-swap, tunes `-ngl`/context, distrusts benchmarks | RTX 3060 Laptop 6 GB (mirrors the product owner's rig) |

## Pass 1 — website finder (2026-07-20)

| Persona | Simulated result | Verdict |
|---|---|---|
| Priya | Unranked shortlist with one honest CPU option (Llama 3.2 1B) | Thin but honest; survivable |
| Marcus | **"Nothing fits"** despite a capable 8 GB GPU | **Product-killing** — blamed his machine for our missing GPU coverage; he closes the tab |
| Ravi | Same false "nothing fits" | He concludes the tool is a toy |

**Fixed immediately:** new `no-coverage` engine outcome + "COVERAGE GAP — NOT YOUR MACHINE" UI state; a platform with zero catalog candidates is now told the gap is ours. Golden + render tests added.
**Backlogged:** actual GPU fit profiles (the real cure) — arrives via measured evidence; until then GPU users get the honest gap message.

## Pass 2 — runner detect / scan / benchmark (2026-07-20)

| Persona | Simulated result | Verdict |
|---|---|---|
| Priya | Detect works; scan reports empty stores with no next step; benchmark asks for an "engine folder" she cannot have | Dead ends |
| Marcus | Detect reconciles his 4060 Ti; scan finds his LM Studio GGUFs but everything reads "not in the artifact registry" (lmstudio-community isn't whitelisted); no llama-bench → benchmark unusable | Deflating copy; benchmark gap by design |
| Ravi | Full path works: detect Known, scan finds all three models, and benchmark returns local measurements. The first live run reported 228 t/s prompt / **4.3 t/s** generation; a controlled rerun on the same build/model later produced 61.4 t/s at `-ngl -1` and 79.9 t/s at `-ngl 99`, proving the original result was anomalous rather than evidence that default offload was CPU-bound. | Useful path, but a single run can be misleading until preflight and repeatability checks land. |

**Fixed immediately:** scan empty state now points to the website + future guided setup; benchmark copy states the llama.cpp requirement and that defaults ≠ tuned flags (exact config is displayed with results).
**Backlogged:**
1. Benchmark should expose the full tested configuration and add preflight/repeatability handling. Importing a serving configuration remains useful for apples-to-apples comparison, but is not the explanation for the original 4.3 t/s anomaly: this build defaults to full offload (`-ngl -1`).
2. Registry publisher-policy review: `lmstudio-community` and `ggml-org` repos (Marcus's and the product owner's actual files — gemma-3-4b-it and Qwen3-4B-Instruct-2507 had no identity match).
3. Newcomer mode: hide/soften the benchmark section when no engine is detected; plain-language identity line.

## Pass 3 — runner deterministic task checks (2026-07-20)

The retired browser task definitions now run directly through the selected existing `llama-cli`, without a localhost server. Real validation on Qwen3-4B-Instruct-2507 Q4_K_M + llama.cpp b10061 produced two passes and one exact-format miss caused by added trailing spaces. The runner reports those three mechanical outcomes individually and makes no general-quality claim. The first live attempt also exposed a Windows stdout-pipe deadlock; concurrent draining fixed it and the live suite now completes.
4. Investigate `llama-fit-params.exe` (present in llama.cpp b10061) as a sourced fit-profile generator — could unlock GPU coverage for the website with measured data.

## Live measurements captured during pass 2 (this machine, RTX 3060 Laptop 6 GB, llama.cpp b10061 CUDA)

Qwen3-4B-Instruct-2507 Q4_K_M, llama.cpp b10061 CUDA, KV f16: the initial run produced prompt 175.8–228.2 t/s and generation 4.3–4.5 t/s. A 2026-07-20 controlled rerun (64 prompt / 16 generation tokens, one repetition) produced 884.1 / 61.4 t/s at `-ngl -1` and 1069.2 / 79.9 t/s at `-ngl 99`. These short reruns are diagnostic rather than publishable benchmark evidence, but they falsify the claim that `-ngl -1` omitted GPU offload and show why one run must not be treated as a stable machine baseline.

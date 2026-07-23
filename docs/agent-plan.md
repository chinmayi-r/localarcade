# LocalArcade — Agent Execution Plan

This document is written to be handed to an autonomous coding agent (of any capability tier) with the instruction: **"Execute the next unfinished milestone. Follow this document exactly."** It is designed so that a weaker model produces safe, correct, small increments, and a stronger model produces the same increments faster with better internals. The plan is the contract; the gates are the judge.

## 0. Agent contract (read first, every session)

1. Read [decision-tree.md](decision-tree.md) before writing any code. It defines every branch, evidence class, and honest-failure state. Node IDs in that file (`A1`, `B5X`…) are referenced below and in code comments.
2. **Definition of done is mechanical, not judgment:** a milestone is done when every acceptance command in its section exits 0 and every "Forbidden" line remains true. Nothing else counts as done. You may never edit a gate, test threshold, or acceptance criterion to make it pass — if a gate seems wrong, stop and ask (see §1).
3. Work on a branch named `m<N>-<slug>`. Commit in small conventional-commit increments. Run the full gate suite before declaring done.
4. The gate suite = the `typecheck`, `lint`, `test`, and `build` scripts in `package.json`. Verify their exact names by reading `package.json`; do not assume. If any is missing, creating it is part of M0.
5. **Never fabricate data.** No invented benchmark numbers, no placeholder scores presented as real, no demo values without a `demo`/`estimated` marker enforced in types. Empty states are designed states — render them.
6. Log every non-trivial decision you made without asking in `docs/DECISIONS.md` (date, decision, why, reversible? yes/no). This is how the human audits a 5-hour unattended run.
7. Session end: summarize what changed, what's green, what's not, and the exact next action.
8. **Checkpoint before implementation:** before starting or advancing milestone work, post the checkpoint required by root `AGENTS.md`. It names every included milestone and lists its deliverables, exclusions, gates, and stop conditions. No milestone code is written before that checkpoint.
9. **Status is audited:** read and update `docs/MILESTONE-STATUS.md`. A milestone changes to `complete` only after every acceptance and forbidden clause is checked against repository evidence and the full gate suite passes.
10. **Batching is explicit:** adjacent milestones may be worked in one session, but each remains an independently gated scope inside the checkpoint. Never use batching to bypass milestone order or let unfinished earlier data flow into later production code.

## 1. Ambiguity protocol

- Instruction conflicts with a Global Invariant (§2) → **stop and ask.** Invariants win over this plan.
- Detail unspecified, choice **reversible** (naming, file layout within the stated module, minor UI copy) → choose the simplest option consistent with existing code style, log it in `DECISIONS.md`, continue.
- Detail unspecified, choice **hard to reverse** (schema shape, public API, new dependency, anything touching security or consent) → **stop and ask** with a concrete recommendation and 2–3 options.
- A referenced URL/API doesn't match reality → do not improvise around it; verify against the live source, note the discrepancy in `DECISIONS.md`, and if the fix isn't obvious, ask.

## 2. Global invariants (never violated by any milestone)

- I1 **Evidence typing:** every user-visible number carries `estimated | community | verified | preference` provenance, enforced at the type level. A bare number in a card component must not compile.
- I2 **No unbacked ordering:** if evidence can't support ranking, output the unranked compatible shortlist (decision-tree A6X).
- I3 **Dedupe + roles:** top-5 = five model families, role-labeled; quant/runtime variants nest inside cards.
- I4 **Artifacts are runtime-neutral; products and engines are separate.** Local Arcade supports llama.cpp, Ollama, LM Studio, Jan, MLX LM and vLLM through versioned compatibility/install adapters. Reproducible benchmark baselines may use pinned canonical engines, but no recommendation may silently treat an app, engine and artifact package as the same thing or depend exclusively on one third-party app.
- I5 **No signup, no telemetry, no upload without explicit per-action consent.** Consent language is tested (the product-contract tests must keep passing).
- I6 **Fail closed:** unknown states in the policy layer block the action with a reason; they never fall through to a default.
- I7 **Security-sensitive workflows are copied from Tier-1 sources, pinned, and attributed (§3). Hand-written security code carries a warning header and is listed in `docs/SECURITY-LEDGER.md`.**
- I8 **No model download/execution features ship before M8's threat-model gate is met.**
- I9 Source trust tiers from decision-tree.md §"Source trust policy" govern all external data and code.

## 3. Security & CI policy — copy from trusted, label the rest

The standing rule, in priority order:

1. **Copy from a Tier-1 source when one exists.** Tier-1 for workflows/config = official GitHub/OpenSSF/vendor-published templates with many eyes:
   - CodeQL: GitHub's default setup / official starter workflow from `github/codeql-action` docs.
   - Dependency review: `actions/dependency-review-action` (official example config).
   - OpenSSF Scorecard: `ossf/scorecard-action` official workflow.
   - Runner hardening: `step-security/harden-runner` (audit mode first).
   - Dependabot: GitHub's documented `dependabot.yml` for npm + github-actions ecosystems.
   - Next.js security headers / CSP: copy the pattern from official Next.js docs, not from blogs.
   - (Later, runner project) release signing: Sigstore `cosign` official docs; SLSA provenance via the official `slsa-github-generator`.
   When copying: pin every third-party action **by full commit SHA** (not tag), keep a comment with the source URL + date copied, and record the file in `docs/SECURITY-LEDGER.md` under "copied".
2. **If no trusted template exists** and security-relevant code must be hand-written: top-of-file header `// ⚠ HAND-WRITTEN SECURITY-SENSITIVE CODE — not from a vetted template. Review before trusting.` plus an entry in `SECURITY-LEDGER.md` under "hand-written, needs review". The ledger is the human's audit queue.
3. **Never** disable, downgrade, or `continue-on-error` a security gate to get green. A red security gate is a stop-and-ask.

## 4. Milestones

Execute in order unless the human says otherwise. Each is independently shippable.

### M-1 — Evidence and evaluation foundation
**Goal:** pin what an observation means before any registry, ranking, runner, or battle code depends on it.
**Steps:** read `docs/evidence-evaluation-contract.md`; implement orthogonal evidence types and a pure metric-scope policy; encode that response/task evidence may pool across hardware while fit/performance/stability/energy/experience evidence may not; add exhaustive tests. Document installed-only, one-candidate, public synthetic queue, and private-fleet benchmark-pack routes plus novice, practical-user, evaluator, creative, and enterprise journeys.
**Accept:** the typecheck and evidence-contract tests pass; every declared metric has exactly one scope policy; invalid combinations fail closed; no product component consumes the new module yet.
**Forbidden:** downloads, execution, scanning, uploads, persistence, background jobs, battle UI, changing prototype rankings, or presenting any new number to users.

### M0 — Trusted CI hardening + gate completeness
**Goal:** every gate exists, and all security workflows come from Tier-1 templates.
**Steps:** read `package.json` and existing `.github/workflows/`; add any missing gate script; copy in (per §3) CodeQL, dependency-review, Scorecard, harden-runner (audit), `dependabot.yml`; pin all actions by SHA; create `docs/SECURITY-LEDGER.md` and `docs/DECISIONS.md`; add an **empty-state e2e check** (app boots with zero data → estimator, leaderboard-less pages render their designed empty states, no placeholder junk).
**Accept:** gate suite exits 0; all workflows reference SHAs (grep shows no `@v`-style floating tags on third-party actions); `SECURITY-LEDGER.md` lists every workflow with source URL; empty-state check runs in CI.
**Forbidden:** touching product features; writing any custom security scanning logic.

### M1 — Versioned artifact registry + ingestion
**Goal:** replace nothing yet — build the sourced catalog *beside* the demo one.
**Steps:** define the artifact record (see decision-tree + Codex's schema in `docs/recommendation-decision-system.md` if present): repo, revision, filename, sha256, bytes, quantization, base model, license, context, chat template — every field with source URL + retrieval timestamp. Artifact identity is runtime-neutral; compatibility and install routes are separate sourced records. Write a discovery + ingestion pipeline for the HF Hub API restricted to a whitelist file of trusted quantizer orgs (start: `bartowski`, `unsloth`, `mradermacher` + official model orgs; whitelist is data, editable). Discovery is broad and mutable; admission pins each repository revision, enumerates eligible artifacts in bulk, and quarantines individual invalid records without discarding the last good snapshot. Ingest ≥40 artifacts across ≥8 model families. Validation: schema-check every record; reject records missing hash or license.
**Accept:** `npm run ingest` (new script) produces/updates the registry deterministically; a test proves every record has provenance fields; gate suite green.
**Forbidden:** wiring the UI to it; scraping HTML (use the documented Hub API); inventing any field value.
**Refs:** HF Hub API docs (https://huggingface.co/docs/hub/en/api), GGUF spec in llama.cpp repo.

### M2 — Fit math library
**Goal:** pure, property-tested memory/fit computation.
**Steps:** implement `fit(artifact, hardware, context, kvQuant) → {fits, requiredBytes, breakdown}` covering weights + KV cache + runtime/compute buffers + OS/display reserve + safety margin. Property tests (e.g. required memory monotonically increases with context; no accepted input yields fits=true with required > physical). Golden files for ~10 known configs cross-checked against llama.cpp's own memory reporting where documented.
**Accept:** property + golden tests pass; module has zero I/O imports.
**Forbidden:** estimating speed here; UI changes.

### M3 — Sourced throughput priors
**Goal:** the estimates table, every row cited.
**Steps:** seed per accelerator-family × artifact-size-band tok/s + TTFT **ranges** from Tier-1/Tier-2-verified sources; strongly prefer importing LocalScore's opt-in public results (with attribution + retrieval date) over hand-collecting. Interpolation by memory bandwidth allowed but must widen the range and mark `LOW CONFIDENCE`. Unknown hardware → no point estimates (decision-tree A4X).
**Accept:** a test walks the priors table and fails on any row lacking a source URL; unknown-GPU golden file shows range-only output.
**Forbidden:** blending Tier-2 numbers without the tier tag; any point estimate for unmeasured hardware.

### M4 — Engine on real data
**Goal:** strategies consume registry + fit + priors; demo catalog dies.
**Steps:** wire `lib` engine to M1–M3 outputs; implement role-labeled top-5, family dedupe, unranked-shortlist path, contradictory-preference messaging (A6); delete the demo catalog or fence it behind test fixtures only.
**Accept:** golden-file suite covering: unknown GPU, nothing-fits, contradictory prefs, tie, dedupe, shortlist-not-ranking; gate suite green; grep proves no import of the demo catalog from production code.
**Forbidden:** new visual design work beyond what data changes force.

### M5 — Estimator UI on evidence badges
**Goal:** the website tells the truth about every number.
**Steps:** evidence-class types flow to components (I1 becomes compile-enforced); cards show collapsed/expanded per the field table in decision-tree Tree A; "catalog updated N hours ago" surfaced; "request this configuration" stub records requests locally (no backend requirement yet — a queue file/endpoint choice is a stop-and-ask if unclear).
**Accept:** a type-level test (expect-error style) proving a badge-less number fails compilation; e2e over A-tree edge states; gate suite green.

### M6 — Freshness pipeline
**Goal:** the catalog cannot silently rot.
**Steps:** make ingestion runnable on schedule (CI cron workflow copied from official GitHub docs template, SHA-pinned); registry carries `lastIngestSucceededAt`; build fails if older than 7 days; new artifacts land in `triage` status, excluded from recommendable set until flagged (fleet smoke-test is future work — for now human promotion via a one-line status edit).
**Accept:** simulated stale timestamp fails the build in a test; triage exclusion covered by a golden file.

### M7 — Localhost middle tier
**Lifecycle note (2026-07-20):** completed as an experiment, then retired from the public website by product-owner direction. Preserve its tested loopback boundary and reusable task definitions, but do not resume product investment without a new explicit decision.
**Goal:** measured quick-tasks with zero install for llama-server users.
**Steps:** browser page that, with explicit user action, calls a user-entered localhost OpenAI-compatible endpoint, runs the deterministic quick-task suite (JSON-schema validity, format constraints, small fact-preservation checks — all mechanically scored client-side), reports speed + task results badged `measured` (hardware stays self-reported → never `verified`). The selected product and engine/build remain part of the configuration identity. Degrade gracefully when unreachable; document product-specific CORS requirements from official sources only.
**Accept:** suite runs against a mocked OpenAI-compatible endpoint in tests; unreachable-endpoint state has a designed UI; no request leaves the browser except to user-entered localhost (test asserts no external calls).
**Forbidden:** proxying user prompts through any server of ours.

### M8 — Runner threat model (docs gate, no code)
**Goal:** the written threat model that unblocks any future download/execute feature (I8).
**Steps:** produce `docs/runner-threat-model.md`: assets, trust boundaries, attack surfaces (malicious artifact, malicious update, exfiltration, resource abuse), mitigations mapped to Tier-1 mechanisms (cosign signing, SLSA provenance, sha256 pinning, sandboxing options per OS), and the explicit list of what the runner will never do. Human review sign-off line at the top; unchecked = gate closed.
**Accept:** document exists, every mitigation cites its source; `SECURITY-LEDGER.md` updated.
**Forbidden:** writing runner code.

### M9 — Battles data model (flagged off)
**Goal:** pairs/votes/per-bucket ratings schema + rating math, dark.
**Steps:** implement pair record (prompt, two configs, outputs, provenance), vote record (type: response|experience, voter class: prompter|third-party with weights), Bradley–Terry/Elo per bucket with CI bands, vote-threshold display rule (D8), all behind a feature flag defaulting off.
**Accept:** rating math unit-tested against hand-computed examples; flag-off build shows no battle UI; gate suite green.
**Refs:** Chatbot Arena paper (arXiv:2403.04132) for the rating methodology.

## 4b. Runner milestones (authorized by the signed-off M8 threat model)

Product-owner decisions of 2026-07-19: **Tauri 2** stack; **no self-update code** — distribution via winget/Homebrew with cosign-signed artifacts and SLSA provenance (see DECISIONS.md). Every runner milestone inherits the threat model's §5 "never" list; each "never" gets a named test as its feature area appears.

### R1 — Tauri skeleton + signed-release pipeline
**Goal:** an installable, signed, do-nothing app with its own gate suite.
**Steps:** scaffold Tauri 2 (workspace `runner/`); runner gate scripts (fmt, clippy, cargo test, web typecheck/lint/test, build); release workflow with cosign signing + SLSA provenance (Tier-1 templates per §3, SHA-pinned); draft winget/Homebrew manifests. No listening sockets, no downloads, no execution.
**Accept:** runner gate suite exits 0 in CI; release workflow produces signed artifacts + provenance on a tag; SECURITY-LEDGER rows added.
**Forbidden:** detection, scanning, downloads, engine execution, telemetry, any network call at runtime.

### R2 — Hardware detection (read-only) + calibration fingerprint schema
**Goal:** exact hardware truth, locally displayed, nothing uploaded.
**Steps:** detect accelerator, VRAM/unified memory, RAM, OS, driver where OS APIs allow; reconcile against `lib/accelerators` (detected unknown device → fail closed to manual, decision-tree B1X); define (not yet run) the calibration-fingerprint record. Display the web-estimator recommendation using detected values, marked `detected` vs the site's `self-reported`.
**Accept:** detection module unit-tested with fixture device data; unknown-device path golden; zero network calls (test-enforced).
**Forbidden:** model downloads/execution; uploads; background anything.

### R3 — Model-store scan (read-only)
**Goal:** inventory of existing GGUF/Ollama/LM Studio artifacts, deduped by hash, per decision-tree Tree F/E1.
**Accept:** scan is consent-gated, read-only (test asserts no writes into stores), unreadable files listed per-file with reasons; results stay local.
**Forbidden:** executing anything found; uploads.

### R4 — First benchmark run (bundled pinned llama.cpp)
**Goal:** the Tree B measured loop on models the user already has (zero-download path first).
**Steps:** bundle a pinned llama.cpp build; sandboxed child per threat-model T7 (Windows GPU sandbox depth is the remaining OPEN — investigate, then stop-and-ask with findings); preflight (power/thermal/load, B4); run TTFT/tok-s/peak-mem/stability + quick-task suite (reuse `lib/quick-test` definitions); results feed the local UI as `verified`; crash = recorded stability result (B5X).
**Accept:** benchmark protocol documented and versioned; results reproducible on same machine ±; "never" tests for T7 boundaries present; still zero network.
**Forbidden:** downloading models (that is R5, with its own consent UX); uploads (that is R6+, with the consent and payload-schema milestone).

## 5. Pinned references (agents: verify before use, never improvise APIs)

| Ref | URL | Tier | Use |
|---|---|---|---|
| llama.cpp | https://github.com/ggml-org/llama.cpp | 1 | canonical runtime, server README, quantize docs |
| HF Hub API | https://huggingface.co/docs/hub/en/api | 1 | ingestion |
| LocalScore | https://github.com/cjpais/LocalScore · https://www.localscore.ai | 1 | benchmark protocol, seed priors |
| CodeQL action | https://github.com/github/codeql-action | 1 | M0 |
| dependency-review | https://github.com/actions/dependency-review-action | 1 | M0 |
| Scorecard | https://github.com/ossf/scorecard-action | 1 | M0 |
| harden-runner | https://github.com/step-security/harden-runner | 1 | M0 |
| Arena methodology | https://arxiv.org/abs/2403.04132 | 1 | M9 |
| cosign / SLSA | https://docs.sigstore.dev · https://github.com/slsa-framework/slsa-github-generator | 1 | M8 |
| MLPerf Client | https://mlcommons.org/benchmarks/client/ | 1 | prior cross-checks |
| Local-LLM-Arena | https://github.com/sammy995/Local-LLM-Arena | 2 | patterns only |
| CanIRunThisLLM | https://github.com/Jordi577/CanIRunThisLLM | 2 | patterns only |
| sql-benchmark | https://sql-benchmark.nicklothian.com | 2 | browser-bench pattern only |

Tier meanings and the lore-is-hypothesis rule: decision-tree.md §"Source trust policy".

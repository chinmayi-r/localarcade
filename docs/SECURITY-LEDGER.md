# Security ledger

Security-sensitive automation is copied from official or project-maintainer sources and pinned by full commit SHA. This file is the review queue required by the agent plan.

## Copied and pinned

| File | Mechanism | Source | Copied | Review state |
|---|---|---|---|---|
| `.github/workflows/ci.yml` | Checkout and Node setup | https://github.com/actions/checkout · https://github.com/actions/setup-node | 2026-07-19 | Pinned |
| `.github/workflows/ci.yml` | Dependency review | https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/configure-dependency-review-action | 2026-07-19 | Pinned |
| `.github/workflows/codeql.yml` | CodeQL advanced setup | https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning | 2026-07-19 | Pinned |
| `.github/workflows/scorecard.yml` | OpenSSF Scorecard | https://github.com/ossf/scorecard/blob/main/.github/workflows/scorecard-analysis.yml | 2026-07-19 | Pinned |
| All workflow jobs | Harden Runner audit mode | https://github.com/step-security/harden-runner | 2026-07-19 | Pinned |
| `.github/dependabot.yml` | Dependabot npm and Actions updates | https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference | 2026-07-19 | Copied |
| `.github/workflows/registry-refresh.yml` | Scheduled workflow syntax, checkout, Node setup and GitHub CLI pull-request flow | https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule · https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request | 2026-07-19 | Pinned |
| `.github/workflows/runner-ci.yml` | Runner gate suite (reuses ledger-pinned checkout/setup-node/harden-runner SHAs) | see rows above | 2026-07-19 | Pinned |
| `.github/workflows/runner-release.yml` | Cosign keyless blob signing | https://github.com/sigstore/cosign-installer (v4.1.2 @ 6f9f17788090df1f26f669e9d70d6ae9567deba6) · https://docs.sigstore.dev/cosign/signing/signing_with_blobs/ | 2026-07-19 | Pinned |
| `.github/workflows/runner-release.yml` | SLSA build provenance (reusable workflow) | https://github.com/slsa-framework/slsa-github-generator @ v2.1.0 — tag reference required by its official docs; documented exception to the SHA-pin rule | 2026-07-19 | Tag-pinned (documented exception) |

## Hand-written, needs review

| File | Mechanism | Why hand-written | Review state |
|---|---|---|---|
| `lib/quick-test/endpoint-policy.ts` | Exact loopback URL allowlist for browser benchmark requests | No Tier-1 application template exists for this product-specific boundary; URL parsing uses the browser platform API and fails closed before `fetch`. | Needs review |
| `runner/src-tauri/src/quick_task.rs` | Fixed-fixture execution through an exact checked `llama-cli` path with per-task watchdog | No Tier-1 template exists for this product-specific existing-engine boundary. The module has a single allowlisted spawn site, no network or write APIs, fixed public prompts only, and boundary tests. | Needs review |
| `runner/src-tauri/src/execution_process.rs` | Suspended Windows child creation, pre-resume kill-on-close Job Object assignment, retained identity guards, bounded streams, watchdog and external stop | Product-specific process lifecycle control with direct Windows API use. Combined Rust tests cover assignment-before-resume, overflow termination and cancellation. This does not restrict child network/filesystem access and is not T7 sandboxing. | Needs security review |
| `runner/src-tauri/src/execution_lifecycle.rs`, `execution_service.rs` | One-use process-local prepared authorization, single active worker and exact terminal cross-binding | Product-specific consent/orchestration boundary; no IPC or frontend caller exists. Fake-runner tests cover replay/cross-ID, stop/partial, mismatch and malformed output. | Needs integration review before surface wiring |
| `docs/runner-threat-model.md` | M8 runner threat model — download/execution gate (I8) | Product-specific threat enumeration; every mitigation cites a Tier-1 mechanism, but the composition is hand-written. The gate stays closed until the sign-off box at the top of that document is checked by the product owner. | Needs product-owner sign-off |

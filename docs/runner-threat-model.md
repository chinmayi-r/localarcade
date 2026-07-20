# Runner threat model

> **Gate status (Global Invariant I8):**
>
> - [x] **Human review sign-off (product owner).** Approved by the product owner via chat on 2026-07-19 ("read through, threat seems reasonable"). The I8 gate is now open for milestone work that implements download/execution features, subject to the OPEN stop-and-ask items in T2, T7 and T8 — those still require explicit decisions before their specific features are built.

This document is the M8 deliverable required by `agent-plan.md`. It defines what the future desktop runner is allowed to be, what can attack it, and which vetted mechanism answers each threat. Per repository policy (§3, I7), mitigations are mapped to Tier-1 sources; nothing here is a novel security design. Where no Tier-1 mechanism exists, the item is marked **OPEN** and is a blocker for the affected feature, not a footnote.

## 1. What the runner is (scope of this model)

A separate, installable desktop application that — after per-action consent — can:

1. detect hardware precisely;
2. scan local model stores (GGUF folders, Ollama and LM Studio directories) read-only;
3. download model artifacts that exist in the admitted registry, by pinned revision URL and expected SHA-256;
4. execute a local inference engine against those artifacts to run benchmarks and (later) scheduled battle-generation jobs;
5. upload consented result payloads.

Out of scope for this model: the website (no execution surface), the localhost quick test (already covered by its own network-boundary tests), and any enterprise BYOF deployment (separate future model).

## 2. Assets

| ID | Asset | Why it matters |
|---|---|---|
| A1 | The user's machine (integrity, availability) | The runner executes large untrusted-origin binaruy data (model files) with an engine subprocess |
| A2 | The user's privacy (prompts, files, hardware identity) | Community is telemetry-hostile; one silent upload destroys the product |
| A3 | Artifact integrity | A swapped model file = arbitrary quality/behavior corruption, possibly parser exploitation |
| A4 | The update channel | Whoever controls updates controls every installed machine |
| A5 | Result/leaderboard integrity | Poisoned results silently corrupt the public evidence (A5 failure is invisible to the victim) |
| A6 | The contribution fleet's resources | Volunteers' electricity, bandwidth, and disk are held in trust |

## 3. Trust boundaries

```text
[LocalArcade backend] --jobs/artifact refs--> [Runner core] --spawn--> [Engine subprocess (llama.cpp/MLX)]
[HF CDN, pinned revision URLs] --artifact bytes--> [Runner core]
[Local model stores (Ollama/LM Studio dirs)] --read-only scan--> [Runner core]
[Runner core] --consented payloads--> [LocalArcade backend]
[Signed release channel] --updates--> [Runner core]
```

Every arrow is a boundary; §4 enumerates the attacks across each.

## 4. Threats and mitigations

### T1 — Malicious or corrupted model artifact (boundary: HF CDN → runner; asset A1, A3)

Model files are untrusted input, not passive data: GGUF parsing and template handling in inference engines have had real vulnerabilities (see the llama.cpp security policy's own guidance on untrusted models/inputs: https://github.com/ggml-org/llama.cpp/blob/master/SECURITY.md).

- M1: download **only** artifacts present in the admitted registry; verify byte size and SHA-256 against the registry record before first use; delete on mismatch. (Registry hashes are sourced from Hub LFS metadata at a pinned revision — see `registry/generated/artifacts.json` provenance.)
- M2: resolve downloads from the pinned-revision URL recorded at admission, never from a moving branch (`main`) reference. (HF Hub revision addressing: https://huggingface.co/docs/hub/en/api)
- M3: treat the engine as compromised-by-input: run it as a sandboxed child process (T7), never in the runner's own process.
- M4: track the engine's upstream security advisories; ship engine updates through the signed update channel only (T2), pinned to an exact build recorded with every result.

### T2 — Compromised update channel (boundary: release channel → runner; asset A4)

- M5: sign every release with Sigstore `cosign`; the runner verifies the signature before applying any update (official docs: https://docs.sigstore.dev/cosign/signing/overview/).
- M6: generate SLSA build provenance in CI with the official generator (https://github.com/slsa-framework/slsa-github-generator; spec: https://slsa.dev/spec/); publish it with each release so third parties can audit that binaries came from this repository's CI.
- M7: **RESOLVED 2026-07-19 (product owner):** the runner ships with **no self-update code**. Distribution and updates go through package managers (winget/Homebrew) with signed artifacts — there is no update channel to attack. If self-updating is added later, that milestone reopens this item: update metadata design must follow The Update Framework's threat model — freshness, rollback protection, key compromise recovery (https://theupdateframework.io/docs/security/) — and the implementation choice is a stop-and-ask at that time.
- M8: platform trust rails on top, not instead: macOS notarization + hardened runtime (https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution), Windows Authenticode signing (https://learn.microsoft.com/en-us/windows/win32/seccrypto/cryptography-tools).

### T3 — Supply chain of the runner build itself (asset A4)

Already partially closed by M0 and extended to the runner CI: SHA-pinned actions, OpenSSF Scorecard, dependency review, Harden-Runner (see `docs/SECURITY-LEDGER.md`), lockfile-enforced installs (`npm ci`), and the SLSA provenance from T2-M6.

### T4 — Exfiltration / privacy violation (boundary: runner → backend; asset A2)

- M9: **No telemetry by default** is an invariant (I5), not a setting. The upload payload schema is public in the repository; the runner shows the exact serialized payload before its first send and on demand.
- M10: uploads are per-action consented; solo-arena prompts and outputs never leave the machine (decision-tree Tree C/D contract). Scheduled-job uploads contain only: job id, artifact hash, engine build, sampling params, outputs for *server-supplied* prompts, and performance/stability telemetry — no user files, no user prompts.
- M11: local model-store scanning is read-only and its results stay local unless a specific upload includes them (each field enumerated in the public schema).
- M12: revocation purges queued jobs and stops all future sends (Tree C7X); verified by test before any upload feature ships.

### T5 — Resource abuse of volunteers (asset A6)

- M13: user-set hard caps (disk GB, hours/week, bandwidth) enforced runner-side; idle + on-AC-power preconditions per decision-tree B4/C3.
- M14: job bounds from decision-tree Tree D: single-turn or short-chain generation only, hard token caps, **no agent loops** on volunteer machines — enforced structurally by the job schema (T6), not by server good behavior.

### T6 — Malicious or compromised backend pushing hostile jobs (boundary: backend → runner; assets A1, A6)

The runner must stay safe even if the backend is fully hostile:

- M15: **jobs are data, never code.** The job schema admits only: an artifact reference that must resolve inside the runner's local copy of the admitted registry (hash-verified), prompt text, bounded sampling/context parameters, and an engine build identifier that must match an engine shipped via the signed release channel. Anything else fails closed (I6).
- M16: the runner never downloads or executes an engine binary named by a job payload; engines arrive only through T2's signed channel.
- M17: schema validation is exhaustive and versioned; unknown fields or versions are rejected, not ignored.

### T7 — Engine subprocess escape / local damage (asset A1)

Run the engine with the strongest available OS sandbox, per platform, from official documentation only:

- Windows: launch in an AppContainer with least-privilege capabilities (https://learn.microsoft.com/en-us/windows/win32/secauthz/appcontainer-isolation) and a Job Object for memory/CPU kill-limits (https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects).
- macOS: App Sandbox + hardened runtime entitlements (https://developer.apple.com/documentation/security/app-sandbox).
- Linux: user namespaces + seccomp filtering (https://man7.org/linux/man-pages/man2/seccomp.2.html) and Landlock filesystem restriction (https://docs.kernel.org/userspace-api/landlock.html).
- Common denominator everywhere: engine child gets read access only to the one artifact file and write access only to a scratch directory; no network for benchmark runs (network is the runner core's job, not the engine's).
- **OPEN:** Windows AppContainer + GPU (CUDA) access is the weakest documented combination; if GPU access inside AppContainer proves infeasible, the fallback (Job Object limits + restricted token, without full containerization) must be explicitly signed off as a reduced mitigation.

### T8 — Result poisoning by malicious contributors (asset A5)

Decision-tree Tree C already specifies the design: signed runner builds (T2 makes results attributable to a genuine build), canary prompts with known-good outputs, silent duplicate-sampling across nodes in the same bucket, per-node trust decay and quarantine (C5X). **OPEN (carried from the enterprise design discussion):** cheap, strong device attestation — proving the hardware is what it claims — has no satisfying Tier-1 mechanism on consumer PCs; bucket assignment therefore relies on measured calibration fingerprints (behavioral, hard to fake profitably) rather than hardware attestations. This is an accepted residual risk for the public fleet and a hard blocker for the paid/vetted enterprise tier.

### T9 — Web page ↔ runner local bridging (future; boundary: browser → runner)

If the website ever talks to an installed runner: loopback-only binding, per-pairing explicit token displayed by the runner and typed into the page, strict `Origin` checking, and compliance with browsers' Private Network Access restrictions (https://developer.chrome.com/blog/private-network-access-preflight). Until designed in its own milestone, this surface does not exist: the runner exposes **no** listening socket.

## 5. The runner will never

1. Execute code, scripts, or engine binaries received in a job payload.
2. Download an artifact absent from the admitted registry, or keep one that fails hash verification.
3. Upload anything without per-action consent, or upload user prompts/files from solo use.
4. Run jobs outside user-set resource caps, off-idle, or on battery without explicit permission.
5. Apply an unsigned or unverifiable update.
6. Expose a network listener (until T9 is designed, gated, and signed off in its own milestone).
7. Collect telemetry by default.

Each "never" becomes a named test in the runner's suite; a PR deleting one of these tests is a security event, not a refactor.

## 6. Residual risks (accepted, visible)

- GGUF/engine parser zero-days: sandboxing (T7) contains, does not prevent. Mitigated by engine update cadence.
- Hardware attestation gap (T8): behavioral fingerprinting is the ceiling for the volunteer fleet.
- Windows sandbox depth (T7 OPEN) pending a GPU-compatible AppContainer investigation.

## 7. Sign-off checklist for the product owner

- [ ] §1 scope matches what you intend the runner to be.
- [ ] Every OPEN item is acknowledged as a stop-and-ask before its feature.
- [ ] §5 "never" list is complete per your standards (add items freely; removing any requires editing this document first).
- [ ] Check the gate box at the top to authorize milestone work that implements downloads/execution — or leave it closed and the gate holds.

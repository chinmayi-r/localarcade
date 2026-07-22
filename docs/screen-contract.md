# First-slice screen and state contract

Status: **Product-owner-approved first-slice authority**, 2026-07-22. This consolidated matrix replaces `interface-design-program.md` and `ui-reference-and-screen-plan.md` as active screen authority; those files and the recovered prototypes remain research/design references.

Production behavior is not authorized by this document alone.

## Owner-approved journey and screen details

```text
Website finder
  → scoped recommendation portfolio
  → exact configuration detail
  → desktop handoff
  → desktop welcome and permission preview
  → hardware / local inventory result
  → verification plan
  → verification progress
  → verification result or failure
```

CLI commands are adapters over the same use cases and envelopes. Private Arena follows this journey in a later contract. Public Arena, uploads, voting, contributions, and public evidence service screens are excluded.

## Shared language and state rules

- Say “your selected hardware” on the website, never “detected hardware” or “this machine.”
- Say “estimated,” “community evidence,” or “measured on this machine” exactly as supported.
- Lead with task language such as “coding across a few project files”; place token counts and low-level runtime settings under expert detail.
- `unavailable` means evidence/capability is missing. `blocked` means a safety or integrity rule prevents the action. `partial` preserves usable results and names omissions. `error` is an unexpected or invalid failure with a retry/report path.
- Every state preserves the submitted/selected identity and never substitutes another artifact, quantization, runtime, or settings silently.

Fixture paths below are relative to `docs/contracts/fixtures/` and validate against `docs/contracts/local-arcade-first-slice-v1.schema.json`.

## Screen definitions

| ID / screen | User job | Required inputs | Displayed outputs | Primary action | Secondary actions | Permission / side effects | Novice language / expert detail | Request / response fixtures |
|---|---|---|---|---|---|---|---|---|
| W1 Website finder | Describe owned hardware and intended task | OS family; accelerator kind/vendor/backend or manual path; confirmed VRAM/unified memory when known; system RAM; task; task scope; needs; maximum artifact size | normalized input summary; derived context label; catalog/freshness caveat | Find configurations | advanced settings; methodology; runner information | No detection, filesystem, execution, download, or upload. Form evaluation only. | “What hardware do you already have?” / field origins, raw IDs, bytes, context tokens, runtime/license filters | `hardware-target.ok.json`; `recommendation-request.ok.json` → common envelope |
| W2 Recommendation portfolio | Understand safe choices and evidence limits | accepted recommendation request + hardware target | up to five distinct families; evidence-supported roles only; compatible-only results explicitly unranked; coverage/no-fit state | Open a configuration | change inputs; compare scoped items; methodology | No local-machine access or runner requirement | “Primary match,” “quality option,” “fast option,” “long-context option,” “memory-efficient option” / scoring, evidence scope, source links | `recommendation-request.ok.json` → `recommendation-portfolio.ok.json`, `common-unavailable.json` |
| W3 Exact configuration detail | Inspect one runnable identity before choosing it | candidate ID from portfolio | artifact/revision/hash/size/license; quantization; complete effective runtime identity; detailed device/host memory; prompt/decode/TTFT evidence, confidence, scope, provenance and samples | Continue to desktop handoff | copy/export details; back to results; source/methodology | Clipboard/download of a small handoff file only after explicit action; never model download | “This is the exact setup the runner will check” / complete configuration, raw evidence dimensions and unknown settings | `exact-configuration-candidate.ok.json`; `fit-evidence-assessment.ok.json` |
| W4 Desktop handoff | Move the exact choice to the separately gated runner | exact candidate; hardware target; normalized request; evidence summary | canonical self-contained snapshot; content hash; 24-hour informational expiry; explicit no-authorization/no-model-data notice | Open or export for runner | copy command; download handoff JSON; continue using website only | Import/replay is side-effect-free; every detect/scan/hash/run action remains separately explicit | “The website has not checked your machine” / schema/hash/version/creation/expiry | `runner-handoff.ok.json`, `common-blocked.json` |
| D1 Welcome and permission preview | Understand local capabilities before granting anything | optional handoff bundle | current runner scope; received configuration; separate detection/inventory/run permissions | Review hardware detection | inspect handoff; continue without import; close | No detection/scan/run on load. Reading an explicitly opened handoff file is the only optional file read. | “Nothing is scanned or run until you choose it” / capability and schema versions | `runner-handoff.ok.json` → common envelope |
| D2 Hardware and inventory result | Confirm the real machine and owned artifacts | explicit detection consent; separately explicit inventory directories/providers | detected/unknown hardware; discrepancies; found/candidate/verified artifacts; unreadable/truncated items | Confirm target for verification | edit/confirm memory; scan another named folder; skip inventory | Read-only hardware query after consent; inventory scan is separate, local, bounded, no upload/write/execute | “We found…” / device IDs, confidence, file paths/hashes, adapter errors | `hardware-target.detected-partial.json`; `common-partial.json`; `common-unavailable.json` |
| D3 Verification plan | Review exactly what will execute | confirmed hardware; selected artifact/path; runtime/build; exact settings; preflight | separate benchmark and quick-check plans; warmups separated from measured runs; expected load; adverse/unknown conditions | Run this verification | run either plan; change file/settings; cancel; view expert command | Run-specific consent. No download. Must block hash mismatch/unsupported executable. | “This will load the selected model and keep your machine busy” / executable path, flags, protocols, telemetry gaps | `benchmark-plan.ok.json`; `quick-check-plan.ok.json`; `verification-plan.ok.json`; `common-blocked.json` |
| D4 Verification progress | See what is running and retain control | accepted verification plan | phase; sample/task progress; elapsed time; current conditions; partial observations | Stop safely | expand log/details | Executes one approved plan locally. Stop preserves a partial local result; no upload. | “Run 2 of 3” / raw stdout identity, sample fields, watchdog state | `verification-plan.ok.json` → `common-partial.json` while incomplete |
| D5 Verification result | Understand scoped local evidence | completed or stopped run | exact identity; separate typed measurement series and mechanical check results; warmups; raw samples; per-series/check evidence; calibration exclusions | Save locally / return to configuration | rerun; compare with estimate; export local result after preview | Local persistence only after explicit save if not already required for recovery; no public upload | “Measured on this machine under these settings” / separate benchmark/quick-check results, diagnostics and provenance | `benchmark-result.ok.json`; `quick-check-result.ok.json`; `verification-result.ok.json`; `verification-result.conditioned.json` |
| D6 Verification failure | Recover without losing identity or overstating evidence | failed plan/run and diagnostic | reason code; completed phases; partial record; unchanged selected config; safe recovery actions | Retry approved recovery | choose another file; return; copy diagnostics | No automatic substitution, redownload, upload, or destructive cleanup | “The selected file did not start” / exit code, timeout, hash/runtime mismatch, retained logs | `common-blocked.json`; `common-error.json`; `common-partial.json` |
| C1 `localarcade find` | Obtain the same portfolio non-interactively | hardware/request flags or JSON | human table or versioned JSON envelope | run command | `--expert`, `--json`, methodology/source output | No hardware detection unless a separate runner-local command is explicitly used | Plain task flags / exact normalized request | same fixtures as W1/W2 |
| C2 `localarcade config show` | Inspect exact candidate identity | candidate/portfolio ID or JSON | same exact detail and evidence assessment as W3 | print/export | `--json`, source links | Output only; explicit file path required for export | concise summary / full identity JSON | same fixtures as W3 |
| C3 `localarcade handoff` | Create/open runner handoff | exact candidate + hardware/request context | destination, schema version, content hash, capability warning | write confirmed bundle or invoke runner | stdout preview; cancel | File write or runner invocation only after explicit command/confirmation; no model operation | “This bundle does not contain a model” / canonical JSON/hash | `runner-handoff.ok.json` |
| C4 `localarcade runner inspect` | Detect/scan with explicit local scope | `--hardware`; optional named `--scan` paths/providers | same normalized hardware/inventory results as D2 | execute requested read | JSON output; confirm/edit path | Reads only requested local sources; no scan by default | plain findings / IDs, paths, errors | `hardware-target.detected-partial.json`; common envelopes |
| C5 `localarcade runner verify` | Plan, run, monitor, and retrieve verification | exact plan JSON; explicit `--run` or interactive confirmation | plan preview, progress events, final/partial/failure envelope | confirm/run | dry-run; stop; JSON lines; diagnostics | Execution only with explicit run authorization; same hash/path/security gates as desktop | clear busy warning / exact command/protocol/telemetry | verification fixtures and common envelopes |

## Required state matrix

Every implementation must render or emit each applicable state. “N/A” is prohibited unless the use case contract makes the state structurally impossible; this matrix names the required behavior instead.

| Screen | Loading | Empty | Unavailable | Blocked | Partial | Error |
|---|---|---|---|---|---|---|
| W1 | Catalog/form initialization keeps labels stable | Blank optional fields show examples, not fake defaults | Catalog stale/platform unsupported names manual path | Invalid/contradictory minimum inputs focus error summary | Recognized platform but unknown accelerator requests confirmed memory | Validation/system error preserves entries and retry |
| W2 | Skeleton rows retain result hierarchy and submitted summary | No submitted request returns to W1; never shows demo cards | Coverage gap shows research/manual actions without ordering | Safety/compatibility exclusion names exact reason | Some candidates lack comparative evidence and remain unranked | Evaluation failure preserves request and offers retry/report |
| W3 | Identity/evidence sections load independently | Missing candidate returns to portfolio | Missing source/evidence shown as unknown, not inferred | Quarantined/stale/hash conflict disables handoff | Configuration is usable but some expert values/evidence are absent | Failed detail lookup preserves candidate ID and source action |
| W4 | Runner availability check never claims local inspection | No selected config returns to W2 | Unsupported platform offers bundle/copy and website-only path | Invalid/expired/schema-incompatible bundle cannot open | Runner state unknown still permits bundle export | Invocation/export failure leaves detail accessible |
| D1 | App startup shows local shell only | No handoff offers import or manual path | Unsupported bundle version can be inspected safely | Invalid/tampered bundle rejected | Recognized bundle with unknown fields requests confirmation | Parse/startup error exposes diagnostics without actions |
| D2 | Each consented adapter reports progress independently | No devices/models is a valid explicit result | Platform adapter/provider unavailable offers manual entry | Permission denial or unsafe path stops that adapter | Known + unknown devices/files remain visible together | Per-adapter/per-file errors do not erase successful findings |
| D3 | Preflight runs after request and labels unknown sensors | No exact artifact/config prevents plan | Required executable/telemetry unavailable explains allowed alternatives | Hash mismatch, missing file, unsafe conditions or unsupported runtime block run | Noncritical telemetry unknown permits only explicitly conditioned run | Preflight failure preserves inputs and diagnostics |
| D4 | Initializing/loading model is a named phase | Zero samples after safe cancel yields cancelled result | Telemetry channel may be unavailable without hiding execution state | Watchdog/integrity condition stops run | Completed samples survive stop/failure | Process error records exit/timeout and safe recovery |
| D5 | Result parsing shows retained raw record status | No completed sample is cancelled/failed, never verified | A metric unavailable remains labeled unavailable | Integrity failure prevents verified/calibration label | Conditioned/unstable/aborted results remain visible with exclusions | Rendering/store error leaves recoverable raw result |
| D6 | Diagnostics collection is bounded and cancellable | No diagnostic text still shows stable reason code | Recovery action unavailable explains why | Repeated unsafe/hash failure remains blocked | Partial samples/logs remain downloadable locally | Unknown failure uses error envelope and report copy |
| C1 | stderr/status in human mode; no decorative JSON progress | Missing required flags returns usage envelope | Same as W1/W2 | Same reason codes as W1/W2 | JSON includes warnings and available data | Nonzero exit plus error envelope |
| C2 | Resolve status on stderr only | Unknown ID returns unavailable | Missing expert field remains null | Quarantined identity returns blocked | Available identity with warnings emits partial envelope | Nonzero exit plus error envelope |
| C3 | Hash/write status never contaminates JSON stdout | Missing config returns usage/unavailable | Runner invocation unavailable still permits stdout preview | Invalid bundle/path or denied write blocks | Bundle written but invocation unavailable reports partial | Write/invoke error preserves preview |
| C4 | Adapter events in JSON-lines or stderr | Empty scan is `ok` with empty items | Unsupported adapter is unavailable | Denied path/permission is blocked for that scope | Successful adapters plus failures return partial | Fatal adapter error uses error envelope |
| C5 | Plan/progress events are versioned | Missing plan returns usage envelope | Executable/telemetry unavailable as D3 | Same integrity/security blockers as desktop | Stop/conditioned run returns partial/result envelope | Nonzero exit and final error envelope |

## Retained and rejected source material

| Source | Retained | Rejected or deferred | Reason |
|---|---|---|---|
| `interface-design-program.md` | State-first design, consent previews, website/desktop separation, review gates | Its active W/D/P numbering and public-service sequence | Proposed replacement is this smaller in-review matrix |
| `ui-reference-and-screen-plan.md` | Broad error/empty/permission coverage, CLI/API parity ideas | Conflicting W0–W11/D0–D19/API0–14 inventory | Too broad and internally competing for first slice |
| Product simulator prototype | Cross-surface audition concept, private local comparison as later product | Hard-coded model/config data; public Arena prominence | Illustrative only; public paths deferred |
| UI flow + preview prototypes | Finder→portfolio→detail→handoff and consented verification flow | Prototype navigation, data, and any automatic capability implication | Flow aligns after honesty corrections |
| Website wireframes prototype | Hardware-advisor density and methodology below utility | Three equal arrival cards, leaderboard arrival, hero-like framing | Conflicts with owner-approved one-form arrival direction |
| Current website tests | Fail-closed empty states, evidence labels/sources, accessibility semantics | Existing visual shell as permanent design | Behaviors are preservation fixtures, not screen authority |
| Current runner | Explicit actions, read-only inventory, preflight, exact observation, safe failure | Direct UI→command architecture and full-R4 claims | Reuse behind future M-O adapter; full R4 remains gated |

## Review and implementation gate

Before production UI work, each screen must be tied to the approved contract IDs, validated fixtures, an M-O use case, accessibility acceptance tests, and a named checkpoint. No screen may introduce a side effect absent from this approved matrix.

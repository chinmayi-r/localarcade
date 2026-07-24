# Capability handoff board

Status: **Wave 1 verification aid — no production authority.**

Local Arcade is evaluated as a set of real capabilities, not a sequence of
abstract module letters. The M-A–M-P identifiers remain cross-references to the
architecture, but they are not completion claims.

Run the current board with:

```powershell
npm.cmd run proof:capabilities
npm.cmd run proof:capabilities -- --json
```

The source of the board is
`../research/capability-proofs/capabilities.json`. Its validator rejects a
passing gate without evidence, a missing/partial gate without an explicit gap,
unknown manifest versions, nonexistent evidence paths and omission of the
no-tools boundary.

Concrete inputs and observed outputs are recorded in
`capability-input-output-examples.md`. Proposed shapes are never presented there
as executed output.

## Product boundary

Local Arcade handles:

- local model and artifact identity;
- hardware fit and compatibility;
- exact local runtime configuration;
- local execution planning and observation;
- raw response streaming and capture where the capability exists;
- blind user comparison and scoped preference evidence where the capability
  exists.

Local Arcade does not handle:

- tool calling;
- web search, weather services or retrieval augmentation;
- external factual verification;
- rewriting a prompt to make a demonstration pass.

A user can ask an arbitrary question such as “What’s the weather next week?”
The system passes the prompt through. It does not add a weather tool, correct the
models or grade their factual accuracy. A capability proof checks prompt
preservation, execution, configuration identity, streaming/capture, completion,
comparability, status and provenance.

## Four independent proof gates

| Gate | Passing evidence |
|---|---|
| Core | The internal mechanism has direct executable tests. |
| Boundary | Explicit/versioned inputs and outputs have positive and negative executable examples. |
| Handoff | A real downstream consumer accepts the output without reconstructing, weakening or hiding it. |
| User | A person operates the representative capability using an independently selected input and can inspect the real result. |

A green core is not a green subsystem. Infrastructure capabilities may mark the
user gate not applicable, but still require an executable input/output boundary
demonstration.

## Current capability state

| Capability | Ref | Core | Boundary | Handoff | User |
|---|---:|---:|---:|---:|---:|
| Shared data contracts | M-A | Pass | Pass | Partial | N/A |
| llmfit advisory adapter | M-B | Partial | Partial | Missing | N/A |
| Model artifact catalog | M-C | Pass | Pass | Partial | N/A |
| Hardware detection and confirmation | M-D | Pass | Pass | Partial | Partial |
| Exact configuration compatibility | M-E | Pass | Pass | Partial | N/A |
| Fit and performance assessment | M-F | Pass | Pass | Partial | N/A |
| Evidence normalization and claim scope | M-G | Pass | Pass | Partial | N/A |
| Recommendation portfolio | M-H | Pass | Pass | Partial | Partial |
| Owned model inventory | M-I | Pass | Pass | Partial | Partial |
| Local verification | M-J | Pass | Pass | Partial | Missing |
| Private local comparison | M-K | Missing | Missing | Missing | Missing |
| Public pair contribution | M-L | Deferred | Deferred | Deferred | Deferred |
| Preference rating | M-M | Pass | Partial | Missing | Missing |
| Public evidence service | M-N | Deferred | Deferred | Deferred | Deferred |
| Application workflow and consent | M-O | Partial | Partial | Partial | Partial |
| Website, desktop and CLI | M-P | Partial | Partial | Partial | Partial |

The machine-readable board contains the evidence and gap behind every cell.

The U33–U35 process-local benchmark service expands M-O's internal core and
boundary evidence only. A moved prepared handle plus runner-owned one-use
confirmation now reaches bounded per-child execution, admitted post-load
identity, authentic progress, safe stop and an M-J terminal result in
deterministic fake-process tests. M-J and M-O remain handoff-partial because the
typed desktop facade now consumes the preview and execution IPC unchanged. Both
remain user-partial: deterministic surface tests and browser inspection prove an
inspectable workflow, but quick-check execution is blocked for the approved
fixture, no external model run proved the native path, and T7
sandbox/network/filesystem isolation is not claimed.
The current batch also adds an explicit user-triggered hash promotion for one
retained size candidate. It is never an automatic scan step and returns no
execution authority. M-O, not M-P, constructs the fixed verification plan.
M-P accepts a completed result only when its full DTO and exact planned
measurement/check sets match. U27 now adds a separate, user-triggered
`llama-fit-params` capture: M-O seals the selected artifact/tool/hardware and
exact six-observation protocol behind one opaque preview handle; M-P shows the
hashes, contexts and warnings, requires a separate local-process checkbox, and
rejects a returned receipt whose full content hash or display-critical bindings
do not match. The resulting evidence remains proposed-unreviewed and grants no
recommendation or serving authority.

## Independent user demonstrations

Demonstration inputs must be chosen independently of the implementation. Tests
such as “return exactly PASS” remain useful mechanical fixtures but do not count
as user demonstrations.

### Finder and recommendation

An independent user supplies their hardware facts and task. The demonstration
must preserve the request, show every candidate considered, give stable reasons
for every exclusion, and return a ranked, unranked, no-coverage or no-safe-fit
result without inventing missing facts.

This demonstration is currently partial. The legacy ranker distinguishes
several honest outcomes, but it does not return a complete candidate disposition
ledger and does not consume the final M-A/M-F inputs through M-O.

### Inventory and verification

An independent user chooses a real directory/model and grants each permission.
The demonstration must show verified, candidate, unmatched, unreadable and
partial inventory states; preview the exact verification plan; preserve stop or
failure observations; and return the final typed result through M-O.

M-O now preserves M-I status, admits only an intact exact verified identity,
binds a sealed U31 hardware receipt and guarded U32 tool receipt, samples
preflight locally, and produces a non-authorizing Rust M-J verification-plan
preview against the imported configuration. A separate process-local service
proves one-use confirmation, bounded run/progress/stop/result sequencing and
partial-result preservation with deterministic fake child outputs. The preview
and execution IPC now have a typed D1–D6 desktop consumer. Twenty-one deterministic
surface tests prove the complete call sequence, exact bundle-byte preservation,
blocked/unavailable/partial/error states, input immutability, stop and replay
rejection, explicit hash selection, U27 capture acknowledgement and same-ID
receipt-mutation rejection, lifecycle monotonicity and forged-result rejection;
eleven boundary tests prevent direct lower-module or retired raw command use.
Browser inspection proves the compact welcome and blocked-import states. No
native user-operated selected-artifact U27 or external-model chain exists.

### Private local comparison

The invitation is simply: “Ask two local models any question.”

For a user-selected prompt, the required demonstration is:

1. preserve the exact prompt;
2. bind two exact configurations and equivalent comparison conditions;
3. run the configurations sequentially on constrained hardware;
4. capture authentic token events and completed outputs;
5. keep a failed/incomplete side as a stability result, not a battle;
6. randomize and hide identities;
7. replay or display both streams;
8. accept A, B, tie, both-bad or skip;
9. bind the vote to the exact outputs;
10. feed only an eligible vote into the correct local response or experience
    rating scope.

None of this user flow is currently implemented. The existing rating core uses
synthetic pairs and therefore passes only its core gate.

## Handoff rule

A downstream team may begin against a producer only when the required producer
boundary is green and a consumer test proves the handoff. A later team may not:

- reconstruct a missing receipt or identity;
- turn unknown into a default;
- turn partial, blocked, unavailable or error into success;
- infer an exclusion reason that the producer did not emit;
- claim a user demonstration from synthetic fixtures.

For the approved first slice, M-F now exposes both its assessment boundary and
the fail-closed admission mechanism in front of it. The mechanism accepts a
manifest-locked synthetic source record, rejects a complete-looking record
outside the injected reviewed manifest, and rejects the checked legacy profile
with all absent scope/evidence facts named. The production path still needs
newly collected, reviewed, fully runtime-scoped profile data, a repository-owned
manifest that is never request-controlled, an approved concrete
capacity-policy instance. M-H now exposes its full internal decision ledger and
requires an intact process-local M-E/M-F composition brand. Its handoff remains
partial because only synthetic admitted inputs exist. M-O now proves status
propagation for the authorized non-production subset, but U27 and absent
production consumers still prevent replacement surfaces from using it.
The U27 research collector/deriver remains isolated: synthetic fixtures prove
machinery, caller-asserted local measurements are rejected, and the executable
production-readiness result is `unavailable`.

# Local Arcade system build assembler

Status: **Active implementation dashboard**, 2026-07-22. This is a progress
overlay on the audited llmfit operation map and the approved Local Arcade
module target. A check on an upstream L-box means its source behavior was
audited; it does not mean Local Arcade adopted or reimplemented it.

## Legend

- ✅ complete or audited, with evidence available
- 🟡 active on the integration branch
- ⬜ queued behind an explicit dependency
- ⏸ owner decision or research evidence required
- ⛔ excluded from the approved first slice

## Graph 1 — complete llmfit box mapped into Local Arcade

The detailed inputs, outputs, side effects and callables for L0–L25 remain in
[the source operation audit](system-operation-graph.md). This view keeps every
upstream operation visible while allowing many-to-many adoption boundaries.

```mermaid
flowchart LR
  subgraph LF["llmfit v1.1.6 — all source operations audited ✅"]
    direction TB
    subgraph LH["hardware"]
      L0["L0 public exports"]
      L1["L1 detect hardware"]
      L2["L2 enrich hardware facts"]
      L3["L3 hypothetical overrides"]
    end
    subgraph LK["model knowledge"]
      L4["L4 load model database"]
      L5["L5 storage / KV / quant facts"]
      L6["L6 mutable discovery cache"]
    end
    subgraph LRUN["runtimes and installed state"]
      L7["L7 detect providers/models"]
      L8["L8 aggregate installed providers"]
      L9["L9 map / download / delete artifacts"]
    end
    subgraph LADV["fit, ranking and planning"]
      L10["L10 one-model fit"]
      L11["L11 whole-catalog fit/calibration"]
      L12["L12 rank catalog"]
      L13["L13 filter / compare / recommend"]
      L14["L14 plan / upgrade deltas"]
      L15["L15 Kubernetes claim"]
    end
    subgraph LMEAS["measurement and sharing"]
      L16["L16 benchmark endpoint"]
      L17["L17 discover benchmark targets"]
      L18["L18 community measurements"]
      L19["L19 local benchmark store/calibration"]
      L20["L20 GitHub benchmark sharing"]
    end
    subgraph LQUAL["quality, diagnostics and delivery"]
      L21["L21 regex quality checks"]
      L22["L22 composite role routing"]
      L23["L23 diagnostics"]
      L24["L24 task-prior lookup"]
      L25["L25 CLI/TUI/web/REST/MCP/NATS/Python"]
    end
  end

  subgraph LA["Local Arcade — contracts, preserved cores and target modules"]
    direction TB
    MA["M-A contracts ✅"]
    MB["M-B pinned llmfit advisory ⏸"]
    MC["M-C exact artifact registry ✅"]
    MD["M-D hardware resolver ✅\nU31 sealed confirmation ✅"]
    ME["M-E exact candidate/runtime builder ✅"]
    MF["M-F assessment + admission ✅\nsynthetic collection machinery ✅\ntrusted capture + policy ⏸"]
    MG["M-G evidence adapter ✅\npreserved core ✅"]
    MH["M-H compatibility portfolio ✅\nsynthetic handoff ✅ / real data + M-O partial"]
    MI["M-I read-only inventory ✅\nexplicit selected-file hash ✅"]
    MJ["M-J verification adapter ✅\nbenchmark → fixed checks ✅\nlive external proof ⬜"]
    MK["M-K private Arena ⬜ later"]
    MLN["M-L/M-M/M-N public systems ⛔"]
    U28["U28 import bundle ✅\nv1 handoff unchanged + admission receipt"]
    U30["U30 task→context policy ✅\nversioned planning heuristic"]
    MO["M-O orchestration partial ✅\nserver-owned plan policy ✅\ntyped execution transport ✅\nrestart recovery ⬜"]
    MP["M-P surfaces partial\nwebsite legacy ⚠\nD1–D6 desktop + adverse DTO gates ✅\nCLI ⬜"]
  end

  L0 -. "versioned translation" .-> MA
  L1 -. "detected facts" .-> MD
  L2 -. "facts, never performance proof" .-> MD
  L2 -. "scoped estimator input" .-> MF
  L3 -. "manual/simulated target" .-> MD
  L4 -. "family prior; exact artifact resolved locally" .-> MB
  L4 -. "registry identity" .-> MC
  L5 -. "attributed advisory math" .-> MB
  L5 -. "compared with preserved exact fit" .-> MF
  L6 -. "do not import mutable cache lifecycle" .-> MC
  L7 -. "compatibility identity" .-> ME
  L7 -. "installed state" .-> MI
  L8 -. "inventory mechanics" .-> MI
  L9 -. "mapping only" .-> ME
  L9 -. "download/delete excluded" .-> MLN
  L10 -. "estimated advisory" .-> MB
  L10 -. "fit evidence" .-> MF
  L11 -. "candidate prior/calibration audit" .-> MB
  L11 -. "no automatic global calibration" .-> MG
  L12 -. "baseline under matched research" .-> MH
  L13 -. "intent orchestration" .-> MO
  L13 -. "surface parity, not copied UI" .-> MP
  L14 -. "single-config planning concepts" .-> MF
  L15 -. "not first-slice product" .-> MLN
  L16 -. "existing-engine measurement mechanics" .-> MJ
  L17 -. "explicit inventory/target selection" .-> MI
  L17 -. "plan binding" .-> MJ
  L18 -. "scoped community prior" .-> MG
  L19 -. "local exact observation" .-> MJ
  L19 -. "eligibility and provenance" .-> MG
  L20 -. "public contribution deferred" .-> MLN
  L21 -. "mechanical checks only" .-> MJ
  L21 -. "later private audition" .-> MK
  L22 -. "not accepted as product truth" .-> MH
  L23 -. "typed unavailable/diagnostic states" .-> MO
  L24 -. "dated task prior" .-> MG
  L24 -. "portfolio input, never proof" .-> MH
  L25 -. "use-case boundary" .-> MO
  L25 -. "new Local Arcade surfaces" .-> MP

  MA --> MC
  MA --> MD
  MA --> ME
  MA --> MG
  MC --> ME
  MB --> MF
  MC --> MF
  MD --> MF
  ME --> MF
  MG --> MF
  MF --> MH
  MC --> MI
  ME --> MI
  MD --> MJ
  ME --> MJ
  MI --> MJ
  U28 --> MO
  U30 --> MO
  MH --> MO
  MI --> MO
  MJ --> MO
  MO --> MP
```

## Graph 2 — implementation checkpoints and parallel tracks

```mermaid
flowchart TB
  BASE["Preservation baseline ✅\n59e6dd1"] --> MA["M-A contracts ✅\n55afbb2 + corrections"]

  subgraph W1["Parallel adapter wave — integrated and green"]
    MC["M-C registry ✅\n547d015"]
    MD["M-D hardware ✅\nb788396"]
    ME["M-E runtime/candidate ✅\n884dac2 + 1d0ddfb + 0f53fb9"]
    MG["M-G evidence ✅\ne3689eb"]
    PROTO["Matched ranking protocol ✅\n024fdc4"]
  end

  MA --> MC
  MA --> MD
  MA --> ME
  MA --> MG
  MA --> PROTO

  MB["M-B llmfit adapter partial\nisolated pin; transport/crosswalk missing"]
  MC --> MF["M-F assessment + source admission ✅\ncollection/derivation machinery ✅\nproduction trust + policy ⏸"]
  MD --> MF
  ME --> MF
  MG --> MF
  MB --> MF

  MC --> MI["M-I inventory ✅\nselected size candidate → explicit hash ✅"]
  ME --> MI
  MD --> U31["U31 hardware confirmation ✅\n12 focused proofs"]
  U31 --> MJ["M-J adapter ✅\nsealed hardware receipt"]
  ME --> MJ
  MI --> MJ

  MF --> MH["M-H compatibility portfolio ✅\n23 behavior + 1 purity proofs"]
  PROTO --> MH
  MH --> MO
  MI --> MO
  U32["U32 guarded tool identity ✅\n6 integration + 3 adversarial proofs"] --> MJ
  PROOF["M-E compatibility admission receipt ✅\nU25 resolved"] --> MJ
  MJ --> MO
  PROOF --> U28 --> MO
  U30 --> MO
  MJ --> EXEC["M-J combined execution ✅\nbenchmark load receipt → fixed checks"]
  EXEC --> IPC["M-O opaque start/status/stop/result ✅\ntyped desktop consumer ✅"]
  IPC --> MO
  MO --> WEB["M-P website ⬜"]
  MO --> DESK["M-P desktop D1–D6 ✅ fixtures\nfull DTO + planned-set admission ✅\nnative live run ⬜"]
  MO --> CLI["CLI parity ⬜"]
  DESK --> ARENA["M-K private Arena ⬜ later"]
  PUBLIC["Public Arena / upload / service ⛔"]
```

## Active branch ledger

| Track | Branch/worktree | Current state | Completion evidence |
|---|---|---|---|
| assembler and integration | `codex/wave1-domain-adapters` — `G:/LocalArcade` | ✅ first wave integrated | root and runner full gates green on 2026-07-22 |
| current M-I/M-O/M-P native-handoff batch | `codex/wave1-domain-adapters` — `G:/LocalArcade` | 🟡 uncommitted shared-worktree integration | Explicit selected-file hash promotion, server-owned fixed-plan policy, full result/planned-set admission and synthetic-only U27 collection research; 80 Rust library, 19 surface and 11 boundary tests; no native live-model claim |
| M-C registry | `codex/m-c-registry` — `G:/LocalArcade-worktrees/m-c-registry` | ✅ integrated as `547d015` | adapter/equivalence tests and unchanged snapshot semantics |
| M-D hardware | `codex/m-d-hardware` — `G:/LocalArcade-worktrees/m-d-hardware` | ✅ base integrated as `b788396`; U31 uncommitted in assembler | manual/detected/unknown/mismatch boundary tests; 12 U31 material-fact/acknowledgement proofs |
| M-E runtime | `codex/m-e-runtime` — `G:/LocalArcade-worktrees/m-e-runtime` | ✅ integrated as `884dac2`, `1d0ddfb`, `0f53fb9` | exact candidate rejection tests and reviewed M-C→M-E seam |
| M-G evidence | reused M-E review lane | ✅ integrated as `e3689eb` | exact/lossy/unsupported mappings and boundary tests |
| M-I inventory | `codex/m-i-inventory` — `G:/LocalArcade-worktrees/m-i-inventory` | ✅ integrated as `8d26720`, `6a9d860`, `dc87da1` | 11 inventory tests, 2 boundary tests, TypeScript equivalence, and independent mutation audit |
| M-J verification | `codex/m-j-verification` — `G:/LocalArcade-worktrees/m-j-verification` | ✅ base adapter integrated; execution producer uncommitted in assembler | Original commits plus U32 identity, fixed benchmark/quick protocols, suspended/job-owned process boundary, official JSON admission and genuine M-J preparation reachability; live external proof and surfaces remain queued |

## Gate snapshot — 2026-07-23

- Root gates: ✅ typecheck, lint, 155 TypeScript/UI tests, 36 boundary tests,
  registry freshness and production build.
- Runner `npm.cmd run check`: ✅ TypeScript, Rust formatting, Clippy with
  warnings denied, 164 Rust tests across all targets, and production build.
- U33–U37 execution subset: ✅ 15 fake-runner service tests, 5 transport tests
  and 80/80 combined Rust library tests. Combined plans run the benchmark
  before fixed quick checks; quick-only plans fail closed without structured
  load evidence. Typed Tauri commands are registered and consumed by the M-P
  desktop facade; no native live-model run is claimed.
- Contracts: ✅ 20 positive, 12 schema-negative and 12 semantic-negative
  fixtures. Documentation: ✅ UTF-8, mojibake and relative links across all
  80 Markdown files. The M-O/M-P capability and interface proofs pass.

## Mapping rule

The L and M namespaces intentionally describe different things. L0–L25 are
audited upstream source operations; M-A–M-P are Local Arcade responsibility and
permission boundaries. One L operation may inform several M modules, and a
Local Arcade module may combine preserved local behavior with only a narrow,
attributed part of llmfit. Progress remains attached to each Local Arcade
module across as many checkpoints as necessary; a partially wrapped core does
not become complete merely because one adapter exists.

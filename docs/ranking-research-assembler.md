# Ranking research assembler

Status: **Active checkpoint dashboard**, 2026-07-22. This document tracks the
owner-approved non-production ranking/audition research. It is an assembler
view, not evidence that future modules are implemented.

## Status legend

- ✅ implemented/audited baseline available
- 🟡 research lane active
- ⬜ future checkpoint or adapter not started
- ⛔ explicitly rejected or excluded from this checkpoint

## Combined llmfit and Local Arcade operation graph

This is a Mermaid architecture flowchart and dependency graph, adapted from the
detailed graph in `system-operation-graph.md`. M-A is the shared wire boundary
between upstream/domain evidence and every future orchestrated surface.

```mermaid
flowchart TB
  subgraph UP["llmfit upstream — upstream-baseline lane 🟡"]
    L1["✅ L1 hardware detection"]
    L3["✅ L3 override / simulation"]
    L4["✅ L4 model database"]
    L6["✅ L6 mutable catalog update"]
    L7["✅ L7 runtime providers"]
    L8["✅ L8 installed-model index"]
    L10["✅ L10 one-model fit"]
    L11["✅ L11 catalog fit + calibration"]
    L12["🟡 L12 composite ranking audit"]
    L14["✅ L14 model plan / upgrade deltas"]
    L16["✅ L16 endpoint benchmark"]
    L18["🟡 L18 community measurement rows"]
    L19["🟡 L19 local save → GitHub contribution path"]
    L21["⛔ L21 regex quality as certification"]
    L22["⛔ L22 composite routing as Local Arcade truth"]
    L1 --> L3 --> L10
    L4 --> L10 --> L11 --> L12
    L6 --> L4
    L7 --> L8 --> L11
    L18 --> L11
    L16 --> L19 --> L18
    L3 --> L14
    L4 --> L14
  end

  MA["✅ M-A shared first-slice v1 contracts\nTS + Rust DTOs · envelopes · canonical handoff\n18 accepted / 11 rejected fixtures"]

  subgraph RESEARCH["Approved non-production comparison checkpoint"]
    RU["✅ upstream + community-results audit"]
    RR["✅ constraint / Pareto / diversity baselines"]
    RC["✅ consensus scenario corpus"]
    RA["🟡 Apple/Metal external validation"]
    RH["🟡 frozen comparison harness + scorecards"]
    RPOL["⬜ owner-reviewed M-H policy recommendation"]
    RU --> RH
    RR --> RH
    RC --> RH
    RA --> RH
    RH --> RPOL
  end

  L1 --> MA
  L4 --> RU
  L10 --> RU
  L12 --> RU
  L18 --> RU
  L19 --> RU
  MA --> RESEARCH

  subgraph DOMAIN["Local Arcade preserved cores and target adapters"]
    MC["✅ core / ⬜ adapter — M-C exact artifact registry"]
    MD["✅ core / ⬜ adapter — M-D hardware reconciliation"]
    ME["✅ core / ⬜ adapter — M-E runtime compatibility"]
    MG["✅ core / ⬜ adapter — M-G evidence scope"]
    MB["⬜ M-B pinned llmfit adapter decision"]
    MF["✅ core / ⬜ adapter — M-F fit + performance"]
    MH["✅ legacy core / ⬜ target — M-H portfolio"]
    MI["✅ core / ⬜ adapter — M-I inventory"]
    MJ["✅ existing-engine core / ⬜ adapter — M-J verification"]
    MC --> ME --> MF
    MD --> MF
    MG --> MF
    MB --> MF
    MF --> MH
  end

  L10 -. "attributed advisory only" .-> MB
  L18 -. "scoped provenance required" .-> MG
  MA --> MC
  MA --> MD
  MA --> ME
  MA --> MG
  MA --> MB
  RPOL --> MH

  subgraph MEASURE["Local measurement and evidence loop"]
    PF["✅ preflight core"]
    INV["✅ read-only inventory core"]
    BENCH["✅ existing-engine benchmark core"]
    QUICK["✅ mechanical quick-check core"]
    CAL["✅ calibration eligibility boundary"]
    STORE["⬜ normalized local evidence store"]
    INV --> PF --> BENCH --> CAL --> STORE
    PF --> QUICK --> STORE
  end

  MI --> INV
  MJ --> PF
  L16 -. "mechanics may be adapted" .-> MJ
  STORE --> MG

  subgraph APP["Future application and surfaces"]
    MO["⬜ M-O use-case orchestration"]
    WEB["⬜ M-P website finder / portfolio / detail"]
    DESK["⬜ M-P desktop handoff / verification"]
    CLI["⬜ CLI parity"]
    ARENA["⬜ later private Arena"]
    PUBLIC["⛔ public Arena / upload / evidence service"]
    MO --> WEB
    MO --> DESK
    MO --> CLI
    DESK --> ARENA
  end

  MH --> MO
  MI --> MO
  MJ --> MO
  MA --> MO
```

## Active lanes

| Lane | Status | Baseline | Deliverable | Integration rule |
|---|---|---|---|---|
| assembler/root | 🟡 active | M-A commits `55afbb2`, `a7c634f` | shared schema, combined graph, progress, final comparison | only root merges or changes shared research contracts |
| upstream-baseline | ✅ integrated as `865cf60` | lane commit `e1ca38f` | llmfit rank/community pipeline and exact/lossy/unsupported audit | community rows remain scoped priors; data reuse unresolved |
| ranking-methods | ✅ integrated as `5b45c35` | lane commit `28c7fe4` | hard constraints, interval Pareto, parameterized diversity, seven tests | experimental paths only; no product weights |
| consensus-corpus | ✅ integrated as `db1f516` | lane commit `f1f67ac` | five scenarios, consideration/exclusion rules, schema and validator | consensus remains defeasible |
| apple-validation | 🟡 active — `codex/research-apple`, `G:/LocalArcade-worktrees/apple` | research baseline `4e153f6` (contains M-A `55afbb2`) | Apple Silicon/Metal reference research | no production policy or unlicensed ingestion |
| comparison-harness | 🟡 active — `codex/research-harness`, `G:/LocalArcade-worktrees/harness` | integrated baseline `db1f516` | reconciled interchange, fixtures, reproducible scorecards | no product weights or production imports |

## Community-result questions assigned to upstream lane

The upstream audit must establish from source and fixtures:

1. what llmfit records locally after a benchmark;
2. how a user explicitly opts into contribution;
3. how authentication/device flow and GitHub PR creation work;
4. which validation runs before the PR is produced;
5. which exact hardware, model, runtime, settings, sample and provenance fields
   survive into a community row;
6. how rows are reviewed, merged, embedded and matched to another user;
7. whether local, llmfit-community and localmaxxing measurements remain
   distinguishable;
8. license/terms and whether Local Arcade may reference, cache or redistribute
   those rows;
9. trust weaknesses: self-reporting, duplicate submissions, version drift,
   malicious rows, selection bias and incomparable settings.

Until that audit lands, community rows are useful candidate evidence but are
not automatically eligible for exact Local Arcade ranking or publication.

## Progress log

- ✅ Wave 0 preservation/documentation baseline committed: `59e6dd1`.
- ✅ M-A shared contracts approved and committed: `55afbb2`.
- ✅ Clean-baseline compatibility correction committed: `a7c634f`.
- ✅ Ranking/audition research plan approved by the product owner.
- ✅ Four research worktrees created from shared baseline `4e153f6`.
- ✅ Ranking-method lane integrated: `5b45c35`; research gate has seven passing
  tests.
- ✅ Upstream/community audit integrated: `865cf60`.
- ✅ Consensus corpus integrated: `db1f516`; five scenarios pass and two
  negative fixtures fail as intended.
- 🟡 Apple/Metal lane active.
- 🟡 Comparison-harness reconciliation active in a fifth isolated worktree.
- ✅ Research-only comparison interchange v1 created under
  `research/comparison/`; valid smoke fixture passes and forward version fails.
- ⬜ Lane artifacts reconciled into the shared interchange and harness.
- ⬜ Comparative scorecards complete.
- ⬜ Owner selects or rejects an M-H policy.

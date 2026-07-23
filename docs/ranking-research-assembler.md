# Ranking research assembler

Status: **Owner review**, 2026-07-22. This document tracks the
owner-approved non-production ranking/audition research. It is an assembler
view, not evidence that future modules are implemented.

Owner-review synthesis: [ranking and audition findings](research/ranking-and-audition-findings.md).

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
    RA["✅ Apple/Metal external validation"]
    RH["✅ comparison harness / actual matched scorecards blocked"]
    RPOL["✅ owner selected compatibility-only M-H\nno ranking winner demonstrated"]
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
    MC["[DONE] M-C exact artifact registry adapter"]
    MD["[DONE] M-D hardware reconciliation adapter"]
    ME["[DONE] M-E runtime compatibility adapter"]
    MG["[DONE] M-G evidence scope adapter"]
    MB["[PARTIAL] M-B isolated direct-core + TS boundary\n[MISSING] Rust-to-TS transport + M-C crosswalk"]
    MF["[DONE] M-F pure assessment adapter\n[PARTIAL] real admitted profile producer"]
    MH["[DONE] compatibility-only portfolio boundary\n[PARTIAL] real data + M-O handoff"]
    MI["[DONE] M-I inventory adapter"]
    MJ["[DONE] M-J verification preparation adapter"]
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
| apple-validation | ✅ integrated as `af06221` | lane commit `10ca283` | Apple/Metal evidence boundary, schema, fixtures, eight-source inventory | Anubis rows remain reference-only; terms unresolved |
| comparison-harness | ✅ integrated as `6732d00` | lane commit `f02f28b` | reconciled interchange, two valid/two invalid fixtures, six harness tests | actual matched scorecards blocked on comparable inputs |

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
- ✅ Apple/Metal lane integrated: `af06221`.
- ✅ Comparison harness integrated: `6732d00`; two valid fixtures pass, two
  invalid fixtures fail, and six harness tests pass.
- ✅ M-A measurement-series golden inconsistency corrected with a cross-runtime
  semantic guard: `7bddf7e`.
- ✅ Research-only comparison interchange v1 created under
  `research/comparison/`; valid smoke fixture passes and forward version fails.
- ✅ Lane semantics reconciled into the shared interchange and harness.
- ✅ M-B provider research pinned official llmfit `v1.1.6` at
  `aaa2bc179cec214ccdc44501c853b98fba0b343b`, retained the MIT notice and
  real CLI outputs, and recorded the CLI's host-detection and fail-open enum
  boundaries.
- ✅ The owner approved a pinned direct-core, formula-only M-B spike with
  provider discovery, local history, community and localmaxxing evidence
  disabled. The CLI remains a research oracle.
- ✅ The isolated Rust provider accepts explicit input, calls only the pinned
  embedded-catalog formula path and passes 10 tests plus fmt/clippy. The
  TypeScript request/envelope proposal and research lanes pass 32 tests.
- 🟡 M-B remains partial: upstream's unconditional HTTP/provider/update
  dependency surface prevents runner linking; the Rust raw DTO has no transport
  into the TypeScript envelope; M-C has no verified upstream-family crosswalk;
  and M-F receives no live advisory. All four gaps are surfaced as blockers.
- ⛔ Actual comparative scorecards blocked: identical candidate/configuration
  inputs and admissible measured labels are not yet available.
- ✅ The owner selected the minimal compatibility-only M-H policy: at most five
  distinct families, one exact configuration per family, no weighted score and
  no claim of ranking superiority. Matched real evaluation remains required
  before adopting any future ranker or claiming an improvement over llmfit.

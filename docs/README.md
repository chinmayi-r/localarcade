# Local Arcade documentation map

This file defines document authority. The repository contains several eras of
implementation and design; a newer draft does not make older working code fake,
and a completed old milestone does not authorize a conflicting new interface.

## Read order

1. `../AGENTS.md` — repository-wide invariants and working rules.
2. `PRODUCT-BRIEF.md` — product-owner-approved concise product authority.
3. `strategy-and-product-rationale.md` — subordinate rationale and pivot context;
   it is not build authorization.
4. `MILESTONE-STATUS.md` — audited facts about what currently exists.
5. The eight Wave 0 audit reports below — preservation, classification and
   dependency evidence for current code.
6. `screen-contract.md` and `design-foundation.md` — product-owner-approved
   first-slice surface and design authorities.
7. `contracts/README.md` and its schema/fixtures — approved minimal shared
   contracts for the first slice.
8. `prototypes/README.md` — handling rules for illustrative design references.
9. `modular-architecture-v2.md` and `system-operation-graph.md` — broader
   proposed architecture, limited by owner-approved direction and any later
   approved contracts.
10. `worktree-execution-plan.md` — approved dependency direction/order; each
    checkpoint remains separately scoped.
11. `system-build-assembler.md` — live implementation graph, worktree ledger
    and progress overlay; it reports status but does not override module
    contracts or checkpoint exclusions.

If these disagree, stop and record the conflict. Do not silently select the
document that makes the requested code easiest.

## Authority classes

### Audited implementation truth

- `MILESTONE-STATUS.md`
- executable tests and production code
- `SECURITY-LEDGER.md`
- `DECISIONS.md` for the decision that produced the implementation

### 2026-07-22 Wave 0 preservation baseline

The following eight reports are approved as the repository audit. They record
evidence and reviewed dispositions; they do not claim that proposed modules are
already implemented.

- `document-authority-map.md`
- `dirty-file-provenance.md`
- `module-status.md`
- `module-dependency.json`
- `module-ownership.md`
- `reuse-revise-retire-missing.md`
- `integration-test-matrix.md`
- `unresolved-decisions.md`

`repository-audit-2026-07-21.md` appeared as a concurrent convenience index
after the baseline was approved. It is not a ninth audit report and does not
override the eight reports or current U1–U7 resolutions.

### Product-owner-approved first-slice authorities

- `PRODUCT-BRIEF.md`
- `screen-contract.md`
- `design-foundation.md`
- `contracts/README.md`
- `contracts/local-arcade-first-slice-v1.schema.json`
- `worktree-execution-plan.md`

### Broader design research — not active screen authority

- `modular-architecture-v2.md`
- `evidence-ranking-api-ux.md`
- `system-operation-graph.md`
- `interface-design-program.md`
- `ui-reference-and-screen-plan.md`
- prototypes under `prototypes/`

The two older screen inventories are preserved research. `screen-contract.md`
records the approved retained/rejected reconciliation and is the active
first-slice matrix. Prototypes remain illustrative design references.

### Historical execution contracts and retained experiments

- `agent-plan.md` records the completed M-1–M9 and R1–R4 program. Its completed
  acceptance gates remain useful, but it is not the next product roadmap.
- `decision-tree.md` and `recommendation-decision-system.md` retain existing
  safety/ranking invariants.
- `localhost-quick-test.md` documents a retired website experiment whose
  loopback and deterministic-task code remains available for reuse.

### Research and rationale

- `community-demand-research.md`
- `llmfit-core-adoption-audit.md`
- `ranking-and-audition-research-plan.md` — approved comparative research gate
  before M-H/M-O; not production authorization.
- `ranking-research-assembler.md` — active combined llmfit/Local Arcade Mermaid
  dependency graph and parallel-lane progress dashboard.
- `research/matched-ranking-hypothesis-protocol.md` — proposed operational
  collection and matched-evaluation contract; thresholds remain owner decisions.
- `persona-findings.md`
- `evidence-evaluation-contract.md`
- `strategy-and-product-rationale.md` — conversation context and long-term
  rationale; explicitly subordinate to the product brief and decision ledger.

## Private-product boundary

Local Arcade documentation and public APIs do not name a private downstream
consumer. Integration is through `ConfigurationEvidenceBundleV1` or its reviewed
successor. A receiving system chooses what it needs and must earn its own
workflow-specific conclusions.

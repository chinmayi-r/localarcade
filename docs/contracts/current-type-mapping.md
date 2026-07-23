# Current TypeScript and Rust compatibility map

Status: **Approved v1 mapping summary**. No working implementation is replaced by this document. See `compatibility-report.md` for the exhaustive field and enum audit.

Compatibility meanings: **direct** = same meaning and mechanically adaptable; **partial** = useful fields exist but identity/state is incomplete; **none** = new boundary required; **conflict** = same concept uses materially different vocabulary or semantics.

| Approved contract | Current TypeScript sources | Current Rust sources | Compatibility | Required adapter / constraint |
|---|---|---|---|---|
| `hardware-target` | `RecommendationQuery`, `HardwareProfile`; accelerator `AcceleratorEntry`/`MemoryDerivation` | `HardwareReport`, `DetectedGpu`, `GpuReconciliation` | partial | M-D adapter creates stable target ID, maps website platform IDs to OS/backend, preserves manual vs detected source, converts GiB→bytes, and requires user confirmation for unknown/variant memory. Rust report currently lacks the website task-independent target envelope. |
| `recommendation-request` | `RecommendationQuery`, `TaskId`, `StrategyId` | none | partial | Task/priority enums now match current vocabulary. Preserve `general`; convert desired context units explicitly; add needs, scope and artifact-size fields without implying download behavior. |
| `exact-configuration-candidate` | `RecommendationCandidate`; registry `ArtifactRegistryRecord`; runtime `Product`, `RuntimeBuild`, `CompatibilityAssertion` | `FoundArtifact`/`RegistryMatch` supply local-file identity only | partial | M-C/M-E adapter joins immutable artifact, model family, product/engine build, backend and complete settings. Current candidate fields are close but split across modules; exact SHA is mandatory and promoted registry status cannot be inferred from a found filename/size. |
| `fit-evidence-assessment` | `FitResult`, two-pool result in `memory-pools.ts`, `ComparativeValue`, `EvidenceRecord`/`EvidenceClaim` | benchmark/preflight types are observations, not fit assessments | partial | M-F/M-G adapter preserves detailed device/system pools, prompt/decode/TTFT ranges, and every orthogonal provenance dimension. Mapping must not upgrade source or match scope. |
| `recommendation-portfolio` | `RecommendationOutcome`, `RecommendationItem`, `RecommendationRole` | none | partial | M-H/M-O adapter maps current roles (`quality-option`, `fast-option`, etc.) to v1 portfolio roles only where policy meaning matches, keeps five-family limit, and maps `no-coverage` to `coverage-gap`. No ordering is added to compatible-only outcomes. |
| `runner-handoff` | no shared handoff type; candidate/query types are components | no handoff type | none | M-A canonical serializer embeds request, target, exact candidate and evidence summary with version/time/24-hour expiry/hash. It contains no model data or side-effect authorization. |
| `compatibility-admission-receipt` | `RuntimeBuild`, `CompatibilityAssertion`, and M-E package input contain every evaluated fact; the exact candidate previously discarded OS/architecture/package/assertion detail | M-J previously had only candidate/tool identity and an explicit missing-proof warning | direct after normalization | M-E emits the independently versioned receipt only after successful compatibility evaluation. OS and architecture aliases normalize to frozen literals; unknown aliases fail closed. M-J accepts only a typed validated receipt and binds it to candidate, inventory and current Windows architecture. |
| benchmark/quick-check plans and results | runtime/evidence types provide components | benchmark, preflight and quick-task structs | partial | Keep plan/result types separate; retain warmups, raw measurement series, per-series/check evidence and diagnostics. Higher-level verification references both. |
| Common envelopes | `RecommendationOutcome` has domain unions but no shared status envelope | command results often return structs or `Result<_, String>` | none/conflict | M-A defines one versioned envelope and stable reason-code registry. M-O maps domain unions and typed Rust errors; surfaces never parse free-form strings to choose behavior. |

## Approved vocabulary decisions for v1

- Contract provenance retains source, method, hardware/configuration match,
  task/prompt/harness scope, sample/time/unit/interval/confidence/eligibility and
  raw-record reference as orthogonal fields.
- `verified` remains a derived display claim, not a source method.
- `coverage-gap` is the contract outcome corresponding to current `no-coverage` behavior.
- `blocked` is an envelope status, not “nothing fits.”
- `partial` preserves contract-typed data plus explicit completeness, missing
  portions, warnings and recovery; it is not permission to guess.
- Website hardware is always `self-reported`; only the runner can emit `detected`.

## Required future compatibility proofs

1. Golden fixture round trips in TypeScript and Rust preserve every field and reject unknown versions/statuses.
2. Current recommendation golden outcomes map to v1 portfolio/envelope states without changing ordering or fail-closed behavior.
3. Existing fit goldens map to independent byte pools without GiB rounding loss.
4. Hardware fixtures map known, ambiguous, mismatch, unknown, and manual cases without inferred memory.
5. Benchmark parser fixtures map raw samples and conditioned/calibration exclusions without evidence upgrade.
6. Import-boundary tests prove website and runner surfaces consume only M-O use cases and M-A DTOs after adapters land.

The original M-A corpus and the additive U25 admission-receipt corpus now carry
these proofs in TypeScript and Rust. Later M-O work must bind the receipt and
candidate in one use-case result; the receipt is not a public or cryptographic
attestation.

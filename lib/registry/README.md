# Versioned registries

This module is the admission gate for real artifact and accelerator data. It is deliberately separate from the prototype recommendation catalog.

## M-C contract boundary

`toRegistryArtifactIdentity` maps one admitted, explicitly promoted registry
record to the artifact/family portion of the approved M-A exact-configuration
candidate. It deliberately does not construct a candidate: M-E must add an
explicit runtime configuration before that contract is complete.

`toRegistryArtifactSnapshot` applies the existing snapshot validation and
seven-day freshness policy, exposes promoted identities, and preserves triage
and quarantine state. Both functions fail closed rather than normalize an
incompatible hash, promote a lifecycle state, or invent a missing value.

The adapter retains all fifteen field-provenance records. The compact M-A
provenance rows identify the source field through `rawSourceRecordRef`; the
original field map remains available as registry metadata for M-E/M-G.

## Artifact admission

A downloadable artifact cannot enter a published recommendation until the record includes its publisher/repository, immutable revision, exact filename, SHA-256, byte size, format, quantization, maximum context, license source and retrieval time. Artifact identity is runtime-neutral. Product/engine compatibility is stored as separate versioned assertions.

## Hardware admission

An accelerator name alone is not enough to infer memory. Each desktop, laptop, integrated or SoC memory variant is represented explicitly and carries its own vendor source. Aliases normalize search; they never collapse distinct memory variants.

## Refresh flow

The Hugging Face flow has two deliberately separate commands:

1. `npm run discover` queries the documented Hub API using the editable trusted-publisher policy in `registry/policy/hugging-face.json`. It writes a lock containing immutable repository revisions. Discovery is mutable and is the review boundary.
2. `npm run ingest` reads only that lock, requests the pinned revisions, bulk-enumerates GGUF files and writes `registry/generated/artifacts.json` only after the complete snapshot validates and clears the policy scale floor.

Each admitted record includes field-level source URLs and retrieval timestamps. Missing hashes, byte sizes, base-model relations, licenses, context metadata or chat templates quarantine the individual artifact. Split GGUF packages and helper/projector files are also quarantined until package-level identity is modeled. A fetch, revision, validation or scale failure occurs before the atomic rename, so the previous valid snapshot remains active.

Catalog metadata establishes artifact identity and compatibility inputs; it does not establish real speed, stability, task quality or a ranking.

## Freshness and promotion

- `lastIngestSucceededAt` records the latest complete successful admission run; `npm run build` fails once it is older than seven days.
- The scheduled workflow refreshes discovery and admission every Monday and Thursday and opens or updates a review pull request.
- Newly observed immutable artifact identities enter as `triage`. Existing lifecycle status is preserved across refreshes.
- Promotion is intentionally human-readable: change one artifact's `status` from `triage` to `promoted` in the generated snapshot after review. Production candidate adapters also require promoted status.
- Previously admitted immutable records are retained when mutable discovery moves to a new upstream revision, preventing an evidence-backed production configuration from disappearing silently.

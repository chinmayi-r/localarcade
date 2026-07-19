# Versioned registries

This module is the admission gate for real artifact and accelerator data. It is deliberately separate from the prototype recommendation catalog.

## Artifact admission

A downloadable artifact cannot enter a published recommendation until the record includes its publisher/repository, immutable revision, exact filename, SHA-256, byte size, format, quantization, maximum context, license source and retrieval time. Artifact identity is runtime-neutral. Product/engine compatibility is stored as separate versioned assertions.

## Hardware admission

An accelerator name alone is not enough to infer memory. Each desktop, laptop, integrated or SoC memory variant is represented explicitly and carries its own vendor source. Aliases normalize search; they never collapse distinct memory variants.

## Refresh flow

The Hugging Face flow has two deliberately separate commands:

1. `npm run discover` queries the documented Hub API using the editable trusted-publisher policy in `registry/policy/hugging-face.json`. It writes a lock containing immutable repository revisions. Discovery is mutable and is the review boundary.
2. `npm run ingest` reads only that lock, requests the pinned revisions, bulk-enumerates GGUF files and writes `registry/generated/artifacts.json` only after the complete snapshot validates and clears the policy scale floor.

Each admitted record includes field-level source URLs and retrieval timestamps. Missing hashes, byte sizes, base-model relations, licenses, context metadata or chat templates quarantine the individual artifact. Split GGUF packages and helper/projector files are also quarantined until package-level identity is modeled. A fetch, revision, validation or scale failure occurs before the atomic rename, so the previous valid snapshot remains active.

The generated registry is not imported by the website before M4. Catalog metadata establishes artifact identity and compatibility inputs; it does not establish real speed, stability, task quality or a ranking.

# Versioned registries

This module is the admission gate for real artifact and accelerator data. It is deliberately separate from the prototype recommendation catalog.

## Artifact admission

A downloadable artifact cannot enter a published recommendation until the record includes its publisher/repository, immutable revision, exact filename, SHA-256, byte size, format, quantization, maximum context, license source and retrieval time. Artifact identity is runtime-neutral. Product/engine compatibility is stored as separate versioned assertions.

## Hardware admission

An accelerator name alone is not enough to infer memory. Each desktop, laptop, integrated or SoC memory variant is represented explicitly and carries its own vendor source. Aliases normalize search; they never collapse distinct memory variants.

## Refresh flow

Future importers should create a complete `RegistrySnapshot`, validate it, and publish it atomically. A failed or partial refresh leaves the previous snapshot active. Ranking evidence remains a separate layer because catalog metadata cannot establish real speed, stability or task quality.

The first importer is `npm run registry:import:hf`. Its source manifest pins an exact Hugging Face revision and filename. The importer requests blob metadata, verifies the returned revision, LFS SHA-256, byte size, parsed GGUF context, license file and runtime source, then replaces the generated snapshot only after the whole snapshot validates.

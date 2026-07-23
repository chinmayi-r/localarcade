# M-A shared contracts

This package is the executable TypeScript boundary for the approved first-slice
v1 schema in `docs/contracts/local-arcade-first-slice-v1.schema.json`. The Rust
mirror is `runner/src-tauri/src/contracts.rs`. Both implementations consume the
same positive and negative fixture corpus.

`schemaVersion: 1` is the only accepted version. Unknown and forward versions
fail closed; version negotiation belongs to a future explicitly approved
contract revision.

The additive `runner-import-bundle` has an independent
`importBundleVersion: 1`. It contains the unchanged `runner-handoff` v1 plus
the M-E compatibility-admission receipt and binds their candidate, artifact,
runtime, operating-system, backend and quantization identities. It carries no
model data or side-effect authorization. Its own canonical `contentHash`
protects the complete two-payload snapshot and excludes only itself.

Core DTOs, canonical serialization and envelope validation do not import
product modules. Legacy mappings live only under `adapters/`. An adapter must
return a typed `blocked` result when translation would discard information or
invent an approved field.

Reason-code ownership is divided as follows:

- `mapping.*`: M-A adapter failures;
- domain and use-case reason codes: the owning M-C–M-O module in later
  checkpoints;
- transport/presentation wording: M-O/M-P, without changing the stable code.

M-A performs no network, filesystem, UI, process-execution or Tauri IPC work.

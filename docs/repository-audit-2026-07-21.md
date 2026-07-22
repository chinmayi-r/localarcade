# Local Arcade repository audit

Audit begun 2026-07-21; completed and reverified 2026-07-22.

This is the entry point for the preservation audit requested before the product
pivot. It prevents agents from treating either the existing implementation or
the proposed M-A–M-P architecture as automatically authoritative.

## Audited conclusion

Preserve the green data, fit, evidence, recommendation, inventory, benchmark,
security-boundary, and rating cores. Wrap and split them behind reviewed module
contracts. Replace obsolete or dormant shells and direct orchestration only
after shared contracts and screen states receive explicit content approval.

The repository should not be rewritten wholesale. It should also not be
presented as already conforming to the target architecture.

## Evidence set

Read these reports together:

1. [Document authority map](document-authority-map.md) — what each document can
   and cannot govern.
2. [Dirty-file provenance](dirty-file-provenance.md) — committed, recovered and
   proposed work that must not be overwritten blindly.
3. [Module status](module-status.md) — every production file and test mapped to
   M-A through M-P.
4. [Module dependency graph](module-dependency.json) — proposed dependency and
   ownership constraints in machine-readable form.
5. [Module ownership](module-ownership.md) — conflict zones and adapter seams.
6. [Reuse/revise/retire/missing](reuse-revise-retire-missing.md) — preservation
   recommendations.
7. [Integration test matrix](integration-test-matrix.md) — present coverage and
   required cross-module tests.
8. [Unresolved decisions](unresolved-decisions.md) — product and architectural
   decisions that still block implementation.

## Verification result

On 2026-07-22:

- root `npm.cmd run check` passed: typecheck, lint, 119 tests, registry
  freshness, and production build;
- runner `npm.cmd run check` passed: TypeScript, Rust formatting, Clippy with
  warnings denied, 26 Rust tests, and Vite build;
- all four recovered prototypes were present under `docs/prototypes/`;
- the local Markdown audit found no broken relative links after the missing
  authority files were repaired.

Passing gates prove the current implemented behavior, not product completeness.

## Highest-risk current seams

1. Website components call recommendation, evidence, and accelerator modules
   directly because M-O does not exist.
2. Runner UI invokes individual Tauri commands directly rather than one use-case
   orchestrator.
3. Candidate assembly currently crosses registry, runtime, fit-profile, and
   recommendation ownership.
4. Related TypeScript and Rust identities are fragmented rather than validated
   against shared canonical fixtures.
5. The current website and runner shells predate the proposed replacement
   screens, whose consolidated contract remains in review.
6. Public contribution/service modules are absent despite the presence of dark
   battle rating math.

## Safe next action

The actual product brief, consolidated screens, design foundation, resolved v1
schemas, and execution direction/order are approved. Execute only the explicit
root-owned M-A checkpoint next; do not create parallel implementation worktrees
or begin M-O/shell work.

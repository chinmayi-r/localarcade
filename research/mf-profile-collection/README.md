# M-F raw profile-collection machinery

Status: **non-production research proof**.

This directory proves the mechanics needed before U27 can be decided:

- `collection-bundle-v1.schema.json`, matching TypeScript types and the semantic
  validator define a versioned raw bundle that retains the complete candidate,
  compatibility receipt,
  hardware target, canonical producer digests, exact tool identity, argv and
  repeated per-context observations;
- validation rejects malformed values, unknown fields, stale digests,
  same-ID mutation, producer mismatch and unsupported hardware/run paths;
- derivation requires exact agreement across repetitions and exact context
  scaling, then emits only `proposed-unreviewed`;
- the policy sweep reports false-fit and false-no-fit counts for every supplied
  synthetic candidate and always returns `selectedPolicy: null`;
- production readiness passes by returning explicit `unavailable`.

All fixtures are `synthetic-machinery-only`. They do not prove production data,
safe reserves, a useful margin, hardware equivalence, usability, or ranking
superiority. No process is invoked and no registry, network, storage, UI,
runner, production contract or manifest authority is imported.

The hard unresolved decision remains whether measurements are usable only for
their exact `hardwareTargetId` or through a future owner-approved, versioned
hardware-equivalence scope. The current machinery does not generalize.

Run:

```powershell
npm.cmd run proof:mf-collection-contract
npm.cmd run proof:mf-profile-derivation
npm.cmd run proof:mf-policy-evaluation
npm.cmd run proof:mf-production-readiness
```

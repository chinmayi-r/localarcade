# M-F profile and capacity-policy admission proof

Status: non-production executable contract evidence.

This lane proves that allocation observations and reserve policy records do not
become M-F inputs merely because their arithmetic looks plausible. Admission
requires independently complete source scope, exact equality with the admitted
candidate/receipt/hardware target, valid arithmetic, and attributable
provenance.

The profile also retains raw observations, tool identity and command text; its
declared evidence ceiling may not exceed the largest retained observation.
Profiles and policies must match an injected reviewed-record manifest by
canonical SHA-256, and policy entries require owner-approved status. The
manifest is a trust-store input owned by the future assembler, never request
data. This proof uses an explicitly synthetic test manifest and does not create
a production profile or policy.

The output types are branded and are the only profile/policy types accepted by
the M-F assessment input. The older assessment proof obtains both values
through these functions, while the assessment repeats critical bindings so a
mutated in-memory admitted value still fails closed.

The checked legacy record in `registry/evidence/fit-profiles.json` is exercised
directly and must remain blocked until its absent source-scope fields are
supplied by reviewed evidence. The adapter may not reconstruct them from the
selected candidate.

Run:

```powershell
npm.cmd run proof:mf-admission
```

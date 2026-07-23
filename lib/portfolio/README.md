# M-H recommendation portfolio boundary

`buildRecommendationPortfolio` is the isolated, side-effect-free M-H boundary.
It consumes a validated M-A recommendation request and a versioned exhaustive
candidate-universe receipt. Every frozen snapshot artifact must appear exactly
once as either a fully bound candidate or an explicit upstream gap.

Candidate entries also require a process-local composition brand created by
`admitPortfolioCandidateEntry` immediately after the trusted assembler receives
the M-E candidate/receipt and M-F assessment. The brand covers the complete
entry and is rechecked at consumption, so copied or post-admission-mutated
producer content fails closed. It is not a wire receipt, attestation or
request-controlled trust signal; M-O must own this immediate composition seam.

The approved v1 policy:

- applies request and fit constraints before selection;
- keeps one exact configuration per model family and at most five families;
- uses evidence-channel set dominance, then only the directly requested
  priority;
- uses an independently reviewed familiarity signal only as a tie-break;
- uses frozen catalog position as the final product-neutral reference order;
- preserves unresolved evidence and deterministic identity ties in the ledger;
- rejects contradictory exact task-success evidence and unattributed upstream
  gaps;
- emits only unranked M-A portfolios, `coverage-gap`, or `nothing-fits`.

It has no weighted score, reduced-context fallback, ranked role assignment,
domain I/O, registry import, presentation logic, or dependency on the legacy
recommendation package.

The result is `{ envelope, ledger }`. `envelope` is always an M-A
`recommendation-portfolio` envelope. `ledger` contains exactly one disposition
row per universe entry so exclusions and upstream gaps cannot disappear.

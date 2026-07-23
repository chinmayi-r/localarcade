# M-H executable proof

This non-production suite exercises the pure `lib/portfolio` boundary with
synthetic exact candidates derived from the approved M-A fixtures and an
admitted M-F assessment fixture. It proves the portfolio remains unranked,
bounded, exhaustive, deterministic, immutable and fail-closed.

Run it directly:

```powershell
npx.cmd tsc -p research/mh-portfolio/tsconfig.json
node --import tsx --test research/mh-portfolio/portfolio.test.ts research/mh-portfolio/boundary.test.mjs
```

The cases cover representative selection, family alternatives, request
constraints, missing coverage, no-fit outcomes, mixed partial evidence,
identity drift, post-admission producer mutation, contradictory exact evidence,
unattributed gaps, hostile getters, permutation invariance and M-A output
validation. The fixture values are illustrative test data and are not
production recommendations.

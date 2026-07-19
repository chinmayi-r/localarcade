# Security ledger

Security-sensitive automation is copied from official or project-maintainer sources and pinned by full commit SHA. This file is the review queue required by the agent plan.

## Copied and pinned

| File | Mechanism | Source | Copied | Review state |
|---|---|---|---|---|
| `.github/workflows/ci.yml` | Checkout and Node setup | https://github.com/actions/checkout · https://github.com/actions/setup-node | 2026-07-19 | Pinned |
| `.github/workflows/ci.yml` | Dependency review | https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/configure-dependency-review-action | 2026-07-19 | Pinned |
| `.github/workflows/codeql.yml` | CodeQL advanced setup | https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning | 2026-07-19 | Pinned |
| `.github/workflows/scorecard.yml` | OpenSSF Scorecard | https://github.com/ossf/scorecard/blob/main/.github/workflows/scorecard-analysis.yml | 2026-07-19 | Pinned |
| All workflow jobs | Harden Runner audit mode | https://github.com/step-security/harden-runner | 2026-07-19 | Pinned |
| `.github/dependabot.yml` | Dependabot npm and Actions updates | https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference | 2026-07-19 | Copied |
| `.github/workflows/registry-refresh.yml` | Scheduled workflow syntax, checkout, Node setup and GitHub CLI pull-request flow | https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule · https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request | 2026-07-19 | Pinned |

## Hand-written, needs review

| File | Mechanism | Why hand-written | Review state |
|---|---|---|---|
| `lib/quick-test/endpoint-policy.ts` | Exact loopback URL allowlist for browser benchmark requests | No Tier-1 application template exists for this product-specific boundary; URL parsing uses the browser platform API and fails closed before `fetch`. | Needs review |

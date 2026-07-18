# Security policy

Do not open a public issue for a suspected vulnerability. Send a minimal report to `security@localarena.dev` with affected behavior, reproduction steps, and impact. Do not include model weights, user prompts, device identifiers, tokens, or other sensitive data.

## Runner trust boundaries

The future runner is a separate security-sensitive product. It must not be implemented as an extension of the website bundle. Before any public runner release, require a threat model, signed and reproducible releases, sandboxed execution, explicit per-model consent, resource ceilings, a network allowlist, automatic update rollback, artifact hash verification, telemetry minimization, and an independent security review.

The website currently contains demonstration data and browser-local interactions only. It does not collect device telemetry or execute models.

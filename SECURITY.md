# Security policy

Do not open a public issue for a suspected vulnerability. Send a minimal report
to `security@localarcade.dev` with affected behavior, reproduction steps, and
impact. Do not include model weights, user prompts, device identifiers, tokens,
or other sensitive data.

## Runner trust boundaries

The desktop runner is a separate security-sensitive application inside this
repository. It is not an extension of the website bundle. Its current capability
boundary is recorded in `docs/MILESTONE-STATUS.md` and enforced by runner tests:
explicit-action hardware detection, read-only model-store scanning, and
controlled execution through user-selected llama.cpp binaries and model files.
It has no runtime HTTP client, listening socket, updater, download or upload
capability.

Before a public runner release or any expansion to downloaded artifacts, retain
the signed/reproducible release requirements, artifact hash verification,
resource ceilings, explicit action-specific consent and the unresolved sandbox
review in [the runner threat model](docs/runner-threat-model.md). Unknown safety
states fail closed.

The website does not detect hardware, scan files or execute models. It may use
self-reported hardware and hosted public evidence only when their provenance and
claim boundaries remain visible.

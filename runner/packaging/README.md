# Runner packaging (drafts)

Distribution policy (DECISIONS.md 2026-07-19): **installer tools only** — winget on Windows, Homebrew on macOS. The app contains no self-update code; users update through these tools, and trust comes from the release pipeline's cosign signatures + SLSA provenance (`.github/workflows/runner-release.yml`).

These manifests are **drafts**: both registries require a public GitHub release with stable download URLs before submission, which doesn't exist yet. Fields marked `TODO-release` are filled from the first published `runner-v*` release.

- `winget/` — manifest per https://learn.microsoft.com/en-us/windows/package-manager/package/manifest (submitted to microsoft/winget-pkgs by PR)
- `homebrew/` — cask per https://docs.brew.sh/Cask-Cookbook (submitted to homebrew/homebrew-cask or served from a project tap)

Rule: manifests always pin the exact release asset URL and its SHA-256 — never a `latest` redirect.

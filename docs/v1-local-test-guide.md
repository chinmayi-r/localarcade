# Local Arcade V1 local test guide

Status: **Unsigned Windows test candidate — not a public release.**

This build is ready for an owner-operated test of the direct local runner
journey. It does not require a website bundle. The current website finder can
still be tested separately, but its production M-O portfolio handoff remains
blocked until a live capture is reviewed into M-F with an approved capacity
policy.

## Install

Prefer the NSIS installer:

`runner/src-tauri/target/release/bundle/nsis/Local Arcade Runner_0.1.0_x64-setup.exe`

The MSI alternative is:

`runner/src-tauri/target/release/bundle/msi/Local Arcade Runner_0.1.0_x64_en-US.msi`

These local artifacts are intentionally unsigned. Windows may show an
unrecognized-app warning. Do not redistribute them as a trusted public release;
the repository release workflow supplies signing and provenance for a future
tagged release.

Validated SHA-256 values for this test build:

```text
NSIS  cfb0a25e223203badbf5472405bd0c6b8d81d3be47bb75b3495d95e6fa83f204
MSI   01bb265dd654310d3bda85e7bda4e790a08c7c1c5d1de72707488147fa05dd9d
EXE   41089f70b9ab1434832c212ff493da46d3412804a204d7c4a2c2cac152468ab2
```

## Test the direct local journey on this machine

1. Open Local Arcade Runner and choose **Check this computer**.
2. Review the detected Windows, CPU, RAM and accelerator facts. This machine is
   expected to require acknowledgement that the one CUDA GPU is selected while
   the integrated display adapter is excluded from the capture scope.
3. Confirm the hardware target.
4. Enter `H:\llama\models` as the additional local folder and choose
   **Scan named model stores**.
5. Select `Qwen3-4B-Instruct-2507-Q4_K_M.gguf`. A size-only result is expected
   to be hashed only after this explicit selection. Its required SHA-256 is
   `3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597`.
6. Enter `H:\llama\llama-fit-params.exe` for the memory-capture tool.
7. Keep **8K — everyday chat and coding** for the first test and choose
   **Review exact memory capture**.
8. Confirm that the preview shows llama.cpp build `b10061 (5d5306bf3)`, CUDA,
   F16 K/V cache, full GPU offload, batch 2048, micro-batch 512, 8K and 32K
   contexts, and three repetitions per context.
9. Check the separate local-process permission and choose
   **Capture exact memory components**.
10. Inspect the proposed-unreviewed receipt. It must report six completed
    attempts and must not claim recommendation or serving authorization.

## Independently observed live protocol result

The exact packaged protocol was executed directly against the artifact and
tool above on 2026-07-23. All three repetitions agreed:

```text
8K:  CUDA0 model 2375 MiB, context 1152 MiB, compute 301 MiB
     Host  model 304 MiB, context 0 MiB, compute 18 MiB

32K: CUDA0 model 2375 MiB, context 4608 MiB, compute 301 MiB
     Host  model 304 MiB, context 0 MiB, compute 42 MiB
```

This proves that the fixed local capture command works with the selected
artifact, build and machine. It does not by itself approve a capacity policy,
generalize to other configurations, or make the website portfolio production
ready.

## Expected limitations

- Process-local handles are lost when the app restarts.
- The initial local capture supports only the tested Windows x86-64, CUDA,
  llama.cpp build 10061, registry-exact GGUF route.
- Model and tool downloads are not included.
- Child-process network and filesystem isolation are not claimed.
- The website still uses the preserved finder rather than the final real-data
  M-O portfolio.
- CLI parity and Private Arena are not included in this test candidate.

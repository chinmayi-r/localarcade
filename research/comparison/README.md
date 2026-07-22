# Research comparison interchange

This directory is owned by the ranking-research assembler. It is deliberately
outside production packages and defines only how parallel research lanes hand
scenario results to the final comparison.

Validate the fixtures with:

```powershell
node research/comparison/validate.mjs
```

Version 1 preserves three distinctions that must not be erased during assembly:

- an exact, lossy, or unsupported cross-system input mapping;
- considered, recommended, excluded, or unsupported candidates;
- exact, compatible, proxy, or unknown evidence applicability.

Community consensus and successful benchmark submissions are sources, not
ground truth. A candidate can be excluded with reasons, and `runnable` may stay
`unknown` when no matched execution establishes it.

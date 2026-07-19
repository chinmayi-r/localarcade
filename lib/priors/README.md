# Sourced throughput priors

M3 stores prompt processing, token generation and TTFT as separate ranges. Every row is tied to an accelerator, memory amount, artifact-size band, quantization, runtime version/commit, backend, operating system, protocol, source and retrieval time.

The initial seed uses opt-in LocalScore result pages whose detailed runs expose sufficient configuration identity. GPU leaderboard summaries are deliberately excluded because their visible aggregate does not retain enough runtime identity for this contract.

`estimateThroughput()` never emits point values. Exact hardware matches return the recorded workload envelope with medium confidence. Family or unknown-hardware fallbacks widen only within the same accelerator kind, product, engine and artifact-size band. No compatible evidence returns unavailable; GPU queries can never inherit CPU observations, and product wrappers are not silently merged with their underlying engine.

This module is not connected to the website or recommendation engine until M4.

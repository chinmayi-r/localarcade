# Sourced throughput priors

M3 stores prompt processing, token generation and TTFT as separate ranges. Every row is tied to an accelerator, memory amount, artifact-size band, quantization, runtime version/commit, backend, operating system, protocol, source and retrieval time.

The initial seed uses opt-in LocalScore result pages whose detailed runs expose sufficient configuration identity. GPU leaderboard summaries are deliberately excluded because their visible aggregate does not retain enough runtime identity for this contract.

`estimateThroughput()` never emits point values. Exact hardware matches return the recorded workload envelope with medium confidence. Family or unknown-hardware fallbacks widen to the complete compatible envelope and return low confidence. No compatible engine/size evidence returns unavailable.

This module is not connected to the website or recommendation engine until M4.

# Localhost quick test

M7 adds a browser-only middle tier for people who already have an
OpenAI-compatible local server. It neither installs nor runs a model. The user
must start the suite explicitly, and every request goes directly from the
browser to an exact loopback host: `localhost`, `127.0.0.1`, or `::1`.

## What is measured

The versioned suite contains three short deterministic tasks:

1. valid JSON with an exact object shape;
2. exact line and ordering constraints;
3. preservation of three supplied facts in one line.

Each response is scored mechanically in the browser. The page reports task
passes and wall-clock request duration as `measured`. It reports generation
tokens per second only when the local endpoint itself returns a finite,
positive timing value. It never infers throughput from words, characters, or a
different tokenizer.

The result identity includes model ID, product, engine, runtime build, and the
user's hardware description. Hardware remains `self-reported`, not `verified`.
No quick-test result is uploaded or persisted.

## CORS and product setup

Use the exact Local Arcade origin shown in the browser rather than a wildcard
where the product supports an allowlist. Keep the server bound to loopback. An
API key entered in the page stays in component memory and is sent only to the
validated loopback URL.

- **llama.cpp:** `llama-server` defaults to `127.0.0.1:8080`, supports
  `/v1/chat/completions`, `--cors-origins`, and `--api-key`. Its special
  `localhost` CORS value only reflects localhost page origins, so a hosted page
  needs its exact HTTPS origin allowed. Source: [official server
  README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md).
- **LM Studio:** enable CORS in Server Settings or use `lms server start
  --cors`. Keep the default `127.0.0.1` binding; the official docs recommend
  authentication when CORS is enabled. Sources: [server-start CLI
  documentation](https://lmstudio.ai/docs/cli/serve/server-start) and [server
  settings](https://lmstudio.ai/docs/developer/core/server/settings).
- **Jan:** its Local API Server defaults to `127.0.0.1:1337`, requires an API
  key, and exposes a CORS toggle that is enabled by default. Source: [Jan Local
  API Server](https://jan.ai/docs/api-server).
- **Ollama:** the official FAQ documents `OLLAMA_ORIGINS` for additional web
  origins. Add the exact site origin and restart Ollama. Source: [Ollama
  FAQ](https://docs.ollama.com/faq).
- **MLX LM:** the official guide documents a localhost OpenAI-style chat
  endpoint and warns that the server has only basic security checks. It does
  not document a CORS setting, so Local Arcade claims no browser workaround if
  the request is blocked. Source: [MLX LM HTTP Model
  Server](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/SERVER.md).
- **vLLM:** its OpenAI-compatible server supports `/v1/chat/completions`; its
  serve arguments include allowed-origin controls. Bind it to loopback and
  allow the exact site origin. Source: [vLLM OpenAI-compatible
  server](https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html).

## Honest failure states

- Invalid or non-loopback URL: block before `fetch`.
- Network/CORS failure: show the unreachable state and record nothing.
- HTTP error: point to model ID, API key, and local server logs.
- Non-compatible JSON response: identify the missing response contract.
- Task miss: retain the mechanically scored miss; do not reinterpret it as a
  general quality score.

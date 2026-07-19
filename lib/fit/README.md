# Fit math

`fit()` is a pure capacity calculation scoped to explicit artifact, runtime and hardware inputs. It sums model weights, context-scaled KV cache, runtime/compute buffers, OS reserve, display reserve and a caller-selected safety margin.

The module intentionally does not infer memory from a model name, parameter count, GPU name or runtime product. llama.cpp reports that KV memory depends on model architecture, context and cache types, while compute buffers also vary with batch size, flash attention, backend and build. Callers must therefore provide sourced per-component KV profiles and a runtime-buffer value for the configuration being evaluated. Missing profiles fail closed.

The M2 module is not connected to recommendation ranking or the website. Other products such as Ollama, LM Studio, MLX LM and vLLM need their own sourced runtime profiles before using the same arithmetic.

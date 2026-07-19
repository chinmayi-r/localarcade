import type { Product, ProductId } from "./types";

export const products: Record<ProductId, Product> = {
  "llama-cpp": { id: "llama-cpp", label: "llama.cpp", kind: "engine-and-cli", engineIds: ["llama.cpp"] },
  ollama: { id: "ollama", label: "Ollama", kind: "app-and-daemon", engineIds: ["llama.cpp", "mlx-lm"] },
  "lm-studio": { id: "lm-studio", label: "LM Studio", kind: "desktop-app", engineIds: ["llama.cpp", "mlx-lm"] },
  jan: { id: "jan", label: "Jan", kind: "desktop-app", engineIds: ["llama.cpp", "mlx-swift-lm"] },
  "mlx-lm": { id: "mlx-lm", label: "MLX LM", kind: "framework-cli", engineIds: ["mlx-lm"] },
  vllm: { id: "vllm", label: "vLLM", kind: "serving-engine", engineIds: ["vllm-native", "vllm-transformers", "vllm-gguf-plugin"] },
};

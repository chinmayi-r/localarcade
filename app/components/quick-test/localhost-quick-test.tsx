"use client";

import { useMemo, useState } from "react";
import { runQuickTest, QuickTestError, type LocalEndpointConfiguration, type QuickTestReport } from "@/lib/quick-test";
import { products, type EngineId, type ProductId } from "@/lib/runtime";

const productOptions = Object.values(products);

const initialConfiguration: LocalEndpointConfiguration = {
  baseUrl: "http://127.0.0.1:8080/v1",
  modelId: "",
  productId: "llama-cpp",
  engineId: "llama.cpp",
  runtimeBuild: "",
  hardwareDescription: "",
};

export type QuickTestViewState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "complete"; report: QuickTestReport }
  | { kind: "error"; message: string };

export function LocalhostQuickTest() {
  const [configuration, setConfiguration] = useState(initialConfiguration);
  const [state, setState] = useState<QuickTestViewState>({ kind: "idle" });
  const selectedProduct = products[configuration.productId];
  const canRun = useMemo(() => Boolean(
    configuration.baseUrl.trim()
    && configuration.modelId.trim()
    && configuration.runtimeBuild.trim()
    && configuration.hardwareDescription.trim(),
  ), [configuration]);

  function patch(change: Partial<LocalEndpointConfiguration>) {
    setConfiguration((current) => ({ ...current, ...change }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canRun || state.kind === "running") return;
    setState({ kind: "running" });
    try {
      const report = await runQuickTest(configuration);
      setState({ kind: "complete", report });
    } catch (error) {
      const message = error instanceof QuickTestError
        ? error.message
        : "The quick test stopped unexpectedly. No result was saved or uploaded.";
      setState({ kind: "error", message });
    }
  }

  function selectProduct(productId: ProductId) {
    const product = products[productId];
    patch({ productId, engineId: product.engineIds[0] });
  }

  return (
    <section className="quick-test-section" id="quick-test" aria-labelledby="quick-test-title">
      <div className="quick-test-heading">
        <div>
          <span className="eyebrow">LOCAL QUICK TEST</span>
          <h2 id="quick-test-title">Measure a server already running on this computer.</h2>
          <p>Three short, deterministic tasks test JSON structure, exact formatting, and fact preservation. Requests travel directly from this browser to the loopback address below; Local Arcade does not proxy, receive, or upload the prompts or results.</p>
        </div>
        <div className="quick-test-boundary"><b>NETWORK BOUNDARY</b><span>localhost / 127.0.0.1 / ::1 only</span><small>Explicit action required</small></div>
      </div>

      <form className="quick-test-form" onSubmit={submit}>
        <div className="quick-test-fields">
          <TextField label="Endpoint base URL" hint="OpenAI-compatible /v1">
            <input value={configuration.baseUrl} onChange={(event) => patch({ baseUrl: event.target.value })} inputMode="url" spellCheck={false} aria-describedby="endpoint-help" />
          </TextField>
          <TextField label="Model ID" hint="As served by the endpoint">
            <input value={configuration.modelId} onChange={(event) => patch({ modelId: event.target.value })} placeholder="e.g. local-model" spellCheck={false} />
          </TextField>
          <TextField label="API key" hint="Optional · never stored">
            <input type="password" value={configuration.apiKey ?? ""} onChange={(event) => patch({ apiKey: event.target.value })} autoComplete="off" placeholder="Only sent to localhost" />
          </TextField>
          <TextField label="Product" hint="Configuration identity">
            <select value={configuration.productId} onChange={(event) => selectProduct(event.target.value as ProductId)}>
              {productOptions.map((product) => <option key={product.id} value={product.id}>{product.label}</option>)}
            </select>
          </TextField>
          <TextField label="Engine" hint="Not inferred from product">
            <select value={configuration.engineId} onChange={(event) => patch({ engineId: event.target.value as EngineId })}>
              {selectedProduct.engineIds.map((engineId) => <option key={engineId} value={engineId}>{engineId}</option>)}
            </select>
          </TextField>
          <TextField label="Runtime build / version" hint="Required · self-reported">
            <input value={configuration.runtimeBuild} onChange={(event) => patch({ runtimeBuild: event.target.value })} placeholder="e.g. b6320 or 0.12.4" spellCheck={false} />
          </TextField>
          <TextField label="Hardware used" hint="Required · self-reported">
            <input value={configuration.hardwareDescription} onChange={(event) => patch({ hardwareDescription: event.target.value })} placeholder="e.g. RTX 4070 12 GB" />
          </TextField>
        </div>
        <div className="quick-test-action">
          <p id="endpoint-help">The endpoint must be an exact loopback host. Keep the server bound to loopback and allow this site’s origin in its CORS settings.</p>
          <button type="submit" disabled={!canRun || state.kind === "running"}>{state.kind === "running" ? "Running 3 tasks…" : "Run local quick test"}<span>→</span></button>
        </div>
      </form>

      <QuickTestStatus state={state} />

      <details className="cors-help">
        <summary>Server and CORS setup from official product documentation</summary>
        <div>
          <p><b>llama.cpp:</b> keep the default loopback host and set <code>--cors-origins</code> to this site’s exact origin; an API key is supported.</p>
          <p><b>LM Studio:</b> enable CORS in Server Settings or start with <code>lms server start --cors</code>; authentication is recommended.</p>
          <p><b>Jan:</b> enable the Local API Server’s CORS setting and use its required API key.</p>
          <p><b>Ollama:</b> add this site’s exact origin through <code>OLLAMA_ORIGINS</code>, then restart the server.</p>
          <p><b>MLX LM:</b> its official server guide documents a localhost OpenAI-style endpoint, but no CORS control. If the browser blocks it, this page does not recommend an unsafe workaround.</p>
          <p><b>vLLM:</b> use its OpenAI-compatible chat endpoint and set an explicit allowed origin.</p>
          <nav aria-label="Official localhost server documentation">
            <a href="https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md" target="_blank" rel="noreferrer">llama.cpp ↗</a>
            <a href="https://lmstudio.ai/docs/cli/serve/server-start" target="_blank" rel="noreferrer">LM Studio ↗</a>
            <a href="https://jan.ai/docs/api-server" target="_blank" rel="noreferrer">Jan ↗</a>
            <a href="https://docs.ollama.com/faq" target="_blank" rel="noreferrer">Ollama ↗</a>
            <a href="https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/SERVER.md" target="_blank" rel="noreferrer">MLX LM ↗</a>
            <a href="https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html" target="_blank" rel="noreferrer">vLLM ↗</a>
          </nav>
        </div>
      </details>
    </section>
  );
}

export function QuickTestStatus({ state }: { state: QuickTestViewState }) {
  return <div className="quick-test-status" aria-live="polite">
    {state.kind === "idle" && <IdleState />}
    {state.kind === "running" && <RunningState />}
    {state.kind === "error" && <ErrorState message={state.message} />}
    {state.kind === "complete" && <Report report={state.report} />}
  </div>;
}

function TextField({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return <label className="quick-test-field"><span>{label}</span><small>{hint}</small>{children}</label>;
}

function IdleState() {
  return <div className="quick-state"><span>READY</span><b>No requests have been made.</b><p>Starting the suite is the consent action. Results remain in memory until this page is refreshed.</p></div>;
}

function RunningState() {
  return <div className="quick-state running"><span>MEASURING</span><b>Running tasks sequentially.</b><p>The local server handles one short request at a time.</p></div>;
}

function ErrorState({ message }: { message: string }) {
  return <div className="quick-state error"><span>LOCAL ENDPOINT UNREACHABLE</span><b>No measurement was recorded.</b><p>{message}</p></div>;
}

function Report({ report }: { report: QuickTestReport }) {
  return <div className="quick-report">
    <div className="quick-report-summary">
      <div><span>QUICK TASK RESULT</span><b>{report.passedTasks}/{report.taskCount} passed</b><EvidenceBadge label="measured" /></div>
      <div><span>AVERAGE REQUEST TIME</span><b>{Math.round(report.averageTaskDurationMs).toLocaleString("en-US")} ms</b><EvidenceBadge label="measured" /></div>
      <div><span>HARDWARE</span><b>{report.identity.hardwareDescription}</b><EvidenceBadge label="self-reported" /></div>
      <div><span>CONFIGURATION</span><b>{products[report.identity.productId].label} · {report.identity.engineId} · {report.identity.runtimeBuild}</b><EvidenceBadge label="configuration" /></div>
    </div>
    <div className="quick-task-results">
      {report.results.map((result) => <article key={result.id} className={result.passed ? "passed" : "failed"}>
        <span>{result.passed ? "PASS" : "MISS"}</span>
        <div><b>{result.label}</b><p>{result.explanation}</p></div>
        <div className="task-measure"><b>{Math.round(result.durationMs).toLocaleString("en-US")} ms</b><EvidenceBadge label="measured" /></div>
        <div className="task-measure"><b>{result.endpointGenerationTokensPerSecond === undefined ? "Not reported" : `${result.endpointGenerationTokensPerSecond.toFixed(1)} tok/s`}</b><EvidenceBadge label={result.endpointGenerationTokensPerSecond === undefined ? "unavailable" : "measured"} /></div>
      </article>)}
    </div>
    <p className="quick-report-note">These results describe only the stated model, product, engine build, and settings currently behind the endpoint. They do not verify the self-reported hardware or establish general model quality.</p>
  </div>;
}

function EvidenceBadge({ label }: { label: "measured" | "self-reported" | "configuration" | "unavailable" }) {
  return <em className={`evidence-badge ${label === "unavailable" ? "unavailable" : "evidence"}`}>{label}</em>;
}

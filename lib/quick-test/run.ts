import { resolveChatCompletionsEndpoint } from "./endpoint-policy";
import { quickTaskSuite } from "./suite";
import { QuickTestError, type LocalEndpointConfiguration, type QuickTaskResult, type QuickTestReport } from "./types";

type RunnerOptions = {
  fetchImpl?: typeof fetch;
  now?: () => number;
  signal?: AbortSignal;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: unknown } }>;
  usage?: { completion_tokens?: unknown };
  timings?: { predicted_per_second?: unknown };
};

export async function runQuickTest(configuration: LocalEndpointConfiguration, options: RunnerOptions = {}): Promise<QuickTestReport> {
  assertConfiguration(configuration);
  const endpoint = resolveChatCompletionsEndpoint(configuration.baseUrl);
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => performance.now());
  const startedAtMs = Date.now();
  const results: QuickTaskResult[] = [];

  for (const task of quickTaskSuite) {
    if (options.signal?.aborted) throw new QuickTestError("aborted", "The quick test was cancelled.");
    const requestStarted = now();
    let response: Response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(configuration.apiKey ? { Authorization: `Bearer ${configuration.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: configuration.modelId,
          messages: [{ role: "user", content: task.prompt }],
          temperature: 0,
          max_tokens: task.maxTokens,
          stream: false,
        }),
        signal: options.signal,
      });
    } catch (error) {
      if (options.signal?.aborted) throw new QuickTestError("aborted", "The quick test was cancelled.", { cause: error });
      throw new QuickTestError("unreachable", "The localhost endpoint could not be reached. Check that the server is running, the URL is correct, and CORS allows this site.", { cause: error });
    }

    if (!response.ok) {
      throw new QuickTestError("http-error", `The localhost endpoint returned HTTP ${response.status}. Check the model ID, API key, and server logs.`);
    }

    let payload: ChatCompletionResponse;
    try {
      payload = await response.json() as ChatCompletionResponse;
    } catch (error) {
      throw new QuickTestError("invalid-response", "The endpoint returned a response that was not valid JSON.", { cause: error });
    }
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new QuickTestError("invalid-response", "The endpoint response did not contain choices[0].message.content.");
    }

    const durationMs = Math.max(0, now() - requestStarted);
    const score = task.score(content);
    const completionTokens = finitePositiveInteger(payload.usage?.completion_tokens);
    const endpointThroughput = finitePositiveNumber(payload.timings?.predicted_per_second);
    results.push({
      id: task.id,
      label: task.label,
      passed: score.passed,
      explanation: score.explanation,
      durationMs,
      ...(completionTokens === undefined ? {} : { completionTokens }),
      ...(endpointThroughput === undefined ? {} : { endpointGenerationTokensPerSecond: endpointThroughput }),
    });
  }

  const totalDurationMs = results.reduce((sum, result) => sum + result.durationMs, 0);
  const finishedAtMs = Date.now();
  return {
    identity: {
      modelId: configuration.modelId.trim(),
      productId: configuration.productId,
      engineId: configuration.engineId,
      runtimeBuild: configuration.runtimeBuild.trim(),
      hardwareDescription: configuration.hardwareDescription.trim(),
    },
    endpointOrigin: endpoint.origin,
    startedAt: new Date(startedAtMs).toISOString(),
    finishedAt: new Date(finishedAtMs).toISOString(),
    passedTasks: results.filter((result) => result.passed).length,
    taskCount: results.length,
    totalDurationMs,
    averageTaskDurationMs: totalDurationMs / results.length,
    results,
  };
}

function assertConfiguration(configuration: LocalEndpointConfiguration) {
  if (!configuration.modelId.trim() || !configuration.runtimeBuild.trim() || !configuration.hardwareDescription.trim()) {
    throw new QuickTestError("invalid-configuration", "Model ID, runtime build, and self-reported hardware are required.");
  }
}

function finitePositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function finitePositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

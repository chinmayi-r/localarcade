import assert from "node:assert/strict";
import test from "node:test";
import { resolveChatCompletionsEndpoint, runQuickTest, QuickTestError, type LocalEndpointConfiguration } from "../lib/quick-test";

const configuration: LocalEndpointConfiguration = {
  baseUrl: "http://127.0.0.1:8080/v1",
  modelId: "local-model",
  productId: "llama-cpp",
  engineId: "llama.cpp",
  runtimeBuild: "b6320",
  hardwareDescription: "RTX 4070 12 GB",
};

test("loopback policy resolves OpenAI-compatible base and full endpoint URLs", () => {
  assert.equal(resolveChatCompletionsEndpoint("http://localhost:8080").href, "http://localhost:8080/v1/chat/completions");
  assert.equal(resolveChatCompletionsEndpoint("http://127.0.0.1:8080/v1").href, "http://127.0.0.1:8080/v1/chat/completions");
  assert.equal(resolveChatCompletionsEndpoint("https://[::1]:8443/v1/chat/completions").href, "https://[::1]:8443/v1/chat/completions");
});

test("network policy rejects every non-loopback or ambiguous destination before fetch", async () => {
  const blocked = [
    "https://example.com/v1",
    "http://localhost.example.com/v1",
    "http://192.168.1.4:8080/v1",
    "file:///tmp/server",
    "http://user:pass@localhost:8080/v1",
    "http://localhost:8080/v1?target=external",
  ];
  let calls = 0;
  for (const baseUrl of blocked) {
    await assert.rejects(
      runQuickTest({ ...configuration, baseUrl }, { fetchImpl: async () => { calls += 1; return responseFor(""); } }),
      (error: unknown) => error instanceof QuickTestError && error.code === "invalid-endpoint",
    );
  }
  assert.equal(calls, 0, "blocked hosts must never reach fetch");
});

test("deterministic suite runs sequentially against only the resolved localhost endpoint", async () => {
  const outputs = [
    '{"project":"Orchid","count":3,"ready":true}',
    "ALPHA=red\nBRAVO=green\nCHARLIE=blue",
    "Project Cedar launched in 2024, has 17 contributors, and uses the Apache-2.0 license.",
  ];
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  let responseIndex = 0;
  const times = [0, 100, 100, 250, 250, 450];
  let timeIndex = 0;

  const report = await runQuickTest(configuration, {
    now: () => times[timeIndex++],
    fetchImpl: async (input, init) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
      const output = outputs[responseIndex++];
      return responseFor(output, { completion_tokens: 12 }, { predicted_per_second: 24.5 });
    },
  });

  assert.equal(calls.length, 3);
  assert.deepEqual(new Set(calls.map((call) => call.url)), new Set(["http://127.0.0.1:8080/v1/chat/completions"]));
  assert.ok(calls.every((call) => call.body.stream === false && call.body.temperature === 0));
  assert.equal(report.passedTasks, 3);
  assert.equal(report.taskCount, 3);
  assert.equal(report.totalDurationMs, 450);
  assert.equal(report.averageTaskDurationMs, 150);
  assert.ok(report.results.every((result) => result.endpointGenerationTokensPerSecond === 24.5));
  assert.equal("apiKey" in report.identity, false);
  assert.equal(report.identity.runtimeBuild, "b6320");
  assert.equal(report.identity.hardwareDescription, "RTX 4070 12 GB");
});

test("task scorers report mechanical misses without turning them into general quality scores", async () => {
  const outputs = ["```json\n{}\n```", "ALPHA=red, BRAVO=green, CHARLIE=blue", "Cedar launched recently."];
  let index = 0;
  const report = await runQuickTest(configuration, { fetchImpl: async () => responseFor(outputs[index++]) });
  assert.equal(report.passedTasks, 0);
  assert.ok(report.results.every((result) => !result.passed));
});

test("an unreachable endpoint becomes a designed quick-test error", async () => {
  await assert.rejects(
    runQuickTest(configuration, { fetchImpl: async () => { throw new TypeError("Failed to fetch"); } }),
    (error: unknown) => error instanceof QuickTestError && error.code === "unreachable" && /CORS/i.test(error.message),
  );
});

function responseFor(content: string, usage?: Record<string, unknown>, timings?: Record<string, unknown>) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }], usage, timings }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

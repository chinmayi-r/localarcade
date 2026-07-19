import type { EngineId, ProductId } from "../runtime";

export type QuickTaskId = "json-schema" | "format-constraints" | "fact-preservation";

export type LocalEndpointConfiguration = {
  baseUrl: string;
  apiKey?: string;
  modelId: string;
  productId: ProductId;
  engineId: EngineId;
  runtimeBuild: string;
  hardwareDescription: string;
};

export type QuickTaskResult = {
  id: QuickTaskId;
  label: string;
  passed: boolean;
  explanation: string;
  durationMs: number;
  completionTokens?: number;
  endpointGenerationTokensPerSecond?: number;
};

export type QuickTestReport = {
  identity: Omit<LocalEndpointConfiguration, "apiKey" | "baseUrl">;
  endpointOrigin: string;
  startedAt: string;
  finishedAt: string;
  passedTasks: number;
  taskCount: number;
  totalDurationMs: number;
  averageTaskDurationMs: number;
  results: QuickTaskResult[];
};

export type QuickTestErrorCode =
  | "invalid-configuration"
  | "invalid-endpoint"
  | "unreachable"
  | "http-error"
  | "invalid-response"
  | "aborted";

export class QuickTestError extends Error {
  constructor(public readonly code: QuickTestErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "QuickTestError";
  }
}

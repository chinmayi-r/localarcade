import type { HardwareTarget, Provenance, TaskFamily } from "../contracts/types";

export const llmfitVersion = "1.1.6" as const;
export const llmfitRevision =
  "aaa2bc179cec214ccdc44501c853b98fba0b343b" as const;
export const llmfitSourceUrl = "https://github.com/AlexsJones/llmfit" as const;

export type LlmfitSource = {
  id: "llmfit-core";
  version: typeof llmfitVersion;
  revision: typeof llmfitRevision;
  url: typeof llmfitSourceUrl;
};

export type LlmfitAdvisoryRequest = {
  schemaVersion: 1;
  capability: "llmfit-advisory-request";
  requestId: string;
  hardwareTarget: HardwareTarget;
  query: {
    taskFamily: TaskFamily;
    interactionStyle: "interactive" | "batch";
    desiredContextTokens: number;
    forcedRuntime: string | null;
  };
};

export type LlmfitAdvisoryCandidate = {
  advisoryId: string;
  upstreamModel: {
    id: string;
    displayName: string;
    provider: string;
    parameters: number;
    upstreamReportedCapabilities: string[];
  };
  advisory: {
    fit: "good" | "tight" | "does-not-fit";
    runPath: "gpu" | "cpu-offload" | "cpu";
    memoryRequiredBytes: number;
    memoryAvailableBytes: number;
    context: {
      requestedTokens: number;
      effectiveTokens: number;
      usableTokens: number;
    };
    performance: {
      estimatedGenerationTokensPerSecond: {
        low: number;
        high: number;
      } | null;
      upstreamReportedGenerationTokensPerSecond: null;
    };
    suggestedRuntime: string | null;
    suggestedQuantization: string | null;
  };
  mappingIssues: Array<{
    path: string;
    classification: "lossy" | "unsupported";
    reasonCode: string;
    message: string;
  }>;
  provenance: Provenance[];
  rawSourceRecordRef: string;
};

export type LlmfitAdvisoryOk = {
  schemaVersion: 1;
  capability: "llmfit-advisory";
  status: "ok";
  requestId: string;
  hardwareTargetId: string;
  source: LlmfitSource;
  requestScope: LlmfitAdvisoryRequest["query"];
  candidates: LlmfitAdvisoryCandidate[];
  warnings: string[];
};

export type LlmfitAdvisoryFailure = {
  schemaVersion: 1;
  capability: "llmfit-advisory";
  status: "blocked" | "unsupported" | "unavailable" | "error";
  requestId: string;
  reasonCode: string;
  message: string;
  providerInvoked: boolean;
  recoverableActions: string[];
  provenance: Provenance[];
  warnings: string[];
  missing?: string[];
  unsupportedPath?: string;
  unsupportedValue?: unknown;
  rawSourceRecordRef?: string;
};

export type LlmfitAdvisoryEnvelope =
  | LlmfitAdvisoryOk
  | LlmfitAdvisoryFailure;

export type LlmfitFamilyBinding = {
  advisoryId: string;
  candidateId: string;
  modelFamilyId: string;
  upstreamModelId: string;
  method: "explicit-registry-crosswalk";
  sourceRevision: string;
};

export type MFFitUpstreamAdvisoryInput = {
  schemaVersion: 1;
  capability: "m-f-upstream-advisory-input";
  candidateId: string;
  hardwareTargetId: string;
  desiredContextTokens: number;
  advisoryId: string;
  modelFamilyId: string;
  binding: {
    upstreamModelId: string;
    method: "explicit-registry-crosswalk";
    sourceRevision: string;
  };
  upstreamAssessment: Omit<
    LlmfitAdvisoryCandidate["advisory"],
    "suggestedRuntime" | "suggestedQuantization"
  >;
  upstreamSuggestions: {
    runtime: string | null;
    quantization: string | null;
  };
  mappingIssues: LlmfitAdvisoryCandidate["mappingIssues"];
  provenance: Provenance[];
};

export type LlmfitMappingResult<T> =
  | { kind: "ok"; value: T }
  | {
      kind: "blocked";
      reasonCode: string;
      message: string;
      missing?: string[];
    };

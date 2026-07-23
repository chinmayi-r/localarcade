import type { NormalizationResult } from "../normalization/types";

export type CaptureIntegrity = {
  file:
    | "pin.json"
    | "raw-system.json"
    | "raw-recommend-coding.json"
    | "raw-exit-codes.json"
    | "raw-invalid-enums-exit.json";
  expectedSha256: string;
  actualSha256: string;
  valid: boolean;
};

export type CapturedInputFact = {
  field: string;
  value: unknown;
  source:
    | "cli-override"
    | "host-detected"
    | "upstream-derived"
    | "not-retained";
  independentlySupplied: boolean;
  evidence: string;
};

export type ReplayBlocker = {
  reasonCode: string;
  field: string;
  message: string;
};

export type CapturedCandidateSummary = {
  name: string;
  quantization: string | null;
  runtime: string | null;
  fit: string;
  runMode: string;
  requiredMemoryGb: number;
  availableMemoryGb: number;
  estimatedTokensPerSecond: number | null;
  upstreamCompositeScore: number;
};

export type CapturedReplayReport = {
  reportSchema: "local-arcade.llmfit-captured-replay-report.v1";
  capability: "llmfit-captured-replay";
  source: {
    repository: string;
    release: string;
    revision: string;
  } | null;
  integrity: {
    status: "verified" | "failed";
    scope: "retained-byte-integrity";
    files: CaptureIntegrity[];
  };
  executionProvenance: {
    status: "asserted-not-attested";
    statement: string;
  };
  capture: {
    systemEchoMatchesRecommendation: boolean;
    inputFacts: CapturedInputFact[];
    candidateCount: number;
    candidates: CapturedCandidateSummary[];
  } | null;
  normalization: {
    status: "blocked" | "completed";
    invoked: boolean;
    reasonCode: string | null;
    blockers: ReplayBlocker[];
    result: NormalizationResult | null;
  };
  conclusion: string;
};

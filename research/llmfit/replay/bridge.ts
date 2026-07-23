import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { normalizeRawLlmfitFixture } from "../normalization/adapter";
import type {
  IndependentAdvisoryInput,
  RawLlmfitFixture,
} from "../normalization/types";
import type {
  CaptureIntegrity,
  CapturedInputFact,
  CapturedReplayReport,
  ReplayBlocker,
} from "./types";

const AUDIT_ROOT = new URL("../provider-audit/", import.meta.url);

const EXPECTED_HASHES = {
  "pin.json":
    "d531913f5551b6bf08ff25594771c96c8ddf55fa1933e45482ec94496fb556c4",
  "raw-system.json":
    "084d04697ee99312fcf690a553c79ce6760f9cd5175ff47434aaca5fbc0d9cd7",
  "raw-recommend-coding.json":
    "994b9fbb44eca28316af1ce983d5e1851339555f124dce5c81d54486a59ae60d",
  "raw-exit-codes.json":
    "3e15ac82119994f0752a7d871073c94a8b1b879764ec9bd39ca02468d72651ed",
  "raw-invalid-enums-exit.json":
    "7353a48fe194d47dc1278001aba6558a999bf25052f29f51c75a5c722e047390",
} as const;

type CaptureFile = keyof typeof EXPECTED_HASHES;

type Pin = {
  repository: string;
  release: string;
  releaseCommit: string;
};

type RawSystem = {
  system: {
    total_ram_gb: number;
    available_ram_gb: number | null;
    cpu_name: string;
    cpu_cores: number;
    backend: string;
    gpu_name: string | null;
    gpu_vram_gb: number | null;
    gpu_count: number;
    unified_memory: boolean;
  };
};

type RawRecommendation = RawSystem & {
  models: Array<{
    name: string;
    best_quant: string | null;
    runtime: string | null;
    fit_level: string;
    run_mode: string;
    memory_required_gb: number;
    memory_available_gb: number;
    estimated_tps: number | null;
    score: number;
  }>;
};

type RawExitCodes = {
  version: number;
  system: number;
  recommend: number;
  invalidEnumRecommend: number;
};

type RawInvalidEnumExit = {
  exitCode: number;
  note: string;
};

export type CaptureBytes = Record<CaptureFile, Buffer>;

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseJson<T>(value: Buffer): T {
  return JSON.parse(value.toString("utf8").replace(/^\uFEFF/, "")) as T;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function loadRetainedCapture(): Promise<CaptureBytes> {
  const entries = await Promise.all(
    (Object.keys(EXPECTED_HASHES) as CaptureFile[]).map(async (file) => [
      file,
      await readFile(new URL(file, AUDIT_ROOT)),
    ]),
  );
  return Object.fromEntries(entries) as CaptureBytes;
}

function integrityFor(capture: CaptureBytes): CaptureIntegrity[] {
  return (Object.keys(EXPECTED_HASHES) as CaptureFile[]).map((file) => {
    const actualSha256 = sha256(capture[file]);
    return {
      file,
      expectedSha256: EXPECTED_HASHES[file],
      actualSha256,
      valid: actualSha256 === EXPECTED_HASHES[file],
    };
  });
}

function capturedInputFacts(
  system: RawSystem["system"],
): CapturedInputFact[] {
  return [
    {
      field: "hardware.totalRamBytes",
      value: system.total_ram_gb * 1024 ** 3,
      source: "cli-override",
      independentlySupplied: true,
      evidence: "`--ram 32G` in provider-audit/probe.ps1",
    },
    {
      field: "hardware.availableRamBytes",
      value:
        system.available_ram_gb === null
          ? null
          : system.available_ram_gb * 1024 ** 3,
      source: "host-detected",
      independentlySupplied: false,
      evidence: "No available-RAM CLI input; value occurs in raw system output.",
    },
    {
      field: "hardware.cpu.displayName",
      value: system.cpu_name,
      source: "host-detected",
      independentlySupplied: false,
      evidence: "No CPU-name override was accepted by the captured command.",
    },
    {
      field: "hardware.cpu.logicalCores",
      value: system.cpu_cores,
      source: "cli-override",
      independentlySupplied: true,
      evidence: "`--cpu-cores 16` in provider-audit/probe.ps1",
    },
    {
      field: "hardware.accelerators[0].displayName",
      value: system.gpu_name,
      source: "host-detected",
      independentlySupplied: false,
      evidence: "No GPU-name override was accepted by the captured command.",
    },
    {
      field: "hardware.accelerators[0].backend",
      value: system.backend,
      source: "host-detected",
      independentlySupplied: false,
      evidence: "Backend was detected before partial CLI overrides.",
    },
    {
      field: "hardware.accelerators[0].deviceMemoryBytes",
      value:
        system.gpu_vram_gb === null
          ? null
          : system.gpu_vram_gb * 1024 ** 3,
      source: "cli-override",
      independentlySupplied: true,
      evidence: "`--memory 12G` in provider-audit/probe.ps1",
    },
    {
      field: "hardware.accelerators[0].count",
      value: system.gpu_count,
      source: "host-detected",
      independentlySupplied: false,
      evidence: "No GPU-count override was accepted by the captured command.",
    },
    {
      field: "hardware.unifiedMemory",
      value: system.unified_memory,
      source: "host-detected",
      independentlySupplied: false,
      evidence: "No unified-memory override was accepted by the captured command.",
    },
    {
      field: "task.family",
      value: "coding",
      source: "cli-override",
      independentlySupplied: true,
      evidence: "`--use-case coding` in provider-audit/probe.ps1",
    },
    {
      field: "task.interactionStyle",
      value: null,
      source: "not-retained",
      independentlySupplied: false,
      evidence: "The captured llmfit CLI has no interaction-style argument.",
    },
    {
      field: "task.contextTokens",
      value: 16384,
      source: "cli-override",
      independentlySupplied: true,
      evidence: "`--max-context 16384` in provider-audit/probe.ps1",
    },
    {
      field: "constraints.forcedRuntime",
      value: "llama.cpp",
      source: "cli-override",
      independentlySupplied: true,
      evidence: "`--runtime llamacpp`; raw candidates serialize `llama.cpp`.",
    },
    {
      field: "fixture.capturedAt",
      value: null,
      source: "not-retained",
      independentlySupplied: false,
      evidence:
        "The retained evidence records an observation date, not an exact capture timestamp.",
    },
  ];
}

function blockersFrom(facts: CapturedInputFact[]): ReplayBlocker[] {
  return facts
    .filter((fact) => !fact.independentlySupplied)
    .map((fact) => ({
      reasonCode:
        fact.source === "not-retained"
          ? "llmfit.captured-replay.required-fact-not-retained"
          : "llmfit.captured-replay.host-detected-fact-not-independent",
      field: fact.field,
      message: fact.evidence,
    }));
}

/**
 * This is the sole normalization call site in the replay bridge. It is guarded
 * so a capture cannot be normalized unless a caller can supply both a complete
 * independent input and a truthful captured fixture.
 */
export function normalizeEligibleCapture(
  input: IndependentAdvisoryInput | null,
  fixture: RawLlmfitFixture | null,
  blockers: ReplayBlocker[],
) {
  if (blockers.length > 0 || input === null || fixture === null) {
    return null;
  }
  return normalizeRawLlmfitFixture(input, fixture);
}

export function buildCapturedReplayReport(
  capture: CaptureBytes,
): CapturedReplayReport {
  const files = integrityFor(capture);
  if (files.some((file) => !file.valid)) {
    return {
      reportSchema: "local-arcade.llmfit-captured-replay-report.v1",
      capability: "llmfit-captured-replay",
      source: null,
      integrity: {
        status: "failed",
        scope: "retained-byte-integrity",
        files,
      },
      executionProvenance: {
        status: "asserted-not-attested",
        statement:
          "The audit records the command and environment, but the retained files are not cryptographically bound to a binary or execution environment.",
      },
      capture: null,
      normalization: {
        status: "blocked",
        invoked: false,
        reasonCode: "llmfit.captured-replay.integrity-mismatch",
        blockers: [
          {
            reasonCode: "llmfit.captured-replay.integrity-mismatch",
            field: "capture",
            message:
              "At least one retained provider-audit file does not match its exact SHA-256.",
          },
        ],
        result: null,
      },
      conclusion:
        "The retained bytes failed integrity verification; no replay interpretation or normalization was attempted.",
    };
  }

  const pin = parseJson<Pin>(capture["pin.json"]);
  const system = parseJson<RawSystem>(capture["raw-system.json"]);
  const recommendation = parseJson<RawRecommendation>(
    capture["raw-recommend-coding.json"],
  );
  const exitCodes = parseJson<RawExitCodes>(capture["raw-exit-codes.json"]);
  const invalidEnumExit = parseJson<RawInvalidEnumExit>(
    capture["raw-invalid-enums-exit.json"],
  );
  const inputFacts = capturedInputFacts(system.system);
  const blockers = blockersFrom(inputFacts);
  const systemEchoMatchesRecommendation = sameJson(
    system.system,
    recommendation.system,
  );
  if (!systemEchoMatchesRecommendation) {
    blockers.push({
      reasonCode: "llmfit.captured-replay.system-echo-mismatch",
      field: "capture.system",
      message:
        "raw-system.json and the recommendation's system echo do not match.",
    });
  }
  if (
    Object.values(exitCodes).some((exitCode) => exitCode !== 0) ||
    invalidEnumExit.exitCode !== 0
  ) {
    blockers.push({
      reasonCode: "llmfit.captured-replay.nonzero-exit",
      field: "capture.exitCodes",
      message: "At least one retained probe command did not exit successfully.",
    });
  }

  const result = normalizeEligibleCapture(null, null, blockers);
  return {
    reportSchema: "local-arcade.llmfit-captured-replay-report.v1",
    capability: "llmfit-captured-replay",
    source: {
      repository: pin.repository,
      release: pin.release,
      revision: pin.releaseCommit,
    },
    integrity: {
      status: "verified",
      scope: "retained-byte-integrity",
      files,
    },
    executionProvenance: {
      status: "asserted-not-attested",
      statement:
        "Hashes verify these retained bytes only. The documented probe provenance is an audit assertion, not cryptographic execution attestation.",
    },
    capture: {
      systemEchoMatchesRecommendation,
      inputFacts,
      candidateCount: recommendation.models.length,
      candidates: recommendation.models.map((model) => ({
        name: model.name,
        quantization: model.best_quant,
        runtime: model.runtime,
        fit: model.fit_level,
        runMode: model.run_mode,
        requiredMemoryGb: model.memory_required_gb,
        availableMemoryGb: model.memory_available_gb,
        estimatedTokensPerSecond: model.estimated_tps,
        upstreamCompositeScore: model.score,
      })),
    },
    normalization: {
      status: result === null ? "blocked" : "completed",
      invoked: result !== null,
      reasonCode:
        result === null
          ? "llmfit.captured-replay.independent-input-incomplete"
          : null,
      blockers,
      result,
    },
    conclusion:
      result === null
        ? "The integrity-verified retained bytes are reviewable, but they cannot enter the normalization API because required input facts were host-detected or not retained. Probe execution provenance is asserted, not cryptographically attested."
        : "The integrity-verified captured replay was normalized.",
  };
}

export async function reportFromRetainedCapture() {
  return buildCapturedReplayReport(await loadRetainedCapture());
}

export const providerAuditPath = fileURLToPath(AUDIT_ROOT);

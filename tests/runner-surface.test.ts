import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  RunnerApplication,
  type InvokePort,
  type LifecycleSnapshot,
} from "../runner/src/runner-application";
import { type FitProfileCaptureReceipt } from "../runner/src/fit-profile-capture-presentation";
import { recordContentSha256 } from "../lib/assessment/record-digest";
import { collectionFixture } from "../research/mf-profile-collection/fixtures";
import {
  createVerificationPlanRequestV1,
  VERIFICATION_PLAN_POLICY_V1,
} from "../runner/src/verification-plan-policy-v1";

function lifecycle(
  state: LifecycleSnapshot["state"],
  phase: LifecycleSnapshot["phase"],
  sequence = state === "terminal" ? 8 : 2,
): LifecycleSnapshot {
  return {
    version: 1,
    executionId: "execution-1",
    verificationPlanId: "desktop-verification-1",
    candidateId: "candidate-1",
    sequence,
    state,
    phase,
    phaseCurrent: state === "terminal" ? 3 : 1,
    phaseTotal: 3,
    retainedSeries: state === "terminal" ? 2 : 0,
    retainedChecks: state === "terminal" ? 3 : 0,
    elapsedMs: state === "terminal" ? 4200 : 300,
    updatedAt: "2026-07-23T12:00:00Z",
    diagnosticCodes: [],
  };
}

function observationEvidence(
  method: "measurement" | "objective-check",
  unit: "tokens-per-second" | "boolean",
): Record<string, unknown> {
  return {
    source: {
      id: "fixture-source",
      version: "1",
      revision: "fixture-revision",
      url: null,
    },
    retrievedAt: null,
    observedAt: "2026-07-23T12:00:00Z",
    method,
    hardwareMatch: "exact",
    configurationMatch: "exact",
    scope: {
      taskFamily: null,
      taskPackId: null,
      promptId: null,
      harnessId: "fixture-harness-v1",
    },
    sampleCount: 1,
    measurement: {
      unit,
      interval: null,
      confidence: null,
      eligible: true,
      eligibilityReasons: [],
    },
    rawSourceRecordRef: "fixture://source-record",
  };
}

function fitProfileCaptureReceipt(): FitProfileCaptureReceipt {
  const collection = collectionFixture();
  const contexts: FitProfileCaptureReceipt["contexts"] =
    collection.contexts.map((context) => {
      const observation = context.attempts[0]!;
      if (observation.status !== "completed") {
        throw new Error("fixture requires a completed observation");
      }
      return {
        contextTokens: context.contextTokens,
        attempts: [1, 2, 3].map((repetition) => ({
          attemptId: `capture-fixture-${context.contextTokens}-${repetition}`,
          observedAt: `2026-07-23T10:0${repetition}:00.000Z`,
          rawSourceRecordRef:
            `runner-fit-profile-capture://capture-fixture/`
            + `${context.contextTokens}/${repetition}`,
          status: "completed" as const,
          device: structuredClone(observation.device),
          host: structuredClone(observation.host),
        })),
      };
    });
  const receipt = {
    schemaVersion: 1,
    contract: "runner-fit-profile-capture",
    captureId: "capture-fixture",
    captureVersion: "1",
    capturedAt: "2026-07-23T10:04:00.000Z",
    consent: {
      action: "capture-fit-profile" as const,
      acknowledgedAt: "2026-07-23T10:00:00.000Z",
      localProcessExecutionAcknowledged: true as const,
      grantsServingAuthorization: false as const,
      grantsRecommendationAuthorization: false as const,
    },
    candidate: structuredClone(collection.candidate),
    compatibilityReceipt: structuredClone(collection.compatibilityReceipt),
    hardwareTarget: structuredClone(collection.hardwareTarget),
    bindings: {
      candidateContentSha256: collection.bindings.candidateContentSha256,
      compatibilityReceiptContentSha256:
        collection.bindings.compatibilityReceiptContentSha256,
      hardwareTargetContentSha256: collection.bindings.hardwareTargetContentSha256,
      artifactSha256: collection.bindings.artifactSha256,
      selectedArtifactSha256: collection.bindings.artifactSha256,
    },
    artifact: {
      canonicalPath: "G:\\Models\\fixture.gguf",
      sha256: collection.bindings.artifactSha256,
      bytes: collection.candidate.artifact.bytes,
    },
    tool: {
      id: "llama-fit-params" as const,
      version: "b10061 (5d5306bf3)",
      executableSha256: "d".repeat(64),
      probeProtocolId: "llama-cpp-version-v1" as const,
    },
    command: {
      protocolId: "llama-fit-params-memory-breakdown-v1" as const,
      argvTemplate: [
        "-m",
        "G:\\Models\\fixture.gguf",
        "-c",
        "{contextTokens}",
        "-fitp",
        "on",
        "--offline",
        "--log-disable",
      ],
    },
    runPath: "gpu" as const,
    contexts,
  } satisfies Omit<FitProfileCaptureReceipt, "contentHash">;
  return {
    ...receipt,
    contentHash: recordContentSha256(receipt),
  };
}

function successfulPort(calls: string[]): InvokePort {
  return async <T>(command: string, arguments_?: Record<string, unknown>) => {
    calls.push(command);
    const responses: Record<string, unknown> = {
      admit_runner_import_bundle_preview: {
        importHandle: "import-1",
        expired: false,
        warnings: [],
        previewOnly: true,
        grantsExecutionAuthorization: false,
      },
      evaluate_hardware_confirmation_preview: {
        evaluationHandle: "hardware-evaluation-1",
        state: "ready",
        reasonCodes: [],
        confirmationFields: [],
        differences: [],
        warnings: [],
        previewOnly: true,
        grantsExecutionAuthorization: false,
      },
      confirm_hardware_confirmation_preview: {
        hardwareHandle: "hardware-1",
        hardwareTargetId: "hardware-target-1",
        resolvedTarget: { hardwareTargetId: "hardware-target-1" },
        effectiveTarget: { hardwareTargetId: "hardware-target-1" },
        differences: [],
        acknowledgedReasonCodes: [],
        acknowledgedConfirmationFields: [],
        warnings: [],
        previewOnly: true,
        grantsExecutionAuthorization: false,
      },
      scan_inventory_preview: {
        inventoryHandle: "inventory-1",
        result: {
          status: "ok",
          data: {
            registrySnapshotId: "registry-1",
            registryLastIngestSucceededAt: "2026-07-23T12:00:00Z",
            artifacts: [
              {
                path: "G:\\Models\\fixture.gguf",
                store: "extra",
                label: "fixture.gguf",
                fileSizeBytes: 100,
                sha256: "a".repeat(64),
                resolution: { status: "verified" },
              },
            ],
            duplicateGroups: [],
            unreadable: [],
            stores: [],
            provenance: "detected-local",
          },
          warnings: [],
        },
      },
      select_inventory_preview: {
        selectionHandle: "selection-1",
        selectedPath: "G:\\Models\\fixture.gguf",
        artifactId: "artifact-1",
        sha256: "a".repeat(64),
      },
      probe_existing_tool_preview:
        (arguments_?.kind as string) === "benchmark"
          ? {
              toolHandle: "tool-benchmark-1",
              kind: "benchmark",
              canonicalPath: "G:\\llama\\llama-bench.exe",
              sha256: "b".repeat(64),
              sizeBytes: 100,
              modifiedUnixNanos: "1",
              observedProduct: "llama-cpp",
              observedEngine: "llama.cpp",
              observedEngineBuild: "b10061 (5d5306bf3)",
              probeProtocolId: "llama-cpp-version-v1",
              observedAt: "unix-milliseconds:1",
              previewOnly: true,
              grantsExecutionAuthorization: false,
              childWriteIsolationEnforced: false,
              childNetworkIsolationEnforced: false,
            }
          : (arguments_?.kind as string) === "fit-profile-capture"
            ? {
                toolHandle: "tool-fit-profile-1",
                kind: "fit-profile-capture",
                canonicalPath: "G:\\llama\\llama-fit-params.exe",
                sha256: "d".repeat(64),
                sizeBytes: 100,
                modifiedUnixNanos: "1",
                observedProduct: "llama-cpp",
                observedEngine: "llama.cpp",
                observedEngineBuild: "b10061 (5d5306bf3)",
                probeProtocolId: "llama-cpp-version-v1",
                observedAt: "unix-milliseconds:1",
                previewOnly: true,
                grantsExecutionAuthorization: false,
                childWriteIsolationEnforced: false,
                childNetworkIsolationEnforced: false,
              }
          : {
              toolHandle: "tool-quick-1",
              kind: "quick-check",
              canonicalPath: "G:\\llama\\llama-cli.exe",
              sha256: "c".repeat(64),
              sizeBytes: 100,
              modifiedUnixNanos: "1",
              observedProduct: "llama-cpp",
              observedEngine: "llama.cpp",
              observedEngineBuild: "b10061 (5d5306bf3)",
              probeProtocolId: "llama-cpp-version-v1",
              observedAt: "unix-milliseconds:1",
              previewOnly: true,
              grantsExecutionAuthorization: false,
              childWriteIsolationEnforced: false,
              childNetworkIsolationEnforced: false,
            },
      prepare_verification_plan_preview: {
        preparedHandle: "prepared-1",
        plan: {
          verificationPlanId: "desktop-verification-1",
          candidateId: "candidate-1",
          benchmarkPlan: {
            benchmarkPlanId: "benchmark-plan-1",
            candidateId: "candidate-1",
            warmupRuns: 1,
            measuredRuns: 1,
            measurementKinds: ["generation"],
          },
          quickCheckPlan: {
            quickCheckPlanId: "quick-plan-1",
            candidateId: "candidate-1",
            checks: [
              {
                checkId: "json-schema",
                criterion: "Return the exact required JSON object.",
              },
            ],
          },
        },
        artifact: {
          path: "G:\\Models\\fixture.gguf",
          sha256: "a".repeat(64),
        },
        benchmarkTool: {
          path: "G:\\llama\\llama-bench.exe",
          sha256: "b".repeat(64),
        },
        quickCheckTool: {
          path: "G:\\llama\\llama-cli.exe",
          sha256: "c".repeat(64),
        },
        warnings: [],
        previewOnly: true,
        grantsExecutionAuthorization: false,
      },
      prepare_fit_profile_capture_preview: {
        preparedCaptureHandle: "prepared-capture-1",
        captureId: "capture-fixture",
        protocolId: "llama-fit-params-memory-breakdown-v1",
        artifact: {
          path: "G:\\Models\\fixture.gguf",
          sha256: "a".repeat(64),
        },
        tool: {
          path: "G:\\llama\\llama-fit-params.exe",
          sha256: "d".repeat(64),
        },
        contextTokens: [4096, 16384],
        repetitionsPerContext: 3,
        warnings: [],
        previewOnly: true,
        grantsExecutionAuthorization: false,
        grantsServingAuthorization: false,
        grantsRecommendationAuthorization: false,
      },
      execute_fit_profile_capture: { receipt: fitProfileCaptureReceipt() },
      start_verification_execution: {
        executionHandle: "execution-1",
        snapshot: lifecycle("running", "model-loading"),
      },
      get_verification_execution_status: lifecycle("terminal", "complete"),
      get_verification_execution_result: {
        snapshot: lifecycle("terminal", "complete"),
        verificationResult: {
          verificationResultId: "result-1",
          verificationPlanId: "desktop-verification-1",
          candidateId: "candidate-1",
          domainStatus: "completed",
          benchmarkResult: {
            benchmarkResultId: "benchmark-result-1",
            benchmarkPlanId: "benchmark-plan-1",
            candidateId: "candidate-1",
            domainStatus: "completed",
            series: [
              {
                kind: "generation",
                unit: "tokens-per-second",
                warmupSamples: [11],
                measuredSamples: [12],
                aggregate: {
                  minimum: 12,
                  maximum: 12,
                  median: 12,
                },
                completion: "completed",
                stability: "stable",
                evidence: observationEvidence(
                  "measurement",
                  "tokens-per-second",
                ),
              },
            ],
            calibrationEligible: false,
            calibrationExclusions: ["fixture"],
            diagnostics: [],
          },
          quickCheckResult: {
            quickCheckResultId: "quick-result-1",
            quickCheckPlanId: "quick-plan-1",
            candidateId: "candidate-1",
            domainStatus: "completed",
            checks: [
              {
                checkId: "json-schema",
                criterion: "Return the exact required JSON object.",
                status: "pass",
                explanation: "The output matched the fixture criterion.",
                localDiagnostics: null,
                evidence: observationEvidence("objective-check", "boolean"),
              },
            ],
          },
        },
      },
      stop_verification_execution: lifecycle("terminal", "complete"),
    };
    assert.ok(command in responses, `unexpected command ${command}`);
    return structuredClone(responses[command]) as T;
  };
}

async function preparedApplication(
  calls: string[],
  port: InvokePort = successfulPort(calls),
): Promise<RunnerApplication> {
  const app = new RunnerApplication(port);
  await app.importBundle('{"contract":"runner-import-bundle"}');
  await app.evaluateHardware();
  await app.confirmHardware(false);
  await app.scanInventory([]);
  await app.selectArtifact("G:\\Models\\fixture.gguf");
  await app.probeTools(
    "G:\\llama\\llama-bench.exe",
    "G:\\llama\\llama-cli.exe",
  );
  await app.prepareVerification();
  return app;
}

test("M-P consumes the M-O sequence unchanged through a completed user flow", async () => {
  const calls: string[] = [];
  const app = await preparedApplication(calls);
  assert.equal(app.snapshot().stage, "permission");
  assert.deepEqual(app.snapshot().reasonCodes, []);

  let state = await app.startExecution({
    localProcess: true,
    modelLoad: true,
    machineBusy: true,
  });
  assert.equal(state.stage, "progress");
  assert.equal(state.lifecycle?.phase, "model-loading");

  state = await app.refreshExecution();
  assert.equal(state.stage, "result");
  assert.equal(state.status, "ready");
  assert.equal(state.result?.domainStatus, "completed");
  assert.deepEqual(calls, [
    "admit_runner_import_bundle_preview",
    "evaluate_hardware_confirmation_preview",
    "confirm_hardware_confirmation_preview",
    "scan_inventory_preview",
    "select_inventory_preview",
    "probe_existing_tool_preview",
    "probe_existing_tool_preview",
    "prepare_verification_plan_preview",
    "start_verification_execution",
    "get_verification_execution_status",
    "get_verification_execution_result",
  ]);
});

test("M-P makes U27 capture inspectable but never promotes it into a recommendation", async () => {
  const calls: string[] = [];
  const app = await preparedApplication(calls);
  let state = await app.prepareFitProfileCapture(
    "G:\\llama\\llama-fit-params.exe",
    "capture-fixture",
  );
  assert.equal(state.stage, "fit-capture-permission");
  assert.equal(state.status, "ready");
  assert.equal(state.fitProfileCapture?.contextTokens.join(","), "4096,16384");
  assert.equal(state.fitProfileCaptureReceipt, undefined);

  const beforeConsent = calls.length;
  state = await app.executeFitProfileCapture(false);
  assert.equal(state.stage, "fit-capture-permission");
  assert.equal(state.status, "blocked");
  assert.deepEqual(state.reasonCodes, [
    "m-p.capture.local-process-acknowledgement-required",
  ]);
  assert.equal(calls.length, beforeConsent);

  state = await app.executeFitProfileCapture(true);
  assert.equal(state.stage, "fit-capture-result");
  assert.equal(state.status, "partial");
  assert.deepEqual(state.reasonCodes, ["u27.capture.proposed-unreviewed"]);
  assert.equal(state.fitProfileCaptureReceipt?.captureId, "capture-fixture");
  assert.equal(
    state.fitProfileCaptureReceipt?.consent.grantsRecommendationAuthorization,
    false,
  );
  assert.deepEqual(calls.slice(-3), [
    "probe_existing_tool_preview",
    "prepare_fit_profile_capture_preview",
    "execute_fit_profile_capture",
  ]);
});

test("M-P rejects a same-ID mutation in a U27 capture receipt", async () => {
  const calls: string[] = [];
  const base = successfulPort(calls);
  const app = await preparedApplication(calls, async <T>(
    command: string,
    payload?: Record<string, unknown>,
  ) => {
    if (command === "execute_fit_profile_capture") {
      const receipt = fitProfileCaptureReceipt();
      const runtime = receipt.candidate.runtime as { batchSize: number | null };
      runtime.batchSize = (runtime.batchSize ?? 0) + 1;
      const snapshot = structuredClone(receipt) as Record<string, unknown>;
      delete snapshot.contentHash;
      receipt.contentHash = recordContentSha256(snapshot);
      return { receipt } as T;
    }
    return base<T>(command, payload);
  });
  await app.prepareFitProfileCapture(
    "G:\\llama\\llama-fit-params.exe",
    "capture-fixture",
  );
  const state = await app.executeFitProfileCapture(true);
  assert.equal(state.stage, "fit-capture-permission");
  assert.equal(state.status, "blocked");
  assert.equal(state.reasonCodes[0], "m-p.capture.receipt-invalid");
  assert.equal(state.fitProfileCaptureReceipt, undefined);
});

test("M-P delegates the complete fixed plan to the versioned policy below the surface", async () => {
  const request = createVerificationPlanRequestV1({
    importHandle: "import-1",
    hardwareHandle: "hardware-1",
    selectionHandle: "selection-1",
    benchmarkToolHandle: "benchmark-1",
    quickCheckToolHandle: "quick-1",
  });
  assert.deepEqual(request, {
    policyId: VERIFICATION_PLAN_POLICY_V1,
    importHandle: "import-1",
    hardwareHandle: "hardware-1",
    selectionHandle: "selection-1",
    benchmarkToolHandle: "benchmark-1",
    quickCheckToolHandle: "quick-1",
  });
  assert.throws(
    () =>
      createVerificationPlanRequestV1({
        importHandle: "",
        hardwareHandle: "hardware-1",
        selectionHandle: "selection-1",
        benchmarkToolHandle: "benchmark-1",
        quickCheckToolHandle: "quick-1",
      }),
    /importHandle-required/,
  );
});

test("M-P refuses execution until all three side-effect consents are explicit", async () => {
  const calls: string[] = [];
  const app = await preparedApplication(calls);
  const before = calls.length;
  const state = await app.startExecution({
    localProcess: true,
    modelLoad: true,
    machineBusy: false,
  });
  assert.equal(state.stage, "permission");
  assert.equal(state.status, "blocked");
  assert.deepEqual(state.reasonCodes, ["m-p.execution.all-consents-required"]);
  assert.equal(calls.length, before);
});

test("M-P preserves lower-layer unavailable and partial states without promotion", async () => {
  const unavailable = new RunnerApplication(async <T>(command: string) => {
    if (command === "admit_runner_import_bundle_preview") {
      return {
        importHandle: "import-1",
        expired: true,
        warnings: ["m-o.import.expired-confirmed"],
        previewOnly: true,
        grantsExecutionAuthorization: false,
      } as T;
    }
    throw ["m-d.hardware.unavailable"];
  });
  let state = await unavailable.importBundle("{}", true);
  assert.equal(state.status, "partial");
  assert.equal(state.expired, true);
  state = await unavailable.evaluateHardware();
  assert.equal(state.status, "unavailable");
  assert.deepEqual(state.reasonCodes, ["m-d.hardware.unavailable"]);
  assert.equal(state.hardwareHandle, undefined);
});

test("M-P never asks M-O to confirm blocked or unavailable hardware", async () => {
  for (const producerState of ["blocked", "unavailable"] as const) {
    const calls: string[] = [];
    const app = new RunnerApplication(async <T>(command: string) => {
      calls.push(command);
      if (command === "admit_runner_import_bundle_preview") {
        return {
          importHandle: "import-1",
          expired: false,
          warnings: [],
          previewOnly: true,
          grantsExecutionAuthorization: false,
        } as T;
      }
      if (command === "evaluate_hardware_confirmation_preview") {
        return {
          evaluationHandle: "evaluation-1",
          state: producerState,
          reasonCodes: [`m-d.hardware.${producerState}`],
          confirmationFields: [],
          differences: [],
          warnings: [],
          previewOnly: true,
          grantsExecutionAuthorization: false,
        } as T;
      }
      throw new Error(`unexpected command ${command}`);
    });
    await app.importBundle("{}");
    await app.evaluateHardware();
    const state = await app.confirmHardware(true);
    assert.equal(state.status, producerState);
    assert.equal(state.hardwareHandle, undefined);
    assert.deepEqual(calls, [
      "admit_runner_import_bundle_preview",
      "evaluate_hardware_confirmation_preview",
    ]);
  }
});

test("M-P rejects a hardware preview that crosses the authorization boundary", async () => {
  const app = new RunnerApplication(async <T>(command: string) => {
    if (command === "admit_runner_import_bundle_preview") {
      return {
        importHandle: "import-1",
        expired: false,
        warnings: [],
        previewOnly: true,
        grantsExecutionAuthorization: false,
      } as T;
    }
    return {
      evaluationHandle: "evaluation-1",
      state: "ready",
      reasonCodes: [],
      confirmationFields: [],
      differences: [],
      warnings: [],
      previewOnly: false,
      grantsExecutionAuthorization: true,
    } as T;
  });
  await app.importBundle("{}");
  const state = await app.evaluateHardware();
  assert.equal(state.status, "blocked");
  assert.deepEqual(state.reasonCodes, [
    "m-p.hardware.preview-authority-invalid",
  ]);
  assert.equal(state.hardwareEvaluation, undefined);
});

test("M-P rejects unknown hardware difference enums before confirmation", async () => {
  const calls: string[] = [];
  const base = successfulPort(calls);
  const port: InvokePort = async <T>(
    command: string,
    arguments_?: Record<string, unknown>,
  ) => {
    if (command === "evaluate_hardware_confirmation_preview") {
      calls.push(command);
      return {
        evaluationHandle: "evaluation-1",
        state: "confirmation-required",
        reasonCodes: ["m-d.hardware.fixture"],
        confirmationFields: ["accelerators[0].memoryBytes"],
        differences: [
          {
            field: "accelerators[0].memoryBytes",
            imported: "1",
            resolved: "2",
            kind: "future-auto-accept",
            reasonCode: "m-d.hardware.fixture",
          },
        ],
        warnings: [],
        previewOnly: true,
        grantsExecutionAuthorization: false,
      } as T;
    }
    return base<T>(command, arguments_);
  };
  const app = new RunnerApplication(port);
  await app.importBundle("{}");
  const state = await app.evaluateHardware();
  assert.equal(state.status, "blocked");
  assert.deepEqual(state.reasonCodes, ["m-p.hardware.preview-invalid"]);
  assert.equal(state.hardwareEvaluation, undefined);
});

test("M-P reports stale handles as blocked and never reconstructs authority", async () => {
  const calls: string[] = [];
  const base = successfulPort(calls);
  const port: InvokePort = async <T>(
    command: string,
    arguments_?: Record<string, unknown>,
  ) => {
    if (command === "get_verification_execution_status") {
      throw ["m-o.execution.reference-invalid-or-stale"];
    }
    return base<T>(command, arguments_);
  };
  const app = await preparedApplication(calls, port);
  await app.startExecution({
    localProcess: true,
    modelLoad: true,
    machineBusy: true,
  });
  const state = await app.refreshExecution();
  assert.equal(state.status, "blocked");
  assert.deepEqual(state.reasonCodes, ["m-o.execution.reference-invalid-or-stale"]);
  assert.equal(state.executionHandle, "execution-1");
});

test("M-P does not mutate caller-owned bundle text or consent objects", async () => {
  const calls: string[] = [];
  const app = await preparedApplication(calls);
  const consent = Object.freeze({
    localProcess: true,
    modelLoad: true,
    machineBusy: true,
  });
  await app.startExecution(consent);
  assert.deepEqual(consent, {
    localProcess: true,
    modelLoad: true,
    machineBusy: true,
  });
});

test("M-P hands the approved runner-import fixture to M-O byte-for-byte", async () => {
  const bundle = await readFile(
    new URL("../docs/contracts/fixtures/runner-import-bundle.ok.json", import.meta.url),
    "utf8",
  );
  let observedBundle: unknown;
  const app = new RunnerApplication(async <T>(
    command: string,
    payload?: Record<string, unknown>,
  ) => {
    assert.equal(command, "admit_runner_import_bundle_preview");
    observedBundle = payload?.bundleJson;
    return {
      importHandle: "import-fixture",
      expired: false,
      warnings: [],
      previewOnly: true,
      grantsExecutionAuthorization: false,
    } as T;
  });
  const state = await app.importBundle(bundle);
  assert.equal(state.status, "ready");
  assert.equal(observedBundle, bundle);
});

test("M-P keeps an empty inventory empty and does not fabricate a selection", async () => {
  const calls: string[] = [];
  const base = successfulPort(calls);
  const port: InvokePort = async <T>(
    command: string,
    arguments_?: Record<string, unknown>,
  ) => {
    if (command === "scan_inventory_preview") {
      calls.push(command);
      return {
        inventoryHandle: "inventory-empty",
        result: {
          status: "ok",
          data: {
            registrySnapshotId: "registry-empty",
            registryLastIngestSucceededAt: "2026-07-23T12:00:00Z",
            artifacts: [],
            duplicateGroups: [],
            unreadable: [],
            stores: [],
            provenance: "detected-local",
          },
          warnings: [],
        },
      } as T;
    }
    return base<T>(command, arguments_);
  };
  const app = new RunnerApplication(port);
  await app.importBundle("{}");
  await app.evaluateHardware();
  await app.confirmHardware(false);
  const state = await app.scanInventory([]);
  assert.equal(state.status, "ready");
  assert.deepEqual(state.inventory?.result.data.artifacts, []);
  assert.equal(state.selectionHandle, undefined);
  assert.match(state.message, /No supported local model artifact/);
});

test("M-P hashes only an explicitly selected size candidate and preserves preview authority", async () => {
  const calls: string[] = [];
  const payloads: Record<string, unknown>[] = [];
  const base = successfulPort(calls);
  const port: InvokePort = async <T>(
    command: string,
    arguments_?: Record<string, unknown>,
  ) => {
    if (command === "scan_inventory_preview") {
      calls.push(command);
      return {
        inventoryHandle: "inventory-candidate",
        result: {
          status: "ok",
          data: {
            registrySnapshotId: "registry-candidate",
            registryLastIngestSucceededAt: "2026-07-23T12:00:00Z",
            artifacts: [
              {
                path: "H:\\llama\\models\\candidate.gguf",
                store: "extra",
                label: "candidate.gguf",
                fileSizeBytes: 100,
                sha256: null,
                resolution: {
                  status: "candidateBySize",
                  candidates: [{ artifactId: "artifact-1" }],
                },
              },
            ],
            duplicateGroups: [],
            unreadable: [],
            stores: [],
            provenance: "detected-local",
          },
          warnings: [],
        },
      } as T;
    }
    if (command === "hash_selected_inventory_file_preview") {
      calls.push(command);
      payloads.push(structuredClone(arguments_ ?? {}));
      return {
        selectionHandle: "selection-hashed",
        status: "verified",
        selectedPath: "H:\\llama\\models\\candidate.gguf",
        artifactId: "artifact-1",
        sha256: "a".repeat(64),
        bytes: 100,
        previewOnly: true,
        grantsExecutionAuthorization: false,
      } as T;
    }
    return base<T>(command, arguments_);
  };
  const app = new RunnerApplication(port);
  await app.importBundle("{}");
  await app.evaluateHardware();
  await app.confirmHardware(false);
  await app.scanInventory([]);
  const state = await app.selectArtifact(
    "H:\\llama\\models\\candidate.gguf",
  );
  assert.equal(state.status, "ready");
  assert.equal(state.selectionHandle, "selection-hashed");
  assert.match(state.message, /explicitly selected file was hashed/);
  assert.deepEqual(payloads, [
    {
      importHandle: "import-1",
      inventoryHandle: "inventory-candidate",
      selectedPath: "H:\\llama\\models\\candidate.gguf",
    },
  ]);
});

test("M-P exposes an unexpected producer error without advancing authority", async () => {
  const app = new RunnerApplication(async () => {
    throw new Error("fixture-producer-crashed");
  });
  const state = await app.importBundle("{}");
  assert.equal(state.status, "error");
  assert.equal(state.stage, "welcome");
  assert.deepEqual(state.reasonCodes, ["fixture-producer-crashed"]);
  assert.equal(state.importHandle, undefined);
});

test("M-P surfaces stop and replay rejection without losing the execution identity", async () => {
  const calls: string[] = [];
  const base = successfulPort(calls);
  let starts = 0;
  const port: InvokePort = async <T>(
    command: string,
    arguments_?: Record<string, unknown>,
  ) => {
    if (command === "start_verification_execution" && starts++ > 0) {
      throw ["m-o.execution.prepared-handle-invalid-or-consumed"];
    }
    return base<T>(command, arguments_);
  };
  const app = await preparedApplication(calls, port);
  await app.startExecution({
    localProcess: true,
    modelLoad: true,
    machineBusy: true,
  });
  let state = await app.stopExecution();
  assert.equal(state.status, "partial");
  assert.equal(state.executionHandle, "execution-1");
  assert.match(state.message, /already finished/);

  state = await app.startExecution({
    localProcess: true,
    modelLoad: true,
    machineBusy: true,
  });
  assert.equal(state.status, "blocked");
  assert.deepEqual(state.reasonCodes, [
    "m-o.execution.prepared-handle-invalid-or-consumed",
  ]);
  assert.equal(state.executionHandle, "execution-1");
});

test("M-P ignores delayed lifecycle snapshots instead of regressing progress", async () => {
  const calls: string[] = [];
  const base = successfulPort(calls);
  let refreshes = 0;
  const port: InvokePort = async <T>(
    command: string,
    arguments_?: Record<string, unknown>,
  ) => {
    if (command === "get_verification_execution_status") {
      calls.push(command);
      refreshes += 1;
      return structuredClone(
        refreshes === 1
          ? lifecycle("running", "benchmark-measured", 6)
          : lifecycle("running", "benchmark-warmup", 5),
      ) as T;
    }
    return base<T>(command, arguments_);
  };
  const app = await preparedApplication(calls, port);
  await app.startExecution({
    localProcess: true,
    modelLoad: true,
    machineBusy: true,
  });
  let state = await app.refreshExecution();
  assert.equal(state.lifecycle?.sequence, 6);
  assert.equal(state.lifecycle?.phase, "benchmark-measured");
  state = await app.refreshExecution();
  assert.equal(state.lifecycle?.sequence, 6);
  assert.equal(state.lifecycle?.phase, "benchmark-measured");
  assert.match(state.message, /delayed progress response was ignored/);
});

test("M-P rejects same-sequence mutation and cross-identity lifecycle data", async () => {
  for (const mutation of ["same-sequence", "identity"] as const) {
    const calls: string[] = [];
    const base = successfulPort(calls);
    const port: InvokePort = async <T>(
      command: string,
      arguments_?: Record<string, unknown>,
    ) => {
      if (command === "get_verification_execution_status") {
        calls.push(command);
        const snapshot = lifecycle("running", "benchmark-warmup", 2);
        if (mutation === "same-sequence") snapshot.elapsedMs += 1;
        else snapshot.candidateId = "forged-candidate";
        return snapshot as T;
      }
      return base<T>(command, arguments_);
    };
    const app = await preparedApplication(calls, port);
    await app.startExecution({
      localProcess: true,
      modelLoad: true,
      machineBusy: true,
    });
    const state = await app.refreshExecution();
    assert.equal(state.status, "blocked");
    assert.equal(state.lifecycle?.candidateId, "candidate-1");
    assert.deepEqual(state.reasonCodes, [
      mutation === "same-sequence"
        ? "m-p.execution.same-sequence-mutation"
        : "m-p.execution.lifecycle-identity-mismatch",
    ]);
  }
});

test("M-P rejects unknown lifecycle versions and impossible progress", async () => {
  for (const mutate of [
    (snapshot: LifecycleSnapshot) => {
      snapshot.version = 2;
    },
    (snapshot: LifecycleSnapshot) => {
      snapshot.phaseCurrent = snapshot.phaseTotal + 1;
    },
    (snapshot: LifecycleSnapshot) => {
      snapshot.updatedAt = "not-a-time";
    },
    (snapshot: LifecycleSnapshot) => {
      snapshot.state = "terminal";
      snapshot.phase = "queued";
    },
  ]) {
    const calls: string[] = [];
    const base = successfulPort(calls);
    const port: InvokePort = async <T>(
      command: string,
      arguments_?: Record<string, unknown>,
    ) => {
      if (command === "get_verification_execution_status") {
        const snapshot = lifecycle("running", "benchmark-measured", 3);
        mutate(snapshot);
        return snapshot as T;
      }
      return base<T>(command, arguments_);
    };
    const app = await preparedApplication(calls, port);
    await app.startExecution({
      localProcess: true,
      modelLoad: true,
      machineBusy: true,
    });
    const state = await app.refreshExecution();
    assert.equal(state.status, "blocked");
    assert.deepEqual(state.reasonCodes, ["m-p.execution.lifecycle-invalid"]);
  }
});

test("M-P rejects forged completed nested results and plan identity drift", async () => {
  for (const mutation of [
    "observation",
    "minimal-shape",
    "planned-set",
    "sample-count",
    "criterion",
    "metadata",
    "plan-id",
  ] as const) {
    const calls: string[] = [];
    const base = successfulPort(calls);
    const port: InvokePort = async <T>(
      command: string,
      arguments_?: Record<string, unknown>,
    ) => {
      if (command === "get_verification_execution_result") {
        calls.push(command);
        const result = {
          snapshot: lifecycle("terminal", "complete"),
          verificationResult: {
            verificationResultId: "result-forged",
            verificationPlanId: "desktop-verification-1",
            candidateId: "candidate-1",
            domainStatus: "completed",
            benchmarkResult: {
              benchmarkResultId: "benchmark-result-forged",
              benchmarkPlanId:
                mutation === "plan-id"
                  ? "other-benchmark-plan"
                  : "benchmark-plan-1",
              candidateId: "candidate-1",
              domainStatus: "completed",
              series:
                mutation === "observation"
                  ? [{}]
                  : mutation === "planned-set"
                    ? [
                        {
                          kind: "prompt-processing",
                          unit: "tokens-per-second",
                          warmupSamples: [11],
                          measuredSamples: [12],
                          aggregate: {
                            minimum: 12,
                            maximum: 12,
                            median: 12,
                          },
                          completion: "completed",
                          stability: "stable",
                          evidence: observationEvidence(
                            "measurement",
                            "tokens-per-second",
                          ),
                        },
                      ]
                  : [
                      {
                        kind: "generation",
                        ...(mutation === "minimal-shape"
                          ? {
                              measuredSamples: [12],
                              evidence: {
                                method: "measurement",
                                hardwareMatch: "exact",
                                configurationMatch: "exact",
                              },
                            }
                          : {
                              unit: "tokens-per-second",
                              warmupSamples:
                                mutation === "sample-count" ? [] : [11],
                              measuredSamples:
                                mutation === "sample-count" ? [12, 13] : [12],
                              aggregate: {
                                minimum: 12,
                                maximum: 12,
                                median: 12,
                              },
                              completion: "completed",
                              stability: "stable",
                              evidence: observationEvidence(
                                "measurement",
                                "tokens-per-second",
                              ),
                            }),
                      },
                    ],
              calibrationEligible:
                mutation === "metadata" ? "false" : false,
              calibrationExclusions: [],
              diagnostics: [],
            },
            quickCheckResult: {
              quickCheckResultId: "quick-result-forged",
              quickCheckPlanId: "quick-plan-1",
              candidateId: "candidate-1",
              domainStatus: "completed",
              checks: [
                {
                  checkId: "json-schema",
                  status: "pass",
                  ...(mutation === "minimal-shape"
                    ? {
                        evidence: {
                          method: "objective-check",
                          hardwareMatch: "exact",
                          configurationMatch: "exact",
                        },
                      }
                    : {
                        criterion:
                          mutation === "criterion"
                            ? "Trust the caller-authored result."
                            : "Return the exact required JSON object.",
                        explanation: "The fixture output matched.",
                        localDiagnostics: null,
                        evidence: observationEvidence(
                          "objective-check",
                          "boolean",
                        ),
                      }),
                },
              ],
            },
          },
        };
        return result as T;
      }
      return base<T>(command, arguments_);
    };
    const app = await preparedApplication(calls, port);
    await app.startExecution({
      localProcess: true,
      modelLoad: true,
      machineBusy: true,
    });
    const state = await app.refreshExecution();
    assert.equal(state.status, "blocked");
    assert.deepEqual(state.reasonCodes, ["m-p.execution.result-invalid"]);
    assert.equal(state.result, undefined);
    assert.notEqual(state.message, "Measured on this machine under the displayed exact settings.");
  }
});

test("M-P does not label a failed run partial when no evidence was retained", async () => {
  const calls: string[] = [];
  const base = successfulPort(calls);
  const port: InvokePort = async <T>(
    command: string,
    arguments_?: Record<string, unknown>,
  ) => {
    if (command === "get_verification_execution_result") {
      calls.push(command);
      return {
        snapshot: lifecycle("terminal", "complete"),
        verificationResult: {
          verificationResultId: "failed-result-1",
          verificationPlanId: "desktop-verification-1",
          candidateId: "candidate-1",
          domainStatus: "failed",
          benchmarkResult: null,
          quickCheckResult: null,
        },
      } as T;
    }
    return base<T>(command, arguments_);
  };
  const app = await preparedApplication(calls, port);
  await app.startExecution({
    localProcess: true,
    modelLoad: true,
    machineBusy: true,
  });
  const state = await app.refreshExecution();
  assert.equal(state.stage, "failure");
  assert.equal(state.status, "error");
  assert.match(state.message, /no admissible observation/);
});

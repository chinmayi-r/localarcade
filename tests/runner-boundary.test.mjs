import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("R1 runner has no HTTP client, socket, or updater crates", async () => {
  const cargo = await readFile(new URL("../runner/src-tauri/Cargo.toml", import.meta.url), "utf8");
  for (const forbidden of ["reqwest", "hyper", "ureq", "curl", "tokio-tungstenite", "tauri-plugin-updater", "tauri-plugin-http"]) {
    assert.doesNotMatch(cargo, new RegExp(`^\\s*"?${forbidden}"?\\s*=`, "m"), `${forbidden} must not be a runner dependency in R1`);
  }
});

test("R1 capabilities grant core IPC only", async () => {
  const capability = JSON.parse(await readFile(new URL("../runner/src-tauri/capabilities/default.json", import.meta.url), "utf8"));
  assert.deepEqual(capability.permissions, ["core:default"]);
});

test("R1 config has a strict CSP and no updater or plugin section", async () => {
  const conf = JSON.parse(await readFile(new URL("../runner/src-tauri/tauri.conf.json", import.meta.url), "utf8"));
  assert.ok(conf.app.security.csp && conf.app.security.csp.includes("default-src 'self'"), "CSP must be strict, not null");
  assert.equal(conf.plugins, undefined, "no plugins may be configured in R1");
  assert.equal(conf.identifier, "org.localarcade.runner");
});

test("R3 scan module contains no write APIs at all", async () => {
  const source = await readFile(new URL("../runner/src-tauri/src/model_store.rs", import.meta.url), "utf8");
  for (const forbidden of ["fs::write", "File::create", "OpenOptions", "create_dir", "remove_file", "remove_dir", "set_len", "fs::copy", "fs::rename", "hard_link", "symlink"]) {
    assert.ok(!source.includes(forbidden), `${forbidden} must not appear in the read-only scan module`);
  }
});

test("R4 benchmark module spawns exactly llama-bench and nothing else", async () => {
  const source = await readFile(new URL("../runner/src-tauri/src/benchmark.rs", import.meta.url), "utf8");
  const spawnSites = source.match(/Command::new\(([^)]*)\)/g) ?? [];
  assert.equal(spawnSites.length, 1, "exactly one spawn site is allowed");
  assert.match(source, /const BENCH_EXECUTABLE: &str = "llama-bench";/);
  assert.ok(spawnSites[0].includes("&executable"), "the spawn site must use the checked llama-bench path");
  for (const forbidden of ["reqwest", "TcpStream", "UdpSocket", "fs::write", "File::create"]) {
    assert.ok(!source.includes(forbidden), `${forbidden} must not appear in the benchmark module`);
  }
  assert.match(source, /calibration_eligibility/, "benchmark reports must separate exact observations from calibration baselines");
  assert.match(source, /concurrent GPU workload telemetry was unavailable/, "unknown GPU contention must fail closed for calibration");
});

test("R4 quick-task module spawns exactly the checked llama-cli path", async () => {
  const source = await readFile(new URL("../runner/src-tauri/src/quick_task.rs", import.meta.url), "utf8");
  const spawnSites = source.match(/Command::new\(([^)]*)\)/g) ?? [];
  assert.equal(spawnSites.length, 1, "exactly one quick-task spawn site is allowed");
  assert.match(source, /const QUICK_EXECUTABLE: &str = "llama-cli";/);
  assert.match(source, /claim: "mechanical-task-checks-only"/);
  assert.doesNotMatch(source, /qualityScore|intelligenceScore|overallScore/, "mechanical checks must not become a general quality score");
  assert.ok(spawnSites[0].includes("executable"), "the spawn site must use the checked llama-cli path");
  for (const forbidden of ["reqwest", "TcpStream", "UdpSocket", "fs::write", "File::create", "OpenOptions"]) {
    assert.ok(!source.includes(forbidden), `${forbidden} must not appear in the quick-task module`);
  }
});

test("M-J verification adapter has no IPC, network, download, update, upload, or child-isolation claim", async () => {
  const source = await readFile(new URL("../runner/src-tauri/src/verification.rs", import.meta.url), "utf8");
  for (const forbidden of [
    /#\[tauri::command\]/,
    /Command::new/,
    /TcpStream|UdpSocket|reqwest|hyper|ureq|fetch\s*\(/,
    /tauri_plugin_(?:http|updater)|download_file|upload_file/i,
    /AppContainer|CreateRestrictedToken|JobObject/i,
    /File::create|OpenOptions|fs::write|remove_file|remove_dir/,
  ]) assert.doesNotMatch(source, forbidden);
  assert.match(source, /SideEffects\s*\{[\s\S]*?executes_local_process:\s*true,[\s\S]*?loads_model:\s*true,[\s\S]*?writes_model_store:\s*false,[\s\S]*?network:\s*false,[\s\S]*?upload:\s*false,[\s\S]*?\}/);
  assert.match(source, /child-isolation-not-enforced/);
  assert.match(source, /ValidatedCompatibilityAdmissionReceipt/);
  assert.match(source, /validate_compatibility_admission/);
  assert.doesNotMatch(source, /m-e-compatibility-proof-unavailable/);
});

test("M-O preview IPC is local, non-authorizing, and consumed only through M-P", async () => {
  const adapter = await readFile(new URL("../runner/src-tauri/src/preview_adapter.rs", import.meta.url), "utf8");
  const lib = await readFile(new URL("../runner/src-tauri/src/lib.rs", import.meta.url), "utf8");
  const frontend = await readFile(new URL("../runner/src/main.ts", import.meta.url), "utf8");
  const application = await readFile(new URL("../runner/src/runner-application.ts", import.meta.url), "utf8");
  for (const forbidden of [
    /Command::new/,
    /TcpStream|UdpSocket|reqwest|hyper|ureq/,
    /download|upload|updater/i,
    /File::create|OpenOptions|fs::write|remove_file|remove_dir/,
  ]) assert.doesNotMatch(adapter, forbidden);
  assert.match(adapter, /grants_execution_authorization:\s*false/);
  assert.match(adapter, /pub differences:\s*Vec<HardwareDifferencePreview>/, "hardware confirmation must expose reviewable differences");
  assert.match(adapter, /concurrent_gpu:\s*ConcurrentGpu::Unknown/);
  assert.match(lib, /preflight::inspect\(\)/, "IPC must collect preflight locally");
  assert.doesNotMatch(lib, /inspected_at:\s*String/, "IPC must not accept a caller-controlled clock");
  assert.match(lib, /local_inventory_path/, "extra scan directories must pass the local-path gate");
  for (const field of ["canonical_path", "sha256", "observed_engine_build", "probe_protocol_id"]) {
    assert.match(lib, new RegExp(`${field}:`), `tool preview must expose ${field}`);
  }
  for (const command of [
    "admit_runner_import_bundle_preview",
    "begin_manual_hardware_confirmation_preview",
    "evaluate_hardware_confirmation_preview",
    "confirm_hardware_confirmation_preview",
    "scan_inventory_preview",
    "select_inventory_preview",
    "hash_selected_inventory_file_preview",
    "probe_existing_tool_preview",
    "prepare_fit_profile_capture_preview",
    "prepare_verification_plan_preview",
  ]) {
    assert.ok(application.includes(command), `${command} must be consumed by the M-P application adapter`);
    assert.ok(!frontend.includes(command), `${command} must not bypass the M-P application adapter`);
  }
  assert.match(adapter, /local-initial-capture-policy-v1/);
});

test("M-O execution IPC accepts only opaque handles and explicit consent", async () => {
  const transport = await readFile(new URL("../runner/src-tauri/src/execution_transport.rs", import.meta.url), "utf8");
  const lib = await readFile(new URL("../runner/src-tauri/src/lib.rs", import.meta.url), "utf8");
  const frontend = await readFile(new URL("../runner/src/main.ts", import.meta.url), "utf8");
  const application = await readFile(new URL("../runner/src/runner-application.ts", import.meta.url), "utf8");

  const startInput = transport.match(/pub struct StartVerificationExecutionInput \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(startInput, /prepared_handle:\s*String/);
  for (const acknowledgement of [
    "acknowledge_local_process_execution",
    "acknowledge_model_load",
    "acknowledge_machine_may_be_busy",
  ]) assert.match(startInput, new RegExp(`${acknowledgement}: bool`));
  for (const forbidden of [
    /path/i,
    /argv|arguments/i,
    /observation/i,
    /timestamp|clock/i,
    /\bpid\b|process_id/i,
    /authorization/i,
  ]) assert.doesNotMatch(startInput, forbidden);

  const referenceInput = transport.match(/pub struct VerificationExecutionReferenceInput \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(referenceInput, /execution_handle:\s*String/);
  assert.doesNotMatch(referenceInput, /path|argv|observation|timestamp|\bpid\b/i);
  const startOutput = transport.match(/pub struct ExecutionStartViewV1 \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(startOutput, /execution_handle:\s*String/);
  assert.match(startOutput, /snapshot:\s*LifecycleSnapshotV1/);
  assert.doesNotMatch(startOutput, /authorization|path|argv|\bpid\b/i);
  const resultOutput = transport.match(/pub struct ExecutionResultReadV1 \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(resultOutput, /verification_result:\s*Option<VerificationResult>/);
  assert.doesNotMatch(resultOutput, /authorization|raw_record|path|argv|\bpid\b/i);
  assert.match(transport, /deny_unknown_fields/);
  assert.match(transport, /reference-invalid-or-stale/);
  assert.match(lib, /runner-state-poisoned-restart-required/);

  for (const command of [
    "start_verification_execution",
    "execute_fit_profile_capture",
    "get_verification_execution_status",
    "stop_verification_execution",
    "get_verification_execution_result",
  ]) {
    assert.match(lib, new RegExp(`fn ${command}\\(`), `${command} must have a typed runner handler`);
    assert.ok(application.includes(command), `${command} must be consumed by M-P`);
    assert.ok(!frontend.includes(command), `${command} must not bypass the M-P application adapter`);
  }

  const registered = lib.match(/generate_handler!\[([\s\S]*?)\]\)/)?.[1] ?? "";
  assert.doesNotMatch(registered, /\brun_benchmark\b/, "legacy caller-authored benchmark IPC must be retired");
  assert.doesNotMatch(registered, /\brun_quick_tasks\b/, "legacy caller-authored quick-check IPC must be retired");

  const captureInput = transport.match(/pub struct ExecuteFitProfileCaptureInput \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(captureInput, /prepared_capture_handle:\s*String/);
  assert.match(captureInput, /acknowledge_local_process_execution:\s*bool/);
  for (const forbidden of [
    /path/i,
    /argv|arguments/i,
    /observation/i,
    /timestamp|clock/i,
    /\bpid\b|process_id/i,
    /authorization/i,
  ]) assert.doesNotMatch(captureInput, forbidden);
});

test("M-P surface imports only its application adapter and has no retired execution route", async () => {
  const frontend = await readFile(new URL("../runner/src/main.ts", import.meta.url), "utf8");
  const application = await readFile(new URL("../runner/src/runner-application.ts", import.meta.url), "utf8");
  const composition = await readFile(new URL("../runner/src/runner-composition.ts", import.meta.url), "utf8");
  const policy = await readFile(new URL("../runner/src/verification-plan-policy-v1.ts", import.meta.url), "utf8");
  const lib = await readFile(new URL("../runner/src-tauri/src/lib.rs", import.meta.url), "utf8");
  assert.match(frontend, /from "\.\/runner-application"/);
  assert.match(frontend, /from "\.\/runner-composition"/);
  assert.doesNotMatch(frontend, /@tauri-apps|src-tauri|model_store|preview_adapter|execution_service|execution_transport|\binvoke\s*\(/);
  assert.match(composition, /new RunnerApplication\(invoke\)/);
  assert.doesNotMatch(application, /\brun_benchmark\b|\brun_quick_tasks\b/);
  assert.match(application, /validateFitProfileCaptureForPresentation/, "M-P must validate the full U27 receipt before displaying it");
  const capturePresentation = await readFile(new URL("../runner/src/fit-profile-capture-presentation.ts", import.meta.url), "utf8");
  for (const forbidden of [/node:/, /fetch\s*\(/, /XMLHttpRequest|WebSocket/, /@tauri-apps|src-tauri/]) {
    assert.doesNotMatch(capturePresentation, forbidden, "browser-side capture admission must remain pure and local");
  }
  assert.match(frontend, /manual-start-button/);
  assert.match(application, /startManualSetup/);
  assert.match(capturePresentation, /recordContentSha256/, "browser-side capture admission must verify the complete receipt digest");
  for (const surface of [frontend, application]) {
    assert.doesNotMatch(surface, /json-schema|format-constraints|fact-preservation/);
    assert.doesNotMatch(surface, /warmupRuns:\s*1|measuredRuns:\s*3/);
  }
  assert.match(policy, /local-arcade-existing-engine-verification-v1/);
  assert.doesNotMatch(policy, /warmupRuns|measuredRuns|measurementKinds|checkId|criterion/);
  const prepareInput = lib.match(/struct PreparePreviewInput \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(prepareInput, /policy_id:\s*String/);
  for (const required of [
    "import_handle",
    "hardware_handle",
    "selection_handle",
    "benchmark_tool_handle",
    "quick_check_tool_handle",
  ]) assert.match(prepareInput, new RegExp(`${required}: String`));
  assert.doesNotMatch(prepareInput, /plan_id|protocol_id|warmup|measured|measurement|checks/);
  assert.doesNotMatch(policy, /@tauri-apps|fetch\s*\(|localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(application, /localStorage|sessionStorage|indexedDB/);
});

test("M-P frontend makes no external requests", async () => {
  const main = await readFile(new URL("../runner/src/main.ts", import.meta.url), "utf8");
  const application = await readFile(new URL("../runner/src/runner-application.ts", import.meta.url), "utf8");
  const html = await readFile(new URL("../runner/index.html", import.meta.url), "utf8");
  for (const source of [main, application, html]) {
    assert.doesNotMatch(source, /https?:\/\//, "no external URLs in the R1 runner frontend");
    assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket/, "no request APIs in the R1 runner frontend");
  }
});

test("M-P hides imported-hardware comparison during the direct local journey", async () => {
  const main = await readFile(new URL("../runner/src/main.ts", import.meta.url), "utf8");
  assert.match(main, /#detect-button"\)\.hidden = state\.journey === "manual"/);
});

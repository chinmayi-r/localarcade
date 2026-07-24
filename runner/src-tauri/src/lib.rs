pub mod benchmark;
pub mod contracts;
pub mod execution_lifecycle;
pub mod execution_process;
pub mod execution_protocol;
pub mod execution_result_adapter;
pub mod execution_service;
pub mod execution_transport;
pub mod existing_tool_probe;
pub mod fit_profile_capture;
pub mod hardware;
pub mod hardware_confirmation;
pub mod hardware_target;
pub mod model_store;
pub mod preflight;
pub mod preview_adapter;
pub mod quick_task;
pub mod verification;

use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Default)]
struct RunnerState(Mutex<execution_transport::RunnerProcessState>);

fn with_preview_state<T>(
    state: &tauri::State<'_, RunnerState>,
    action: impl FnOnce(&mut preview_adapter::PreviewAssembler) -> Result<T, Vec<String>>,
) -> Result<T, Vec<String>> {
    let mut runner = state
        .0
        .lock()
        .map_err(|_| vec!["m-o.runner-state-poisoned-restart-required".into()])?;
    action(runner.preview_mut())
}

fn with_runner_state<T>(
    state: &tauri::State<'_, RunnerState>,
    action: impl FnOnce(&mut execution_transport::RunnerProcessState) -> Result<T, Vec<String>>,
) -> Result<T, Vec<String>> {
    let mut runner = state
        .0
        .lock()
        .map_err(|_| vec!["m-o.runner-state-poisoned-restart-required".into()])?;
    action(&mut runner)
}

#[tauri::command]
fn admit_runner_import_bundle_preview(
    state: tauri::State<'_, RunnerState>,
    bundle_json: String,
    confirm_expired: bool,
) -> Result<preview_adapter::ImportBundlePreview, Vec<String>> {
    with_preview_state(&state, |assembler| {
        assembler.admit_import_bundle(&bundle_json, confirm_expired)
    })
}

#[tauri::command]
fn evaluate_hardware_confirmation_preview(
    state: tauri::State<'_, RunnerState>,
    import_handle: String,
) -> Result<preview_adapter::HardwareEvaluationPreview, Vec<String>> {
    with_preview_state(&state, |assembler| {
        let handle = preview_adapter::parse_handle(&import_handle).map_err(|error| vec![error])?;
        let imported = assembler
            .imported_hardware_target(&handle)
            .map_err(|error| vec![error])?;
        let resolution = detect_hardware_resolution(imported.hardware_target_id, false);
        assembler
            .evaluate_hardware(&handle, &resolution)
            .map_err(|error| vec![error])
    })
}

#[tauri::command]
fn begin_manual_hardware_confirmation_preview(
    state: tauri::State<'_, RunnerState>,
) -> Result<preview_adapter::ManualHardwareEvaluationPreview, Vec<String>> {
    with_preview_state(&state, |assembler| {
        let target_id = format!(
            "local-session-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|_| vec!["m-o.manual.system-clock-before-epoch".into()])?
                .as_millis()
        );
        assembler.begin_manual_hardware_evaluation(&detect_hardware_resolution(target_id, true))
    })
}

fn detect_hardware_resolution(
    hardware_target_id: String,
    include_logical_cores: bool,
) -> hardware_target::HardwareResolution {
    let report = hardware::detect();
    let mut system = sysinfo::System::new();
    system.refresh_memory();
    hardware_target::resolve_detected_hardware(
        &report,
        hardware_target::DetectedHardwareContext {
            hardware_target_id,
            os_family: if cfg!(windows) {
                contracts::OsFamily::Windows
            } else if cfg!(target_os = "macos") {
                contracts::OsFamily::Macos
            } else if cfg!(target_os = "linux") {
                contracts::OsFamily::Linux
            } else {
                contracts::OsFamily::Other
            },
            os_version: Some(report.os.clone()),
            logical_cores: include_logical_cores
                .then(std::thread::available_parallelism)
                .and_then(Result::ok)
                .and_then(|value| u64::try_from(value.get()).ok()),
            available_ram_bytes: Some(system.available_memory()),
            unified: detected_unified_memory(&report),
        },
    )
}

fn detected_unified_memory(report: &hardware::HardwareReport) -> Option<bool> {
    if cfg!(target_os = "macos") {
        return Some(true);
    }
    (!report.gpus.is_empty()
        && report.gpus.iter().all(|gpu| {
            matches!(
                gpu,
                hardware::GpuReconciliation::Known {
                    detected_memory_gb,
                    kind,
                    ..
                } if *detected_memory_gb > 0.0 && kind == "gpu"
            )
        }))
    .then_some(false)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct HardwareAcknowledgementInput {
    reason_codes: Vec<String>,
    confirmation_fields: Vec<String>,
}

#[tauri::command]
fn confirm_hardware_confirmation_preview(
    state: tauri::State<'_, RunnerState>,
    evaluation_handle: String,
    acknowledgement: Option<HardwareAcknowledgementInput>,
) -> Result<preview_adapter::HardwareConfirmationPreview, Vec<String>> {
    with_preview_state(&state, |assembler| {
        let handle =
            preview_adapter::parse_handle(&evaluation_handle).map_err(|error| vec![error])?;
        let acknowledgement = acknowledgement.map(|value| {
            hardware_confirmation::HardwareConfirmationAcknowledgement {
                reason_codes: value.reason_codes,
                confirmation_fields: value.confirmation_fields,
            }
        });
        assembler.confirm_hardware_evaluation(&handle, acknowledgement.as_ref())
    })
}

#[tauri::command]
fn scan_inventory_preview(
    state: tauri::State<'_, RunnerState>,
    extra_directories: Vec<String>,
) -> Result<preview_adapter::InventoryScanPreview, Vec<String>> {
    with_preview_state(&state, |assembler| {
        let extras: Result<Vec<std::path::PathBuf>, String> = extra_directories
            .into_iter()
            .filter(|directory| !directory.trim().is_empty())
            .map(|directory| preview_adapter::local_inventory_path(&directory))
            .collect();
        assembler
            .retain_inventory_scan(model_store::scan(
                &dirs_home(),
                &extras.map_err(|error| vec![error])?,
            ))
            .map_err(|error| vec![error])
    })
}

#[tauri::command]
fn select_inventory_preview(
    state: tauri::State<'_, RunnerState>,
    import_handle: String,
    inventory_handle: String,
    selected_path: String,
) -> Result<preview_adapter::InventorySelectionPreview, Vec<String>> {
    with_preview_state(&state, |assembler| {
        let import = preview_adapter::parse_handle(&import_handle).map_err(|error| vec![error])?;
        let inventory =
            preview_adapter::parse_handle(&inventory_handle).map_err(|error| vec![error])?;
        assembler.select_inventory_path(&import, &inventory, &selected_path)
    })
}

/// Explicitly hashes one loose file selected from a retained metadata-only
/// scan. It performs no scan, write, network request, process spawn or grant.
#[tauri::command]
fn hash_selected_inventory_file_preview(
    state: tauri::State<'_, RunnerState>,
    import_handle: String,
    inventory_handle: String,
    selected_path: String,
) -> Result<preview_adapter::InventoryHashPromotionPreview, Vec<String>> {
    let selected_path = preview_adapter::local_inventory_path(&selected_path)
        .map_err(|error| vec![error])?
        .to_string_lossy()
        .into_owned();
    with_preview_state(&state, |assembler| {
        let import = preview_adapter::parse_handle(&import_handle).map_err(|error| vec![error])?;
        let inventory =
            preview_adapter::parse_handle(&inventory_handle).map_err(|error| vec![error])?;
        assembler.hash_and_select_inventory_path(&import, &inventory, &selected_path)
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ToolProbePreview {
    tool_handle: String,
    kind: String,
    canonical_path: String,
    sha256: String,
    size_bytes: u64,
    modified_unix_nanos: String,
    observed_product: String,
    observed_engine: String,
    observed_engine_build: String,
    probe_protocol_id: String,
    observed_at: String,
    preview_only: bool,
    grants_execution_authorization: bool,
    child_write_isolation_enforced: bool,
    child_network_isolation_enforced: bool,
}

#[tauri::command]
fn probe_existing_tool_preview(
    state: tauri::State<'_, RunnerState>,
    kind: String,
    selected_path: String,
) -> Result<ToolProbePreview, Vec<String>> {
    let kind = match kind.as_str() {
        "benchmark" => existing_tool_probe::ExistingToolKind::Benchmark,
        "quick-check" => existing_tool_probe::ExistingToolKind::QuickCheck,
        "fit-profile-capture" => existing_tool_probe::ExistingToolKind::FitProfileCapture,
        _ => return Err(vec!["m-o.preview.tool-kind-unsupported".into()]),
    };
    let receipt = existing_tool_probe::probe_existing_tool(
        &existing_tool_probe::ExistingToolProbeRequest {
            action: existing_tool_probe::ExistingToolProbeAction::InspectExistingToolIdentityV1,
            kind,
            selected_path: std::path::PathBuf::from(selected_path),
        },
        &existing_tool_probe::SystemExistingToolProbeBoundary,
    )
    .map_err(|failure| vec![format!("{}:{}", failure.code, failure.detail)])?;
    with_preview_state(&state, |assembler| {
        let handle = assembler.retain_tool_probe(&receipt)?;
        Ok(ToolProbePreview {
            tool_handle: handle.token().to_string(),
            kind: match receipt.kind() {
                existing_tool_probe::ExistingToolKind::Benchmark => "benchmark",
                existing_tool_probe::ExistingToolKind::QuickCheck => "quick-check",
                existing_tool_probe::ExistingToolKind::FitProfileCapture => "fit-profile-capture",
            }
            .into(),
            canonical_path: receipt.canonical_path().to_string_lossy().into_owned(),
            sha256: receipt.sha256().to_string(),
            size_bytes: receipt.size_bytes(),
            modified_unix_nanos: receipt.modified_unix_nanos().to_string(),
            observed_product: receipt.observed_product().to_string(),
            observed_engine: receipt.observed_engine().to_string(),
            observed_engine_build: receipt.observed_engine_build().to_string(),
            probe_protocol_id: receipt.probe_protocol_id().to_string(),
            observed_at: format!("unix-milliseconds:{}", receipt.observed_unix_millis()),
            preview_only: true,
            grants_execution_authorization: false,
            child_write_isolation_enforced: receipt.child_write_isolation_enforced(),
            child_network_isolation_enforced: receipt.child_network_isolation_enforced(),
        })
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PreparePreviewInput {
    policy_id: String,
    import_handle: String,
    hardware_handle: String,
    selection_handle: String,
    benchmark_tool_handle: String,
    quick_check_tool_handle: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PrepareFitProfileCaptureInput {
    import_handle: String,
    hardware_handle: String,
    selection_handle: String,
    tool_handle: String,
    capture_id: String,
    manual_context_tokens: Option<u64>,
}

#[tauri::command]
fn prepare_fit_profile_capture_preview(
    state: tauri::State<'_, RunnerState>,
    request: PrepareFitProfileCaptureInput,
) -> Result<preview_adapter::FitProfileCapturePreview, Vec<String>> {
    with_preview_state(&state, |assembler| {
        let parse = |value: &str| preview_adapter::parse_handle(value).map_err(|error| vec![error]);
        assembler.prepare_fit_profile_capture_preview(
            preview_adapter::PrepareFitProfileCapturePreviewRequest {
                flow_handle: parse(&request.import_handle)?,
                hardware_handle: parse(&request.hardware_handle)?,
                selection_handle: parse(&request.selection_handle)?,
                tool_handle: parse(&request.tool_handle)?,
                capture_id: request.capture_id,
                manual_context_tokens: request.manual_context_tokens,
            },
        )
    })
}

#[tauri::command]
fn prepare_verification_plan_preview(
    state: tauri::State<'_, RunnerState>,
    request: PreparePreviewInput,
) -> Result<preview_adapter::VerificationPlanPreview, Vec<String>> {
    with_preview_state(&state, |assembler| {
        let parse = |value: &str| preview_adapter::parse_handle(value).map_err(|error| vec![error]);
        assembler.prepare_standard_preview_v1(
            &request.policy_id,
            parse(&request.import_handle)?,
            parse(&request.hardware_handle)?,
            parse(&request.selection_handle)?,
            parse(&request.benchmark_tool_handle)?,
            parse(&request.quick_check_tool_handle)?,
        )
    })
}

/// Crosses the explicit execution-consent boundary for one sealed preparation.
/// The caller supplies no executable path, model path, argv, timestamps,
/// observations, process identifiers, or authorization receipt.
#[tauri::command]
fn start_verification_execution(
    state: tauri::State<'_, RunnerState>,
    request: execution_transport::StartVerificationExecutionInput,
) -> Result<execution_transport::ExecutionStartViewV1, Vec<String>> {
    with_runner_state(&state, |runner| runner.start(request))
}

/// Crosses U27's explicit consent boundary. The caller supplies only a
/// one-use prepared handle and acknowledgement, never a path, argv, result or
/// hardware claim.
#[tauri::command]
fn execute_fit_profile_capture(
    state: tauri::State<'_, RunnerState>,
    request: execution_transport::ExecuteFitProfileCaptureInput,
) -> Result<execution_transport::FitProfileCaptureExecutionViewV1, Vec<String>> {
    with_runner_state(&state, |runner| runner.execute_fit_profile_capture(request))
}

#[tauri::command]
fn get_verification_execution_status(
    state: tauri::State<'_, RunnerState>,
    request: execution_transport::VerificationExecutionReferenceInput,
) -> Result<execution_lifecycle::LifecycleSnapshotV1, Vec<String>> {
    with_runner_state(&state, |runner| runner.status(&request))
}

#[tauri::command]
fn stop_verification_execution(
    state: tauri::State<'_, RunnerState>,
    request: execution_transport::VerificationExecutionReferenceInput,
) -> Result<execution_lifecycle::LifecycleSnapshotV1, Vec<String>> {
    with_runner_state(&state, |runner| runner.stop(&request))
}

#[tauri::command]
fn get_verification_execution_result(
    state: tauri::State<'_, RunnerState>,
    request: execution_transport::VerificationExecutionReferenceInput,
) -> Result<execution_transport::ExecutionResultReadV1, Vec<String>> {
    with_runner_state(&state, |runner| runner.result(&request))
}

/// This installed-build identity is intentionally narrower than the typed
/// transport above: registered commands are not claims of user-facing wiring.
#[derive(Serialize, Clone, PartialEq, Debug)]
pub struct RunnerIdentity {
    pub name: &'static str,
    pub version: &'static str,
    pub milestone: &'static str,
    pub capabilities: &'static [&'static str],
}

pub fn identity() -> RunnerIdentity {
    RunnerIdentity {
        name: "Local Arcade Runner",
        version: env!("CARGO_PKG_VERSION"),
        milestone: "R4-existing-engine",
        // Each entry names its boundary. Uploads and downloads remain absent
        // until their own milestones; execution is limited to the user's own
        // llama-bench on the user's own model files.
        capabilities: &[
            "hardware-detection (read-only, on request, local only)",
            "model-store-scan (read-only, on request, local only)",
            "benchmark (user's own engine + model, on request, watchdogged, local only)",
        ],
    }
}

#[tauri::command]
fn runner_identity() -> RunnerIdentity {
    identity()
}

/// Explicit-request detection (decision-tree F2/B1). Never invoked on launch.
#[tauri::command]
fn detect_hardware() -> hardware::HardwareReport {
    hardware::detect()
}

/// Explicit-request read-only scan (decision-tree F3/E1). Never on launch;
/// the UI lists exactly which directories will be read before the click.
#[tauri::command]
fn scan_model_stores(extra_directories: Vec<String>) -> model_store::ScanReport {
    let home = dirs_home();
    let extras: Vec<std::path::PathBuf> = extra_directories
        .into_iter()
        .filter(|directory| !directory.trim().is_empty())
        .map(std::path::PathBuf::from)
        .collect();
    model_store::scan(&home, &extras)
}

/// B4: sampled only after the user asks to benchmark. No monitoring or writes.
#[tauri::command]
fn benchmark_preflight() -> preflight::PreflightReport {
    preflight::inspect()
}

/// Explicit-action, fixed-fixture checks through the user's own llama-cli.
/// Retained temporarily for comparison with the typed lifecycle, but no longer
/// registered as IPC because it accepts caller-authored execution facts.
#[allow(dead_code)]
#[tauri::command]
fn run_quick_tasks(
    request: quick_task::QuickTaskRequest,
) -> Result<quick_task::QuickTaskReport, String> {
    quick_task::run(&request)
}

fn dirs_home() -> std::path::PathBuf {
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" })
        .map(std::path::PathBuf::from)
        .unwrap_or_default()
}

/// Explicit-consent benchmark (decision-tree B3-B6). The UI warns that the
/// model will load and the machine will be busy before this is invoked.
/// Retained temporarily for comparison with the typed lifecycle, but no longer
/// registered as IPC because it accepts caller-authored execution facts.
#[allow(dead_code)]
#[tauri::command]
fn run_benchmark(
    request: benchmark::BenchmarkRequest,
) -> Result<benchmark::BenchmarkReport, String> {
    benchmark::run_benchmark(&request)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(RunnerState::default())
        .invoke_handler(tauri::generate_handler![
            runner_identity,
            detect_hardware,
            scan_model_stores,
            benchmark_preflight,
            admit_runner_import_bundle_preview,
            begin_manual_hardware_confirmation_preview,
            evaluate_hardware_confirmation_preview,
            confirm_hardware_confirmation_preview,
            scan_inventory_preview,
            select_inventory_preview,
            hash_selected_inventory_file_preview,
            probe_existing_tool_preview,
            prepare_fit_profile_capture_preview,
            prepare_verification_plan_preview,
            execute_fit_profile_capture,
            start_verification_execution,
            get_verification_execution_status,
            stop_verification_execution,
            get_verification_execution_result
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn r4_identity_declares_detection_scan_and_benchmark_only() {
        let id = identity();
        assert_eq!(id.milestone, "R4-existing-engine");
        assert_eq!(
            id.capabilities,
            &[
                "hardware-detection (read-only, on request, local only)",
                "model-store-scan (read-only, on request, local only)",
                "benchmark (user's own engine + model, on request, watchdogged, local only)",
            ],
            "R4-existing-engine adds benchmarking of the user's own engine and nothing else; downloads and uploads belong to later milestones"
        );
        assert_eq!(id.version, env!("CARGO_PKG_VERSION"));
    }

    #[test]
    fn unified_memory_is_not_inferred_from_os_or_unknown_devices() {
        let report = hardware::HardwareReport {
            os: "fixture".into(),
            arch: "x86_64".into(),
            cpu_name: "fixture".into(),
            total_memory_gb: 32.0,
            gpus: vec![hardware::GpuReconciliation::Unknown {
                detected_name: "Unknown GPU".into(),
                detected_memory_gb: 8.0,
                reason: "fixture",
                provenance: "detected",
            }],
            gpu_detection_unavailable_reason: None,
            provenance: "detected",
        };
        if !cfg!(target_os = "macos") {
            assert_eq!(detected_unified_memory(&report), None);
        }
    }
}

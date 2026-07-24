//! U27 trusted memory-component capture for an explicitly selected existing
//! llama.cpp `llama-fit-params` binary and one verified local GGUF artifact.
//!
//! The module owns a narrow protocol only. It is not a generic command runner,
//! does not infer missing runtime flags, does not choose a model, and does not
//! authorize serving or recommendation. A caller must still cross the explicit
//! runner consent boundary before an invocation is executed.

use crate::contracts::ExactConfigurationCandidate;
use crate::contracts::{
    canonical_json, AcceleratorBackend, CompatibilityAdmissionReceipt, GpuLayers, GpuLayersAll,
    HardwareTarget, RuntimeConfiguration,
};
use crate::execution_process::{
    run_existing_engine_process, ExecutionCancellation, ExistingEngineProcessSpec, ProcessLimits,
    ProcessTermination,
};
use crate::verification::{
    ConfirmedHardwareTarget, ObservedToolIdentityReceipt, ValidatedCompatibilityAdmissionReceipt,
    VerifiedInventorySelection,
};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::path::Path;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub const FIT_PROFILE_CAPTURE_PROTOCOL_V1: &str = "llama-fit-params-memory-breakdown-v1";
pub const FIT_PROFILE_CAPTURE_REPETITIONS_V1: u64 = 3;
const MAX_CAPTURE_CONTEXT_TOKENS: u64 = 1_048_576;
const FULL_GPU_LAYER_COUNT: &str = "999";
const CAPTURE_WALL_TIME: Duration = Duration::from_secs(120);
const CAPTURE_MAX_STREAM_BYTES: usize = 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FitProfileCaptureInvocation {
    pub context_tokens: u64,
    pub repetition: u64,
    pub argv: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PreparedFitProfileCapture {
    capture_id: String,
    candidate: ExactConfigurationCandidate,
    compatibility_admission: ValidatedCompatibilityAdmissionReceipt,
    hardware_target: ConfirmedHardwareTarget,
    artifact_path: std::path::PathBuf,
    artifact_sha256: String,
    artifact_bytes: u64,
    tool: ObservedToolIdentityReceipt,
    invocations: Vec<FitProfileCaptureInvocation>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct FitProfileCapturePreparationRequest {
    pub capture_id: String,
    pub candidate: ExactConfigurationCandidate,
    pub compatibility_admission: ValidatedCompatibilityAdmissionReceipt,
    pub hardware_target: ConfirmedHardwareTarget,
    pub inventory_selection: VerifiedInventorySelection,
    pub tool: ObservedToolIdentityReceipt,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FitProfilePoolObservation {
    pub model_bytes: u64,
    pub context_bytes: u64,
    pub compute_bytes: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FitProfileMemoryObservation {
    pub device: FitProfilePoolObservation,
    pub host: FitProfilePoolObservation,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RunnerFitProfileCaptureReceiptV1 {
    pub schema_version: u64,
    pub contract: &'static str,
    pub capture_id: String,
    pub capture_version: String,
    pub captured_at: String,
    pub content_hash: String,
    pub consent: RunnerFitProfileCaptureConsentV1,
    pub candidate: ExactConfigurationCandidate,
    pub compatibility_receipt: CompatibilityAdmissionReceipt,
    pub hardware_target: HardwareTarget,
    pub bindings: RunnerFitProfileCaptureBindingsV1,
    pub artifact: RunnerFitProfileCaptureArtifactV1,
    pub tool: RunnerFitProfileCaptureToolV1,
    pub command: RunnerFitProfileCaptureCommandV1,
    pub run_path: &'static str,
    pub contexts: Vec<RunnerFitProfileCaptureContextV1>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RunnerFitProfileCaptureConsentV1 {
    pub action: &'static str,
    pub acknowledged_at: String,
    pub local_process_execution_acknowledged: bool,
    pub grants_serving_authorization: bool,
    pub grants_recommendation_authorization: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RunnerFitProfileCaptureBindingsV1 {
    pub candidate_content_sha256: String,
    pub compatibility_receipt_content_sha256: String,
    pub hardware_target_content_sha256: String,
    pub artifact_sha256: String,
    pub selected_artifact_sha256: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RunnerFitProfileCaptureArtifactV1 {
    pub canonical_path: String,
    pub sha256: String,
    pub bytes: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RunnerFitProfileCaptureToolV1 {
    pub id: &'static str,
    pub version: String,
    pub executable_sha256: String,
    pub probe_protocol_id: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RunnerFitProfileCaptureCommandV1 {
    pub protocol_id: &'static str,
    pub argv_template: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RunnerFitProfileCaptureContextV1 {
    pub context_tokens: u64,
    pub attempts: Vec<RunnerFitProfileCaptureAttemptV1>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RunnerFitProfileCaptureAttemptV1 {
    pub attempt_id: String,
    pub observed_at: String,
    pub raw_source_record_ref: String,
    pub status: &'static str,
    pub device: RunnerFitProfileCapturePoolV1,
    pub host: RunnerFitProfileCapturePoolV1,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RunnerFitProfileCapturePoolV1 {
    pub model_bytes: u64,
    pub context_bytes: u64,
    pub compute_bytes: u64,
}

impl PreparedFitProfileCapture {
    pub fn capture_id(&self) -> &str {
        &self.capture_id
    }

    pub fn candidate(&self) -> &ExactConfigurationCandidate {
        &self.candidate
    }

    pub fn compatibility_admission(&self) -> &ValidatedCompatibilityAdmissionReceipt {
        &self.compatibility_admission
    }

    pub fn hardware_target(&self) -> &ConfirmedHardwareTarget {
        &self.hardware_target
    }

    pub fn artifact_path(&self) -> &Path {
        &self.artifact_path
    }

    pub fn artifact_sha256(&self) -> &str {
        &self.artifact_sha256
    }

    pub fn artifact_bytes(&self) -> u64 {
        self.artifact_bytes
    }

    pub fn tool(&self) -> &ObservedToolIdentityReceipt {
        &self.tool
    }

    pub fn invocations(&self) -> &[FitProfileCaptureInvocation] {
        &self.invocations
    }
}

/// Builds exactly six sealed observations: three at the selected configuration
/// context and three at four times that context. A different setup is a new
/// capture, never an inferred interpolation.
pub fn prepare_fit_profile_capture(
    request: &FitProfileCapturePreparationRequest,
) -> Result<PreparedFitProfileCapture, Vec<String>> {
    let mut issues = Vec::new();
    if !cfg!(windows) {
        issues.push("u27.platform.unsupported: trusted capture is Windows-first".into());
    }
    if request.capture_id.trim().is_empty() {
        issues.push("u27.capture-id-required".into());
    }
    validate_candidate_and_receipt(request, &mut issues);
    validate_hardware(request, &mut issues);
    validate_inventory(request, &mut issues);
    validate_tool(request, &mut issues);
    if !issues.is_empty() {
        issues.sort();
        issues.dedup();
        return Err(issues);
    }

    let first_context = request.candidate.runtime.context_tokens;
    let second_context = first_context
        .checked_mul(4)
        .filter(|value| *value <= MAX_CAPTURE_CONTEXT_TOKENS)
        .ok_or_else(|| vec!["u27.context-scaling-out-of-range".into()])?;
    let contexts = [first_context, second_context];
    let mut invocations = Vec::new();
    for context_tokens in contexts {
        let argv = resolve_fit_profile_capture_argv(
            &request.candidate.runtime,
            request.inventory_selection.path(),
            context_tokens,
        )?;
        for repetition in 1..=FIT_PROFILE_CAPTURE_REPETITIONS_V1 {
            invocations.push(FitProfileCaptureInvocation {
                context_tokens,
                repetition,
                argv: argv.clone(),
            });
        }
    }
    Ok(PreparedFitProfileCapture {
        capture_id: request.capture_id.clone(),
        candidate: request.candidate.clone(),
        compatibility_admission: request.compatibility_admission.clone(),
        hardware_target: request.hardware_target.clone(),
        artifact_path: request.inventory_selection.path().to_path_buf(),
        artifact_sha256: request.inventory_selection.sha256().to_string(),
        artifact_bytes: request.inventory_selection.bytes(),
        tool: request.tool.clone(),
        invocations,
    })
}

/// Maps a complete exact runtime into the one fixed `llama-fit-params` argv
/// shape. No arbitrary flags cross this boundary.
pub fn resolve_fit_profile_capture_argv(
    runtime: &RuntimeConfiguration,
    artifact_path: &Path,
    context_tokens: u64,
) -> Result<Vec<String>, Vec<String>> {
    let mut issues = Vec::new();
    if context_tokens == 0 || context_tokens > MAX_CAPTURE_CONTEXT_TOKENS {
        issues.push("u27.context-out-of-range".into());
    }
    if runtime.product != "llama-cpp" || runtime.engine != "llama.cpp" {
        issues.push("u27.runtime.product-engine-unsupported".into());
    }
    if runtime
        .engine_build
        .as_deref()
        .unwrap_or_default()
        .trim()
        .is_empty()
    {
        issues.push("u27.runtime.engine-build-required".into());
    }
    if runtime.backend != AcceleratorBackend::Cuda {
        issues.push("u27.runtime.backend-unsupported".into());
    }
    if !matches!(runtime.gpu_layers, Some(GpuLayers::All(GpuLayersAll::All))) {
        issues.push("u27.runtime.full-gpu-offload-required".into());
    }
    if !runtime.additional_flags.is_empty() {
        issues.push("u27.runtime.additional-flags-unsupported".into());
    }
    let required_u64 = [
        ("batch-size", runtime.batch_size),
        ("micro-batch-size", runtime.micro_batch_size),
        ("threads", runtime.threads),
    ];
    for (field, value) in required_u64 {
        if value.unwrap_or(0) == 0 {
            issues.push(format!("u27.runtime.{field}-required"));
        }
    }
    let key = runtime.kv_cache.key.as_deref().unwrap_or_default();
    let value = runtime.kv_cache.value.as_deref().unwrap_or_default();
    if !matches!(key, "f16" | "q8_0" | "q4_0") {
        issues.push("u27.runtime.kv-key-unsupported".into());
    }
    if !matches!(value, "f16" | "q8_0" | "q4_0") {
        issues.push("u27.runtime.kv-value-unsupported".into());
    }
    if runtime.flash_attention.is_none() || runtime.mmap.is_none() {
        issues.push("u27.runtime.flash-attention-and-mmap-required".into());
    }
    if artifact_path.as_os_str().is_empty() {
        issues.push("u27.artifact-path-required".into());
    }
    if !issues.is_empty() {
        issues.sort();
        issues.dedup();
        return Err(issues);
    }
    let flash = if runtime.flash_attention == Some(true) {
        "on"
    } else {
        "off"
    };
    let mmap = if runtime.mmap == Some(true) { "1" } else { "0" };
    Ok(vec![
        "-m".into(),
        artifact_path.to_string_lossy().into_owned(),
        "-c".into(),
        context_tokens.to_string(),
        "-ngl".into(),
        FULL_GPU_LAYER_COUNT.into(),
        "-b".into(),
        runtime.batch_size.expect("validated").to_string(),
        "-ub".into(),
        runtime.micro_batch_size.expect("validated").to_string(),
        "-ctk".into(),
        key.into(),
        "-ctv".into(),
        value.into(),
        "-t".into(),
        runtime.threads.expect("validated").to_string(),
        "-fa".into(),
        flash.into(),
        "-mmp".into(),
        mmap.into(),
        "-fitp".into(),
        "on".into(),
        "--offline".into(),
        "--log-disable".into(),
    ])
}

/// Parses only the fixed memory-breakdown grammar emitted by the pinned
/// `llama-fit-params -fitp on` protocol. Unknown, multi-device, missing-host,
/// malformed, or overflowed output is rejected rather than approximated.
pub fn parse_fit_profile_memory_breakdown(
    output: &str,
) -> Result<FitProfileMemoryObservation, String> {
    let headers = output
        .lines()
        .filter(|line| line.contains("memory breakdown [MiB]"))
        .count();
    if headers != 1 {
        return Err("u27.capture.memory-breakdown-header-required-once".into());
    }
    let mut device = None;
    let mut host = None;
    for line in output.lines().filter(|line| line.contains("| - ")) {
        let (_, right) = line
            .split_once("| - ")
            .ok_or("u27.capture.memory-breakdown-line-invalid")?;
        let (label, values) = right
            .split_once('|')
            .ok_or("u27.capture.memory-breakdown-line-invalid")?;
        let label = label.trim();
        let numbers = numeric_fields(values);
        if label == "Host" {
            if host.replace(parse_host_pool(&numbers)?).is_some() {
                return Err("u27.capture.memory-breakdown-host-duplicate".into());
            }
        } else if label.starts_with("CUDA")
            && device.replace(parse_device_pool(&numbers)?).is_some()
        {
            return Err("u27.capture.memory-breakdown-multi-device-unsupported".into());
        }
    }
    Ok(FitProfileMemoryObservation {
        device: device.ok_or("u27.capture.memory-breakdown-device-required")?,
        host: host.ok_or("u27.capture.memory-breakdown-host-required")?,
    })
}

/// Executes exactly the sealed U27 invocations after an explicit local-process
/// acknowledgement. It verifies tool and artifact hashes for every child,
/// rejects any non-terminal or malformed output, and returns an exact-scope
/// receipt that still grants neither serving nor recommendation authority.
pub fn execute_prepared_fit_profile_capture(
    prepared: &PreparedFitProfileCapture,
    acknowledge_local_process_execution: bool,
) -> Result<RunnerFitProfileCaptureReceiptV1, Vec<String>> {
    if !acknowledge_local_process_execution {
        return Err(vec![
            "u27.capture.local-process-acknowledgement-required".into()
        ]);
    }
    let limits = ProcessLimits::new(
        CAPTURE_WALL_TIME,
        CAPTURE_MAX_STREAM_BYTES,
        CAPTURE_MAX_STREAM_BYTES,
    )
    .map_err(|error| vec![format!("u27.capture.process-limits-invalid:{error:?}")])?;
    let cancellation = ExecutionCancellation::default();
    let mut contexts: Vec<RunnerFitProfileCaptureContextV1> = Vec::new();
    for invocation in prepared.invocations() {
        let spec = ExistingEngineProcessSpec::from_fit_profile_capture_protocol(
            prepared.tool().path().to_path_buf(),
            prepared.artifact_path().to_path_buf(),
            prepared.tool().expected_sha256().to_string(),
            prepared.artifact_sha256().to_string(),
            invocation,
        )
        .map_err(|error| vec![format!("u27.capture.process-spec-invalid:{error:?}")])?;
        let output = run_existing_engine_process(&spec, limits, &cancellation)
            .map_err(|error| vec![format!("u27.capture.process-boundary:{error:?}")])?;
        if output.termination != ProcessTermination::Completed || output.exit_code != Some(0) {
            return Err(vec![format!(
                "u27.capture.process-incomplete:{:?}:{:?}",
                output.termination, output.exit_code
            )]);
        }
        let stdout = String::from_utf8(output.stdout)
            .map_err(|_| vec!["u27.capture.stdout-not-utf8".into()])?;
        let stderr = String::from_utf8(output.stderr)
            .map_err(|_| vec!["u27.capture.stderr-not-utf8".into()])?;
        let observation = parse_fit_profile_memory_breakdown(&format!("{stdout}\n{stderr}"))
            .map_err(|error| vec![error])?;
        let attempt = RunnerFitProfileCaptureAttemptV1 {
            attempt_id: format!(
                "{}-ctx-{}-attempt-{}",
                prepared.capture_id(),
                invocation.context_tokens,
                invocation.repetition
            ),
            observed_at: now_rfc3339_millis().map_err(|error| vec![error])?,
            raw_source_record_ref: format!(
                "runner-fit-profile-capture://{}/1/contexts/{}/attempts/{}",
                prepared.capture_id(),
                invocation.context_tokens,
                invocation.repetition
            ),
            status: "completed",
            device: pool_to_wire(&observation.device),
            host: pool_to_wire(&observation.host),
        };
        match contexts.last_mut() {
            Some(context) if context.context_tokens == invocation.context_tokens => {
                context.attempts.push(attempt);
            }
            _ => contexts.push(RunnerFitProfileCaptureContextV1 {
                context_tokens: invocation.context_tokens,
                attempts: vec![attempt],
            }),
        }
    }
    for context in &contexts {
        if context.attempts.len() != FIT_PROFILE_CAPTURE_REPETITIONS_V1 as usize {
            return Err(vec!["u27.capture.repetition-count-invalid".into()]);
        }
        let first = &context.attempts[0];
        if context
            .attempts
            .iter()
            .skip(1)
            .any(|attempt| attempt.device != first.device || attempt.host != first.host)
        {
            return Err(vec![format!(
                "u27.capture.repeat-disagreement:context-{}",
                context.context_tokens
            )]);
        }
    }
    build_capture_receipt(prepared, contexts)
}

fn build_capture_receipt(
    prepared: &PreparedFitProfileCapture,
    contexts: Vec<RunnerFitProfileCaptureContextV1>,
) -> Result<RunnerFitProfileCaptureReceiptV1, Vec<String>> {
    let candidate = prepared.candidate().clone();
    let receipt = prepared.compatibility_admission().receipt().clone();
    let hardware = prepared.hardware_target().effective_target().clone();
    let argv_template = command_template(
        prepared
            .invocations()
            .first()
            .ok_or_else(|| vec!["u27.capture.invocations-empty".into()])?,
    );
    let captured_at = now_rfc3339_millis().map_err(|error| vec![error])?;
    let mut result = RunnerFitProfileCaptureReceiptV1 {
        schema_version: 1,
        contract: "runner-fit-profile-capture",
        capture_id: prepared.capture_id().to_string(),
        capture_version: "1".into(),
        captured_at: captured_at.clone(),
        content_hash: String::new(),
        consent: RunnerFitProfileCaptureConsentV1 {
            action: "capture-fit-profile",
            acknowledged_at: captured_at,
            local_process_execution_acknowledged: true,
            grants_serving_authorization: false,
            grants_recommendation_authorization: false,
        },
        bindings: RunnerFitProfileCaptureBindingsV1 {
            candidate_content_sha256: canonical_sha256(&candidate)?,
            compatibility_receipt_content_sha256: canonical_sha256(&receipt)?,
            hardware_target_content_sha256: canonical_sha256(&hardware)?,
            artifact_sha256: candidate.artifact.sha256.clone(),
            selected_artifact_sha256: prepared.artifact_sha256().to_string(),
        },
        artifact: RunnerFitProfileCaptureArtifactV1 {
            canonical_path: prepared.artifact_path().to_string_lossy().into_owned(),
            sha256: prepared.artifact_sha256().to_string(),
            bytes: prepared.artifact_bytes(),
        },
        tool: RunnerFitProfileCaptureToolV1 {
            id: "llama-fit-params",
            version: prepared.tool().observed_engine_build().to_string(),
            executable_sha256: prepared.tool().expected_sha256().to_string(),
            probe_protocol_id: prepared.tool().probe_protocol_id().to_string(),
        },
        command: RunnerFitProfileCaptureCommandV1 {
            protocol_id: FIT_PROFILE_CAPTURE_PROTOCOL_V1,
            argv_template,
        },
        run_path: "gpu",
        candidate,
        compatibility_receipt: receipt,
        hardware_target: hardware,
        contexts,
    };
    result.content_hash = capture_content_hash(&result)?;
    Ok(result)
}

fn command_template(invocation: &FitProfileCaptureInvocation) -> Vec<String> {
    let mut template = invocation.argv.clone();
    if let Some(index) = template.iter().position(|part| part == "-c") {
        if let Some(context) = template.get_mut(index + 1) {
            *context = "{contextTokens}".into();
        }
    }
    template
}

fn pool_to_wire(value: &FitProfilePoolObservation) -> RunnerFitProfileCapturePoolV1 {
    RunnerFitProfileCapturePoolV1 {
        model_bytes: value.model_bytes,
        context_bytes: value.context_bytes,
        compute_bytes: value.compute_bytes,
    }
}

fn canonical_sha256<T: Serialize>(value: &T) -> Result<String, Vec<String>> {
    let json = serde_json::to_value(value)
        .map_err(|error| vec![format!("u27.capture.serialize-failed:{error}")])?;
    Ok(format!(
        "{:x}",
        Sha256::digest(canonical_json(&json).as_bytes())
    ))
}

fn capture_content_hash(value: &RunnerFitProfileCaptureReceiptV1) -> Result<String, Vec<String>> {
    let mut json = serde_json::to_value(value)
        .map_err(|error| vec![format!("u27.capture.serialize-failed:{error}")])?;
    json.as_object_mut()
        .ok_or_else(|| vec!["u27.capture.receipt-not-object".into()])?
        .remove("contentHash");
    Ok(format!(
        "{:x}",
        Sha256::digest(canonical_json(&json).as_bytes())
    ))
}

fn now_rfc3339_millis() -> Result<String, String> {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "u27.capture.clock-before-epoch".to_string())?
        .as_millis();
    let seconds = (millis / 1000) as i64;
    let day = seconds.div_euclid(86_400);
    let second_of_day = seconds.rem_euclid(86_400);
    let (year, month, day_of_month) = civil_from_unix_days(day);
    Ok(format!(
        "{year:04}-{month:02}-{day_of_month:02}T{:02}:{:02}:{:02}.{:03}Z",
        second_of_day / 3600,
        (second_of_day % 3600) / 60,
        second_of_day % 60,
        millis % 1000,
    ))
}

fn civil_from_unix_days(days: i64) -> (i64, i64, i64) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = mp + if mp < 10 { 3 } else { -9 };
    (year + if month <= 2 { 1 } else { 0 }, month, day)
}

fn validate_candidate_and_receipt(
    request: &FitProfileCapturePreparationRequest,
    issues: &mut Vec<String>,
) {
    let candidate = &request.candidate;
    let receipt = request.compatibility_admission.receipt();
    if receipt.candidate_id != candidate.candidate_id
        || receipt.artifact_id != candidate.artifact.artifact_id
        || receipt.artifact_sha256 != candidate.artifact.sha256
        || receipt.runtime_configuration_id != candidate.runtime.runtime_configuration_id
    {
        issues.push("u27.compatibility-receipt-binding-mismatch".into());
    }
}

fn validate_hardware(request: &FitProfileCapturePreparationRequest, issues: &mut Vec<String>) {
    let hardware = request.hardware_target.effective_target();
    let accelerator = hardware.accelerators.first();
    if hardware.memory.unified != Some(false)
        || hardware.accelerators.len() != 1
        || accelerator
            .and_then(|item| item.accelerator_id.as_ref())
            .is_none()
        || accelerator
            .and_then(|item| item.device_memory_bytes)
            .unwrap_or(0)
            == 0
        || accelerator.map(|item| &item.backend) != Some(&request.candidate.runtime.backend)
    {
        issues.push("u27.hardware.exact-single-discrete-gpu-required".into());
    }
}

fn validate_inventory(request: &FitProfileCapturePreparationRequest, issues: &mut Vec<String>) {
    let selection = &request.inventory_selection;
    let artifact = &request.candidate.artifact;
    if selection.artifact_id() != artifact.artifact_id
        || selection.sha256() != artifact.sha256
        || selection.bytes() != artifact.bytes
        || selection.bytes() == 0
    {
        issues.push("u27.inventory.candidate-binding-mismatch".into());
    }
}

fn validate_tool(request: &FitProfileCapturePreparationRequest, issues: &mut Vec<String>) {
    let tool = &request.tool;
    if tool.kind() != crate::verification::ExistingToolKind::FitProfileCapture {
        issues.push("u27.tool.role-mismatch".into());
    }
    if tool.observed_product() != request.candidate.runtime.product
        || tool.observed_engine() != request.candidate.runtime.engine
        || tool.observed_engine_build()
            != request
                .candidate
                .runtime
                .engine_build
                .as_deref()
                .unwrap_or_default()
    {
        issues.push("u27.tool.runtime-mismatch".into());
    }
}

fn numeric_fields(value: &str) -> Vec<u64> {
    let mut values = Vec::new();
    let mut current = String::new();
    for character in value.chars() {
        if character.is_ascii_digit() {
            current.push(character);
        } else if !current.is_empty() {
            values.push(current.parse::<u64>().unwrap_or(u64::MAX));
            current.clear();
        }
    }
    if !current.is_empty() {
        values.push(current.parse::<u64>().unwrap_or(u64::MAX));
    }
    values
}

fn parse_device_pool(values: &[u64]) -> Result<FitProfilePoolObservation, String> {
    if values.len() != 7 {
        return Err("u27.capture.memory-breakdown-device-shape-invalid".into());
    }
    pool_from_mib(values[3], values[4], values[5])
}

fn parse_host_pool(values: &[u64]) -> Result<FitProfilePoolObservation, String> {
    match values {
        [_, _, model, compute] => pool_from_mib(*model, 0, *compute),
        [_, _, model, context, compute] => pool_from_mib(*model, *context, *compute),
        _ => Err("u27.capture.memory-breakdown-host-shape-invalid".into()),
    }
}

fn pool_from_mib(
    model_mib: u64,
    context_mib: u64,
    compute_mib: u64,
) -> Result<FitProfilePoolObservation, String> {
    const MIB: u64 = 1024 * 1024;
    let bytes = |value: u64| {
        value
            .checked_mul(MIB)
            .ok_or("u27.capture.memory-breakdown-overflow".to_string())
    };
    Ok(FitProfilePoolObservation {
        model_bytes: bytes(model_mib)?,
        context_bytes: bytes(context_mib)?,
        compute_bytes: bytes(compute_mib)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::contracts::{
        AcceleratorBackend, GpuLayers, GpuLayersAll, KvCache, RuntimeFlag, Sampler,
    };
    use std::path::Path;

    fn runtime() -> RuntimeConfiguration {
        RuntimeConfiguration {
            runtime_configuration_id: "runtime-fixture".into(),
            product: "llama-cpp".into(),
            engine: "llama.cpp".into(),
            engine_build: Some("b10061 (5d5306bf3)".into()),
            backend: AcceleratorBackend::Cuda,
            chat_template: Some("chatml".into()),
            context_tokens: 4096,
            kv_cache: KvCache {
                key: Some("f16".into()),
                value: Some("f16".into()),
            },
            gpu_layers: Some(GpuLayers::All(GpuLayersAll::All)),
            batch_size: Some(2048),
            micro_batch_size: Some(512),
            parallelism: Some(1),
            threads: Some(8),
            flash_attention: Some(true),
            mmap: Some(true),
            sampler: Sampler {
                temperature: Some(0.0),
                top_p: Some(1.0),
                top_k: Some(0),
                min_p: Some(0.0),
                seed: Some(1),
            },
            additional_flags: Vec::<RuntimeFlag>::new(),
        }
    }

    #[test]
    fn fixed_capture_argv_preserves_all_allocation_affecting_runtime_fields() {
        let argv = resolve_fit_profile_capture_argv(
            &runtime(),
            Path::new(r"C:\\Models\\fixture.gguf"),
            4096,
        )
        .unwrap();
        assert_eq!(
            argv,
            vec![
                "-m",
                r"C:\\Models\\fixture.gguf",
                "-c",
                "4096",
                "-ngl",
                "999",
                "-b",
                "2048",
                "-ub",
                "512",
                "-ctk",
                "f16",
                "-ctv",
                "f16",
                "-t",
                "8",
                "-fa",
                "on",
                "-mmp",
                "1",
                "-fitp",
                "on",
                "--offline",
                "--log-disable",
            ]
        );
    }

    #[test]
    fn incomplete_or_unsupported_runtime_is_refused_without_defaults() {
        type RuntimeMutation = Box<dyn Fn(&mut RuntimeConfiguration)>;
        let mutations: Vec<RuntimeMutation> = vec![
            Box::new(|value| value.batch_size = None),
            Box::new(|value| value.gpu_layers = None),
            Box::new(|value| {
                value.additional_flags.push(RuntimeFlag {
                    name: "--unknown".into(),
                    value: None,
                })
            }),
            Box::new(|value| value.backend = AcceleratorBackend::Cpu),
        ];
        for mutate in mutations {
            let mut value = runtime();
            mutate(&mut value);
            assert!(resolve_fit_profile_capture_argv(
                &value,
                Path::new(r"C:\\Models\\fixture.gguf"),
                4096
            )
            .is_err());
        }
    }

    #[test]
    fn exact_one_cuda_and_host_memory_breakdown_is_parsed_to_bytes() {
        let output = "llama_memory_breakdown_print: | memory breakdown [MiB] | total free self model context compute unaccounted |\nllama_memory_breakdown_print: | - CUDA0 (Fixture GPU) | 8000 = 500 + (7500 = 4000 + 3200 + 300) + 0 |\nllama_memory_breakdown_print: | - Host | 32000 = 30000 + 1000 + 20 |";
        let result = parse_fit_profile_memory_breakdown(output).unwrap();
        assert_eq!(result.device.model_bytes, 4000 * 1024 * 1024);
        assert_eq!(result.device.context_bytes, 3200 * 1024 * 1024);
        assert_eq!(result.device.compute_bytes, 300 * 1024 * 1024);
        assert_eq!(result.host.model_bytes, 1000 * 1024 * 1024);
        assert_eq!(result.host.context_bytes, 0);
        assert_eq!(result.host.compute_bytes, 20 * 1024 * 1024);
    }

    #[test]
    fn malformed_or_multi_gpu_breakdown_is_rejected() {
        let missing_host = "llama_memory_breakdown_print: | memory breakdown [MiB] | total free self model context compute unaccounted |\nllama_memory_breakdown_print: | - CUDA0 (Fixture) | 8000 = 500 + (7500 = 4000 + 3200 + 300) + 0 |";
        assert!(parse_fit_profile_memory_breakdown(missing_host).is_err());
        let multi = format!("{missing_host}\nllama_memory_breakdown_print: | - CUDA1 (Fixture) | 8000 = 500 + (7500 = 4000 + 3200 + 300) + 0 |\nllama_memory_breakdown_print: | - Host | 32000 = 30000 + 1000 + 20 |");
        assert!(parse_fit_profile_memory_breakdown(&multi).is_err());
    }
}

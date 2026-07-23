//! Pure admission of existing-engine benchmark output into M-J observations.
//! Planned facts are never substituted for observations.

use crate::benchmark::{parse_bench_output, BenchmarkReport};
use crate::contracts::{
    AcceleratorBackend, BenchmarkPlan, DomainStatus, GpuLayers, GpuLayersAll, MeasurementKind,
    MeasurementUnit, QuickCheckPlan,
};
use crate::execution_protocol::{
    resolve_benchmark_plan, resolve_quick_check_plan, BenchmarkExecutionSpec,
    BenchmarkInvocationSpec, BenchmarkRunPhase, QuickCheckExecutionSpec, QuickCheckInvocationSpec,
};
use crate::verification::{
    BenchmarkObservation, CheckObservation, QuickCheckObservation, SeriesObservation,
};

#[derive(Debug, Clone, PartialEq)]
pub struct CheckedExecutionIdentities {
    pub canonical_artifact_path: String,
    pub artifact_sha256: String,
    pub artifact_size_bytes: u64,
    pub benchmark_tool_path: String,
    pub benchmark_tool_sha256: String,
    pub engine_build: String,
}

#[derive(Debug, Clone, PartialEq)]
pub enum InvocationTermination {
    Completed,
    Stopped,
    TimedOut,
    Failed { detail: String },
    Oom { detail: String },
    Cancelled,
}

#[derive(Debug, Clone, PartialEq)]
pub struct BenchmarkInvocationOutput {
    pub phase: BenchmarkRunPhase,
    pub phase_run_number: u64,
    pub overall_run_number: u64,
    pub termination: InvocationTermination,
    pub stdout: String,
    pub started_at: String,
    pub finished_at: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RuntimeLoadObservation {
    pub artifact_path: String,
    pub artifact_sha256: String,
    pub artifact_size_bytes: u64,
    pub tool_path: String,
    pub tool_sha256: String,
    pub engine: String,
    pub engine_build: String,
    pub backend: AcceleratorBackend,
    pub gpu_info: String,
    pub model_type: String,
    /// Observed llama-bench test depth, not a maximum-context claim.
    pub context_test_depth_tokens: u64,
    pub observed_at: String,
    pub source: &'static str,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ProducedBenchmarkObservation {
    pub benchmark: BenchmarkObservation,
    /// Present only after fully admitted model-loaded output.
    pub runtime_load: Option<RuntimeLoadObservation>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct CheckedQuickCheckIdentities {
    pub canonical_artifact_path: String,
    pub artifact_sha256: String,
    pub artifact_size_bytes: u64,
    pub quick_check_tool_path: String,
    pub quick_check_tool_sha256: String,
    pub engine_build: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct QuickCheckInvocationOutput {
    pub check_id: String,
    pub termination: InvocationTermination,
    pub stdout: String,
    pub stderr: String,
    pub started_at: String,
    pub finished_at: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ProducedQuickCheckObservation {
    pub quick_check: QuickCheckObservation,
    /// `llama-cli` has no approved structured record binding the loaded
    /// model to the selected backend. Human log text is not promoted to that
    /// claim, so the producer fails closed until a versioned parser exists.
    pub runtime_load: Option<RuntimeLoadObservation>,
    /// Producer-owned admission diagnostics. These are kept separate from
    /// check explanations so malformed child text is never promoted into an
    /// M-J check result.
    pub diagnostics: Vec<String>,
}

pub fn produce_quick_check_observation(
    result_id: &str,
    plan: &QuickCheckPlan,
    spec: &QuickCheckExecutionSpec,
    identities: &CheckedQuickCheckIdentities,
    outputs: &[QuickCheckInvocationOutput],
) -> Result<ProducedQuickCheckObservation, Vec<String>> {
    let mut issues = validate_quick_check_inputs(result_id, plan, spec, identities);
    if outputs.is_empty() {
        issues.push("m-o.quick-check-result.outputs-empty".into());
    }
    if outputs.len() > spec.invocations.len() {
        issues.push("m-o.quick-check-result.too-many-invocations".into());
    }
    if !issues.is_empty() {
        return Err(sorted(issues));
    }

    let mut checks = Vec::new();
    let mut terminal_status = DomainStatus::Completed;
    let mut terminal_seen = false;
    let mut observed_at = None;

    for (index, output) in outputs.iter().enumerate() {
        let expected = &spec.invocations[index];
        let before_output = issues.len();
        validate_quick_invocation_identity(expected, output, &mut issues);
        if terminal_seen {
            issues.push("m-o.quick-check-result.output-after-terminal".into());
            break;
        }
        require_quick_timestamp(&output.started_at, "started-at", &mut issues);
        require_quick_timestamp(&output.finished_at, "finished-at", &mut issues);
        if output.stdout.len() > spec.max_stdout_bytes_per_invocation
            || output.stderr.len() > spec.max_stderr_bytes_per_invocation
        {
            issues.push(format!(
                "m-o.quick-check-result.output-limit-exceeded:{}",
                expected.check_id
            ));
        }
        if issues.len() != before_output {
            break;
        }
        observed_at = Some(output.finished_at.clone());

        match &output.termination {
            InvocationTermination::Completed => {
                let before = issues.len();
                let build = parse_quick_build(&output.stdout).map_err(|error| {
                    issues.push(format!(
                        "m-o.quick-check-result.build-invalid:{}:{error}",
                        expected.check_id
                    ));
                });
                if let Ok(build) = build {
                    if build != identities.engine_build || build != spec.expected_engine_build {
                        issues.push(format!(
                            "m-o.quick-check-result.reported-build-mismatch:{}",
                            expected.check_id
                        ));
                    }
                }
                let answer = extract_quick_answer(expected, &output.stdout).map_err(|error| {
                    issues.push(format!(
                        "m-o.quick-check-result.answer-invalid:{}:{error}",
                        expected.check_id
                    ));
                });
                if issues.len() != before {
                    break;
                }
                let answer = answer.expect("answer admitted without an issue");
                let (passed, explanation) = score_fixed_check(expected.check_id, &answer);
                checks.push(CheckObservation {
                    check_id: expected.check_id.into(),
                    passed,
                    explanation,
                    local_diagnostics: None,
                });
            }
            termination => {
                terminal_seen = true;
                terminal_status = status(termination);
                // A killed or failed child may leave partial text in either
                // pipe. The terminal status remains visible, while that text
                // is deliberately not scored or promoted into a check.
            }
        }
    }

    if !issues.is_empty() {
        return Ok(ProducedQuickCheckObservation {
            quick_check: QuickCheckObservation {
                result_id: result_id.into(),
                domain_status: DomainStatus::Failed,
                checks,
                observed_at,
            },
            runtime_load: None,
            diagnostics: sorted(issues),
        });
    }
    if !terminal_seen && outputs.len() < spec.invocations.len() {
        return Ok(ProducedQuickCheckObservation {
            quick_check: QuickCheckObservation {
                result_id: result_id.into(),
                domain_status: DomainStatus::Failed,
                checks,
                observed_at,
            },
            runtime_load: None,
            diagnostics: vec![
                "m-o.quick-check-result.incomplete-without-terminal-observation".into(),
            ],
        });
    }
    Ok(ProducedQuickCheckObservation {
        quick_check: QuickCheckObservation {
            result_id: result_id.into(),
            domain_status: if terminal_seen {
                terminal_status
            } else {
                DomainStatus::Completed
            },
            checks,
            observed_at,
        },
        runtime_load: None,
        diagnostics: Vec::new(),
    })
}

pub fn produce_benchmark_observation(
    result_id: &str,
    plan: &BenchmarkPlan,
    spec: &BenchmarkExecutionSpec,
    identities: &CheckedExecutionIdentities,
    outputs: &[BenchmarkInvocationOutput],
) -> Result<ProducedBenchmarkObservation, Vec<String>> {
    let mut issues = validate_fixed_inputs(result_id, plan, spec, identities);
    if outputs.is_empty() {
        issues.push("m-o.execution-result.outputs-empty".into());
    }
    if outputs.len() > spec.invocations.len() {
        issues.push("m-o.execution-result.too-many-invocations".into());
    }
    if !issues.is_empty() {
        return Err(sorted(issues));
    }

    let mut prompt_warmups = Vec::new();
    let mut prompt_measured = Vec::new();
    let mut generation_warmups = Vec::new();
    let mut generation_measured = Vec::new();
    let mut runtime_load = None;
    let mut terminal_status = DomainStatus::Completed;
    let mut terminal_seen = false;
    let mut diagnostics = Vec::new();
    let mut observed_at = None;

    for (index, output) in outputs.iter().enumerate() {
        let expected = &spec.invocations[index];
        let before_output = issues.len();
        validate_invocation_identity(expected, output, &mut issues);
        if terminal_seen {
            issues.push("m-o.execution-result.output-after-terminal".into());
            break;
        }
        require_timestamp(&output.started_at, "started-at", &mut issues);
        require_timestamp(&output.finished_at, "finished-at", &mut issues);
        if issues.len() != before_output {
            break;
        }
        observed_at = Some(output.finished_at.clone());

        match &output.termination {
            InvocationTermination::Completed => {
                let report = match parse_bench_output(&output.stdout) {
                    Ok(report) => report,
                    Err(error) => {
                        issues.push(format!("m-o.execution-result.output-invalid:{error}"));
                        break;
                    }
                };
                let before = issues.len();
                validate_report(plan, spec, identities, &report, &mut issues);
                if issues.len() != before {
                    break;
                }
                append_samples(
                    expected,
                    spec,
                    &report,
                    &mut prompt_warmups,
                    &mut prompt_measured,
                    &mut generation_warmups,
                    &mut generation_measured,
                    &mut issues,
                );
                if issues.len() != before {
                    break;
                }
                if issues.len() == before && runtime_load.is_none() {
                    runtime_load = Some(RuntimeLoadObservation {
                        artifact_path: identities.canonical_artifact_path.clone(),
                        artifact_sha256: identities.artifact_sha256.clone(),
                        artifact_size_bytes: identities.artifact_size_bytes,
                        tool_path: identities.benchmark_tool_path.clone(),
                        tool_sha256: identities.benchmark_tool_sha256.clone(),
                        engine: report.engine.clone(),
                        engine_build: report.engine_build.clone(),
                        backend: parse_backend(&report.backends)
                            .expect("backend admitted before observation"),
                        gpu_info: report.gpu_info.clone(),
                        model_type: report.model_type.clone(),
                        context_test_depth_tokens: report.context_test_depth_tokens,
                        observed_at: output.finished_at.clone(),
                        source: "reported-by-selected-llama-bench-during-model-load-and-run",
                    });
                }
            }
            termination => {
                terminal_seen = true;
                terminal_status = status(termination);
                diagnostics.push(termination_diagnostic(termination));
                if !output.stdout.trim().is_empty() {
                    diagnostics.push(
                        "m-o.execution-result.terminal-stdout-not-admitted-as-measurement".into(),
                    );
                }
            }
        }
    }

    if !terminal_seen && outputs.len() < spec.invocations.len() {
        issues.push("m-o.execution-result.incomplete-without-terminal-observation".into());
    }
    let completion = if !issues.is_empty() {
        diagnostics.extend(sorted(issues));
        DomainStatus::Failed
    } else if terminal_seen {
        terminal_status
    } else {
        DomainStatus::Completed
    };
    let series = vec![
        SeriesObservation {
            kind: MeasurementKind::PromptProcessing,
            unit: MeasurementUnit::TokensPerSecond,
            warmup_samples: prompt_warmups,
            measured_samples: prompt_measured,
            completion: completion.clone(),
        },
        SeriesObservation {
            kind: MeasurementKind::Generation,
            unit: MeasurementUnit::TokensPerSecond,
            warmup_samples: generation_warmups,
            measured_samples: generation_measured,
            completion: completion.clone(),
        },
    ];
    Ok(ProducedBenchmarkObservation {
        benchmark: BenchmarkObservation {
            result_id: result_id.into(),
            domain_status: completion,
            series,
            diagnostics,
            observed_at,
        },
        runtime_load,
    })
}

fn validate_quick_check_inputs(
    result_id: &str,
    plan: &QuickCheckPlan,
    spec: &QuickCheckExecutionSpec,
    identities: &CheckedQuickCheckIdentities,
) -> Vec<String> {
    let mut issues = Vec::new();
    if result_id.trim().is_empty() {
        issues.push("m-o.quick-check-result.result-id-missing".into());
    }
    if plan.artifact_path != identities.canonical_artifact_path {
        issues.push("m-o.quick-check-result.checked-artifact-path-mismatch".into());
    }
    if plan.expected_artifact_sha256 != identities.artifact_sha256 {
        issues.push("m-o.quick-check-result.checked-artifact-hash-mismatch".into());
    }
    if !valid_hash(&identities.artifact_sha256) {
        issues.push("m-o.quick-check-result.checked-artifact-hash-invalid".into());
    }
    if identities.artifact_size_bytes == 0 {
        issues.push("m-o.quick-check-result.checked-artifact-size-invalid".into());
    }
    if identities.quick_check_tool_path.trim().is_empty()
        || !valid_hash(&identities.quick_check_tool_sha256)
    {
        issues.push("m-o.quick-check-result.checked-tool-identity-invalid".into());
    }
    if plan.runtime.engine_build.as_deref() != Some(identities.engine_build.as_str())
        || spec.expected_engine_build != identities.engine_build
    {
        issues.push("m-o.quick-check-result.checked-build-mismatch".into());
    }
    if plan.runtime.backend != spec.expected_backend {
        issues.push("m-o.quick-check-result.spec-backend-mismatch".into());
    }
    match resolve_quick_check_plan(plan) {
        Ok(canonical) if &canonical == spec => {}
        Ok(_) => issues.push("m-o.quick-check-result.spec-not-canonical-for-plan".into()),
        Err(errors) => issues.extend(
            errors
                .into_iter()
                .map(|error| format!("m-o.quick-check-result.plan-invalid:{error}")),
        ),
    }
    issues
}

fn validate_quick_invocation_identity(
    expected: &QuickCheckInvocationSpec,
    output: &QuickCheckInvocationOutput,
    issues: &mut Vec<String>,
) {
    if output.check_id != expected.check_id {
        issues.push(format!(
            "m-o.quick-check-result.invocation-identity-mismatch:{}",
            expected.check_id
        ));
    }
}

fn parse_quick_build(output: &str) -> Result<String, String> {
    let normalized = output.replace("\r\n", "\n");
    if normalized.contains('\r') {
        return Err("lone-carriage-return".into());
    }
    let builds: Vec<&str> = normalized
        .lines()
        .filter_map(|line| line.strip_prefix("build      : "))
        .collect();
    if builds.len() != 1 {
        return Err("expected-one-build-line".into());
    }
    let payload = builds[0].strip_prefix('b').unwrap_or(builds[0]);
    let (number, commit_with_paren) = payload
        .split_once(" (")
        .ok_or_else(|| "build-shape-invalid".to_string())?;
    let commit = commit_with_paren
        .strip_suffix(')')
        .ok_or_else(|| "build-shape-invalid".to_string())?;
    if number.is_empty()
        || !number.bytes().all(|byte| byte.is_ascii_digit())
        || !(7..=40).contains(&commit.len())
        || !commit
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
    {
        return Err("build-value-invalid".into());
    }
    Ok(format!("b{number} ({commit})"))
}

fn extract_quick_answer(
    invocation: &QuickCheckInvocationSpec,
    output: &str,
) -> Result<String, String> {
    let prompt = invocation
        .argv
        .windows(2)
        .find(|pair| pair[0] == "-p")
        .map(|pair| pair[1].as_str())
        .ok_or_else(|| "sealed-prompt-missing".to_string())?;
    let normalized = output.replace("\r\n", "\n");
    if normalized.contains('\r') {
        return Err("lone-carriage-return".into());
    }
    let marker = format!("> {prompt}\n");
    if normalized.matches(&marker).count() != 1 {
        return Err("expected-one-fixed-prompt-marker".into());
    }
    let after_prompt = normalized
        .split_once(&marker)
        .map(|(_, tail)| tail)
        .expect("one prompt marker was counted");
    let (answer, trailer) = after_prompt
        .split_once("\n\nExiting...")
        .ok_or_else(|| "exit-marker-missing".to_string())?;
    if !trailer.trim().is_empty() {
        return Err("unexpected-output-after-exit-marker".into());
    }
    let answer = answer.trim();
    if answer.is_empty() {
        return Err("empty-answer".into());
    }
    Ok(answer.to_string())
}

fn score_fixed_check(id: &str, output: &str) -> (bool, String) {
    match id {
        "json-schema" => match serde_json::from_str::<serde_json::Value>(output.trim()) {
            Ok(serde_json::Value::Object(value))
                if value.len() == 3
                    && value.get("project") == Some(&serde_json::json!("Orchid"))
                    && value.get("count") == Some(&serde_json::json!(3))
                    && value.get("ready") == Some(&serde_json::json!(true)) =>
            {
                (
                    true,
                    "Valid JSON with the exact required keys, values, and types.".into(),
                )
            }
            Ok(_) => (
                false,
                "The response parsed, but did not match the required object exactly.".into(),
            ),
            Err(_) => (false, "The response was not valid standalone JSON.".into()),
        },
        "format-constraints" => {
            let passed =
                output.trim().replace("\r\n", "\n") == "ALPHA=red\nBRAVO=green\nCHARLIE=blue";
            (
                passed,
                if passed {
                    "All line and ordering constraints were followed exactly."
                } else {
                    "The response added, removed, reordered, or changed required text."
                }
                .into(),
            )
        }
        "fact-preservation" => {
            let lower = output.to_lowercase();
            let passed = lower.contains("cedar")
                && output.contains("2024")
                && output.contains("17")
                && lower.contains("apache-2.0")
                && !output.contains('\r')
                && !output.contains('\n');
            (
                passed,
                if passed {
                    "All required facts were retained in one line."
                } else {
                    "At least one required fact or the one-line constraint was missing."
                }
                .into(),
            )
        }
        _ => (false, "Unknown fixed check id; failed closed.".into()),
    }
}

fn require_quick_timestamp(value: &str, label: &str, issues: &mut Vec<String>) {
    if value.trim().is_empty() {
        issues.push(format!("m-o.quick-check-result.{label}-missing"));
    }
}

fn validate_fixed_inputs(
    result_id: &str,
    plan: &BenchmarkPlan,
    spec: &BenchmarkExecutionSpec,
    identities: &CheckedExecutionIdentities,
) -> Vec<String> {
    let mut issues = Vec::new();
    if result_id.trim().is_empty() {
        issues.push("m-o.execution-result.result-id-missing".into());
    }
    if plan.artifact_path != identities.canonical_artifact_path {
        issues.push("m-o.execution-result.checked-artifact-path-mismatch".into());
    }
    if plan.expected_artifact_sha256 != identities.artifact_sha256 {
        issues.push("m-o.execution-result.checked-artifact-hash-mismatch".into());
    }
    if !valid_hash(&identities.artifact_sha256) {
        issues.push("m-o.execution-result.checked-artifact-hash-invalid".into());
    }
    if identities.artifact_size_bytes == 0 {
        issues.push("m-o.execution-result.checked-artifact-size-invalid".into());
    }
    if identities.benchmark_tool_path.trim().is_empty()
        || !valid_hash(&identities.benchmark_tool_sha256)
    {
        issues.push("m-o.execution-result.checked-tool-identity-invalid".into());
    }
    if plan.runtime.engine_build.as_deref() != Some(identities.engine_build.as_str())
        || spec.expected_engine_build != identities.engine_build
    {
        issues.push("m-o.execution-result.checked-build-mismatch".into());
    }
    if plan.runtime.backend != spec.expected_backend {
        issues.push("m-o.execution-result.spec-backend-mismatch".into());
    }
    if plan.warmup_runs != spec.warmup_runs
        || plan.measured_runs != spec.measured_runs
        || plan.measurement_kinds != spec.measurement_kinds
    {
        issues.push("m-o.execution-result.spec-plan-mismatch".into());
    }
    match resolve_benchmark_plan(plan) {
        Ok(canonical) if &canonical == spec => {}
        Ok(_) => issues.push("m-o.execution-result.spec-not-canonical-for-plan".into()),
        Err(errors) => issues.extend(
            errors
                .into_iter()
                .map(|error| format!("m-o.execution-result.plan-invalid:{error}")),
        ),
    }
    issues
}

fn valid_hash(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn validate_invocation_identity(
    expected: &BenchmarkInvocationSpec,
    output: &BenchmarkInvocationOutput,
    issues: &mut Vec<String>,
) {
    if output.phase != expected.phase
        || output.phase_run_number != expected.phase_run_number
        || output.overall_run_number != expected.overall_run_number
    {
        issues.push(format!(
            "m-o.execution-result.invocation-identity-mismatch:{}",
            expected.overall_run_number
        ));
    }
}

fn validate_report(
    plan: &BenchmarkPlan,
    spec: &BenchmarkExecutionSpec,
    identities: &CheckedExecutionIdentities,
    report: &BenchmarkReport,
    issues: &mut Vec<String>,
) {
    if report.engine != "llama.cpp" || report.engine_build != identities.engine_build {
        issues.push("m-o.execution-result.reported-build-mismatch".into());
    }
    if report.model_filename != identities.canonical_artifact_path {
        issues.push("m-o.execution-result.reported-model-path-mismatch".into());
    }
    if report.model_type.trim().is_empty() || report.gpu_info.contains('\0') {
        issues.push("m-o.execution-result.reported-model-identity-invalid".into());
    }
    let backend = match parse_backend(&report.backends) {
        Ok(value) => Some(value),
        Err(error) => {
            issues.push(error);
            None
        }
    };
    if backend.as_ref() != Some(&plan.runtime.backend)
        || backend.as_ref() != Some(&spec.expected_backend)
    {
        issues.push("m-o.execution-result.reported-backend-mismatch".into());
    }
    let expected_key = plan.runtime.kv_cache.key.as_deref().unwrap_or_default();
    let expected_value = plan.runtime.kv_cache.value.as_deref().unwrap_or_default();
    if report.kv_cache != format!("K:{expected_key} V:{expected_value}") {
        issues.push("m-o.execution-result.reported-kv-cache-mismatch".into());
    }
    let layers_match = match plan.runtime.gpu_layers.as_ref() {
        Some(GpuLayers::All(GpuLayersAll::All)) => {
            report.gpu_layers == -1 || report.gpu_layers == 999
        }
        Some(GpuLayers::Count(value)) => i64::try_from(*value) == Ok(report.gpu_layers),
        None => false,
    };
    if !layers_match {
        issues.push("m-o.execution-result.reported-gpu-layers-mismatch".into());
    }
    if Some(report.batch_size) != plan.runtime.batch_size
        || Some(report.ubatch_size) != plan.runtime.micro_batch_size
        || Some(report.threads) != plan.runtime.threads
    {
        issues.push("m-o.execution-result.reported-batch-or-threads-mismatch".into());
    }
    if report.context_test_depth_tokens != spec.context_test_depth_tokens
        || report.context_test_depth_tokens != plan.runtime.context_tokens
    {
        issues.push("m-o.execution-result.reported-context-test-depth-mismatch".into());
    }
    let expected_flash = plan.runtime.flash_attention.map(i64::from);
    if Some(report.flash_attention) != expected_flash || Some(report.mmap) != plan.runtime.mmap {
        issues.push("m-o.execution-result.reported-toggle-mismatch".into());
    }
}

fn parse_backend(value: &str) -> Result<AcceleratorBackend, String> {
    let token = value.trim();
    if token.is_empty()
        || token
            .chars()
            .any(|character| !(character.is_ascii_alphabetic() || character == '.'))
    {
        return Err("m-o.execution-result.reported-backend-not-single-token".into());
    }
    match token.to_ascii_lowercase().as_str() {
        "cuda" => Ok(AcceleratorBackend::Cuda),
        "vulkan" => Ok(AcceleratorBackend::Vulkan),
        "cpu" => Ok(AcceleratorBackend::Cpu),
        _ => Err(format!(
            "m-o.execution-result.reported-backend-unsupported:{token}"
        )),
    }
}

#[allow(clippy::too_many_arguments)]
fn append_samples(
    invocation: &BenchmarkInvocationSpec,
    spec: &BenchmarkExecutionSpec,
    report: &BenchmarkReport,
    prompt_warmups: &mut Vec<f64>,
    prompt_measured: &mut Vec<f64>,
    generation_warmups: &mut Vec<f64>,
    generation_measured: &mut Vec<f64>,
    issues: &mut Vec<String>,
) {
    let mut prompt = None;
    let mut generation = None;
    for measurement in &report.measurements {
        if measurement.samples.len() != 1 {
            issues.push("m-o.execution-result.single-run-sample-count-mismatch".into());
            continue;
        }
        match measurement.kind.as_str() {
            "prompt-processing" if measurement.tokens == spec.prompt_tokens => {
                if prompt.replace(measurement.samples[0]).is_some() {
                    issues.push("m-o.execution-result.prompt-series-duplicate".into());
                }
            }
            "generation" if measurement.tokens == spec.generation_tokens => {
                if generation.replace(measurement.samples[0]).is_some() {
                    issues.push("m-o.execution-result.generation-series-duplicate".into());
                }
            }
            _ => issues.push("m-o.execution-result.measurement-shape-mismatch".into()),
        }
    }
    let (Some(prompt), Some(generation)) = (prompt, generation) else {
        issues.push("m-o.execution-result.throughput-pair-missing".into());
        return;
    };
    match invocation.phase {
        BenchmarkRunPhase::Warmup => {
            prompt_warmups.push(prompt);
            generation_warmups.push(generation);
        }
        BenchmarkRunPhase::Measured => {
            prompt_measured.push(prompt);
            generation_measured.push(generation);
        }
    }
}

fn status(value: &InvocationTermination) -> DomainStatus {
    match value {
        InvocationTermination::Completed => DomainStatus::Completed,
        InvocationTermination::Stopped => DomainStatus::Stopped,
        InvocationTermination::TimedOut => DomainStatus::TimedOut,
        InvocationTermination::Failed { .. } => DomainStatus::Failed,
        InvocationTermination::Oom { .. } => DomainStatus::Oom,
        InvocationTermination::Cancelled => DomainStatus::Cancelled,
    }
}

fn termination_diagnostic(value: &InvocationTermination) -> String {
    match value {
        InvocationTermination::Completed => "m-o.execution-result.completed".into(),
        InvocationTermination::Stopped => "m-o.execution-result.stopped".into(),
        InvocationTermination::TimedOut => "m-o.execution-result.timed-out".into(),
        InvocationTermination::Failed { detail } => {
            format!("m-o.execution-result.failed:{detail}")
        }
        InvocationTermination::Oom { detail } => format!("m-o.execution-result.oom:{detail}"),
        InvocationTermination::Cancelled => "m-o.execution-result.cancelled".into(),
    }
}

fn require_timestamp(value: &str, label: &str, issues: &mut Vec<String>) {
    if value.trim().is_empty() {
        issues.push(format!("m-o.execution-result.{label}-missing"));
    }
}

fn sorted(mut values: Vec<String>) -> Vec<String> {
    values.sort();
    values.dedup();
    values
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::contracts::{
        ConcurrentGpu, KvCache, Power, Preflight, QuickCheck, RuntimeConfiguration, Sampler,
        SideEffects, Thermal,
    };
    use crate::execution_protocol::{resolve_benchmark_plan, resolve_quick_check_plan};

    fn plan() -> BenchmarkPlan {
        BenchmarkPlan {
            benchmark_plan_id: "bench-1".into(),
            candidate_id: "candidate-1".into(),
            artifact_path: r"C:\Models\fixture.gguf".into(),
            expected_artifact_sha256: "a".repeat(64),
            runtime: RuntimeConfiguration {
                runtime_configuration_id: "runtime-1".into(),
                product: "llama-cpp".into(),
                engine: "llama.cpp".into(),
                engine_build: Some("b10061 (5d5306bf3)".into()),
                backend: AcceleratorBackend::Cuda,
                chat_template: Some("chatml".into()),
                context_tokens: 16_384,
                kv_cache: KvCache {
                    key: Some("f16".into()),
                    value: Some("f16".into()),
                },
                gpu_layers: Some(GpuLayers::All(GpuLayersAll::All)),
                batch_size: Some(2_048),
                micro_batch_size: Some(512),
                parallelism: Some(1),
                threads: Some(14),
                flash_attention: Some(true),
                mmap: Some(true),
                sampler: Sampler {
                    temperature: Some(0.2),
                    top_p: Some(0.9),
                    top_k: Some(40),
                    min_p: Some(0.05),
                    seed: Some(7),
                },
                additional_flags: vec![],
            },
            protocol_id: "llama-bench-v1".into(),
            warmup_runs: 1,
            measured_runs: 3,
            measurement_kinds: vec![
                MeasurementKind::PromptProcessing,
                MeasurementKind::Generation,
                MeasurementKind::Stability,
            ],
            preflight: Preflight {
                power: Power::Ac,
                thermal: Thermal::Unknown,
                concurrent_gpu: ConcurrentGpu::Unknown,
                requires_confirmation: false,
                conditions: vec![],
            },
            side_effects: SideEffects {
                executes_local_process: true,
                loads_model: true,
                writes_model_store: false,
                network: false,
                upload: false,
            },
        }
    }

    fn identities() -> CheckedExecutionIdentities {
        CheckedExecutionIdentities {
            canonical_artifact_path: r"C:\Models\fixture.gguf".into(),
            artifact_sha256: "a".repeat(64),
            artifact_size_bytes: 2_491_323_904,
            benchmark_tool_path: r"C:\llama\llama-bench.exe".into(),
            benchmark_tool_sha256: "b".repeat(64),
            engine_build: "b10061 (5d5306bf3)".into(),
        }
    }

    fn json(prompt: f64, generation: f64) -> String {
        format!(
            r#"[
{{"build_commit":"5d5306bf3","build_number":10061,"cpu_info":"CPU","gpu_info":"GPU","backends":"CUDA","model_filename":"C:\\Models\\fixture.gguf","model_type":"fixture","model_size":2491323904,"n_batch":2048,"n_ubatch":512,"n_threads":14,"n_depth":16384,"flash_attn":1,"use_mmap":true,"type_k":"f16","type_v":"f16","n_gpu_layers":-1,"n_prompt":512,"n_gen":0,"avg_ts":{prompt},"stddev_ts":0.0,"samples_ts":[{prompt}]}},
{{"build_commit":"5d5306bf3","build_number":10061,"cpu_info":"CPU","gpu_info":"GPU","backends":"CUDA","model_filename":"C:\\Models\\fixture.gguf","model_type":"fixture","model_size":2491323904,"n_batch":2048,"n_ubatch":512,"n_threads":14,"n_depth":16384,"flash_attn":1,"use_mmap":true,"type_k":"f16","type_v":"f16","n_gpu_layers":-1,"n_prompt":0,"n_gen":128,"avg_ts":{generation},"stddev_ts":0.0,"samples_ts":[{generation}]}}
]"#
        )
    }

    fn completed(spec: &BenchmarkExecutionSpec, index: usize) -> BenchmarkInvocationOutput {
        let invocation = &spec.invocations[index];
        BenchmarkInvocationOutput {
            phase: invocation.phase,
            phase_run_number: invocation.phase_run_number,
            overall_run_number: invocation.overall_run_number,
            termination: InvocationTermination::Completed,
            stdout: json(100.0 + index as f64, 20.0 + index as f64),
            started_at: format!("2026-07-23T12:00:0{index}Z"),
            finished_at: format!("2026-07-23T12:00:1{index}Z"),
        }
    }

    #[test]
    fn complete_children_separate_warmups_measurements_and_load_evidence() {
        let plan = plan();
        let spec = resolve_benchmark_plan(&plan).unwrap();
        let outputs: Vec<_> = (0..4).map(|index| completed(&spec, index)).collect();
        let produced =
            produce_benchmark_observation("result-1", &plan, &spec, &identities(), &outputs)
                .unwrap();
        assert_eq!(produced.benchmark.domain_status, DomainStatus::Completed);
        assert_eq!(produced.benchmark.series[0].warmup_samples, vec![100.0]);
        assert_eq!(
            produced.benchmark.series[0].measured_samples,
            vec![101.0, 102.0, 103.0]
        );
        assert_eq!(
            produced.runtime_load.as_ref().unwrap().backend,
            AcceleratorBackend::Cuda
        );
    }

    #[test]
    fn later_stop_timeout_or_failure_preserves_prior_samples() {
        let plan = plan();
        let spec = resolve_benchmark_plan(&plan).unwrap();
        for (termination, expected_status) in [
            (InvocationTermination::Stopped, DomainStatus::Stopped),
            (InvocationTermination::TimedOut, DomainStatus::TimedOut),
            (
                InvocationTermination::Failed {
                    detail: "exit-code:1".into(),
                },
                DomainStatus::Failed,
            ),
        ] {
            let mut outputs = vec![completed(&spec, 0), completed(&spec, 1)];
            let invocation = &spec.invocations[2];
            outputs.push(BenchmarkInvocationOutput {
                phase: invocation.phase,
                phase_run_number: invocation.phase_run_number,
                overall_run_number: invocation.overall_run_number,
                termination,
                stdout: "partial untrusted text".into(),
                started_at: "2026-07-23T12:00:02Z".into(),
                finished_at: "2026-07-23T12:00:03Z".into(),
            });
            let produced =
                produce_benchmark_observation("result-2", &plan, &spec, &identities(), &outputs)
                    .unwrap();
            assert_eq!(produced.benchmark.domain_status, expected_status);
            assert_eq!(produced.benchmark.series[0].warmup_samples, vec![100.0]);
            assert_eq!(produced.benchmark.series[0].measured_samples, vec![101.0]);
            assert!(produced.runtime_load.is_some());
        }
    }

    #[test]
    fn terminal_before_valid_output_has_no_load_observation() {
        let plan = plan();
        let spec = resolve_benchmark_plan(&plan).unwrap();
        let invocation = &spec.invocations[0];
        let output = BenchmarkInvocationOutput {
            phase: invocation.phase,
            phase_run_number: invocation.phase_run_number,
            overall_run_number: invocation.overall_run_number,
            termination: InvocationTermination::TimedOut,
            stdout: String::new(),
            started_at: "2026-07-23T12:00:00Z".into(),
            finished_at: "2026-07-23T12:10:00Z".into(),
        };
        let produced =
            produce_benchmark_observation("result-3", &plan, &spec, &identities(), &[output])
                .unwrap();
        assert_eq!(produced.benchmark.domain_status, DomainStatus::TimedOut);
        assert!(produced.runtime_load.is_none());
    }

    #[test]
    fn ambiguous_backend_never_falls_back_to_planned_backend() {
        let plan = plan();
        let spec = resolve_benchmark_plan(&plan).unwrap();
        let mut output = completed(&spec, 0);
        output.stdout = output.stdout.replace("\"CUDA\"", "\"CUDA,CPU\"");
        let produced =
            produce_benchmark_observation("result-4", &plan, &spec, &identities(), &[output])
                .unwrap();
        assert_eq!(produced.benchmark.domain_status, DomainStatus::Failed);
        assert!(produced.runtime_load.is_none());
        let errors = produced.benchmark.diagnostics.join("\n");
        assert!(errors.contains("reported-backend-not-single-token"));
        assert!(errors.contains("reported-backend-mismatch"));
    }

    #[test]
    fn reported_path_build_and_runtime_must_match() {
        let plan = plan();
        let spec = resolve_benchmark_plan(&plan).unwrap();
        let mut output = completed(&spec, 0);
        output.stdout = output
            .stdout
            .replace("C:\\\\Models\\\\fixture.gguf", "C:\\\\Models\\\\other.gguf")
            .replace("\"n_batch\":2048", "\"n_batch\":1024")
            .replace("\"n_depth\":16384", "\"n_depth\":8192")
            .replace("\"build_number\":10061", "\"build_number\":99999");
        let produced =
            produce_benchmark_observation("result-5", &plan, &spec, &identities(), &[output])
                .unwrap();
        assert_eq!(produced.benchmark.domain_status, DomainStatus::Failed);
        assert!(produced.runtime_load.is_none());
        let errors = produced.benchmark.diagnostics.join("\n");
        assert!(errors.contains("reported-model-path-mismatch"));
        assert!(errors.contains("reported-build-mismatch"));
        assert!(errors.contains("reported-batch-or-threads-mismatch"));
        assert!(errors.contains("reported-context-test-depth-mismatch"));
    }

    #[test]
    fn invocation_order_and_unexplained_incomplete_sequence_fail_closed() {
        let plan = plan();
        let spec = resolve_benchmark_plan(&plan).unwrap();
        let mut output = completed(&spec, 0);
        output.overall_run_number = 2;
        let produced =
            produce_benchmark_observation("result-6", &plan, &spec, &identities(), &[output])
                .unwrap();
        let errors = produced.benchmark.diagnostics.join("\n");
        assert!(errors.contains("invocation-identity-mismatch"));

        let produced = produce_benchmark_observation(
            "result-7",
            &plan,
            &spec,
            &identities(),
            &[completed(&spec, 0)],
        )
        .unwrap();
        assert_eq!(produced.benchmark.domain_status, DomainStatus::Failed);
        assert_eq!(produced.benchmark.series[0].warmup_samples, vec![100.0]);
        assert_eq!(
            produced.benchmark.diagnostics,
            vec!["m-o.execution-result.incomplete-without-terminal-observation"]
        );
    }

    #[test]
    fn malformed_later_benchmark_output_preserves_only_admitted_prefix_and_load() {
        let plan = plan();
        let spec = resolve_benchmark_plan(&plan).unwrap();
        let first = completed(&spec, 0);
        let mut second = completed(&spec, 1);
        second.stdout = "not-json".into();
        let produced = produce_benchmark_observation(
            "result-malformed-second",
            &plan,
            &spec,
            &identities(),
            &[first, second],
        )
        .unwrap();
        assert_eq!(produced.benchmark.domain_status, DomainStatus::Failed);
        assert_eq!(produced.benchmark.series[0].warmup_samples, vec![100.0]);
        assert!(produced.benchmark.series[0].measured_samples.is_empty());
        assert!(produced.runtime_load.is_some());
        assert!(produced
            .benchmark
            .diagnostics
            .iter()
            .any(|value| value.contains("output-invalid")));
    }

    fn quick_plan() -> QuickCheckPlan {
        QuickCheckPlan {
            quick_check_plan_id: "quick-1".into(),
            candidate_id: "candidate-1".into(),
            artifact_path: r"C:\Models\fixture.gguf".into(),
            expected_artifact_sha256: "a".repeat(64),
            runtime: RuntimeConfiguration {
                runtime_configuration_id: "runtime-1".into(),
                product: "llama-cpp".into(),
                engine: "llama.cpp".into(),
                engine_build: Some("b10061 (5d5306bf3)".into()),
                backend: AcceleratorBackend::Cuda,
                chat_template: Some("chatml".into()),
                context_tokens: 16_384,
                kv_cache: KvCache {
                    key: Some("f16".into()),
                    value: Some("f16".into()),
                },
                gpu_layers: Some(GpuLayers::All(GpuLayersAll::All)),
                batch_size: Some(2_048),
                micro_batch_size: Some(512),
                parallelism: Some(1),
                threads: Some(14),
                flash_attention: Some(true),
                mmap: Some(true),
                sampler: Sampler {
                    temperature: Some(0.2),
                    top_p: Some(0.9),
                    top_k: Some(40),
                    min_p: Some(0.05),
                    seed: Some(7),
                },
                additional_flags: vec![],
            },
            checks: vec![
                QuickCheck {
                    check_id: "json-schema".into(),
                    criterion: "Return the exact required JSON object.".into(),
                },
                QuickCheck {
                    check_id: "format-constraints".into(),
                    criterion: "Return exactly the required three lines in order.".into(),
                },
            ],
            preflight: Preflight {
                power: Power::Ac,
                thermal: Thermal::Unknown,
                concurrent_gpu: ConcurrentGpu::Unknown,
                requires_confirmation: false,
                conditions: vec![],
            },
            side_effects: SideEffects {
                executes_local_process: true,
                loads_model: true,
                writes_model_store: false,
                network: false,
                upload: false,
            },
        }
    }

    fn quick_identities() -> CheckedQuickCheckIdentities {
        CheckedQuickCheckIdentities {
            canonical_artifact_path: r"C:\Models\fixture.gguf".into(),
            artifact_sha256: "a".repeat(64),
            artifact_size_bytes: 2_491_323_904,
            quick_check_tool_path: r"C:\llama\llama-cli.exe".into(),
            quick_check_tool_sha256: "c".repeat(64),
            engine_build: "b10061 (5d5306bf3)".into(),
        }
    }

    fn quick_output(
        invocation: &QuickCheckInvocationSpec,
        answer: &str,
    ) -> QuickCheckInvocationOutput {
        let prompt = invocation
            .argv
            .windows(2)
            .find(|pair| pair[0] == "-p")
            .unwrap()[1]
            .clone();
        QuickCheckInvocationOutput {
            check_id: invocation.check_id.into(),
            termination: InvocationTermination::Completed,
            stdout: format!(
                "llama.cpp startup\nbuild      : 10061 (5d5306bf3)\n\n> {prompt}\n{answer}\n\nExiting...\n"
            ),
            stderr: "model loader diagnostics are retained but not promoted".into(),
            started_at: "2026-07-23T13:00:00Z".into(),
            finished_at: "2026-07-23T13:00:01Z".into(),
        }
    }

    #[test]
    fn quick_checks_admit_fixed_outputs_and_preserve_exact_sampler_arguments() {
        let plan = quick_plan();
        let spec = resolve_quick_check_plan(&plan).unwrap();
        assert!(spec.invocations[0]
            .argv
            .windows(2)
            .any(|pair| pair == ["--temp", "0.2"]));
        assert!(spec.invocations[0]
            .argv
            .windows(2)
            .any(|pair| pair == ["--top-p", "0.9"]));
        assert!(spec.invocations[0]
            .argv
            .windows(2)
            .any(|pair| pair == ["--top-k", "40"]));
        assert!(spec.invocations[0]
            .argv
            .windows(2)
            .any(|pair| pair == ["--min-p", "0.05"]));
        assert!(spec.invocations[0]
            .argv
            .windows(2)
            .any(|pair| pair == ["--seed", "7"]));
        let outputs = vec![
            quick_output(
                &spec.invocations[0],
                r#"{"project":"Orchid","count":3,"ready":true}"#,
            ),
            quick_output(&spec.invocations[1], "ALPHA=red\nBRAVO=green\nCHARLIE=blue"),
        ];
        let produced = produce_quick_check_observation(
            "quick-result-1",
            &plan,
            &spec,
            &quick_identities(),
            &outputs,
        )
        .unwrap();
        assert_eq!(produced.quick_check.domain_status, DomainStatus::Completed);
        assert_eq!(produced.quick_check.checks.len(), 2);
        assert!(produced.quick_check.checks.iter().all(|check| check.passed));
        assert!(produced.runtime_load.is_none());
    }

    #[test]
    fn quick_terminal_preserves_prior_check_without_admitting_terminal_text() {
        let plan = quick_plan();
        let spec = resolve_quick_check_plan(&plan).unwrap();
        let first = quick_output(
            &spec.invocations[0],
            r#"{"project":"Orchid","count":3,"ready":true}"#,
        );
        let second = QuickCheckInvocationOutput {
            check_id: spec.invocations[1].check_id.into(),
            termination: InvocationTermination::Stopped,
            stdout: "partial answer that must not be scored".into(),
            stderr: "partial loader diagnostics".into(),
            started_at: "2026-07-23T13:00:02Z".into(),
            finished_at: "2026-07-23T13:00:03Z".into(),
        };
        let produced = produce_quick_check_observation(
            "quick-result-2",
            &plan,
            &spec,
            &quick_identities(),
            &[first, second],
        )
        .unwrap();
        assert_eq!(produced.quick_check.domain_status, DomainStatus::Stopped);
        assert_eq!(produced.quick_check.checks.len(), 1);
        assert_eq!(produced.quick_check.checks[0].check_id, "json-schema");
    }

    #[test]
    fn quick_output_identity_tampering_fails_before_scoring() {
        let plan = quick_plan();
        let spec = resolve_quick_check_plan(&plan).unwrap();
        let mut output = quick_output(
            &spec.invocations[0],
            r#"{"project":"Orchid","count":3,"ready":true}"#,
        );
        output.check_id = "format-constraints".into();
        let produced = produce_quick_check_observation(
            "quick-result-3",
            &plan,
            &spec,
            &quick_identities(),
            &[output],
        )
        .unwrap();
        assert_eq!(produced.quick_check.domain_status, DomainStatus::Failed);
        assert!(produced.quick_check.checks.is_empty());
        let errors = produced.diagnostics.join("\n");
        assert!(errors.contains("invocation-identity-mismatch"));
    }

    #[test]
    fn quick_unexplained_incomplete_and_noncanonical_sampler_fail_closed() {
        let plan = quick_plan();
        let spec = resolve_quick_check_plan(&plan).unwrap();
        let produced = produce_quick_check_observation(
            "quick-result-4",
            &plan,
            &spec,
            &quick_identities(),
            &[quick_output(
                &spec.invocations[0],
                r#"{"project":"Orchid","count":3,"ready":true}"#,
            )],
        )
        .unwrap();
        assert_eq!(produced.quick_check.domain_status, DomainStatus::Failed);
        assert_eq!(produced.quick_check.checks.len(), 1);
        assert_eq!(
            produced.diagnostics,
            vec!["m-o.quick-check-result.incomplete-without-terminal-observation"]
        );

        let mut invalid = plan;
        invalid.runtime.sampler.top_p = None;
        let errors = resolve_quick_check_plan(&invalid).unwrap_err().join("\n");
        assert!(errors.contains("sampler-incomplete-or-invalid"));
    }

    #[test]
    fn malformed_later_identity_build_or_prompt_preserves_only_admitted_prefix() {
        let plan = quick_plan();
        let spec = resolve_quick_check_plan(&plan).unwrap();
        let first = quick_output(
            &spec.invocations[0],
            r#"{"project":"Orchid","count":3,"ready":true}"#,
        );

        for corruption in ["identity", "build", "prompt"] {
            let mut second =
                quick_output(&spec.invocations[1], "ALPHA=red\nBRAVO=green\nCHARLIE=blue");
            match corruption {
                "identity" => second.check_id = "json-schema".into(),
                "build" => {
                    second.stdout = second
                        .stdout
                        .replace("10061 (5d5306bf3)", "10062 (5d5306bf3)");
                }
                "prompt" => {
                    second.stdout = second
                        .stdout
                        .replace("> Return exactly", "> Ignore this and return exactly");
                }
                _ => unreachable!(),
            }
            let produced = produce_quick_check_observation(
                "quick-result-prefix",
                &plan,
                &spec,
                &quick_identities(),
                &[first.clone(), second],
            )
            .unwrap();
            assert_eq!(
                produced.quick_check.domain_status,
                DomainStatus::Failed,
                "{corruption}"
            );
            assert_eq!(produced.quick_check.checks.len(), 1, "{corruption}");
            assert_eq!(
                produced.quick_check.checks[0].check_id, "json-schema",
                "{corruption}"
            );
            assert!(!produced.diagnostics.is_empty(), "{corruption}");
        }
    }
}

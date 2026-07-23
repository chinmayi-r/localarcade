//! Bounded translation from sealed M-A verification plans to the only
//! existing-engine command shapes this runner understands.
//!
//! This module does not execute anything. It deliberately has no escape hatch
//! for caller-supplied flags: a plan either maps completely to a versioned
//! protocol below or fails closed.

use crate::contracts::{
    AcceleratorBackend, BenchmarkPlan, GpuLayers, GpuLayersAll, MeasurementKind, QuickCheck,
    QuickCheckPlan, RuntimeConfiguration, SideEffects,
};

pub const BENCHMARK_PROTOCOL_V1: &str = "llama-bench-v1";
pub const QUICK_CHECK_PROTOCOL_V1: &str = "existing-llama-cli-v1";
pub const VERIFICATION_PLAN_POLICY_V1: &str = "local-arcade-existing-engine-verification-v1";
pub const STANDARD_WARMUP_RUNS_V1: u64 = 1;
pub const STANDARD_MEASURED_RUNS_V1: u64 = 3;

const BENCHMARK_PROMPT_TOKENS: u64 = 512;
const BENCHMARK_GENERATION_TOKENS: u64 = 128;
const MAX_WARMUP_RUNS: u64 = 10;
const MAX_MEASURED_RUNS: u64 = 20;
const MAX_TOTAL_RUNS: u64 = 24;
const MIN_CONTEXT_TOKENS: u64 = 512;
const MAX_CONTEXT_TOKENS: u64 = 1_048_576;
const MAX_BATCH_SIZE: u64 = 65_536;
const MAX_THREADS: u64 = 1_024;
const MAX_GPU_LAYERS: u64 = 999;

#[derive(Debug, Clone, PartialEq)]
pub struct BenchmarkExecutionSpec {
    pub protocol_id: &'static str,
    pub executable_basename: &'static str,
    pub invocations: Vec<BenchmarkInvocationSpec>,
    pub expected_backend: AcceleratorBackend,
    pub expected_engine_build: String,
    /// The exact llama-bench `-d` test depth. It does not establish the
    /// engine's maximum context capacity.
    pub context_test_depth_tokens: u64,
    pub prompt_tokens: u64,
    pub generation_tokens: u64,
    pub warmup_runs: u64,
    pub measured_runs: u64,
    pub measurement_kinds: Vec<MeasurementKind>,
    pub max_stdout_bytes: usize,
    pub max_stderr_bytes: usize,
    pub timeout_seconds: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BenchmarkRunPhase {
    Warmup,
    Measured,
}

#[derive(Debug, Clone, PartialEq)]
pub struct BenchmarkInvocationSpec {
    pub phase: BenchmarkRunPhase,
    /// One-based index within this phase.
    pub phase_run_number: u64,
    pub phase_run_count: u64,
    /// One-based index across warmup and measured invocations.
    pub overall_run_number: u64,
    pub overall_run_count: u64,
    pub argv: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct QuickCheckInvocationSpec {
    pub check_id: &'static str,
    pub criterion: &'static str,
    pub argv: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct QuickCheckExecutionSpec {
    pub protocol_id: &'static str,
    pub executable_basename: &'static str,
    pub expected_backend: AcceleratorBackend,
    pub expected_engine_build: String,
    pub invocations: Vec<QuickCheckInvocationSpec>,
    pub max_stdout_bytes_per_invocation: usize,
    pub max_stderr_bytes_per_invocation: usize,
    pub timeout_seconds_per_invocation: u64,
}

#[derive(Clone, Copy)]
struct FixedCheck {
    id: &'static str,
    criterion: &'static str,
    prompt: &'static str,
    max_tokens: u64,
}

const FIXED_CHECKS: [FixedCheck; 3] = [
    FixedCheck {
        id: "json-schema",
        criterion: "Return the exact required JSON object.",
        prompt: "Return only this data as one JSON object with exactly these keys and value types: project is the string Orchid, count is the number 3, and ready is the boolean true. Do not use markdown.",
        max_tokens: 60,
    },
    FixedCheck {
        id: "format-constraints",
        criterion: "Return exactly the required three lines in order.",
        prompt: "Return exactly these three lines, in this order, with no bullets, code fence, introduction, or trailing text:\nALPHA=red\nBRAVO=green\nCHARLIE=blue",
        max_tokens: 40,
    },
    FixedCheck {
        id: "fact-preservation",
        criterion: "Preserve all three supplied facts in one plain-text sentence.",
        prompt: "Source facts: Project Cedar launched in 2024. It has 17 contributors. Its license is Apache-2.0. Write one plain-text sentence that preserves all three facts. Do not add facts.",
        max_tokens: 60,
    },
];

pub fn standard_quick_checks_v1() -> Vec<QuickCheck> {
    FIXED_CHECKS
        .iter()
        .map(|check| QuickCheck {
            check_id: check.id.into(),
            criterion: check.criterion.into(),
        })
        .collect()
}

pub fn resolve_benchmark_plan(plan: &BenchmarkPlan) -> Result<BenchmarkExecutionSpec, Vec<String>> {
    let mut issues = Vec::new();
    if plan.protocol_id != BENCHMARK_PROTOCOL_V1 {
        issues.push(format!(
            "m-o.execution.protocol-unsupported:benchmark:{}",
            plan.protocol_id
        ));
    }
    validate_plan_identity(
        &plan.candidate_id,
        &plan.artifact_path,
        &plan.expected_artifact_sha256,
        &plan.side_effects,
        &mut issues,
    );
    validate_runtime(&plan.runtime, RuntimeUse::Benchmark, &mut issues);

    if plan.warmup_runs > MAX_WARMUP_RUNS {
        issues.push("m-o.execution.benchmark-warmup-runs-out-of-range".into());
    }
    if plan.measured_runs == 0 || plan.measured_runs > MAX_MEASURED_RUNS {
        issues.push("m-o.execution.benchmark-measured-runs-out-of-range".into());
    }
    let total_runs = plan.warmup_runs.saturating_add(plan.measured_runs);
    if total_runs > MAX_TOTAL_RUNS {
        issues.push("m-o.execution.benchmark-total-runs-out-of-range".into());
    }
    if plan.measurement_kinds.is_empty() {
        issues.push("m-o.execution.benchmark-measurement-kinds-empty".into());
    }
    let mut seen = std::collections::HashSet::new();
    for kind in &plan.measurement_kinds {
        if !seen.insert(kind) {
            issues.push("m-o.execution.benchmark-measurement-kind-duplicate".into());
        }
        if !matches!(
            kind,
            MeasurementKind::PromptProcessing
                | MeasurementKind::Generation
                | MeasurementKind::Stability
        ) {
            issues.push(format!(
                "m-o.execution.benchmark-measurement-kind-unsupported:{kind:?}"
            ));
        }
    }
    if !plan
        .measurement_kinds
        .contains(&MeasurementKind::PromptProcessing)
        || !plan
            .measurement_kinds
            .contains(&MeasurementKind::Generation)
    {
        issues.push("m-o.execution.benchmark-throughput-pair-required".into());
    }

    if !issues.is_empty() {
        issues.sort();
        issues.dedup();
        return Err(issues);
    }

    let mut argv_template = vec![
        "-m".into(),
        plan.artifact_path.clone(),
        "-p".into(),
        BENCHMARK_PROMPT_TOKENS.to_string(),
        "-n".into(),
        BENCHMARK_GENERATION_TOKENS.to_string(),
        "-d".into(),
        plan.runtime.context_tokens.to_string(),
    ];
    push_common_benchmark_runtime_args(&mut argv_template, &plan.runtime);
    argv_template.extend(["-r".into(), "1".into(), "-o".into(), "json".into()]);
    let invocations = benchmark_invocations(
        &argv_template,
        plan.warmup_runs,
        plan.measured_runs,
        total_runs,
    );

    Ok(BenchmarkExecutionSpec {
        protocol_id: BENCHMARK_PROTOCOL_V1,
        executable_basename: "llama-bench.exe",
        invocations,
        expected_backend: plan.runtime.backend.clone(),
        expected_engine_build: plan
            .runtime
            .engine_build
            .clone()
            .expect("validated engine build"),
        context_test_depth_tokens: plan.runtime.context_tokens,
        prompt_tokens: BENCHMARK_PROMPT_TOKENS,
        generation_tokens: BENCHMARK_GENERATION_TOKENS,
        warmup_runs: plan.warmup_runs,
        measured_runs: plan.measured_runs,
        measurement_kinds: plan.measurement_kinds.clone(),
        max_stdout_bytes: 4 * 1024 * 1024,
        max_stderr_bytes: 256 * 1024,
        timeout_seconds: 600,
    })
}

fn benchmark_invocations(
    argv_template: &[String],
    warmup_runs: u64,
    measured_runs: u64,
    total_runs: u64,
) -> Vec<BenchmarkInvocationSpec> {
    let warmups = (1..=warmup_runs).map(|phase_run_number| BenchmarkInvocationSpec {
        phase: BenchmarkRunPhase::Warmup,
        phase_run_number,
        phase_run_count: warmup_runs,
        overall_run_number: phase_run_number,
        overall_run_count: total_runs,
        argv: argv_template.to_vec(),
    });
    let measured = (1..=measured_runs).map(|phase_run_number| BenchmarkInvocationSpec {
        phase: BenchmarkRunPhase::Measured,
        phase_run_number,
        phase_run_count: measured_runs,
        overall_run_number: warmup_runs + phase_run_number,
        overall_run_count: total_runs,
        argv: argv_template.to_vec(),
    });
    warmups.chain(measured).collect()
}

pub fn resolve_quick_check_plan(
    plan: &QuickCheckPlan,
) -> Result<QuickCheckExecutionSpec, Vec<String>> {
    let mut issues = Vec::new();
    validate_plan_identity(
        &plan.candidate_id,
        &plan.artifact_path,
        &plan.expected_artifact_sha256,
        &plan.side_effects,
        &mut issues,
    );
    validate_runtime(&plan.runtime, RuntimeUse::QuickCheck, &mut issues);
    if plan.checks.is_empty() {
        issues.push("m-o.execution.quick-checks-empty".into());
    }
    let mut seen = std::collections::HashSet::new();
    let mut resolved = Vec::new();
    for check in &plan.checks {
        if !seen.insert(check.check_id.as_str()) {
            issues.push(format!(
                "m-o.execution.quick-check-duplicate:{}",
                check.check_id
            ));
            continue;
        }
        match fixed_check(check) {
            Ok(value) => resolved.push(value),
            Err(issue) => issues.push(issue),
        }
    }
    if !issues.is_empty() {
        issues.sort();
        issues.dedup();
        return Err(issues);
    }

    let invocations = resolved
        .into_iter()
        .map(|check| QuickCheckInvocationSpec {
            check_id: check.id,
            criterion: check.criterion,
            argv: quick_check_argv(&plan.artifact_path, &plan.runtime, check),
        })
        .collect();
    Ok(QuickCheckExecutionSpec {
        protocol_id: QUICK_CHECK_PROTOCOL_V1,
        executable_basename: "llama-cli.exe",
        expected_backend: plan.runtime.backend.clone(),
        expected_engine_build: plan
            .runtime
            .engine_build
            .clone()
            .expect("validated engine build"),
        invocations,
        max_stdout_bytes_per_invocation: 1024 * 1024,
        max_stderr_bytes_per_invocation: 256 * 1024,
        timeout_seconds_per_invocation: 180,
    })
}

pub(crate) fn validate_resolved_benchmark_invocation(
    spec: &BenchmarkExecutionSpec,
    invocation: &BenchmarkInvocationSpec,
) -> Result<(), String> {
    let index = invocation
        .overall_run_number
        .checked_sub(1)
        .and_then(|value| usize::try_from(value).ok())
        .ok_or_else(|| "m-o.execution.benchmark-invocation-index-invalid".to_string())?;
    if spec.protocol_id != BENCHMARK_PROTOCOL_V1
        || spec.executable_basename != "llama-bench.exe"
        || spec.prompt_tokens != BENCHMARK_PROMPT_TOKENS
        || spec.generation_tokens != BENCHMARK_GENERATION_TOKENS
        || invocation.overall_run_count != spec.invocations.len() as u64
        || spec.invocations.get(index) != Some(invocation)
        || invocation
            .argv
            .get(3)
            .and_then(|value| value.parse::<u64>().ok())
            != Some(BENCHMARK_PROMPT_TOKENS)
        || invocation
            .argv
            .get(5)
            .and_then(|value| value.parse::<u64>().ok())
            != Some(BENCHMARK_GENERATION_TOKENS)
        || invocation
            .argv
            .get(7)
            .and_then(|value| value.parse::<u64>().ok())
            != Some(spec.context_test_depth_tokens)
    {
        return Err("m-o.execution.benchmark-invocation-not-canonical".into());
    }
    let expected_phase_count = match invocation.phase {
        BenchmarkRunPhase::Warmup => spec.warmup_runs,
        BenchmarkRunPhase::Measured => spec.measured_runs,
    };
    if invocation.phase_run_number == 0
        || invocation.phase_run_number > expected_phase_count
        || invocation.phase_run_count != expected_phase_count
    {
        return Err("m-o.execution.benchmark-phase-identity-invalid".into());
    }
    Ok(())
}

pub(crate) fn validate_resolved_quick_check_invocation(
    spec: &QuickCheckExecutionSpec,
    invocation: &QuickCheckInvocationSpec,
) -> Result<(), String> {
    let fixed = FIXED_CHECKS
        .iter()
        .find(|check| check.id == invocation.check_id)
        .ok_or_else(|| "m-o.execution.quick-check-id-not-canonical".to_string())?;
    if spec.protocol_id != QUICK_CHECK_PROTOCOL_V1
        || spec.executable_basename != "llama-cli.exe"
        || !spec.invocations.iter().any(|value| value == invocation)
        || invocation.criterion != fixed.criterion
        || invocation.argv.get(3).map(String::as_str) != Some(fixed.prompt)
        || invocation
            .argv
            .get(5)
            .and_then(|value| value.parse::<u64>().ok())
            != Some(fixed.max_tokens)
    {
        return Err("m-o.execution.quick-check-invocation-not-canonical".into());
    }
    Ok(())
}

#[derive(Clone, Copy)]
enum RuntimeUse {
    Benchmark,
    QuickCheck,
}

fn validate_plan_identity(
    candidate_id: &str,
    artifact_path: &str,
    expected_sha256: &str,
    side_effects: &SideEffects,
    issues: &mut Vec<String>,
) {
    if candidate_id.trim().is_empty() || artifact_path.trim().is_empty() {
        issues.push("m-o.execution.plan-identity-incomplete".into());
    }
    if expected_sha256.len() != 64 || !expected_sha256.bytes().all(|byte| byte.is_ascii_hexdigit())
    {
        issues.push("m-o.execution.artifact-sha256-invalid".into());
    }
    if !side_effects.executes_local_process
        || !side_effects.loads_model
        || side_effects.writes_model_store
        || side_effects.network
        || side_effects.upload
    {
        issues.push("m-o.execution.side-effects-contract-mismatch".into());
    }
}

fn validate_runtime(
    runtime: &RuntimeConfiguration,
    use_case: RuntimeUse,
    issues: &mut Vec<String>,
) {
    if runtime.product != "llama-cpp" || runtime.engine != "llama.cpp" {
        issues.push("m-o.execution.runtime-engine-unsupported".into());
    }
    if runtime
        .engine_build
        .as_deref()
        .is_none_or(|value| value.trim().is_empty())
    {
        issues.push("m-o.execution.runtime-build-missing".into());
    }
    if !matches!(
        runtime.backend,
        AcceleratorBackend::Cuda | AcceleratorBackend::Vulkan | AcceleratorBackend::Cpu
    ) {
        issues.push("m-o.execution.runtime-backend-unsupported".into());
    }
    if !(MIN_CONTEXT_TOKENS..=MAX_CONTEXT_TOKENS).contains(&runtime.context_tokens) {
        issues.push("m-o.execution.runtime-context-out-of-range".into());
    }
    let batch = bounded_required(runtime.batch_size, MAX_BATCH_SIZE, "batch", issues);
    let micro_batch = bounded_required(
        runtime.micro_batch_size,
        MAX_BATCH_SIZE,
        "micro-batch",
        issues,
    );
    if let (Some(batch), Some(micro_batch)) = (batch, micro_batch) {
        if micro_batch > batch {
            issues.push("m-o.execution.runtime-micro-batch-exceeds-batch".into());
        }
    }
    bounded_required(runtime.threads, MAX_THREADS, "threads", issues);
    if runtime.parallelism != Some(1) {
        issues.push("m-o.execution.runtime-parallelism-unsupported".into());
    }
    if runtime.flash_attention.is_none() || runtime.mmap.is_none() {
        issues.push("m-o.execution.runtime-toggle-missing".into());
    }
    match &runtime.gpu_layers {
        Some(GpuLayers::All(GpuLayersAll::All)) => {}
        Some(GpuLayers::Count(value)) if *value <= MAX_GPU_LAYERS => {}
        _ => issues.push("m-o.execution.runtime-gpu-layers-unsupported".into()),
    }
    validate_cache_type(runtime.kv_cache.key.as_deref(), "key", issues);
    validate_cache_type(runtime.kv_cache.value.as_deref(), "value", issues);
    if !runtime.additional_flags.is_empty() {
        issues.push("m-o.execution.runtime-arbitrary-flags-rejected".into());
    }
    match use_case {
        RuntimeUse::Benchmark => {
            let sampler = &runtime.sampler;
            if !complete_valid_sampler(sampler) {
                issues.push("m-o.execution.benchmark-sampler-incomplete-or-invalid".into());
            }
        }
        RuntimeUse::QuickCheck => {
            if runtime.chat_template.as_deref() != Some("chatml") {
                issues.push("m-o.execution.quick-check-chat-template-unsupported".into());
            }
            let sampler = &runtime.sampler;
            if !complete_valid_sampler(sampler) {
                issues.push("m-o.execution.quick-check-sampler-incomplete-or-invalid".into());
            }
        }
    }
}

fn complete_valid_sampler(sampler: &crate::contracts::Sampler) -> bool {
    sampler
        .temperature
        .is_some_and(|value| value.is_finite() && value >= 0.0)
        && sampler
            .top_p
            .is_some_and(|value| value.is_finite() && (0.0..=1.0).contains(&value))
        && sampler.top_k.is_some()
        && sampler
            .min_p
            .is_some_and(|value| value.is_finite() && (0.0..=1.0).contains(&value))
        && sampler.seed.is_some()
}

fn bounded_required(
    value: Option<u64>,
    maximum: u64,
    label: &str,
    issues: &mut Vec<String>,
) -> Option<u64> {
    match value {
        Some(value) if (1..=maximum).contains(&value) => Some(value),
        _ => {
            issues.push(format!("m-o.execution.runtime-{label}-out-of-range"));
            None
        }
    }
}

fn validate_cache_type(value: Option<&str>, role: &str, issues: &mut Vec<String>) {
    if !matches!(value, Some("f16" | "q8_0" | "q4_0")) {
        issues.push(format!(
            "m-o.execution.runtime-{role}-cache-type-unsupported"
        ));
    }
}

fn gpu_layers_value(value: &GpuLayers) -> String {
    match value {
        GpuLayers::Count(value) => value.to_string(),
        GpuLayers::All(GpuLayersAll::All) => MAX_GPU_LAYERS.to_string(),
    }
}

fn push_common_benchmark_runtime_args(argv: &mut Vec<String>, runtime: &RuntimeConfiguration) {
    argv.extend([
        "-b".into(),
        runtime.batch_size.expect("validated batch").to_string(),
        "-ub".into(),
        runtime
            .micro_batch_size
            .expect("validated micro-batch")
            .to_string(),
        "-ctk".into(),
        runtime.kv_cache.key.clone().expect("validated key cache"),
        "-ctv".into(),
        runtime
            .kv_cache
            .value
            .clone()
            .expect("validated value cache"),
        "-t".into(),
        runtime.threads.expect("validated threads").to_string(),
        "-ngl".into(),
        gpu_layers_value(runtime.gpu_layers.as_ref().expect("validated GPU layers")),
        "-fa".into(),
        u8::from(runtime.flash_attention.expect("validated flash attention")).to_string(),
        "-mmp".into(),
        u8::from(runtime.mmap.expect("validated mmap")).to_string(),
    ]);
}

fn fixed_check(value: &QuickCheck) -> Result<FixedCheck, String> {
    let Some(fixed) = FIXED_CHECKS.iter().find(|check| check.id == value.check_id) else {
        return Err(format!(
            "m-o.execution.quick-check-id-unsupported:{}",
            value.check_id
        ));
    };
    if value.criterion != fixed.criterion {
        return Err(format!(
            "m-o.execution.quick-check-criterion-mismatch:{}",
            value.check_id
        ));
    }
    Ok(*fixed)
}

fn quick_check_argv(
    artifact_path: &str,
    runtime: &RuntimeConfiguration,
    check: FixedCheck,
) -> Vec<String> {
    let mut argv = vec![
        "-m".into(),
        artifact_path.into(),
        "-p".into(),
        check.prompt.into(),
        "-n".into(),
        check.max_tokens.to_string(),
        "-c".into(),
        runtime.context_tokens.to_string(),
        "-ctk".into(),
        runtime.kv_cache.key.clone().expect("validated key cache"),
        "-ctv".into(),
        runtime
            .kv_cache
            .value
            .clone()
            .expect("validated value cache"),
        "-ngl".into(),
        gpu_layers_value(runtime.gpu_layers.as_ref().expect("validated GPU layers")),
        "-b".into(),
        runtime.batch_size.expect("validated batch").to_string(),
        "-ub".into(),
        runtime
            .micro_batch_size
            .expect("validated micro-batch")
            .to_string(),
        "-t".into(),
        runtime.threads.expect("validated threads").to_string(),
        "--flash-attn".into(),
        if runtime.flash_attention.expect("validated flash attention") {
            "on"
        } else {
            "off"
        }
        .into(),
    ];
    argv.push(
        if runtime.mmap.expect("validated mmap") {
            "--mmap"
        } else {
            "--no-mmap"
        }
        .into(),
    );
    argv.extend([
        "--chat-template".into(),
        runtime
            .chat_template
            .clone()
            .expect("validated chat template"),
        "--temp".into(),
        runtime
            .sampler
            .temperature
            .expect("validated temperature")
            .to_string(),
        "--top-p".into(),
        runtime.sampler.top_p.expect("validated top-p").to_string(),
        "--top-k".into(),
        runtime.sampler.top_k.expect("validated top-k").to_string(),
        "--min-p".into(),
        runtime.sampler.min_p.expect("validated min-p").to_string(),
        "--seed".into(),
        runtime.sampler.seed.expect("validated seed").to_string(),
        "--single-turn".into(),
        "--simple-io".into(),
        "--no-show-timings".into(),
        "--color".into(),
        "off".into(),
    ]);
    argv
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::contracts::{ConcurrentGpu, KvCache, Power, Preflight, Sampler, Thermal};

    fn runtime(sampler: Sampler) -> RuntimeConfiguration {
        RuntimeConfiguration {
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
            sampler,
            additional_flags: vec![],
        }
    }

    fn side_effects() -> SideEffects {
        SideEffects {
            executes_local_process: true,
            loads_model: true,
            writes_model_store: false,
            network: false,
            upload: false,
        }
    }

    fn preflight() -> Preflight {
        Preflight {
            power: Power::Ac,
            thermal: Thermal::Unknown,
            concurrent_gpu: ConcurrentGpu::Unknown,
            requires_confirmation: false,
            conditions: vec![],
        }
    }

    fn benchmark_plan() -> BenchmarkPlan {
        BenchmarkPlan {
            benchmark_plan_id: "bench-1".into(),
            candidate_id: "candidate-1".into(),
            artifact_path: r"C:\Models\model.gguf".into(),
            expected_artifact_sha256: "a".repeat(64),
            runtime: runtime(Sampler {
                temperature: Some(0.2),
                top_p: Some(0.9),
                top_k: Some(40),
                min_p: Some(0.05),
                seed: Some(7),
            }),
            protocol_id: BENCHMARK_PROTOCOL_V1.into(),
            warmup_runs: 1,
            measured_runs: 3,
            measurement_kinds: vec![
                MeasurementKind::PromptProcessing,
                MeasurementKind::Generation,
                MeasurementKind::Stability,
            ],
            preflight: preflight(),
            side_effects: side_effects(),
        }
    }

    fn quick_plan() -> QuickCheckPlan {
        QuickCheckPlan {
            quick_check_plan_id: "quick-1".into(),
            candidate_id: "candidate-1".into(),
            artifact_path: r"C:\Models\model.gguf".into(),
            expected_artifact_sha256: "b".repeat(64),
            runtime: runtime(Sampler {
                temperature: Some(0.0),
                top_p: Some(0.9),
                top_k: Some(40),
                min_p: Some(0.05),
                seed: Some(1),
            }),
            checks: vec![QuickCheck {
                check_id: "json-schema".into(),
                criterion: "Return the exact required JSON object.".into(),
            }],
            preflight: preflight(),
            side_effects: side_effects(),
        }
    }

    #[test]
    fn benchmark_plan_resolves_to_individually_bounded_progress_invocations() {
        let spec = resolve_benchmark_plan(&benchmark_plan()).expect("supported plan");
        assert_eq!(spec.protocol_id, BENCHMARK_PROTOCOL_V1);
        assert_eq!(spec.executable_basename, "llama-bench.exe");
        assert_eq!(spec.warmup_runs, 1);
        assert_eq!(spec.measured_runs, 3);
        assert_eq!(spec.invocations.len(), 4);
        assert_eq!(spec.invocations[0].phase, BenchmarkRunPhase::Warmup);
        assert_eq!(spec.invocations[0].overall_run_number, 1);
        assert_eq!(spec.invocations[1].phase, BenchmarkRunPhase::Measured);
        assert_eq!(spec.invocations[1].phase_run_number, 1);
        assert_eq!(spec.invocations[3].overall_run_number, 4);
        for invocation in &spec.invocations {
            // llama-bench measures prompt processing and generation
            // throughput; it does not exercise sampling. The sealed sampler
            // remains part of the candidate identity but must not be
            // misrepresented as a benchmarked setting.
            assert!(!invocation.argv.iter().any(|value| matches!(
                value.as_str(),
                "--temp" | "--top-p" | "--top-k" | "--min-p" | "--seed"
            )));
            assert_eq!(invocation.overall_run_count, 4);
            assert!(invocation.argv.windows(2).any(|pair| pair == ["-r", "1"]));
            assert!(invocation
                .argv
                .windows(2)
                .any(|pair| pair == ["-ngl", "999"]));
            assert!(invocation
                .argv
                .windows(2)
                .any(|pair| pair == ["-d", "16384"]));
            assert_eq!(invocation.argv.last().map(String::as_str), Some("json"));
        }
    }

    #[test]
    fn benchmark_rejects_unknown_protocol_unproduced_kinds_and_unbounded_runs() {
        let mut plan = benchmark_plan();
        plan.protocol_id = "caller-defined".into();
        plan.warmup_runs = 11;
        plan.measured_runs = 21;
        plan.measurement_kinds.push(MeasurementKind::Memory);
        let errors = resolve_benchmark_plan(&plan).unwrap_err().join("\n");
        assert!(errors.contains("protocol-unsupported"));
        assert!(errors.contains("warmup-runs-out-of-range"));
        assert!(errors.contains("measured-runs-out-of-range"));
        assert!(errors.contains("measurement-kind-unsupported"));
    }

    #[test]
    fn runtime_rejects_arbitrary_flags_ranges_and_unrepresentable_settings() {
        let mut plan = benchmark_plan();
        plan.runtime
            .additional_flags
            .push(crate::contracts::RuntimeFlag {
                name: "--surprise".into(),
                value: Some("yes".into()),
            });
        plan.runtime.parallelism = Some(2);
        plan.runtime.micro_batch_size = Some(4096);
        let errors = resolve_benchmark_plan(&plan).unwrap_err().join("\n");
        assert!(errors.contains("arbitrary-flags-rejected"));
        assert!(errors.contains("parallelism-unsupported"));
        assert!(errors.contains("micro-batch-exceeds-batch"));
    }

    #[test]
    fn quick_check_resolves_only_the_fixed_fixture_and_exact_runtime() {
        let spec = resolve_quick_check_plan(&quick_plan()).expect("supported plan");
        assert_eq!(spec.protocol_id, QUICK_CHECK_PROTOCOL_V1);
        assert_eq!(spec.invocations.len(), 1);
        assert_eq!(spec.invocations[0].check_id, "json-schema");
        assert!(spec.invocations[0]
            .argv
            .windows(2)
            .any(|pair| pair == ["--temp", "0"]));
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
            .any(|pair| pair == ["-c", "16384"]));
    }

    #[test]
    fn quick_check_rejects_unknown_or_relabelled_checks_and_sampler_drift() {
        let mut plan = quick_plan();
        plan.checks[0].criterion = "Anything the caller wants".into();
        plan.checks.push(QuickCheck {
            check_id: "user-prompt".into(),
            criterion: "Arbitrary prompt".into(),
        });
        plan.runtime.sampler.top_p = None;
        let errors = resolve_quick_check_plan(&plan).unwrap_err().join("\n");
        assert!(errors.contains("criterion-mismatch:json-schema"));
        assert!(errors.contains("id-unsupported:user-prompt"));
        assert!(errors.contains("sampler-incomplete-or-invalid"));
    }

    #[test]
    fn side_effect_expansion_and_invalid_hash_fail_before_any_spec_exists() {
        let mut plan = quick_plan();
        plan.side_effects.network = true;
        plan.expected_artifact_sha256 = "not-a-hash".into();
        let errors = resolve_quick_check_plan(&plan).unwrap_err().join("\n");
        assert!(errors.contains("side-effects-contract-mismatch"));
        assert!(errors.contains("artifact-sha256-invalid"));
    }
}

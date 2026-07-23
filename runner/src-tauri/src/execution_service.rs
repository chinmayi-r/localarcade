//! Process-local coordinator for the existing-engine benchmark lifecycle.
//!
//! There is deliberately no IPC command in this module. Raw child output stays
//! inside the worker and only M-J-normalized terminal evidence is retained.

use crate::contracts::{DomainStatus, VerificationResult};
use crate::execution_lifecycle::{
    ExecutionLifecycleStore, ExecutionPhase, LifecycleSnapshotV1, LifecycleState,
    OneRunAuthorizationReceiptV1, ProgressUpdate,
    RuntimeLoadObservation as LifecycleLoadObservation, TerminalExecutionRecordV1,
    VerificationSubplan,
};
use crate::execution_process::{
    run_existing_engine_process, ExecutionCancellation, ExistingEngineProcessOutput,
    ExistingEngineProcessSpec, ProcessLimits, ProcessTermination,
};
use crate::execution_protocol::{
    resolve_benchmark_plan, resolve_quick_check_plan, BenchmarkExecutionSpec,
    BenchmarkInvocationSpec, BenchmarkRunPhase, QuickCheckExecutionSpec, QuickCheckInvocationSpec,
};
use crate::execution_result_adapter::{
    produce_benchmark_observation, produce_quick_check_observation, BenchmarkInvocationOutput,
    CheckedExecutionIdentities, CheckedQuickCheckIdentities, InvocationTermination,
    QuickCheckInvocationOutput,
};
use crate::verification::{
    BenchmarkObservation, PreparedVerification, QuickCheckObservation, VerificationObservation,
};
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

#[derive(Debug)]
pub struct RunnerExecutionConfirmation {
    confirmation_id: String,
    verification_plan_id: String,
    candidate_id: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionStartReceipt {
    pub authorization: OneRunAuthorizationReceiptV1,
    pub snapshot: LifecycleSnapshotV1,
}

/// Producer-private process result. It is intentionally not serializable.
#[derive(Debug)]
pub(crate) struct PrivateProcessResult {
    output: ExistingEngineProcessOutput,
    started_at: String,
    finished_at: String,
}

pub(crate) trait ProcessRunner: Send + Sync + 'static {
    fn artifact_size(&self, artifact: &Path) -> Result<u64, String>;

    fn run(
        &self,
        spec: &ExistingEngineProcessSpec,
        limits: ProcessLimits,
        cancellation: &ExecutionCancellation,
    ) -> Result<PrivateProcessResult, String>;
}

struct QuickCheckWork {
    plan: crate::contracts::QuickCheckPlan,
    spec: QuickCheckExecutionSpec,
    identities: CheckedQuickCheckIdentities,
}

#[derive(Debug, Default)]
struct RealProcessRunner;

impl ProcessRunner for RealProcessRunner {
    fn artifact_size(&self, artifact: &Path) -> Result<u64, String> {
        std::fs::metadata(artifact)
            .map(|value| value.len())
            .map_err(|error| format!("m-o.execution.artifact-metadata:{error}"))
    }

    fn run(
        &self,
        spec: &ExistingEngineProcessSpec,
        limits: ProcessLimits,
        cancellation: &ExecutionCancellation,
    ) -> Result<PrivateProcessResult, String> {
        let started_at = runner_time();
        let output = run_existing_engine_process(spec, limits, cancellation)
            .map_err(|error| format!("m-o.execution.process-boundary:{error:?}"))?;
        Ok(PrivateProcessResult {
            output,
            started_at,
            finished_at: runner_time(),
        })
    }
}

#[derive(Default)]
struct SharedExecutionState {
    lifecycle: ExecutionLifecycleStore,
    cancellations: HashMap<String, ExecutionCancellation>,
    terminals: HashMap<String, TerminalExecutionRecordV1>,
}

pub struct ExecutionService {
    shared: Arc<Mutex<SharedExecutionState>>,
    next_confirmation: u64,
    pending_confirmations: HashSet<String>,
}

impl Default for ExecutionService {
    fn default() -> Self {
        Self::new()
    }
}

impl ExecutionService {
    pub fn new() -> Self {
        Self {
            shared: Arc::new(Mutex::new(SharedExecutionState::default())),
            next_confirmation: 0,
            pending_confirmations: HashSet::new(),
        }
    }

    /// Creates a runner-owned token for the exact prepared object presented at
    /// the explicit consent boundary. The token is neither serializable nor
    /// constructible from an IPC DTO.
    pub fn confirm_prepared(
        &mut self,
        prepared: &PreparedVerification,
    ) -> Result<RunnerExecutionConfirmation, String> {
        self.next_confirmation = self
            .next_confirmation
            .checked_add(1)
            .ok_or_else(|| "m-o.execution.confirmation-id-exhausted".to_string())?;
        let confirmation_id = format!("runner-execution-confirmation-{}", self.next_confirmation);
        self.pending_confirmations.insert(confirmation_id.clone());
        Ok(RunnerExecutionConfirmation {
            confirmation_id,
            verification_plan_id: prepared.plan().verification_plan_id.clone(),
            candidate_id: prepared.plan().candidate_id.clone(),
        })
    }

    pub fn start(
        &mut self,
        prepared: PreparedVerification,
        confirmation: RunnerExecutionConfirmation,
    ) -> Result<ExecutionStartReceipt, Vec<String>> {
        self.start_with_runner(prepared, confirmation, Arc::new(RealProcessRunner))
    }

    pub(crate) fn start_with_runner(
        &mut self,
        prepared: PreparedVerification,
        confirmation: RunnerExecutionConfirmation,
        runner: Arc<dyn ProcessRunner>,
    ) -> Result<ExecutionStartReceipt, Vec<String>> {
        if !self
            .pending_confirmations
            .remove(&confirmation.confirmation_id)
        {
            return Err(vec!["m-o.execution.confirmation-consumed-or-unknown".into()]);
        }
        let plan = prepared.plan().clone();
        if confirmation.verification_plan_id != plan.verification_plan_id
            || confirmation.candidate_id != plan.candidate_id
        {
            return Err(vec!["m-o.execution.confirmation-identity-mismatch".into()]);
        }
        let benchmark_plan = plan.benchmark_plan.clone().ok_or_else(|| {
            vec!["m-o.execution.benchmark-plan-required-for-runtime-load-evidence".into()]
        })?;
        let spec = resolve_benchmark_plan(&benchmark_plan)?;
        let benchmark_tool = prepared
            .benchmark_tool()
            .cloned()
            .ok_or_else(|| vec!["m-o.execution.checked-benchmark-tool-missing".into()])?;
        let artifact_size = runner
            .artifact_size(&prepared.artifact().path)
            .map_err(|error| vec![error])?;
        if artifact_size == 0 {
            return Err(vec!["m-o.execution.artifact-size-invalid".into()]);
        }
        let identities = CheckedExecutionIdentities {
            canonical_artifact_path: prepared.artifact().path.to_string_lossy().into_owned(),
            artifact_sha256: prepared.artifact().sha256.clone(),
            artifact_size_bytes: artifact_size,
            benchmark_tool_path: benchmark_tool.path.to_string_lossy().into_owned(),
            benchmark_tool_sha256: benchmark_tool.sha256.clone(),
            engine_build: benchmark_plan
                .runtime
                .engine_build
                .clone()
                .ok_or_else(|| vec!["m-o.execution.engine-build-missing".into()])?,
        };
        let quick = match plan.quick_check_plan.clone() {
            Some(quick_plan) => {
                let quick_spec = resolve_quick_check_plan(&quick_plan)?;
                let quick_tool = prepared
                    .quick_check_tool()
                    .cloned()
                    .ok_or_else(|| vec!["m-o.execution.checked-quick-check-tool-missing".into()])?;
                Some(QuickCheckWork {
                    identities: CheckedQuickCheckIdentities {
                        canonical_artifact_path: prepared
                            .artifact()
                            .path
                            .to_string_lossy()
                            .into_owned(),
                        artifact_sha256: prepared.artifact().sha256.clone(),
                        artifact_size_bytes: artifact_size,
                        quick_check_tool_path: quick_tool.path.to_string_lossy().into_owned(),
                        quick_check_tool_sha256: quick_tool.sha256,
                        engine_build: quick_plan.runtime.engine_build.clone().ok_or_else(|| {
                            vec!["m-o.execution.quick-check-engine-build-missing".into()]
                        })?,
                    },
                    plan: quick_plan,
                    spec: quick_spec,
                })
            }
            None => None,
        };

        let mut shared = self
            .shared
            .lock()
            .map_err(|_| vec!["m-o.execution.state-poisoned".into()])?;
        if shared.lifecycle.has_active_execution() {
            return Err(vec!["m-o.execution.another-run-active".into()]);
        }
        let authorization = shared
            .lifecycle
            .authorize_prepared(&prepared, runner_time())
            .map_err(|error| vec![error])?;
        let execution_id = authorization.execution_id().to_string();
        let snapshot = shared
            .lifecycle
            .start(&execution_id, runner_time())
            .map_err(|error| vec![error])?;
        let cancellation = ExecutionCancellation::default();
        shared
            .cancellations
            .insert(execution_id.clone(), cancellation.clone());
        drop(shared);

        let worker_shared = Arc::clone(&self.shared);
        std::thread::spawn(move || {
            run_worker(
                worker_shared,
                runner,
                execution_id,
                plan,
                benchmark_plan,
                spec,
                identities,
                quick,
                cancellation,
            );
        });
        Ok(ExecutionStartReceipt {
            authorization,
            snapshot,
        })
    }

    pub fn snapshot(&self, execution_id: &str) -> Result<Option<LifecycleSnapshotV1>, String> {
        let shared = self
            .shared
            .lock()
            .map_err(|_| "m-o.execution.state-poisoned".to_string())?;
        Ok(shared.lifecycle.snapshot(execution_id).cloned())
    }

    pub fn stop(&self, execution_id: &str) -> Result<LifecycleSnapshotV1, String> {
        let mut shared = self
            .shared
            .lock()
            .map_err(|_| "m-o.execution.state-poisoned".to_string())?;
        let current = shared
            .lifecycle
            .snapshot(execution_id)
            .cloned()
            .ok_or_else(|| "m-o.execution.unknown-or-terminal-reference".to_string())?;
        if current.state() == &LifecycleState::Terminal {
            return Ok(current);
        }
        let cancellation = shared
            .cancellations
            .get(execution_id)
            .cloned()
            .ok_or_else(|| "m-o.execution.unknown-or-terminal-reference".to_string())?;
        let snapshot = shared.lifecycle.request_stop(execution_id, runner_time())?;
        cancellation.request();
        Ok(snapshot)
    }

    pub fn terminal(
        &self,
        execution_id: &str,
    ) -> Result<Option<TerminalExecutionRecordV1>, String> {
        let shared = self
            .shared
            .lock()
            .map_err(|_| "m-o.execution.state-poisoned".to_string())?;
        Ok(shared.terminals.get(execution_id).cloned())
    }

    /// Reads lifecycle and terminal state under one lock so IPC cannot observe
    /// a terminal result paired with an older running snapshot (or vice versa).
    pub fn snapshot_and_terminal(
        &self,
        execution_id: &str,
    ) -> Result<Option<(LifecycleSnapshotV1, Option<TerminalExecutionRecordV1>)>, String> {
        let shared = self
            .shared
            .lock()
            .map_err(|_| "m-o.execution.state-poisoned".to_string())?;
        Ok(shared
            .lifecycle
            .snapshot(execution_id)
            .cloned()
            .map(|snapshot| {
                let terminal = shared.terminals.get(execution_id).cloned();
                (snapshot, terminal)
            }))
    }
}

#[allow(clippy::too_many_arguments)]
fn run_worker(
    shared: Arc<Mutex<SharedExecutionState>>,
    runner: Arc<dyn ProcessRunner>,
    execution_id: String,
    plan: crate::contracts::VerificationPlan,
    benchmark_plan: crate::contracts::BenchmarkPlan,
    spec: BenchmarkExecutionSpec,
    identities: CheckedExecutionIdentities,
    quick: Option<QuickCheckWork>,
    cancellation: ExecutionCancellation,
) {
    let mut outputs = Vec::new();
    let worker_started = Instant::now();
    for invocation in &spec.invocations {
        let output = if cancellation.is_requested() {
            cancelled_output(invocation)
        } else {
            run_invocation(
                runner.as_ref(),
                invocation,
                &spec,
                &identities,
                &cancellation,
            )
        };
        let completed = output.termination == InvocationTermination::Completed;
        outputs.push(output);
        if completed {
            record_completed_progress(&shared, &execution_id, invocation, worker_started);
        } else {
            break;
        }
    }

    let result_id = format!("{execution_id}:benchmark");
    let produced =
        produce_benchmark_observation(&result_id, &benchmark_plan, &spec, &identities, &outputs);
    let (benchmark, runtime_load, admitted_series) = match produced {
        Ok(value) => {
            let admitted_series = value
                .benchmark
                .series
                .iter()
                .filter(|series| {
                    !series.warmup_samples.is_empty() || !series.measured_samples.is_empty()
                })
                .count() as u64;
            (value.benchmark, value.runtime_load, admitted_series)
        }
        Err(errors) => (failed_benchmark_observation(result_id, errors), None, 0),
    };
    let (quick_check, quick_diagnostics) = if benchmark.domain_status == DomainStatus::Completed {
        quick
            .map(|work| {
                run_quick_check_suite(
                    &shared,
                    runner.as_ref(),
                    &execution_id,
                    work,
                    &cancellation,
                    worker_started,
                )
            })
            .map_or((None, Vec::new()), |(observation, diagnostics)| {
                (Some(observation), diagnostics)
            })
    } else {
        (None, Vec::new())
    };
    let domain_status = quick_check
        .as_ref()
        .map(|value| value.domain_status.clone())
        .unwrap_or_else(|| benchmark.domain_status.clone());
    let observation = VerificationObservation {
        result_id: format!("{execution_id}:verification"),
        domain_status,
        benchmark: Some(benchmark),
        quick_check,
    };
    let normalized = crate::verification::verification_result(&plan, &observation);

    let mut state = match shared.lock() {
        Ok(value) => value,
        Err(_) => return,
    };
    if admitted_series > 0 {
        let _ = state.lifecycle.update_progress(
            &execution_id,
            ProgressUpdate {
                phase: ExecutionPhase::Finalizing,
                phase_current: 1,
                phase_total: 1,
                retained_series: admitted_series,
                retained_checks: normalized
                    .as_ref()
                    .ok()
                    .and_then(|value| value.quick_check_result.as_ref())
                    .map(|value| {
                        value
                            .checks
                            .iter()
                            .filter(|check| {
                                !matches!(check.status, crate::contracts::CheckStatus::NotRun)
                            })
                            .count() as u64
                    })
                    .unwrap_or(0),
                elapsed_ms: u64::try_from(worker_started.elapsed().as_millis()).unwrap_or(u64::MAX),
                updated_at: runner_time(),
                diagnostic_codes: quick_diagnostics,
            },
        );
    }
    if let Some(load) = runtime_load {
        if let Err(error) = state.lifecycle.record_runtime_load(
            &execution_id,
            LifecycleLoadObservation {
                subplan: VerificationSubplan::Benchmark,
                observed_backend: load.backend,
                observed_engine_build: load.engine_build,
                parser_protocol_id: "llama-bench-v1-json-record-v1".into(),
                observed_at: load.observed_at,
                raw_record_ref: load.source.into(),
            },
        ) {
            let failed = failed_result_for_plan(&plan, &execution_id, vec![error]);
            finish(&mut state, &execution_id, failed);
            return;
        }
    }
    let result = match normalized {
        Ok(value) => value,
        Err(errors) => failed_result_for_plan(&plan, &execution_id, errors),
    };
    finish(&mut state, &execution_id, result);
}

fn run_quick_check_suite(
    shared: &Arc<Mutex<SharedExecutionState>>,
    runner: &dyn ProcessRunner,
    execution_id: &str,
    work: QuickCheckWork,
    cancellation: &ExecutionCancellation,
    worker_started: Instant,
) -> (QuickCheckObservation, Vec<String>) {
    let mut outputs = Vec::new();
    for (index, invocation) in work.spec.invocations.iter().enumerate() {
        let output = if cancellation.is_requested() {
            cancelled_quick_output(invocation)
        } else {
            run_quick_invocation(
                runner,
                invocation,
                &work.spec,
                &work.identities,
                cancellation,
            )
        };
        let completed = output.termination == InvocationTermination::Completed;
        outputs.push(output);
        if completed {
            record_quick_progress(
                shared,
                execution_id,
                u64::try_from(index + 1).unwrap_or(u64::MAX),
                u64::try_from(work.spec.invocations.len()).unwrap_or(u64::MAX),
                worker_started,
            );
        } else {
            break;
        }
    }

    let result_id = format!("{execution_id}:quick-check");
    match produce_quick_check_observation(
        &result_id,
        &work.plan,
        &work.spec,
        &work.identities,
        &outputs,
    ) {
        Ok(value) => (value.quick_check, value.diagnostics),
        Err(errors) => {
            record_quick_diagnostics(
                shared,
                execution_id,
                u64::try_from(outputs.len()).unwrap_or(u64::MAX),
                u64::try_from(work.spec.invocations.len()).unwrap_or(u64::MAX),
                worker_started,
                errors.clone(),
            );
            (failed_quick_check_observation(result_id), errors)
        }
    }
}

fn run_quick_invocation(
    runner: &dyn ProcessRunner,
    invocation: &QuickCheckInvocationSpec,
    spec: &QuickCheckExecutionSpec,
    identities: &CheckedQuickCheckIdentities,
    cancellation: &ExecutionCancellation,
) -> QuickCheckInvocationOutput {
    let process_spec = ExistingEngineProcessSpec::from_quick_check_protocol(
        identities.quick_check_tool_path.clone().into(),
        identities.canonical_artifact_path.clone().into(),
        identities.quick_check_tool_sha256.clone(),
        identities.artifact_sha256.clone(),
        spec,
        invocation,
    );
    let limits = ProcessLimits::new(
        std::time::Duration::from_secs(spec.timeout_seconds_per_invocation),
        spec.max_stdout_bytes_per_invocation,
        spec.max_stderr_bytes_per_invocation,
    );
    match (process_spec, limits) {
        (Ok(process_spec), Ok(limits)) => match runner.run(&process_spec, limits, cancellation) {
            Ok(value) => quick_process_output(invocation, value),
            Err(error) => failed_quick_output(invocation, error),
        },
        (Err(error), _) => {
            failed_quick_output(invocation, format!("m-o.execution.process-spec:{error:?}"))
        }
        (_, Err(error)) => failed_quick_output(
            invocation,
            format!("m-o.execution.process-limits:{error:?}"),
        ),
    }
}

fn quick_process_output(
    invocation: &QuickCheckInvocationSpec,
    value: PrivateProcessResult,
) -> QuickCheckInvocationOutput {
    QuickCheckInvocationOutput {
        check_id: invocation.check_id.into(),
        termination: process_termination(value.output.termination, value.output.exit_code),
        stdout: String::from_utf8(value.output.stdout).unwrap_or_default(),
        stderr: String::from_utf8(value.output.stderr).unwrap_or_default(),
        started_at: value.started_at,
        finished_at: value.finished_at,
    }
}

fn failed_quick_output(
    invocation: &QuickCheckInvocationSpec,
    detail: String,
) -> QuickCheckInvocationOutput {
    QuickCheckInvocationOutput {
        check_id: invocation.check_id.into(),
        termination: InvocationTermination::Failed { detail },
        stdout: String::new(),
        stderr: String::new(),
        started_at: runner_time(),
        finished_at: runner_time(),
    }
}

fn cancelled_quick_output(invocation: &QuickCheckInvocationSpec) -> QuickCheckInvocationOutput {
    QuickCheckInvocationOutput {
        check_id: invocation.check_id.into(),
        termination: InvocationTermination::Stopped,
        stdout: String::new(),
        stderr: String::new(),
        started_at: runner_time(),
        finished_at: runner_time(),
    }
}

fn record_quick_progress(
    shared: &Arc<Mutex<SharedExecutionState>>,
    execution_id: &str,
    completed: u64,
    total: u64,
    worker_started: Instant,
) {
    if let Ok(mut state) = shared.lock() {
        let _ = state.lifecycle.update_progress(
            execution_id,
            ProgressUpdate {
                phase: ExecutionPhase::QuickCheck,
                phase_current: completed,
                phase_total: total,
                // Completed process output is not yet an admitted check. The
                // pure adapter establishes retained checks before finalizing.
                retained_series: 0,
                retained_checks: 0,
                elapsed_ms: u64::try_from(worker_started.elapsed().as_millis()).unwrap_or(u64::MAX),
                updated_at: runner_time(),
                diagnostic_codes: Vec::new(),
            },
        );
    }
}

fn record_quick_diagnostics(
    shared: &Arc<Mutex<SharedExecutionState>>,
    execution_id: &str,
    completed_or_terminal: u64,
    total: u64,
    worker_started: Instant,
    diagnostic_codes: Vec<String>,
) {
    if let Ok(mut state) = shared.lock() {
        let _ = state.lifecycle.update_progress(
            execution_id,
            ProgressUpdate {
                phase: ExecutionPhase::QuickCheck,
                phase_current: completed_or_terminal.min(total),
                phase_total: total,
                retained_series: 0,
                retained_checks: 0,
                elapsed_ms: u64::try_from(worker_started.elapsed().as_millis()).unwrap_or(u64::MAX),
                updated_at: runner_time(),
                diagnostic_codes,
            },
        );
    }
}

fn run_invocation(
    runner: &dyn ProcessRunner,
    invocation: &BenchmarkInvocationSpec,
    spec: &BenchmarkExecutionSpec,
    identities: &CheckedExecutionIdentities,
    cancellation: &ExecutionCancellation,
) -> BenchmarkInvocationOutput {
    let process_spec = ExistingEngineProcessSpec::from_benchmark_protocol(
        identities.benchmark_tool_path.clone().into(),
        identities.canonical_artifact_path.clone().into(),
        identities.benchmark_tool_sha256.clone(),
        identities.artifact_sha256.clone(),
        spec,
        invocation,
    );
    let limits = ProcessLimits::new(
        std::time::Duration::from_secs(spec.timeout_seconds),
        spec.max_stdout_bytes,
        spec.max_stderr_bytes,
    );
    let result = match (process_spec, limits) {
        (Ok(process_spec), Ok(limits)) => runner.run(&process_spec, limits, cancellation),
        (Err(error), _) => Err(format!("m-o.execution.process-spec:{error:?}")),
        (_, Err(error)) => Err(format!("m-o.execution.process-limits:{error:?}")),
    };
    match result {
        Ok(value) => process_output(invocation, value),
        Err(error) => BenchmarkInvocationOutput {
            phase: invocation.phase,
            phase_run_number: invocation.phase_run_number,
            overall_run_number: invocation.overall_run_number,
            termination: InvocationTermination::Failed { detail: error },
            stdout: String::new(),
            started_at: runner_time(),
            finished_at: runner_time(),
        },
    }
}

fn process_output(
    invocation: &BenchmarkInvocationSpec,
    value: PrivateProcessResult,
) -> BenchmarkInvocationOutput {
    let stdout = String::from_utf8(value.output.stdout).unwrap_or_default();
    let termination = process_termination(value.output.termination, value.output.exit_code);
    BenchmarkInvocationOutput {
        phase: invocation.phase,
        phase_run_number: invocation.phase_run_number,
        overall_run_number: invocation.overall_run_number,
        termination,
        stdout,
        started_at: value.started_at,
        finished_at: value.finished_at,
    }
}

fn process_termination(
    termination: ProcessTermination,
    exit_code: Option<i32>,
) -> InvocationTermination {
    match termination {
        ProcessTermination::Completed => InvocationTermination::Completed,
        // This service's only cancellation source is its explicit `stop()`
        // API. Preserve that user action as the M-A `stopped` outcome;
        // `cancelled` remains available for a distinct future source.
        ProcessTermination::Cancelled => InvocationTermination::Stopped,
        ProcessTermination::TimedOut => InvocationTermination::TimedOut,
        ProcessTermination::NonZeroExit => InvocationTermination::Failed {
            detail: format!("nonzero-exit:{exit_code:?}"),
        },
        ProcessTermination::OutputLimitExceeded => InvocationTermination::Failed {
            detail: "output-limit-exceeded".into(),
        },
    }
}

fn cancelled_output(invocation: &BenchmarkInvocationSpec) -> BenchmarkInvocationOutput {
    BenchmarkInvocationOutput {
        phase: invocation.phase,
        phase_run_number: invocation.phase_run_number,
        overall_run_number: invocation.overall_run_number,
        termination: InvocationTermination::Stopped,
        stdout: String::new(),
        started_at: runner_time(),
        finished_at: runner_time(),
    }
}

fn record_completed_progress(
    shared: &Arc<Mutex<SharedExecutionState>>,
    execution_id: &str,
    invocation: &BenchmarkInvocationSpec,
    worker_started: Instant,
) {
    let phase = match invocation.phase {
        BenchmarkRunPhase::Warmup => ExecutionPhase::BenchmarkWarmup,
        BenchmarkRunPhase::Measured => ExecutionPhase::BenchmarkMeasured,
    };
    if let Ok(mut state) = shared.lock() {
        let _ = state.lifecycle.update_progress(
            execution_id,
            ProgressUpdate {
                phase,
                phase_current: invocation.phase_run_number,
                phase_total: invocation.phase_run_count,
                // Process completion is not measurement admission. The
                // result adapter admits series only after the complete
                // bounded sequence or a typed terminal child.
                retained_series: 0,
                retained_checks: 0,
                elapsed_ms: u64::try_from(worker_started.elapsed().as_millis()).unwrap_or(u64::MAX),
                updated_at: runner_time(),
                diagnostic_codes: Vec::new(),
            },
        );
    }
}

fn failed_benchmark_observation(result_id: String, errors: Vec<String>) -> BenchmarkObservation {
    BenchmarkObservation {
        result_id,
        domain_status: DomainStatus::Failed,
        series: Vec::new(),
        diagnostics: errors,
        observed_at: Some(runner_time()),
    }
}

fn failed_quick_check_observation(result_id: String) -> QuickCheckObservation {
    QuickCheckObservation {
        result_id,
        domain_status: DomainStatus::Failed,
        checks: Vec::new(),
        observed_at: Some(runner_time()),
    }
}

fn failed_result_for_plan(
    plan: &crate::contracts::VerificationPlan,
    execution_id: &str,
    errors: Vec<String>,
) -> VerificationResult {
    let observation = VerificationObservation {
        result_id: format!("{execution_id}:verification-failed"),
        domain_status: DomainStatus::Failed,
        benchmark: plan.benchmark_plan.as_ref().map(|_| {
            failed_benchmark_observation(format!("{execution_id}:benchmark-failed"), errors)
        }),
        quick_check: None,
    };
    crate::verification::verification_result(plan, &observation).unwrap_or_else(|_normalization| {
        VerificationResult {
            verification_result_id: format!("{execution_id}:normalization-failed"),
            verification_plan_id: plan.verification_plan_id.clone(),
            candidate_id: plan.candidate_id.clone(),
            domain_status: DomainStatus::Failed,
            benchmark_result: None,
            quick_check_result: None,
        }
    })
}

fn finish(state: &mut SharedExecutionState, execution_id: &str, result: VerificationResult) {
    if let Ok(record) = state
        .lifecycle
        .finalize(execution_id, result, runner_time())
    {
        state.terminals.insert(execution_id.into(), record);
    }
    state.cancellations.remove(execution_id);
}

fn runner_time() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| u64::try_from(value.as_millis()).unwrap_or(u64::MAX))
        .unwrap_or_default();
    let seconds = millis / 1_000;
    let subsecond = millis % 1_000;
    let days = i64::try_from(seconds / 86_400).unwrap_or(i64::MAX);
    let seconds_of_day = seconds % 86_400;
    let (year, month, day) = civil_date_from_unix_days(days);
    let hour = seconds_of_day / 3_600;
    let minute = (seconds_of_day % 3_600) / 60;
    let second = seconds_of_day % 60;
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.{subsecond:03}Z")
}

fn civil_date_from_unix_days(days: i64) -> (i64, i64, i64) {
    let shifted = days + 719_468;
    let era = if shifted >= 0 {
        shifted
    } else {
        shifted - 146_096
    } / 146_097;
    let day_of_era = shifted - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let mut year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = month_prime + if month_prime < 10 { 3 } else { -9 };
    year += i64::from(month <= 2);
    (year, month, day)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::contracts::{
        AcceleratorBackend, CompatibilityAdmissionReceipt, ExactConfigurationCandidate,
        MeasurementKind, QuickCheck, VerificationPlan,
    };
    use crate::hardware_confirmation::{evaluate_hardware_confirmation, HardwareConfirmationStore};
    use crate::hardware_target::{HardwareResolution, ResolutionState};
    use crate::model_store::inventory::{
        ArtifactIdentityV1, InventoryArtifact, InventoryArtifactResolution, ModelFamilyV1,
        PromotedStatus, RegistryArtifactIdentityV1, RegistryMetadataV1,
    };
    use crate::verification::{
        prepare_verification, BenchmarkPreparation, CheckedFileIdentity, ConfirmedHardwareTarget,
        ExistingToolKind, ObservedToolIdentityReceipt, PreparedVerification, QuickCheckPreparation,
        ValidatedCompatibilityAdmissionReceipt, VerificationPreparationRequest,
        VerifiedInventorySelection,
    };
    use sha2::{Digest, Sha256};
    use std::collections::BTreeMap;
    use std::fs;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::time::Duration;

    #[derive(Clone, Copy)]
    enum FakeMode {
        Complete,
        BackendMismatch,
        MalformedCompleted,
        MalformedSecondBenchmark,
        MalformedQuickCheck,
        MalformedSecondQuickCheck,
        WaitAfterFirst,
        WaitInSecondQuickCheck,
    }

    struct FakeRunner {
        mode: FakeMode,
        calls: AtomicUsize,
    }

    impl FakeRunner {
        fn new(mode: FakeMode) -> Self {
            Self {
                mode,
                calls: AtomicUsize::new(0),
            }
        }
    }

    impl ProcessRunner for FakeRunner {
        fn artifact_size(&self, _artifact: &Path) -> Result<u64, String> {
            Ok(2_491_323_904)
        }

        fn run(
            &self,
            spec: &ExistingEngineProcessSpec,
            _limits: ProcessLimits,
            cancellation: &ExecutionCancellation,
        ) -> Result<PrivateProcessResult, String> {
            let call = self.calls.fetch_add(1, Ordering::SeqCst);
            if matches!(self.mode, FakeMode::WaitAfterFirst) && call > 0 {
                for _ in 0..200 {
                    if cancellation.is_requested() {
                        return Ok(private_output(ProcessTermination::Cancelled, String::new()));
                    }
                    std::thread::sleep(Duration::from_millis(2));
                }
                return Ok(private_output(ProcessTermination::TimedOut, String::new()));
            }
            if spec
                .executable()
                .file_name()
                .is_some_and(|name| name.eq_ignore_ascii_case("llama-cli.exe"))
            {
                if matches!(self.mode, FakeMode::MalformedQuickCheck) {
                    return Ok(private_output(
                        ProcessTermination::Completed,
                        "not an admitted llama-cli record".into(),
                    ));
                }
                if matches!(self.mode, FakeMode::MalformedSecondQuickCheck) && call > 4 {
                    return Ok(private_output(
                        ProcessTermination::Completed,
                        "not an admitted llama-cli record".into(),
                    ));
                }
                if matches!(self.mode, FakeMode::WaitInSecondQuickCheck) && call > 4 {
                    for _ in 0..200 {
                        if cancellation.is_requested() {
                            return Ok(private_output(
                                ProcessTermination::Cancelled,
                                String::new(),
                            ));
                        }
                        std::thread::sleep(Duration::from_millis(2));
                    }
                    return Ok(private_output(ProcessTermination::TimedOut, String::new()));
                }
                return Ok(private_output(
                    ProcessTermination::Completed,
                    quick_json_schema_output(),
                ));
            }
            let backend = if matches!(self.mode, FakeMode::BackendMismatch) {
                "Vulkan"
            } else {
                "CUDA"
            };
            if matches!(self.mode, FakeMode::MalformedCompleted) {
                return Ok(private_output(
                    ProcessTermination::Completed,
                    "not-json".into(),
                ));
            }
            if matches!(self.mode, FakeMode::MalformedSecondBenchmark) && call > 0 {
                return Ok(private_output(
                    ProcessTermination::Completed,
                    "not-json".into(),
                ));
            }
            Ok(private_output(
                ProcessTermination::Completed,
                bench_json(
                    100.0 + call as f64,
                    20.0 + call as f64,
                    backend,
                    &spec.artifact().to_string_lossy(),
                ),
            ))
        }
    }

    fn private_output(termination: ProcessTermination, stdout: String) -> PrivateProcessResult {
        PrivateProcessResult {
            output: ExistingEngineProcessOutput {
                termination,
                exit_code: Some(0),
                stdout: stdout.into_bytes(),
                stderr: Vec::new(),
                elapsed: Duration::from_millis(10),
            },
            started_at: "2026-07-23T12:00:00Z".into(),
            finished_at: "2026-07-23T12:00:01Z".into(),
        }
    }

    fn prepared(candidate_suffix: &str) -> PreparedVerification {
        let envelope: serde_json::Value = serde_json::from_str(include_str!(
            "../../../docs/contracts/fixtures/verification-plan.ok.json"
        ))
        .unwrap();
        let mut plan: VerificationPlan = serde_json::from_value(envelope["data"].clone()).unwrap();
        plan.verification_plan_id = format!("verification-{candidate_suffix}");
        plan.candidate_id = format!("candidate-{candidate_suffix}");
        plan.quick_check_plan = None;
        let benchmark = plan.benchmark_plan.as_mut().unwrap();
        complete_sampler(&mut benchmark.runtime.sampler);
        benchmark.candidate_id = plan.candidate_id.clone();
        benchmark.artifact_path = r"C:\Models\fixture.gguf".into();
        benchmark.expected_artifact_sha256 = "a".repeat(64);
        PreparedVerification::for_execution_service_test(
            plan,
            CheckedFileIdentity {
                path: r"C:\Models\fixture.gguf".into(),
                sha256: "a".repeat(64),
            },
            Some(CheckedFileIdentity {
                path: r"C:\llama\llama-bench.exe".into(),
                sha256: "b".repeat(64),
            }),
            None,
        )
    }

    fn prepared_combined(candidate_suffix: &str, two_checks: bool) -> PreparedVerification {
        let envelope: serde_json::Value = serde_json::from_str(include_str!(
            "../../../docs/contracts/fixtures/verification-plan.ok.json"
        ))
        .unwrap();
        let mut plan: VerificationPlan = serde_json::from_value(envelope["data"].clone()).unwrap();
        plan.verification_plan_id = format!("verification-{candidate_suffix}");
        plan.candidate_id = format!("candidate-{candidate_suffix}");
        let benchmark = plan.benchmark_plan.as_mut().unwrap();
        complete_sampler(&mut benchmark.runtime.sampler);
        benchmark.candidate_id = plan.candidate_id.clone();
        benchmark.artifact_path = r"C:\Models\fixture.gguf".into();
        benchmark.expected_artifact_sha256 = "a".repeat(64);
        let quick = plan.quick_check_plan.as_mut().unwrap();
        complete_sampler(&mut quick.runtime.sampler);
        quick.candidate_id = plan.candidate_id.clone();
        quick.artifact_path = r"C:\Models\fixture.gguf".into();
        quick.expected_artifact_sha256 = "a".repeat(64);
        if two_checks {
            quick.checks.push(crate::contracts::QuickCheck {
                check_id: "format-constraints".into(),
                criterion: "Return exactly the required three lines in order.".into(),
            });
        }
        PreparedVerification::for_execution_service_test(
            plan,
            CheckedFileIdentity {
                path: r"C:\Models\fixture.gguf".into(),
                sha256: "a".repeat(64),
            },
            Some(CheckedFileIdentity {
                path: r"C:\llama\llama-bench.exe".into(),
                sha256: "b".repeat(64),
            }),
            Some(CheckedFileIdentity {
                path: r"C:\llama\llama-cli.exe".into(),
                sha256: "c".repeat(64),
            }),
        )
    }

    fn prepared_through_mj_boundary() -> PreparedVerification {
        let artifact_bytes = b"artifact";
        let bench_bytes = b"benchmark executable";
        let quick_bytes = b"quick executable";
        let unique = format!(
            "local-arcade-execution-service-{}-{}",
            std::process::id(),
            runner_time().replace([':', '.'], "-")
        );
        let directory = std::env::temp_dir().join(unique);
        fs::create_dir_all(&directory).unwrap();
        let artifact_path = directory.join("fixture.gguf");
        let benchmark_path = directory.join("llama-bench.exe");
        let quick_path = directory.join("llama-cli.exe");
        fs::write(&artifact_path, artifact_bytes).unwrap();
        fs::write(&benchmark_path, bench_bytes).unwrap();
        fs::write(&quick_path, quick_bytes).unwrap();
        let artifact_path = fs::canonicalize(artifact_path).unwrap();
        let benchmark_path = fs::canonicalize(benchmark_path).unwrap();
        let quick_path = fs::canonicalize(quick_path).unwrap();
        let hash = |bytes: &[u8]| format!("{:x}", Sha256::digest(bytes));
        let artifact_hash = hash(artifact_bytes);

        let candidate_envelope: serde_json::Value = serde_json::from_str(include_str!(
            "../../../docs/contracts/fixtures/exact-configuration-candidate.ok.json"
        ))
        .unwrap();
        let mut candidate: ExactConfigurationCandidate =
            serde_json::from_value(candidate_envelope["data"].clone()).unwrap();
        candidate.candidate_id = "candidate-real-boundary".into();
        candidate.artifact.artifact_id = "artifact-real-boundary".into();
        candidate.artifact.filename = "fixture.gguf".into();
        candidate.artifact.sha256 = artifact_hash.clone();
        candidate.artifact.bytes = artifact_bytes.len() as u64;
        candidate.runtime.runtime_configuration_id = "runtime-real-boundary".into();
        candidate.runtime.sampler.temperature = Some(0.0);
        candidate.runtime.sampler.top_p = Some(0.9);
        candidate.runtime.sampler.top_k = Some(40);
        candidate.runtime.sampler.min_p = Some(0.05);
        candidate.runtime.sampler.seed = Some(1);

        let inventory = InventoryArtifact {
            path: artifact_path.to_string_lossy().into_owned(),
            store: "fixture".into(),
            label: "fixture.gguf".into(),
            file_size_bytes: artifact_bytes.len() as u64,
            sha256: Some(artifact_hash.clone()),
            resolution: InventoryArtifactResolution::Verified {
                identity: Box::new(RegistryArtifactIdentityV1 {
                    model_family: ModelFamilyV1 {
                        model_family_id: candidate.model_family.model_family_id.clone(),
                        display_name: candidate.model_family.display_name.clone(),
                    },
                    artifact: ArtifactIdentityV1 {
                        artifact_id: candidate.artifact.artifact_id.clone(),
                        repository: candidate.artifact.repository.clone(),
                        revision: candidate.artifact.revision.clone(),
                        filename: candidate.artifact.filename.clone(),
                        sha256: artifact_hash.clone(),
                        bytes: artifact_bytes.len() as u64,
                        format: candidate.artifact.format.clone(),
                        quantization: candidate.artifact.quantization.clone(),
                        license: candidate.artifact.license.clone(),
                        status: PromotedStatus::Promoted,
                    },
                    provenance: Vec::new(),
                    registry_metadata: RegistryMetadataV1 {
                        publisher: "fixture".into(),
                        base_model: "fixture".into(),
                        model: "fixture".into(),
                        max_context_tokens: candidate.runtime.context_tokens,
                        chat_template: candidate.runtime.chat_template.clone().unwrap(),
                        license_source_url: "https://example.invalid/license".into(),
                        field_provenance: BTreeMap::new(),
                    },
                }),
            },
        };
        let inventory_selection =
            VerifiedInventorySelection::from_inventory_artifact(&inventory).unwrap();

        let hardware_envelope: serde_json::Value = serde_json::from_str(include_str!(
            "../../../docs/contracts/fixtures/hardware-target.ok.json"
        ))
        .unwrap();
        let hardware: crate::contracts::HardwareTarget =
            serde_json::from_value(hardware_envelope["data"].clone()).unwrap();
        let resolution = HardwareResolution {
            state: ResolutionState::Ready,
            target: Some(hardware.clone()),
            reason_codes: Vec::new(),
            confirmation_fields: Vec::new(),
            memory_variant_options: Vec::new(),
            warnings: Vec::new(),
        };
        let evaluation = evaluate_hardware_confirmation(&hardware, &resolution);
        let mut hardware_store = HardwareConfirmationStore::default();
        let hardware_handle = hardware_store.insert(&evaluation, None).unwrap();
        let hardware_target = ConfirmedHardwareTarget::from_confirmation(
            hardware_store.get(hardware_handle).unwrap(),
        )
        .unwrap();

        let admission_envelope: serde_json::Value = serde_json::from_str(include_str!(
            "../../../docs/contracts/fixtures/compatibility-admission-receipt.ok.json"
        ))
        .unwrap();
        let mut admission: CompatibilityAdmissionReceipt =
            serde_json::from_value(admission_envelope["data"].clone()).unwrap();
        admission.candidate_id = candidate.candidate_id.clone();
        admission.artifact_id = candidate.artifact.artifact_id.clone();
        admission.artifact_sha256 = artifact_hash.clone();
        admission.runtime_configuration_id = candidate.runtime.runtime_configuration_id.clone();
        let build = candidate.runtime.engine_build.clone().unwrap();
        admission.target.engine_build = build.clone();
        admission.target.exact_build = Some(build.clone());
        admission.assertion.runtime_constraint.exact_build = Some(build.clone());
        admission.target.declared_package_files = vec!["fixture.gguf".into()];
        admission.target.quantization_scheme = candidate.artifact.quantization.clone();
        admission.assertion.artifact_id = candidate.artifact.artifact_id.clone();
        admission.assertion.conditions.required_files = Some(vec!["fixture.gguf".into()]);
        let compatibility_admission =
            ValidatedCompatibilityAdmissionReceipt::new(admission).unwrap();
        let tool_receipt = |kind, path, bytes: &[u8]| {
            ObservedToolIdentityReceipt::new(
                kind,
                path,
                hash(bytes),
                "llama-cpp".into(),
                "llama.cpp".into(),
                build.clone(),
                "llama-tool-version-v1".into(),
                "2026-07-23T12:00:00Z".into(),
            )
            .unwrap()
        };
        let plan_envelope: serde_json::Value = serde_json::from_str(include_str!(
            "../../../docs/contracts/fixtures/verification-plan.ok.json"
        ))
        .unwrap();
        let fixture_plan: VerificationPlan =
            serde_json::from_value(plan_envelope["data"].clone()).unwrap();
        prepare_verification(&VerificationPreparationRequest {
            verification_plan_id: "verification-real-boundary".into(),
            hardware_target,
            candidate,
            compatibility_admission,
            inventory_selection,
            benchmark: Some(BenchmarkPreparation {
                plan_id: "benchmark-real-boundary".into(),
                tool: tool_receipt(ExistingToolKind::Benchmark, benchmark_path, bench_bytes),
                protocol_id: "llama-bench-v1".into(),
                warmup_runs: 1,
                measured_runs: 3,
                measurement_kinds: vec![
                    MeasurementKind::PromptProcessing,
                    MeasurementKind::Generation,
                    MeasurementKind::Stability,
                ],
                preflight: fixture_plan.benchmark_plan.unwrap().preflight,
            }),
            quick_check: Some(QuickCheckPreparation {
                plan_id: "quick-real-boundary".into(),
                tool: tool_receipt(ExistingToolKind::QuickCheck, quick_path, quick_bytes),
                checks: vec![QuickCheck {
                    check_id: "json-schema".into(),
                    criterion: "Return the exact required JSON object.".into(),
                }],
                preflight: fixture_plan.quick_check_plan.unwrap().preflight,
            }),
        })
        .unwrap()
    }

    fn quick_json_schema_output() -> String {
        concat!(
            "build      : b10061 (5d5306bf3)\n",
            "> Return only this data as one JSON object with exactly these keys and value types: ",
            "project is the string Orchid, count is the number 3, and ready is the boolean true. ",
            "Do not use markdown.\n",
            "{\"project\":\"Orchid\",\"count\":3,\"ready\":true}\n\nExiting...\n"
        )
        .into()
    }

    fn complete_sampler(sampler: &mut crate::contracts::Sampler) {
        sampler.temperature = Some(0.0);
        sampler.top_p = Some(0.9);
        sampler.top_k = Some(40);
        sampler.min_p = Some(0.05);
        sampler.seed = Some(1);
    }

    fn bench_json(prompt: f64, generation: f64, backend: &str, model_path: &str) -> String {
        let model_path = serde_json::to_string(model_path).unwrap();
        format!(
            r#"[
{{"build_commit":"5d5306bf3","build_number":10061,"cpu_info":"CPU","gpu_info":"GPU","backends":"{backend}","model_filename":{model_path},"model_type":"fixture","model_size":2491323904,"n_batch":2048,"n_ubatch":512,"n_threads":14,"n_depth":16384,"flash_attn":1,"use_mmap":true,"type_k":"f16","type_v":"f16","n_gpu_layers":-1,"n_prompt":512,"n_gen":0,"avg_ts":{prompt},"stddev_ts":0.0,"samples_ts":[{prompt}]}},
{{"build_commit":"5d5306bf3","build_number":10061,"cpu_info":"CPU","gpu_info":"GPU","backends":"{backend}","model_filename":{model_path},"model_type":"fixture","model_size":2491323904,"n_batch":2048,"n_ubatch":512,"n_threads":14,"n_depth":16384,"flash_attn":1,"use_mmap":true,"type_k":"f16","type_v":"f16","n_gpu_layers":-1,"n_prompt":0,"n_gen":128,"avg_ts":{generation},"stddev_ts":0.0,"samples_ts":[{generation}]}}
]"#
        )
    }

    fn start_fake(
        service: &mut ExecutionService,
        prepared: PreparedVerification,
        runner: Arc<dyn ProcessRunner>,
    ) -> Result<ExecutionStartReceipt, Vec<String>> {
        let confirmation = service.confirm_prepared(&prepared).unwrap();
        service.start_with_runner(prepared, confirmation, runner)
    }

    fn wait_terminal(service: &ExecutionService, execution_id: &str) -> TerminalExecutionRecordV1 {
        for _ in 0..500 {
            if let Some(value) = service.terminal(execution_id).unwrap() {
                return value;
            }
            std::thread::sleep(Duration::from_millis(2));
        }
        panic!("worker did not publish a terminal record");
    }

    #[test]
    fn completed_worker_returns_normalized_result_and_load_receipt() {
        let mut service = ExecutionService::new();
        let start = start_fake(
            &mut service,
            prepared("complete"),
            Arc::new(FakeRunner::new(FakeMode::Complete)),
        )
        .unwrap();
        let terminal = wait_terminal(&service, start.authorization.execution_id());
        assert_eq!(
            terminal.verification_result().domain_status,
            DomainStatus::Completed,
            "{:?}",
            terminal.verification_result()
        );
        assert_eq!(terminal.runtime_load_observations().len(), 1);
        assert_eq!(
            terminal
                .verification_result()
                .benchmark_result
                .as_ref()
                .unwrap()
                .series[0]
                .measured_samples
                .len(),
            3
        );
    }

    #[test]
    fn confirmation_replay_and_cross_identity_fail_closed() {
        let mut service = ExecutionService::new();
        let first = prepared("first");
        let confirmation = service.confirm_prepared(&first).unwrap();
        let replay_id = confirmation.confirmation_id.clone();
        let start = service
            .start_with_runner(
                first,
                confirmation,
                Arc::new(FakeRunner::new(FakeMode::Complete)),
            )
            .unwrap();
        wait_terminal(&service, start.authorization.execution_id());

        let second = prepared("second");
        let mut replay = service.confirm_prepared(&second).unwrap();
        service
            .pending_confirmations
            .remove(&replay.confirmation_id);
        replay.confirmation_id = replay_id;
        assert!(service
            .start_with_runner(
                second,
                replay,
                Arc::new(FakeRunner::new(FakeMode::Complete))
            )
            .unwrap_err()
            .iter()
            .any(|error| error.contains("consumed-or-unknown")));

        let third = prepared("third");
        let cross = service.confirm_prepared(&third).unwrap();
        assert!(service
            .start_with_runner(
                prepared("different"),
                cross,
                Arc::new(FakeRunner::new(FakeMode::Complete))
            )
            .unwrap_err()
            .iter()
            .any(|error| error.contains("identity-mismatch")));
    }

    #[test]
    fn stop_preserves_completed_child_as_partial_result() {
        let mut service = ExecutionService::new();
        let start = start_fake(
            &mut service,
            prepared("stop"),
            Arc::new(FakeRunner::new(FakeMode::WaitAfterFirst)),
        )
        .unwrap();
        for _ in 0..500 {
            if service
                .snapshot(start.authorization.execution_id())
                .unwrap()
                .is_some_and(|snapshot| snapshot.sequence() >= 2)
            {
                break;
            }
            std::thread::sleep(Duration::from_millis(2));
        }
        service.stop(start.authorization.execution_id()).unwrap();
        let terminal = wait_terminal(&service, start.authorization.execution_id());
        assert_eq!(
            terminal.verification_result().domain_status,
            DomainStatus::Stopped,
            "{:?}",
            terminal.verification_result()
        );
        let result = terminal
            .verification_result()
            .benchmark_result
            .as_ref()
            .unwrap();
        assert_eq!(result.series[0].warmup_samples, vec![100.0]);
        assert!(result.series[0].measured_samples.is_empty());
        assert_eq!(
            service
                .snapshot(start.authorization.execution_id())
                .unwrap()
                .unwrap()
                .retained_series(),
            2
        );
    }

    #[test]
    fn reported_backend_mismatch_becomes_failed_not_exact_evidence() {
        let mut service = ExecutionService::new();
        let start = start_fake(
            &mut service,
            prepared("mismatch"),
            Arc::new(FakeRunner::new(FakeMode::BackendMismatch)),
        )
        .unwrap();
        let terminal = wait_terminal(&service, start.authorization.execution_id());
        assert_eq!(
            terminal.verification_result().domain_status,
            DomainStatus::Failed
        );
        assert!(terminal.runtime_load_observations().is_empty());
    }

    #[test]
    fn malformed_completed_output_never_claims_retained_series() {
        let mut service = ExecutionService::new();
        let start = start_fake(
            &mut service,
            prepared("malformed"),
            Arc::new(FakeRunner::new(FakeMode::MalformedCompleted)),
        )
        .unwrap();
        let terminal = wait_terminal(&service, start.authorization.execution_id());
        assert_eq!(
            terminal.verification_result().domain_status,
            DomainStatus::Failed
        );
        assert_eq!(
            service
                .snapshot(start.authorization.execution_id())
                .unwrap()
                .unwrap()
                .retained_series(),
            0
        );
    }

    #[test]
    fn malformed_second_benchmark_output_preserves_admitted_prefix_and_load() {
        let mut service = ExecutionService::new();
        let start = start_fake(
            &mut service,
            prepared("malformed-second"),
            Arc::new(FakeRunner::new(FakeMode::MalformedSecondBenchmark)),
        )
        .unwrap();
        let terminal = wait_terminal(&service, start.authorization.execution_id());
        let result = terminal.verification_result();
        assert_eq!(result.domain_status, DomainStatus::Failed, "{result:?}");
        let benchmark = result.benchmark_result.as_ref().unwrap();
        assert_eq!(benchmark.domain_status, DomainStatus::Failed);
        assert_eq!(benchmark.series[0].warmup_samples, vec![100.0]);
        assert!(benchmark.series[0].measured_samples.is_empty());
        assert_eq!(terminal.runtime_load_observations().len(), 1);
    }

    #[test]
    fn second_active_worker_is_rejected() {
        let mut service = ExecutionService::new();
        let start = start_fake(
            &mut service,
            prepared("active"),
            Arc::new(FakeRunner::new(FakeMode::WaitAfterFirst)),
        )
        .unwrap();
        let error = start_fake(
            &mut service,
            prepared("other"),
            Arc::new(FakeRunner::new(FakeMode::Complete)),
        )
        .unwrap_err();
        assert!(error
            .iter()
            .any(|value| value.contains("another-run-active")));
        service.stop(start.authorization.execution_id()).unwrap();
        wait_terminal(&service, start.authorization.execution_id());
    }

    #[test]
    fn combined_plan_runs_benchmark_then_fixed_quick_check_and_normalizes_both() {
        let mut service = ExecutionService::new();
        let start = start_fake(
            &mut service,
            prepared_combined("combined", false),
            Arc::new(FakeRunner::new(FakeMode::Complete)),
        )
        .unwrap();
        let terminal = wait_terminal(&service, start.authorization.execution_id());
        let result = terminal.verification_result();
        assert_eq!(result.domain_status, DomainStatus::Completed, "{result:?}");
        assert_eq!(
            result
                .benchmark_result
                .as_ref()
                .unwrap()
                .series
                .first()
                .unwrap()
                .measured_samples
                .len(),
            3
        );
        let quick = result.quick_check_result.as_ref().unwrap();
        assert_eq!(quick.domain_status, DomainStatus::Completed);
        assert_eq!(quick.checks.len(), 1);
        assert_eq!(quick.checks[0].status, crate::contracts::CheckStatus::Pass);
        assert_eq!(terminal.runtime_load_observations().len(), 1);
    }

    #[test]
    fn real_mj_preparation_resolves_and_starts_combined_execution() {
        let prepared = prepared_through_mj_boundary();
        assert!(prepared.plan().benchmark_plan.is_some());
        assert!(prepared.plan().quick_check_plan.is_some());
        let mut service = ExecutionService::new();
        let start = start_fake(
            &mut service,
            prepared,
            Arc::new(FakeRunner::new(FakeMode::Complete)),
        )
        .unwrap();
        let terminal = wait_terminal(&service, start.authorization.execution_id());
        assert_eq!(
            terminal.verification_result().domain_status,
            DomainStatus::Completed,
            "{:?}",
            terminal.verification_result()
        );
        assert!(terminal.verification_result().benchmark_result.is_some());
        assert!(terminal.verification_result().quick_check_result.is_some());
    }

    #[test]
    fn stop_during_quick_checks_preserves_benchmark_and_completed_checks() {
        let mut service = ExecutionService::new();
        let start = start_fake(
            &mut service,
            prepared_combined("quick-stop", true),
            Arc::new(FakeRunner::new(FakeMode::WaitInSecondQuickCheck)),
        )
        .unwrap();
        for _ in 0..500 {
            if service
                .snapshot(start.authorization.execution_id())
                .unwrap()
                .is_some_and(|snapshot| snapshot.phase() == &ExecutionPhase::QuickCheck)
            {
                break;
            }
            std::thread::sleep(Duration::from_millis(2));
        }
        service.stop(start.authorization.execution_id()).unwrap();
        let terminal = wait_terminal(&service, start.authorization.execution_id());
        let result = terminal.verification_result();
        assert_eq!(result.domain_status, DomainStatus::Stopped, "{result:?}");
        assert_eq!(
            result.benchmark_result.as_ref().unwrap().domain_status,
            DomainStatus::Completed
        );
        let quick = result.quick_check_result.as_ref().unwrap();
        assert_eq!(quick.domain_status, DomainStatus::Stopped);
        assert_eq!(quick.checks[0].status, crate::contracts::CheckStatus::Pass);
        assert_eq!(
            quick.checks[1].status,
            crate::contracts::CheckStatus::NotRun
        );
    }

    #[test]
    fn invalid_quick_output_fails_closed_and_surfaces_adapter_diagnostics() {
        let mut service = ExecutionService::new();
        let start = start_fake(
            &mut service,
            prepared_combined("quick-invalid", false),
            Arc::new(FakeRunner::new(FakeMode::MalformedQuickCheck)),
        )
        .unwrap();
        let terminal = wait_terminal(&service, start.authorization.execution_id());
        assert_eq!(
            terminal.verification_result().domain_status,
            DomainStatus::Failed
        );
        assert_eq!(
            terminal
                .verification_result()
                .benchmark_result
                .as_ref()
                .unwrap()
                .domain_status,
            DomainStatus::Completed
        );
        assert_eq!(
            terminal
                .verification_result()
                .quick_check_result
                .as_ref()
                .unwrap()
                .checks[0]
                .status,
            crate::contracts::CheckStatus::NotRun
        );
        let snapshot = serde_json::to_value(
            service
                .snapshot(start.authorization.execution_id())
                .unwrap()
                .unwrap(),
        )
        .unwrap();
        assert!(snapshot["diagnosticCodes"]
            .as_array()
            .is_some_and(|codes| !codes.is_empty()));
    }

    #[test]
    fn malformed_second_quick_output_preserves_admitted_first_check() {
        let mut service = ExecutionService::new();
        let start = start_fake(
            &mut service,
            prepared_combined("quick-invalid-second", true),
            Arc::new(FakeRunner::new(FakeMode::MalformedSecondQuickCheck)),
        )
        .unwrap();
        let terminal = wait_terminal(&service, start.authorization.execution_id());
        let result = terminal.verification_result();
        assert_eq!(result.domain_status, DomainStatus::Failed, "{result:?}");
        assert_eq!(
            result.benchmark_result.as_ref().unwrap().domain_status,
            DomainStatus::Completed
        );
        let quick = result.quick_check_result.as_ref().unwrap();
        assert_eq!(quick.domain_status, DomainStatus::Failed);
        assert_eq!(quick.checks[0].status, crate::contracts::CheckStatus::Pass);
        assert_eq!(
            quick.checks[1].status,
            crate::contracts::CheckStatus::NotRun
        );
        let snapshot = serde_json::to_value(
            service
                .snapshot(start.authorization.execution_id())
                .unwrap()
                .unwrap(),
        )
        .unwrap();
        assert!(snapshot["diagnosticCodes"]
            .as_array()
            .is_some_and(|codes| !codes.is_empty()));
    }

    #[test]
    fn stop_remains_idempotent_after_terminal_publication() {
        let mut service = ExecutionService::new();
        let start = start_fake(
            &mut service,
            prepared("terminal-stop"),
            Arc::new(FakeRunner::new(FakeMode::Complete)),
        )
        .unwrap();
        let execution_id = start.authorization.execution_id();
        wait_terminal(&service, execution_id);

        let first = service.stop(execution_id).unwrap();
        let second = service.stop(execution_id).unwrap();
        assert_eq!(first.state(), &LifecycleState::Terminal);
        assert_eq!(second, first);
    }

    #[test]
    fn quick_only_plan_is_blocked_without_approved_runtime_load_evidence() {
        let mut service = ExecutionService::new();
        let envelope: serde_json::Value = serde_json::from_str(include_str!(
            "../../../docs/contracts/fixtures/verification-plan.ok.json"
        ))
        .unwrap();
        let mut plan: VerificationPlan = serde_json::from_value(envelope["data"].clone()).unwrap();
        plan.benchmark_plan = None;
        let prepared = PreparedVerification::for_execution_service_test(
            plan,
            CheckedFileIdentity {
                path: r"C:\Models\fixture.gguf".into(),
                sha256: "a".repeat(64),
            },
            None,
            Some(CheckedFileIdentity {
                path: r"C:\llama\llama-cli.exe".into(),
                sha256: "c".repeat(64),
            }),
        );
        let error = start_fake(
            &mut service,
            prepared,
            Arc::new(FakeRunner::new(FakeMode::Complete)),
        )
        .unwrap_err();
        assert!(error
            .iter()
            .any(|value| { value.contains("benchmark-plan-required-for-runtime-load-evidence") }));
        assert!(service.pending_confirmations.is_empty());
    }

    #[test]
    fn fake_backend_enum_remains_exact() {
        assert_ne!(AcceleratorBackend::Cuda, AcceleratorBackend::Vulkan);
        let timestamp = runner_time();
        assert_eq!(timestamp.len(), 24);
        assert!(timestamp.ends_with('Z'));
    }
}

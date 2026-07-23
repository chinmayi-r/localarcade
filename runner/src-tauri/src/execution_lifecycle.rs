//! Process-local authorization and lifecycle records for one verification run.
//!
//! These DTOs are separately versioned internal runner records. They do not
//! extend the approved M-A v1 contract and they do not execute a process.

use crate::contracts::{AcceleratorBackend, DomainStatus, VerificationResult};
use crate::verification::PreparedVerification;
use serde::Serialize;
use std::collections::HashMap;

const INTERNAL_EXECUTION_VERSION: u64 = 1;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CheckedExecutionFileV1 {
    path: String,
    sha256: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum AuthorizedPhase {
    Benchmark,
    QuickCheck,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OneRunAuthorizationReceiptV1 {
    version: u64,
    authorization_id: String,
    execution_id: String,
    verification_plan_id: String,
    candidate_id: String,
    authorized_at: String,
    artifact: CheckedExecutionFileV1,
    benchmark_tool: Option<CheckedExecutionFileV1>,
    quick_check_tool: Option<CheckedExecutionFileV1>,
    authorized_phases: Vec<AuthorizedPhase>,
    one_time: bool,
}

impl OneRunAuthorizationReceiptV1 {
    pub fn execution_id(&self) -> &str {
        &self.execution_id
    }

    pub fn authorization_id(&self) -> &str {
        &self.authorization_id
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum LifecycleState {
    Queued,
    Running,
    StopRequested,
    Terminal,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "kebab-case")]
pub enum ExecutionPhase {
    Queued,
    IntegrityRecheck,
    ModelLoading,
    BenchmarkWarmup,
    BenchmarkMeasured,
    QuickCheck,
    Finalizing,
    Complete,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LifecycleSnapshotV1 {
    version: u64,
    execution_id: String,
    verification_plan_id: String,
    candidate_id: String,
    sequence: u64,
    state: LifecycleState,
    phase: ExecutionPhase,
    phase_current: u64,
    phase_total: u64,
    retained_series: u64,
    retained_checks: u64,
    elapsed_ms: u64,
    updated_at: String,
    diagnostic_codes: Vec<String>,
}

impl LifecycleSnapshotV1 {
    pub fn sequence(&self) -> u64 {
        self.sequence
    }

    pub fn state(&self) -> &LifecycleState {
        &self.state
    }

    pub fn phase(&self) -> &ExecutionPhase {
        &self.phase
    }

    pub fn retained_series(&self) -> u64 {
        self.retained_series
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LifecycleEventV1 {
    version: u64,
    execution_id: String,
    sequence: u64,
    previous_state: LifecycleState,
    state: LifecycleState,
    phase: ExecutionPhase,
    occurred_at: String,
    code: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum VerificationSubplan {
    Benchmark,
    QuickCheck,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeLoadObservationReceiptV1 {
    version: u64,
    execution_id: String,
    verification_plan_id: String,
    candidate_id: String,
    subplan: VerificationSubplan,
    subplan_id: String,
    runtime_configuration_id: String,
    artifact: CheckedExecutionFileV1,
    tool: CheckedExecutionFileV1,
    planned_backend: AcceleratorBackend,
    observed_backend: AcceleratorBackend,
    backend_matches_plan: bool,
    planned_engine_build: String,
    observed_engine_build: String,
    build_matches_plan: bool,
    parser_protocol_id: String,
    observed_at: String,
    raw_record_ref: String,
}

impl RuntimeLoadObservationReceiptV1 {
    pub fn backend_matches_plan(&self) -> bool {
        self.backend_matches_plan
    }

    pub fn build_matches_plan(&self) -> bool {
        self.build_matches_plan
    }
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TerminalExecutionRecordV1 {
    version: u64,
    execution_id: String,
    authorization_id: String,
    finished_at: String,
    lifecycle: LifecycleSnapshotV1,
    runtime_load_observations: Vec<RuntimeLoadObservationReceiptV1>,
    verification_result: VerificationResult,
}

impl TerminalExecutionRecordV1 {
    pub fn verification_result(&self) -> &VerificationResult {
        &self.verification_result
    }

    pub fn runtime_load_observations(&self) -> &[RuntimeLoadObservationReceiptV1] {
        &self.runtime_load_observations
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProgressUpdate {
    pub phase: ExecutionPhase,
    pub phase_current: u64,
    pub phase_total: u64,
    pub retained_series: u64,
    pub retained_checks: u64,
    pub elapsed_ms: u64,
    pub updated_at: String,
    pub diagnostic_codes: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RuntimeLoadObservation {
    pub subplan: VerificationSubplan,
    pub observed_backend: AcceleratorBackend,
    pub observed_engine_build: String,
    pub parser_protocol_id: String,
    pub observed_at: String,
    pub raw_record_ref: String,
}

#[derive(Debug)]
struct ExecutionEntry {
    authorization: OneRunAuthorizationReceiptV1,
    snapshot: LifecycleSnapshotV1,
    events: Vec<LifecycleEventV1>,
    runtime_load_observations: Vec<RuntimeLoadObservationReceiptV1>,
    authorization_consumed: bool,
    terminal: Option<TerminalExecutionRecordV1>,
    benchmark_plan_id: Option<String>,
    benchmark_runtime_id: Option<String>,
    benchmark_backend: Option<AcceleratorBackend>,
    benchmark_engine_build: Option<String>,
    quick_plan_id: Option<String>,
    quick_runtime_id: Option<String>,
    quick_backend: Option<AcceleratorBackend>,
    quick_engine_build: Option<String>,
}

#[derive(Debug, Clone)]
struct PreparedExecutionFacts {
    plan: crate::contracts::VerificationPlan,
    artifact: CheckedExecutionFileV1,
    benchmark_tool: Option<CheckedExecutionFileV1>,
    quick_check_tool: Option<CheckedExecutionFileV1>,
}

#[derive(Debug, Default)]
pub struct ExecutionLifecycleStore {
    next_id: u64,
    entries: HashMap<String, ExecutionEntry>,
}

impl ExecutionLifecycleStore {
    pub fn new() -> Self {
        Self::default()
    }

    /// Creates a one-run receipt only from the sealed M-J preparation object.
    ///
    /// `authorized_at` must come from the runner-owned clock at the consent
    /// boundary. Checked file, plan, candidate, and phase facts are never
    /// accepted as caller-authored DTO fields.
    pub fn authorize_prepared(
        &mut self,
        prepared: &PreparedVerification,
        authorized_at: String,
    ) -> Result<OneRunAuthorizationReceiptV1, String> {
        self.authorize_facts(
            PreparedExecutionFacts {
                plan: prepared.plan().clone(),
                artifact: checked_file(prepared.artifact()),
                benchmark_tool: prepared.benchmark_tool().map(checked_file),
                quick_check_tool: prepared.quick_check_tool().map(checked_file),
            },
            authorized_at,
        )
    }

    fn authorize_facts(
        &mut self,
        prepared: PreparedExecutionFacts,
        authorized_at: String,
    ) -> Result<OneRunAuthorizationReceiptV1, String> {
        require_text(&authorized_at, "authorizedAt")?;
        self.next_id = self
            .next_id
            .checked_add(1)
            .ok_or_else(|| "m-o.execution.id-exhausted".to_string())?;
        let execution_id = format!("verification-execution-{}", self.next_id);
        let authorization_id = format!("verification-authorization-{}", self.next_id);
        let plan = &prepared.plan;
        let mut authorized_phases = Vec::new();
        if plan.benchmark_plan.is_some() {
            authorized_phases.push(AuthorizedPhase::Benchmark);
        }
        if plan.quick_check_plan.is_some() {
            authorized_phases.push(AuthorizedPhase::QuickCheck);
        }
        if authorized_phases.is_empty() {
            return Err("m-o.execution.no-authorized-phase".into());
        }

        let authorization = OneRunAuthorizationReceiptV1 {
            version: INTERNAL_EXECUTION_VERSION,
            authorization_id,
            execution_id: execution_id.clone(),
            verification_plan_id: plan.verification_plan_id.clone(),
            candidate_id: plan.candidate_id.clone(),
            authorized_at: authorized_at.clone(),
            artifact: prepared.artifact,
            benchmark_tool: prepared.benchmark_tool,
            quick_check_tool: prepared.quick_check_tool,
            authorized_phases,
            one_time: true,
        };
        let snapshot = LifecycleSnapshotV1 {
            version: INTERNAL_EXECUTION_VERSION,
            execution_id: execution_id.clone(),
            verification_plan_id: plan.verification_plan_id.clone(),
            candidate_id: plan.candidate_id.clone(),
            sequence: 0,
            state: LifecycleState::Queued,
            phase: ExecutionPhase::Queued,
            phase_current: 0,
            phase_total: 1,
            retained_series: 0,
            retained_checks: 0,
            elapsed_ms: 0,
            updated_at: authorized_at,
            diagnostic_codes: Vec::new(),
        };
        let benchmark = plan.benchmark_plan.as_ref();
        let quick = plan.quick_check_plan.as_ref();
        self.entries.insert(
            execution_id,
            ExecutionEntry {
                authorization: authorization.clone(),
                snapshot,
                events: Vec::new(),
                runtime_load_observations: Vec::new(),
                authorization_consumed: false,
                terminal: None,
                benchmark_plan_id: benchmark.map(|value| value.benchmark_plan_id.clone()),
                benchmark_runtime_id: benchmark
                    .map(|value| value.runtime.runtime_configuration_id.clone()),
                benchmark_backend: benchmark.map(|value| value.runtime.backend.clone()),
                benchmark_engine_build: benchmark
                    .and_then(|value| value.runtime.engine_build.clone()),
                quick_plan_id: quick.map(|value| value.quick_check_plan_id.clone()),
                quick_runtime_id: quick.map(|value| value.runtime.runtime_configuration_id.clone()),
                quick_backend: quick.map(|value| value.runtime.backend.clone()),
                quick_engine_build: quick.and_then(|value| value.runtime.engine_build.clone()),
            },
        );
        Ok(authorization)
    }

    /// Consumes the one-run authorization and starts the lifecycle.
    pub fn start(
        &mut self,
        execution_id: &str,
        started_at: String,
    ) -> Result<LifecycleSnapshotV1, String> {
        require_text(&started_at, "startedAt")?;
        if self.entries.iter().any(|(id, entry)| {
            id != execution_id
                && matches!(
                    entry.snapshot.state,
                    LifecycleState::Running | LifecycleState::StopRequested
                )
        }) {
            return Err("m-o.execution.another-run-active".into());
        }
        let entry = self.entry_mut(execution_id)?;
        if entry.authorization_consumed {
            return Err("m-o.execution.authorization-already-consumed".into());
        }
        if entry.snapshot.state != LifecycleState::Queued {
            return Err("m-o.execution.not-queued".into());
        }
        entry.authorization_consumed = true;
        transition(
            entry,
            LifecycleState::Running,
            ExecutionPhase::IntegrityRecheck,
            started_at,
            "m-o.execution.started",
        );
        Ok(entry.snapshot.clone())
    }

    pub fn update_progress(
        &mut self,
        execution_id: &str,
        update: ProgressUpdate,
    ) -> Result<LifecycleSnapshotV1, String> {
        require_text(&update.updated_at, "updatedAt")?;
        if update.phase_total == 0 || update.phase_current > update.phase_total {
            return Err("m-o.execution.progress-out-of-range".into());
        }
        let entry = self.entry_mut(execution_id)?;
        if !matches!(
            entry.snapshot.state,
            LifecycleState::Running | LifecycleState::StopRequested
        ) {
            return Err("m-o.execution.progress-not-running".into());
        }
        if update.phase < entry.snapshot.phase {
            return Err("m-o.execution.phase-regression".into());
        }
        if update.elapsed_ms < entry.snapshot.elapsed_ms
            || update.retained_series < entry.snapshot.retained_series
            || update.retained_checks < entry.snapshot.retained_checks
            || (update.phase == entry.snapshot.phase
                && (update.phase_current < entry.snapshot.phase_current
                    || update.phase_total != entry.snapshot.phase_total))
        {
            return Err("m-o.execution.progress-regression".into());
        }
        let phase_changed = update.phase != entry.snapshot.phase;
        entry.snapshot.sequence += 1;
        entry.snapshot.phase = update.phase.clone();
        entry.snapshot.phase_current = update.phase_current;
        entry.snapshot.phase_total = update.phase_total;
        entry.snapshot.retained_series = update.retained_series;
        entry.snapshot.retained_checks = update.retained_checks;
        entry.snapshot.elapsed_ms = update.elapsed_ms;
        entry.snapshot.updated_at = update.updated_at.clone();
        entry.snapshot.diagnostic_codes = update.diagnostic_codes;
        let state = entry.snapshot.state.clone();
        entry.events.push(LifecycleEventV1 {
            version: INTERNAL_EXECUTION_VERSION,
            execution_id: execution_id.into(),
            sequence: entry.snapshot.sequence,
            previous_state: state.clone(),
            state,
            phase: update.phase,
            occurred_at: update.updated_at,
            code: if phase_changed {
                "m-o.execution.phase-advanced".into()
            } else {
                "m-o.execution.progress".into()
            },
        });
        Ok(entry.snapshot.clone())
    }

    /// Requests a safe stop. Repeated requests return the same snapshot and do
    /// not create a second event or consume another sequence number.
    pub fn request_stop(
        &mut self,
        execution_id: &str,
        requested_at: String,
    ) -> Result<LifecycleSnapshotV1, String> {
        require_text(&requested_at, "requestedAt")?;
        let entry = self.entry_mut(execution_id)?;
        match entry.snapshot.state {
            LifecycleState::Queued => {
                entry.authorization_consumed = true;
                let phase = entry.snapshot.phase.clone();
                transition(
                    entry,
                    LifecycleState::StopRequested,
                    phase,
                    requested_at,
                    "m-o.execution.stop-requested",
                );
            }
            LifecycleState::Running => {
                let phase = entry.snapshot.phase.clone();
                transition(
                    entry,
                    LifecycleState::StopRequested,
                    phase,
                    requested_at,
                    "m-o.execution.stop-requested",
                );
            }
            LifecycleState::StopRequested | LifecycleState::Terminal => {}
        }
        Ok(entry.snapshot.clone())
    }

    /// Records parser-owned evidence emitted after an attempted model load.
    pub fn record_runtime_load(
        &mut self,
        execution_id: &str,
        observation: RuntimeLoadObservation,
    ) -> Result<RuntimeLoadObservationReceiptV1, String> {
        require_text(&observation.observed_engine_build, "observedEngineBuild")?;
        require_text(&observation.parser_protocol_id, "parserProtocolId")?;
        require_text(&observation.observed_at, "observedAt")?;
        require_text(&observation.raw_record_ref, "rawRecordRef")?;
        let entry = self.entry_mut(execution_id)?;
        if !matches!(
            entry.snapshot.state,
            LifecycleState::Running | LifecycleState::StopRequested
        ) {
            return Err("m-o.execution.load-observation-outside-run".into());
        }
        if entry
            .runtime_load_observations
            .iter()
            .any(|receipt| receipt.subplan == observation.subplan)
        {
            return Err("m-o.execution.duplicate-load-observation".into());
        }
        let (subplan_id, runtime_configuration_id, planned_backend, planned_engine_build, tool) =
            match &observation.subplan {
                VerificationSubplan::Benchmark => (
                    entry.benchmark_plan_id.clone(),
                    entry.benchmark_runtime_id.clone(),
                    entry.benchmark_backend.clone(),
                    entry.benchmark_engine_build.clone(),
                    entry.authorization.benchmark_tool.clone(),
                ),
                VerificationSubplan::QuickCheck => (
                    entry.quick_plan_id.clone(),
                    entry.quick_runtime_id.clone(),
                    entry.quick_backend.clone(),
                    entry.quick_engine_build.clone(),
                    entry.authorization.quick_check_tool.clone(),
                ),
            };
        let subplan_id =
            subplan_id.ok_or_else(|| "m-o.execution.unplanned-load-observation".to_string())?;
        let runtime_configuration_id = runtime_configuration_id
            .ok_or_else(|| "m-o.execution.runtime-identity-missing".to_string())?;
        let planned_backend =
            planned_backend.ok_or_else(|| "m-o.execution.planned-backend-missing".to_string())?;
        let planned_engine_build = planned_engine_build
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| "m-o.execution.planned-build-missing".to_string())?;
        let tool = tool.ok_or_else(|| "m-o.execution.checked-tool-missing".to_string())?;
        let receipt = RuntimeLoadObservationReceiptV1 {
            version: INTERNAL_EXECUTION_VERSION,
            execution_id: execution_id.into(),
            verification_plan_id: entry.authorization.verification_plan_id.clone(),
            candidate_id: entry.authorization.candidate_id.clone(),
            subplan: observation.subplan,
            subplan_id,
            runtime_configuration_id,
            artifact: entry.authorization.artifact.clone(),
            tool,
            planned_backend: planned_backend.clone(),
            observed_backend: observation.observed_backend.clone(),
            backend_matches_plan: planned_backend == observation.observed_backend,
            planned_engine_build: planned_engine_build.clone(),
            build_matches_plan: planned_engine_build == observation.observed_engine_build,
            observed_engine_build: observation.observed_engine_build,
            parser_protocol_id: observation.parser_protocol_id,
            observed_at: observation.observed_at,
            raw_record_ref: observation.raw_record_ref,
        };
        entry.runtime_load_observations.push(receipt.clone());
        Ok(receipt)
    }

    pub fn finalize(
        &mut self,
        execution_id: &str,
        result: VerificationResult,
        finished_at: String,
    ) -> Result<TerminalExecutionRecordV1, String> {
        require_text(&finished_at, "finishedAt")?;
        let entry = self.entry_mut(execution_id)?;
        if let Some(record) = &entry.terminal {
            return if record.verification_result == result {
                Ok(record.clone())
            } else {
                Err("m-o.execution.conflicting-terminal-result".into())
            };
        }
        if !entry.authorization_consumed {
            return Err("m-o.execution.authorization-not-consumed".into());
        }
        if result.verification_plan_id != entry.authorization.verification_plan_id
            || result.candidate_id != entry.authorization.candidate_id
        {
            return Err("m-o.execution.result-identity-mismatch".into());
        }
        if result.domain_status == DomainStatus::Completed {
            let matching_load = |subplan: VerificationSubplan| {
                entry.runtime_load_observations.iter().any(|receipt| {
                    receipt.subplan == subplan
                        && receipt.backend_matches_plan
                        && receipt.build_matches_plan
                })
            };
            if entry.benchmark_plan_id.is_some() && !matching_load(VerificationSubplan::Benchmark) {
                return Err("m-o.execution.completed-without-matching-benchmark-load".into());
            }
            if entry.benchmark_plan_id.is_none()
                && entry.quick_plan_id.is_some()
                && !matching_load(VerificationSubplan::QuickCheck)
            {
                return Err("m-o.execution.completed-without-matching-quick-load".into());
            }
        }
        transition(
            entry,
            LifecycleState::Terminal,
            ExecutionPhase::Complete,
            finished_at.clone(),
            "m-o.execution.terminal",
        );
        let record = TerminalExecutionRecordV1 {
            version: INTERNAL_EXECUTION_VERSION,
            execution_id: execution_id.into(),
            authorization_id: entry.authorization.authorization_id.clone(),
            finished_at,
            lifecycle: entry.snapshot.clone(),
            runtime_load_observations: entry.runtime_load_observations.clone(),
            verification_result: result,
        };
        entry.terminal = Some(record.clone());
        Ok(record)
    }

    pub fn snapshot(&self, execution_id: &str) -> Option<&LifecycleSnapshotV1> {
        self.entries.get(execution_id).map(|entry| &entry.snapshot)
    }

    pub fn events(&self, execution_id: &str) -> Option<&[LifecycleEventV1]> {
        self.entries
            .get(execution_id)
            .map(|entry| entry.events.as_slice())
    }

    pub fn has_active_execution(&self) -> bool {
        self.entries.values().any(|entry| {
            matches!(
                entry.snapshot.state,
                LifecycleState::Running | LifecycleState::StopRequested
            )
        })
    }

    fn entry_mut(&mut self, execution_id: &str) -> Result<&mut ExecutionEntry, String> {
        self.entries
            .get_mut(execution_id)
            .ok_or_else(|| "m-o.execution.unknown-reference".into())
    }
}

fn checked_file(value: &crate::verification::CheckedFileIdentity) -> CheckedExecutionFileV1 {
    CheckedExecutionFileV1 {
        path: value.path.to_string_lossy().into_owned(),
        sha256: value.sha256.clone(),
    }
}

fn transition(
    entry: &mut ExecutionEntry,
    state: LifecycleState,
    phase: ExecutionPhase,
    occurred_at: String,
    code: &str,
) {
    let previous_state = entry.snapshot.state.clone();
    entry.snapshot.sequence += 1;
    entry.snapshot.state = state.clone();
    entry.snapshot.phase = phase.clone();
    entry.snapshot.updated_at = occurred_at.clone();
    entry.events.push(LifecycleEventV1 {
        version: INTERNAL_EXECUTION_VERSION,
        execution_id: entry.snapshot.execution_id.clone(),
        sequence: entry.snapshot.sequence,
        previous_state,
        state,
        phase,
        occurred_at,
        code: code.into(),
    });
}

fn require_text(value: &str, field: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        Err(format!("m-o.execution.missing-{field}"))
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::contracts::{BenchmarkResult, DomainStatus, QuickCheckResult, VerificationPlan};

    fn prepared_facts() -> PreparedExecutionFacts {
        let plan: VerificationPlan = serde_json::from_str(include_str!(
            "../../../docs/contracts/fixtures/verification-plan.ok.json"
        ))
        .ok()
        .and_then(|value: serde_json::Value| serde_json::from_value(value["data"].clone()).ok())
        .expect("fixture plan");
        PreparedExecutionFacts {
            plan,
            artifact: CheckedExecutionFileV1 {
                path: "C:\\Models\\fixture.gguf".into(),
                sha256: "a".repeat(64),
            },
            benchmark_tool: Some(CheckedExecutionFileV1 {
                path: "C:\\Tools\\llama-bench.exe".into(),
                sha256: "b".repeat(64),
            }),
            quick_check_tool: Some(CheckedExecutionFileV1 {
                path: "C:\\Tools\\llama-cli.exe".into(),
                sha256: "c".repeat(64),
            }),
        }
    }

    fn terminal_result(plan: &VerificationPlan, status: DomainStatus) -> VerificationResult {
        VerificationResult {
            verification_result_id: "result-1".into(),
            verification_plan_id: plan.verification_plan_id.clone(),
            candidate_id: plan.candidate_id.clone(),
            domain_status: status.clone(),
            benchmark_result: Some(BenchmarkResult {
                benchmark_result_id: "benchmark-result-1".into(),
                benchmark_plan_id: plan
                    .benchmark_plan
                    .as_ref()
                    .expect("benchmark")
                    .benchmark_plan_id
                    .clone(),
                candidate_id: plan.candidate_id.clone(),
                domain_status: status,
                series: Vec::new(),
                calibration_eligible: false,
                calibration_exclusions: vec!["test".into()],
                diagnostics: Vec::new(),
            }),
            quick_check_result: None::<QuickCheckResult>,
        }
    }

    #[test]
    fn authorization_is_bound_to_prepared_facts_and_consumed_once() {
        let prepared = prepared_facts();
        let mut store = ExecutionLifecycleStore::new();
        let receipt = store
            .authorize_facts(prepared, "2026-07-23T12:00:00Z".into())
            .unwrap();
        assert_eq!(
            store.snapshot(receipt.execution_id()).unwrap().sequence(),
            0
        );
        let started = store
            .start(receipt.execution_id(), "2026-07-23T12:00:01Z".into())
            .unwrap();
        assert_eq!(started.state(), &LifecycleState::Running);
        assert_eq!(started.phase(), &ExecutionPhase::IntegrityRecheck);
        assert_eq!(
            store
                .start(receipt.execution_id(), "2026-07-23T12:00:02Z".into())
                .unwrap_err(),
            "m-o.execution.authorization-already-consumed"
        );
    }

    #[test]
    fn progress_is_monotonic_and_stop_is_idempotent() {
        let prepared = prepared_facts();
        let mut store = ExecutionLifecycleStore::new();
        let receipt = store
            .authorize_facts(prepared, "2026-07-23T12:00:00Z".into())
            .unwrap();
        store
            .start(receipt.execution_id(), "2026-07-23T12:00:01Z".into())
            .unwrap();
        store
            .update_progress(
                receipt.execution_id(),
                ProgressUpdate {
                    phase: ExecutionPhase::BenchmarkMeasured,
                    phase_current: 1,
                    phase_total: 3,
                    retained_series: 1,
                    retained_checks: 0,
                    elapsed_ms: 500,
                    updated_at: "2026-07-23T12:00:02Z".into(),
                    diagnostic_codes: Vec::new(),
                },
            )
            .unwrap();
        store
            .update_progress(
                receipt.execution_id(),
                ProgressUpdate {
                    phase: ExecutionPhase::BenchmarkMeasured,
                    phase_current: 2,
                    phase_total: 3,
                    retained_series: 1,
                    retained_checks: 0,
                    elapsed_ms: 550,
                    updated_at: "2026-07-23T12:00:02.500Z".into(),
                    diagnostic_codes: Vec::new(),
                },
            )
            .unwrap();
        let counter_regression = store
            .update_progress(
                receipt.execution_id(),
                ProgressUpdate {
                    phase: ExecutionPhase::BenchmarkMeasured,
                    phase_current: 1,
                    phase_total: 3,
                    retained_series: 1,
                    retained_checks: 0,
                    elapsed_ms: 575,
                    updated_at: "2026-07-23T12:00:02.750Z".into(),
                    diagnostic_codes: Vec::new(),
                },
            )
            .unwrap_err();
        assert_eq!(counter_regression, "m-o.execution.progress-regression");
        let regression = store
            .update_progress(
                receipt.execution_id(),
                ProgressUpdate {
                    phase: ExecutionPhase::ModelLoading,
                    phase_current: 1,
                    phase_total: 1,
                    retained_series: 1,
                    retained_checks: 0,
                    elapsed_ms: 600,
                    updated_at: "2026-07-23T12:00:03Z".into(),
                    diagnostic_codes: Vec::new(),
                },
            )
            .unwrap_err();
        assert_eq!(regression, "m-o.execution.phase-regression");
        let first = store
            .request_stop(receipt.execution_id(), "2026-07-23T12:00:04Z".into())
            .unwrap();
        let event_count = store.events(receipt.execution_id()).unwrap().len();
        let second = store
            .request_stop(receipt.execution_id(), "2026-07-23T12:00:05Z".into())
            .unwrap();
        assert_eq!(first, second);
        assert_eq!(
            store.events(receipt.execution_id()).unwrap().len(),
            event_count
        );
    }

    #[test]
    fn load_observation_separates_planned_and_observed_backend() {
        let prepared = prepared_facts();
        let mut store = ExecutionLifecycleStore::new();
        let receipt = store
            .authorize_facts(prepared, "2026-07-23T12:00:00Z".into())
            .unwrap();
        store
            .start(receipt.execution_id(), "2026-07-23T12:00:01Z".into())
            .unwrap();
        let load = store
            .record_runtime_load(
                receipt.execution_id(),
                RuntimeLoadObservation {
                    subplan: VerificationSubplan::Benchmark,
                    observed_backend: AcceleratorBackend::Vulkan,
                    observed_engine_build: "b10061 (5d5306bf3)".into(),
                    parser_protocol_id: "llama-cpp-load-log-v1".into(),
                    observed_at: "2026-07-23T12:00:02Z".into(),
                    raw_record_ref: "local://execution/load-log".into(),
                },
            )
            .unwrap();
        assert!(!load.backend_matches_plan());
        assert!(load.build_matches_plan());
        assert_eq!(
            store
                .record_runtime_load(
                    receipt.execution_id(),
                    RuntimeLoadObservation {
                        subplan: VerificationSubplan::Benchmark,
                        observed_backend: AcceleratorBackend::Cuda,
                        observed_engine_build: "b10061 (5d5306bf3)".into(),
                        parser_protocol_id: "llama-cpp-load-log-v1".into(),
                        observed_at: "2026-07-23T12:00:03Z".into(),
                        raw_record_ref: "local://execution/load-log-duplicate".into(),
                    },
                )
                .unwrap_err(),
            "m-o.execution.duplicate-load-observation"
        );
    }

    #[test]
    fn only_one_execution_may_be_active_and_completed_requires_load_evidence() {
        let first_facts = prepared_facts();
        let first_plan = first_facts.plan.clone();
        let second_facts = prepared_facts();
        let mut store = ExecutionLifecycleStore::new();
        let first = store
            .authorize_facts(first_facts, "2026-07-23T12:00:00Z".into())
            .unwrap();
        let second = store
            .authorize_facts(second_facts, "2026-07-23T12:00:00Z".into())
            .unwrap();
        store
            .start(first.execution_id(), "2026-07-23T12:00:01Z".into())
            .unwrap();
        assert_eq!(
            store
                .start(second.execution_id(), "2026-07-23T12:00:02Z".into())
                .unwrap_err(),
            "m-o.execution.another-run-active"
        );
        assert_eq!(
            store
                .finalize(
                    first.execution_id(),
                    terminal_result(&first_plan, DomainStatus::Completed),
                    "2026-07-23T12:00:03Z".into(),
                )
                .unwrap_err(),
            "m-o.execution.completed-without-matching-benchmark-load"
        );
        store
            .record_runtime_load(
                first.execution_id(),
                RuntimeLoadObservation {
                    subplan: VerificationSubplan::Benchmark,
                    observed_backend: AcceleratorBackend::Cuda,
                    observed_engine_build: "b10061 (5d5306bf3)".into(),
                    parser_protocol_id: "llama-cpp-load-log-v1".into(),
                    observed_at: "2026-07-23T12:00:03Z".into(),
                    raw_record_ref: "local://execution/load-log".into(),
                },
            )
            .unwrap();
        store
            .finalize(
                first.execution_id(),
                terminal_result(&first_plan, DomainStatus::Completed),
                "2026-07-23T12:00:04Z".into(),
            )
            .unwrap();
        assert_eq!(
            store
                .start(second.execution_id(), "2026-07-23T12:00:05Z".into())
                .unwrap()
                .state(),
            &LifecycleState::Running
        );
    }

    #[test]
    fn terminal_record_cross_binds_result_and_is_idempotent() {
        let prepared = prepared_facts();
        let plan = prepared.plan.clone();
        let mut store = ExecutionLifecycleStore::new();
        let receipt = store
            .authorize_facts(prepared, "2026-07-23T12:00:00Z".into())
            .unwrap();
        store
            .start(receipt.execution_id(), "2026-07-23T12:00:01Z".into())
            .unwrap();
        let result = terminal_result(&plan, DomainStatus::Stopped);
        let first = store
            .finalize(
                receipt.execution_id(),
                result.clone(),
                "2026-07-23T12:00:03Z".into(),
            )
            .unwrap();
        let second = store
            .finalize(
                receipt.execution_id(),
                result,
                "2026-07-23T12:00:04Z".into(),
            )
            .unwrap();
        assert_eq!(first, second);
        assert_eq!(
            store.snapshot(receipt.execution_id()).unwrap().state(),
            &LifecycleState::Terminal
        );
        let mut conflicting = terminal_result(&plan, DomainStatus::Failed);
        conflicting.verification_result_id = "conflicting-result".into();
        assert_eq!(
            store
                .finalize(
                    receipt.execution_id(),
                    conflicting,
                    "2026-07-23T12:00:05Z".into()
                )
                .unwrap_err(),
            "m-o.execution.conflicting-terminal-result"
        );

        let other = prepared_facts();
        let mut bad = terminal_result(&other.plan, DomainStatus::Failed);
        bad.candidate_id = "different-candidate".into();
        let mut another_store = ExecutionLifecycleStore::new();
        let another = another_store
            .authorize_facts(other, "2026-07-23T12:00:00Z".into())
            .unwrap();
        another_store
            .start(another.execution_id(), "2026-07-23T12:00:01Z".into())
            .unwrap();
        assert_eq!(
            another_store
                .finalize(another.execution_id(), bad, "2026-07-23T12:00:02Z".into())
                .unwrap_err(),
            "m-o.execution.result-identity-mismatch"
        );
    }
}

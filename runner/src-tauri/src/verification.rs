//! M-J verification boundary for user-selected, existing llama.cpp tools.
//!
//! This module prepares and normalizes approved M-A plans/results. It is not a
//! Tauri command, downloads nothing, opens no network path, and makes no claim
//! that a user-supplied child process is sandboxed. Hashing is limited to the
//! artifact and executable paths explicitly supplied for this action.

use crate::contracts::{
    AcceleratorBackend, Aggregate, BenchmarkPlan, BenchmarkResult, CheckStatus, ConcurrentGpu,
    DomainStatus, ExactConfigurationCandidate, HardwareMatch, Interval, MeasurementKind,
    MeasurementSeries, MeasurementUnit, Power, Preflight, Provenance, ProvenanceMeasurement,
    ProvenanceMethod, ProvenanceScope, QuickCheck, QuickCheckOutcome, QuickCheckPlan,
    QuickCheckResult, RuntimeConfiguration, SideEffects, Source, Stability, Thermal,
    VerificationPlan, VerificationResult,
};
use crate::hardware_target::{HardwareResolution, ResolutionState};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

const SHA256_HEX_LENGTH: usize = 64;
const MAX_STABLE_RELATIVE_RANGE: f64 = 0.20;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ExistingToolKind {
    Benchmark,
    QuickCheck,
}

#[derive(Debug, Clone, PartialEq)]
/// Identity reported by a separately checked local probe. This adapter checks
/// the selected executable bytes and compares the receipt to the candidate;
/// it does not infer build/backend identity from a filename.
pub struct ObservedToolIdentityReceipt {
    pub kind: ExistingToolKind,
    pub path: PathBuf,
    pub expected_sha256: String,
    pub observed_product: String,
    pub observed_engine: String,
    pub observed_engine_build: String,
    pub observed_backend: AcceleratorBackend,
    pub probe_protocol_id: String,
    pub observed_at: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct VerificationPreparationRequest {
    pub verification_plan_id: String,
    pub hardware_target: ConfirmedHardwareTarget,
    pub candidate: ExactConfigurationCandidate,
    pub artifact_path: PathBuf,
    pub expected_artifact_sha256: String,
    pub benchmark: Option<BenchmarkPreparation>,
    pub quick_check: Option<QuickCheckPreparation>,
}

/// M-J may only consume an M-D target which is ready, or one whose reported
/// ambiguity the caller has explicitly confirmed. Keeping the identifier
/// private prevents callers from bypassing that state transition with text.
#[derive(Debug, Clone, PartialEq)]
pub struct ConfirmedHardwareTarget {
    hardware_target_id: String,
}

impl ConfirmedHardwareTarget {
    pub fn from_resolution(
        resolution: &HardwareResolution,
        explicitly_confirmed: bool,
    ) -> Result<Self, String> {
        match resolution.state {
            ResolutionState::Ready => {}
            ResolutionState::ConfirmationRequired if explicitly_confirmed => {}
            ResolutionState::ConfirmationRequired => {
                return Err("m-j.hardware.confirmation-required".into());
            }
            ResolutionState::Unavailable => {
                return Err("m-j.hardware.unavailable".into());
            }
        }
        let target = resolution
            .target
            .as_ref()
            .ok_or_else(|| "m-j.hardware.target-missing".to_string())?;
        if target.hardware_target_id.trim().is_empty() {
            return Err("m-j.hardware.target-id-missing".into());
        }
        Ok(Self {
            hardware_target_id: target.hardware_target_id.clone(),
        })
    }

    pub fn id(&self) -> &str {
        &self.hardware_target_id
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct BenchmarkPreparation {
    pub plan_id: String,
    pub tool: ObservedToolIdentityReceipt,
    pub protocol_id: String,
    pub warmup_runs: u64,
    pub measured_runs: u64,
    pub measurement_kinds: Vec<MeasurementKind>,
    pub preflight: Preflight,
}

#[derive(Debug, Clone, PartialEq)]
pub struct QuickCheckPreparation {
    pub plan_id: String,
    pub tool: ObservedToolIdentityReceipt,
    pub checks: Vec<QuickCheck>,
    pub preflight: Preflight,
}

#[derive(Debug, Clone, PartialEq)]
pub struct CheckedFileIdentity {
    pub path: PathBuf,
    pub sha256: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PreparedVerification {
    plan: VerificationPlan,
    artifact: CheckedFileIdentity,
    benchmark_tool: Option<CheckedFileIdentity>,
    quick_check_tool: Option<CheckedFileIdentity>,
}

impl PreparedVerification {
    pub fn plan(&self) -> &VerificationPlan {
        &self.plan
    }

    pub fn artifact(&self) -> &CheckedFileIdentity {
        &self.artifact
    }

    pub fn benchmark_tool(&self) -> Option<&CheckedFileIdentity> {
        self.benchmark_tool.as_ref()
    }

    pub fn quick_check_tool(&self) -> Option<&CheckedFileIdentity> {
        self.quick_check_tool.as_ref()
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct SeriesObservation {
    pub kind: MeasurementKind,
    pub unit: MeasurementUnit,
    pub warmup_samples: Vec<f64>,
    pub measured_samples: Vec<f64>,
    pub completion: DomainStatus,
}

#[derive(Debug, Clone, PartialEq)]
pub struct BenchmarkObservation {
    pub result_id: String,
    pub domain_status: DomainStatus,
    pub series: Vec<SeriesObservation>,
    pub diagnostics: Vec<String>,
    pub observed_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct CheckObservation {
    pub check_id: String,
    pub passed: bool,
    pub explanation: String,
    pub local_diagnostics: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct QuickCheckObservation {
    pub result_id: String,
    pub domain_status: DomainStatus,
    pub checks: Vec<CheckObservation>,
    pub observed_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct VerificationObservation {
    pub result_id: String,
    pub benchmark: Option<BenchmarkObservation>,
    pub quick_check: Option<QuickCheckObservation>,
}

pub fn prepare_verification(
    request: &VerificationPreparationRequest,
) -> Result<PreparedVerification, Vec<String>> {
    let mut issues = Vec::new();
    if !cfg!(windows) {
        issues.push("m-j.platform.unsupported: this checkpoint is Windows-first".into());
    }
    require_text(
        &request.verification_plan_id,
        "verificationPlanId",
        &mut issues,
    );
    require_text(
        &request.candidate.candidate_id,
        "candidate.candidateId",
        &mut issues,
    );
    require_text(
        &request.candidate.artifact.artifact_id,
        "candidate.artifact.artifactId",
        &mut issues,
    );
    require_text(
        &request.candidate.artifact.repository,
        "candidate.artifact.repository",
        &mut issues,
    );
    require_text(
        &request.candidate.artifact.revision,
        "candidate.artifact.revision",
        &mut issues,
    );
    require_text(
        &request.candidate.artifact.filename,
        "candidate.artifact.filename",
        &mut issues,
    );
    if request.benchmark.is_none() && request.quick_check.is_none() {
        issues.push("m-j.plan.empty: at least one typed verification plan is required".into());
    }
    if request.expected_artifact_sha256 != request.candidate.artifact.sha256 {
        issues.push(
            "m-j.artifact.expected-hash-mismatch: request and candidate hashes differ".into(),
        );
    }
    validate_sha256(&request.expected_artifact_sha256, "artifact", &mut issues);
    if !matches!(
        request.candidate.artifact.status,
        crate::contracts::ArtifactStatus::Promoted
    ) {
        issues.push("m-j.candidate.not-promoted".into());
    }
    if request.candidate.provenance.is_empty() {
        issues.push("m-j.candidate.provenance-missing".into());
    }
    validate_runtime(&request.candidate.runtime, &mut issues);

    let artifact = checked_identity(
        &request.artifact_path,
        &request.expected_artifact_sha256,
        "artifact",
        &mut issues,
    );
    if let Ok(metadata) = std::fs::metadata(&request.artifact_path) {
        if metadata.len() != request.candidate.artifact.bytes {
            issues.push("m-j.artifact.byte-size-mismatch".into());
        }
    }
    let benchmark_tool = request.benchmark.as_ref().and_then(|value| {
        validate_benchmark(value, &request.candidate, &mut issues);
        checked_tool(&value.tool, &request.candidate.runtime, &mut issues)
    });
    let quick_check_tool = request.quick_check.as_ref().and_then(|value| {
        validate_quick_check(value, &request.candidate, &mut issues);
        checked_tool(&value.tool, &request.candidate.runtime, &mut issues)
    });
    if !issues.is_empty() {
        return Err(issues);
    }

    let side_effects = local_execution_side_effects();
    let runtime = request.candidate.runtime.clone();
    let artifact_path = request.artifact_path.to_string_lossy().into_owned();
    let benchmark_plan = request.benchmark.as_ref().map(|value| BenchmarkPlan {
        benchmark_plan_id: value.plan_id.clone(),
        candidate_id: request.candidate.candidate_id.clone(),
        artifact_path: artifact_path.clone(),
        expected_artifact_sha256: request.expected_artifact_sha256.clone(),
        runtime: runtime.clone(),
        protocol_id: value.protocol_id.clone(),
        warmup_runs: value.warmup_runs,
        measured_runs: value.measured_runs,
        measurement_kinds: value.measurement_kinds.clone(),
        preflight: value.preflight.clone(),
        side_effects: side_effects.clone(),
    });
    let quick_check_plan = request.quick_check.as_ref().map(|value| QuickCheckPlan {
        quick_check_plan_id: value.plan_id.clone(),
        candidate_id: request.candidate.candidate_id.clone(),
        artifact_path,
        expected_artifact_sha256: request.expected_artifact_sha256.clone(),
        runtime,
        checks: value.checks.clone(),
        preflight: value.preflight.clone(),
        side_effects,
    });
    Ok(PreparedVerification {
        plan: VerificationPlan {
            verification_plan_id: request.verification_plan_id.clone(),
            hardware_target_id: request.hardware_target.hardware_target_id.clone(),
            candidate_id: request.candidate.candidate_id.clone(),
            benchmark_plan,
            quick_check_plan,
        },
        artifact: artifact.expect("checked artifact exists after validation"),
        benchmark_tool,
        quick_check_tool,
    })
}

pub fn benchmark_result(
    plan: &BenchmarkPlan,
    observation: &BenchmarkObservation,
) -> Result<BenchmarkResult, Vec<String>> {
    let mut issues = Vec::new();
    require_text(&observation.result_id, "benchmarkResultId", &mut issues);
    reject_duplicate_series(&observation.series, &mut issues);
    let required_kinds: Vec<_> = plan
        .measurement_kinds
        .iter()
        .filter(|kind| !matches!(kind, MeasurementKind::Stability))
        .collect();
    if observation.domain_status == DomainStatus::Completed
        && required_kinds.iter().any(|kind| {
            !observation
                .series
                .iter()
                .any(|series| &series.kind == *kind)
        })
    {
        issues.push("m-j.series.completed-missing-planned-kind".into());
    }
    for series in &observation.series {
        validate_samples(plan, series, &mut issues);
        if observation.domain_status == DomainStatus::Completed
            && series.completion != DomainStatus::Completed
        {
            issues.push(format!(
                "m-j.series.completed-result-has-partial-series:{:?}",
                series.kind
            ));
        }
        if !plan.measurement_kinds.contains(&series.kind) {
            issues.push(format!(
                "m-j.series.unplanned: {:?} was not requested by the benchmark plan",
                series.kind
            ));
        }
    }
    if !issues.is_empty() {
        return Err(issues);
    }

    let mut series: Vec<MeasurementSeries> = observation
        .series
        .iter()
        .map(|value| normalized_series(plan, value, observation.observed_at.clone()))
        .collect();
    for kind in &plan.measurement_kinds {
        if matches!(kind, MeasurementKind::Stability)
            || series.iter().any(|item| &item.kind == kind)
        {
            continue;
        }
        series.push(missing_series(
            plan,
            kind.clone(),
            observation.domain_status.clone(),
            observation.observed_at.clone(),
        ));
    }

    let mut exclusions = calibration_exclusions(&plan.preflight);
    if observation.domain_status != DomainStatus::Completed {
        exclusions.push(format!(
            "m-j.calibration.run-status:{:?}",
            observation.domain_status
        ));
    }
    for item in &series {
        if item.completion != DomainStatus::Completed {
            exclusions.push(format!(
                "m-j.calibration.series-status:{:?}:{:?}",
                item.kind, item.completion
            ));
        }
        if item.stability != Stability::Stable && item.stability != Stability::NotApplicable {
            exclusions.push(format!("m-j.calibration.series-unstable:{:?}", item.kind));
        }
    }
    exclusions.sort();
    exclusions.dedup();
    Ok(BenchmarkResult {
        benchmark_result_id: observation.result_id.clone(),
        benchmark_plan_id: plan.benchmark_plan_id.clone(),
        candidate_id: plan.candidate_id.clone(),
        domain_status: observation.domain_status.clone(),
        series,
        calibration_eligible: exclusions.is_empty(),
        calibration_exclusions: exclusions,
        diagnostics: observation.diagnostics.clone(),
    })
}

pub fn quick_check_result(
    plan: &QuickCheckPlan,
    observation: &QuickCheckObservation,
) -> Result<QuickCheckResult, Vec<String>> {
    let mut issues = Vec::new();
    require_text(&observation.result_id, "quickCheckResultId", &mut issues);
    let mut seen = std::collections::HashSet::new();
    for item in &observation.checks {
        if !seen.insert(&item.check_id) {
            issues.push(format!("m-j.check.duplicate: {}", item.check_id));
        }
        if !plan
            .checks
            .iter()
            .any(|check| check.check_id == item.check_id)
        {
            issues.push(format!("m-j.check.unplanned: {}", item.check_id));
        }
        if item.explanation.trim().is_empty() {
            issues.push(format!("m-j.check.explanation-missing: {}", item.check_id));
        }
    }
    if observation.domain_status == DomainStatus::Completed
        && plan.checks.iter().any(|planned| {
            !observation
                .checks
                .iter()
                .any(|item| item.check_id == planned.check_id)
        })
    {
        issues.push("m-j.check.completed-missing-planned-check".into());
    }
    if !issues.is_empty() {
        return Err(issues);
    }

    let checks = plan
        .checks
        .iter()
        .map(|planned| {
            if let Some(item) = observation
                .checks
                .iter()
                .find(|item| item.check_id == planned.check_id)
            {
                QuickCheckOutcome {
                    check_id: planned.check_id.clone(),
                    criterion: planned.criterion.clone(),
                    status: if item.passed {
                        CheckStatus::Pass
                    } else {
                        CheckStatus::Fail
                    },
                    explanation: item.explanation.clone(),
                    local_diagnostics: item.local_diagnostics.clone(),
                    evidence: quick_evidence(plan, planned, observation.observed_at.clone(), true),
                }
            } else {
                QuickCheckOutcome {
                    check_id: planned.check_id.clone(),
                    criterion: planned.criterion.clone(),
                    status: CheckStatus::NotRun,
                    explanation: format!("m-j.check.not-run:{:?}", observation.domain_status),
                    local_diagnostics: None,
                    evidence: quick_evidence(plan, planned, observation.observed_at.clone(), false),
                }
            }
        })
        .collect();
    Ok(QuickCheckResult {
        quick_check_result_id: observation.result_id.clone(),
        quick_check_plan_id: plan.quick_check_plan_id.clone(),
        candidate_id: plan.candidate_id.clone(),
        domain_status: observation.domain_status.clone(),
        checks,
    })
}

pub fn verification_result(
    plan: &VerificationPlan,
    observation: &VerificationObservation,
) -> Result<VerificationResult, Vec<String>> {
    let mut issues = Vec::new();
    require_text(&observation.result_id, "verificationResultId", &mut issues);
    let benchmark = match (&plan.benchmark_plan, &observation.benchmark) {
        (Some(plan), Some(value)) => benchmark_result(plan, value)
            .map_err(|errors| issues.extend(errors))
            .ok(),
        (None, Some(_)) => {
            issues.push("m-j.result.unplanned-benchmark".into());
            None
        }
        (Some(_), None) => {
            issues.push("m-j.result.missing-benchmark".into());
            None
        }
        (None, None) => None,
    };
    let quick_check = match (&plan.quick_check_plan, &observation.quick_check) {
        (Some(plan), Some(value)) => quick_check_result(plan, value)
            .map_err(|errors| issues.extend(errors))
            .ok(),
        (None, Some(_)) => {
            issues.push("m-j.result.unplanned-quick-check".into());
            None
        }
        (Some(_), None) => {
            issues.push("m-j.result.missing-quick-check".into());
            None
        }
        (None, None) => None,
    };
    if !issues.is_empty() {
        return Err(issues);
    }
    let statuses = [
        benchmark.as_ref().map(|v| &v.domain_status),
        quick_check.as_ref().map(|v| &v.domain_status),
    ];
    let domain_status = statuses
        .into_iter()
        .flatten()
        .cloned()
        .fold(DomainStatus::Completed, worst_status);
    Ok(VerificationResult {
        verification_result_id: observation.result_id.clone(),
        verification_plan_id: plan.verification_plan_id.clone(),
        candidate_id: plan.candidate_id.clone(),
        domain_status,
        benchmark_result: benchmark,
        quick_check_result: quick_check,
    })
}

fn validate_benchmark(
    value: &BenchmarkPreparation,
    candidate: &ExactConfigurationCandidate,
    issues: &mut Vec<String>,
) {
    require_text(&value.plan_id, "benchmarkPlanId", issues);
    require_text(&value.protocol_id, "protocolId", issues);
    if value.measured_runs == 0 || value.measurement_kinds.is_empty() {
        issues
            .push("m-j.benchmark.protocol-incomplete: measured runs and kinds are required".into());
    }
    let mut kinds = std::collections::HashSet::new();
    if value
        .measurement_kinds
        .iter()
        .any(|kind| !kinds.insert(kind))
    {
        issues.push("m-j.benchmark.duplicate-measurement-kind".into());
    }
    validate_tool(
        &value.tool,
        ExistingToolKind::Benchmark,
        &candidate.runtime,
        issues,
    );
}

fn validate_quick_check(
    value: &QuickCheckPreparation,
    candidate: &ExactConfigurationCandidate,
    issues: &mut Vec<String>,
) {
    require_text(&value.plan_id, "quickCheckPlanId", issues);
    if value.checks.is_empty()
        || value
            .checks
            .iter()
            .any(|check| check.check_id.trim().is_empty() || check.criterion.trim().is_empty())
    {
        issues.push("m-j.quick-check.plan-incomplete: checks require ids and criteria".into());
    }
    let mut checks = std::collections::HashSet::new();
    if value
        .checks
        .iter()
        .any(|check| !checks.insert(&check.check_id))
    {
        issues.push("m-j.quick-check.duplicate-check-id".into());
    }
    validate_tool(
        &value.tool,
        ExistingToolKind::QuickCheck,
        &candidate.runtime,
        issues,
    );
}

fn validate_tool(
    value: &ObservedToolIdentityReceipt,
    expected_kind: ExistingToolKind,
    runtime: &RuntimeConfiguration,
    issues: &mut Vec<String>,
) {
    if value.kind != expected_kind {
        issues.push("m-j.tool.role-mismatch".into());
    }
    let expected_name = match expected_kind {
        ExistingToolKind::Benchmark => "llama-bench.exe",
        ExistingToolKind::QuickCheck => "llama-cli.exe",
    };
    let actual = value
        .path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();
    if !actual.eq_ignore_ascii_case(expected_name) {
        issues.push(format!(
            "m-j.tool.unsupported: expected user-selected {expected_name}"
        ));
    }
    require_text(&value.probe_protocol_id, "tool.probeProtocolId", issues);
    require_text(&value.observed_at, "tool.observedAt", issues);
    if value.observed_product != runtime.product
        || value.observed_engine != runtime.engine
        || value.observed_engine_build != runtime.engine_build.as_deref().unwrap_or_default()
        || value.observed_backend != runtime.backend
    {
        issues.push(
            "m-j.tool.runtime-mismatch: observed product/engine/build/backend differ from candidate".into(),
        );
    }
    validate_sha256(&value.expected_sha256, "tool", issues);
}

fn validate_runtime(runtime: &RuntimeConfiguration, issues: &mut Vec<String>) {
    require_text(
        &runtime.runtime_configuration_id,
        "runtimeConfigurationId",
        issues,
    );
    require_text(&runtime.product, "runtime.product", issues);
    require_text(&runtime.engine, "runtime.engine", issues);
    if runtime
        .engine_build
        .as_deref()
        .is_none_or(|value| value.trim().is_empty())
    {
        issues.push("m-j.runtime.build-unknown".into());
    }
    if runtime.context_tokens == 0 {
        issues.push("m-j.runtime.context-invalid".into());
    }
}

fn checked_tool(
    value: &ObservedToolIdentityReceipt,
    runtime: &RuntimeConfiguration,
    issues: &mut Vec<String>,
) -> Option<CheckedFileIdentity> {
    validate_tool(value, value.kind, runtime, issues);
    checked_identity(&value.path, &value.expected_sha256, "tool", issues)
}

fn checked_identity(
    path: &Path,
    expected: &str,
    label: &str,
    issues: &mut Vec<String>,
) -> Option<CheckedFileIdentity> {
    if !path.is_file() {
        issues.push(format!(
            "m-j.{label}.unavailable: selected path is not a file"
        ));
        return None;
    }
    match sha256_file(path) {
        Ok(actual) if actual == expected => Some(CheckedFileIdentity {
            path: path.to_path_buf(),
            sha256: actual,
        }),
        Ok(_) => {
            issues.push(format!("m-j.{label}.hash-mismatch"));
            None
        }
        Err(error) => {
            issues.push(format!("m-j.{label}.unreadable:{error}"));
            None
        }
    }
}

fn sha256_file(path: &Path) -> Result<String, std::io::Error> {
    let mut file = File::open(path)?;
    let mut digest = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let count = file.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        digest.update(&buffer[..count]);
    }
    Ok(format!("{:x}", digest.finalize()))
}

fn validate_sha256(value: &str, label: &str, issues: &mut Vec<String>) {
    if value.len() != SHA256_HEX_LENGTH
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
    {
        issues.push(format!(
            "m-j.{label}.hash-invalid: lowercase SHA-256 required"
        ));
    }
}

fn local_execution_side_effects() -> SideEffects {
    SideEffects {
        executes_local_process: true,
        loads_model: true,
        writes_model_store: false,
        network: false,
        upload: false,
    }
}

fn normalized_series(
    plan: &BenchmarkPlan,
    value: &SeriesObservation,
    observed_at: Option<String>,
) -> MeasurementSeries {
    let aggregate = aggregate(&value.measured_samples);
    let stability = stability(&value.measured_samples, &value.completion);
    let interval = aggregate.as_ref().map(|value| Interval {
        lower: value.minimum,
        upper: value.maximum,
    });
    MeasurementSeries {
        kind: value.kind.clone(),
        unit: value.unit.clone(),
        warmup_samples: value.warmup_samples.clone(),
        measured_samples: value.measured_samples.clone(),
        aggregate,
        completion: value.completion.clone(),
        stability: stability.clone(),
        evidence: measurement_evidence(
            plan,
            &value.kind,
            value.unit.clone(),
            observed_at,
            value.measured_samples.len() as u64,
            interval,
            stability == Stability::Stable,
        ),
    }
}

fn missing_series(
    plan: &BenchmarkPlan,
    kind: MeasurementKind,
    status: DomainStatus,
    observed_at: Option<String>,
) -> MeasurementSeries {
    let unit = match kind {
        MeasurementKind::PromptProcessing | MeasurementKind::Generation => {
            MeasurementUnit::TokensPerSecond
        }
        MeasurementKind::TimeToFirstToken => MeasurementUnit::Milliseconds,
        MeasurementKind::Memory => MeasurementUnit::Bytes,
        MeasurementKind::Stability => MeasurementUnit::Boolean,
    };
    MeasurementSeries {
        kind: kind.clone(),
        unit: unit.clone(),
        warmup_samples: vec![],
        measured_samples: vec![],
        aggregate: None,
        completion: status,
        stability: Stability::InsufficientSamples,
        evidence: measurement_evidence(plan, &kind, unit, observed_at, 0, None, false),
    }
}

fn measurement_evidence(
    plan: &BenchmarkPlan,
    kind: &MeasurementKind,
    unit: MeasurementUnit,
    observed_at: Option<String>,
    count: u64,
    interval: Option<Interval>,
    eligible: bool,
) -> Provenance {
    Provenance {
        source: Source {
            id: "local-existing-engine".into(),
            version: plan.runtime.engine_build.clone(),
            revision: None,
            url: None,
        },
        retrieved_at: None,
        observed_at,
        method: ProvenanceMethod::Measurement,
        hardware_match: HardwareMatch::Exact,
        configuration_match: crate::contracts::ConfigurationMatch::Exact,
        scope: ProvenanceScope {
            task_family: None,
            task_pack_id: None,
            prompt_id: None,
            harness_id: Some(plan.protocol_id.clone()),
        },
        sample_count: Some(count),
        measurement: Some(ProvenanceMeasurement {
            unit,
            interval,
            confidence: None,
            eligible: Some(eligible),
            eligibility_reasons: if eligible {
                vec![]
            } else {
                vec![format!("m-j.evidence.not-eligible:{kind:?}")]
            },
        }),
        raw_source_record_ref: Some(format!("local://{}/{kind:?}", plan.benchmark_plan_id)),
    }
}

fn quick_evidence(
    plan: &QuickCheckPlan,
    check: &QuickCheck,
    observed_at: Option<String>,
    ran: bool,
) -> Provenance {
    Provenance {
        source: Source {
            id: "local-existing-engine".into(),
            version: plan.runtime.engine_build.clone(),
            revision: None,
            url: None,
        },
        retrieved_at: None,
        observed_at,
        method: ProvenanceMethod::ObjectiveCheck,
        hardware_match: HardwareMatch::Exact,
        configuration_match: crate::contracts::ConfigurationMatch::Exact,
        scope: ProvenanceScope {
            task_family: None,
            task_pack_id: Some("quick-check-v1".into()),
            prompt_id: Some(check.check_id.clone()),
            harness_id: Some("existing-llama-cli-v1".into()),
        },
        sample_count: Some(u64::from(ran)),
        measurement: Some(ProvenanceMeasurement {
            unit: MeasurementUnit::Boolean,
            interval: None,
            confidence: None,
            eligible: Some(ran),
            eligibility_reasons: if ran {
                vec![]
            } else {
                vec!["m-j.check.not-run".into()]
            },
        }),
        raw_source_record_ref: Some(format!(
            "local://{}/{}",
            plan.quick_check_plan_id, check.check_id
        )),
    }
}

fn aggregate(samples: &[f64]) -> Option<Aggregate> {
    if samples.is_empty() {
        return None;
    }
    let mut sorted = samples.to_vec();
    sorted.sort_by(f64::total_cmp);
    Some(Aggregate {
        minimum: sorted[0],
        maximum: sorted[sorted.len() - 1],
        median: sorted[sorted.len() / 2],
    })
}

fn stability(samples: &[f64], status: &DomainStatus) -> Stability {
    if status != &DomainStatus::Completed || samples.len() < 3 {
        return Stability::InsufficientSamples;
    }
    let aggregate = aggregate(samples).expect("nonempty");
    if aggregate.median <= 0.0 {
        return Stability::Unstable;
    }
    if (aggregate.maximum - aggregate.minimum) / aggregate.median <= MAX_STABLE_RELATIVE_RANGE {
        Stability::Stable
    } else {
        Stability::Unstable
    }
}

fn validate_samples(plan: &BenchmarkPlan, value: &SeriesObservation, issues: &mut Vec<String>) {
    if value
        .warmup_samples
        .iter()
        .chain(&value.measured_samples)
        .any(|sample| !sample.is_finite() || *sample < 0.0)
    {
        issues.push(format!("m-j.series.invalid-sample:{:?}", value.kind));
    }
    let warmups = value.warmup_samples.len() as u64;
    let measured = value.measured_samples.len() as u64;
    if value.completion == DomainStatus::Completed {
        if warmups != plan.warmup_runs || measured != plan.measured_runs {
            issues.push(format!(
                "m-j.series.completed-sample-count:{:?}",
                value.kind
            ));
        }
    } else if warmups > plan.warmup_runs || measured > plan.measured_runs {
        issues.push(format!(
            "m-j.series.partial-sample-count-exceeds-plan:{:?}",
            value.kind
        ));
    }
}

fn reject_duplicate_series(values: &[SeriesObservation], issues: &mut Vec<String>) {
    let mut seen = std::collections::HashSet::new();
    for value in values {
        if !seen.insert(value.kind.clone()) {
            issues.push(format!("m-j.series.duplicate:{:?}", value.kind));
        }
    }
}

fn calibration_exclusions(preflight: &Preflight) -> Vec<String> {
    let mut values = Vec::new();
    if preflight.power != Power::Ac {
        values.push(format!("m-j.calibration.power:{:?}", preflight.power));
    }
    if preflight.thermal != Thermal::Acceptable {
        values.push(format!("m-j.calibration.thermal:{:?}", preflight.thermal));
    }
    if preflight.concurrent_gpu != ConcurrentGpu::Idle {
        values.push(format!(
            "m-j.calibration.concurrent-gpu:{:?}",
            preflight.concurrent_gpu
        ));
    }
    if preflight.requires_confirmation {
        values.push("m-j.calibration.adverse-confirmation-required".into());
    }
    values
}

fn worst_status(left: DomainStatus, right: DomainStatus) -> DomainStatus {
    fn severity(value: &DomainStatus) -> u8 {
        match value {
            DomainStatus::Completed => 0,
            DomainStatus::Stopped => 1,
            DomainStatus::Cancelled => 2,
            DomainStatus::Failed => 3,
            DomainStatus::TimedOut => 4,
            DomainStatus::Oom => 5,
        }
    }
    if severity(&right) > severity(&left) {
        right
    } else {
        left
    }
}

fn require_text(value: &str, field: &str, issues: &mut Vec<String>) {
    if value.trim().is_empty() {
        issues.push(format!("m-j.field.missing:{field}"));
    }
}

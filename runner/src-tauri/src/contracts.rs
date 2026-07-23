//! M-A v1 wire contracts. This module has no Tauri command and performs no I/O.
//! It is intentionally independent from the runner's current execution DTOs.

use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use url::Url;

pub const SCHEMA_VERSION: u64 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Provenance {
    pub source: Source,
    pub retrieved_at: Option<String>,
    pub observed_at: Option<String>,
    pub method: ProvenanceMethod,
    pub hardware_match: HardwareMatch,
    pub configuration_match: ConfigurationMatch,
    pub scope: ProvenanceScope,
    pub sample_count: Option<u64>,
    pub measurement: Option<ProvenanceMeasurement>,
    pub raw_source_record_ref: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Source {
    pub id: String,
    pub version: Option<String>,
    pub revision: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum ProvenanceMethod {
    Estimate,
    Measurement,
    Preference,
    ObjectiveCheck,
    SelfReported,
    Detected,
    Imported,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum HardwareMatch {
    Exact,
    CalibratedNeighbor,
    CoarseBucket,
    NotApplicable,
    Unknown,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum ConfigurationMatch {
    Exact,
    Compatible,
    FamilyProxy,
    NotApplicable,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProvenanceScope {
    pub task_family: Option<String>,
    pub task_pack_id: Option<String>,
    pub prompt_id: Option<String>,
    pub harness_id: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProvenanceMeasurement {
    pub unit: MeasurementUnit,
    pub interval: Option<Interval>,
    pub confidence: Option<f64>,
    pub eligible: Option<bool>,
    pub eligibility_reasons: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Interval {
    pub lower: f64,
    pub upper: f64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum MeasurementUnit {
    Bytes,
    TokensPerSecond,
    Milliseconds,
    Probability,
    Joules,
    Boolean,
    Count,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HardwareTarget {
    pub hardware_target_id: String,
    pub os: Os,
    pub cpu: Cpu,
    pub memory: Memory,
    pub accelerators: Vec<Accelerator>,
    pub field_origins: std::collections::BTreeMap<String, Origin>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Os {
    pub family: OsFamily,
    pub version: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum OsFamily {
    Windows,
    Macos,
    Linux,
    Other,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Cpu {
    pub display_name: Option<String>,
    pub logical_cores: Option<u64>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Memory {
    pub total_ram_bytes: u64,
    pub available_ram_bytes: Option<u64>,
    pub unified: Option<bool>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Accelerator {
    pub accelerator_id: Option<String>,
    pub display_name: String,
    pub kind: AcceleratorVendor,
    pub vendor: AcceleratorVendor,
    pub backend: AcceleratorBackend,
    pub device_memory_bytes: Option<u64>,
    pub count: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AcceleratorVendor {
    Nvidia,
    Amd,
    Apple,
    Intel,
    Cpu,
    Other,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AcceleratorBackend {
    Cuda,
    Rocm,
    Metal,
    Vulkan,
    Cpu,
    Other,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum Origin {
    Detected,
    SelfReported,
    Imported,
    Confirmed,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RecommendationRequest {
    pub request_id: String,
    pub hardware_target_id: String,
    pub task: TaskTarget,
    pub preferences: Preferences,
    pub advanced: AdvancedPreferences,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TaskTarget {
    pub family: TaskFamily,
    pub interaction_style: InteractionStyle,
    pub scope_label: String,
    pub derived_context_tokens: u64,
    pub needs: Vec<Need>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TaskFamily {
    Coding,
    Writing,
    Extraction,
    General,
    Other,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum InteractionStyle {
    Interactive,
    Batch,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum Need {
    ToolUse,
    StructuredOutput,
    Vision,
    Embeddings,
    Offline,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Preferences {
    pub priority: Priority,
    pub allow_cpu_offload: bool,
    pub installed_only: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum Priority {
    Balanced,
    Quality,
    Speed,
    LongContext,
    Lightest,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AdvancedPreferences {
    pub forced_runtime: Option<String>,
    pub maximum_artifact_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RuntimeConfiguration {
    pub runtime_configuration_id: String,
    pub product: String,
    pub engine: String,
    pub engine_build: Option<String>,
    pub backend: AcceleratorBackend,
    pub chat_template: Option<String>,
    pub context_tokens: u64,
    pub kv_cache: KvCache,
    pub gpu_layers: Option<GpuLayers>,
    pub batch_size: Option<u64>,
    pub micro_batch_size: Option<u64>,
    pub parallelism: Option<u64>,
    pub threads: Option<u64>,
    pub flash_attention: Option<bool>,
    pub mmap: Option<bool>,
    pub sampler: Sampler,
    pub additional_flags: Vec<RuntimeFlag>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum GpuLayers {
    Count(u64),
    All(GpuLayersAll),
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum GpuLayersAll {
    #[serde(rename = "all")]
    All,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct KvCache {
    pub key: Option<String>,
    pub value: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Sampler {
    pub temperature: Option<f64>,
    pub top_p: Option<f64>,
    pub top_k: Option<u64>,
    pub min_p: Option<f64>,
    pub seed: Option<i64>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct RuntimeFlag {
    pub name: String,
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ExactConfigurationCandidate {
    pub candidate_id: String,
    pub model_family: ModelFamily,
    pub artifact: Artifact,
    pub runtime: RuntimeConfiguration,
    pub provenance: Vec<Provenance>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CompatibilityAdmissionReceipt {
    pub compatibility_admission_id: String,
    pub receipt_version: u64,
    pub policy: CompatibilityAdmissionPolicy,
    pub candidate_id: String,
    pub artifact_id: String,
    pub artifact_sha256: String,
    pub runtime_configuration_id: String,
    pub decision: CompatibilityAdmissionDecision,
    pub target: CompatibilityAdmissionTarget,
    pub assertion: CompatibilityAdmissionAssertion,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct CompatibilityAdmissionPolicy {
    pub id: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CompatibilityAdmissionDecision {
    Admitted,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CpuArchitecture {
    X86_64,
    Aarch64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum ArtifactPackageLayout {
    GgufSingle,
    GgufSplit,
    HfTransformers,
    MlxLm,
    MlxSwiftLm,
    OllamaPackage,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CompatibilityAdmissionTarget {
    pub product: String,
    pub engine: String,
    pub engine_build: String,
    pub runtime_version: Option<String>,
    pub exact_build: Option<String>,
    pub operating_system: OsFamily,
    pub cpu_architecture: CpuArchitecture,
    pub backend: AcceleratorBackend,
    pub feature_flags: Vec<String>,
    pub package_layout: ArtifactPackageLayout,
    pub declared_package_files: Vec<String>,
    pub model_architecture: Option<String>,
    pub quantization_scheme: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum CompatibilityAssertionStatus {
    Verified,
    Documented,
    Experimental,
    Inferred,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CompatibilityAdmissionAssertion {
    pub artifact_id: String,
    pub product_id: String,
    pub engine_id: String,
    pub status: CompatibilityAssertionStatus,
    pub runtime_constraint: CompatibilityRuntimeConstraint,
    pub conditions: CompatibilityAdmissionConditions,
    pub evidence: Vec<CompatibilityAdmissionEvidence>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CompatibilityRuntimeConstraint {
    pub min_version: Option<String>,
    pub max_version: Option<String>,
    pub exact_build: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CompatibilityAdmissionConditions {
    pub operating_systems: Option<Vec<String>>,
    pub cpu_architectures: Option<Vec<String>>,
    pub backends: Option<Vec<String>>,
    pub model_architectures: Option<Vec<String>>,
    pub package_layouts: Option<Vec<String>>,
    pub quantization_schemes: Option<Vec<String>>,
    pub required_files: Option<Vec<String>>,
    pub limitations: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CompatibilityAdmissionEvidence {
    pub url: String,
    pub checked_at: String,
    pub source_revision: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ModelFamily {
    pub model_family_id: String,
    pub display_name: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Artifact {
    pub artifact_id: String,
    pub repository: String,
    pub revision: String,
    pub filename: String,
    pub sha256: String,
    pub bytes: u64,
    pub format: String,
    pub quantization: String,
    pub license: String,
    pub status: ArtifactStatus,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ArtifactStatus {
    Promoted,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FitEvidenceAssessment {
    pub assessment_id: String,
    pub candidate_id: String,
    pub hardware_target_id: String,
    pub fit: Fit,
    pub run_path: RunPath,
    pub memory_pools: MemoryPools,
    pub performance: Performance,
    pub evidence: EvidenceGroups,
    pub blocking_reasons: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum Fit {
    Good,
    Tight,
    DoesNotFit,
    Unknown,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum RunPath {
    Gpu,
    CpuOffload,
    Cpu,
    Unknown,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct MemoryPools {
    pub device: MemoryPool,
    pub host: MemoryPool,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MemoryPool {
    pub model_bytes: u64,
    pub context_bytes: u64,
    pub compute_bytes: u64,
    pub reserve_bytes: u64,
    pub margin_bytes: u64,
    pub required_bytes: u64,
    pub available_bytes: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Performance {
    pub prompt_tokens_per_second: Option<Range>,
    pub generation_tokens_per_second: Option<Range>,
    pub time_to_first_token_ms: Option<Range>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Range {
    pub low: f64,
    pub high: f64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EvidenceGroups {
    pub fit: Vec<Provenance>,
    pub prompt_speed: Vec<Provenance>,
    pub generation_speed: Vec<Provenance>,
    pub time_to_first_token: Vec<Provenance>,
    pub task_quality: Vec<Provenance>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RecommendationPortfolio {
    pub request_id: String,
    pub outcome: PortfolioOutcome,
    pub message: String,
    pub items: Vec<PortfolioItem>,
    pub methodology_version: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum PortfolioOutcome {
    Ranked,
    UnrankedCompatible,
    ContradictoryPreferences,
    NothingFits,
    CoverageGap,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PortfolioItem {
    pub role: Option<PortfolioRole>,
    pub model_family_id: String,
    pub candidate_id: String,
    pub assessment_id: String,
    pub why: Vec<String>,
    pub caveats: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum PortfolioRole {
    PrimaryMatch,
    QualityOption,
    FastOption,
    LongContextOption,
    MemoryEfficientOption,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RunnerHandoff {
    pub handoff_id: String,
    pub schema_version: u64,
    pub created_at: String,
    pub expires_at: String,
    pub content_hash: String,
    pub recommendation_request: RecommendationRequest,
    pub hardware_target: HardwareTarget,
    pub selected_candidate: ExactConfigurationCandidate,
    pub evidence_summary: FitEvidenceAssessment,
    pub contains_model_data: bool,
    pub side_effect_authorization: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RunnerImportBundle {
    pub import_bundle_version: u64,
    pub content_hash: String,
    pub handoff: RunnerHandoff,
    pub compatibility_admission: CompatibilityAdmissionReceipt,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Preflight {
    pub power: Power,
    pub thermal: Thermal,
    pub concurrent_gpu: ConcurrentGpu,
    pub requires_confirmation: bool,
    pub conditions: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Power {
    Ac,
    Battery,
    Unknown,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Thermal {
    Acceptable,
    Adverse,
    Unknown,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ConcurrentGpu {
    Idle,
    Active,
    Unknown,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SideEffects {
    pub executes_local_process: bool,
    pub loads_model: bool,
    pub writes_model_store: bool,
    pub network: bool,
    pub upload: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BenchmarkPlan {
    pub benchmark_plan_id: String,
    pub candidate_id: String,
    pub artifact_path: String,
    pub expected_artifact_sha256: String,
    pub runtime: RuntimeConfiguration,
    pub protocol_id: String,
    pub warmup_runs: u64,
    pub measured_runs: u64,
    pub measurement_kinds: Vec<MeasurementKind>,
    pub preflight: Preflight,
    pub side_effects: SideEffects,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum MeasurementKind {
    PromptProcessing,
    Generation,
    TimeToFirstToken,
    Memory,
    Stability,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct QuickCheckPlan {
    pub quick_check_plan_id: String,
    pub candidate_id: String,
    pub artifact_path: String,
    pub expected_artifact_sha256: String,
    pub runtime: RuntimeConfiguration,
    pub checks: Vec<QuickCheck>,
    pub preflight: Preflight,
    pub side_effects: SideEffects,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct QuickCheck {
    pub check_id: String,
    pub criterion: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VerificationPlan {
    pub verification_plan_id: String,
    pub hardware_target_id: String,
    pub candidate_id: String,
    pub benchmark_plan: Option<BenchmarkPlan>,
    pub quick_check_plan: Option<QuickCheckPlan>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MeasurementSeries {
    pub kind: MeasurementKind,
    pub unit: MeasurementUnit,
    pub warmup_samples: Vec<f64>,
    pub measured_samples: Vec<f64>,
    pub aggregate: Option<Aggregate>,
    pub completion: DomainStatus,
    pub stability: Stability,
    pub evidence: Provenance,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Aggregate {
    pub minimum: f64,
    pub maximum: f64,
    pub median: f64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum DomainStatus {
    Completed,
    Failed,
    TimedOut,
    Cancelled,
    Oom,
    Stopped,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum Stability {
    Stable,
    Unstable,
    InsufficientSamples,
    NotApplicable,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BenchmarkResult {
    pub benchmark_result_id: String,
    pub benchmark_plan_id: String,
    pub candidate_id: String,
    pub domain_status: DomainStatus,
    pub series: Vec<MeasurementSeries>,
    pub calibration_eligible: bool,
    pub calibration_exclusions: Vec<String>,
    pub diagnostics: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct QuickCheckResult {
    pub quick_check_result_id: String,
    pub quick_check_plan_id: String,
    pub candidate_id: String,
    pub domain_status: DomainStatus,
    pub checks: Vec<QuickCheckOutcome>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct QuickCheckOutcome {
    pub check_id: String,
    pub criterion: String,
    pub status: CheckStatus,
    pub explanation: String,
    pub local_diagnostics: Option<String>,
    pub evidence: Provenance,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum CheckStatus {
    Pass,
    Fail,
    NotRun,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VerificationResult {
    pub verification_result_id: String,
    pub verification_plan_id: String,
    pub candidate_id: String,
    pub domain_status: DomainStatus,
    pub benchmark_result: Option<BenchmarkResult>,
    pub quick_check_result: Option<QuickCheckResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Completeness {
    pub complete: bool,
    pub missing: Vec<String>,
    pub warnings: Vec<String>,
    pub recoverable_actions: Vec<String>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct TypedEnvelope {
    schema_version: u64,
    contract: String,
    status: String,
    data: Value,
    provenance: Vec<Provenance>,
    completeness: Completeness,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct NonDataEnvelope {
    schema_version: u64,
    contract: String,
    status: String,
    reason_code: String,
    message: String,
    recoverable_actions: Vec<String>,
    provenance: Vec<Provenance>,
    warnings: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ValidatedContract {
    pub contract: String,
    pub status: String,
    pub data: Option<Value>,
}

const CONTRACTS: &[&str] = &[
    "hardware-target",
    "recommendation-request",
    "exact-configuration-candidate",
    "fit-evidence-assessment",
    "recommendation-portfolio",
    "runner-handoff",
    "benchmark-plan",
    "benchmark-result",
    "quick-check-plan",
    "quick-check-result",
    "verification-plan",
    "verification-result",
    "compatibility-admission-receipt",
    "runner-import-bundle",
];

fn decode<T: DeserializeOwned>(value: &Value) -> Result<T, String> {
    serde_json::from_value(value.clone()).map_err(|error| error.to_string())
}
fn nonempty(value: &str, field: &str) -> Result<(), String> {
    if value.is_empty() {
        Err(format!("{field} must not be empty"))
    } else {
        Ok(())
    }
}
fn hash(value: &str, field: &str) -> Result<(), String> {
    if value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
    {
        Ok(())
    } else {
        Err(format!("{field} must be a lowercase SHA-256"))
    }
}

pub fn validate_contract_json(json: &str) -> Result<ValidatedContract, Vec<String>> {
    let value: Value = serde_json::from_str(json).map_err(|error| vec![error.to_string()])?;
    let version = value.get("schemaVersion").and_then(Value::as_u64);
    if version != Some(SCHEMA_VERSION) {
        return Err(vec!["unsupported schemaVersion".into()]);
    }
    let contract = value.get("contract").and_then(Value::as_str).unwrap_or("");
    if !CONTRACTS.contains(&contract) {
        return Err(vec!["unknown contract".into()]);
    }
    let status = value.get("status").and_then(Value::as_str).unwrap_or("");
    if matches!(status, "unavailable" | "blocked" | "error") {
        let envelope: NonDataEnvelope =
            serde_json::from_value(value).map_err(|error| vec![error.to_string()])?;
        nonempty(&envelope.reason_code, "reasonCode").map_err(|error| vec![error])?;
        nonempty(&envelope.message, "message").map_err(|error| vec![error])?;
        let _ = (
            envelope.schema_version,
            envelope.recoverable_actions,
            envelope.provenance,
            envelope.warnings,
        );
        return Ok(ValidatedContract {
            contract: envelope.contract,
            status: envelope.status,
            data: None,
        });
    }
    if !matches!(status, "ok" | "partial") {
        return Err(vec!["unknown status".into()]);
    }
    let envelope: TypedEnvelope =
        serde_json::from_value(value).map_err(|error| vec![error.to_string()])?;
    if envelope.status == "ok"
        && (!envelope.completeness.complete || !envelope.completeness.missing.is_empty())
    {
        return Err(vec!["ok envelope must be complete".into()]);
    }
    if envelope.status == "partial"
        && (envelope.completeness.complete || envelope.completeness.missing.is_empty())
    {
        return Err(vec!["partial envelope must identify missing fields".into()]);
    }
    validate_data(&envelope.contract, &envelope.data).map_err(|error| vec![error])?;
    let _ = (envelope.schema_version, envelope.provenance);
    Ok(ValidatedContract {
        contract: envelope.contract,
        status: envelope.status,
        data: Some(envelope.data),
    })
}

fn validate_data(contract: &str, value: &Value) -> Result<(), String> {
    match contract {
        "hardware-target" => {
            let item: HardwareTarget = decode(value)?;
            nonempty(&item.hardware_target_id, "hardwareTargetId")?;
            if item.memory.total_ram_bytes == 0
                || item
                    .accelerators
                    .iter()
                    .any(|a| a.count == 0 || a.device_memory_bytes == Some(0))
            {
                return Err("hardware numeric values are out of range".into());
            }
        }
        "recommendation-request" => {
            let item: RecommendationRequest = decode(value)?;
            nonempty(&item.request_id, "requestId")?;
            if item.task.derived_context_tokens == 0
                || item.task.needs.iter().collect::<HashSet<_>>().len() != item.task.needs.len()
            {
                return Err("request values are out of range or duplicated".into());
            }
        }
        "exact-configuration-candidate" => {
            let item: ExactConfigurationCandidate = decode(value)?;
            hash(&item.artifact.sha256, "artifact.sha256")?;
            validate_runtime(&item.runtime)?;
            if item.artifact.bytes == 0 || item.provenance.is_empty() {
                return Err("candidate values are out of range".into());
            }
        }
        "compatibility-admission-receipt" => {
            let item: CompatibilityAdmissionReceipt = decode(value)?;
            validate_compatibility_admission_receipt(&item)?;
        }
        "fit-evidence-assessment" => {
            let _: FitEvidenceAssessment = decode(value)?;
        }
        "recommendation-portfolio" => {
            let item: RecommendationPortfolio = decode(value)?;
            if item.items.len() > 5
                || item
                    .items
                    .iter()
                    .map(|i| &i.model_family_id)
                    .collect::<HashSet<_>>()
                    .len()
                    != item.items.len()
            {
                return Err("portfolio families must be distinct and limited to five".into());
            }
            match item.outcome {
                PortfolioOutcome::Ranked
                    if item.items.is_empty() || item.items.iter().any(|i| i.role.is_none()) =>
                {
                    return Err("ranked portfolio requires roles".into())
                }
                PortfolioOutcome::NothingFits | PortfolioOutcome::CoverageGap
                    if !item.items.is_empty() =>
                {
                    return Err("empty outcome must have no items".into())
                }
                PortfolioOutcome::UnrankedCompatible
                | PortfolioOutcome::ContradictoryPreferences
                    if item.items.iter().any(|i| i.role.is_some()) =>
                {
                    return Err("unranked portfolio cannot have roles".into())
                }
                _ => {}
            }
        }
        "runner-handoff" => {
            let item: RunnerHandoff = decode(value)?;
            validate_runner_handoff(&item, value)?;
        }
        "runner-import-bundle" => {
            let item: RunnerImportBundle = decode(value)?;
            if item.import_bundle_version != 1 {
                return Err("runner import bundle version is unsupported".into());
            }
            let handoff_value = value
                .get("handoff")
                .ok_or_else(|| "runner import bundle must contain handoff".to_string())?;
            validate_runner_handoff(&item.handoff, handoff_value)?;
            validate_compatibility_admission_receipt(&item.compatibility_admission)?;
            validate_runner_import_bundle(&item, value)?;
        }
        "benchmark-plan" => {
            let item: BenchmarkPlan = decode(value)?;
            hash(&item.expected_artifact_sha256, "expectedArtifactSha256")?;
            validate_runtime(&item.runtime)?;
            validate_side_effects(&item.side_effects)?;
            if item.measured_runs == 0
                || item.measurement_kinds.is_empty()
                || item.measurement_kinds.iter().collect::<HashSet<_>>().len()
                    != item.measurement_kinds.len()
            {
                return Err("benchmark plan values are out of range or duplicated".into());
            }
        }
        "benchmark-result" => {
            let item: BenchmarkResult = decode(value)?;
            validate_measurement_series(&item.series)?;
        }
        "quick-check-plan" => {
            let item: QuickCheckPlan = decode(value)?;
            hash(&item.expected_artifact_sha256, "expectedArtifactSha256")?;
            validate_runtime(&item.runtime)?;
            validate_side_effects(&item.side_effects)?;
            if item.checks.is_empty() {
                return Err("quick check plan requires checks".into());
            }
        }
        "quick-check-result" => {
            let _: QuickCheckResult = decode(value)?;
        }
        "verification-plan" => {
            let item: VerificationPlan = decode(value)?;
            if item.benchmark_plan.is_none() && item.quick_check_plan.is_none() {
                return Err("verification plan requires a typed plan".into());
            }
            for candidate_id in [
                item.benchmark_plan.as_ref().map(|plan| &plan.candidate_id),
                item.quick_check_plan
                    .as_ref()
                    .map(|plan| &plan.candidate_id),
            ]
            .into_iter()
            .flatten()
            {
                if candidate_id != &item.candidate_id {
                    return Err("verification plan candidateId mismatch".into());
                }
            }
            if let (Some(benchmark), Some(quick)) = (&item.benchmark_plan, &item.quick_check_plan) {
                if benchmark.artifact_path != quick.artifact_path
                    || benchmark.expected_artifact_sha256 != quick.expected_artifact_sha256
                {
                    return Err("verification plan artifact identity mismatch".into());
                }
                if benchmark.runtime.runtime_configuration_id
                    == quick.runtime.runtime_configuration_id
                    && benchmark.runtime != quick.runtime
                {
                    return Err(
                        "one runtimeConfigurationId cannot identify different runtime values"
                            .into(),
                    );
                }
            }
        }
        "verification-result" => {
            let item: VerificationResult = decode(value)?;
            if item.domain_status == DomainStatus::Completed
                && item.benchmark_result.is_none()
                && item.quick_check_result.is_none()
            {
                return Err("completed verification requires a typed result".into());
            }
            for candidate_id in [
                item.benchmark_result
                    .as_ref()
                    .map(|result| &result.candidate_id),
                item.quick_check_result
                    .as_ref()
                    .map(|result| &result.candidate_id),
            ]
            .into_iter()
            .flatten()
            {
                if candidate_id != &item.candidate_id {
                    return Err("verification result candidateId mismatch".into());
                }
            }
            if item.domain_status == DomainStatus::Completed
                && [
                    item.benchmark_result
                        .as_ref()
                        .map(|result| &result.domain_status),
                    item.quick_check_result
                        .as_ref()
                        .map(|result| &result.domain_status),
                ]
                .into_iter()
                .flatten()
                .any(|status| status != &DomainStatus::Completed)
            {
                return Err("completed verification contains incomplete nested result".into());
            }
            if let Some(benchmark) = item.benchmark_result {
                validate_measurement_series(&benchmark.series)?;
            }
        }
        _ => return Err("unknown contract".into()),
    }
    Ok(())
}

fn validate_runner_handoff(item: &RunnerHandoff, value: &Value) -> Result<(), String> {
    hash(&item.content_hash, "contentHash")?;
    if item.schema_version != 1 || item.contains_model_data || item.side_effect_authorization {
        return Err("handoff safety constants do not match v1".into());
    }
    if seconds(&item.expires_at)? - seconds(&item.created_at)? != 86_400 {
        return Err("handoff expiry must be exactly 24 hours".into());
    }
    let mut snapshot = value.clone();
    snapshot
        .as_object_mut()
        .ok_or_else(|| "handoff must be an object".to_string())?
        .remove("contentHash");
    if sha256_hex(canonical_json(&snapshot).as_bytes()) != item.content_hash {
        return Err("handoff contentHash mismatch".into());
    }
    Ok(())
}

fn validate_runner_import_bundle(bundle: &RunnerImportBundle, value: &Value) -> Result<(), String> {
    hash(&bundle.content_hash, "contentHash")?;
    let mut snapshot = value.clone();
    snapshot
        .as_object_mut()
        .ok_or_else(|| "runner import bundle must be an object".to_string())?
        .remove("contentHash");
    if sha256_hex(canonical_json(&snapshot).as_bytes()) != bundle.content_hash {
        return Err("runner import bundle contentHash mismatch".into());
    }
    let candidate = &bundle.handoff.selected_candidate;
    let receipt = &bundle.compatibility_admission;
    if receipt.candidate_id != candidate.candidate_id
        || receipt.artifact_id != candidate.artifact.artifact_id
        || receipt.artifact_sha256 != candidate.artifact.sha256
        || receipt.runtime_configuration_id != candidate.runtime.runtime_configuration_id
        || receipt.target.product != candidate.runtime.product
        || receipt.target.engine != candidate.runtime.engine
        || Some(receipt.target.engine_build.as_str()) != candidate.runtime.engine_build.as_deref()
        || receipt.target.operating_system != bundle.handoff.hardware_target.os.family
        || receipt.target.backend != candidate.runtime.backend
        || receipt.target.quantization_scheme != candidate.artifact.quantization
    {
        return Err(
            "runner import compatibility receipt does not match the handoff snapshot".into(),
        );
    }
    Ok(())
}

pub fn validate_compatibility_admission_receipt(
    receipt: &CompatibilityAdmissionReceipt,
) -> Result<(), String> {
    nonempty(
        &receipt.compatibility_admission_id,
        "compatibilityAdmissionId",
    )?;
    nonempty(&receipt.candidate_id, "candidateId")?;
    nonempty(&receipt.artifact_id, "artifactId")?;
    hash(&receipt.artifact_sha256, "artifactSha256")?;
    nonempty(&receipt.runtime_configuration_id, "runtimeConfigurationId")?;
    if receipt.receipt_version != 1
        || receipt.policy.id != "m-e.compatibility"
        || receipt.policy.version != "1"
    {
        return Err("compatibility receipt version or policy is unsupported".into());
    }
    let target = &receipt.target;
    for (value, field) in [
        (&target.product, "target.product"),
        (&target.engine, "target.engine"),
        (&target.engine_build, "target.engineBuild"),
        (&target.quantization_scheme, "target.quantizationScheme"),
    ] {
        nonempty(value, field)?;
    }
    if target.runtime_version.as_deref().is_some_and(str::is_empty)
        || target.exact_build.as_deref().is_some_and(str::is_empty)
        || target
            .model_architecture
            .as_deref()
            .is_some_and(str::is_empty)
        || target.feature_flags.iter().any(String::is_empty)
        || target.declared_package_files.is_empty()
        || target.declared_package_files.iter().any(String::is_empty)
    {
        return Err("compatibility target contains an empty required value".into());
    }
    if target.feature_flags.iter().collect::<HashSet<_>>().len() != target.feature_flags.len()
        || target
            .declared_package_files
            .iter()
            .collect::<HashSet<_>>()
            .len()
            != target.declared_package_files.len()
    {
        return Err("compatibility target arrays must be unique".into());
    }
    if target.declared_package_files.iter().any(|file| {
        file.starts_with('/')
            || file.contains('\\')
            || file.split('/').any(|part| part == "..")
            || (file.len() > 1 && file.as_bytes()[1] == b':')
    }) {
        return Err("declared package files must be normalized relative members".into());
    }
    if target
        .exact_build
        .as_deref()
        .or(target.runtime_version.as_deref())
        != Some(target.engine_build.as_str())
    {
        return Err("compatibility target build identity must match engineBuild".into());
    }

    let assertion = &receipt.assertion;
    if assertion.artifact_id != receipt.artifact_id
        || assertion.product_id != target.product
        || assertion.engine_id != target.engine
    {
        return Err("compatibility assertion identity must match its receipt target".into());
    }
    if assertion.evidence.is_empty() {
        return Err("compatibility assertion requires complete source evidence".into());
    }
    for evidence in &assertion.evidence {
        if Url::parse(&evidence.url).is_err()
            || evidence
                .source_revision
                .as_deref()
                .is_some_and(str::is_empty)
            || seconds(&evidence.checked_at).is_err()
        {
            return Err("compatibility assertion requires complete source evidence".into());
        }
    }
    let target_values = [
        (
            assertion.conditions.operating_systems.as_ref(),
            match &target.operating_system {
                OsFamily::Windows => Some("windows"),
                OsFamily::Macos => Some("macos"),
                OsFamily::Linux => Some("linux"),
                OsFamily::Other => Some("other"),
            },
        ),
        (
            assertion.conditions.cpu_architectures.as_ref(),
            match &target.cpu_architecture {
                CpuArchitecture::X86_64 => Some("x86_64"),
                CpuArchitecture::Aarch64 => Some("aarch64"),
            },
        ),
        (
            assertion.conditions.backends.as_ref(),
            Some(match &target.backend {
                AcceleratorBackend::Cuda => "cuda",
                AcceleratorBackend::Rocm => "rocm",
                AcceleratorBackend::Metal => "metal",
                AcceleratorBackend::Vulkan => "vulkan",
                AcceleratorBackend::Cpu => "cpu",
                AcceleratorBackend::Other => "other",
            }),
        ),
        (
            assertion.conditions.package_layouts.as_ref(),
            Some(match &target.package_layout {
                ArtifactPackageLayout::GgufSingle => "gguf-single",
                ArtifactPackageLayout::GgufSplit => "gguf-split",
                ArtifactPackageLayout::HfTransformers => "hf-transformers",
                ArtifactPackageLayout::MlxLm => "mlx-lm",
                ArtifactPackageLayout::MlxSwiftLm => "mlx-swift-lm",
                ArtifactPackageLayout::OllamaPackage => "ollama-package",
            }),
        ),
        (
            assertion.conditions.model_architectures.as_ref(),
            target.model_architecture.as_deref(),
        ),
        (
            assertion.conditions.quantization_schemes.as_ref(),
            Some(target.quantization_scheme.as_str()),
        ),
    ];
    if target_values.into_iter().any(|(allowed, actual)| {
        allowed.is_some_and(|values| actual.is_none_or(|value| !values.iter().any(|v| v == value)))
    }) {
        return Err("compatibility target does not satisfy its assertion".into());
    }
    if assertion
        .conditions
        .required_files
        .as_ref()
        .is_some_and(|required| {
            required
                .iter()
                .any(|file| !target.declared_package_files.contains(file))
        })
    {
        return Err("compatibility target is missing an assertion-required file".into());
    }
    Ok(())
}

fn validate_measurement_series(series: &[MeasurementSeries]) -> Result<(), String> {
    for item in series {
        if item.evidence.sample_count != Some(item.measured_samples.len() as u64) {
            return Err("measurement sampleCount must equal measuredSamples length".into());
        }
        let Some(measurement) = &item.evidence.measurement else {
            continue;
        };
        if measurement.unit != item.unit {
            return Err("measurement evidence unit must equal series unit".into());
        }
        if let (Some(aggregate), Some(interval), None) = (
            &item.aggregate,
            &measurement.interval,
            measurement.confidence,
        ) {
            if interval.lower != aggregate.minimum || interval.upper != aggregate.maximum {
                return Err(
                    "unqualified measurement interval must equal measured aggregate range".into(),
                );
            }
        }
    }
    Ok(())
}

fn validate_runtime(runtime: &RuntimeConfiguration) -> Result<(), String> {
    if runtime.context_tokens == 0
        || runtime.batch_size == Some(0)
        || runtime.micro_batch_size == Some(0)
        || runtime.parallelism == Some(0)
        || runtime.threads == Some(0)
    {
        return Err("runtime values are out of range".into());
    }
    if runtime
        .sampler
        .top_p
        .is_some_and(|v| !(0.0..=1.0).contains(&v))
        || runtime
            .sampler
            .min_p
            .is_some_and(|v| !(0.0..=1.0).contains(&v))
    {
        return Err("sampler probability is out of range".into());
    }
    Ok(())
}
fn validate_side_effects(value: &SideEffects) -> Result<(), String> {
    if value.executes_local_process
        && value.loads_model
        && !value.writes_model_store
        && !value.network
        && !value.upload
    {
        Ok(())
    } else {
        Err("side-effect constants do not match v1".into())
    }
}

pub fn canonical_json(value: &Value) -> String {
    match value {
        Value::Object(object) => {
            let mut keys: Vec<_> = object.keys().collect();
            keys.sort();
            format!(
                "{{{}}}",
                keys.into_iter()
                    .map(|key| format!(
                        "{}:{}",
                        serde_json::to_string(key).expect("key"),
                        canonical_json(&object[key])
                    ))
                    .collect::<Vec<_>>()
                    .join(",")
            )
        }
        Value::Array(items) => format!(
            "[{}]",
            items
                .iter()
                .map(canonical_json)
                .collect::<Vec<_>>()
                .join(",")
        ),
        _ => serde_json::to_string(value).expect("JSON value"),
    }
}

fn seconds(value: &str) -> Result<i64, String> {
    if value.len() != 20 || !value.ends_with('Z') {
        return Err("v1 timestamp must use YYYY-MM-DDTHH:MM:SSZ".into());
    }
    let number = |range: std::ops::Range<usize>| {
        value
            .get(range)
            .and_then(|v| v.parse::<i64>().ok())
            .ok_or_else(|| "invalid timestamp".to_string())
    };
    let (year, month, day, hour, minute, second) = (
        number(0..4)?,
        number(5..7)?,
        number(8..10)?,
        number(11..13)?,
        number(14..16)?,
        number(17..19)?,
    );
    if !(1..=12).contains(&month)
        || !(1..=31).contains(&day)
        || hour > 23
        || minute > 59
        || second > 59
    {
        return Err("invalid timestamp".into());
    }
    let adjusted = year - i64::from(month <= 2);
    let era = adjusted.div_euclid(400);
    let yoe = adjusted - era * 400;
    let mp = month + if month > 2 { -3 } else { 9 };
    let doy = (153 * mp + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    Ok((era * 146097 + doe - 719468) * 86400 + hour * 3600 + minute * 60 + second)
}

pub(crate) fn contract_timestamp_seconds(value: &str) -> Result<i64, String> {
    seconds(value)
}

fn sha256_hex(input: &[u8]) -> String {
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
        0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
        0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
        0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
        0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
        0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
        0xc67178f2,
    ];
    let mut bytes = input.to_vec();
    let bit_len = (bytes.len() as u64) * 8;
    bytes.push(0x80);
    while bytes.len() % 64 != 56 {
        bytes.push(0);
    }
    bytes.extend_from_slice(&bit_len.to_be_bytes());
    let mut h = [
        0x6a09e667u32,
        0xbb67ae85,
        0x3c6ef372,
        0xa54ff53a,
        0x510e527f,
        0x9b05688c,
        0x1f83d9ab,
        0x5be0cd19,
    ];
    for chunk in bytes.chunks(64) {
        let mut w = [0u32; 64];
        for (i, word) in chunk.chunks(4).enumerate() {
            w[i] = u32::from_be_bytes([word[0], word[1], word[2], word[3]]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16]
                .wrapping_add(s0)
                .wrapping_add(w[i - 7])
                .wrapping_add(s1);
        }
        let (mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh) =
            (h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7]);
        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ (!e & g);
            let t1 = hh
                .wrapping_add(s1)
                .wrapping_add(ch)
                .wrapping_add(K[i])
                .wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let t2 = s0.wrapping_add(maj);
            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(t1);
            d = c;
            c = b;
            b = a;
            a = t1.wrapping_add(t2);
        }
        for (slot, value) in h.iter_mut().zip([a, b, c, d, e, f, g, hh]) {
            *slot = slot.wrapping_add(value);
        }
    }
    h.iter().map(|word| format!("{word:08x}")).collect()
}

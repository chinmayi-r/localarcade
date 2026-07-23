//! M-I contract adapter for the preserved read-only model-store scanner.
//!
//! This is intentionally module-local rather than a new M-A wire contract.
//! It preserves local scan findings while re-evaluating registry identity at
//! the M-C boundary. No file is hashed here and no scan is started here.

use super::{FoundArtifact, ScanReport};
use crate::contracts::{
    ConfigurationMatch, HardwareMatch, Provenance, ProvenanceMethod, ProvenanceScope, Source,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::time::{SystemTime, UNIX_EPOCH};
use url::Url;

const REGISTRY_SCHEMA_VERSION: u64 = 4;
const REGISTRY_MAX_AGE_MS: i64 = 7 * 24 * 60 * 60 * 1_000;
const REGISTRY_FUTURE_TOLERANCE_MS: i64 = 5 * 60 * 1_000;
const LOWERCASE_SHA256_LEN: usize = 64;
const PROVENANCE_FIELDS: [&str; 15] = [
    "id",
    "publisher",
    "repository",
    "revision",
    "fileName",
    "sha256",
    "fileSizeBytes",
    "format",
    "quantization",
    "baseModel",
    "family",
    "model",
    "maxContextTokens",
    "license",
    "chatTemplate",
];

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum InventoryStatus {
    Ok,
    Partial,
    Unavailable,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InventoryResult {
    pub status: InventoryStatus,
    pub data: InventoryData,
    pub warnings: Vec<String>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InventoryData {
    pub registry_snapshot_id: Option<String>,
    pub registry_last_ingest_succeeded_at: Option<String>,
    pub stores: Vec<super::ScannedStore>,
    pub artifacts: Vec<InventoryArtifact>,
    pub duplicate_groups: Vec<Vec<String>>,
    pub unreadable: Vec<super::UnreadableEntry>,
    pub provenance: String,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InventoryArtifact {
    pub path: String,
    pub store: String,
    pub label: String,
    pub file_size_bytes: u64,
    pub sha256: Option<String>,
    pub resolution: InventoryArtifactResolution,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum InventoryArtifactResolution {
    Verified {
        identity: Box<RegistryArtifactIdentityV1>,
    },
    CandidateBySize {
        candidates: Vec<RegistryArtifactIdentityV1>,
    },
    AmbiguousIdentity {
        candidates: Vec<RegistryArtifactIdentityV1>,
        reason_code: String,
        message: String,
    },
    Unavailable {
        reason_code: String,
        message: String,
    },
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RegistryArtifactIdentityV1 {
    pub model_family: ModelFamilyV1,
    pub artifact: ArtifactIdentityV1,
    pub provenance: Vec<Provenance>,
    pub registry_metadata: RegistryMetadataV1,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelFamilyV1 {
    pub model_family_id: String,
    pub display_name: String,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactIdentityV1 {
    pub artifact_id: String,
    pub repository: String,
    pub revision: String,
    pub filename: String,
    pub sha256: String,
    pub bytes: u64,
    pub format: String,
    pub quantization: String,
    pub license: String,
    pub status: PromotedStatus,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PromotedStatus {
    Promoted,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RegistryMetadataV1 {
    pub publisher: String,
    pub base_model: String,
    pub model: String,
    pub max_context_tokens: u64,
    pub chat_template: String,
    pub license_source_url: String,
    pub field_provenance: BTreeMap<String, FieldProvenance>,
}

#[derive(Deserialize, Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FieldProvenance {
    pub source_url: String,
    pub retrieved_at: String,
    pub kind: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegistrySnapshot {
    schema_version: u64,
    snapshot_id: String,
    generated_at: String,
    last_ingest_succeeded_at: String,
    artifacts: Vec<RegistryArtifact>,
    quarantine: Vec<QuarantineRecord>,
    accelerators: Vec<AcceleratorRecord>,
    compatibility_assertions: Vec<CompatibilityAssertion>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AcceleratorRecord {
    id: String,
    #[serde(rename = "vendor")]
    _vendor: AcceleratorVendor,
    canonical_name: String,
    #[serde(rename = "aliases")]
    _aliases: Vec<String>,
    variants: Vec<AcceleratorVariant>,
    supported_backends: Vec<String>,
    source: FieldProvenance,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AcceleratorVariant {
    id: String,
    #[serde(rename = "label")]
    _label: String,
    memory_bytes: u64,
    #[serde(rename = "formFactor")]
    _form_factor: AcceleratorFormFactor,
    source_url: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
enum AcceleratorVendor {
    Nvidia,
    Amd,
    Apple,
    Intel,
}

#[derive(Deserialize)]
#[serde(rename_all = "kebab-case")]
enum AcceleratorFormFactor {
    Desktop,
    Laptop,
    Integrated,
    Soc,
    Workstation,
    Datacenter,
}

// These DTOs intentionally mirror the complete declared TypeScript shape.
// M-I does not interpret compatibility policy; successful deserialization is
// the structural/type/enum admission check for this otherwise unused data.
#[allow(dead_code)]
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CompatibilityAssertion {
    artifact_id: String,
    product_id: ProductId,
    engine_id: EngineId,
    status: CompatibilityStatus,
    runtime_constraint: RuntimeConstraint,
    conditions: CompatibilityConditions,
    evidence: Vec<CompatibilityEvidence>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeConstraint {
    #[serde(default, deserialize_with = "deserialize_optional_non_null")]
    min_version: Option<String>,
    #[serde(default, deserialize_with = "deserialize_optional_non_null")]
    max_version: Option<String>,
    #[serde(default, deserialize_with = "deserialize_optional_non_null")]
    exact_build: Option<String>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CompatibilityConditions {
    #[serde(default, deserialize_with = "deserialize_optional_non_null")]
    operating_systems: Option<Vec<String>>,
    #[serde(default, deserialize_with = "deserialize_optional_non_null")]
    cpu_architectures: Option<Vec<String>>,
    #[serde(default, deserialize_with = "deserialize_optional_non_null")]
    backends: Option<Vec<AccelerationBackend>>,
    #[serde(default, deserialize_with = "deserialize_optional_non_null")]
    model_architectures: Option<Vec<String>>,
    #[serde(default, deserialize_with = "deserialize_optional_non_null")]
    package_layouts: Option<Vec<ArtifactPackageLayout>>,
    #[serde(default, deserialize_with = "deserialize_optional_non_null")]
    quantization_schemes: Option<Vec<String>>,
    #[serde(default, deserialize_with = "deserialize_optional_non_null")]
    required_files: Option<Vec<String>>,
    #[serde(default, deserialize_with = "deserialize_optional_non_null")]
    limitations: Option<Vec<String>>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CompatibilityEvidence {
    url: String,
    checked_at: String,
    #[serde(default, deserialize_with = "deserialize_optional_non_null")]
    source_revision: Option<String>,
}

#[derive(Deserialize)]
enum ProductId {
    #[serde(rename = "llama-cpp")]
    LlamaCpp,
    #[serde(rename = "ollama")]
    Ollama,
    #[serde(rename = "lm-studio")]
    LmStudio,
    #[serde(rename = "jan")]
    Jan,
    #[serde(rename = "mlx-lm")]
    MlxLm,
    #[serde(rename = "vllm")]
    Vllm,
}

#[derive(Deserialize)]
enum EngineId {
    #[serde(rename = "llama.cpp")]
    LlamaCpp,
    #[serde(rename = "mlx-lm")]
    MlxLm,
    #[serde(rename = "mlx-swift-lm")]
    MlxSwiftLm,
    #[serde(rename = "vllm-native")]
    VllmNative,
    #[serde(rename = "vllm-transformers")]
    VllmTransformers,
    #[serde(rename = "vllm-gguf-plugin")]
    VllmGgufPlugin,
}

#[derive(Deserialize)]
#[serde(rename_all = "kebab-case")]
enum CompatibilityStatus {
    Verified,
    Documented,
    Experimental,
    Inferred,
    Unknown,
    Unsupported,
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
enum AccelerationBackend {
    Cpu,
    Cuda,
    Rocm,
    Metal,
    Vulkan,
    Sycl,
    Xpu,
}

#[derive(Deserialize)]
enum ArtifactPackageLayout {
    #[serde(rename = "gguf-single")]
    GgufSingle,
    #[serde(rename = "gguf-split")]
    GgufSplit,
    #[serde(rename = "hf-transformers")]
    HfTransformers,
    #[serde(rename = "mlx-lm")]
    MlxLm,
    #[serde(rename = "mlx-swift-lm")]
    MlxSwiftLm,
    #[serde(rename = "ollama-package")]
    OllamaPackage,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RegistryArtifact {
    id: String,
    publisher: String,
    repository: String,
    revision: String,
    file_name: String,
    sha256: String,
    file_size_bytes: u64,
    format: String,
    quantization: String,
    base_model: String,
    family: String,
    model: String,
    max_context_tokens: u64,
    chat_template: String,
    status: RegistryLifecycle,
    license: RegistryLicense,
    provenance: BTreeMap<String, FieldProvenance>,
}

#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "lowercase")]
enum RegistryLifecycle {
    Triage,
    Promoted,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RegistryLicense {
    id: String,
    source_url: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct QuarantineRecord {
    repository: String,
    revision: String,
    #[serde(
        rename = "fileName",
        default,
        deserialize_with = "deserialize_optional_non_null"
    )]
    _file_name: Option<String>,
    code: String,
    reason: String,
    source_url: String,
    recorded_at: String,
}

fn deserialize_optional_non_null<'de, D, T>(deserializer: D) -> Result<Option<T>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    T::deserialize(deserializer).map(Some)
}

#[derive(Clone)]
struct TriageIdentity {
    artifact_id: String,
    sha256: String,
}

pub fn adapt_scan_report(report: ScanReport) -> InventoryResult {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(i64::MAX as u128) as i64)
        .unwrap_or(0);
    adapt_scan_report_with_registry_at(report, super::ARTIFACTS_JSON, now_ms)
}

/// Testable form of the adapter. The registry text is injected so lifecycle,
/// stale and quarantine failures can be proven without changing generated data.
pub fn adapt_scan_report_with_registry_at(
    report: ScanReport,
    registry_json: &str,
    now_ms: i64,
) -> InventoryResult {
    let snapshot = match serde_json::from_str::<RegistrySnapshot>(registry_json) {
        Ok(snapshot) => snapshot,
        Err(error) => {
            return unavailable_report(
                report,
                "registry.snapshot-invalid",
                format!("The embedded artifact registry is invalid: {error}"),
            )
        }
    };

    if snapshot.schema_version != REGISTRY_SCHEMA_VERSION
        || snapshot.snapshot_id.trim().is_empty()
        || parse_registry_timestamp_ms(&snapshot.generated_at).is_none()
    {
        return unavailable_report(
            report,
            "registry.snapshot-invalid",
            "The embedded artifact registry has an unsupported schema or missing identity.".into(),
        );
    }
    let Some(succeeded_at_ms) = parse_registry_timestamp_ms(&snapshot.last_ingest_succeeded_at)
    else {
        return unavailable_report(
            report,
            "registry.snapshot-invalid",
            "The embedded artifact registry has an invalid last-success timestamp.".into(),
        );
    };
    let age_ms = now_ms - succeeded_at_ms;
    if age_ms < -REGISTRY_FUTURE_TOLERANCE_MS {
        return unavailable_report(
            report,
            "registry.snapshot-not-fresh",
            "The embedded artifact registry last-success timestamp is in the future.".into(),
        );
    }
    if age_ms > REGISTRY_MAX_AGE_MS {
        return unavailable_report(
            report,
            "registry.snapshot-not-fresh",
            "The embedded artifact registry is older than seven days.".into(),
        );
    }

    let mut promoted = Vec::new();
    let mut triage = Vec::new();
    let mut registry_warnings = Vec::new();
    let mut artifact_ids = std::collections::HashSet::new();
    for artifact in snapshot.artifacts {
        if !artifact_ids.insert(artifact.id.clone()) {
            registry_warnings.push(format!("{}: duplicate artifact id", artifact.id));
            continue;
        }
        match artifact.status {
            RegistryLifecycle::Promoted => match map_registry_artifact(&artifact) {
                Ok(identity) => promoted.push(identity),
                Err(issue) => registry_warnings.push(format!("{}: {issue}", artifact.id)),
            },
            RegistryLifecycle::Triage => match validate_registry_artifact(&artifact) {
                Ok(()) => triage.push(TriageIdentity {
                    artifact_id: artifact.id,
                    sha256: artifact.sha256,
                }),
                Err(issue) => registry_warnings.push(format!("{}: {issue}", artifact.id)),
            },
        }
    }
    let mut accelerator_ids = std::collections::HashSet::new();
    for record in &snapshot.accelerators {
        if !accelerator_ids.insert(&record.id)
            || record.id.trim().is_empty()
            || record.canonical_name.trim().is_empty()
            || record.variants.is_empty()
            || record.supported_backends.is_empty()
            || !valid_field_provenance(&record.source)
        {
            registry_warnings.push(format!("{}: accelerator admission is invalid", record.id));
            continue;
        }
        let mut variant_ids = std::collections::HashSet::new();
        if record.variants.iter().any(|variant| {
            variant.id.trim().is_empty()
                || !variant_ids.insert(&variant.id)
                || variant.memory_bytes == 0
                || !is_http_url(&variant.source_url)
        }) {
            registry_warnings.push(format!("{}: accelerator variant is invalid", record.id));
        }
    }
    let _compatibility_assertions = &snapshot.compatibility_assertions;
    for record in &snapshot.quarantine {
        if record.repository.trim().is_empty()
            || !is_immutable_revision(&record.revision)
            || !is_known_quarantine_code(&record.code)
            || record.reason.trim().is_empty()
            || !is_http_url(&record.source_url)
            || parse_registry_timestamp_ms(&record.recorded_at).is_none()
        {
            registry_warnings.push(format!(
                "{}: quarantine provenance is invalid",
                record.repository
            ));
        }
    }
    if !registry_warnings.is_empty() {
        return unavailable_report(
            report,
            "registry.snapshot-invalid",
            registry_warnings.join(" "),
        );
    }

    let mut warnings = Vec::new();
    let mut artifacts = Vec::with_capacity(report.artifacts.len());
    let mut has_incomplete_resolution = false;
    for found in &report.artifacts {
        let resolution = reconcile_artifact(found, &promoted, &triage);
        if !matches!(resolution, InventoryArtifactResolution::Verified { .. }) {
            has_incomplete_resolution = true;
        }
        artifacts.push(InventoryArtifact {
            path: found.path.clone(),
            store: found.store.clone(),
            label: found.label.clone(),
            file_size_bytes: found.file_size_bytes,
            sha256: found.sha256.clone(),
            resolution,
        });
    }
    if report.stores.iter().any(|store| store.truncated) {
        warnings.push("One or more stores reached the bounded traversal limit.".into());
    }
    if !report.unreadable.is_empty() {
        warnings.push("One or more requested entries could not be read.".into());
    }
    if has_incomplete_resolution {
        warnings.push("One or more local files do not have verified promoted identity.".into());
    }

    let status = if warnings.is_empty() {
        InventoryStatus::Ok
    } else {
        InventoryStatus::Partial
    };
    InventoryResult {
        status,
        data: InventoryData {
            registry_snapshot_id: Some(snapshot.snapshot_id),
            registry_last_ingest_succeeded_at: Some(snapshot.last_ingest_succeeded_at),
            stores: report.stores,
            artifacts,
            duplicate_groups: report.duplicate_groups,
            unreadable: report.unreadable,
            provenance: report.provenance.into(),
        },
        warnings,
    }
}

fn reconcile_artifact(
    found: &FoundArtifact,
    promoted: &[RegistryArtifactIdentityV1],
    triage: &[TriageIdentity],
) -> InventoryArtifactResolution {
    if let Some(digest) = found.sha256.as_deref() {
        if !is_lowercase_sha256(digest) {
            return unavailable(
                "inventory.hash-invalid",
                "The local digest is not a lowercase SHA-256 value.".into(),
            );
        }
        let hash_matches: Vec<_> = promoted
            .iter()
            .filter(|identity| identity.artifact.sha256 == digest)
            .collect();
        let exact_matches: Vec<_> = hash_matches
            .iter()
            .filter(|identity| identity.artifact.bytes == found.file_size_bytes)
            .map(|identity| (*identity).clone())
            .collect();
        if exact_matches.len() == 1 {
            return InventoryArtifactResolution::Verified {
                identity: Box::new(exact_matches[0].clone()),
            };
        }
        if exact_matches.len() > 1 {
            return InventoryArtifactResolution::AmbiguousIdentity {
                candidates: exact_matches,
                reason_code: "inventory.identity-ambiguous".into(),
                message: "The local hash and byte size match multiple promoted identities; no canonical alias rule is approved.".into(),
            };
        }
        if !hash_matches.is_empty() {
            return unavailable(
                "inventory.hash-size-mismatch",
                "The local digest names a promoted artifact but its byte size does not match."
                    .into(),
            );
        }
        if let Some(identity) = triage.iter().find(|identity| identity.sha256 == digest) {
            return unavailable(
                "registry.artifact-not-promoted",
                format!("Artifact {} remains in triage.", identity.artifact_id),
            );
        }
        return unavailable(
            "inventory.hash-not-admitted",
            "The known local digest does not match a promoted registry artifact.".into(),
        );
    }

    let candidates: Vec<_> = promoted
        .iter()
        .filter(|identity| identity.artifact.bytes == found.file_size_bytes)
        .cloned()
        .collect();
    if candidates.is_empty() {
        unavailable(
            "inventory.identity-unavailable",
            "No promoted artifact has the same byte size; identity remains unavailable.".into(),
        )
    } else {
        InventoryArtifactResolution::CandidateBySize { candidates }
    }
}

fn map_registry_artifact(record: &RegistryArtifact) -> Result<RegistryArtifactIdentityV1, String> {
    validate_registry_artifact(record)?;
    if record.status != RegistryLifecycle::Promoted {
        return Err("registry artifact is not promoted".into());
    }
    let provenance = PROVENANCE_FIELDS
        .iter()
        .map(|field| {
            let source = &record.provenance[*field];
            Provenance {
                source: Source {
                    id: format!("registry.{}", source.kind),
                    version: Some(REGISTRY_SCHEMA_VERSION.to_string()),
                    revision: Some(record.revision.clone()),
                    url: Some(source.source_url.clone()),
                },
                retrieved_at: Some(source.retrieved_at.clone()),
                observed_at: None,
                method: ProvenanceMethod::Imported,
                hardware_match: HardwareMatch::NotApplicable,
                configuration_match: ConfigurationMatch::NotApplicable,
                scope: ProvenanceScope {
                    task_family: None,
                    task_pack_id: None,
                    prompt_id: None,
                    harness_id: None,
                },
                sample_count: None,
                measurement: None,
                raw_source_record_ref: Some(format!("{}#{field}", record.id)),
            }
        })
        .collect();

    Ok(RegistryArtifactIdentityV1 {
        model_family: ModelFamilyV1 {
            model_family_id: record.family.clone(),
            display_name: record.model.clone(),
        },
        artifact: ArtifactIdentityV1 {
            artifact_id: record.id.clone(),
            repository: format!("{}/{}", record.publisher, record.repository),
            revision: record.revision.clone(),
            filename: record.file_name.clone(),
            sha256: record.sha256.clone(),
            bytes: record.file_size_bytes,
            format: record.format.clone(),
            quantization: record.quantization.clone(),
            license: record.license.id.clone(),
            status: PromotedStatus::Promoted,
        },
        provenance,
        registry_metadata: RegistryMetadataV1 {
            publisher: record.publisher.clone(),
            base_model: record.base_model.clone(),
            model: record.model.clone(),
            max_context_tokens: record.max_context_tokens,
            chat_template: record.chat_template.clone(),
            license_source_url: record.license.source_url.clone(),
            field_provenance: record.provenance.clone(),
        },
    })
}

fn validate_registry_artifact(record: &RegistryArtifact) -> Result<(), String> {
    if record.id.trim().is_empty()
        || record.publisher.trim().is_empty()
        || record.repository.trim().is_empty()
        || !record.file_name.to_ascii_lowercase().ends_with(".gguf")
        || record.format != "GGUF"
        || record.quantization.trim().is_empty()
        || record.base_model.trim().is_empty()
        || record.family.trim().is_empty()
        || record.model.trim().is_empty()
        || record.chat_template.trim().is_empty()
        || record.license.id.trim().is_empty()
        || !is_http_url(&record.license.source_url)
        || record.file_size_bytes == 0
        || record.max_context_tokens == 0
        || !is_immutable_revision(&record.revision)
        || !is_lowercase_sha256(&record.sha256)
    {
        return Err("registry identity is incomplete or contract-incompatible".into());
    }
    for field in PROVENANCE_FIELDS {
        let source = record
            .provenance
            .get(field)
            .ok_or_else(|| format!("{field} provenance is missing"))?;
        if !valid_field_provenance(source) {
            return Err(format!("{field} provenance is incomplete"));
        }
    }
    Ok(())
}

fn unavailable_report(report: ScanReport, reason_code: &str, message: String) -> InventoryResult {
    let artifacts = report
        .artifacts
        .iter()
        .map(|found| InventoryArtifact {
            path: found.path.clone(),
            store: found.store.clone(),
            label: found.label.clone(),
            file_size_bytes: found.file_size_bytes,
            sha256: found.sha256.clone(),
            resolution: unavailable(reason_code, message.clone()),
        })
        .collect();
    InventoryResult {
        status: InventoryStatus::Unavailable,
        data: InventoryData {
            registry_snapshot_id: None,
            registry_last_ingest_succeeded_at: None,
            stores: report.stores,
            artifacts,
            duplicate_groups: report.duplicate_groups,
            unreadable: report.unreadable,
            provenance: report.provenance.into(),
        },
        warnings: vec![message],
    }
}

fn unavailable(reason_code: &str, message: String) -> InventoryArtifactResolution {
    InventoryArtifactResolution::Unavailable {
        reason_code: reason_code.into(),
        message,
    }
}

fn is_lowercase_sha256(value: &str) -> bool {
    value.len() == LOWERCASE_SHA256_LEN
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn is_immutable_revision(value: &str) -> bool {
    (40..=64).contains(&value.len()) && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn is_http_url(value: &str) -> bool {
    Url::parse(value)
        .map(|url| matches!(url.scheme(), "http" | "https"))
        .unwrap_or(false)
}

fn valid_field_provenance(value: &FieldProvenance) -> bool {
    is_http_url(&value.source_url)
        && parse_registry_timestamp_ms(&value.retrieved_at).is_some()
        && is_known_provenance_kind(&value.kind)
}

fn is_known_provenance_kind(value: &str) -> bool {
    matches!(
        value,
        "hub-api"
            | "hub-lfs"
            | "model-card"
            | "gguf-metadata"
            | "filename-derivation"
            | "identity-derivation"
            | "base-model-derivation"
            | "schema-constant"
    )
}

fn is_known_quarantine_code(value: &str) -> bool {
    matches!(
        value,
        "no-gguf-files"
            | "split-package-unsupported"
            | "unsupported-file-role"
            | "unrecognized-quantization"
            | "missing-sha256"
            | "missing-file-size"
            | "missing-base-model"
            | "missing-license"
            | "missing-license-source"
            | "missing-context"
            | "missing-chat-template"
    )
}

fn parse_registry_timestamp_ms(value: &str) -> Option<i64> {
    // Generated registry timestamps are canonical UTC RFC3339 values. Reject
    // other serializations rather than interpreting locale or timezone data.
    let (date, time) = value.strip_suffix('Z')?.split_once('T')?;
    let mut date_parts = date.split('-');
    let year = date_parts.next()?.parse::<i64>().ok()?;
    let month = date_parts.next()?.parse::<u32>().ok()?;
    let day = date_parts.next()?.parse::<u32>().ok()?;
    if date_parts.next().is_some() || !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return None;
    }
    let (clock, fraction) = time.split_once('.').map_or((time, ""), |parts| parts);
    let mut clock_parts = clock.split(':');
    let hour = clock_parts.next()?.parse::<u32>().ok()?;
    let minute = clock_parts.next()?.parse::<u32>().ok()?;
    let second = clock_parts.next()?.parse::<u32>().ok()?;
    if clock_parts.next().is_some() || hour > 23 || minute > 59 || second > 59 {
        return None;
    }
    if !fraction.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    let millis_text = format!("{fraction:0<3}");
    let millis = millis_text.get(..3)?.parse::<i64>().ok()?;
    let days = days_from_civil(year, month, day)?;
    days.checked_mul(86_400_000)?
        .checked_add(i64::from(hour) * 3_600_000)?
        .checked_add(i64::from(minute) * 60_000)?
        .checked_add(i64::from(second) * 1_000)?
        .checked_add(millis)
}

fn days_from_civil(year: i64, month: u32, day: u32) -> Option<i64> {
    let leap = |year: i64| year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let month_days = [
        31,
        if leap(year) { 29 } else { 28 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    if day > month_days[(month - 1) as usize] {
        return None;
    }
    let adjusted_year = year - i64::from(month <= 2);
    let era = if adjusted_year >= 0 {
        adjusted_year
    } else {
        adjusted_year - 399
    } / 400;
    let year_of_era = adjusted_year - era * 400;
    let adjusted_month = i64::from(month) + if month > 2 { -3 } else { 9 };
    let day_of_year = (153 * adjusted_month + 2) / 5 + i64::from(day) - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    Some(era * 146_097 + day_of_era - 719_468)
}

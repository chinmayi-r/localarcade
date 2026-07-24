//! Process-local M-O assembly for verification-plan previews.
//!
//! The adapter retains producer-owned evidence behind opaque handles. It
//! validates the complete M-A import envelope, adapts M-I inventory, and calls
//! M-J preparation. It never grants execution authority or starts a model.

use crate::contracts::{
    contract_timestamp_seconds, validate_contract_json, AcceleratorBackend, Artifact,
    ArtifactPackageLayout, ArtifactStatus, CompatibilityAdmissionAssertion,
    CompatibilityAdmissionConditions, CompatibilityAdmissionDecision,
    CompatibilityAdmissionEvidence, CompatibilityAdmissionPolicy, CompatibilityAdmissionReceipt,
    CompatibilityAdmissionTarget, CompatibilityAssertionStatus, CompatibilityRuntimeConstraint,
    ConcurrentGpu, CpuArchitecture, ExactConfigurationCandidate, GpuLayers, GpuLayersAll,
    HardwareTarget, KvCache, MeasurementKind, ModelFamily, Power, Preflight, QuickCheck,
    RunnerImportBundle, RuntimeConfiguration, Sampler, Thermal, VerificationPlan,
};
use crate::existing_tool_probe;
use crate::fit_profile_capture::{
    prepare_fit_profile_capture, FitProfileCapturePreparationRequest, PreparedFitProfileCapture,
    FIT_PROFILE_CAPTURE_PROTOCOL_V1, FIT_PROFILE_CAPTURE_REPETITIONS_V1,
};
use crate::hardware_confirmation::{
    evaluate_hardware_confirmation, HardwareConfirmationAcknowledgement,
    HardwareConfirmationEvaluation, HardwareConfirmationReceipt, HardwareConfirmationState,
    HardwareConfirmationStore,
};
use crate::hardware_target::HardwareResolution;
use crate::model_store::inventory::{
    adapt_scan_report, promote_selected_file_with_boundary, InventoryResult,
    SelectedFileHashBoundary, SystemSelectedFileHashBoundary,
};
use crate::model_store::ScanReport;
use crate::preflight::PreflightReport;
use crate::verification::{
    prepare_verification, BenchmarkPreparation, ConfirmedHardwareTarget, ExistingToolKind,
    ObservedToolIdentityReceipt, PreparedVerification, QuickCheckPreparation,
    ValidatedCompatibilityAdmissionReceipt, VerificationPreparationRequest,
    VerifiedInventorySelection,
};

const LOCAL_CAPTURE_LLAMA_CPP_BUILD_V1: &str = "b10061 (5d5306bf3)";
use serde::Serialize;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct PreviewHandle(String);

impl PreviewHandle {
    pub fn token(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone)]
struct ConfirmedHardwareEntry {
    flow: PreviewHandle,
    target: ConfirmedHardwareTarget,
}

#[derive(Debug, Clone)]
struct HardwareEvaluationEntry {
    flow: PreviewHandle,
    evaluation: HardwareConfirmationEvaluation,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HardwareEvaluationPreview {
    pub evaluation_handle: String,
    pub state: String,
    pub reason_codes: Vec<String>,
    pub confirmation_fields: Vec<String>,
    pub differences: Vec<HardwareDifferencePreview>,
    pub warnings: Vec<String>,
    pub resolved_target: Option<HardwareTarget>,
    pub preview_only: bool,
    pub grants_execution_authorization: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HardwareDifferencePreview {
    pub field: String,
    pub imported: Option<String>,
    pub resolved: Option<String>,
    pub kind: String,
    pub reason_code: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HardwareConfirmationPreview {
    pub hardware_handle: String,
    pub hardware_target_id: String,
    pub resolved_target: HardwareTarget,
    pub effective_target: HardwareTarget,
    pub differences: Vec<HardwareDifferencePreview>,
    pub acknowledged_reason_codes: Vec<String>,
    pub acknowledged_confirmation_fields: Vec<String>,
    pub warnings: Vec<String>,
    pub preview_only: bool,
    pub grants_execution_authorization: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ImportBundlePreview {
    pub import_handle: String,
    pub expired: bool,
    pub warnings: Vec<String>,
    pub preview_only: bool,
    pub grants_execution_authorization: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ManualHardwareEvaluationPreview {
    pub flow_handle: String,
    pub evaluation: HardwareEvaluationPreview,
}

#[derive(Debug, Clone)]
struct InventorySelectionEntry {
    flow: PreviewHandle,
    inventory: PreviewHandle,
    selection: VerifiedInventorySelection,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InventoryScanPreview {
    pub inventory_handle: String,
    pub result: InventoryResult,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InventorySelectionPreview {
    pub selection_handle: String,
    pub selected_path: String,
    pub artifact_id: String,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InventoryHashPromotionPreview {
    pub selection_handle: String,
    pub status: String,
    pub selected_path: String,
    pub artifact_id: String,
    pub sha256: String,
    pub bytes: u64,
    pub preview_only: bool,
    pub grants_execution_authorization: bool,
}

#[derive(Debug, Clone)]
pub struct BenchmarkPreviewRequest {
    pub tool_handle: PreviewHandle,
    pub plan_id: String,
    pub protocol_id: String,
    pub warmup_runs: u64,
    pub measured_runs: u64,
    pub measurement_kinds: Vec<MeasurementKind>,
}

#[derive(Debug, Clone)]
pub struct QuickCheckPreviewRequest {
    pub tool_handle: PreviewHandle,
    pub plan_id: String,
    pub checks: Vec<QuickCheck>,
}

#[derive(Debug, Clone)]
pub struct PreparePreviewRequest {
    pub import_handle: PreviewHandle,
    pub hardware_handle: PreviewHandle,
    pub selection_handle: PreviewHandle,
    pub verification_plan_id: String,
    pub benchmark: Option<BenchmarkPreviewRequest>,
    pub quick_check: Option<QuickCheckPreviewRequest>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CheckedIdentityPreview {
    pub path: String,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VerificationPlanPreview {
    pub prepared_handle: String,
    pub plan: VerificationPlan,
    pub artifact: CheckedIdentityPreview,
    pub benchmark_tool: Option<CheckedIdentityPreview>,
    pub quick_check_tool: Option<CheckedIdentityPreview>,
    pub warnings: Vec<String>,
    pub preview_only: bool,
    pub grants_execution_authorization: bool,
}

#[derive(Debug, Clone)]
pub struct PrepareFitProfileCapturePreviewRequest {
    pub flow_handle: PreviewHandle,
    pub hardware_handle: PreviewHandle,
    pub selection_handle: PreviewHandle,
    pub tool_handle: PreviewHandle,
    pub capture_id: String,
    pub manual_context_tokens: Option<u64>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FitProfileCapturePreview {
    pub prepared_capture_handle: String,
    pub capture_id: String,
    pub protocol_id: String,
    pub artifact: CheckedIdentityPreview,
    pub tool: CheckedIdentityPreview,
    pub context_tokens: Vec<u64>,
    pub repetitions_per_context: u64,
    pub candidate: ExactConfigurationCandidate,
    pub configuration_source: String,
    pub warnings: Vec<String>,
    pub preview_only: bool,
    pub grants_execution_authorization: bool,
    pub grants_serving_authorization: bool,
    pub grants_recommendation_authorization: bool,
}

#[derive(Debug, Default)]
pub struct PreviewAssembler {
    next_handle: u64,
    imports: HashMap<PreviewHandle, RunnerImportBundle>,
    manual_flows: HashMap<PreviewHandle, HardwareTarget>,
    hardware_evaluations: HashMap<PreviewHandle, HardwareEvaluationEntry>,
    hardware_receipts: HardwareConfirmationStore,
    hardware: HashMap<PreviewHandle, ConfirmedHardwareEntry>,
    tools: HashMap<PreviewHandle, ObservedToolIdentityReceipt>,
    inventories: HashMap<PreviewHandle, InventoryResult>,
    selections: HashMap<PreviewHandle, InventorySelectionEntry>,
    prepared: HashMap<PreviewHandle, PreparedVerification>,
    prepared_fit_captures: HashMap<PreviewHandle, PreparedFitProfileCapture>,
}

impl PreviewAssembler {
    fn issue_handle(&mut self, prefix: &str) -> Result<PreviewHandle, String> {
        self.next_handle = self
            .next_handle
            .checked_add(1)
            .ok_or_else(|| "m-o.preview.handle-space-exhausted".to_string())?;
        Ok(PreviewHandle(format!("{prefix}-{}", self.next_handle)))
    }

    pub fn admit_import_bundle(
        &mut self,
        json: &str,
        confirm_expired: bool,
    ) -> Result<ImportBundlePreview, Vec<String>> {
        let inspected = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| vec!["m-o.preview.system-clock-before-epoch".into()])?
            .as_secs()
            .min(i64::MAX as u64) as i64;
        self.admit_import_bundle_at(json, inspected, confirm_expired)
    }

    fn admit_import_bundle_at(
        &mut self,
        json: &str,
        inspected_at_seconds: i64,
        confirm_expired: bool,
    ) -> Result<ImportBundlePreview, Vec<String>> {
        let validated = validate_contract_json(json)?;
        if validated.contract != "runner-import-bundle" || validated.status != "ok" {
            return Err(vec!["m-o.preview.import-bundle-required".into()]);
        }
        let data = validated
            .data
            .ok_or_else(|| vec!["m-o.preview.import-data-missing".into()])?;
        let bundle: RunnerImportBundle = serde_json::from_value(data)
            .map_err(|error| vec![format!("m-o.preview.import-decode-failed:{error}")])?;
        let created = contract_timestamp_seconds(&bundle.handoff.created_at)
            .map_err(|error| vec![format!("m-o.preview.created-at-invalid:{error}")])?;
        let expires = contract_timestamp_seconds(&bundle.handoff.expires_at)
            .map_err(|error| vec![format!("m-o.preview.expires-at-invalid:{error}")])?;
        if expires <= created {
            return Err(vec!["m-o.preview.import-expiry-not-after-creation".into()]);
        }
        let expired = inspected_at_seconds > expires;
        if expired && !confirm_expired {
            return Err(vec![
                "m-o.preview.import-expired-confirmation-required".into()
            ]);
        }
        let handle = self.issue_handle("import").map_err(|error| vec![error])?;
        self.imports.insert(handle.clone(), bundle);
        Ok(ImportBundlePreview {
            import_handle: handle.token().to_string(),
            expired,
            warnings: expired
                .then(|| {
                    "The handoff is expired. Inspection/import was explicitly confirmed; this grants no execution authorization."
                        .into()
                })
                .into_iter()
                .collect(),
            preview_only: true,
            grants_execution_authorization: false,
        })
    }

    pub fn imported_hardware_target(
        &self,
        flow_handle: &PreviewHandle,
    ) -> Result<crate::contracts::HardwareTarget, String> {
        self.imports
            .get(flow_handle)
            .map(|bundle| bundle.handoff.hardware_target.clone())
            .or_else(|| self.manual_flows.get(flow_handle).cloned())
            .ok_or_else(|| "m-o.preview.import-handle-invalid".into())
    }

    pub fn begin_manual_hardware_evaluation(
        &mut self,
        resolution: &HardwareResolution,
    ) -> Result<ManualHardwareEvaluationPreview, Vec<String>> {
        let mut scoped_resolution = resolution.clone();
        let target = scoped_resolution
            .target
            .as_ref()
            .ok_or_else(|| vec!["m-o.manual.hardware-target-unavailable".into()])?;
        let cuda_count = target
            .accelerators
            .iter()
            .filter(|accelerator| accelerator.backend == AcceleratorBackend::Cuda)
            .count();
        if cuda_count == 1 && target.accelerators.len() > 1 {
            scoped_resolution
                .target
                .as_mut()
                .expect("target checked above")
                .accelerators
                .retain(|accelerator| accelerator.backend == AcceleratorBackend::Cuda);
            scoped_resolution.state = crate::hardware_target::ResolutionState::ConfirmationRequired;
            scoped_resolution.reason_codes = vec!["hardware.manual-cuda-device-selected".into()];
            scoped_resolution.confirmation_fields = vec!["/accelerators".into()];
            scoped_resolution.warnings.push(
                "This initial capture is scoped to the one detected CUDA GPU. Other detected adapters remain outside this measurement."
                    .into(),
            );
        }
        let target = scoped_resolution
            .target
            .clone()
            .expect("target checked above");
        let flow = self
            .issue_handle("local-session")
            .map_err(|error| vec![error])?;
        self.manual_flows.insert(flow.clone(), target);
        let evaluation = self
            .evaluate_hardware(&flow, &scoped_resolution)
            .map_err(|error| vec![error])?;
        Ok(ManualHardwareEvaluationPreview {
            flow_handle: flow.token().to_string(),
            evaluation,
        })
    }

    pub fn retain_hardware_confirmation(
        &mut self,
        flow_handle: &PreviewHandle,
        receipt: &HardwareConfirmationReceipt,
    ) -> Result<PreviewHandle, Vec<String>> {
        let expected = self
            .imported_hardware_target(flow_handle)
            .map_err(|error| vec![error])?;
        if receipt.imported_target() != &expected {
            return Err(vec!["m-o.preview.hardware-import-binding-mismatch".into()]);
        }
        let target =
            ConfirmedHardwareTarget::from_confirmation(receipt).map_err(|error| vec![error])?;
        let handle = self.issue_handle("hardware").map_err(|error| vec![error])?;
        self.hardware.insert(
            handle.clone(),
            ConfirmedHardwareEntry {
                flow: flow_handle.clone(),
                target,
            },
        );
        Ok(handle)
    }

    pub fn evaluate_hardware(
        &mut self,
        flow_handle: &PreviewHandle,
        resolution: &HardwareResolution,
    ) -> Result<HardwareEvaluationPreview, String> {
        let imported = self.imported_hardware_target(flow_handle)?;
        let evaluation = evaluate_hardware_confirmation(&imported, resolution);
        let handle = self.issue_handle("hardware-evaluation")?;
        self.hardware_evaluations.insert(
            handle.clone(),
            HardwareEvaluationEntry {
                flow: flow_handle.clone(),
                evaluation: evaluation.clone(),
            },
        );
        Ok(HardwareEvaluationPreview {
            evaluation_handle: handle.token().to_string(),
            state: match evaluation.state() {
                HardwareConfirmationState::Ready => "ready",
                HardwareConfirmationState::ConfirmationRequired => "confirmation-required",
                HardwareConfirmationState::Blocked => "blocked",
                HardwareConfirmationState::Unavailable => "unavailable",
            }
            .into(),
            reason_codes: evaluation.reason_codes().to_vec(),
            confirmation_fields: evaluation.confirmation_fields().to_vec(),
            differences: evaluation
                .differences()
                .iter()
                .map(hardware_difference_preview)
                .collect(),
            warnings: evaluation.warnings().to_vec(),
            resolved_target: evaluation.resolved_target().cloned(),
            preview_only: true,
            grants_execution_authorization: false,
        })
    }

    pub fn confirm_hardware_evaluation(
        &mut self,
        evaluation_handle: &PreviewHandle,
        acknowledgement: Option<&HardwareConfirmationAcknowledgement>,
    ) -> Result<HardwareConfirmationPreview, Vec<String>> {
        let entry = self
            .hardware_evaluations
            .get(evaluation_handle)
            .ok_or_else(|| vec!["m-o.preview.hardware-evaluation-handle-invalid".into()])?
            .clone();
        let receipt_handle = self
            .hardware_receipts
            .insert(&entry.evaluation, acknowledgement)
            .map_err(|error| vec![error])?;
        let receipt = self
            .hardware_receipts
            .get(receipt_handle)
            .ok_or_else(|| vec!["m-o.preview.hardware-receipt-missing".into()])?
            .clone();
        let warnings = entry.evaluation.warnings().to_vec();
        let target_id = receipt.effective_target().hardware_target_id.clone();
        let resolved_target = receipt.resolved_target().clone();
        let effective_target = receipt.effective_target().clone();
        let differences = receipt
            .differences()
            .iter()
            .map(hardware_difference_preview)
            .collect();
        let acknowledged_reason_codes = receipt.acknowledged_reason_codes().to_vec();
        let acknowledged_confirmation_fields = receipt.acknowledged_confirmation_fields().to_vec();
        let handle = self.retain_hardware_confirmation(&entry.flow, &receipt)?;
        self.hardware_evaluations.remove(evaluation_handle);
        Ok(HardwareConfirmationPreview {
            hardware_handle: handle.token().to_string(),
            hardware_target_id: target_id,
            resolved_target,
            effective_target,
            differences,
            acknowledged_reason_codes,
            acknowledged_confirmation_fields,
            warnings,
            preview_only: true,
            grants_execution_authorization: false,
        })
    }

    pub fn retain_tool_probe(
        &mut self,
        receipt: &existing_tool_probe::ExistingToolIdentityReceipt,
    ) -> Result<PreviewHandle, Vec<String>> {
        if receipt.grants_authorization() {
            return Err(vec!["m-o.preview.tool-receipt-authorizing".into()]);
        }
        let kind = match receipt.kind() {
            existing_tool_probe::ExistingToolKind::Benchmark => ExistingToolKind::Benchmark,
            existing_tool_probe::ExistingToolKind::QuickCheck => ExistingToolKind::QuickCheck,
            existing_tool_probe::ExistingToolKind::FitProfileCapture => {
                ExistingToolKind::FitProfileCapture
            }
        };
        let observed = ObservedToolIdentityReceipt::new(
            kind,
            receipt.canonical_path().to_path_buf(),
            receipt.sha256().to_string(),
            receipt.observed_product().to_string(),
            receipt.observed_engine().to_string(),
            receipt.observed_engine_build().to_string(),
            receipt.probe_protocol_id().to_string(),
            format!("unix-milliseconds:{}", receipt.observed_unix_millis()),
        )?;
        let handle = self.issue_handle("tool").map_err(|error| vec![error])?;
        self.tools.insert(handle.clone(), observed);
        Ok(handle)
    }

    pub fn retain_inventory_scan(
        &mut self,
        report: ScanReport,
    ) -> Result<InventoryScanPreview, String> {
        self.retain_adapted_inventory(adapt_scan_report(report))
    }

    fn retain_adapted_inventory(
        &mut self,
        result: InventoryResult,
    ) -> Result<InventoryScanPreview, String> {
        let handle = self.issue_handle("inventory")?;
        self.inventories.insert(handle.clone(), result.clone());
        Ok(InventoryScanPreview {
            inventory_handle: handle.token().to_string(),
            result,
        })
    }

    pub fn select_inventory_path(
        &mut self,
        flow_handle: &PreviewHandle,
        inventory_handle: &PreviewHandle,
        selected_path: &str,
    ) -> Result<InventorySelectionPreview, Vec<String>> {
        if selected_path.trim().is_empty() {
            return Err(vec!["m-o.preview.selection-path-empty".into()]);
        }
        let expected_artifact_id = self.imports.get(flow_handle).map(|bundle| {
            bundle
                .handoff
                .selected_candidate
                .artifact
                .artifact_id
                .as_str()
        });
        if expected_artifact_id.is_none() && !self.manual_flows.contains_key(flow_handle) {
            return Err(vec!["m-o.preview.flow-handle-invalid".into()]);
        }
        let inventory = self
            .inventories
            .get(inventory_handle)
            .ok_or_else(|| vec!["m-o.preview.inventory-handle-invalid".into()])?;
        let matches: Vec<_> = inventory
            .data
            .artifacts
            .iter()
            .filter(|artifact| artifact.path == selected_path)
            .collect();
        if matches.len() != 1 {
            return Err(vec![if matches.is_empty() {
                "m-o.preview.selection-not-in-scan".into()
            } else {
                "m-o.preview.selection-path-ambiguous".into()
            }]);
        }
        let selection = VerifiedInventorySelection::from_inventory_artifact(matches[0])?;
        if expected_artifact_id.is_some_and(|expected| selection.artifact_id() != expected) {
            return Err(vec![
                "m-o.preview.selection-candidate-artifact-mismatch".into()
            ]);
        }
        let preview = InventorySelectionPreview {
            selection_handle: String::new(),
            selected_path: selection.path().to_string_lossy().into_owned(),
            artifact_id: selection.artifact_id().to_string(),
            sha256: selection.sha256().to_string(),
        };
        let handle = self
            .issue_handle("selection")
            .map_err(|error| vec![error])?;
        self.selections.insert(
            handle.clone(),
            InventorySelectionEntry {
                flow: flow_handle.clone(),
                inventory: inventory_handle.clone(),
                selection,
            },
        );
        Ok(InventorySelectionPreview {
            selection_handle: handle.token().to_string(),
            ..preview
        })
    }

    /// Hash one explicit size-only selection. No scan invokes this method and
    /// the resulting opaque handle grants no execution authorization.
    pub fn hash_and_select_inventory_path(
        &mut self,
        flow_handle: &PreviewHandle,
        inventory_handle: &PreviewHandle,
        selected_path: &str,
    ) -> Result<InventoryHashPromotionPreview, Vec<String>> {
        self.hash_and_select_inventory_path_with_boundary(
            flow_handle,
            inventory_handle,
            selected_path,
            &SystemSelectedFileHashBoundary,
        )
    }

    pub fn prepare_standard_preview_v1(
        &mut self,
        policy_id: &str,
        import_handle: PreviewHandle,
        hardware_handle: PreviewHandle,
        selection_handle: PreviewHandle,
        benchmark_tool_handle: PreviewHandle,
        quick_check_tool_handle: PreviewHandle,
    ) -> Result<VerificationPlanPreview, Vec<String>> {
        if policy_id != crate::execution_protocol::VERIFICATION_PLAN_POLICY_V1 {
            return Err(vec!["m-o.preview.verification-policy-unsupported".into()]);
        }
        let plan_identity = self
            .issue_handle("verification-plan")
            .map_err(|error| vec![error])?
            .token()
            .to_string();
        self.prepare_preview(PreparePreviewRequest {
            import_handle,
            hardware_handle,
            selection_handle,
            verification_plan_id: plan_identity.clone(),
            benchmark: Some(BenchmarkPreviewRequest {
                tool_handle: benchmark_tool_handle,
                plan_id: format!("{plan_identity}-benchmark"),
                protocol_id: crate::execution_protocol::BENCHMARK_PROTOCOL_V1.into(),
                warmup_runs: crate::execution_protocol::STANDARD_WARMUP_RUNS_V1,
                measured_runs: crate::execution_protocol::STANDARD_MEASURED_RUNS_V1,
                measurement_kinds: vec![
                    MeasurementKind::PromptProcessing,
                    MeasurementKind::Generation,
                ],
            }),
            quick_check: Some(QuickCheckPreviewRequest {
                tool_handle: quick_check_tool_handle,
                plan_id: format!("{plan_identity}-quick-check"),
                checks: crate::execution_protocol::standard_quick_checks_v1(),
            }),
        })
    }

    fn hash_and_select_inventory_path_with_boundary<B: SelectedFileHashBoundary>(
        &mut self,
        flow_handle: &PreviewHandle,
        inventory_handle: &PreviewHandle,
        selected_path: &str,
        boundary: &B,
    ) -> Result<InventoryHashPromotionPreview, Vec<String>> {
        let expected_artifact_id = self.imports.get(flow_handle).map(|bundle| {
            bundle
                .handoff
                .selected_candidate
                .artifact
                .artifact_id
                .as_str()
        });
        if expected_artifact_id.is_none() && !self.manual_flows.contains_key(flow_handle) {
            return Err(vec!["m-o.preview.flow-handle-invalid".into()]);
        }
        let inventory = self
            .inventories
            .get(inventory_handle)
            .ok_or_else(|| vec!["m-o.preview.inventory-handle-invalid".into()])?;
        let promoted = promote_selected_file_with_boundary(inventory, selected_path, boundary)?;
        let selection = VerifiedInventorySelection::from_inventory_artifact(&promoted)?;
        if expected_artifact_id.is_some_and(|expected| selection.artifact_id() != expected) {
            return Err(vec![
                "m-o.preview.selection-candidate-artifact-mismatch".into()
            ]);
        }
        let handle = self
            .issue_handle("selection")
            .map_err(|error| vec![error])?;
        let preview = InventoryHashPromotionPreview {
            selection_handle: handle.token().to_string(),
            status: "verified".into(),
            selected_path: selection.path().to_string_lossy().into_owned(),
            artifact_id: selection.artifact_id().to_string(),
            sha256: selection.sha256().to_string(),
            bytes: selection.bytes(),
            preview_only: true,
            grants_execution_authorization: false,
        };
        self.selections.insert(
            handle,
            InventorySelectionEntry {
                flow: flow_handle.clone(),
                inventory: inventory_handle.clone(),
                selection,
            },
        );
        Ok(preview)
    }

    /// Prepare a preview using a fresh read-only local preflight. Callers
    /// cannot supply power, thermal, or concurrent-GPU claims.
    pub fn prepare_preview(
        &mut self,
        request: PreparePreviewRequest,
    ) -> Result<VerificationPlanPreview, Vec<String>> {
        self.prepare_preview_with_preflight(request, crate::preflight::inspect())
    }

    fn prepare_preview_with_preflight(
        &mut self,
        request: PreparePreviewRequest,
        preflight_report: PreflightReport,
    ) -> Result<VerificationPlanPreview, Vec<String>> {
        let bundle = self
            .imports
            .get(&request.import_handle)
            .ok_or_else(|| vec!["m-o.preview.import-handle-invalid".into()])?
            .clone();
        let hardware = self
            .hardware
            .get(&request.hardware_handle)
            .ok_or_else(|| vec!["m-o.preview.hardware-handle-invalid".into()])?
            .clone();
        if hardware.flow != request.import_handle {
            return Err(vec!["m-o.preview.hardware-import-handle-mismatch".into()]);
        }
        let selection_entry = self
            .selections
            .get(&request.selection_handle)
            .ok_or_else(|| vec!["m-o.preview.selection-handle-invalid".into()])?
            .clone();
        if selection_entry.flow != request.import_handle {
            return Err(vec!["m-o.preview.selection-import-handle-mismatch".into()]);
        }
        if !self.inventories.contains_key(&selection_entry.inventory) {
            return Err(vec!["m-o.preview.selection-inventory-handle-stale".into()]);
        }
        let preflight = map_preflight(&preflight_report);
        let benchmark = request
            .benchmark
            .map(|value| {
                let tool = self.resolve_tool(&value.tool_handle, ExistingToolKind::Benchmark)?;
                Ok::<BenchmarkPreparation, Vec<String>>(BenchmarkPreparation {
                    plan_id: value.plan_id,
                    tool,
                    protocol_id: value.protocol_id,
                    warmup_runs: value.warmup_runs,
                    measured_runs: value.measured_runs,
                    measurement_kinds: value.measurement_kinds,
                    preflight: preflight.clone(),
                })
            })
            .transpose()?;
        let quick_check = request
            .quick_check
            .map(|value| {
                let tool = self.resolve_tool(&value.tool_handle, ExistingToolKind::QuickCheck)?;
                Ok::<QuickCheckPreparation, Vec<String>>(QuickCheckPreparation {
                    plan_id: value.plan_id,
                    tool,
                    checks: value.checks,
                    preflight: preflight.clone(),
                })
            })
            .transpose()?;
        let compatibility =
            ValidatedCompatibilityAdmissionReceipt::new(bundle.compatibility_admission)?;
        let prepared = prepare_verification(&VerificationPreparationRequest {
            verification_plan_id: request.verification_plan_id,
            hardware_target: hardware.target,
            candidate: bundle.handoff.selected_candidate,
            compatibility_admission: compatibility,
            inventory_selection: selection_entry.selection,
            benchmark,
            quick_check,
        })?;
        let handle = self.issue_handle("prepared").map_err(|error| vec![error])?;
        let preview = preview_from_prepared(&handle, &prepared);
        self.prepared.insert(handle, prepared);
        Ok(preview)
    }

    fn resolve_tool(
        &self,
        handle: &PreviewHandle,
        expected: ExistingToolKind,
    ) -> Result<ObservedToolIdentityReceipt, Vec<String>> {
        let tool = self
            .tools
            .get(handle)
            .ok_or_else(|| vec!["m-o.preview.tool-handle-invalid".into()])?;
        if tool.kind() != expected {
            return Err(vec!["m-o.preview.tool-kind-mismatch".into()]);
        }
        Ok(tool.clone())
    }

    /// Prepares the exact U27 memory-component capture from already sealed
    /// import, hardware, inventory and tool receipts. It starts no process.
    pub fn prepare_fit_profile_capture_preview(
        &mut self,
        request: PrepareFitProfileCapturePreviewRequest,
    ) -> Result<FitProfileCapturePreview, Vec<String>> {
        let hardware = self
            .hardware
            .get(&request.hardware_handle)
            .ok_or_else(|| vec!["u27.preview.hardware-handle-invalid".into()])?
            .clone();
        if hardware.flow != request.flow_handle {
            return Err(vec!["u27.preview.hardware-flow-handle-mismatch".into()]);
        }
        let selection = self
            .selections
            .get(&request.selection_handle)
            .ok_or_else(|| vec!["u27.preview.selection-handle-invalid".into()])?
            .clone();
        if selection.flow != request.flow_handle {
            return Err(vec!["u27.preview.selection-flow-handle-mismatch".into()]);
        }
        if !self.inventories.contains_key(&selection.inventory) {
            return Err(vec!["u27.preview.selection-inventory-handle-stale".into()]);
        }
        let tool = self.resolve_tool(&request.tool_handle, ExistingToolKind::FitProfileCapture)?;
        let (candidate, receipt, configuration_source) =
            if let Some(bundle) = self.imports.get(&request.flow_handle) {
                if request.manual_context_tokens.is_some() {
                    return Err(vec![
                        "u27.preview.imported-context-override-prohibited".into()
                    ]);
                }
                (
                    bundle.handoff.selected_candidate.clone(),
                    bundle.compatibility_admission.clone(),
                    "website-handoff".to_string(),
                )
            } else if self.manual_flows.contains_key(&request.flow_handle) {
                let context_tokens = request
                    .manual_context_tokens
                    .ok_or_else(|| vec!["u27.manual.context-required".into()])?;
                let (candidate, receipt) = manual_capture_candidate(
                    &selection.selection,
                    &hardware.target,
                    &tool,
                    context_tokens,
                    request.capture_id.as_str(),
                )?;
                (
                    candidate,
                    receipt,
                    "local-initial-capture-policy-v1".to_string(),
                )
            } else {
                return Err(vec!["u27.preview.flow-handle-invalid".into()]);
            };
        let compatibility = ValidatedCompatibilityAdmissionReceipt::new(receipt)?;
        let prepared = prepare_fit_profile_capture(&FitProfileCapturePreparationRequest {
            capture_id: request.capture_id,
            candidate,
            compatibility_admission: compatibility,
            hardware_target: hardware.target,
            inventory_selection: selection.selection,
            tool,
        })?;
        let handle = self
            .issue_handle("fit-capture")
            .map_err(|error| vec![error])?;
        let preview = FitProfileCapturePreview {
            prepared_capture_handle: handle.token().to_string(),
            capture_id: prepared.capture_id().to_string(),
            protocol_id: FIT_PROFILE_CAPTURE_PROTOCOL_V1.into(),
            artifact: CheckedIdentityPreview {
                path: prepared.artifact_path().to_string_lossy().into_owned(),
                sha256: prepared.artifact_sha256().to_string(),
            },
            tool: CheckedIdentityPreview {
                path: prepared.tool().path().to_string_lossy().into_owned(),
                sha256: prepared.tool().expected_sha256().to_string(),
            },
            context_tokens: prepared
                .invocations()
                .iter()
                .map(|invocation| invocation.context_tokens)
                .collect::<std::collections::BTreeSet<_>>()
                .into_iter()
                .collect(),
            repetitions_per_context: FIT_PROFILE_CAPTURE_REPETITIONS_V1,
            candidate: prepared.candidate().clone(),
            configuration_source,
            warnings: vec![
                "The selected user-owned tool and artifact will be read locally. Child network and filesystem isolation are not enforced.".into(),
                "The result is proposed-unreviewed exact-scope evidence, not a serving authorization or recommendation.".into(),
            ],
            preview_only: true,
            grants_execution_authorization: false,
            grants_serving_authorization: false,
            grants_recommendation_authorization: false,
        };
        self.prepared_fit_captures.insert(handle, prepared);
        Ok(preview)
    }

    /// Moves one sealed preparation into the separately gated execution
    /// boundary. Removal is the replay guard: preview tokens remain
    /// predictable references, never reusable authorization credentials.
    pub fn take_prepared_for_execution(
        &mut self,
        handle: &PreviewHandle,
    ) -> Result<PreparedVerification, String> {
        self.prepared
            .remove(handle)
            .ok_or_else(|| "m-o.execution.prepared-handle-invalid-or-consumed".into())
    }

    /// Same replay rule as verification execution: after the explicit capture
    /// action crosses its boundary, its preview handle is consumed.
    pub fn take_prepared_fit_profile_capture(
        &mut self,
        handle: &PreviewHandle,
    ) -> Result<PreparedFitProfileCapture, String> {
        self.prepared_fit_captures
            .remove(handle)
            .ok_or_else(|| "u27.capture.prepared-handle-invalid-or-consumed".into())
    }
}

fn manual_capture_candidate(
    selection: &VerifiedInventorySelection,
    hardware: &ConfirmedHardwareTarget,
    tool: &ObservedToolIdentityReceipt,
    context_tokens: u64,
    capture_id: &str,
) -> Result<(ExactConfigurationCandidate, CompatibilityAdmissionReceipt), Vec<String>> {
    let mut issues = Vec::new();
    if !selection.format().eq_ignore_ascii_case("gguf") {
        issues.push("u27.manual.gguf-required".into());
    }
    if context_tokens < 1
        || context_tokens
            .checked_mul(4)
            .is_none_or(|expanded| expanded > selection.max_context_tokens())
    {
        issues.push("u27.manual.context-outside-artifact-limit".into());
    }
    if tool.observed_product() != "llama-cpp" || tool.observed_engine() != "llama.cpp" {
        issues.push("u27.manual.llama-cpp-tool-required".into());
    }
    if tool.observed_engine_build() != LOCAL_CAPTURE_LLAMA_CPP_BUILD_V1 {
        issues.push("u27.manual.runtime-build-unsupported".into());
    }
    if hardware.effective_target().os.family != crate::contracts::OsFamily::Windows {
        issues.push("u27.manual.windows-required".into());
    }
    if !cfg!(target_arch = "x86_64") {
        issues.push("u27.manual.x86-64-required".into());
    }
    if !hardware
        .effective_target()
        .accelerators
        .iter()
        .any(|accelerator| accelerator.backend == AcceleratorBackend::Cuda)
    {
        issues.push("u27.manual.cuda-hardware-required".into());
    }
    let Some(threads) = hardware.effective_target().cpu.logical_cores else {
        issues.push("u27.manual.logical-cores-required".into());
        return Err(issues);
    };
    if !issues.is_empty() {
        issues.sort();
        issues.dedup();
        return Err(issues);
    }

    let candidate_id = format!("local-capture-candidate-{capture_id}");
    let runtime_configuration_id = format!("local-capture-runtime-{capture_id}");
    let build = tool.observed_engine_build().to_string();
    let candidate = ExactConfigurationCandidate {
        candidate_id: candidate_id.clone(),
        model_family: ModelFamily {
            model_family_id: selection.model_family_id().to_string(),
            display_name: selection.model_family_display_name().to_string(),
        },
        artifact: Artifact {
            artifact_id: selection.artifact_id().to_string(),
            repository: selection.repository().to_string(),
            revision: selection.revision().to_string(),
            filename: selection.filename().to_string(),
            sha256: selection.sha256().to_string(),
            bytes: selection.bytes(),
            format: selection.format().to_string(),
            quantization: selection.quantization().to_string(),
            license: selection.license().to_string(),
            status: ArtifactStatus::Promoted,
        },
        runtime: RuntimeConfiguration {
            runtime_configuration_id: runtime_configuration_id.clone(),
            product: "llama-cpp".into(),
            engine: "llama.cpp".into(),
            engine_build: Some(build.clone()),
            backend: AcceleratorBackend::Cuda,
            chat_template: Some(selection.chat_template().to_string()),
            context_tokens,
            kv_cache: KvCache {
                key: Some("f16".into()),
                value: Some("f16".into()),
            },
            gpu_layers: Some(GpuLayers::All(GpuLayersAll::All)),
            batch_size: Some(2_048),
            micro_batch_size: Some(512),
            parallelism: Some(1),
            threads: Some(threads),
            flash_attention: Some(true),
            mmap: Some(true),
            sampler: Sampler {
                temperature: None,
                top_p: None,
                top_k: None,
                min_p: None,
                seed: None,
            },
            additional_flags: vec![],
        },
        provenance: selection.provenance().to_vec(),
    };
    let receipt = CompatibilityAdmissionReceipt {
        compatibility_admission_id: format!("local-capture-admission-{capture_id}"),
        receipt_version: 1,
        policy: CompatibilityAdmissionPolicy {
            id: "m-e.compatibility".into(),
            version: "1".into(),
        },
        candidate_id,
        artifact_id: selection.artifact_id().to_string(),
        artifact_sha256: selection.sha256().to_string(),
        runtime_configuration_id,
        decision: CompatibilityAdmissionDecision::Admitted,
        target: CompatibilityAdmissionTarget {
            product: "llama-cpp".into(),
            engine: "llama.cpp".into(),
            engine_build: build.clone(),
            runtime_version: None,
            exact_build: Some(build.clone()),
            operating_system: crate::contracts::OsFamily::Windows,
            cpu_architecture: CpuArchitecture::X86_64,
            backend: AcceleratorBackend::Cuda,
            feature_flags: vec![],
            package_layout: ArtifactPackageLayout::GgufSingle,
            declared_package_files: vec![selection.filename().to_string()],
            model_architecture: None,
            quantization_scheme: selection.quantization().to_string(),
        },
        assertion: CompatibilityAdmissionAssertion {
            artifact_id: selection.artifact_id().to_string(),
            product_id: "llama-cpp".into(),
            engine_id: "llama.cpp".into(),
            status: CompatibilityAssertionStatus::Experimental,
            runtime_constraint: CompatibilityRuntimeConstraint {
                min_version: None,
                max_version: None,
                exact_build: Some(build),
            },
            conditions: CompatibilityAdmissionConditions {
                operating_systems: Some(vec!["windows".into()]),
                cpu_architectures: Some(vec!["x86_64".into()]),
                backends: Some(vec!["cuda".into()]),
                model_architectures: None,
                package_layouts: Some(vec!["gguf-single".into()]),
                quantization_schemes: Some(vec![selection.quantization().to_string()]),
                required_files: Some(vec![selection.filename().to_string()]),
                limitations: Some(vec![
                    "Initial local memory capture only; successful tool parsing is still required."
                        .into(),
                    "Does not authorize recommendation, serving, or any additional capability."
                        .into(),
                ]),
            },
            evidence: vec![CompatibilityAdmissionEvidence {
                url: "https://github.com/ggml-org/llama.cpp/blob/master/tools/fit-params/README.md"
                    .into(),
                checked_at: "2026-07-23T00:00:00Z".into(),
                source_revision: None,
            }],
        },
    };
    Ok((candidate, receipt))
}

fn hardware_difference_preview(
    value: &crate::hardware_confirmation::HardwareDifference,
) -> HardwareDifferencePreview {
    HardwareDifferencePreview {
        field: value.field.clone(),
        imported: value.imported.clone(),
        resolved: value.resolved.clone(),
        kind: match value.kind {
            crate::hardware_confirmation::DifferenceKind::Informational => "informational",
            crate::hardware_confirmation::DifferenceKind::Normalized => "normalized",
            crate::hardware_confirmation::DifferenceKind::ConfirmationRequired => {
                "confirmation-required"
            }
        }
        .into(),
        reason_code: value.reason_code.clone(),
    }
}

/// Parse a process-local reference. Tokens are deliberately predictable and
/// are never authorization credentials or durable sessions.
pub fn parse_handle(token: &str) -> Result<PreviewHandle, String> {
    if token.trim().is_empty()
        || !token
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
    {
        return Err("m-o.preview.handle-malformed".into());
    }
    Ok(PreviewHandle(token.to_string()))
}

pub fn local_inventory_path(value: &str) -> Result<std::path::PathBuf, String> {
    let path = std::path::PathBuf::from(value);
    let normalized = value.replace('/', "\\");
    if value.trim().is_empty()
        || !path.is_absolute()
        || normalized.starts_with("\\\\")
        || value.contains("://")
    {
        return Err("m-o.preview.inventory-path-not-local-absolute".into());
    }
    if cfg!(windows) {
        let bytes = normalized.as_bytes();
        let valid_drive = bytes.len() >= 3
            && bytes[0].is_ascii_alphabetic()
            && bytes[1] == b':'
            && bytes[2] == b'\\';
        if !valid_drive || normalized[2..].contains(':') {
            return Err("m-o.preview.inventory-path-not-local-absolute".into());
        }
    }
    Ok(path)
}

pub fn map_preflight(report: &PreflightReport) -> Preflight {
    let power = match report.ac_power {
        Some(true) => Power::Ac,
        Some(false) => Power::Battery,
        None => Power::Unknown,
    };
    let thermal = match report.thermal_celsius {
        Some(value) if value >= 85.0 => Thermal::Adverse,
        Some(_) => Thermal::Acceptable,
        None => Thermal::Unknown,
    };
    let mut conditions = report.warnings.clone();
    if let Some(reason) = &report.thermal_unavailable_reason {
        conditions.push(format!("thermal status unavailable: {reason}"));
    }
    conditions.push(
        "concurrent GPU activity is unknown; this read-only preflight has no GPU-activity sensor"
            .into(),
    );
    Preflight {
        power,
        thermal,
        concurrent_gpu: ConcurrentGpu::Unknown,
        requires_confirmation: true,
        conditions,
    }
}

fn preview_from_prepared(
    handle: &PreviewHandle,
    prepared: &PreparedVerification,
) -> VerificationPlanPreview {
    let checked = |value: &crate::verification::CheckedFileIdentity| CheckedIdentityPreview {
        path: value.path.to_string_lossy().into_owned(),
        sha256: value.sha256.clone(),
    };
    VerificationPlanPreview {
        prepared_handle: handle.token().to_string(),
        plan: prepared.plan().clone(),
        artifact: checked(prepared.artifact()),
        benchmark_tool: prepared.benchmark_tool().map(checked),
        quick_check_tool: prepared.quick_check_tool().map(checked),
        warnings: prepared.warnings().to_vec(),
        preview_only: true,
        grants_execution_authorization: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::hardware_target::{HardwareResolution, ResolutionState};
    use crate::model_store::inventory::{
        ArtifactIdentityV1, InventoryArtifact, InventoryArtifactResolution, InventoryData,
        InventoryStatus, ModelFamilyV1, PromotedStatus, RegistryArtifactIdentityV1,
        RegistryMetadataV1, SelectedFileHashBoundary, SelectedFileSnapshot,
    };
    use std::cell::Cell;
    use std::collections::BTreeMap;
    use std::path::Path;

    const BUNDLE: &str =
        include_str!("../../../docs/contracts/fixtures/runner-import-bundle.ok.json");

    fn handle(value: &str) -> PreviewHandle {
        parse_handle(value).unwrap()
    }

    fn verified_inventory(path: &str) -> InventoryResult {
        InventoryResult {
            status: InventoryStatus::Ok,
            data: InventoryData {
                registry_snapshot_id: Some("fixture".into()),
                registry_last_ingest_succeeded_at: Some("2026-07-22T12:00:00Z".into()),
                stores: vec![],
                artifacts: vec![InventoryArtifact {
                    path: path.into(),
                    store: "fixture".into(),
                    label: "fixture-Q4_K_M.gguf".into(),
                    file_size_bytes: 2_491_323_904,
                    sha256: Some("a".repeat(64)),
                    resolution: InventoryArtifactResolution::Verified {
                        identity: Box::new(RegistryArtifactIdentityV1 {
                            model_family: ModelFamilyV1 {
                                model_family_id: "qwen3-4b".into(),
                                display_name: "Qwen3 4B".into(),
                            },
                            artifact: ArtifactIdentityV1 {
                                artifact_id: "artifact-fixture".into(),
                                repository: "example/fixture".into(),
                                revision: "0123456789abcdef".into(),
                                filename: "fixture-Q4_K_M.gguf".into(),
                                sha256: "a".repeat(64),
                                bytes: 2_491_323_904,
                                format: "GGUF".into(),
                                quantization: "Q4_K_M".into(),
                                license: "apache-2.0".into(),
                                status: PromotedStatus::Promoted,
                            },
                            provenance: vec![],
                            registry_metadata: RegistryMetadataV1 {
                                publisher: "fixture".into(),
                                base_model: "fixture".into(),
                                model: "fixture".into(),
                                max_context_tokens: 32_768,
                                chat_template: "chatml".into(),
                                license_source_url: "https://example.invalid/license".into(),
                                field_provenance: BTreeMap::new(),
                            },
                        }),
                    },
                }],
                duplicate_groups: vec![],
                unreadable: vec![],
                provenance: "detected-local".into(),
            },
            warnings: vec![],
        }
    }

    fn size_candidate_inventory(path: &str) -> InventoryResult {
        let mut inventory = verified_inventory(path);
        let identity = match &inventory.data.artifacts[0].resolution {
            InventoryArtifactResolution::Verified { identity } => (**identity).clone(),
            _ => unreachable!("fixture starts verified"),
        };
        inventory.status = InventoryStatus::Partial;
        inventory.data.artifacts[0].sha256 = None;
        inventory.data.artifacts[0].resolution = InventoryArtifactResolution::CandidateBySize {
            candidates: vec![identity],
        };
        inventory.warnings =
            vec!["One or more local files do not have verified promoted identity.".into()];
        inventory
    }

    struct StableHashBoundary {
        snapshots: Cell<usize>,
    }

    impl SelectedFileHashBoundary for StableHashBoundary {
        type Guard = ();

        fn open_guard(&self, _path: &Path) -> Result<Self::Guard, String> {
            Ok(())
        }

        fn snapshot(&self, _guard: &Self::Guard) -> Result<SelectedFileSnapshot, String> {
            self.snapshots.set(self.snapshots.get() + 1);
            Ok(SelectedFileSnapshot {
                regular_file: true,
                size_bytes: 2_491_323_904,
                modified_unix_nanos: 1,
            })
        }

        fn sha256(&self, _guard: &Self::Guard) -> Result<String, String> {
            Ok("a".repeat(64))
        }
    }

    #[test]
    fn expired_bundle_requires_confirmation_and_never_authorizes() {
        let mut assembler = PreviewAssembler::default();
        assert_eq!(
            assembler
                .admit_import_bundle_at(BUNDLE, 1_784_894_400, false)
                .unwrap_err(),
            vec!["m-o.preview.import-expired-confirmation-required"]
        );
        let preview = assembler
            .admit_import_bundle_at(BUNDLE, 1_784_894_400, true)
            .unwrap();
        assert!(preview.expired);
        assert!(preview.preview_only);
        assert!(!preview.grants_execution_authorization);
        assert_eq!(preview.warnings.len(), 1);
    }

    #[test]
    fn manual_flow_builds_an_inspectable_capture_without_a_website_bundle() {
        let mut assembler = PreviewAssembler::default();
        let fixture_bundle = assembler
            .admit_import_bundle_at(BUNDLE, 1_784_725_200, false)
            .unwrap();
        let target = assembler
            .imported_hardware_target(&handle(&fixture_bundle.import_handle))
            .unwrap();
        let manual = assembler
            .begin_manual_hardware_evaluation(&HardwareResolution {
                state: ResolutionState::Ready,
                target: Some(target),
                reason_codes: vec![],
                confirmation_fields: vec![],
                memory_variant_options: vec![],
                warnings: vec![],
            })
            .unwrap();
        let hardware = assembler
            .confirm_hardware_evaluation(&handle(&manual.evaluation.evaluation_handle), None)
            .unwrap();
        let inventory = assembler
            .retain_adapted_inventory(verified_inventory("C:\\models\\fixture-Q4_K_M.gguf"))
            .unwrap();
        let selection = assembler
            .select_inventory_path(
                &handle(&manual.flow_handle),
                &handle(&inventory.inventory_handle),
                "C:\\models\\fixture-Q4_K_M.gguf",
            )
            .unwrap();
        let tool = assembler.issue_handle("tool").unwrap();
        assembler.tools.insert(
            tool.clone(),
            ObservedToolIdentityReceipt::new(
                ExistingToolKind::FitProfileCapture,
                "C:\\tools\\llama-fit-params.exe".into(),
                "d".repeat(64),
                "llama-cpp".into(),
                "llama.cpp".into(),
                "b10061 (5d5306bf3)".into(),
                "llama-cpp-version-v1".into(),
                "fixture".into(),
            )
            .unwrap(),
        );

        let preview = assembler
            .prepare_fit_profile_capture_preview(PrepareFitProfileCapturePreviewRequest {
                flow_handle: handle(&manual.flow_handle),
                hardware_handle: handle(&hardware.hardware_handle),
                selection_handle: handle(&selection.selection_handle),
                tool_handle: tool,
                capture_id: "manual-fixture".into(),
                manual_context_tokens: Some(4_096),
            })
            .unwrap();

        assert_eq!(
            preview.configuration_source,
            "local-initial-capture-policy-v1"
        );
        assert_eq!(preview.context_tokens, vec![4_096, 16_384]);
        assert_eq!(preview.candidate.runtime.batch_size, Some(2_048));
        assert!(!preview.grants_execution_authorization);
        assert!(!preview.grants_recommendation_authorization);

        let unsupported_tool = assembler.issue_handle("tool").unwrap();
        assembler.tools.insert(
            unsupported_tool.clone(),
            ObservedToolIdentityReceipt::new(
                ExistingToolKind::FitProfileCapture,
                "C:\\tools\\llama-fit-params.exe".into(),
                "e".repeat(64),
                "llama-cpp".into(),
                "llama.cpp".into(),
                "b10062 (6d5306bf3)".into(),
                "llama-cpp-version-v1".into(),
                "fixture".into(),
            )
            .unwrap(),
        );
        assert_eq!(
            assembler
                .prepare_fit_profile_capture_preview(PrepareFitProfileCapturePreviewRequest {
                    flow_handle: handle(&manual.flow_handle),
                    hardware_handle: handle(&hardware.hardware_handle),
                    selection_handle: handle(&selection.selection_handle),
                    tool_handle: unsupported_tool,
                    capture_id: "unsupported-build".into(),
                    manual_context_tokens: Some(4_096),
                })
                .unwrap_err(),
            vec!["u27.manual.runtime-build-unsupported"]
        );
    }

    #[test]
    fn manual_flow_visibly_scopes_one_cuda_gpu_from_an_integrated_adapter() {
        let mut assembler = PreviewAssembler::default();
        let fixture_bundle = assembler
            .admit_import_bundle_at(BUNDLE, 1_784_725_200, false)
            .unwrap();
        let mut target = assembler
            .imported_hardware_target(&handle(&fixture_bundle.import_handle))
            .unwrap();
        let mut integrated = target.accelerators[0].clone();
        integrated.accelerator_id = None;
        integrated.display_name = "Integrated graphics".into();
        integrated.backend = AcceleratorBackend::Other;
        target.accelerators.push(integrated);
        let manual = assembler
            .begin_manual_hardware_evaluation(&HardwareResolution {
                state: ResolutionState::ConfirmationRequired,
                target: Some(target),
                reason_codes: vec!["hardware.multiple-device-selection-required".into()],
                confirmation_fields: vec!["/accelerators".into()],
                memory_variant_options: vec![],
                warnings: vec!["Integrated adapter requires scoping.".into()],
            })
            .unwrap();

        assert_eq!(manual.evaluation.state, "confirmation-required");
        assert_eq!(
            manual.evaluation.reason_codes,
            vec!["hardware.manual-cuda-device-selected"]
        );
        assert!(manual
            .evaluation
            .warnings
            .iter()
            .any(|warning| warning.contains("scoped to the one detected CUDA GPU")));
        let confirmation = HardwareConfirmationAcknowledgement {
            reason_codes: manual.evaluation.reason_codes.clone(),
            confirmation_fields: manual.evaluation.confirmation_fields.clone(),
        };
        assert!(assembler
            .confirm_hardware_evaluation(
                &handle(&manual.evaluation.evaluation_handle),
                Some(&confirmation),
            )
            .is_ok());
    }

    #[test]
    fn selection_is_bound_to_the_import_that_admitted_it() {
        let mut assembler = PreviewAssembler::default();
        let import_a = assembler
            .admit_import_bundle_at(BUNDLE, 1_784_725_200, false)
            .unwrap();
        let import_b = assembler
            .admit_import_bundle_at(BUNDLE, 1_784_725_200, false)
            .unwrap();
        let import_a = handle(&import_a.import_handle);
        let import_b = handle(&import_b.import_handle);

        let inventory = assembler
            .retain_adapted_inventory(verified_inventory("C:\\models\\fixture-Q4_K_M.gguf"))
            .unwrap();
        let selection = assembler
            .select_inventory_path(
                &import_a,
                &handle(&inventory.inventory_handle),
                "C:\\models\\fixture-Q4_K_M.gguf",
            )
            .unwrap();

        let imported = assembler.imported_hardware_target(&import_b).unwrap();
        let resolution = HardwareResolution {
            state: ResolutionState::Ready,
            target: Some(imported),
            reason_codes: vec![],
            confirmation_fields: vec![],
            memory_variant_options: vec![],
            warnings: vec![],
        };
        let evaluation = assembler.evaluate_hardware(&import_b, &resolution).unwrap();
        let hardware = assembler
            .confirm_hardware_evaluation(&handle(&evaluation.evaluation_handle), None)
            .unwrap();

        let imported_a = assembler.imported_hardware_target(&import_a).unwrap();
        let resolution_a = HardwareResolution {
            state: ResolutionState::Ready,
            target: Some(imported_a),
            reason_codes: vec![],
            confirmation_fields: vec![],
            memory_variant_options: vec![],
            warnings: vec![],
        };
        let evaluation_a = assembler
            .evaluate_hardware(&import_a, &resolution_a)
            .unwrap();
        let hardware_a = assembler
            .confirm_hardware_evaluation(&handle(&evaluation_a.evaluation_handle), None)
            .unwrap();
        assert_eq!(
            assembler
                .prepare_preview_with_preflight(
                    PreparePreviewRequest {
                        import_handle: import_b.clone(),
                        hardware_handle: handle(&hardware_a.hardware_handle),
                        selection_handle: handle(&selection.selection_handle),
                        verification_plan_id: "verification-fixture".into(),
                        benchmark: None,
                        quick_check: None,
                    },
                    crate::preflight::evaluate(crate::preflight::PreflightInputs {
                        cpu_load_percent: 1.0,
                        available_memory_gb: 24.0,
                        total_memory_gb: 32.0,
                        ac_power: Some(true),
                        thermal_celsius: None,
                        thermal_unavailable_reason: Some("not available".into()),
                    })
                )
                .unwrap_err(),
            vec!["m-o.preview.hardware-import-handle-mismatch"]
        );

        assert_eq!(
            assembler
                .prepare_preview_with_preflight(
                    PreparePreviewRequest {
                        import_handle: import_b,
                        hardware_handle: handle(&hardware.hardware_handle),
                        selection_handle: handle(&selection.selection_handle),
                        verification_plan_id: "verification-fixture".into(),
                        benchmark: None,
                        quick_check: None,
                    },
                    crate::preflight::evaluate(crate::preflight::PreflightInputs {
                        cpu_load_percent: 1.0,
                        available_memory_gb: 24.0,
                        total_memory_gb: 32.0,
                        ac_power: Some(true),
                        thermal_celsius: None,
                        thermal_unavailable_reason: Some("not available".into()),
                    })
                )
                .unwrap_err(),
            vec!["m-o.preview.selection-import-handle-mismatch"]
        );
    }

    #[test]
    fn explicit_hash_promotion_returns_non_authorizing_opaque_selection() {
        let mut assembler = PreviewAssembler::default();
        let import = assembler
            .admit_import_bundle_at(BUNDLE, 1_784_725_200, false)
            .unwrap();
        let import = handle(&import.import_handle);
        let inventory = assembler
            .retain_adapted_inventory(size_candidate_inventory("C:\\models\\fixture-Q4_K_M.gguf"))
            .unwrap();
        let boundary = StableHashBoundary {
            snapshots: Cell::new(0),
        };

        let promoted = assembler
            .hash_and_select_inventory_path_with_boundary(
                &import,
                &handle(&inventory.inventory_handle),
                "C:\\models\\fixture-Q4_K_M.gguf",
                &boundary,
            )
            .unwrap();

        assert!(promoted.selection_handle.starts_with("selection-"));
        assert_eq!(promoted.status, "verified");
        assert_eq!(promoted.artifact_id, "artifact-fixture");
        assert_eq!(promoted.sha256, "a".repeat(64));
        assert_eq!(promoted.bytes, 2_491_323_904);
        assert!(promoted.preview_only);
        assert!(!promoted.grants_execution_authorization);
        assert_eq!(boundary.snapshots.get(), 2);
    }

    #[test]
    fn hardware_preview_exposes_exact_difference_and_acknowledged_effective_target() {
        let mut assembler = PreviewAssembler::default();
        let import = assembler
            .admit_import_bundle_at(BUNDLE, 1_784_725_200, false)
            .unwrap();
        let import = handle(&import.import_handle);
        let imported = assembler.imported_hardware_target(&import).unwrap();
        let mut resolved = imported.clone();
        resolved.memory.total_ram_bytes -= 512 * 1024 * 1024;
        let resolution = HardwareResolution {
            state: ResolutionState::Ready,
            target: Some(resolved.clone()),
            reason_codes: vec![],
            confirmation_fields: vec![],
            memory_variant_options: vec![],
            warnings: vec![],
        };

        let evaluation = assembler.evaluate_hardware(&import, &resolution).unwrap();
        assert_eq!(evaluation.state, "confirmation-required");
        assert_eq!(evaluation.differences.len(), 1);
        assert_eq!(evaluation.differences[0].field, "/memory/totalRamBytes");
        assert_eq!(evaluation.differences[0].kind, "confirmation-required");
        assert_eq!(
            evaluation.differences[0].resolved,
            Some(resolved.memory.total_ram_bytes.to_string())
        );

        let acknowledgement = HardwareConfirmationAcknowledgement {
            reason_codes: evaluation.reason_codes.clone(),
            confirmation_fields: evaluation.confirmation_fields.clone(),
        };
        let confirmed = assembler
            .confirm_hardware_evaluation(
                &handle(&evaluation.evaluation_handle),
                Some(&acknowledgement),
            )
            .unwrap();
        assert_eq!(
            confirmed.effective_target.memory.total_ram_bytes,
            resolved.memory.total_ram_bytes
        );
        assert_eq!(confirmed.resolved_target, resolved);
        assert_eq!(
            confirmed.acknowledged_reason_codes,
            acknowledgement.reason_codes
        );
        assert_eq!(
            confirmed.acknowledged_confirmation_fields,
            acknowledgement.confirmation_fields
        );
        assert!(!confirmed.grants_execution_authorization);
    }

    #[test]
    fn preflight_keeps_unknown_gpu_visible_and_confirmation_required() {
        let mapped = map_preflight(&crate::preflight::evaluate(
            crate::preflight::PreflightInputs {
                cpu_load_percent: 1.0,
                available_memory_gb: 24.0,
                total_memory_gb: 32.0,
                ac_power: Some(true),
                thermal_celsius: Some(50.0),
                thermal_unavailable_reason: None,
            },
        ));
        assert_eq!(mapped.concurrent_gpu, ConcurrentGpu::Unknown);
        assert!(mapped.requires_confirmation);
        assert!(mapped
            .conditions
            .iter()
            .any(|condition| condition.contains("GPU activity is unknown")));
    }

    #[test]
    fn inventory_path_rejects_network_relative_and_ads_routes() {
        for value in [
            r"\\server\share\models",
            r"relative\models",
            r"C:\models\file.gguf:stream",
            r"\\?\C:\models",
        ] {
            assert!(local_inventory_path(value).is_err(), "{value}");
        }
        if cfg!(windows) {
            assert_eq!(
                local_inventory_path(r"C:\models").unwrap(),
                std::path::PathBuf::from(r"C:\models")
            );
        }
    }
}

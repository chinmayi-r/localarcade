//! Process-local M-D hardware confirmation core.
//!
//! This module compares the complete imported target with a separately
//! resolved detector target. It exposes no Tauri command, performs no
//! detection, and has no serializable "confirmed" constructor.

use crate::contracts::{Accelerator, HardwareTarget, Origin};
use crate::hardware_target::{HardwareResolution, ResolutionState};
use std::collections::{BTreeSet, HashMap};

const ONE_GIB: u64 = 1u64 << 30;
const TOTAL_RAM_PERCENT: u128 = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HardwareConfirmationState {
    Ready,
    ConfirmationRequired,
    Blocked,
    Unavailable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DifferenceKind {
    Informational,
    Normalized,
    ConfirmationRequired,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HardwareDifference {
    pub field: String,
    pub imported: Option<String>,
    pub resolved: Option<String>,
    pub kind: DifferenceKind,
    pub reason_code: String,
}

/// Exact acknowledgement of the fields and reasons shown by an evaluation.
/// An acknowledgement is not reusable authority and is never serialized.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HardwareConfirmationAcknowledgement {
    pub reason_codes: Vec<String>,
    pub confirmation_fields: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct HardwareConfirmationEvaluation {
    state: HardwareConfirmationState,
    imported_target: HardwareTarget,
    resolved_target: Option<HardwareTarget>,
    effective_target: Option<HardwareTarget>,
    reason_codes: Vec<String>,
    confirmation_fields: Vec<String>,
    differences: Vec<HardwareDifference>,
    warnings: Vec<String>,
}

impl HardwareConfirmationEvaluation {
    pub fn state(&self) -> HardwareConfirmationState {
        self.state
    }

    pub fn imported_target(&self) -> &HardwareTarget {
        &self.imported_target
    }

    pub fn resolved_target(&self) -> Option<&HardwareTarget> {
        self.resolved_target.as_ref()
    }

    pub fn effective_target(&self) -> Option<&HardwareTarget> {
        self.effective_target.as_ref()
    }

    pub fn reason_codes(&self) -> &[String] {
        &self.reason_codes
    }

    pub fn confirmation_fields(&self) -> &[String] {
        &self.confirmation_fields
    }

    pub fn differences(&self) -> &[HardwareDifference] {
        &self.differences
    }

    pub fn warnings(&self) -> &[String] {
        &self.warnings
    }
}

/// Sealed evidence retained only inside the process-local store.
#[derive(Debug, Clone, PartialEq)]
pub struct HardwareConfirmationReceipt {
    imported_target: HardwareTarget,
    resolved_target: HardwareTarget,
    effective_target: HardwareTarget,
    differences: Vec<HardwareDifference>,
    acknowledged_reason_codes: Vec<String>,
    acknowledged_confirmation_fields: Vec<String>,
}

impl HardwareConfirmationReceipt {
    pub fn imported_target(&self) -> &HardwareTarget {
        &self.imported_target
    }

    pub fn resolved_target(&self) -> &HardwareTarget {
        &self.resolved_target
    }

    /// Conservative target for planning. The imported identifier is retained
    /// for handoff binding; detected lower capacities are never rounded up.
    pub fn effective_target(&self) -> &HardwareTarget {
        &self.effective_target
    }

    pub fn differences(&self) -> &[HardwareDifference] {
        &self.differences
    }

    pub fn acknowledged_reason_codes(&self) -> &[String] {
        &self.acknowledged_reason_codes
    }

    pub fn acknowledged_confirmation_fields(&self) -> &[String] {
        &self.acknowledged_confirmation_fields
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct HardwareConfirmationHandle(u64);

#[derive(Debug, Default)]
pub struct HardwareConfirmationStore {
    next_handle: u64,
    receipts: HashMap<u64, HardwareConfirmationReceipt>,
}

impl HardwareConfirmationStore {
    pub fn insert(
        &mut self,
        evaluation: &HardwareConfirmationEvaluation,
        acknowledgement: Option<&HardwareConfirmationAcknowledgement>,
    ) -> Result<HardwareConfirmationHandle, String> {
        if matches!(
            evaluation.state,
            HardwareConfirmationState::Blocked | HardwareConfirmationState::Unavailable
        ) {
            return Err("m-d.hardware-confirmation.not-admissible".into());
        }

        match evaluation.state {
            HardwareConfirmationState::Ready => {
                if acknowledgement.is_some() {
                    return Err("m-d.hardware-confirmation.unexpected-acknowledgement".into());
                }
            }
            HardwareConfirmationState::ConfirmationRequired => {
                let acknowledgement = acknowledgement.ok_or_else(|| {
                    "m-d.hardware-confirmation.acknowledgement-required".to_string()
                })?;
                if !exact_unique_set(&acknowledgement.reason_codes, &evaluation.reason_codes)
                    || !exact_unique_set(
                        &acknowledgement.confirmation_fields,
                        &evaluation.confirmation_fields,
                    )
                {
                    return Err("m-d.hardware-confirmation.acknowledgement-mismatch".into());
                }
            }
            HardwareConfirmationState::Blocked | HardwareConfirmationState::Unavailable => {
                unreachable!("handled above")
            }
        }

        let resolved_target = evaluation
            .resolved_target
            .clone()
            .ok_or_else(|| "m-d.hardware-confirmation.resolved-target-missing".to_string())?;
        let effective_target = evaluation
            .effective_target
            .clone()
            .ok_or_else(|| "m-d.hardware-confirmation.effective-target-missing".to_string())?;
        self.next_handle = self
            .next_handle
            .checked_add(1)
            .ok_or_else(|| "m-d.hardware-confirmation.handle-space-exhausted".to_string())?;
        let handle = HardwareConfirmationHandle(self.next_handle);
        self.receipts.insert(
            handle.0,
            HardwareConfirmationReceipt {
                imported_target: evaluation.imported_target.clone(),
                resolved_target,
                effective_target,
                differences: evaluation.differences.clone(),
                acknowledged_reason_codes: acknowledgement
                    .map(|value| value.reason_codes.clone())
                    .unwrap_or_default(),
                acknowledged_confirmation_fields: acknowledgement
                    .map(|value| value.confirmation_fields.clone())
                    .unwrap_or_default(),
            },
        );
        Ok(handle)
    }

    pub fn get(&self, handle: HardwareConfirmationHandle) -> Option<&HardwareConfirmationReceipt> {
        self.receipts.get(&handle.0)
    }
}

pub fn evaluate_hardware_confirmation(
    imported: &HardwareTarget,
    resolution: &HardwareResolution,
) -> HardwareConfirmationEvaluation {
    let mut evaluation = HardwareConfirmationEvaluation {
        state: HardwareConfirmationState::Ready,
        imported_target: imported.clone(),
        resolved_target: resolution.target.clone(),
        effective_target: resolution.target.clone().map(|mut target| {
            target.hardware_target_id = imported.hardware_target_id.clone();
            target
        }),
        reason_codes: Vec::new(),
        confirmation_fields: Vec::new(),
        differences: Vec::new(),
        warnings: resolution.warnings.clone(),
    };

    if imported.hardware_target_id.trim().is_empty() {
        block(
            &mut evaluation,
            "m-d.hardware-confirmation.imported-target-id-missing",
        );
    }
    if resolution.state == ResolutionState::Unavailable {
        evaluation.state = HardwareConfirmationState::Unavailable;
        push_unique(
            &mut evaluation.reason_codes,
            "m-d.hardware-confirmation.resolution-unavailable",
        );
        evaluation.effective_target = None;
        return evaluation;
    }
    let Some(resolved) = resolution.target.as_ref() else {
        evaluation.state = HardwareConfirmationState::Unavailable;
        push_unique(
            &mut evaluation.reason_codes,
            "m-d.hardware-confirmation.resolved-target-missing",
        );
        evaluation.effective_target = None;
        return evaluation;
    };
    if resolved.hardware_target_id.trim().is_empty() {
        block(
            &mut evaluation,
            "m-d.hardware-confirmation.resolved-target-id-missing",
        );
    }

    if imported.hardware_target_id != resolved.hardware_target_id {
        difference(
            &mut evaluation,
            "/hardwareTargetId",
            Some(imported.hardware_target_id.clone()),
            Some(resolved.hardware_target_id.clone()),
            DifferenceKind::Informational,
            "m-d.hardware-confirmation.target-id-not-authority",
        );
    }
    if imported.os.family != resolved.os.family {
        block(
            &mut evaluation,
            "m-d.hardware-confirmation.os-family-mismatch",
        );
    }
    visible_optional(
        &mut evaluation,
        "/os/version",
        imported.os.version.as_ref(),
        resolved.os.version.as_ref(),
        "m-d.hardware-confirmation.os-version-difference",
    );
    visible_optional(
        &mut evaluation,
        "/cpu/displayName",
        imported.cpu.display_name.as_ref(),
        resolved.cpu.display_name.as_ref(),
        "m-d.hardware-confirmation.cpu-display-name-difference",
    );
    visible_optional(
        &mut evaluation,
        "/cpu/logicalCores",
        imported.cpu.logical_cores.as_ref(),
        resolved.cpu.logical_cores.as_ref(),
        "m-d.hardware-confirmation.logical-cores-difference",
    );
    visible_optional(
        &mut evaluation,
        "/memory/availableRamBytes",
        imported.memory.available_ram_bytes.as_ref(),
        resolved.memory.available_ram_bytes.as_ref(),
        "m-d.hardware-confirmation.available-ram-difference",
    );
    if imported.field_origins != resolved.field_origins {
        difference(
            &mut evaluation,
            "/fieldOrigins",
            Some(format!("{:?}", imported.field_origins)),
            Some(format!("{:?}", resolved.field_origins)),
            DifferenceKind::Informational,
            "m-d.hardware-confirmation.origins-difference",
        );
    }

    match (imported.memory.unified, resolved.memory.unified) {
        (Some(imported_unified), Some(resolved_unified))
            if imported_unified == resolved_unified => {}
        (Some(_), Some(_)) => block(
            &mut evaluation,
            "m-d.hardware-confirmation.unified-memory-mismatch",
        ),
        _ => block(
            &mut evaluation,
            "m-d.hardware-confirmation.unified-memory-fact-missing",
        ),
    }

    evaluate_total_ram(imported, resolved, &mut evaluation);
    evaluate_accelerators(imported, resolved, resolution, &mut evaluation);

    if resolution.state == ResolutionState::ConfirmationRequired {
        for reason in &resolution.reason_codes {
            push_unique(&mut evaluation.reason_codes, reason);
        }
        for field in &resolution.confirmation_fields {
            push_unique(&mut evaluation.confirmation_fields, field);
        }
    }

    if evaluation.state != HardwareConfirmationState::Blocked {
        evaluation.state =
            if evaluation.confirmation_fields.is_empty() && evaluation.reason_codes.is_empty() {
                HardwareConfirmationState::Ready
            } else {
                HardwareConfirmationState::ConfirmationRequired
            };
    } else {
        evaluation.effective_target = None;
    }
    evaluation
}

fn evaluate_total_ram(
    imported: &HardwareTarget,
    resolved: &HardwareTarget,
    evaluation: &mut HardwareConfirmationEvaluation,
) {
    let imported_bytes = imported.memory.total_ram_bytes;
    let resolved_bytes = resolved.memory.total_ram_bytes;
    if imported_bytes == resolved_bytes {
        return;
    }
    let difference_bytes = imported_bytes.abs_diff(resolved_bytes);
    let tolerance =
        (((imported_bytes as u128) * TOTAL_RAM_PERCENT) / 100).min(ONE_GIB as u128) as u64;
    if imported_bytes == 0 || resolved_bytes == 0 || difference_bytes > tolerance {
        block(evaluation, "m-d.hardware-confirmation.total-ram-mismatch");
        return;
    }
    difference(
        evaluation,
        "/memory/totalRamBytes",
        Some(imported_bytes.to_string()),
        Some(resolved_bytes.to_string()),
        DifferenceKind::ConfirmationRequired,
        "m-d.hardware-confirmation.total-ram-normalization-confirmation-required",
    );
    push_unique(
        &mut evaluation.reason_codes,
        "m-d.hardware-confirmation.total-ram-normalization-confirmation-required",
    );
    push_unique(&mut evaluation.confirmation_fields, "/memory/totalRamBytes");
    if let Some(effective) = evaluation.effective_target.as_mut() {
        effective.memory.total_ram_bytes = imported_bytes.min(resolved_bytes);
        effective
            .field_origins
            .insert("/memory/totalRamBytes".into(), Origin::Confirmed);
    }
}

fn evaluate_accelerators(
    imported: &HardwareTarget,
    resolved: &HardwareTarget,
    resolution: &HardwareResolution,
    evaluation: &mut HardwareConfirmationEvaluation,
) {
    let mut imported_values = imported.accelerators.iter().collect::<Vec<_>>();
    let mut resolved_values = resolved.accelerators.iter().enumerate().collect::<Vec<_>>();
    imported_values.sort_by_key(|value| accelerator_match_key(value));
    resolved_values.sort_by_key(|(_, value)| accelerator_match_key(value));
    if imported_values.len() != resolved_values.len() {
        block(
            evaluation,
            "m-d.hardware-confirmation.accelerator-cardinality-mismatch",
        );
        return;
    }

    for (imported_accelerator, (resolved_index, resolved_accelerator)) in
        imported_values.into_iter().zip(resolved_values)
    {
        if imported_accelerator
            .accelerator_id
            .as_deref()
            .is_none_or(|value| value.trim().is_empty())
            || resolved_accelerator
                .accelerator_id
                .as_deref()
                .is_none_or(|value| value.trim().is_empty())
        {
            block(
                evaluation,
                "m-d.hardware-confirmation.accelerator-stable-id-missing",
            );
            continue;
        }
        if accelerator_identity(imported_accelerator) != accelerator_identity(resolved_accelerator)
        {
            block(
                evaluation,
                "m-d.hardware-confirmation.accelerator-identity-mismatch",
            );
            continue;
        }
        if imported_accelerator.display_name != resolved_accelerator.display_name {
            difference(
                evaluation,
                "/accelerators/displayName",
                Some(imported_accelerator.display_name.clone()),
                Some(resolved_accelerator.display_name.clone()),
                DifferenceKind::Informational,
                "m-d.hardware-confirmation.accelerator-display-name-difference",
            );
        }
        if imported_accelerator
            .device_memory_bytes
            .is_none_or(|value| value == 0)
            || resolved_accelerator
                .device_memory_bytes
                .is_none_or(|value| value == 0)
        {
            block(
                evaluation,
                "m-d.hardware-confirmation.accelerator-capacity-missing",
            );
            continue;
        }
        if imported_accelerator.device_memory_bytes == resolved_accelerator.device_memory_bytes {
            continue;
        }

        let field = format!("/accelerators/{resolved_index}/deviceMemoryBytes");
        let imported_capacity = imported_accelerator.device_memory_bytes;
        let resolved_capacity = resolved_accelerator.device_memory_bytes;
        let imported_is_registry_nominal = imported_capacity.is_some_and(|bytes| {
            resolution
                .memory_variant_options
                .iter()
                .any(|option| option.field == field && option.bytes == bytes)
        });
        let detector_reported_registry_match = !resolution
            .reason_codes
            .iter()
            .any(|reason| reason == "hardware.device-memory-registry-mismatch")
            && !resolution
                .confirmation_fields
                .iter()
                .any(|value| value == &field);
        if imported_is_registry_nominal
            && detector_reported_registry_match
            && resolved_capacity.is_some_and(|value| value > 0)
        {
            difference(
                evaluation,
                &field,
                imported_capacity.map(|value| value.to_string()),
                resolved_capacity.map(|value| value.to_string()),
                DifferenceKind::ConfirmationRequired,
                "m-d.hardware-confirmation.accelerator-capacity-registry-confirmation-required",
            );
            push_unique(
                &mut evaluation.reason_codes,
                "m-d.hardware-confirmation.accelerator-capacity-registry-confirmation-required",
            );
            push_unique(&mut evaluation.confirmation_fields, field.clone());
            if let (Some(effective), Some(detected)) =
                (evaluation.effective_target.as_mut(), resolved_capacity)
            {
                effective.accelerators[resolved_index].device_memory_bytes =
                    Some(imported_capacity.unwrap_or(detected).min(detected));
                effective.field_origins.insert(field, Origin::Confirmed);
            }
        } else {
            block(
                evaluation,
                "m-d.hardware-confirmation.accelerator-capacity-mismatch",
            );
        }
    }
}

fn accelerator_identity(value: &Accelerator) -> (String, String, String, String, u64) {
    (
        value.accelerator_id.clone().unwrap_or_default(),
        format!("{:?}", value.vendor),
        format!("{:?}", value.kind),
        format!("{:?}", value.backend),
        value.count,
    )
}

fn accelerator_match_key(
    value: &Accelerator,
) -> (String, String, String, String, u64, Option<u64>) {
    let identity = accelerator_identity(value);
    (
        identity.0,
        identity.1,
        identity.2,
        identity.3,
        identity.4,
        value.device_memory_bytes,
    )
}

fn visible_optional<T: std::fmt::Debug + PartialEq>(
    evaluation: &mut HardwareConfirmationEvaluation,
    field: &str,
    imported: Option<&T>,
    resolved: Option<&T>,
    reason: &str,
) {
    if imported != resolved {
        difference(
            evaluation,
            field,
            imported.map(|value| format!("{value:?}")),
            resolved.map(|value| format!("{value:?}")),
            DifferenceKind::Informational,
            reason,
        );
    }
}

fn difference(
    evaluation: &mut HardwareConfirmationEvaluation,
    field: &str,
    imported: Option<String>,
    resolved: Option<String>,
    kind: DifferenceKind,
    reason_code: &str,
) {
    evaluation.differences.push(HardwareDifference {
        field: field.into(),
        imported,
        resolved,
        kind,
        reason_code: reason_code.into(),
    });
}

fn block(evaluation: &mut HardwareConfirmationEvaluation, reason: &str) {
    evaluation.state = HardwareConfirmationState::Blocked;
    push_unique(&mut evaluation.reason_codes, reason);
}

fn push_unique(values: &mut Vec<String>, value: impl Into<String>) {
    let value = value.into();
    if !values.contains(&value) {
        values.push(value);
    }
}

fn exact_unique_set(actual: &[String], expected: &[String]) -> bool {
    let actual_set = actual.iter().collect::<BTreeSet<_>>();
    let expected_set = expected.iter().collect::<BTreeSet<_>>();
    actual_set.len() == actual.len()
        && expected_set.len() == expected.len()
        && actual_set == expected_set
}

//! M-D adapter from the existing consent-gated detector to the M-A target.
//! This module performs no detection itself and exposes no Tauri command.

use crate::contracts::{
    Accelerator, AcceleratorBackend, AcceleratorVendor, Cpu, HardwareTarget, Memory, Origin, Os,
    OsFamily,
};
use crate::hardware::{registry, AcceleratorEntry, GpuReconciliation, HardwareReport};
use std::collections::BTreeMap;

#[derive(Debug, Clone, PartialEq)]
pub enum ResolutionState {
    Ready,
    ConfirmationRequired,
    Unavailable,
}

#[derive(Debug, Clone, PartialEq)]
pub struct HardwareResolution {
    pub state: ResolutionState,
    pub target: Option<HardwareTarget>,
    pub reason_codes: Vec<String>,
    pub confirmation_fields: Vec<String>,
    pub memory_variant_options: Vec<MemoryVariantOption>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct MemoryVariantOption {
    pub field: String,
    pub bytes: u64,
    pub note: Option<String>,
    pub source_url: String,
}

#[derive(Debug, Clone)]
pub struct DetectedHardwareContext {
    pub hardware_target_id: String,
    pub os_family: OsFamily,
    pub os_version: Option<String>,
    pub logical_cores: Option<u64>,
    pub available_ram_bytes: Option<u64>,
    pub unified: Option<bool>,
}

pub fn resolve_detected_hardware(
    report: &HardwareReport,
    context: DetectedHardwareContext,
) -> HardwareResolution {
    match registry() {
        Ok(entries) => resolve_detected_hardware_with_registry(report, context, &entries),
        Err(reason) => HardwareResolution {
            state: ResolutionState::Unavailable,
            target: None,
            reason_codes: vec!["hardware.registry-unavailable".into()],
            confirmation_fields: vec!["/accelerators".into()],
            memory_variant_options: Vec::new(),
            warnings: vec![reason],
        },
    }
}

pub fn resolve_detected_hardware_with_registry(
    report: &HardwareReport,
    context: DetectedHardwareContext,
    entries: &[AcceleratorEntry],
) -> HardwareResolution {
    let mut structurally_invalid = Vec::new();
    if context.hardware_target_id.trim().is_empty() {
        structurally_invalid.push("/hardwareTargetId".to_string());
    }
    structurally_invalid.extend(report.gpus.iter().enumerate().filter_map(|(index, gpu)| {
        let display_name = match gpu {
            GpuReconciliation::Known { detected_name, .. }
            | GpuReconciliation::Unknown { detected_name, .. } => detected_name,
        };
        display_name
            .trim()
            .is_empty()
            .then(|| format!("/accelerators/{index}/displayName"))
    }));
    if !structurally_invalid.is_empty() {
        return HardwareResolution {
            state: ResolutionState::Unavailable,
            target: None,
            reason_codes: vec!["hardware.invalid-detected-identity".into()],
            confirmation_fields: structurally_invalid,
            memory_variant_options: Vec::new(),
            warnings: vec![
                "Detected hardware identity was incomplete; confirm it manually.".into(),
            ],
        };
    }

    if report.gpus.is_empty() {
        if let Some(reason) = &report.gpu_detection_unavailable_reason {
            return HardwareResolution {
                state: ResolutionState::Unavailable,
                target: None,
                reason_codes: vec!["hardware.detection-unavailable".into()],
                confirmation_fields: vec!["/accelerators".into()],
                memory_variant_options: Vec::new(),
                warnings: vec![reason.clone()],
            };
        }
    }

    let Some(total_ram_bytes) = gib_to_bytes(report.total_memory_gb) else {
        return HardwareResolution {
            state: ResolutionState::Unavailable,
            target: None,
            reason_codes: vec!["hardware.invalid-total-memory".into()],
            confirmation_fields: vec!["/memory/totalRamBytes".into()],
            memory_variant_options: Vec::new(),
            warnings: vec!["Detected total memory was not a finite positive capacity.".into()],
        };
    };

    let mut reason_codes = Vec::new();
    let mut confirmation_fields = Vec::new();
    let mut warnings = Vec::new();
    let mut memory_variant_options = Vec::new();
    let logical_cores = context.logical_cores.filter(|value| *value > 0);
    if context.logical_cores.is_some() && logical_cores.is_none() {
        reason_codes.push("hardware.invalid-logical-core-count".into());
        confirmation_fields.push("/cpu/logicalCores".into());
        warnings.push("Detected logical core count was invalid and remains unknown.".into());
    }
    if context
        .available_ram_bytes
        .is_some_and(|available| available > total_ram_bytes)
    {
        reason_codes.push("hardware.available-memory-mismatch".into());
        confirmation_fields.push("/memory/availableRamBytes".into());
        warnings.push(
            "Detected available memory exceeds total memory and requires confirmation.".into(),
        );
    }

    let mut field_origins = BTreeMap::from([
        ("/hardwareTargetId".into(), Origin::Imported),
        ("/os/family".into(), Origin::Detected),
        (
            "/os/version".into(),
            if context.os_version.is_some() {
                Origin::Detected
            } else {
                Origin::Unknown
            },
        ),
        (
            "/cpu/displayName".into(),
            if report.cpu_name.trim().is_empty() || report.cpu_name.eq_ignore_ascii_case("unknown")
            {
                Origin::Unknown
            } else {
                Origin::Detected
            },
        ),
        (
            "/cpu/logicalCores".into(),
            if logical_cores.is_some() {
                Origin::Detected
            } else {
                Origin::Unknown
            },
        ),
        ("/memory/totalRamBytes".into(), Origin::Detected),
        (
            "/memory/availableRamBytes".into(),
            if context.available_ram_bytes.is_some() {
                Origin::Detected
            } else {
                Origin::Unknown
            },
        ),
        (
            "/memory/unified".into(),
            if context.unified.is_some() {
                Origin::Detected
            } else {
                Origin::Unknown
            },
        ),
        ("/accelerators".into(), Origin::Detected),
    ]);

    let accelerators = report
        .gpus
        .iter()
        .enumerate()
        .map(|(index, gpu)| {
            let prefix = format!("/accelerators/{index}");
            field_origins.insert(format!("{prefix}/displayName"), Origin::Detected);
            field_origins.insert(format!("{prefix}/count"), Origin::Detected);
            match gpu {
                GpuReconciliation::Known {
                    detected_name,
                    detected_memory_gb,
                    accelerator_id,
                    memory_matches_vendor_variant,
                    ..
                } => {
                    let entry = entries.iter().find(|entry| entry.id == *accelerator_id);
                    if let Some(entry) = entry {
                        memory_variant_options.extend(entry.memory_variants.iter().filter_map(
                            |variant| {
                                Some(MemoryVariantOption {
                                    field: format!("{prefix}/deviceMemoryBytes"),
                                    bytes: gib_to_bytes(variant.memory_gb)?,
                                    note: variant.note.clone(),
                                    source_url: entry.source_url.clone(),
                                })
                            },
                        ));
                    }
                    let vendor = entry.map_or(AcceleratorVendor::Other, vendor_for_entry);
                    let normalized_origin = if entry.is_some() {
                        Origin::Imported
                    } else {
                        Origin::Unknown
                    };
                    field_origins
                        .insert(format!("{prefix}/acceleratorId"), normalized_origin.clone());
                    field_origins.insert(format!("{prefix}/kind"), normalized_origin.clone());
                    field_origins.insert(format!("{prefix}/vendor"), normalized_origin.clone());
                    field_origins.insert(format!("{prefix}/backend"), normalized_origin);
                    field_origins.insert(
                        format!("{prefix}/deviceMemoryBytes"),
                        if gib_to_bytes(*detected_memory_gb).is_some() {
                            Origin::Detected
                        } else {
                            Origin::Unknown
                        },
                    );
                    if entry.is_none() {
                        reason_codes.push("hardware.registry-identity-missing".into());
                        confirmation_fields.push(format!("{prefix}/acceleratorId"));
                    }
                    if !memory_matches_vendor_variant {
                        reason_codes.push("hardware.device-memory-registry-mismatch".into());
                        confirmation_fields.push(format!("{prefix}/deviceMemoryBytes"));
                        warnings.push(format!(
                            "{detected_name} memory does not match a sourced registry variant."
                        ));
                    }
                    if gib_to_bytes(*detected_memory_gb).is_none() {
                        reason_codes.push("hardware.device-memory-confirmation-required".into());
                        confirmation_fields.push(format!("{prefix}/deviceMemoryBytes"));
                        warnings.push(format!(
                            "{detected_name} memory was not a finite positive capacity."
                        ));
                    }
                    Accelerator {
                        accelerator_id: entry.map(|_| accelerator_id.clone()),
                        display_name: detected_name.clone(),
                        kind: vendor.clone(),
                        vendor: vendor.clone(),
                        backend: backend_for_vendor(&vendor),
                        device_memory_bytes: gib_to_bytes(*detected_memory_gb),
                        count: 1,
                    }
                }
                GpuReconciliation::Unknown {
                    detected_name,
                    detected_memory_gb,
                    reason,
                    ..
                } => {
                    field_origins.insert(format!("{prefix}/acceleratorId"), Origin::Unknown);
                    field_origins.insert(format!("{prefix}/kind"), Origin::Unknown);
                    field_origins.insert(format!("{prefix}/vendor"), Origin::Unknown);
                    field_origins.insert(format!("{prefix}/backend"), Origin::Unknown);
                    field_origins.insert(
                        format!("{prefix}/deviceMemoryBytes"),
                        if gib_to_bytes(*detected_memory_gb).is_some() {
                            Origin::Detected
                        } else {
                            Origin::Unknown
                        },
                    );
                    reason_codes.push("hardware.unknown-accelerator".into());
                    confirmation_fields.push(format!("{prefix}/acceleratorId"));
                    confirmation_fields.push(format!("{prefix}/deviceMemoryBytes"));
                    warnings.push((*reason).into());
                    Accelerator {
                        accelerator_id: None,
                        display_name: detected_name.clone(),
                        kind: AcceleratorVendor::Other,
                        vendor: AcceleratorVendor::Other,
                        backend: AcceleratorBackend::Other,
                        device_memory_bytes: gib_to_bytes(*detected_memory_gb),
                        count: 1,
                    }
                }
            }
        })
        .collect::<Vec<_>>();

    if accelerators.len() > 1 {
        reason_codes.push("hardware.multiple-device-selection-required".into());
        confirmation_fields.push("/accelerators".into());
    }

    dedup(&mut reason_codes);
    dedup(&mut confirmation_fields);
    dedup(&mut warnings);

    let target = HardwareTarget {
        hardware_target_id: context.hardware_target_id,
        os: Os {
            family: context.os_family,
            version: context.os_version,
        },
        cpu: Cpu {
            display_name: (!report.cpu_name.trim().is_empty()
                && !report.cpu_name.eq_ignore_ascii_case("unknown"))
            .then(|| report.cpu_name.clone()),
            logical_cores,
        },
        memory: Memory {
            total_ram_bytes,
            available_ram_bytes: context.available_ram_bytes,
            unified: context.unified,
        },
        accelerators,
        field_origins,
    };

    HardwareResolution {
        state: if reason_codes.is_empty() {
            ResolutionState::Ready
        } else {
            ResolutionState::ConfirmationRequired
        },
        target: Some(target),
        reason_codes,
        confirmation_fields,
        memory_variant_options,
        warnings,
    }
}

fn vendor_for_entry(entry: &AcceleratorEntry) -> AcceleratorVendor {
    match entry.vendor.as_str() {
        "nvidia" => AcceleratorVendor::Nvidia,
        "apple" => AcceleratorVendor::Apple,
        "amd" => AcceleratorVendor::Amd,
        "intel" => AcceleratorVendor::Intel,
        _ => AcceleratorVendor::Other,
    }
}

fn backend_for_vendor(vendor: &AcceleratorVendor) -> AcceleratorBackend {
    match vendor {
        AcceleratorVendor::Nvidia => AcceleratorBackend::Cuda,
        AcceleratorVendor::Amd => AcceleratorBackend::Rocm,
        AcceleratorVendor::Apple => AcceleratorBackend::Metal,
        AcceleratorVendor::Cpu => AcceleratorBackend::Cpu,
        _ => AcceleratorBackend::Other,
    }
}

fn gib_to_bytes(gib: f64) -> Option<u64> {
    (gib.is_finite() && gib > 0.0)
        .then(|| gib * f64::from(1u32 << 30))
        .filter(|bytes| *bytes >= 1.0 && *bytes <= u64::MAX as f64)
        .map(|bytes| bytes.round() as u64)
}

fn dedup(values: &mut Vec<String>) {
    let mut seen = std::collections::HashSet::new();
    values.retain(|value| seen.insert(value.clone()));
}

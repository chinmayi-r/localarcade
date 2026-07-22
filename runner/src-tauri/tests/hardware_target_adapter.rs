use runner_lib::contracts::OsFamily;
use runner_lib::hardware::{AcceleratorEntry, GpuReconciliation, HardwareReport, MemoryVariant};
use runner_lib::hardware_target::{
    resolve_detected_hardware_with_registry, DetectedHardwareContext, ResolutionState,
};

fn context() -> DetectedHardwareContext {
    DetectedHardwareContext {
        hardware_target_id: "hw-detected".into(),
        os_family: OsFamily::Windows,
        os_version: Some("11".into()),
        logical_cores: Some(16),
        available_ram_bytes: None,
        unified: Some(false),
    }
}

fn entry() -> AcceleratorEntry {
    AcceleratorEntry {
        id: "nvidia-fixture".into(),
        vendor: "nvidia".into(),
        marketing_name: "Fixture GPU".into(),
        kind: "gpu".into(),
        family: "fixture-family".into(),
        memory_variants: vec![MemoryVariant {
            memory_gb: 8.0,
            memory_type: None,
            note: None,
        }],
        source_url: "https://example.invalid/vendor".into(),
    }
}

fn report(gpus: Vec<GpuReconciliation>) -> HardwareReport {
    HardwareReport {
        os: "Windows 11".into(),
        arch: "x86_64".into(),
        cpu_name: "Fixture CPU".into(),
        total_memory_gb: 32.0,
        gpus,
        gpu_detection_unavailable_reason: None,
        provenance: "detected",
    }
}

fn known(matches: bool) -> GpuReconciliation {
    GpuReconciliation::Known {
        detected_name: "Fixture GPU".into(),
        detected_memory_gb: 8.0,
        accelerator_id: "nvidia-fixture".into(),
        family: "fixture-family".into(),
        kind: "gpu".into(),
        source_url: "https://example.invalid/vendor".into(),
        memory_matches_vendor_variant: matches,
        vendor_variants_gb: vec![8.0],
        provenance: "detected",
    }
}

#[test]
fn known_detection_maps_to_ready_without_upgrading_origin() {
    let result =
        resolve_detected_hardware_with_registry(&report(vec![known(true)]), context(), &[entry()]);
    assert_eq!(result.state, ResolutionState::Ready);
    let target = result.target.expect("target");
    assert_eq!(
        target.accelerators[0].accelerator_id.as_deref(),
        Some("nvidia-fixture")
    );
    assert_eq!(
        target.field_origins["/accelerators/0/deviceMemoryBytes"],
        runner_lib::contracts::Origin::Detected
    );
    assert_eq!(result.memory_variant_options[0].bytes, 8 * (1u64 << 30));
    assert_eq!(result.memory_variant_options[0].note, None);
    assert_eq!(
        target.field_origins["/accelerators/0/acceleratorId"],
        runner_lib::contracts::Origin::Imported
    );
    let expected_origin_paths = [
        "/accelerators",
        "/accelerators/0/acceleratorId",
        "/accelerators/0/backend",
        "/accelerators/0/count",
        "/accelerators/0/deviceMemoryBytes",
        "/accelerators/0/displayName",
        "/accelerators/0/kind",
        "/accelerators/0/vendor",
        "/cpu/displayName",
        "/cpu/logicalCores",
        "/hardwareTargetId",
        "/memory/availableRamBytes",
        "/memory/totalRamBytes",
        "/memory/unified",
        "/os/family",
        "/os/version",
    ];
    assert_eq!(
        target
            .field_origins
            .keys()
            .map(String::as_str)
            .collect::<Vec<_>>(),
        expected_origin_paths
    );
}

#[test]
fn detected_registry_mismatch_preserves_bytes_and_requires_confirmation() {
    let result =
        resolve_detected_hardware_with_registry(&report(vec![known(false)]), context(), &[entry()]);
    assert_eq!(result.state, ResolutionState::ConfirmationRequired);
    assert!(result
        .reason_codes
        .contains(&"hardware.device-memory-registry-mismatch".into()));
    assert_eq!(
        result.target.expect("target").accelerators[0].device_memory_bytes,
        Some(8 * (1u64 << 30))
    );
}

#[test]
fn unknown_detection_has_no_fabricated_identity() {
    let unknown = GpuReconciliation::Unknown {
        detected_name: "Unknown GPU".into(),
        detected_memory_gb: 12.0,
        reason: "confirm manually",
        provenance: "detected",
    };
    let result =
        resolve_detected_hardware_with_registry(&report(vec![unknown]), context(), &[entry()]);
    assert_eq!(result.state, ResolutionState::ConfirmationRequired);
    assert_eq!(
        result.target.expect("target").accelerators[0].accelerator_id,
        None
    );
}

#[test]
fn multiple_devices_are_preserved_and_require_selection() {
    let result = resolve_detected_hardware_with_registry(
        &report(vec![known(true), known(true)]),
        context(),
        &[entry()],
    );
    assert_eq!(
        result.target.as_ref().expect("target").accelerators.len(),
        2
    );
    assert!(result
        .reason_codes
        .contains(&"hardware.multiple-device-selection-required".into()));
}

#[test]
fn unsupported_platform_detection_returns_unavailable_manual_boundary() {
    let mut report = report(vec![]);
    report.gpu_detection_unavailable_reason =
        Some("GPU detection is not implemented; enter manually.".into());
    let result = resolve_detected_hardware_with_registry(&report, context(), &[entry()]);
    assert_eq!(result.state, ResolutionState::Unavailable);
    assert!(result.target.is_none());
    assert_eq!(result.confirmation_fields, vec!["/accelerators"]);
}

#[test]
fn invalid_detected_total_memory_is_unavailable_not_fabricated() {
    let mut invalid = report(vec![known(true)]);
    invalid.total_memory_gb = 0.0;
    let result = resolve_detected_hardware_with_registry(&invalid, context(), &[entry()]);
    assert_eq!(result.state, ResolutionState::Unavailable);
    assert!(result.target.is_none());
    assert_eq!(result.reason_codes, vec!["hardware.invalid-total-memory"]);
}

#[test]
fn invalid_detected_optional_values_remain_unknown_or_require_confirmation() {
    let mut invalid_context = context();
    invalid_context.logical_cores = Some(0);
    invalid_context.available_ram_bytes = Some(64 * (1u64 << 30));
    let result = resolve_detected_hardware_with_registry(
        &report(vec![known(true)]),
        invalid_context,
        &[entry()],
    );
    assert_eq!(result.state, ResolutionState::ConfirmationRequired);
    let target = result.target.expect("valid partial target");
    assert_eq!(target.cpu.logical_cores, None);
    assert_eq!(target.memory.available_ram_bytes, Some(64 * (1u64 << 30)));
    assert!(result
        .reason_codes
        .contains(&"hardware.available-memory-mismatch".into()));
}

#[test]
fn empty_successful_detection_is_an_explicit_cpu_only_target() {
    let result = resolve_detected_hardware_with_registry(&report(vec![]), context(), &[entry()]);
    assert_eq!(result.state, ResolutionState::Ready);
    let target = result.target.expect("CPU-only target");
    assert!(target.accelerators.is_empty());
    assert_eq!(
        target.field_origins["/accelerators"],
        runner_lib::contracts::Origin::Detected
    );
}

#[test]
fn incomplete_detected_identity_fails_closed_before_emitting_m_a() {
    let mut invalid_context = context();
    invalid_context.hardware_target_id.clear();
    let result = resolve_detected_hardware_with_registry(
        &report(vec![known(true)]),
        invalid_context,
        &[entry()],
    );
    assert_eq!(result.state, ResolutionState::Unavailable);
    assert!(result.target.is_none());
    assert_eq!(
        result.reason_codes,
        vec!["hardware.invalid-detected-identity"]
    );
}

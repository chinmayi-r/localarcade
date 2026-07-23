use runner_lib::contracts::{
    Accelerator, AcceleratorBackend, AcceleratorVendor, Cpu, HardwareTarget, Memory, Origin, Os,
    OsFamily,
};
use runner_lib::hardware_confirmation::{
    evaluate_hardware_confirmation, DifferenceKind, HardwareConfirmationAcknowledgement,
    HardwareConfirmationState, HardwareConfirmationStore,
};
use runner_lib::hardware_target::{HardwareResolution, MemoryVariantOption, ResolutionState};
use std::collections::BTreeMap;

const GIB: u64 = 1u64 << 30;
type TargetMutation = Box<dyn Fn(&mut HardwareTarget)>;

fn accelerator(id: &str, memory: u64) -> Accelerator {
    Accelerator {
        accelerator_id: Some(id.into()),
        display_name: format!("Fixture {id}"),
        kind: AcceleratorVendor::Nvidia,
        vendor: AcceleratorVendor::Nvidia,
        backend: AcceleratorBackend::Cuda,
        device_memory_bytes: Some(memory),
        count: 1,
    }
}

fn target(id: &str) -> HardwareTarget {
    HardwareTarget {
        hardware_target_id: id.into(),
        os: Os {
            family: OsFamily::Windows,
            version: Some("11 24H2".into()),
        },
        cpu: Cpu {
            display_name: Some("Fixture CPU".into()),
            logical_cores: Some(16),
        },
        memory: Memory {
            total_ram_bytes: 32 * GIB,
            available_ram_bytes: Some(20 * GIB),
            unified: Some(false),
        },
        accelerators: vec![accelerator("gpu-a", 8 * GIB)],
        field_origins: BTreeMap::from([
            ("/memory/totalRamBytes".into(), Origin::SelfReported),
            ("/accelerators".into(), Origin::SelfReported),
        ]),
    }
}

fn resolution(value: HardwareTarget) -> HardwareResolution {
    HardwareResolution {
        state: ResolutionState::Ready,
        target: Some(value),
        reason_codes: vec![],
        confirmation_fields: vec![],
        memory_variant_options: vec![],
        warnings: vec![],
    }
}

#[test]
fn id_is_visible_but_never_identity_authority_and_full_snapshots_are_retained() {
    let imported = target("website-id");
    let mut detected = imported.clone();
    detected.hardware_target_id = "detector-id".into();
    detected
        .field_origins
        .insert("/memory/totalRamBytes".into(), Origin::Detected);
    let evaluation = evaluate_hardware_confirmation(&imported, &resolution(detected.clone()));
    assert_eq!(evaluation.state(), HardwareConfirmationState::Ready);
    assert!(evaluation.differences().iter().any(|value| {
        value.field == "/hardwareTargetId" && value.kind == DifferenceKind::Informational
    }));

    let mut store = HardwareConfirmationStore::default();
    let handle = store.insert(&evaluation, None).expect("ready receipt");
    let receipt = store.get(handle).expect("process-local handle");
    assert_eq!(receipt.imported_target(), &imported);
    assert_eq!(receipt.resolved_target(), &detected);
    assert_eq!(
        receipt.effective_target().hardware_target_id,
        "website-id",
        "the handoff identity is retained only after material facts matched"
    );
}

#[test]
fn hard_material_mismatches_block_even_when_ids_match() {
    let imported = target("same");
    let mutations: Vec<TargetMutation> = vec![
        Box::new(|value| value.os.family = OsFamily::Linux),
        Box::new(|value| value.accelerators[0].accelerator_id = Some("gpu-b".into())),
        Box::new(|value| value.accelerators[0].vendor = AcceleratorVendor::Amd),
        Box::new(|value| value.accelerators[0].kind = AcceleratorVendor::Amd),
        Box::new(|value| value.accelerators[0].backend = AcceleratorBackend::Vulkan),
        Box::new(|value| value.accelerators[0].count = 2),
        Box::new(|value| value.memory.unified = Some(true)),
    ];
    for mutate in mutations {
        let mut detected = imported.clone();
        mutate(&mut detected);
        assert_eq!(
            evaluate_hardware_confirmation(&imported, &resolution(detected)).state(),
            HardwareConfirmationState::Blocked
        );
    }
}

#[test]
fn accelerator_matching_is_order_independent_but_cardinality_is_not() {
    let mut imported = target("website");
    imported.accelerators.push(accelerator("gpu-b", 12 * GIB));
    let mut detected = imported.clone();
    detected.accelerators.reverse();
    assert_eq!(
        evaluate_hardware_confirmation(&imported, &resolution(detected)).state(),
        HardwareConfirmationState::Ready
    );

    let mut detected = imported.clone();
    detected.accelerators.pop();
    assert_eq!(
        evaluate_hardware_confirmation(&imported, &resolution(detected)).state(),
        HardwareConfirmationState::Blocked
    );
}

#[test]
fn accelerator_capacity_is_exact_without_detector_registry_nominal_evidence() {
    let imported = target("website");
    let mut detected = imported.clone();
    detected.accelerators[0].device_memory_bytes = Some(8 * GIB - 1024);
    let evaluation = evaluate_hardware_confirmation(&imported, &resolution(detected));
    assert_eq!(evaluation.state(), HardwareConfirmationState::Blocked);
    assert!(evaluation
        .reason_codes()
        .contains(&"m-d.hardware-confirmation.accelerator-capacity-mismatch".into()));
}

#[test]
fn detector_registry_nominal_capacity_normalization_requires_acknowledgement_and_is_conservative() {
    let imported = target("website");
    let mut detected = imported.clone();
    detected.accelerators[0].device_memory_bytes = Some(8 * GIB - 1024);
    let mut detected_resolution = resolution(detected);
    detected_resolution.memory_variant_options = vec![MemoryVariantOption {
        field: "/accelerators/0/deviceMemoryBytes".into(),
        bytes: 8 * GIB,
        note: Some("vendor nominal".into()),
        source_url: "https://example.invalid/vendor".into(),
    }];
    let evaluation = evaluate_hardware_confirmation(&imported, &detected_resolution);
    assert_eq!(
        evaluation.state(),
        HardwareConfirmationState::ConfirmationRequired
    );
    assert!(evaluation.differences().iter().any(|value| {
        value.kind == DifferenceKind::ConfirmationRequired
            && value.reason_code
                == "m-d.hardware-confirmation.accelerator-capacity-registry-confirmation-required"
    }));
    assert_eq!(
        evaluation.effective_target().unwrap().accelerators[0].device_memory_bytes,
        Some(8 * GIB - 1024)
    );
    let exact = HardwareConfirmationAcknowledgement {
        reason_codes: evaluation.reason_codes().to_vec(),
        confirmation_fields: evaluation.confirmation_fields().to_vec(),
    };
    assert_eq!(
        HardwareConfirmationStore::default()
            .insert(&evaluation, None)
            .unwrap_err(),
        "m-d.hardware-confirmation.acknowledgement-required"
    );
    HardwareConfirmationStore::default()
        .insert(&evaluation, Some(&exact))
        .expect("exact visible capacity acknowledgement");
}

#[test]
fn total_ram_within_v1_tolerance_requires_exact_acknowledgement_and_keeps_lower_value() {
    let imported = target("website");
    let mut detected = imported.clone();
    detected.memory.total_ram_bytes -= 512 * 1024 * 1024;
    let evaluation = evaluate_hardware_confirmation(&imported, &resolution(detected));
    assert_eq!(
        evaluation.state(),
        HardwareConfirmationState::ConfirmationRequired
    );
    assert_eq!(
        evaluation
            .effective_target()
            .unwrap()
            .memory
            .total_ram_bytes,
        32 * GIB - 512 * 1024 * 1024
    );

    let mut store = HardwareConfirmationStore::default();
    assert_eq!(
        store.insert(&evaluation, None).unwrap_err(),
        "m-d.hardware-confirmation.acknowledgement-required"
    );
    let wrong = HardwareConfirmationAcknowledgement {
        reason_codes: evaluation.reason_codes().to_vec(),
        confirmation_fields: vec!["/memory/availableRamBytes".into()],
    };
    assert_eq!(
        store.insert(&evaluation, Some(&wrong)).unwrap_err(),
        "m-d.hardware-confirmation.acknowledgement-mismatch"
    );
    let exact = HardwareConfirmationAcknowledgement {
        reason_codes: evaluation.reason_codes().to_vec(),
        confirmation_fields: evaluation.confirmation_fields().to_vec(),
    };
    let handle = store.insert(&evaluation, Some(&exact)).expect("exact ack");
    assert_eq!(
        store.get(handle).unwrap().acknowledged_reason_codes(),
        exact.reason_codes
    );
}

#[test]
fn total_ram_tolerance_is_minimum_of_three_percent_and_one_gib() {
    let imported = target("website");
    let mut within = imported.clone();
    within.memory.total_ram_bytes -= 900 * 1024 * 1024;
    assert_eq!(
        evaluate_hardware_confirmation(&imported, &resolution(within)).state(),
        HardwareConfirmationState::ConfirmationRequired
    );
    let mut beyond = imported.clone();
    beyond.memory.total_ram_bytes -= 2 * GIB;
    assert_eq!(
        evaluate_hardware_confirmation(&imported, &resolution(beyond)).state(),
        HardwareConfirmationState::Blocked
    );

    let mut small = imported.clone();
    small.memory.total_ram_bytes = 4 * GIB;
    let mut small_detected = small.clone();
    small_detected.memory.total_ram_bytes -= 128 * 1024 * 1024;
    assert_eq!(
        evaluate_hardware_confirmation(&small, &resolution(small_detected)).state(),
        HardwareConfirmationState::Blocked,
        "128 MiB exceeds three percent of 4 GiB"
    );
}

#[test]
fn informational_dynamic_and_cpu_differences_do_not_require_confirmation() {
    let imported = target("website");
    let mut detected = imported.clone();
    detected.os.version = Some("11 newer".into());
    detected.cpu.display_name = Some("Detector spelling".into());
    detected.cpu.logical_cores = Some(24);
    detected.memory.available_ram_bytes = Some(8 * GIB);
    let evaluation = evaluate_hardware_confirmation(&imported, &resolution(detected));
    assert_eq!(evaluation.state(), HardwareConfirmationState::Ready);
    assert!(evaluation.differences().len() >= 4);
}

#[test]
fn resolution_confirmation_requires_exact_reason_and_field_sets() {
    let imported = target("website");
    let mut ambiguous = resolution(imported.clone());
    ambiguous.state = ResolutionState::ConfirmationRequired;
    ambiguous.reason_codes = vec!["hardware.registry-review".into()];
    ambiguous.confirmation_fields = vec!["/accelerators/0/acceleratorId".into()];
    let evaluation = evaluate_hardware_confirmation(&imported, &ambiguous);
    assert_eq!(
        evaluation.state(),
        HardwareConfirmationState::ConfirmationRequired
    );
    let duplicate = HardwareConfirmationAcknowledgement {
        reason_codes: vec![
            "hardware.registry-review".into(),
            "hardware.registry-review".into(),
        ],
        confirmation_fields: evaluation.confirmation_fields().to_vec(),
    };
    assert_eq!(
        HardwareConfirmationStore::default()
            .insert(&evaluation, Some(&duplicate))
            .unwrap_err(),
        "m-d.hardware-confirmation.acknowledgement-mismatch"
    );
}

#[test]
fn unavailable_missing_and_unknown_accelerator_identity_fail_closed() {
    let imported = target("website");
    let unavailable = HardwareResolution {
        state: ResolutionState::Unavailable,
        target: None,
        reason_codes: vec!["hardware.detection-unavailable".into()],
        confirmation_fields: vec!["/accelerators".into()],
        memory_variant_options: vec![],
        warnings: vec![],
    };
    assert_eq!(
        evaluate_hardware_confirmation(&imported, &unavailable).state(),
        HardwareConfirmationState::Unavailable
    );
    let mut missing = resolution(imported.clone());
    missing.target = None;
    assert_eq!(
        evaluate_hardware_confirmation(&imported, &missing).state(),
        HardwareConfirmationState::Unavailable
    );
    let mut unknown = imported.clone();
    unknown.accelerators[0].accelerator_id = None;
    assert_eq!(
        evaluate_hardware_confirmation(&unknown, &resolution(unknown.clone())).state(),
        HardwareConfirmationState::Blocked
    );
}

#[test]
fn missing_unified_memory_or_accelerator_capacity_fails_closed() {
    let imported = target("website");

    let mut missing_imported_unified = imported.clone();
    missing_imported_unified.memory.unified = None;
    assert_eq!(
        evaluate_hardware_confirmation(&missing_imported_unified, &resolution(imported.clone()))
            .state(),
        HardwareConfirmationState::Blocked
    );

    let mut missing_resolved_unified = imported.clone();
    missing_resolved_unified.memory.unified = None;
    assert_eq!(
        evaluate_hardware_confirmation(&imported, &resolution(missing_resolved_unified)).state(),
        HardwareConfirmationState::Blocked
    );

    let mut missing_capacity = imported.clone();
    missing_capacity.accelerators[0].device_memory_bytes = None;
    assert_eq!(
        evaluate_hardware_confirmation(&missing_capacity, &resolution(missing_capacity.clone()))
            .state(),
        HardwareConfirmationState::Blocked
    );
}

#[test]
fn duplicate_accelerator_identities_match_as_complete_capacity_multisets() {
    let mut imported = target("website");
    imported.accelerators.push(accelerator("gpu-a", 12 * GIB));
    let mut detected = imported.clone();
    detected.accelerators.reverse();
    assert_eq!(
        evaluate_hardware_confirmation(&imported, &resolution(detected)).state(),
        HardwareConfirmationState::Ready
    );
}

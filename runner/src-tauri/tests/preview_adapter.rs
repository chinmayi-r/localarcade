use runner_lib::contracts::{ConcurrentGpu, Power, Thermal};
use runner_lib::preflight::{evaluate, PreflightInputs};
use runner_lib::preview_adapter::{local_inventory_path, map_preflight, PreviewAssembler};

const BUNDLE: &str = include_str!("../../../docs/contracts/fixtures/runner-import-bundle.ok.json");

#[test]
fn public_import_path_validates_the_full_envelope_and_never_authorizes() {
    let mut assembler = PreviewAssembler::default();
    let preview = assembler.admit_import_bundle(BUNDLE, true).unwrap();
    assert!(preview.preview_only);
    assert!(!preview.grants_execution_authorization);

    let tampered = BUNDLE.replacen("candidate-fixture", "candidate-tampered", 1);
    assert!(assembler.admit_import_bundle(&tampered, true).is_err());
}

#[test]
fn public_preflight_mapping_preserves_unknown_gpu_and_local_observations() {
    let preflight = map_preflight(&evaluate(PreflightInputs {
        cpu_load_percent: 2.0,
        available_memory_gb: 24.0,
        total_memory_gb: 32.0,
        ac_power: Some(true),
        thermal_celsius: Some(45.0),
        thermal_unavailable_reason: None,
    }));
    assert_eq!(preflight.power, Power::Ac);
    assert_eq!(preflight.thermal, Thermal::Acceptable);
    assert_eq!(preflight.concurrent_gpu, ConcurrentGpu::Unknown);
    assert!(preflight.requires_confirmation);
}

#[test]
fn public_inventory_path_boundary_rejects_non_local_routes() {
    assert!(local_inventory_path(r"\\server\share\models").is_err());
    assert!(local_inventory_path(r"relative\models").is_err());
    assert!(local_inventory_path(r"C:\models\file.gguf:stream").is_err());
}

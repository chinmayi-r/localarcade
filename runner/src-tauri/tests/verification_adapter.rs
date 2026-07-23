use runner_lib::contracts::*;
use runner_lib::hardware_target::{HardwareResolution, ResolutionState};
use runner_lib::model_store::inventory::{
    ArtifactIdentityV1, InventoryArtifact, InventoryArtifactResolution, ModelFamilyV1,
    PromotedStatus, RegistryArtifactIdentityV1, RegistryMetadataV1,
};
use runner_lib::verification::*;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

static TEMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);

fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn temp_file(name: &str, bytes: &[u8]) -> PathBuf {
    let sequence = TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let dir = std::env::temp_dir().join(format!(
        "local-arcade-mj-{}-{sequence}-{name}",
        std::process::id()
    ));
    fs::create_dir_all(&dir).unwrap();
    let path = dir.join(name);
    fs::write(&path, bytes).unwrap();
    path
}

fn runtime() -> RuntimeConfiguration {
    RuntimeConfiguration {
        runtime_configuration_id: "runtime-1".into(),
        product: "llama-cpp".into(),
        engine: "llama.cpp".into(),
        engine_build: Some("b10061-5d5306bf3".into()),
        backend: AcceleratorBackend::Cuda,
        chat_template: Some("chatml".into()),
        context_tokens: 4096,
        kv_cache: KvCache {
            key: Some("f16".into()),
            value: Some("f16".into()),
        },
        gpu_layers: Some(GpuLayers::All(GpuLayersAll::All)),
        batch_size: Some(2048),
        micro_batch_size: Some(512),
        parallelism: Some(1),
        threads: Some(14),
        flash_attention: Some(true),
        mmap: Some(true),
        sampler: Sampler {
            temperature: Some(0.0),
            top_p: Some(0.9),
            top_k: Some(40),
            min_p: Some(0.05),
            seed: Some(1),
        },
        additional_flags: vec![],
    }
}

fn candidate(artifact_hash: &str) -> ExactConfigurationCandidate {
    ExactConfigurationCandidate {
        candidate_id: "candidate-1".into(),
        model_family: ModelFamily {
            model_family_id: "family-1".into(),
            display_name: "Fixture".into(),
        },
        artifact: Artifact {
            artifact_id: "artifact-1".into(),
            repository: "fixture/repo".into(),
            revision: "revision".into(),
            filename: "fixture.gguf".into(),
            sha256: artifact_hash.into(),
            bytes: 8,
            format: "GGUF".into(),
            quantization: "Q4_K_M".into(),
            license: "apache-2.0".into(),
            status: ArtifactStatus::Promoted,
        },
        runtime: runtime(),
        provenance: vec![Provenance {
            source: Source {
                id: "fixture".into(),
                version: Some("1".into()),
                revision: None,
                url: None,
            },
            retrieved_at: None,
            observed_at: None,
            method: ProvenanceMethod::Imported,
            hardware_match: HardwareMatch::NotApplicable,
            configuration_match: ConfigurationMatch::Exact,
            scope: ProvenanceScope {
                task_family: None,
                task_pack_id: None,
                prompt_id: None,
                harness_id: None,
            },
            sample_count: None,
            measurement: None,
            raw_source_record_ref: Some("fixture://candidate".into()),
        }],
    }
}

fn preflight() -> Preflight {
    Preflight {
        power: Power::Ac,
        thermal: Thermal::Unknown,
        concurrent_gpu: ConcurrentGpu::Unknown,
        requires_confirmation: false,
        conditions: vec!["telemetry unavailable".into()],
    }
}

fn hardware_resolution(state: ResolutionState, include_target: bool) -> HardwareResolution {
    HardwareResolution {
        state,
        target: include_target.then(|| HardwareTarget {
            hardware_target_id: "hardware-1".into(),
            os: Os {
                family: OsFamily::Windows,
                version: Some("11".into()),
            },
            cpu: Cpu {
                display_name: Some("Fixture CPU".into()),
                logical_cores: Some(16),
            },
            memory: Memory {
                total_ram_bytes: 32 * (1u64 << 30),
                available_ram_bytes: None,
                unified: Some(false),
            },
            accelerators: vec![],
            field_origins: BTreeMap::new(),
        }),
        reason_codes: vec![],
        confirmation_fields: vec![],
        memory_variant_options: vec![],
        warnings: vec![],
    }
}

fn confirmed_hardware() -> ConfirmedHardwareTarget {
    ConfirmedHardwareTarget::from_resolution(
        &hardware_resolution(ResolutionState::Ready, true),
        false,
    )
    .unwrap()
}

fn inventory_artifact(path: PathBuf, artifact_hash: &str) -> InventoryArtifact {
    InventoryArtifact {
        path: path.to_string_lossy().into_owned(),
        store: "fixture".into(),
        label: "fixture.gguf".into(),
        file_size_bytes: 8,
        sha256: Some(artifact_hash.into()),
        resolution: InventoryArtifactResolution::Verified {
            identity: Box::new(RegistryArtifactIdentityV1 {
                model_family: ModelFamilyV1 {
                    model_family_id: "family-1".into(),
                    display_name: "Fixture".into(),
                },
                artifact: ArtifactIdentityV1 {
                    artifact_id: "artifact-1".into(),
                    repository: "fixture/repo".into(),
                    revision: "revision".into(),
                    filename: "fixture.gguf".into(),
                    sha256: artifact_hash.into(),
                    bytes: 8,
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
                    max_context_tokens: 4096,
                    chat_template: "chatml".into(),
                    license_source_url: "https://example.invalid/license".into(),
                    field_provenance: BTreeMap::new(),
                },
            }),
        },
    }
}

fn tool_receipt(
    kind: ExistingToolKind,
    path: PathBuf,
    expected_sha256: String,
    observed_build: &str,
) -> ObservedToolIdentityReceipt {
    ObservedToolIdentityReceipt::new(
        kind,
        path,
        expected_sha256,
        "llama-cpp".into(),
        "llama.cpp".into(),
        observed_build.into(),
        AcceleratorBackend::Cuda,
        "llama-tool-version-v1".into(),
        "2026-07-22T20:00:00Z".into(),
    )
    .unwrap()
}

fn request() -> VerificationPreparationRequest {
    let artifact_bytes = b"artifact";
    let bench_bytes = b"benchmark executable";
    let quick_bytes = b"quick executable";
    let artifact_path = temp_file("fixture.gguf", artifact_bytes);
    let benchmark_path = temp_file("llama-bench.exe", bench_bytes);
    let quick_path = temp_file("llama-cli.exe", quick_bytes);
    let inventory_selection = VerifiedInventorySelection::from_inventory_artifact(
        &inventory_artifact(artifact_path, &hash(artifact_bytes)),
    )
    .unwrap();
    VerificationPreparationRequest {
        verification_plan_id: "verification-1".into(),
        hardware_target: confirmed_hardware(),
        candidate: candidate(&hash(artifact_bytes)),
        inventory_selection,
        benchmark: Some(BenchmarkPreparation {
            plan_id: "benchmark-1".into(),
            tool: tool_receipt(
                ExistingToolKind::Benchmark,
                benchmark_path,
                hash(bench_bytes),
                "b10061-5d5306bf3",
            ),
            protocol_id: "llama-bench-v1".into(),
            warmup_runs: 1,
            measured_runs: 3,
            measurement_kinds: vec![
                MeasurementKind::PromptProcessing,
                MeasurementKind::Generation,
                MeasurementKind::Stability,
            ],
            preflight: preflight(),
        }),
        quick_check: Some(QuickCheckPreparation {
            plan_id: "quick-1".into(),
            tool: tool_receipt(
                ExistingToolKind::QuickCheck,
                quick_path,
                hash(quick_bytes),
                "b10061-5d5306bf3",
            ),
            checks: vec![
                QuickCheck {
                    check_id: "json-schema".into(),
                    criterion: "exact JSON".into(),
                },
                QuickCheck {
                    check_id: "format".into(),
                    criterion: "exact lines".into(),
                },
            ],
            preflight: preflight(),
        }),
    }
}

#[test]
fn hardware_target_boundary_accepts_ready_or_explicitly_confirmed_only() {
    let ready = hardware_resolution(ResolutionState::Ready, true);
    assert_eq!(
        ConfirmedHardwareTarget::from_resolution(&ready, false)
            .unwrap()
            .id(),
        "hardware-1"
    );

    let ambiguous = hardware_resolution(ResolutionState::ConfirmationRequired, true);
    assert_eq!(
        ConfirmedHardwareTarget::from_resolution(&ambiguous, false).unwrap_err(),
        "m-j.hardware.confirmation-required"
    );
    assert_eq!(
        ConfirmedHardwareTarget::from_resolution(&ambiguous, true)
            .unwrap()
            .id(),
        "hardware-1"
    );

    let unavailable = hardware_resolution(ResolutionState::Unavailable, false);
    assert_eq!(
        ConfirmedHardwareTarget::from_resolution(&unavailable, true).unwrap_err(),
        "m-j.hardware.unavailable"
    );

    let missing = hardware_resolution(ResolutionState::Ready, false);
    assert_eq!(
        ConfirmedHardwareTarget::from_resolution(&missing, false).unwrap_err(),
        "m-j.hardware.target-missing"
    );
}

#[test]
fn preparation_hashes_only_selected_files_and_binds_exact_identity() {
    let prepared = prepare_verification(&request()).unwrap();
    assert_eq!(prepared.plan().candidate_id, "candidate-1");
    assert_eq!(
        prepared.plan().benchmark_plan.as_ref().unwrap().runtime,
        runtime()
    );
    assert_eq!(
        prepared
            .plan()
            .benchmark_plan
            .as_ref()
            .unwrap()
            .side_effects,
        SideEffects {
            executes_local_process: true,
            loads_model: true,
            writes_model_store: false,
            network: false,
            upload: false
        }
    );
    assert!(prepared.benchmark_tool().is_some());
    assert!(prepared.quick_check_tool().is_some());
    assert!(prepared
        .warnings()
        .iter()
        .any(|warning| warning.contains("isolation-not-enforced")));
    assert!(prepared
        .warnings()
        .iter()
        .any(|warning| warning.contains("m-e-compatibility-proof-unavailable")));
}

#[test]
fn preparation_fails_closed_on_artifact_tool_and_runtime_mismatch() {
    let mut value = request();
    value.candidate.artifact.sha256 = "0".repeat(64);
    let errors = prepare_verification(&value).unwrap_err().join(" ");
    assert!(errors.contains("candidate-hash-mismatch"));

    let mut value = request();
    let tool = &value.benchmark.as_ref().unwrap().tool;
    value.benchmark.as_mut().unwrap().tool = tool_receipt(
        tool.kind(),
        tool.path().to_path_buf(),
        tool.expected_sha256().into(),
        "unknown",
    );
    assert!(prepare_verification(&value)
        .unwrap_err()
        .join(" ")
        .contains("runtime-mismatch"));
}

#[test]
fn tool_receipts_are_structurally_validated_and_runtime_is_complete() {
    let invalid_tool = ObservedToolIdentityReceipt::new(
        ExistingToolKind::Benchmark,
        temp_file("not-llama-bench.exe", b"tool"),
        hash(b"tool"),
        "llama-cpp".into(),
        "llama.cpp".into(),
        "build".into(),
        AcceleratorBackend::Cuda,
        "probe-v1".into(),
        "2026-07-22T20:00:00Z".into(),
    )
    .unwrap_err()
    .join(" ");
    assert!(invalid_tool.contains("tool.unsupported"));

    let mut value = request();
    value.candidate.runtime.product = "other".into();
    value.candidate.runtime.engine = "other".into();
    value.candidate.runtime.backend = AcceleratorBackend::Metal;
    value.candidate.runtime.chat_template = None;
    value.candidate.runtime.kv_cache.key = None;
    value.candidate.runtime.gpu_layers = None;
    value.candidate.runtime.batch_size = None;
    value.candidate.runtime.sampler.top_p = Some(f64::NAN);
    value.candidate.runtime.sampler.top_k = None;
    value.candidate.runtime.additional_flags = vec![RuntimeFlag {
        name: " ".into(),
        value: None,
    }];
    let errors = prepare_verification(&value).unwrap_err().join(" ");
    assert!(errors.contains("unsupported-product-engine"));
    assert!(errors.contains("unsupported-windows-backend"));
    assert!(errors.contains("chat-template-unknown"));
    assert!(errors.contains("kv-cache-incomplete"));
    assert!(errors.contains("explicit-settings-incomplete"));
    assert!(errors.contains("sampler-invalid"));
    assert!(errors.contains("sampler-incomplete"));
    assert!(errors.contains("flags-invalid"));
}

#[test]
fn inventory_selection_accepts_only_verified_identity_and_rehashes_bytes() {
    let bytes = b"artifact";
    let path = temp_file("fixture.gguf", bytes);
    let mut artifact = inventory_artifact(path.clone(), &hash(bytes));
    let selection = VerifiedInventorySelection::from_inventory_artifact(&artifact).unwrap();
    assert_eq!(selection.artifact_id(), "artifact-1");
    assert_eq!(selection.sha256(), hash(bytes));
    assert_eq!(selection.bytes(), 8);
    assert_eq!(selection.path(), path);

    artifact.resolution = InventoryArtifactResolution::Unavailable {
        reason_code: "fixture.unavailable".into(),
        message: "not verified".into(),
    };
    assert!(
        VerifiedInventorySelection::from_inventory_artifact(&artifact)
            .unwrap_err()
            .join(" ")
            .contains("selection-not-verified")
    );

    let value = request();
    fs::write(value.inventory_selection.path(), b"tampered").unwrap();
    assert!(prepare_verification(&value)
        .unwrap_err()
        .join(" ")
        .contains("artifact.hash-mismatch"));
}

#[test]
fn every_verified_registry_identity_field_and_context_bound_the_candidate() {
    let mut value = request();
    value.candidate.model_family.model_family_id = "other-family".into();
    value.candidate.model_family.display_name = "Other family".into();
    value.candidate.artifact.artifact_id = "other-artifact".into();
    value.candidate.artifact.repository = "other/repository".into();
    value.candidate.artifact.revision = "other-revision".into();
    value.candidate.artifact.filename = "other.gguf".into();
    value.candidate.artifact.sha256 = "0".repeat(64);
    value.candidate.artifact.bytes += 1;
    value.candidate.artifact.format = "other-format".into();
    value.candidate.artifact.quantization = "other-quant".into();
    value.candidate.artifact.license = "other-license".into();
    value.candidate.runtime.context_tokens = 8192;
    value.candidate.runtime.chat_template = Some("other-template".into());

    let errors = prepare_verification(&value).unwrap_err().join(" ");
    for reason in [
        "candidate-model-family-id-mismatch",
        "candidate-model-family-display-mismatch",
        "candidate-artifact-id-mismatch",
        "candidate-repository-mismatch",
        "candidate-revision-mismatch",
        "candidate-filename-mismatch",
        "candidate-hash-mismatch",
        "candidate-byte-size-mismatch",
        "candidate-format-mismatch",
        "candidate-quantization-mismatch",
        "candidate-license-mismatch",
        "candidate-context-exceeds-registry-maximum",
        "candidate-chat-template-mismatch",
    ] {
        assert!(errors.contains(reason), "missing {reason} in {errors}");
    }
}

#[test]
fn preparation_rejects_byte_size_and_duplicate_plan_entries() {
    let mut value = request();
    value.candidate.artifact.bytes += 1;
    value
        .benchmark
        .as_mut()
        .unwrap()
        .measurement_kinds
        .push(MeasurementKind::Generation);
    let duplicate = value.quick_check.as_ref().unwrap().checks[0].clone();
    value.quick_check.as_mut().unwrap().checks.push(duplicate);
    let errors = prepare_verification(&value).unwrap_err().join(" ");
    assert!(errors.contains("byte-size-mismatch"));
    assert!(errors.contains("duplicate-measurement-kind"));
    assert!(errors.contains("duplicate-check-id"));
}

#[test]
fn benchmark_preserves_partial_samples_and_unknown_telemetry_blocks_calibration() {
    let prepared = prepare_verification(&request()).unwrap();
    let plan = prepared.plan().benchmark_plan.as_ref().unwrap();
    let result = benchmark_result(
        plan,
        &BenchmarkObservation {
            result_id: "result-1".into(),
            domain_status: DomainStatus::TimedOut,
            series: vec![SeriesObservation {
                kind: MeasurementKind::PromptProcessing,
                unit: MeasurementUnit::TokensPerSecond,
                warmup_samples: vec![100.0],
                measured_samples: vec![110.0, 112.0],
                completion: DomainStatus::TimedOut,
            }],
            diagnostics: vec!["m-j.execution.timed-out".into()],
            observed_at: Some("2026-07-22T20:00:00Z".into()),
        },
    )
    .unwrap();
    assert_eq!(result.domain_status, DomainStatus::TimedOut);
    assert_eq!(result.series[0].measured_samples, vec![110.0, 112.0]);
    assert!(result
        .series
        .iter()
        .any(|series| series.kind == MeasurementKind::Generation
            && series.measured_samples.is_empty()));
    assert!(!result.calibration_eligible);
    assert!(result
        .calibration_exclusions
        .iter()
        .any(|reason| reason.contains("thermal")));
    assert!(result
        .calibration_exclusions
        .iter()
        .any(|reason| reason.contains("isolation-not-enforced")));
    assert!(result
        .diagnostics
        .iter()
        .any(|reason| reason.contains("isolation-not-enforced")));
    assert!(result.series.iter().all(|series| {
        series
            .evidence
            .measurement
            .as_ref()
            .and_then(|measurement| measurement.eligible)
            == Some(false)
    }));
}

#[test]
fn stable_completed_samples_remain_ineligible_when_preflight_is_unknown() {
    let prepared = prepare_verification(&request()).unwrap();
    let result = benchmark_result(
        prepared.plan().benchmark_plan.as_ref().unwrap(),
        &completed_benchmark_observation(),
    )
    .unwrap();
    assert!(result
        .series
        .iter()
        .all(|series| series.stability == Stability::Stable));
    assert!(!result.calibration_eligible);
    assert!(result
        .calibration_exclusions
        .iter()
        .any(|reason| reason.contains("thermal:Unknown")));
    assert!(result.series.iter().all(|series| {
        series
            .evidence
            .measurement
            .as_ref()
            .and_then(|measurement| measurement.eligible)
            == Some(false)
    }));
}

#[test]
fn quick_checks_preserve_completed_and_not_run_outcomes() {
    let prepared = prepare_verification(&request()).unwrap();
    let plan = prepared.plan().quick_check_plan.as_ref().unwrap();
    let result = quick_check_result(
        plan,
        &QuickCheckObservation {
            result_id: "quick-result".into(),
            domain_status: DomainStatus::Stopped,
            checks: vec![CheckObservation {
                check_id: "json-schema".into(),
                passed: true,
                explanation: "matched".into(),
                local_diagnostics: Some("local output".into()),
            }],
            observed_at: Some("2026-07-22T20:00:00Z".into()),
        },
    )
    .unwrap();
    assert_eq!(result.checks[0].status, CheckStatus::Pass);
    assert_eq!(result.checks[1].status, CheckStatus::NotRun);
    assert_eq!(result.domain_status, DomainStatus::Stopped);
    assert!(result.checks.iter().all(|check| {
        check
            .evidence
            .measurement
            .as_ref()
            .and_then(|measurement| measurement.eligible)
            == Some(false)
    }));
}

#[test]
fn completed_results_require_all_planned_work_and_exact_sample_counts() {
    let prepared = prepare_verification(&request()).unwrap();
    let benchmark_plan = prepared.plan().benchmark_plan.as_ref().unwrap();
    let benchmark_errors = benchmark_result(
        benchmark_plan,
        &BenchmarkObservation {
            result_id: "benchmark-result".into(),
            domain_status: DomainStatus::Completed,
            series: vec![SeriesObservation {
                kind: MeasurementKind::PromptProcessing,
                unit: MeasurementUnit::TokensPerSecond,
                warmup_samples: vec![100.0],
                measured_samples: vec![110.0, 112.0],
                completion: DomainStatus::Completed,
            }],
            diagnostics: vec![],
            observed_at: None,
        },
    )
    .unwrap_err()
    .join(" ");
    assert!(benchmark_errors.contains("completed-missing-planned-kind"));
    assert!(benchmark_errors.contains("completed-sample-count"));

    let quick_plan = prepared.plan().quick_check_plan.as_ref().unwrap();
    let quick_errors = quick_check_result(
        quick_plan,
        &QuickCheckObservation {
            result_id: "quick-result".into(),
            domain_status: DomainStatus::Completed,
            checks: vec![CheckObservation {
                check_id: "json-schema".into(),
                passed: true,
                explanation: " ".into(),
                local_diagnostics: None,
            }],
            observed_at: None,
        },
    )
    .unwrap_err()
    .join(" ");
    assert!(quick_errors.contains("completed-missing-planned-check"));
    assert!(quick_errors.contains("explanation-missing"));
}

#[test]
fn aggregate_result_requires_every_planned_observation_and_its_id() {
    let prepared = prepare_verification(&request()).unwrap();
    let errors = verification_result(
        prepared.plan(),
        &VerificationObservation {
            result_id: " ".into(),
            domain_status: DomainStatus::Completed,
            benchmark: None,
            quick_check: None,
        },
    )
    .unwrap_err()
    .join(" ");
    assert!(errors.contains("verificationResultId"));
    assert!(errors.contains("missing-benchmark"));
    assert!(errors.contains("missing-quick-check"));
}

#[test]
fn aggregate_result_preserves_worst_typed_status() {
    let prepared = prepare_verification(&request()).unwrap();
    let result = verification_result(
        prepared.plan(),
        &VerificationObservation {
            result_id: "verification-result".into(),
            domain_status: DomainStatus::Oom,
            benchmark: Some(BenchmarkObservation {
                result_id: "benchmark-result".into(),
                domain_status: DomainStatus::Oom,
                series: vec![],
                diagnostics: vec!["m-j.execution.oom".into()],
                observed_at: None,
            }),
            quick_check: Some(QuickCheckObservation {
                result_id: "quick-result".into(),
                domain_status: DomainStatus::Stopped,
                checks: vec![],
                observed_at: None,
            }),
        },
    )
    .unwrap();
    assert_eq!(result.domain_status, DomainStatus::Oom);
    assert_eq!(
        result.benchmark_result.unwrap().domain_status,
        DomainStatus::Oom
    );
}

fn completed_benchmark_observation() -> BenchmarkObservation {
    let series = |kind| SeriesObservation {
        kind,
        unit: MeasurementUnit::TokensPerSecond,
        warmup_samples: vec![100.0],
        measured_samples: vec![110.0, 111.0, 112.0],
        completion: DomainStatus::Completed,
    };
    BenchmarkObservation {
        result_id: "benchmark-completed".into(),
        domain_status: DomainStatus::Completed,
        series: vec![
            series(MeasurementKind::PromptProcessing),
            series(MeasurementKind::Generation),
        ],
        diagnostics: vec![],
        observed_at: Some("2026-07-22T20:00:00Z".into()),
    }
}

fn completed_quick_observation() -> QuickCheckObservation {
    QuickCheckObservation {
        result_id: "quick-completed".into(),
        domain_status: DomainStatus::Completed,
        checks: vec![
            CheckObservation {
                check_id: "json-schema".into(),
                passed: true,
                explanation: "matched".into(),
                local_diagnostics: None,
            },
            CheckObservation {
                check_id: "format".into(),
                passed: true,
                explanation: "matched".into(),
                local_diagnostics: None,
            },
        ],
        observed_at: Some("2026-07-22T20:00:00Z".into()),
    }
}

#[test]
fn stopped_before_a_phase_preserves_completed_data_and_types_not_started_work() {
    let prepared = prepare_verification(&request()).unwrap();
    let after_benchmark = verification_result(
        prepared.plan(),
        &VerificationObservation {
            result_id: "after-benchmark".into(),
            domain_status: DomainStatus::Failed,
            benchmark: Some(completed_benchmark_observation()),
            quick_check: None,
        },
    )
    .unwrap();
    assert_eq!(after_benchmark.domain_status, DomainStatus::Failed);
    assert_eq!(
        after_benchmark.benchmark_result.unwrap().domain_status,
        DomainStatus::Completed
    );
    let quick = after_benchmark.quick_check_result.unwrap();
    assert_eq!(quick.domain_status, DomainStatus::Failed);
    assert!(quick
        .checks
        .iter()
        .all(|check| check.status == CheckStatus::NotRun));

    let before_benchmark = verification_result(
        prepared.plan(),
        &VerificationObservation {
            result_id: "before-benchmark".into(),
            domain_status: DomainStatus::Stopped,
            benchmark: None,
            quick_check: Some(completed_quick_observation()),
        },
    )
    .unwrap();
    assert_eq!(before_benchmark.domain_status, DomainStatus::Stopped);
    let benchmark = before_benchmark.benchmark_result.unwrap();
    assert_eq!(benchmark.domain_status, DomainStatus::Stopped);
    assert!(benchmark
        .series
        .iter()
        .all(|series| series.measured_samples.is_empty()));
    assert_eq!(
        before_benchmark.quick_check_result.unwrap().domain_status,
        DomainStatus::Completed
    );
}

#[test]
fn status_fold_is_order_independent_across_benchmark_and_quick_check() {
    let prepared = prepare_verification(&request()).unwrap();
    for (benchmark_status, quick_status) in [
        (DomainStatus::Oom, DomainStatus::Stopped),
        (DomainStatus::Stopped, DomainStatus::Oom),
    ] {
        let result = verification_result(
            prepared.plan(),
            &VerificationObservation {
                result_id: "ordered-status".into(),
                domain_status: DomainStatus::Oom,
                benchmark: Some(BenchmarkObservation {
                    result_id: "benchmark-status".into(),
                    domain_status: benchmark_status,
                    series: vec![],
                    diagnostics: vec![],
                    observed_at: None,
                }),
                quick_check: Some(QuickCheckObservation {
                    result_id: "quick-status".into(),
                    domain_status: quick_status,
                    checks: vec![],
                    observed_at: None,
                }),
            },
        )
        .unwrap();
        assert_eq!(result.domain_status, DomainStatus::Oom);
    }
}

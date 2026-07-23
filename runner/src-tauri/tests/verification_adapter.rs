use runner_lib::contracts::*;
use runner_lib::hardware_target::{HardwareResolution, ResolutionState};
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
            top_p: None,
            top_k: None,
            min_p: None,
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

fn request() -> VerificationPreparationRequest {
    let artifact_bytes = b"artifact";
    let bench_bytes = b"benchmark executable";
    let quick_bytes = b"quick executable";
    let artifact_path = temp_file("fixture.gguf", artifact_bytes);
    let benchmark_path = temp_file("llama-bench.exe", bench_bytes);
    let quick_path = temp_file("llama-cli.exe", quick_bytes);
    let tool = |kind, path, expected_sha256| ObservedToolIdentityReceipt {
        kind,
        path,
        expected_sha256,
        observed_product: "llama-cpp".into(),
        observed_engine: "llama.cpp".into(),
        observed_engine_build: "b10061-5d5306bf3".into(),
        observed_backend: AcceleratorBackend::Cuda,
        probe_protocol_id: "llama-tool-version-v1".into(),
        observed_at: "2026-07-22T20:00:00Z".into(),
    };
    VerificationPreparationRequest {
        verification_plan_id: "verification-1".into(),
        hardware_target: confirmed_hardware(),
        candidate: candidate(&hash(artifact_bytes)),
        artifact_path,
        expected_artifact_sha256: hash(artifact_bytes),
        benchmark: Some(BenchmarkPreparation {
            plan_id: "benchmark-1".into(),
            tool: tool(
                ExistingToolKind::Benchmark,
                benchmark_path,
                hash(bench_bytes),
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
            tool: tool(ExistingToolKind::QuickCheck, quick_path, hash(quick_bytes)),
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
}

#[test]
fn preparation_fails_closed_on_artifact_tool_and_runtime_mismatch() {
    let mut value = request();
    value.expected_artifact_sha256 = "0".repeat(64);
    let errors = prepare_verification(&value).unwrap_err().join(" ");
    assert!(errors.contains("expected-hash-mismatch"));
    assert!(errors.contains("artifact.hash-mismatch"));

    let mut value = request();
    value.benchmark.as_mut().unwrap().tool.observed_engine_build = "unknown".into();
    assert!(prepare_verification(&value)
        .unwrap_err()
        .join(" ")
        .contains("runtime-mismatch"));
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

use localarcade_llmfit_adapter::{
    AcceleratorRequest, AdapterError, AdvisoryRequest, BackendRequest, BlockCode, GpuDeviceRequest,
    HardwareRequest, UPSTREAM_REVISION, advise,
};

fn cuda_request() -> AdvisoryRequest {
    AdvisoryRequest {
        hardware: HardwareRequest {
            total_ram_gib: Some(32.0),
            available_ram_gib: Some(24.0),
            cpu_cores: Some(16),
            cpu_name: Some("Explicit test CPU".to_string()),
            accelerator: Some(AcceleratorRequest::Gpu {
                devices: vec![GpuDeviceRequest {
                    name: Some("NVIDIA GeForce RTX 3060".to_string()),
                    memory_gib: Some(12.0),
                    count: Some(1),
                    backend: BackendRequest::Cuda,
                }],
                unified_memory: false,
                gpu_available_gib: None,
            }),
        },
        context_tokens: 8_192,
        model_query: Some("qwen".to_string()),
        runtime_constraint: None,
    }
}

fn expect_code<T>(result: Result<T, AdapterError>, code: BlockCode) {
    let error = match result {
        Ok(_) => panic!("request should fail closed"),
        Err(error) => error,
    };
    assert_eq!(error.code, code);
}

#[test]
fn explicit_cuda_request_returns_stable_unranked_formula_advisories() {
    let response = advise(&cuda_request()).expect("explicit request should succeed");
    assert_eq!(response.source.revision, UPSTREAM_REVISION);
    assert_eq!(response.source.evidence, "formula-estimate-only");
    assert_eq!(
        response.source.ordering,
        "stable-model-identity-order-not-ranking"
    );
    assert_eq!(response.source.fixed_ddr_bandwidth_gbps, 50.0);
    assert!(!response.candidates.is_empty());
    assert!(
        response
            .candidates
            .iter()
            .all(|candidate| candidate.model_name.to_lowercase().contains("qwen"))
    );
    assert!(
        response
            .candidates
            .iter()
            .all(|candidate| candidate.estimate_basis.efficiency > 0.0)
    );
    let first = response
        .candidates
        .first()
        .expect("the pinned qwen query must return at least one advisory");
    println!(
        "M-B explicit-input proof: candidates={}, first={} / {:?} / {:?} / {} / {:.3} GiB required / {:.3} tok/s",
        response.candidates.len(),
        first.model_name,
        first.fit_level,
        first.runtime,
        first.quantization,
        first.memory_required_gib,
        first.estimated_generation_tokens_per_second,
    );

    let repeated = advise(&cuda_request()).expect("repeated explicit request should succeed");
    assert_eq!(
        response, repeated,
        "the same explicit input must produce byte-equivalent advisory data",
    );
}

#[test]
fn unknown_backend_is_blocked() {
    let mut request = cuda_request();
    let Some(AcceleratorRequest::Gpu { devices, .. }) = &mut request.hardware.accelerator else {
        panic!("fixture must contain a GPU");
    };
    devices[0].backend = BackendRequest::Unknown;
    expect_code(advise(&request), BlockCode::UnknownBackend);
}

#[test]
fn missing_confirmed_memory_is_blocked() {
    let mut request = cuda_request();
    let Some(AcceleratorRequest::Gpu { devices, .. }) = &mut request.hardware.accelerator else {
        panic!("fixture must contain a GPU");
    };
    devices[0].memory_gib = None;
    expect_code(advise(&request), BlockCode::MissingHardwareField);
}

#[test]
fn heterogeneous_devices_are_blocked() {
    let mut request = cuda_request();
    let Some(AcceleratorRequest::Gpu { devices, .. }) = &mut request.hardware.accelerator else {
        panic!("fixture must contain a GPU");
    };
    devices.push(GpuDeviceRequest {
        name: Some("AMD Radeon RX 7600".to_string()),
        memory_gib: Some(8.0),
        count: Some(1),
        backend: BackendRequest::Rocm,
    });
    expect_code(advise(&request), BlockCode::HeterogeneousAccelerators);
}

#[test]
fn forced_runtime_is_blocked_before_upstream_calculation() {
    let mut request = cuda_request();
    request.runtime_constraint = Some("llama.cpp".to_string());
    expect_code(advise(&request), BlockCode::RuntimeConstraintUnsupported);
}

#[test]
fn malformed_json_does_not_default_missing_hardware() {
    let parsed = serde_json::from_str::<AdvisoryRequest>(r#"{"hardware":{},"contextTokens":8192}"#);
    let request = parsed.expect("optional DTO fields should parse for typed blocking");
    expect_code(advise(&request), BlockCode::MissingHardwareField);
}

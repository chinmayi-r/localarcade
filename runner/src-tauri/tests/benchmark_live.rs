//! Env-gated live benchmark test: runs only when LA_BENCH_ENGINE_DIR and
//! LA_BENCH_MODEL point at a real llama.cpp install and model. Absent in CI.

use runner_lib::benchmark::{run_benchmark, BenchmarkRequest};

#[test]
fn live_benchmark_measures_real_throughput() {
    let (Ok(engine_dir), Ok(model_path)) = (
        std::env::var("LA_BENCH_ENGINE_DIR"),
        std::env::var("LA_BENCH_MODEL"),
    ) else {
        eprintln!("live benchmark skipped: LA_BENCH_ENGINE_DIR / LA_BENCH_MODEL not set");
        return;
    };
    let report = run_benchmark(&BenchmarkRequest {
        engine_dir,
        model_path,
        prompt_tokens: Some(256),
        generation_tokens: Some(64),
        repetitions: Some(3),
        accept_adverse_conditions: true,
    })
    .expect("benchmark completes");
    assert!(matches!(
        report.provenance,
        "verified-local" | "conditioned-local"
    ));
    assert!(report
        .measurements
        .iter()
        .all(|m| m.tokens_per_second > 0.0));
    println!(
        "live benchmark: {} · {} · {}",
        report.engine_build, report.backends, report.gpu_info
    );
    for measurement in &report.measurements {
        println!(
            "  {}: {:.1} tok/s",
            measurement.kind, measurement.tokens_per_second
        );
    }
}

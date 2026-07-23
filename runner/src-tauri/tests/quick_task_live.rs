//! Env-gated live task-suite test. Absent in CI unless the existing llama.cpp
//! installation and model are explicitly supplied.

use runner_lib::quick_task::{run, QuickTaskRequest};

#[test]
fn live_quick_tasks_are_configuration_bound_mechanical_results() {
    let (Ok(engine_dir), Ok(model_path)) = (
        std::env::var("LA_BENCH_ENGINE_DIR"),
        std::env::var("LA_BENCH_MODEL"),
    ) else {
        eprintln!("live quick tasks skipped: LA_BENCH_ENGINE_DIR / LA_BENCH_MODEL not set");
        return;
    };
    let report = run(&QuickTaskRequest {
        engine_dir,
        model_path: model_path.clone(),
        accept_adverse_conditions: true,
    })
    .expect("quick-task suite completes");
    assert_eq!(report.claim, "mechanical-task-checks-only");
    assert_eq!(report.results.len(), 3);
    assert_eq!(report.model_path, model_path);
    assert!(!report.engine_build.is_empty());
    for result in report.results {
        println!("{}: {} — {}", result.label, result.passed, result.output);
    }
}

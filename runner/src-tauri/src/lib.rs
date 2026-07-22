pub mod benchmark;
pub mod contracts;
pub mod hardware;
pub mod model_store;

use serde::Serialize;

/// What this build is and — just as important — what it cannot do. Shown in
/// the UI so the installed artifact never overstates itself. The R-milestone
/// list must match `docs/agent-plan.md` §4b as capabilities are added.
#[derive(Serialize, Clone, PartialEq, Debug)]
pub struct RunnerIdentity {
    pub name: &'static str,
    pub version: &'static str,
    pub milestone: &'static str,
    pub capabilities: &'static [&'static str],
}

pub fn identity() -> RunnerIdentity {
    RunnerIdentity {
        name: "Local Arcade Runner",
        version: env!("CARGO_PKG_VERSION"),
        milestone: "R4-existing-engine",
        // Each entry names its boundary. Uploads and downloads remain absent
        // until their own milestones; execution is limited to the user's own
        // llama-bench on the user's own model files.
        capabilities: &[
            "hardware-detection (read-only, on request, local only)",
            "model-store-scan (read-only, on request, local only)",
            "benchmark (user's own engine + model, on request, watchdogged, local only)",
        ],
    }
}

#[tauri::command]
fn runner_identity() -> RunnerIdentity {
    identity()
}

/// Explicit-request detection (decision-tree F2/B1). Never invoked on launch.
#[tauri::command]
fn detect_hardware() -> hardware::HardwareReport {
    hardware::detect()
}

/// Explicit-request read-only scan (decision-tree F3/E1). Never on launch;
/// the UI lists exactly which directories will be read before the click.
#[tauri::command]
fn scan_model_stores(extra_directories: Vec<String>) -> model_store::ScanReport {
    let home = dirs_home();
    let extras: Vec<std::path::PathBuf> = extra_directories
        .into_iter()
        .filter(|directory| !directory.trim().is_empty())
        .map(std::path::PathBuf::from)
        .collect();
    model_store::scan(&home, &extras)
}

fn dirs_home() -> std::path::PathBuf {
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" })
        .map(std::path::PathBuf::from)
        .unwrap_or_default()
}

/// Explicit-consent benchmark (decision-tree B3-B6). The UI warns that the
/// model will load and the machine will be busy before this is invoked.
#[tauri::command]
fn run_benchmark(
    request: benchmark::BenchmarkRequest,
) -> Result<benchmark::BenchmarkReport, String> {
    benchmark::run_benchmark(&request)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            runner_identity,
            detect_hardware,
            scan_model_stores,
            run_benchmark
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn r4_identity_declares_detection_scan_and_benchmark_only() {
        let id = identity();
        assert_eq!(id.milestone, "R4-existing-engine");
        assert_eq!(
            id.capabilities,
            &[
                "hardware-detection (read-only, on request, local only)",
                "model-store-scan (read-only, on request, local only)",
                "benchmark (user's own engine + model, on request, watchdogged, local only)",
            ],
            "R4-existing-engine adds benchmarking of the user's own engine and nothing else; downloads and uploads belong to later milestones"
        );
        assert_eq!(id.version, env!("CARGO_PKG_VERSION"));
    }
}

pub mod hardware;

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
        milestone: "R2",
        // Each entry names its boundary. Uploads, downloads, scans, and
        // execution remain absent until their own milestones.
        capabilities: &["hardware-detection (read-only, on request, local only)"],
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![runner_identity, detect_hardware])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn r2_identity_declares_exactly_hardware_detection() {
        let id = identity();
        assert_eq!(id.milestone, "R2");
        assert_eq!(
            id.capabilities,
            &["hardware-detection (read-only, on request, local only)"],
            "R2 adds detection and nothing else; new capabilities belong to later R milestones"
        );
        assert_eq!(id.version, env!("CARGO_PKG_VERSION"));
    }
}

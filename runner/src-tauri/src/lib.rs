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
        milestone: "R1",
        // R1 ships with no capabilities at all, by design.
        capabilities: &[],
    }
}

#[tauri::command]
fn runner_identity() -> RunnerIdentity {
    identity()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![runner_identity])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn r1_identity_reports_no_capabilities() {
        let id = identity();
        assert_eq!(id.milestone, "R1");
        assert!(
            id.capabilities.is_empty(),
            "R1 must declare zero capabilities; adding one belongs to a later R milestone"
        );
        assert_eq!(id.version, env!("CARGO_PKG_VERSION"));
    }
}

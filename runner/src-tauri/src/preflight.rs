//! R4/B4 read-only benchmark preflight. Unknown sensors stay unknown; they
//! are never converted into a healthy reading.

use serde::{Deserialize, Serialize};
use std::time::Duration;

const HIGH_CPU_PERCENT: f32 = 25.0;
const LOW_AVAILABLE_MEMORY_PERCENT: f64 = 20.0;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PreflightInputs {
    pub cpu_load_percent: f32,
    pub available_memory_gb: f64,
    pub total_memory_gb: f64,
    pub ac_power: Option<bool>,
    pub thermal_celsius: Option<f32>,
    pub thermal_unavailable_reason: Option<String>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PreflightReport {
    pub cpu_load_percent: f32,
    pub available_memory_gb: f64,
    pub available_memory_percent: f64,
    pub ac_power: Option<bool>,
    pub thermal_celsius: Option<f32>,
    pub thermal_unavailable_reason: Option<String>,
    pub warnings: Vec<String>,
    pub requires_confirmation: bool,
    pub provenance: &'static str,
}

pub fn evaluate(inputs: PreflightInputs) -> PreflightReport {
    let available_memory_percent = if inputs.total_memory_gb > 0.0 {
        inputs.available_memory_gb / inputs.total_memory_gb * 100.0
    } else {
        0.0
    };
    let mut warnings = Vec::new();
    if inputs.cpu_load_percent >= HIGH_CPU_PERCENT {
        warnings.push(format!(
            "baseline CPU load is {:.1}% (condition threshold: {:.0}%)",
            inputs.cpu_load_percent, HIGH_CPU_PERCENT
        ));
    }
    if available_memory_percent < LOW_AVAILABLE_MEMORY_PERCENT {
        warnings.push(format!(
            "only {:.1}% of system memory is available (condition threshold: {:.0}%)",
            available_memory_percent, LOW_AVAILABLE_MEMORY_PERCENT
        ));
    }
    if inputs.ac_power == Some(false) {
        warnings.push("machine is running on battery power".into());
    }
    if let Some(temperature) = inputs.thermal_celsius {
        if temperature >= 85.0 {
            warnings.push(format!("reported temperature is {temperature:.1} °C"));
        }
    }
    PreflightReport {
        cpu_load_percent: inputs.cpu_load_percent,
        available_memory_gb: inputs.available_memory_gb,
        available_memory_percent,
        ac_power: inputs.ac_power,
        thermal_celsius: inputs.thermal_celsius,
        thermal_unavailable_reason: inputs.thermal_unavailable_reason,
        requires_confirmation: !warnings.is_empty(),
        warnings,
        provenance: "detected-local",
    }
}

pub fn inspect() -> PreflightReport {
    let mut system = sysinfo::System::new();
    system.refresh_memory();
    system.refresh_cpu_usage();
    std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL.max(Duration::from_millis(200)));
    system.refresh_cpu_usage();
    evaluate(PreflightInputs {
        cpu_load_percent: system.global_cpu_usage(),
        available_memory_gb: system.available_memory() as f64 / 2f64.powi(30),
        total_memory_gb: system.total_memory() as f64 / 2f64.powi(30),
        ac_power: detect_ac_power(),
        thermal_celsius: None,
        thermal_unavailable_reason: Some(
            "no trustworthy unprivileged temperature sensor is available in this build".into(),
        ),
    })
}

#[cfg(windows)]
fn detect_ac_power() -> Option<bool> {
    use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
    let mut status = SYSTEM_POWER_STATUS::default();
    unsafe { GetSystemPowerStatus(&mut status).ok()? };
    match status.ACLineStatus {
        0 => Some(false),
        1 => Some(true),
        _ => None,
    }
}

#[cfg(not(windows))]
fn detect_ac_power() -> Option<bool> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn normal() -> PreflightInputs {
        PreflightInputs {
            cpu_load_percent: 10.0,
            available_memory_gb: 24.0,
            total_memory_gb: 32.0,
            ac_power: Some(true),
            thermal_celsius: None,
            thermal_unavailable_reason: Some("sensor unavailable".into()),
        }
    }

    #[test]
    fn adverse_known_conditions_require_confirmation() {
        let report = evaluate(PreflightInputs {
            cpu_load_percent: 40.0,
            available_memory_gb: 4.0,
            ac_power: Some(false),
            ..normal()
        });
        assert!(report.requires_confirmation);
        assert_eq!(report.warnings.len(), 3);
    }

    #[test]
    fn unknown_sensors_remain_visible_and_are_not_declared_safe() {
        let report = evaluate(PreflightInputs {
            ac_power: None,
            ..normal()
        });
        assert!(!report.requires_confirmation);
        assert_eq!(report.ac_power, None);
        assert_eq!(report.thermal_celsius, None);
        assert_eq!(
            report.thermal_unavailable_reason.as_deref(),
            Some("sensor unavailable")
        );
    }
}

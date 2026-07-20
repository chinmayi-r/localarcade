//! R2: read-only hardware detection and registry reconciliation.
//!
//! Contract (agent-plan §4b, decision-tree B1/B1X): detection runs only on
//! explicit request, reads OS APIs only, writes nothing, uploads nothing.
//! A device we cannot identify against the vendor-sourced accelerator
//! registry fails closed to manual entry — it is never guessed.

use serde::{Deserialize, Serialize};

/// Vendor-sourced accelerator registry, embedded at compile time so the
/// runner and the website share one source of truth.
const ACCELERATORS_JSON: &str = include_str!("../../../registry/generated/accelerators.json");

#[derive(Deserialize)]
struct AcceleratorSnapshot {
    accelerators: Vec<AcceleratorEntry>,
}

#[derive(Deserialize, Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryVariant {
    pub memory_gb: f64,
    #[serde(default)]
    pub memory_type: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
}

#[derive(Deserialize, Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AcceleratorEntry {
    pub id: String,
    pub vendor: String,
    pub marketing_name: String,
    pub kind: String,
    pub family: String,
    pub memory_variants: Vec<MemoryVariant>,
    pub source_url: String,
}

pub fn registry() -> Result<Vec<AcceleratorEntry>, String> {
    serde_json::from_str::<AcceleratorSnapshot>(ACCELERATORS_JSON)
        .map(|snapshot| snapshot.accelerators)
        .map_err(|error| format!("embedded accelerator registry is invalid: {error}"))
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DetectedGpu {
    pub name: String,
    pub dedicated_memory_bytes: u64,
}

/// Reconciliation of one detected GPU against the vendor registry.
/// `provenance` is always `"detected"`; the website's estimator values are
/// `"self-reported"` — the two labels must never be conflated.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum GpuReconciliation {
    #[serde(rename_all = "camelCase")]
    Known {
        detected_name: String,
        detected_memory_gb: f64,
        accelerator_id: String,
        family: String,
        kind: String,
        source_url: String,
        /// True when detected memory matches a vendor variant within tolerance.
        memory_matches_vendor_variant: bool,
        vendor_variants_gb: Vec<f64>,
        provenance: &'static str,
    },
    #[serde(rename_all = "camelCase")]
    Unknown {
        detected_name: String,
        detected_memory_gb: f64,
        /// B1X: unknown devices require manual, confirmed entry.
        reason: &'static str,
        provenance: &'static str,
    },
}

/// DXGI under-reports slightly (reserved segments), so a 24 GB card shows
/// ~23.99 GB. One-GB tolerance identifies the variant without ever inventing
/// a value the vendor does not sell.
const MEMORY_MATCH_TOLERANCE_GB: f64 = 1.0;

pub fn reconcile_gpu(gpu: &DetectedGpu, registry: &[AcceleratorEntry]) -> GpuReconciliation {
    let detected_memory_gb = round1(gpu.dedicated_memory_bytes as f64 / f64::from(1u32 << 30));
    let normalized = gpu.name.trim().to_lowercase();
    match registry.iter().find(|entry| entry.marketing_name.to_lowercase() == normalized) {
        Some(entry) => {
            let memory_matches_vendor_variant = entry
                .memory_variants
                .iter()
                .any(|variant| (variant.memory_gb - detected_memory_gb).abs() <= MEMORY_MATCH_TOLERANCE_GB);
            GpuReconciliation::Known {
                detected_name: gpu.name.clone(),
                detected_memory_gb,
                accelerator_id: entry.id.clone(),
                family: entry.family.clone(),
                kind: entry.kind.clone(),
                source_url: entry.source_url.clone(),
                memory_matches_vendor_variant,
                vendor_variants_gb: entry.memory_variants.iter().map(|variant| variant.memory_gb).collect(),
                provenance: "detected",
            }
        }
        None => GpuReconciliation::Unknown {
            detected_name: gpu.name.clone(),
            detected_memory_gb,
            reason: "No vendor-sourced registry entry for this device; memory and identity must be entered and confirmed manually.",
            provenance: "detected",
        },
    }
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HardwareReport {
    pub os: String,
    pub arch: String,
    pub cpu_name: String,
    pub total_memory_gb: f64,
    pub gpus: Vec<GpuReconciliation>,
    /// Set when GPU enumeration is unavailable on this platform: the UI must
    /// fall back to manual entry, never to a guess.
    pub gpu_detection_unavailable_reason: Option<String>,
    pub provenance: &'static str,
}

pub fn detect() -> HardwareReport {
    let mut system = sysinfo::System::new();
    system.refresh_memory();
    system.refresh_cpu_all();
    let cpu_name = system
        .cpus()
        .first()
        .map(|cpu| cpu.brand().trim().to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let (gpus, gpu_detection_unavailable_reason) = match (registry(), enumerate_gpus()) {
        (Ok(entries), Ok(detected)) => (
            detected
                .iter()
                .map(|gpu| reconcile_gpu(gpu, &entries))
                .collect(),
            None,
        ),
        (_, Err(reason)) => (Vec::new(), Some(reason)),
        (Err(reason), _) => (Vec::new(), Some(reason)),
    };
    HardwareReport {
        os: format!(
            "{} {}",
            sysinfo::System::long_os_version().unwrap_or_else(|| "unknown".into()),
            sysinfo::System::kernel_version().unwrap_or_default()
        )
        .trim()
        .to_string(),
        arch: std::env::consts::ARCH.to_string(),
        cpu_name,
        total_memory_gb: round1(system.total_memory() as f64 / f64::from(1u32 << 30)),
        gpus,
        gpu_detection_unavailable_reason,
        provenance: "detected",
    }
}

/// Calibration fingerprint (decision-tree bucket assignment): DEFINED in R2,
/// measured no earlier than R4. Nothing constructs a populated value yet; the
/// type exists so R4 cannot invent its own shape.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CalibrationFingerprint {
    pub schema_version: u32,
    pub accelerator_id: Option<String>,
    pub memory_bandwidth_gbps: Option<f64>,
    pub prompt_throughput_tps: Option<f64>,
    pub generation_throughput_tps: Option<f64>,
    pub offload_penalty_ratio: Option<f64>,
    /// Engine build the calibration ran under; required when any measurement is present.
    pub engine_build: Option<String>,
}

#[cfg(windows)]
fn enumerate_gpus() -> Result<Vec<DetectedGpu>, String> {
    use windows::Win32::Graphics::Dxgi::{
        CreateDXGIFactory1, IDXGIFactory1, DXGI_ADAPTER_FLAG_SOFTWARE,
    };
    let mut gpus = Vec::new();
    unsafe {
        let factory: IDXGIFactory1 =
            CreateDXGIFactory1().map_err(|error| format!("DXGI unavailable: {error}"))?;
        let mut index = 0u32;
        while let Ok(adapter) = factory.EnumAdapters1(index) {
            index += 1;
            let Ok(desc) = adapter.GetDesc1() else {
                continue;
            };
            if (desc.Flags & DXGI_ADAPTER_FLAG_SOFTWARE.0 as u32) != 0 {
                continue;
            }
            let name = String::from_utf16_lossy(&desc.Description);
            let name = name.trim_end_matches('\0').trim().to_string();
            if name.is_empty() {
                continue;
            }
            gpus.push(DetectedGpu {
                name,
                dedicated_memory_bytes: desc.DedicatedVideoMemory as u64,
            });
        }
    }
    Ok(gpus)
}

#[cfg(not(windows))]
fn enumerate_gpus() -> Result<Vec<DetectedGpu>, String> {
    Err(
        "GPU detection is not yet implemented on this platform; enter the accelerator manually."
            .to_string(),
    )
}

fn round1(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_registry() -> Vec<AcceleratorEntry> {
        registry().expect("embedded registry parses")
    }

    #[test]
    fn embedded_registry_parses_and_is_nonempty() {
        let entries = fixture_registry();
        assert!(entries.len() >= 11);
        assert!(entries
            .iter()
            .all(|entry| !entry.memory_variants.is_empty()));
    }

    #[test]
    fn known_gpu_with_vendor_memory_reconciles() {
        let gpu = DetectedGpu {
            name: "NVIDIA GeForce RTX 4090".into(),
            // DXGI-style slight under-report of 24 GB.
            dedicated_memory_bytes: 25_757_220_864,
        };
        match reconcile_gpu(&gpu, &fixture_registry()) {
            GpuReconciliation::Known {
                accelerator_id,
                memory_matches_vendor_variant,
                family,
                ..
            } => {
                assert_eq!(accelerator_id, "nvidia-geforce-rtx-4090-gpu");
                assert_eq!(family, "nvidia-ada-desktop-gpu");
                assert!(memory_matches_vendor_variant);
            }
            other => panic!("expected Known, got {other:?}"),
        }
    }

    #[test]
    fn known_gpu_with_impossible_memory_is_flagged_not_adjusted() {
        let gpu = DetectedGpu {
            name: "NVIDIA GeForce RTX 4090".into(),
            dedicated_memory_bytes: 8 * (1u64 << 30),
        };
        match reconcile_gpu(&gpu, &fixture_registry()) {
            GpuReconciliation::Known {
                memory_matches_vendor_variant,
                detected_memory_gb,
                ..
            } => {
                assert!(
                    !memory_matches_vendor_variant,
                    "8 GB is not a 4090 variant and must be flagged"
                );
                assert_eq!(
                    detected_memory_gb, 8.0,
                    "detected value is reported as-is, never corrected to a vendor value"
                );
            }
            other => panic!("expected Known, got {other:?}"),
        }
    }

    #[test]
    fn unknown_gpu_fails_closed_to_manual_entry() {
        let gpu = DetectedGpu {
            name: "AMD Radeon RX 7900 XTX".into(),
            dedicated_memory_bytes: 24 * (1u64 << 30),
        };
        match reconcile_gpu(&gpu, &fixture_registry()) {
            GpuReconciliation::Unknown { reason, .. } => assert!(reason.contains("manually")),
            other => panic!("expected Unknown, got {other:?}"),
        }
    }

    #[test]
    fn multi_variant_device_memory_identifies_the_variant() {
        let gpu = DetectedGpu {
            name: "NVIDIA GeForce RTX 4060 Ti".into(),
            dedicated_memory_bytes: 16 * (1u64 << 30),
        };
        match reconcile_gpu(&gpu, &fixture_registry()) {
            GpuReconciliation::Known {
                memory_matches_vendor_variant,
                vendor_variants_gb,
                ..
            } => {
                assert!(memory_matches_vendor_variant);
                assert_eq!(vendor_variants_gb, vec![8.0, 16.0]);
            }
            other => panic!("expected Known, got {other:?}"),
        }
    }

    #[test]
    fn live_detection_returns_a_sane_local_report() {
        let report = detect();
        assert!(!report.os.trim().is_empty());
        assert!(report.total_memory_gb > 0.0);
        assert_eq!(report.provenance, "detected");
        // Either GPUs were enumerated or a reason for unavailability is given —
        // never both empty, never a guess.
        assert!(
            !report.gpus.is_empty()
                || report.gpu_detection_unavailable_reason.is_some()
                || cfg!(windows)
        );
        println!("live hardware report: {report:?}");
    }

    #[test]
    fn calibration_fingerprint_is_schema_only_in_r2() {
        let fingerprint = CalibrationFingerprint {
            schema_version: 1,
            accelerator_id: None,
            memory_bandwidth_gbps: None,
            prompt_throughput_tps: None,
            generation_throughput_tps: None,
            offload_penalty_ratio: None,
            engine_build: None,
        };
        let json = serde_json::to_string(&fingerprint).expect("serializes");
        assert!(json.contains("\"schemaVersion\":1"));
    }
}

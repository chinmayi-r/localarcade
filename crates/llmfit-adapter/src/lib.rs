//! Fail-closed Local Arcade boundary around the pinned llmfit advisory core.
//!
//! This crate deliberately has no hardware detection, provider discovery,
//! benchmark-history, community-evidence, localmaxxing, or ranking behavior.

use llmfit_core::fit::{
    CalcConfig, FitLevel, InferenceRuntime, ModelFit, RunMode, backend_compatible,
};
use llmfit_core::hardware::{GpuBackend, GpuInfo, SystemSpecs};
use llmfit_core::models::ModelDatabase;
use serde::{Deserialize, Serialize};
use std::fmt;

pub const UPSTREAM_VERSION: &str = "1.1.6";
pub const UPSTREAM_REVISION: &str = "aaa2bc179cec214ccdc44501c853b98fba0b343b";
pub const FIXED_DDR_BANDWIDTH_GBPS: f64 = 50.0;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvisoryRequest {
    pub hardware: HardwareRequest,
    pub context_tokens: u32,
    #[serde(default)]
    pub model_query: Option<String>,
    #[serde(default)]
    pub runtime_constraint: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareRequest {
    pub total_ram_gib: Option<f64>,
    pub available_ram_gib: Option<f64>,
    pub cpu_cores: Option<usize>,
    pub cpu_name: Option<String>,
    pub accelerator: Option<AcceleratorRequest>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum AcceleratorRequest {
    Cpu {
        backend: BackendRequest,
    },
    Gpu {
        devices: Vec<GpuDeviceRequest>,
        unified_memory: bool,
        gpu_available_gib: Option<f64>,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuDeviceRequest {
    pub name: Option<String>,
    pub memory_gib: Option<f64>,
    pub count: Option<u32>,
    pub backend: BackendRequest,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum BackendRequest {
    Cuda,
    Metal,
    Rocm,
    Vulkan,
    Sycl,
    CpuArm,
    CpuX86,
    Ascend,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvisoryResponse {
    pub source: AdvisorySource,
    pub candidates: Vec<AdvisoryCandidate>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvisorySource {
    pub provider: &'static str,
    pub version: &'static str,
    pub revision: &'static str,
    pub catalog: &'static str,
    pub evidence: &'static str,
    pub ordering: &'static str,
    pub fixed_ddr_bandwidth_gbps: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvisoryCandidate {
    pub model_name: String,
    pub model_provider: String,
    pub fit_level: AdvisoryFitLevel,
    pub run_mode: AdvisoryRunMode,
    pub runtime: AdvisoryRuntime,
    pub quantization: String,
    pub memory_required_gib: f64,
    pub memory_available_gib: f64,
    pub utilization_percent: f64,
    pub estimated_generation_tokens_per_second: f64,
    pub effective_context_tokens: u32,
    pub usable_context_tokens: u32,
    pub estimate_basis: AdvisoryEstimateBasis,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AdvisoryFitLevel {
    Perfect,
    Good,
    Marginal,
    TooTight,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AdvisoryRunMode {
    Gpu,
    MoeOffload,
    CpuOffload,
    CpuOnly,
    TensorParallel,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AdvisoryRuntime {
    LlamaCpp,
    Mlx,
    Vllm,
    Unsupported,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvisoryEstimateBasis {
    pub method: String,
    pub gpu_bandwidth_gbps: Option<f64>,
    pub ddr_bandwidth_gbps: Option<f64>,
    pub efficiency: f64,
    pub assumed_context_tokens: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum BlockCode {
    MissingHardwareField,
    InvalidHardwareValue,
    UnknownBackend,
    HeterogeneousAccelerators,
    UnsupportedTopology,
    RuntimeConstraintUnsupported,
    InvalidContext,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdapterError {
    pub code: BlockCode,
    pub field: &'static str,
    pub message: String,
}

impl AdapterError {
    fn new(code: BlockCode, field: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            field,
            message: message.into(),
        }
    }
}

impl fmt::Display for AdapterError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.field, self.message)
    }
}

impl std::error::Error for AdapterError {}

/// Calculate unsorted, upstream advisory candidates from explicit input only.
pub fn advise(request: &AdvisoryRequest) -> Result<AdvisoryResponse, AdapterError> {
    if request.context_tokens == 0 {
        return Err(AdapterError::new(
            BlockCode::InvalidContext,
            "contextTokens",
            "context must be greater than zero",
        ));
    }
    if request.runtime_constraint.is_some() {
        return Err(AdapterError::new(
            BlockCode::RuntimeConstraintUnsupported,
            "runtimeConstraint",
            "the pinned public API cannot combine an explicit calculation configuration with a forced runtime",
        ));
    }

    let specs = build_specs(&request.hardware)?;
    let query = request
        .model_query
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_lowercase);
    let database = ModelDatabase::embedded();
    let config = CalcConfig {
        context_cap: Some(request.context_tokens),
        ddr_bandwidth_gbps: Some(FIXED_DDR_BANDWIDTH_GBPS),
        ..CalcConfig::default()
    };

    let mut candidates: Vec<_> = database
        .get_all_models()
        .iter()
        .filter(|model| backend_compatible(model, &specs))
        .filter(|model| {
            query.as_ref().is_none_or(|needle| {
                model.name.to_lowercase().contains(needle)
                    || model.provider.to_lowercase().contains(needle)
            })
        })
        .map(|model| ModelFit::analyze_with_config(model, &specs, config.clone()))
        .map(normalize_fit)
        .collect();
    candidates.sort_by(|left, right| {
        left.model_name
            .cmp(&right.model_name)
            .then_with(|| left.model_provider.cmp(&right.model_provider))
    });

    Ok(AdvisoryResponse {
        source: AdvisorySource {
            provider: "llmfit-core",
            version: UPSTREAM_VERSION,
            revision: UPSTREAM_REVISION,
            catalog: "pinned-embedded",
            evidence: "formula-estimate-only",
            ordering: "stable-model-identity-order-not-ranking",
            fixed_ddr_bandwidth_gbps: FIXED_DDR_BANDWIDTH_GBPS,
        },
        candidates,
    })
}

fn build_specs(input: &HardwareRequest) -> Result<SystemSpecs, AdapterError> {
    let total_ram_gb = required_positive(input.total_ram_gib, "hardware.totalRamGib")?;
    let available_ram_gb = required_positive(input.available_ram_gib, "hardware.availableRamGib")?;
    if available_ram_gb > total_ram_gb {
        return Err(AdapterError::new(
            BlockCode::InvalidHardwareValue,
            "hardware.availableRamGib",
            "available RAM cannot exceed total RAM",
        ));
    }
    let total_cpu_cores = input.cpu_cores.filter(|value| *value > 0).ok_or_else(|| {
        AdapterError::new(
            BlockCode::MissingHardwareField,
            "hardware.cpuCores",
            "a positive logical CPU count is required",
        )
    })?;
    let cpu_name = required_text(input.cpu_name.as_deref(), "hardware.cpuName")?;
    let accelerator = input.accelerator.as_ref().ok_or_else(|| {
        AdapterError::new(
            BlockCode::MissingHardwareField,
            "hardware.accelerator",
            "an explicit CPU or GPU target is required",
        )
    })?;

    match accelerator {
        AcceleratorRequest::Cpu { backend } => {
            let backend = map_cpu_backend(backend)?;
            Ok(SystemSpecs {
                total_ram_gb,
                available_ram_gb,
                total_cpu_cores,
                cpu_name,
                has_gpu: false,
                gpu_vram_gb: None,
                total_gpu_vram_gb: None,
                gpu_available_gb: None,
                gpu_name: None,
                gpu_count: 0,
                unified_memory: false,
                backend,
                gpus: Vec::new(),
                cluster_mode: false,
                cluster_node_count: 0,
            })
        }
        AcceleratorRequest::Gpu {
            devices,
            unified_memory,
            gpu_available_gib,
        } => {
            if devices.is_empty() {
                return Err(AdapterError::new(
                    BlockCode::MissingHardwareField,
                    "hardware.accelerator.devices",
                    "at least one GPU device is required",
                ));
            }
            if devices.len() != 1 {
                return Err(AdapterError::new(
                    BlockCode::HeterogeneousAccelerators,
                    "hardware.accelerator.devices",
                    "the adapter does not aggregate heterogeneous device records",
                ));
            }
            let device = &devices[0];
            let name = required_text(
                device.name.as_deref(),
                "hardware.accelerator.devices[0].name",
            )?;
            let memory_gib = required_positive(
                device.memory_gib,
                "hardware.accelerator.devices[0].memoryGib",
            )?;
            let count = device.count.filter(|value| *value > 0).ok_or_else(|| {
                AdapterError::new(
                    BlockCode::MissingHardwareField,
                    "hardware.accelerator.devices[0].count",
                    "a positive identical-device count is required",
                )
            })?;
            if *unified_memory && count != 1 {
                return Err(AdapterError::new(
                    BlockCode::UnsupportedTopology,
                    "hardware.accelerator.devices[0].count",
                    "multi-device unified-memory aggregation is unsupported",
                ));
            }
            let backend = map_gpu_backend(&device.backend)?;
            let gpu_available_gb = if *unified_memory {
                let available =
                    required_positive(*gpu_available_gib, "hardware.accelerator.gpuAvailableGib")?;
                if available > memory_gib {
                    return Err(AdapterError::new(
                        BlockCode::InvalidHardwareValue,
                        "hardware.accelerator.gpuAvailableGib",
                        "available GPU working memory cannot exceed the unified-memory pool",
                    ));
                }
                Some(available)
            } else {
                if gpu_available_gib.is_some() {
                    return Err(AdapterError::new(
                        BlockCode::InvalidHardwareValue,
                        "hardware.accelerator.gpuAvailableGib",
                        "GPU working-set availability is accepted only for unified memory",
                    ));
                }
                None
            };
            let fit_memory_gib = gpu_available_gb.unwrap_or(memory_gib);
            let total_gpu_vram_gb = fit_memory_gib * f64::from(count);
            let gpu = GpuInfo {
                name: name.clone(),
                vram_gb: Some(fit_memory_gib),
                backend,
                count,
                unified_memory: *unified_memory,
            };

            Ok(SystemSpecs {
                total_ram_gb,
                available_ram_gb,
                total_cpu_cores,
                cpu_name,
                has_gpu: true,
                gpu_vram_gb: Some(fit_memory_gib),
                total_gpu_vram_gb: Some(total_gpu_vram_gb),
                gpu_available_gb,
                gpu_name: Some(name),
                gpu_count: count,
                unified_memory: *unified_memory,
                backend,
                gpus: vec![gpu],
                cluster_mode: false,
                cluster_node_count: 0,
            })
        }
    }
}

fn required_positive(value: Option<f64>, field: &'static str) -> Result<f64, AdapterError> {
    value
        .filter(|number| number.is_finite() && *number > 0.0)
        .ok_or_else(|| {
            AdapterError::new(
                BlockCode::MissingHardwareField,
                field,
                "a finite positive value is required",
            )
        })
}

fn required_text(value: Option<&str>, field: &'static str) -> Result<String, AdapterError> {
    value
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_owned)
        .ok_or_else(|| {
            AdapterError::new(
                BlockCode::MissingHardwareField,
                field,
                "a non-empty value is required",
            )
        })
}

fn map_cpu_backend(value: &BackendRequest) -> Result<GpuBackend, AdapterError> {
    match value {
        BackendRequest::CpuArm => Ok(GpuBackend::CpuArm),
        BackendRequest::CpuX86 => Ok(GpuBackend::CpuX86),
        BackendRequest::Unknown => Err(AdapterError::new(
            BlockCode::UnknownBackend,
            "hardware.accelerator.backend",
            "unknown CPU backend",
        )),
        _ => Err(AdapterError::new(
            BlockCode::InvalidHardwareValue,
            "hardware.accelerator.backend",
            "CPU targets require cpu-arm or cpu-x86",
        )),
    }
}

fn map_gpu_backend(value: &BackendRequest) -> Result<GpuBackend, AdapterError> {
    match value {
        BackendRequest::Cuda => Ok(GpuBackend::Cuda),
        BackendRequest::Metal => Ok(GpuBackend::Metal),
        BackendRequest::Rocm => Ok(GpuBackend::Rocm),
        BackendRequest::Vulkan => Ok(GpuBackend::Vulkan),
        BackendRequest::Sycl => Ok(GpuBackend::Sycl),
        BackendRequest::Ascend => Ok(GpuBackend::Ascend),
        BackendRequest::Unknown => Err(AdapterError::new(
            BlockCode::UnknownBackend,
            "hardware.accelerator.devices[0].backend",
            "unknown GPU backend",
        )),
        BackendRequest::CpuArm | BackendRequest::CpuX86 => Err(AdapterError::new(
            BlockCode::InvalidHardwareValue,
            "hardware.accelerator.devices[0].backend",
            "GPU targets cannot use a CPU backend",
        )),
    }
}

fn normalize_fit(fit: ModelFit) -> AdvisoryCandidate {
    AdvisoryCandidate {
        model_name: fit.model.name,
        model_provider: fit.model.provider,
        fit_level: match fit.fit_level {
            FitLevel::Perfect => AdvisoryFitLevel::Perfect,
            FitLevel::Good => AdvisoryFitLevel::Good,
            FitLevel::Marginal => AdvisoryFitLevel::Marginal,
            FitLevel::TooTight => AdvisoryFitLevel::TooTight,
        },
        run_mode: match fit.run_mode {
            RunMode::Gpu => AdvisoryRunMode::Gpu,
            RunMode::MoeOffload => AdvisoryRunMode::MoeOffload,
            RunMode::CpuOffload => AdvisoryRunMode::CpuOffload,
            RunMode::CpuOnly => AdvisoryRunMode::CpuOnly,
            RunMode::TensorParallel => AdvisoryRunMode::TensorParallel,
        },
        runtime: match fit.runtime {
            InferenceRuntime::LlamaCpp => AdvisoryRuntime::LlamaCpp,
            InferenceRuntime::Mlx => AdvisoryRuntime::Mlx,
            InferenceRuntime::Vllm => AdvisoryRuntime::Vllm,
            InferenceRuntime::Unsupported => AdvisoryRuntime::Unsupported,
        },
        quantization: fit.best_quant,
        memory_required_gib: fit.memory_required_gb,
        memory_available_gib: fit.memory_available_gb,
        utilization_percent: fit.utilization_pct,
        estimated_generation_tokens_per_second: fit.estimated_tps,
        effective_context_tokens: fit.effective_context_length,
        usable_context_tokens: fit.usable_context,
        estimate_basis: AdvisoryEstimateBasis {
            method: fit.estimate_basis.method,
            gpu_bandwidth_gbps: fit.estimate_basis.gpu_bandwidth_gbps,
            ddr_bandwidth_gbps: fit.estimate_basis.ddr_bandwidth_gbps,
            efficiency: fit.estimate_basis.efficiency,
            assumed_context_tokens: fit.estimate_basis.assumed_context,
        },
        notes: fit.notes,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn positive_values_reject_non_finite_input() {
        let error = required_positive(Some(f64::NAN), "test.value")
            .expect_err("non-finite values must fail closed");
        assert_eq!(error.code, BlockCode::MissingHardwareField);
        assert_eq!(error.field, "test.value");
    }

    #[test]
    fn available_ram_cannot_exceed_total_ram() {
        let input = HardwareRequest {
            total_ram_gib: Some(16.0),
            available_ram_gib: Some(20.0),
            cpu_cores: Some(8),
            cpu_name: Some("Explicit CPU".to_string()),
            accelerator: Some(AcceleratorRequest::Cpu {
                backend: BackendRequest::CpuX86,
            }),
        };
        let error = build_specs(&input).expect_err("contradictory RAM must fail closed");
        assert_eq!(error.code, BlockCode::InvalidHardwareValue);
        assert_eq!(error.field, "hardware.availableRamGib");
    }
}

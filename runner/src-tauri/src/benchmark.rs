//! R4 (existing-engine slice): explicit-consent benchmark of a model the
//! user already has, with the llama.cpp `llama-bench` binary the user
//! already runs. Trust boundary, stated honestly: this executes the user's
//! own engine on the user's own model — the same software they run daily —
//! under a watchdog kill-timeout. The stronger sandbox (T7) applies to the
//! future *bundled* engine executing *downloaded* artifacts and remains
//! gated. Results are local-only; nothing is uploaded.

use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;

/// The only executable this module will ever spawn (boundary-tested).
const BENCH_EXECUTABLE: &str = "llama-bench";
const BENCH_TIMEOUT: Duration = Duration::from_secs(600);
const MIN_STABLE_SAMPLES: usize = 3;
const MAX_STABLE_RELATIVE_RANGE: f64 = 0.20;

#[derive(Deserialize, Serialize, Clone, Debug, PartialEq)]
pub struct LlamaBenchRow {
    pub build_commit: String,
    pub build_number: u64,
    #[serde(default)]
    pub cpu_info: String,
    #[serde(default)]
    pub gpu_info: String,
    #[serde(default)]
    pub backends: String,
    pub model_filename: String,
    #[serde(default)]
    pub model_type: String,
    #[serde(default)]
    pub model_size: u64,
    #[serde(default)]
    pub type_k: String,
    #[serde(default)]
    pub type_v: String,
    #[serde(default)]
    pub n_gpu_layers: i64,
    pub n_batch: u64,
    pub n_ubatch: u64,
    pub n_threads: u64,
    pub n_depth: u64,
    pub flash_attn: i64,
    pub use_mmap: bool,
    pub n_prompt: u64,
    pub n_gen: u64,
    pub avg_ts: f64,
    #[serde(default)]
    pub stddev_ts: f64,
    #[serde(default)]
    pub samples_ts: Vec<f64>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BenchmarkMeasurement {
    pub kind: String,
    pub tokens: u64,
    pub tokens_per_second: f64,
    pub samples: Vec<f64>,
    pub repeatability: String,
    pub relative_range: Option<f64>,
    pub quality_reason: String,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BenchmarkReport {
    pub engine: String,
    pub engine_build: String,
    pub backends: String,
    pub gpu_info: String,
    pub model_filename: String,
    pub model_type: String,
    pub kv_cache: String,
    pub gpu_layers: i64,
    pub batch_size: u64,
    pub ubatch_size: u64,
    pub threads: u64,
    /// llama-bench's reported `n_depth` test setting. This is not a claim
    /// about the model or engine's maximum supported context.
    pub context_test_depth_tokens: u64,
    pub flash_attention: i64,
    pub mmap: bool,
    pub measurements: Vec<BenchmarkMeasurement>,
    pub measurement_quality: String,
    pub quality_reasons: Vec<String>,
    pub preflight: Option<crate::preflight::PreflightReport>,
    pub calibration_eligibility: CalibrationEligibility,
    /// `verified-local` requires repeatable samples on THIS machine with
    /// THIS exact identity. `conditioned-local` preserves valid observations
    /// that are not stable enough to act as a baseline.
    pub provenance: &'static str,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CalibrationEligibility {
    pub eligible: bool,
    pub reasons: Vec<String>,
}

fn assess_calibration_eligibility(
    measurement_quality: &str,
    preflight: Option<&crate::preflight::PreflightReport>,
    gpu_contention_known_clear: Option<bool>,
) -> CalibrationEligibility {
    let mut reasons = Vec::new();
    if measurement_quality != "stable" {
        reasons.push("throughput samples were not repeatably stable".into());
    }
    match preflight {
        Some(report) => {
            reasons.extend(
                report
                    .warnings
                    .iter()
                    .map(|warning| format!("preflight condition: {warning}")),
            );
            if report.ac_power.is_none() {
                reasons.push("power source was unknown".into());
            }
            if report.thermal_celsius.is_none() {
                reasons.push("temperature/throttling state was unknown".into());
            }
        }
        None => reasons.push("environmental preflight was unavailable".into()),
    }
    match gpu_contention_known_clear {
        Some(true) => {}
        Some(false) => reasons.push("another workload was using the GPU".into()),
        None => reasons.push("concurrent GPU workload telemetry was unavailable".into()),
    }
    CalibrationEligibility {
        eligible: reasons.is_empty(),
        reasons,
    }
}

fn classify_repeatability(samples: &[f64]) -> (String, Option<f64>, String) {
    if samples.len() < MIN_STABLE_SAMPLES {
        return (
            "insufficient-samples".into(),
            None,
            format!(
                "needs at least {MIN_STABLE_SAMPLES} repetitions; received {}",
                samples.len()
            ),
        );
    }
    let mut sorted = samples.to_vec();
    sorted.sort_by(f64::total_cmp);
    let median = sorted[sorted.len() / 2];
    let relative_range = (sorted[sorted.len() - 1] - sorted[0]) / median;
    if relative_range <= MAX_STABLE_RELATIVE_RANGE {
        (
            "stable".into(),
            Some(relative_range),
            format!(
                "sample range is {:.1}% of the median",
                relative_range * 100.0
            ),
        )
    } else {
        (
            "variable".into(),
            Some(relative_range),
            format!(
                "sample range is {:.1}% of the median; stable requires at most {:.0}%",
                relative_range * 100.0,
                MAX_STABLE_RELATIVE_RANGE * 100.0
            ),
        )
    }
}

/// Parse `llama-bench -o json` output. Fails closed on anything unexpected.
pub fn parse_bench_output(json: &str) -> Result<BenchmarkReport, String> {
    let rows: Vec<LlamaBenchRow> = serde_json::from_str(json)
        .map_err(|error| format!("llama-bench output was not the expected JSON: {error}"))?;
    let first = rows.first().ok_or("llama-bench returned no test rows")?;
    if rows.iter().any(|row| {
        row.build_commit != first.build_commit
            || row.build_number != first.build_number
            || row.backends != first.backends
            || row.gpu_info != first.gpu_info
            || row.model_filename != first.model_filename
            || row.model_type != first.model_type
            || row.model_size != first.model_size
            || row.type_k != first.type_k
            || row.type_v != first.type_v
            || row.n_gpu_layers != first.n_gpu_layers
            || row.n_batch != first.n_batch
            || row.n_ubatch != first.n_ubatch
            || row.n_threads != first.n_threads
            || row.n_depth != first.n_depth
            || row.flash_attn != first.flash_attn
            || row.use_mmap != first.use_mmap
    }) {
        return Err(
            "llama-bench rows disagree on engine, model, or benchmark configuration identity"
                .into(),
        );
    }
    if first.build_commit.trim().is_empty()
        || first.backends.trim().is_empty()
        || first.model_filename.trim().is_empty()
        || first.model_type.trim().is_empty()
        || first.model_size == 0
        || first.n_depth == 0
    {
        return Err("llama-bench returned incomplete build, backend, or model identity".into());
    }
    if rows.iter().any(|row| {
        !row.avg_ts.is_finite()
            || row.avg_ts <= 0.0
            || (row.n_prompt == 0 && row.n_gen == 0)
            || row.samples_ts.is_empty()
            || row
                .samples_ts
                .iter()
                .any(|sample| !sample.is_finite() || *sample <= 0.0)
    }) {
        return Err("llama-bench returned missing or invalid throughput samples".into());
    }
    let measurements: Vec<BenchmarkMeasurement> = rows
        .iter()
        .map(|row| {
            let (kind, tokens) = match (row.n_prompt, row.n_gen) {
                (prompt, 0) if prompt > 0 => ("prompt-processing".to_string(), prompt),
                (0, generation) if generation > 0 => ("generation".to_string(), generation),
                (prompt, generation) => (
                    format!("mixed pp{prompt}+tg{generation}"),
                    prompt + generation,
                ),
            };
            let (repeatability, relative_range, quality_reason) =
                classify_repeatability(&row.samples_ts);
            BenchmarkMeasurement {
                kind,
                tokens,
                tokens_per_second: row.avg_ts,
                samples: row.samples_ts.clone(),
                repeatability,
                relative_range,
                quality_reason,
            }
        })
        .collect();
    let quality_reasons: Vec<String> = measurements
        .iter()
        .filter(|measurement| measurement.repeatability != "stable")
        .map(|measurement| format!("{}: {}", measurement.kind, measurement.quality_reason))
        .collect();
    let stable = quality_reasons.is_empty();
    Ok(BenchmarkReport {
        engine: "llama.cpp".into(),
        engine_build: format!("b{} ({})", first.build_number, first.build_commit),
        backends: first.backends.clone(),
        gpu_info: first.gpu_info.clone(),
        model_filename: first.model_filename.clone(),
        model_type: first.model_type.clone(),
        kv_cache: format!("K:{} V:{}", first.type_k, first.type_v),
        gpu_layers: first.n_gpu_layers,
        batch_size: first.n_batch,
        ubatch_size: first.n_ubatch,
        threads: first.n_threads,
        context_test_depth_tokens: first.n_depth,
        flash_attention: first.flash_attn,
        mmap: first.use_mmap,
        measurements,
        measurement_quality: if stable { "stable" } else { "conditioned" }.into(),
        quality_reasons,
        preflight: None,
        calibration_eligibility: assess_calibration_eligibility(
            if stable { "stable" } else { "conditioned" },
            None,
            None,
        ),
        provenance: if stable {
            "verified-local"
        } else {
            "conditioned-local"
        },
    })
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BenchmarkRequest {
    pub engine_dir: String,
    pub model_path: String,
    /// Optional; defaults keep total runtime in the low minutes.
    pub prompt_tokens: Option<u64>,
    pub generation_tokens: Option<u64>,
    pub repetitions: Option<u64>,
    #[serde(default)]
    pub accept_adverse_conditions: bool,
}

pub fn run_benchmark(request: &BenchmarkRequest) -> Result<BenchmarkReport, String> {
    let engine_dir = Path::new(&request.engine_dir);
    let model_path = Path::new(&request.model_path);
    if !model_path.is_file() {
        return Err(format!("model file not found: {}", model_path.display()));
    }
    let executable = engine_dir.join(if cfg!(windows) {
        "llama-bench.exe"
    } else {
        BENCH_EXECUTABLE
    });
    if !executable.is_file() {
        return Err(format!(
            "{} not found in {} — point the engine directory at a llama.cpp installation",
            BENCH_EXECUTABLE,
            engine_dir.display()
        ));
    }
    let preflight = crate::preflight::inspect();
    if preflight.requires_confirmation && !request.accept_adverse_conditions {
        return Err(format!(
            "preflight requires explicit confirmation: {}",
            preflight.warnings.join("; ")
        ));
    }
    let mut child = std::process::Command::new(&executable)
        .arg("-m")
        .arg(model_path)
        .args(["-p", &request.prompt_tokens.unwrap_or(512).to_string()])
        .args(["-n", &request.generation_tokens.unwrap_or(128).to_string()])
        .args(["-r", &request.repetitions.unwrap_or(3).to_string()])
        .args(["-o", "json"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .stdin(Stdio::null())
        .spawn()
        .map_err(|error| format!("failed to start {BENCH_EXECUTABLE}: {error}"))?;

    // Watchdog: a hung engine is killed, and the kill is reported as a
    // stability result rather than hidden (decision-tree B5X).
    let started = std::time::Instant::now();
    loop {
        match child.try_wait().map_err(|error| error.to_string())? {
            Some(status) => {
                let mut stdout = String::new();
                use std::io::Read;
                if let Some(mut pipe) = child.stdout.take() {
                    let _ = pipe.read_to_string(&mut stdout);
                }
                if !status.success() {
                    return Err(format!(
                        "{BENCH_EXECUTABLE} exited with {status} — recorded as a stability result for this configuration"
                    ));
                }
                let mut report = parse_bench_output(&stdout)?;
                report.preflight = Some(preflight);
                report.calibration_eligibility = assess_calibration_eligibility(
                    &report.measurement_quality,
                    report.preflight.as_ref(),
                    None,
                );
                return Ok(report);
            }
            None if started.elapsed() > BENCH_TIMEOUT => {
                let _ = child.kill();
                return Err(format!(
                    "{BENCH_EXECUTABLE} exceeded the {}s watchdog and was terminated — recorded as a stability result",
                    BENCH_TIMEOUT.as_secs()
                ));
            }
            None => std::thread::sleep(Duration::from_millis(250)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const REAL_OUTPUT_FIXTURE: &str = r#"[
      {"build_commit":"5d5306bf3","build_number":10061,"cpu_info":"12th Gen Intel(R) Core(TM) i7-12700H","gpu_info":"NVIDIA GeForce RTX 3060 Laptop GPU","backends":"CUDA","model_filename":"H:\\llama\\models\\Qwen3-4B-Instruct-2507-Q4_K_M.gguf","model_type":"qwen3 4B Q4_K - Medium","model_size":2491323904,"model_n_params":4022468096,"n_batch":2048,"n_ubatch":512,"n_threads":14,"n_depth":4096,"flash_attn":-1,"use_mmap":true,"type_k":"f16","type_v":"f16","n_gpu_layers":-1,"n_prompt":128,"n_gen":0,"avg_ts":175.775886,"stddev_ts":0.0,"samples_ts":[175.776]},
      {"build_commit":"5d5306bf3","build_number":10061,"cpu_info":"12th Gen Intel(R) Core(TM) i7-12700H","gpu_info":"NVIDIA GeForce RTX 3060 Laptop GPU","backends":"CUDA","model_filename":"H:\\llama\\models\\Qwen3-4B-Instruct-2507-Q4_K_M.gguf","model_type":"qwen3 4B Q4_K - Medium","model_size":2491323904,"model_n_params":4022468096,"n_batch":2048,"n_ubatch":512,"n_threads":14,"n_depth":4096,"flash_attn":-1,"use_mmap":true,"type_k":"f16","type_v":"f16","n_gpu_layers":-1,"n_prompt":0,"n_gen":64,"avg_ts":4.522548,"stddev_ts":0.0,"samples_ts":[4.52255]}
    ]"#;

    #[test]
    fn parses_real_llama_bench_output() {
        let report = parse_bench_output(REAL_OUTPUT_FIXTURE).expect("parses");
        assert_eq!(report.engine_build, "b10061 (5d5306bf3)");
        assert_eq!(report.backends, "CUDA");
        assert_eq!(report.provenance, "conditioned-local");
        assert_eq!(report.measurement_quality, "conditioned");
        assert_eq!(report.batch_size, 2048);
        assert_eq!(report.ubatch_size, 512);
        assert_eq!(report.context_test_depth_tokens, 4096);
        assert_eq!(report.threads, 14);
        assert_eq!(report.measurements.len(), 2);
        assert_eq!(report.measurements[0].kind, "prompt-processing");
        assert!((report.measurements[0].tokens_per_second - 175.775886).abs() < 1e-9);
        assert_eq!(report.measurements[1].kind, "generation");
    }

    #[test]
    fn rejects_malformed_and_inconsistent_output() {
        assert!(parse_bench_output("not json").is_err());
        assert!(parse_bench_output("[]").is_err());
        let inconsistent = REAL_OUTPUT_FIXTURE.replacen("5d5306bf3", "deadbeef1", 1);
        assert!(parse_bench_output(&inconsistent).is_err());
        let backend_drift =
            REAL_OUTPUT_FIXTURE.replacen(r#""backends":"CUDA""#, r#""backends":"Vulkan""#, 1);
        assert!(parse_bench_output(&backend_drift).is_err());
        let build_drift =
            REAL_OUTPUT_FIXTURE.replacen(r#""build_number":10061"#, r#""build_number":10062"#, 1);
        assert!(parse_bench_output(&build_drift).is_err());
        let invalid_sample = REAL_OUTPUT_FIXTURE.replacen("4.52255", "-4.52255", 1);
        assert!(parse_bench_output(&invalid_sample).is_err());
        let missing_backend =
            REAL_OUTPUT_FIXTURE.replace(r#""backends":"CUDA""#, r#""backends":"""#);
        assert!(parse_bench_output(&missing_backend).is_err());
        let zero_token = REAL_OUTPUT_FIXTURE.replacen(
            r#""n_prompt":128,"n_gen":0"#,
            r#""n_prompt":0,"n_gen":0"#,
            1,
        );
        assert!(parse_bench_output(&zero_token).is_err());
    }

    #[test]
    fn repeatability_controls_verified_status() {
        let stable = REAL_OUTPUT_FIXTURE
            .replace("[175.776]", "[170.0,175.0,180.0]")
            .replace("[4.52255]", "[4.4,4.5,4.6]");
        let report = parse_bench_output(&stable).expect("stable samples parse");
        assert_eq!(report.provenance, "verified-local");
        assert_eq!(report.measurement_quality, "stable");
        assert!(report.quality_reasons.is_empty());

        let variable = stable.replace("[4.4,4.5,4.6]", "[4.0,4.5,8.0]");
        let report = parse_bench_output(&variable).expect("variable samples parse");
        assert_eq!(report.provenance, "conditioned-local");
        assert_eq!(report.measurement_quality, "conditioned");
        assert_eq!(report.measurements[1].repeatability, "variable");
        assert_eq!(report.quality_reasons.len(), 1);
    }

    #[test]
    fn exact_observation_can_be_ineligible_as_a_calibration_baseline() {
        let stable_preflight = crate::preflight::evaluate(crate::preflight::PreflightInputs {
            cpu_load_percent: 5.0,
            available_memory_gb: 24.0,
            total_memory_gb: 32.0,
            ac_power: Some(true),
            thermal_celsius: Some(55.0),
            thermal_unavailable_reason: None,
        });
        let clean = assess_calibration_eligibility("stable", Some(&stable_preflight), Some(true));
        assert!(clean.eligible);

        let unknown_gpu = assess_calibration_eligibility("stable", Some(&stable_preflight), None);
        assert!(!unknown_gpu.eligible);
        assert!(unknown_gpu
            .reasons
            .iter()
            .any(|reason| reason.contains("GPU workload telemetry")));

        let conditioned =
            assess_calibration_eligibility("conditioned", Some(&stable_preflight), Some(true));
        assert!(!conditioned.eligible);
    }

    #[test]
    fn missing_engine_or_model_fails_closed_without_spawning() {
        let request = BenchmarkRequest {
            engine_dir: "Z:/does-not-exist".into(),
            model_path: "Z:/does-not-exist/model.gguf".into(),
            prompt_tokens: None,
            generation_tokens: None,
            repetitions: None,
            accept_adverse_conditions: false,
        };
        let error = run_benchmark(&request).unwrap_err();
        assert!(error.contains("not found"));
    }
}

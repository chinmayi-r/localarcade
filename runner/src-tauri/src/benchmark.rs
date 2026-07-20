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
    pub measurements: Vec<BenchmarkMeasurement>,
    /// `verified-local`: measured on THIS machine with THIS exact engine
    /// build and model file. Never conflated with estimates or priors.
    pub provenance: &'static str,
}

/// Parse `llama-bench -o json` output. Fails closed on anything unexpected.
pub fn parse_bench_output(json: &str) -> Result<BenchmarkReport, String> {
    let rows: Vec<LlamaBenchRow> = serde_json::from_str(json)
        .map_err(|error| format!("llama-bench output was not the expected JSON: {error}"))?;
    let first = rows.first().ok_or("llama-bench returned no test rows")?;
    if rows.iter().any(|row| {
        row.build_commit != first.build_commit || row.model_filename != first.model_filename
    }) {
        return Err("llama-bench rows disagree on engine or model identity".into());
    }
    let measurements = rows
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
            BenchmarkMeasurement {
                kind,
                tokens,
                tokens_per_second: row.avg_ts,
                samples: row.samples_ts.clone(),
            }
        })
        .collect();
    Ok(BenchmarkReport {
        engine: "llama.cpp".into(),
        engine_build: format!("b{} ({})", first.build_number, first.build_commit),
        backends: first.backends.clone(),
        gpu_info: first.gpu_info.clone(),
        model_filename: first.model_filename.clone(),
        model_type: first.model_type.clone(),
        kv_cache: format!("K:{} V:{}", first.type_k, first.type_v),
        gpu_layers: first.n_gpu_layers,
        measurements,
        provenance: "verified-local",
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
    let mut child = std::process::Command::new(&executable)
        .arg("-m")
        .arg(model_path)
        .args(["-p", &request.prompt_tokens.unwrap_or(512).to_string()])
        .args(["-n", &request.generation_tokens.unwrap_or(128).to_string()])
        .args(["-r", &request.repetitions.unwrap_or(2).to_string()])
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
                return parse_bench_output(&stdout);
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
      {"build_commit":"5d5306bf3","build_number":10061,"cpu_info":"12th Gen Intel(R) Core(TM) i7-12700H","gpu_info":"NVIDIA GeForce RTX 3060 Laptop GPU","backends":"CUDA","model_filename":"H:\\llama\\models\\Qwen3-4B-Instruct-2507-Q4_K_M.gguf","model_type":"qwen3 4B Q4_K - Medium","model_size":2491323904,"model_n_params":4022468096,"type_k":"f16","type_v":"f16","n_gpu_layers":-1,"n_prompt":128,"n_gen":0,"avg_ts":175.775886,"stddev_ts":0.0,"samples_ts":[175.776]},
      {"build_commit":"5d5306bf3","build_number":10061,"cpu_info":"12th Gen Intel(R) Core(TM) i7-12700H","gpu_info":"NVIDIA GeForce RTX 3060 Laptop GPU","backends":"CUDA","model_filename":"H:\\llama\\models\\Qwen3-4B-Instruct-2507-Q4_K_M.gguf","model_type":"qwen3 4B Q4_K - Medium","model_size":2491323904,"model_n_params":4022468096,"type_k":"f16","type_v":"f16","n_gpu_layers":-1,"n_prompt":0,"n_gen":64,"avg_ts":4.522548,"stddev_ts":0.0,"samples_ts":[4.52255]}
    ]"#;

    #[test]
    fn parses_real_llama_bench_output() {
        let report = parse_bench_output(REAL_OUTPUT_FIXTURE).expect("parses");
        assert_eq!(report.engine_build, "b10061 (5d5306bf3)");
        assert_eq!(report.backends, "CUDA");
        assert_eq!(report.provenance, "verified-local");
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
    }

    #[test]
    fn missing_engine_or_model_fails_closed_without_spawning() {
        let request = BenchmarkRequest {
            engine_dir: "Z:/does-not-exist".into(),
            model_path: "Z:/does-not-exist/model.gguf".into(),
            prompt_tokens: None,
            generation_tokens: None,
            repetitions: None,
        };
        let error = run_benchmark(&request).unwrap_err();
        assert!(error.contains("not found"));
    }
}

// ⚠ HAND-WRITTEN SECURITY-SENSITIVE CODE — not from a vetted template. Review before trusting.
//! R4 deterministic quick-task checks using the user's existing llama-cli.
//! The prompts are fixed public fixtures. Results are mechanical checks, not
//! a general model-quality score, and nothing is persisted or uploaded.

use serde::{Deserialize, Serialize};
use std::io::Read;
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;

const QUICK_EXECUTABLE: &str = "llama-cli";
const TASK_TIMEOUT: Duration = Duration::from_secs(180);

#[derive(Clone, Copy)]
struct Task {
    id: &'static str,
    label: &'static str,
    prompt: &'static str,
    max_tokens: u64,
}

const TASKS: [Task; 3] = [
    Task {
        id: "json-schema",
        label: "JSON structure",
        prompt: "Return only this data as one JSON object with exactly these keys and value types: project is the string Orchid, count is the number 3, and ready is the boolean true. Do not use markdown.",
        max_tokens: 60,
    },
    Task {
        id: "format-constraints",
        label: "Format constraints",
        prompt: "Return exactly these three lines, in this order, with no bullets, code fence, introduction, or trailing text:\nALPHA=red\nBRAVO=green\nCHARLIE=blue",
        max_tokens: 40,
    },
    Task {
        id: "fact-preservation",
        label: "Fact preservation",
        prompt: "Source facts: Project Cedar launched in 2024. It has 17 contributors. Its license is Apache-2.0. Write one plain-text sentence that preserves all three facts. Do not add facts.",
        max_tokens: 60,
    },
];

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct QuickTaskRequest {
    pub engine_dir: String,
    pub model_path: String,
    #[serde(default)]
    pub accept_adverse_conditions: bool,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct QuickTaskResult {
    pub id: &'static str,
    pub label: &'static str,
    pub passed: bool,
    pub explanation: String,
    pub output: String,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct QuickTaskReport {
    pub engine: &'static str,
    pub engine_build: String,
    pub model_path: String,
    pub settings: &'static str,
    pub results: Vec<QuickTaskResult>,
    pub preflight: crate::preflight::PreflightReport,
    pub claim: &'static str,
}

pub fn run(request: &QuickTaskRequest) -> Result<QuickTaskReport, String> {
    let engine_dir = Path::new(&request.engine_dir);
    let model_path = Path::new(&request.model_path);
    if !model_path.is_file() {
        return Err(format!("model file not found: {}", model_path.display()));
    }
    let executable = engine_dir.join(if cfg!(windows) {
        "llama-cli.exe"
    } else {
        QUICK_EXECUTABLE
    });
    if !executable.is_file() {
        return Err(format!(
            "{QUICK_EXECUTABLE} not found in {} — use a llama.cpp installation containing llama-cli",
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

    let mut results = Vec::new();
    let mut engine_build = None;
    for task in TASKS {
        let output = execute_task(&executable, model_path, task)?;
        let build = parse_build(&output)?;
        if engine_build
            .as_ref()
            .is_some_and(|existing| existing != &build)
        {
            return Err("llama-cli build identity changed during the task suite".into());
        }
        engine_build = Some(build);
        let answer = extract_answer(&output, task.prompt)?;
        let (passed, explanation) = score(task.id, &answer);
        results.push(QuickTaskResult {
            id: task.id,
            label: task.label,
            passed,
            explanation,
            output: answer,
        });
    }
    Ok(QuickTaskReport {
        engine: "llama.cpp/llama-cli",
        engine_build: engine_build.ok_or("task suite returned no engine identity")?,
        model_path: model_path.display().to_string(),
        settings: "temperature=0; seed=1; single-turn; context/offload/batch=reported engine-build defaults",
        results,
        preflight,
        claim: "mechanical-task-checks-only",
    })
}

fn execute_task(executable: &Path, model_path: &Path, task: Task) -> Result<String, String> {
    let mut child = std::process::Command::new(executable)
        .arg("-m")
        .arg(model_path)
        .args(["-p", task.prompt])
        .args(["-n", &task.max_tokens.to_string()])
        .args(["--temp", "0", "--seed", "1"])
        .args([
            "--single-turn",
            "--simple-io",
            "--no-show-timings",
            "--color",
            "off",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .stdin(Stdio::null())
        .spawn()
        .map_err(|error| format!("failed to start {QUICK_EXECUTABLE}: {error}"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| format!("{QUICK_EXECUTABLE} stdout pipe was unavailable"))?;
    // Drain concurrently: llama-cli's startup banner can fill the Windows
    // pipe buffer before the process exits, which would otherwise deadlock.
    let mut reader = Some(std::thread::spawn(move || {
        let mut stdout = stdout;
        let mut text = String::new();
        stdout.read_to_string(&mut text).map(|_| text)
    }));
    let started = std::time::Instant::now();
    loop {
        match child.try_wait().map_err(|error| error.to_string())? {
            Some(status) => {
                let stdout = reader
                    .take()
                    .ok_or_else(|| format!("{QUICK_EXECUTABLE} output reader was unavailable"))?
                    .join()
                    .map_err(|_| format!("{QUICK_EXECUTABLE} output reader failed"))?
                    .map_err(|error| {
                        format!("could not read {QUICK_EXECUTABLE} output: {error}")
                    })?;
                if !status.success() {
                    return Err(format!("{QUICK_EXECUTABLE} exited with {status}"));
                }
                return Ok(stdout);
            }
            None if started.elapsed() > TASK_TIMEOUT => {
                let _ = child.kill();
                let _ = child.wait();
                if let Some(reader) = reader.take() {
                    let _ = reader.join();
                }
                return Err(format!(
                    "{QUICK_EXECUTABLE} exceeded the {}s per-task watchdog",
                    TASK_TIMEOUT.as_secs()
                ));
            }
            None => std::thread::sleep(Duration::from_millis(250)),
        }
    }
}

fn parse_build(output: &str) -> Result<String, String> {
    output
        .lines()
        .find_map(|line| line.trim().strip_prefix("build      : "))
        .map(str::to_string)
        .filter(|build| !build.is_empty())
        .ok_or_else(|| "llama-cli output did not expose its build identity".into())
}

fn extract_answer(output: &str, prompt: &str) -> Result<String, String> {
    let normalized = output.replace("\r\n", "\n");
    let marker = format!("> {prompt}\n");
    let after_prompt = normalized
        .split_once(&marker)
        .map(|(_, tail)| tail)
        .ok_or("llama-cli output did not contain the fixed task prompt marker")?;
    let answer = after_prompt
        .split("\n\nExiting...")
        .next()
        .unwrap_or(after_prompt)
        .trim();
    if answer.is_empty() {
        return Err("llama-cli returned an empty task response".into());
    }
    Ok(answer.to_string())
}

fn score(id: &str, output: &str) -> (bool, String) {
    match id {
        "json-schema" => match serde_json::from_str::<serde_json::Value>(output.trim()) {
            Ok(serde_json::Value::Object(value))
                if value.len() == 3
                    && value.get("project") == Some(&serde_json::json!("Orchid"))
                    && value.get("count") == Some(&serde_json::json!(3))
                    && value.get("ready") == Some(&serde_json::json!(true)) =>
            {
                (
                    true,
                    "Valid JSON with the exact required keys, values, and types.".into(),
                )
            }
            Ok(_) => (
                false,
                "The response parsed, but did not match the required object exactly.".into(),
            ),
            Err(_) => (false, "The response was not valid standalone JSON.".into()),
        },
        "format-constraints" => {
            let passed =
                output.trim().replace("\r\n", "\n") == "ALPHA=red\nBRAVO=green\nCHARLIE=blue";
            (
                passed,
                if passed {
                    "All line and ordering constraints were followed exactly."
                } else {
                    "The response added, removed, reordered, or changed required text."
                }
                .into(),
            )
        }
        "fact-preservation" => {
            let lower = output.to_lowercase();
            let passed = lower.contains("cedar")
                && output.contains("2024")
                && output.contains("17")
                && lower.contains("apache-2.0")
                && !output.contains('\r')
                && !output.contains('\n');
            (
                passed,
                if passed {
                    "All required facts were retained in one line."
                } else {
                    "At least one required fact or the one-line constraint was missing."
                }
                .into(),
            )
        }
        _ => (false, "Unknown task id; failed closed.".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_cli_identity_and_answer_without_promoting_ui_noise() {
        let output = "Loading model...\n\nbuild      : b10061-5d5306bf3\n\n> Return exactly: READY\nREADY\n\nExiting...\n";
        assert_eq!(parse_build(output).unwrap(), "b10061-5d5306bf3");
        assert_eq!(
            extract_answer(output, "Return exactly: READY").unwrap(),
            "READY"
        );
    }

    #[test]
    fn scorers_report_mechanical_outcomes_only() {
        assert!(
            score(
                "json-schema",
                r#"{"project":"Orchid","count":3,"ready":true}"#
            )
            .0
        );
        assert!(!score("json-schema", "```json\n{}\n```").0);
        assert!(score("format-constraints", "ALPHA=red\nBRAVO=green\nCHARLIE=blue").0);
        assert!(!score("fact-preservation", "Cedar launched recently.").0);
        assert!(!score("future-task", "anything").0);
    }
}

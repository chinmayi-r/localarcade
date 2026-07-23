//! Explicit-action identity probe for an existing llama.cpp executable.
//!
//! The probe attests only the selected executable bytes, stable file metadata,
//! and a strictly parsed build identity reported by `<tool> --version`. It does
//! not load a model, observe the backend selected by a model run, grant
//! execution authorization, or claim that child writes/network are sandboxed.

use sha2::{Digest, Sha256};
use std::ffi::OsStr;
use std::fs::File;
#[cfg(windows)]
use std::fs::OpenOptions;
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Component, Path, PathBuf, Prefix};
use std::process::{Command, Stdio};
use std::sync::{mpsc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const MAX_STREAM_BYTES: usize = 16 * 1024;
const WATCHDOG: Duration = Duration::from_secs(2);
const POLL_INTERVAL: Duration = Duration::from_millis(10);
const READER_COMPLETION_GRACE: Duration = Duration::from_millis(250);
const PROBE_PROTOCOL_ID: &str = "llama-cpp-version-v1";
const EXPECTED_ARGUMENT: &str = "--version";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExistingToolKind {
    Benchmark,
    QuickCheck,
}

impl ExistingToolKind {
    fn expected_basename(self) -> &'static str {
        match self {
            Self::Benchmark => {
                if cfg!(windows) {
                    "llama-bench.exe"
                } else {
                    "llama-bench"
                }
            }
            Self::QuickCheck => {
                if cfg!(windows) {
                    "llama-cli.exe"
                } else {
                    "llama-cli"
                }
            }
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExistingToolProbeAction {
    InspectExistingToolIdentityV1,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExistingToolProbeRequest {
    pub action: ExistingToolProbeAction,
    pub kind: ExistingToolKind,
    pub selected_path: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileSnapshot {
    pub regular_file: bool,
    pub size_bytes: u64,
    pub modified_unix_nanos: u128,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VersionProcessOutput {
    pub exit_code: Option<i32>,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
    pub stdout_truncated: bool,
    pub stderr_truncated: bool,
    pub timed_out: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VersionProcessLimits {
    pub max_stdout_bytes: usize,
    pub max_stderr_bytes: usize,
    pub watchdog: Duration,
}

/// Injectable file/process/clock boundary. Unit tests use a deterministic fake;
/// `SystemExistingToolProbeBoundary` is the only real process implementation.
pub trait ExistingToolProbeBoundary {
    type IdentityGuard;

    fn canonicalize(&self, path: &Path) -> Result<PathBuf, String>;
    fn acquire_identity_guard(&self, path: &Path) -> Result<Self::IdentityGuard, String>;
    fn snapshot(&self, guard: &Self::IdentityGuard) -> Result<FileSnapshot, String>;
    fn sha256(&self, guard: &Self::IdentityGuard) -> Result<String, String>;
    fn run_version(
        &self,
        guard: &Self::IdentityGuard,
        arguments: &[&str],
        limits: VersionProcessLimits,
    ) -> Result<VersionProcessOutput, String>;
    fn now_unix_millis(&self) -> Result<u128, String>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExistingToolIdentityReceipt {
    kind: ExistingToolKind,
    canonical_path: PathBuf,
    sha256: String,
    size_bytes: u64,
    modified_unix_nanos: u128,
    observed_product: &'static str,
    observed_engine: &'static str,
    observed_engine_build: String,
    probe_protocol_id: &'static str,
    observed_unix_millis: u128,
    grants_authorization: bool,
    child_write_isolation_enforced: bool,
    child_network_isolation_enforced: bool,
}

impl ExistingToolIdentityReceipt {
    pub fn kind(&self) -> ExistingToolKind {
        self.kind
    }

    pub fn canonical_path(&self) -> &Path {
        &self.canonical_path
    }

    pub fn sha256(&self) -> &str {
        &self.sha256
    }

    pub fn size_bytes(&self) -> u64 {
        self.size_bytes
    }

    pub fn modified_unix_nanos(&self) -> u128 {
        self.modified_unix_nanos
    }

    pub fn observed_product(&self) -> &str {
        self.observed_product
    }

    pub fn observed_engine(&self) -> &str {
        self.observed_engine
    }

    pub fn observed_engine_build(&self) -> &str {
        &self.observed_engine_build
    }

    pub fn probe_protocol_id(&self) -> &str {
        self.probe_protocol_id
    }

    pub fn observed_unix_millis(&self) -> u128 {
        self.observed_unix_millis
    }

    pub fn grants_authorization(&self) -> bool {
        self.grants_authorization
    }

    pub fn child_write_isolation_enforced(&self) -> bool {
        self.child_write_isolation_enforced
    }

    pub fn child_network_isolation_enforced(&self) -> bool {
        self.child_network_isolation_enforced
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExistingToolProbeFailure {
    pub code: &'static str,
    pub detail: String,
}

impl ExistingToolProbeFailure {
    fn new(code: &'static str, detail: impl Into<String>) -> Self {
        Self {
            code,
            detail: detail.into(),
        }
    }
}

pub fn probe_existing_tool(
    request: &ExistingToolProbeRequest,
    boundary: &impl ExistingToolProbeBoundary,
) -> Result<ExistingToolIdentityReceipt, ExistingToolProbeFailure> {
    if request.action != ExistingToolProbeAction::InspectExistingToolIdentityV1 {
        return Err(ExistingToolProbeFailure::new(
            "m-j.tool-probe.action-invalid",
            "the fixed identity-inspection action is required",
        ));
    }
    validate_local_absolute_path(&request.selected_path)?;
    validate_basename(request.kind, &request.selected_path)?;

    let canonical_path = boundary
        .canonicalize(&request.selected_path)
        .map_err(|error| {
            ExistingToolProbeFailure::new("m-j.tool-probe.canonicalize-failed", error)
        })?;
    validate_local_absolute_path(&canonical_path)?;
    validate_basename(request.kind, &canonical_path)?;

    let guard = boundary
        .acquire_identity_guard(&canonical_path)
        .map_err(|error| {
            ExistingToolProbeFailure::new("m-j.tool-probe.identity-guard-failed", error)
        })?;
    let before = boundary
        .snapshot(&guard)
        .map_err(|error| ExistingToolProbeFailure::new("m-j.tool-probe.metadata-failed", error))?;
    if !before.regular_file {
        return Err(ExistingToolProbeFailure::new(
            "m-j.tool-probe.not-regular-file",
            "the canonical selected path is not a regular file",
        ));
    }
    let hash_before = checked_hash(boundary, &guard)?;

    let output = boundary
        .run_version(
            &guard,
            &[EXPECTED_ARGUMENT],
            VersionProcessLimits {
                max_stdout_bytes: MAX_STREAM_BYTES,
                max_stderr_bytes: MAX_STREAM_BYTES,
                watchdog: WATCHDOG,
            },
        )
        .map_err(|error| ExistingToolProbeFailure::new("m-j.tool-probe.spawn-failed", error))?;
    if output.timed_out {
        return Err(ExistingToolProbeFailure::new(
            "m-j.tool-probe.timed-out",
            "the version probe exceeded its watchdog and was killed and waited",
        ));
    }
    if output.stdout_truncated || output.stderr_truncated {
        return Err(ExistingToolProbeFailure::new(
            "m-j.tool-probe.output-too-large",
            "the version probe exceeded the bounded stdout or stderr allowance",
        ));
    }
    if output.exit_code != Some(0) {
        return Err(ExistingToolProbeFailure::new(
            "m-j.tool-probe.nonzero-exit",
            format!("the version probe exited with {:?}", output.exit_code),
        ));
    }
    if !output.stderr.is_empty() {
        return Err(ExistingToolProbeFailure::new(
            "m-j.tool-probe.unexpected-stderr",
            "the version protocol does not permit stderr",
        ));
    }
    let observed_engine_build = parse_llama_cpp_version(&output.stdout)?;

    let after = boundary
        .snapshot(&guard)
        .map_err(|error| ExistingToolProbeFailure::new("m-j.tool-probe.metadata-failed", error))?;
    let hash_after = checked_hash(boundary, &guard)?;
    if before != after || hash_before != hash_after {
        return Err(ExistingToolProbeFailure::new(
            "m-j.tool-probe.identity-drift",
            "the selected executable metadata or bytes changed during inspection",
        ));
    }

    let observed_unix_millis = boundary
        .now_unix_millis()
        .map_err(|error| ExistingToolProbeFailure::new("m-j.tool-probe.clock-failed", error))?;
    Ok(ExistingToolIdentityReceipt {
        kind: request.kind,
        canonical_path,
        sha256: hash_after,
        size_bytes: after.size_bytes,
        modified_unix_nanos: after.modified_unix_nanos,
        observed_product: "llama-cpp",
        observed_engine: "llama.cpp",
        observed_engine_build,
        probe_protocol_id: PROBE_PROTOCOL_ID,
        observed_unix_millis,
        grants_authorization: false,
        child_write_isolation_enforced: false,
        child_network_isolation_enforced: false,
    })
}

fn checked_hash<B: ExistingToolProbeBoundary>(
    boundary: &B,
    guard: &B::IdentityGuard,
) -> Result<String, ExistingToolProbeFailure> {
    let value = boundary
        .sha256(guard)
        .map_err(|error| ExistingToolProbeFailure::new("m-j.tool-probe.hash-failed", error))?;
    if value.len() != 64
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
    {
        return Err(ExistingToolProbeFailure::new(
            "m-j.tool-probe.hash-invalid",
            "the boundary must return a lowercase SHA-256 value",
        ));
    }
    Ok(value)
}

fn validate_basename(kind: ExistingToolKind, path: &Path) -> Result<(), ExistingToolProbeFailure> {
    let actual = path.file_name().and_then(OsStr::to_str).unwrap_or_default();
    let expected = kind.expected_basename();
    let matches = if cfg!(windows) {
        actual.eq_ignore_ascii_case(expected)
    } else {
        actual == expected
    };
    if !matches {
        return Err(ExistingToolProbeFailure::new(
            "m-j.tool-probe.basename-mismatch",
            format!("expected the exact {expected} basename"),
        ));
    }
    Ok(())
}

fn validate_local_absolute_path(path: &Path) -> Result<(), ExistingToolProbeFailure> {
    if !path.is_absolute() {
        return Err(ExistingToolProbeFailure::new(
            "m-j.tool-probe.path-not-absolute",
            "the selected tool path must be absolute",
        ));
    }
    let windows_prefix = path.components().find_map(|component| match component {
        Component::Prefix(prefix) => Some(prefix.kind()),
        _ => None,
    });
    if windows_prefix
        .as_ref()
        .is_some_and(|prefix| !matches!(prefix, Prefix::Disk(_) | Prefix::VerbatimDisk(_)))
    {
        return Err(ExistingToolProbeFailure::new(
            "m-j.tool-probe.network-path-blocked",
            "only local drive and canonical local verbatim-drive paths are permitted",
        ));
    }
    let display = path.as_os_str().to_string_lossy();
    let colon_count = display
        .chars()
        .filter(|character| *character == ':')
        .count();
    let has_local_drive_prefix = path.components().any(|component| {
        matches!(
            component,
            Component::Prefix(prefix)
                if matches!(prefix.kind(), Prefix::Disk(_) | Prefix::VerbatimDisk(_))
        )
    });
    if colon_count > usize::from(has_local_drive_prefix) {
        return Err(ExistingToolProbeFailure::new(
            "m-j.tool-probe.alternate-data-stream-blocked",
            "alternate data stream syntax is not permitted",
        ));
    }
    Ok(())
}

fn parse_llama_cpp_version(bytes: &[u8]) -> Result<String, ExistingToolProbeFailure> {
    let text = std::str::from_utf8(bytes).map_err(|_| {
        ExistingToolProbeFailure::new(
            "m-j.tool-probe.version-invalid-utf8",
            "the version output must be UTF-8",
        )
    })?;
    let normalized = text.replace("\r\n", "\n");
    if normalized.contains('\r') {
        return Err(ExistingToolProbeFailure::new(
            "m-j.tool-probe.version-shape-invalid",
            "the version protocol rejects lone carriage returns",
        ));
    }
    let lines: Vec<&str> = normalized
        .strip_suffix('\n')
        .unwrap_or(&normalized)
        .split('\n')
        .collect();
    if !(lines.len() == 1 || lines.len() == 2) || lines.iter().any(|line| line.is_empty()) {
        return Err(ExistingToolProbeFailure::new(
            "m-j.tool-probe.version-shape-invalid",
            "expected one version line and at most one compiler-target line",
        ));
    }
    let payload = lines[0].strip_prefix("version: ").ok_or_else(|| {
        ExistingToolProbeFailure::new(
            "m-j.tool-probe.version-shape-invalid",
            "the first line must start with `version: `",
        )
    })?;
    let (number, commit_with_paren) = payload.split_once(" (").ok_or_else(|| {
        ExistingToolProbeFailure::new(
            "m-j.tool-probe.version-shape-invalid",
            "the build number and commit must use the recognized llama.cpp format",
        )
    })?;
    let commit = commit_with_paren.strip_suffix(')').ok_or_else(|| {
        ExistingToolProbeFailure::new(
            "m-j.tool-probe.version-shape-invalid",
            "the commit must be enclosed in parentheses",
        )
    })?;
    if number.is_empty()
        || !number.bytes().all(|byte| byte.is_ascii_digit())
        || !(7..=40).contains(&commit.len())
        || !commit
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
    {
        return Err(ExistingToolProbeFailure::new(
            "m-j.tool-probe.version-value-invalid",
            "the version must contain a numeric build and lowercase hexadecimal commit",
        ));
    }
    if let Some(build_line) = lines.get(1) {
        let Some((compiler, target)) = build_line
            .strip_prefix("built with ")
            .and_then(|value| value.split_once(" for "))
        else {
            return Err(ExistingToolProbeFailure::new(
                "m-j.tool-probe.version-shape-invalid",
                "the optional second line must identify compiler and target",
            ));
        };
        if compiler.trim().is_empty() || target.trim().is_empty() {
            return Err(ExistingToolProbeFailure::new(
                "m-j.tool-probe.version-shape-invalid",
                "compiler and target must be nonempty",
            ));
        }
    }
    Ok(format!("b{number} ({commit})"))
}

#[derive(Debug, Default, Clone, Copy)]
pub struct SystemExistingToolProbeBoundary;

#[derive(Debug)]
pub struct SystemExistingToolIdentityGuard {
    path: PathBuf,
    file: Mutex<File>,
}

impl ExistingToolProbeBoundary for SystemExistingToolProbeBoundary {
    type IdentityGuard = SystemExistingToolIdentityGuard;

    fn canonicalize(&self, path: &Path) -> Result<PathBuf, String> {
        std::fs::canonicalize(path).map_err(|error| error.to_string())
    }

    fn acquire_identity_guard(&self, path: &Path) -> Result<Self::IdentityGuard, String> {
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            const FILE_SHARE_READ: u32 = 0x0000_0001;
            let file = OpenOptions::new()
                .read(true)
                .share_mode(FILE_SHARE_READ)
                .open(path)
                .map_err(|error| error.to_string())?;
            Ok(SystemExistingToolIdentityGuard {
                path: path.to_path_buf(),
                file: Mutex::new(file),
            })
        }
        #[cfg(not(windows))]
        {
            let _ = path;
            Err("a strong executable identity guard is not implemented on this platform".into())
        }
    }

    fn snapshot(&self, guard: &Self::IdentityGuard) -> Result<FileSnapshot, String> {
        let file = guard
            .file
            .lock()
            .map_err(|_| "identity guard lock poisoned".to_string())?;
        let metadata = file.metadata().map_err(|error| error.to_string())?;
        let modified_unix_nanos = metadata
            .modified()
            .map_err(|error| error.to_string())?
            .duration_since(UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_nanos();
        Ok(FileSnapshot {
            regular_file: metadata.is_file(),
            size_bytes: metadata.len(),
            modified_unix_nanos,
        })
    }

    fn sha256(&self, guard: &Self::IdentityGuard) -> Result<String, String> {
        let mut file = guard
            .file
            .lock()
            .map_err(|_| "identity guard lock poisoned".to_string())?;
        file.seek(SeekFrom::Start(0))
            .map_err(|error| error.to_string())?;
        let mut digest = Sha256::new();
        let mut buffer = [0u8; 64 * 1024];
        loop {
            let count = file.read(&mut buffer).map_err(|error| error.to_string())?;
            if count == 0 {
                break;
            }
            digest.update(&buffer[..count]);
        }
        Ok(format!("{:x}", digest.finalize()))
    }

    fn run_version(
        &self,
        guard: &Self::IdentityGuard,
        arguments: &[&str],
        limits: VersionProcessLimits,
    ) -> Result<VersionProcessOutput, String> {
        if arguments != [EXPECTED_ARGUMENT] {
            return Err("only the fixed --version action is permitted".into());
        }

        // This is the module's single real spawn site. It never invokes a
        // shell, accepts model arguments, or inherits stdin.
        let mut command = Command::new(&guard.path);
        command
            .args(arguments)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            command.creation_flags(CREATE_NO_WINDOW);
        }
        let mut child = command.spawn().map_err(|error| error.to_string())?;
        let stdout = child.stdout.take().ok_or("stdout pipe unavailable")?;
        let stderr = child.stderr.take().ok_or("stderr pipe unavailable")?;
        let stdout_reader = spawn_bounded_reader(stdout, limits.max_stdout_bytes);
        let stderr_reader = spawn_bounded_reader(stderr, limits.max_stderr_bytes);

        let started = Instant::now();
        let (exit_code, timed_out) = loop {
            match child.try_wait() {
                Err(error) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(error.to_string());
                }
                Ok(Some(status)) => break (status.code(), false),
                Ok(None) if started.elapsed() >= limits.watchdog => {
                    child.kill().map_err(|error| error.to_string())?;
                    let status = child.wait().map_err(|error| error.to_string())?;
                    break (status.code(), true);
                }
                Ok(None) => thread::sleep(POLL_INTERVAL),
            }
        };
        let (stdout, stdout_truncated) = receive_bounded_reader(stdout_reader, "stdout")?;
        let (stderr, stderr_truncated) = receive_bounded_reader(stderr_reader, "stderr")?;
        Ok(VersionProcessOutput {
            exit_code,
            stdout,
            stderr,
            stdout_truncated,
            stderr_truncated,
            timed_out,
        })
    }

    fn now_unix_millis(&self) -> Result<u128, String> {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .map_err(|error| error.to_string())
    }
}

type ReaderResult = Result<(Vec<u8>, bool), String>;

fn spawn_bounded_reader(
    reader: impl Read + Send + 'static,
    limit: usize,
) -> mpsc::Receiver<ReaderResult> {
    let (sender, receiver) = mpsc::sync_channel(1);
    thread::spawn(move || {
        let _ = sender.send(read_bounded(reader, limit));
    });
    receiver
}

fn receive_bounded_reader(receiver: mpsc::Receiver<ReaderResult>, label: &str) -> ReaderResult {
    receiver
        .recv_timeout(READER_COMPLETION_GRACE)
        .map_err(|error| format!("{label} reader did not close after child completion: {error}"))?
}

fn read_bounded(mut reader: impl Read, limit: usize) -> Result<(Vec<u8>, bool), String> {
    let mut output = Vec::with_capacity(limit.min(4096));
    let mut buffer = [0u8; 4096];
    let mut truncated = false;
    loop {
        let count = reader
            .read(&mut buffer)
            .map_err(|error| error.to_string())?;
        if count == 0 {
            break;
        }
        let remaining = limit.saturating_sub(output.len());
        output
            .write_all(&buffer[..count.min(remaining)])
            .map_err(|error| error.to_string())?;
        truncated |= count > remaining;
        if truncated {
            break;
        }
    }
    Ok((output, truncated))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bounded_reader_stops_after_the_first_over_limit_byte() {
        let input = vec![b'x'; 32];
        let (output, truncated) = read_bounded(input.as_slice(), 8).unwrap();
        assert_eq!(output, vec![b'x'; 8]);
        assert!(truncated);
    }

    #[test]
    fn reader_completion_wait_is_bounded_when_a_pipe_never_closes() {
        let (_sender, receiver) = mpsc::sync_channel::<ReaderResult>(1);
        let started = Instant::now();
        assert!(receive_bounded_reader(receiver, "fixture").is_err());
        assert!(started.elapsed() < Duration::from_secs(1));
    }

    #[cfg(windows)]
    #[test]
    fn system_identity_guard_denies_path_write_or_replacement_during_probe() {
        use std::os::windows::fs::OpenOptionsExt;

        const FILE_SHARE_READ: u32 = 0x0000_0001;
        const FILE_SHARE_WRITE: u32 = 0x0000_0002;
        const FILE_SHARE_DELETE: u32 = 0x0000_0004;
        let directory = std::env::temp_dir().join(format!(
            "local-arcade-tool-guard-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&directory).unwrap();
        let path = directory.join("llama-bench.exe");
        std::fs::write(&path, b"fixture").unwrap();

        let boundary = SystemExistingToolProbeBoundary;
        let guard = boundary.acquire_identity_guard(&path).unwrap();
        let replacement_open = OpenOptions::new()
            .write(true)
            .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE)
            .open(&path);
        assert!(
            replacement_open.is_err(),
            "the held identity must deny a writer before path-based execution"
        );

        drop(guard);
        std::fs::remove_file(&path).unwrap();
        std::fs::remove_dir(&directory).unwrap();
    }
}

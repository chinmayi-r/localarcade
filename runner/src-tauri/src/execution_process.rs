//! Bounded process mechanics for the Windows-first existing-engine route.
//!
//! This module is deliberately below IPC and authorization. It accepts only
//! typed llama.cpp invocations, invokes no shell, and owns the child process
//! tree until a terminal result exists. A Windows Job Object supplies
//! kill-on-close and tree termination. That is lifecycle control, not a
//! sandbox: this module does not restrict child network or filesystem access
//! and does not satisfy threat-model T7.
//!
//! Windows children are created suspended, assigned to the Job Object, and
//! only then resumed. The command line is assembled from the sealed typed
//! argument list with the Microsoft C-runtime quoting rules.

use sha2::{Digest, Sha256};
use std::ffi::OsString;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};
use std::thread;
use std::time::{Duration, Instant};

const POLL_INTERVAL: Duration = Duration::from_millis(20);
const READER_COMPLETION_GRACE: Duration = Duration::from_secs(2);
const MAX_WALL_TIME: Duration = Duration::from_secs(600);
const MAX_STREAM_BYTES: usize = 8 * 1024 * 1024;
#[allow(dead_code)] // consumed when the lifecycle assembler wires quick checks
const MAX_PROMPT_BYTES: usize = 64 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExistingEngineProgram {
    LlamaBench,
    LlamaCli,
}

impl ExistingEngineProgram {
    fn windows_basename(self) -> &'static str {
        match self {
            Self::LlamaBench => "llama-bench.exe",
            Self::LlamaCli => "llama-cli.exe",
        }
    }
}

#[allow(dead_code)] // constructed only by the separately integrated lifecycle
#[derive(Debug, Clone, PartialEq, Eq)]
enum Invocation {
    SealedProtocol(Vec<OsString>),
}

/// An internal, typed invocation. There is intentionally no constructor from
/// an argv vector and no way to add arbitrary flags.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExistingEngineProcessSpec {
    program: ExistingEngineProgram,
    executable: PathBuf,
    artifact: PathBuf,
    expected_executable_sha256: String,
    expected_artifact_sha256: String,
    invocation: Invocation,
}

impl ExistingEngineProcessSpec {
    /// Consume only the protocol resolver's typed benchmark invocation. This
    /// is crate-private so an IPC DTO cannot manufacture an argv vector.
    #[allow(dead_code)] // lifecycle integration is owned by the assembler
    pub(crate) fn from_benchmark_protocol(
        executable: PathBuf,
        artifact: PathBuf,
        expected_executable_sha256: String,
        expected_artifact_sha256: String,
        protocol: &crate::execution_protocol::BenchmarkExecutionSpec,
        invocation: &crate::execution_protocol::BenchmarkInvocationSpec,
    ) -> Result<Self, ProcessBoundaryError> {
        crate::execution_protocol::validate_resolved_benchmark_invocation(protocol, invocation)
            .map_err(ProcessBoundaryError::InvalidSpec)?;
        validate_benchmark_protocol_argv(&artifact, &invocation.argv)?;
        let value = Self {
            program: ExistingEngineProgram::LlamaBench,
            executable,
            artifact,
            expected_executable_sha256,
            expected_artifact_sha256,
            invocation: Invocation::SealedProtocol(
                invocation.argv.iter().map(OsString::from).collect(),
            ),
        };
        value.validate_shape()?;
        Ok(value)
    }

    /// Consume only the protocol resolver's typed fixed quick-check
    /// invocation; no caller-authored prompt or flag list crosses this seam.
    #[allow(dead_code)] // lifecycle integration is owned by the assembler
    pub(crate) fn from_quick_check_protocol(
        executable: PathBuf,
        artifact: PathBuf,
        expected_executable_sha256: String,
        expected_artifact_sha256: String,
        protocol: &crate::execution_protocol::QuickCheckExecutionSpec,
        invocation: &crate::execution_protocol::QuickCheckInvocationSpec,
    ) -> Result<Self, ProcessBoundaryError> {
        crate::execution_protocol::validate_resolved_quick_check_invocation(protocol, invocation)
            .map_err(ProcessBoundaryError::InvalidSpec)?;
        validate_quick_check_protocol_argv(&artifact, &invocation.argv)?;
        let value = Self {
            program: ExistingEngineProgram::LlamaCli,
            executable,
            artifact,
            expected_executable_sha256,
            expected_artifact_sha256,
            invocation: Invocation::SealedProtocol(
                invocation.argv.iter().map(OsString::from).collect(),
            ),
        };
        value.validate_shape()?;
        Ok(value)
    }

    pub fn executable(&self) -> &Path {
        &self.executable
    }

    pub fn artifact(&self) -> &Path {
        &self.artifact
    }

    fn validate_shape(&self) -> Result<(), ProcessBoundaryError> {
        validate_exact_local_path(&self.executable, "executable")?;
        validate_exact_local_path(&self.artifact, "artifact")?;
        validate_sha256(&self.expected_executable_sha256)?;
        validate_sha256(&self.expected_artifact_sha256)?;
        let basename = self
            .executable
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default();
        if !basename.eq_ignore_ascii_case(self.program.windows_basename()) {
            return Err(ProcessBoundaryError::InvalidSpec(format!(
                "expected exact {} executable basename",
                self.program.windows_basename()
            )));
        }
        Ok(())
    }

    fn arguments(&self) -> Vec<OsString> {
        match &self.invocation {
            Invocation::SealedProtocol(arguments) => arguments.clone(),
        }
    }
}

fn validate_sha256(value: &str) -> Result<(), ProcessBoundaryError> {
    if value.len() != 64
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
    {
        return Err(ProcessBoundaryError::InvalidSpec(
            "lowercase SHA-256 identity is required".into(),
        ));
    }
    Ok(())
}

#[allow(dead_code)] // reached through the lifecycle-owned constructor above
fn validate_benchmark_protocol_argv(
    artifact: &Path,
    argv: &[String],
) -> Result<(), ProcessBoundaryError> {
    const FLAGS: [&str; 14] = [
        "-m", "-p", "-n", "-d", "-b", "-ub", "-ctk", "-ctv", "-t", "-ngl", "-fa", "-mmp", "-r",
        "-o",
    ];
    if argv.len() != 28 {
        return Err(ProcessBoundaryError::InvalidSpec(
            "benchmark protocol argv shape is invalid".into(),
        ));
    }
    let actual_flags: Vec<&str> = argv.chunks_exact(2).map(|pair| pair[0].as_str()).collect();
    if actual_flags != FLAGS
        || argv[1] != artifact.to_string_lossy()
        || argv[25] != "1"
        || argv[27] != "json"
    {
        return Err(ProcessBoundaryError::InvalidSpec(
            "benchmark protocol argv is not the fixed supported shape".into(),
        ));
    }
    for index in [3usize, 5, 7, 9, 11, 17, 19, 21, 23, 25] {
        if argv[index].parse::<u64>().is_err() {
            return Err(ProcessBoundaryError::InvalidSpec(
                "benchmark protocol numeric value is invalid".into(),
            ));
        }
    }
    if !matches!(argv[13].as_str(), "f16" | "q8_0" | "q4_0")
        || !matches!(argv[15].as_str(), "f16" | "q8_0" | "q4_0")
    {
        return Err(ProcessBoundaryError::InvalidSpec(
            "benchmark cache type is unsupported".into(),
        ));
    }
    Ok(())
}

#[allow(dead_code)] // reached through the lifecycle-owned constructor above
fn validate_quick_check_protocol_argv(
    artifact: &Path,
    argv: &[String],
) -> Result<(), ProcessBoundaryError> {
    let expected_prefix = [
        "-m",
        "-p",
        "-n",
        "-c",
        "-ctk",
        "-ctv",
        "-ngl",
        "-b",
        "-ub",
        "-t",
        "--flash-attn",
    ];
    if argv.len() != 40
        || argv[1] != artifact.to_string_lossy()
        || argv[0..22]
            .chunks_exact(2)
            .map(|pair| pair[0].as_str())
            .ne(expected_prefix)
        || !matches!(argv[22].as_str(), "--mmap" | "--no-mmap")
        || argv[23..]
            != [
                "--chat-template",
                "chatml",
                "--temp",
                argv[26].as_str(),
                "--top-p",
                argv[28].as_str(),
                "--top-k",
                argv[30].as_str(),
                "--min-p",
                argv[32].as_str(),
                "--seed",
                argv[34].as_str(),
                "--single-turn",
                "--simple-io",
                "--no-show-timings",
                "--color",
                "off",
            ]
    {
        return Err(ProcessBoundaryError::InvalidSpec(
            "quick-check protocol argv is not the fixed supported shape".into(),
        ));
    }
    let valid_sampler = argv[26]
        .parse::<f64>()
        .is_ok_and(|value| value.is_finite() && value >= 0.0)
        && argv[28]
            .parse::<f64>()
            .is_ok_and(|value| value.is_finite() && (0.0..=1.0).contains(&value))
        && argv[30].parse::<u64>().is_ok()
        && argv[32]
            .parse::<f64>()
            .is_ok_and(|value| value.is_finite() && (0.0..=1.0).contains(&value))
        && argv[34].parse::<i64>().is_ok();
    if !valid_sampler {
        return Err(ProcessBoundaryError::InvalidSpec(
            "quick-check sampler is invalid".into(),
        ));
    }
    if argv[3].len() > MAX_PROMPT_BYTES {
        return Err(ProcessBoundaryError::InvalidSpec(
            "quick-check prompt exceeds the process boundary".into(),
        ));
    }
    Ok(())
}

fn validate_exact_local_path(path: &Path, label: &str) -> Result<(), ProcessBoundaryError> {
    if !path.is_absolute() {
        return Err(ProcessBoundaryError::InvalidSpec(format!(
            "{label} path must be absolute"
        )));
    }
    let text = path.as_os_str().to_string_lossy().replace('/', "\\");
    let without_verbatim = text.strip_prefix(r"\\?\").unwrap_or(&text);
    if without_verbatim.starts_with('\\') || text.contains("://") {
        return Err(ProcessBoundaryError::InvalidSpec(format!(
            "{label} path must be local"
        )));
    }
    #[cfg(windows)]
    {
        let bytes = without_verbatim.as_bytes();
        if bytes.len() < 3
            || !bytes[0].is_ascii_alphabetic()
            || bytes[1] != b':'
            || bytes[2] != b'\\'
            || without_verbatim[2..].contains(':')
        {
            return Err(ProcessBoundaryError::InvalidSpec(format!(
                "{label} path must be an absolute local drive path without an alternate data stream"
            )));
        }
    }
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProcessLimits {
    wall_time: Duration,
    stdout_bytes: usize,
    stderr_bytes: usize,
}

impl ProcessLimits {
    pub fn new(
        wall_time: Duration,
        stdout_bytes: usize,
        stderr_bytes: usize,
    ) -> Result<Self, ProcessBoundaryError> {
        if wall_time.is_zero()
            || wall_time > MAX_WALL_TIME
            || stdout_bytes == 0
            || stdout_bytes > MAX_STREAM_BYTES
            || stderr_bytes == 0
            || stderr_bytes > MAX_STREAM_BYTES
        {
            return Err(ProcessBoundaryError::InvalidLimits);
        }
        Ok(Self {
            wall_time,
            stdout_bytes,
            stderr_bytes,
        })
    }
}

#[derive(Debug, Clone, Default)]
pub struct ExecutionCancellation {
    requested: Arc<AtomicBool>,
}

impl ExecutionCancellation {
    pub fn request(&self) {
        self.requested.store(true, Ordering::Release);
    }

    pub fn is_requested(&self) -> bool {
        self.requested.load(Ordering::Acquire)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProcessTermination {
    Completed,
    NonZeroExit,
    Cancelled,
    TimedOut,
    OutputLimitExceeded,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExistingEngineProcessOutput {
    pub termination: ProcessTermination,
    pub exit_code: Option<i32>,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
    pub elapsed: Duration,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProcessBoundaryError {
    InvalidSpec(String),
    InvalidLimits,
    UnsupportedPlatform,
    ExecutableUnavailable,
    ArtifactUnavailable,
    PathNotCanonical(&'static str),
    HashMismatch(&'static str),
    SpawnFailed(String),
    ProcessControlFailed(String),
    PipeUnavailable(&'static str),
    PipeReaderFailed(String),
}

pub fn run_existing_engine_process(
    spec: &ExistingEngineProcessSpec,
    limits: ProcessLimits,
    cancellation: &ExecutionCancellation,
) -> Result<ExistingEngineProcessOutput, ProcessBoundaryError> {
    #[cfg(not(windows))]
    {
        let _ = (spec, limits, cancellation);
        return Err(ProcessBoundaryError::UnsupportedPlatform);
    }
    #[cfg(windows)]
    {
        spec.validate_shape()?;
        validate_canonical_file(&spec.executable, "executable")?;
        validate_canonical_file(&spec.artifact, "artifact")?;
        let mut executable_guard = WindowsReadIdentityGuard::acquire(&spec.executable)?;
        let mut artifact_guard = WindowsReadIdentityGuard::acquire(&spec.artifact)?;
        executable_guard.require_hash(&spec.expected_executable_sha256, "executable")?;
        artifact_guard.require_hash(&spec.expected_artifact_sha256, "artifact")?;

        let output = run_native_process(&spec.executable, &spec.arguments(), limits, cancellation)?;
        // Retain both guards across the complete child lifetime. Rehashing
        // also catches a writer which was opened before the guard.
        executable_guard.require_hash(&spec.expected_executable_sha256, "executable")?;
        artifact_guard.require_hash(&spec.expected_artifact_sha256, "artifact")?;
        Ok(output)
    }
}

#[cfg(windows)]
fn validate_canonical_file(path: &Path, label: &'static str) -> Result<(), ProcessBoundaryError> {
    if !path.is_file() {
        return Err(if label == "executable" {
            ProcessBoundaryError::ExecutableUnavailable
        } else {
            ProcessBoundaryError::ArtifactUnavailable
        });
    }
    let canonical = std::fs::canonicalize(path).map_err(|error| {
        ProcessBoundaryError::ProcessControlFailed(format!(
            "could not canonicalize {label}: {error}"
        ))
    })?;
    if canonical != path {
        return Err(ProcessBoundaryError::PathNotCanonical(label));
    }
    Ok(())
}

#[cfg(windows)]
struct WindowsReadIdentityGuard {
    file: std::fs::File,
}

#[cfg(windows)]
impl WindowsReadIdentityGuard {
    fn acquire(path: &Path) -> Result<Self, ProcessBoundaryError> {
        use std::os::windows::fs::OpenOptionsExt;
        const FILE_SHARE_READ: u32 = 0x0000_0001;
        let file = std::fs::OpenOptions::new()
            .read(true)
            .share_mode(FILE_SHARE_READ)
            .open(path)
            .map_err(|error| {
                ProcessBoundaryError::ProcessControlFailed(format!(
                    "could not acquire identity guard for {}: {error}",
                    path.display()
                ))
            })?;
        if !file
            .metadata()
            .map_err(|error| ProcessBoundaryError::ProcessControlFailed(error.to_string()))?
            .is_file()
        {
            return Err(ProcessBoundaryError::ProcessControlFailed(
                "identity guard did not resolve a regular file".into(),
            ));
        }
        Ok(Self { file })
    }

    fn require_hash(
        &mut self,
        expected: &str,
        label: &'static str,
    ) -> Result<(), ProcessBoundaryError> {
        self.file
            .seek(SeekFrom::Start(0))
            .map_err(|error| ProcessBoundaryError::ProcessControlFailed(error.to_string()))?;
        let mut digest = Sha256::new();
        let mut buffer = [0u8; 64 * 1024];
        loop {
            let count = self
                .file
                .read(&mut buffer)
                .map_err(|error| ProcessBoundaryError::ProcessControlFailed(error.to_string()))?;
            if count == 0 {
                break;
            }
            digest.update(&buffer[..count]);
        }
        if format!("{:x}", digest.finalize()) != expected {
            return Err(ProcessBoundaryError::HashMismatch(label));
        }
        Ok(())
    }
}

#[cfg(windows)]
fn run_native_process(
    executable: &Path,
    arguments: &[OsString],
    limits: ProcessLimits,
    cancellation: &ExecutionCancellation,
) -> Result<ExistingEngineProcessOutput, ProcessBoundaryError> {
    let job = WindowsKillOnCloseJob::new()?;
    let (child, stdout, stderr) = NativeSuspendedChild::launch(executable, arguments)?;
    if let Err(error) = job.assign_handle(child.process_handle()) {
        // The child is not in our Job when assignment fails, so terminate its
        // still-suspended process handle directly before returning.
        let _ = child.terminate_direct();
        let _ = child.wait_for_exit(Duration::from_secs(5));
        return Err(error);
    }
    if let Err(error) = child.resume() {
        let _ = job.terminate();
        let _ = child.wait_for_exit(Duration::from_secs(5));
        return Err(error);
    }
    let output_exceeded = Arc::new(AtomicBool::new(false));
    let stdout_reader =
        spawn_bounded_reader(stdout, limits.stdout_bytes, Arc::clone(&output_exceeded));
    let stderr_reader =
        spawn_bounded_reader(stderr, limits.stderr_bytes, Arc::clone(&output_exceeded));

    let started = Instant::now();
    let (mut termination, exit_code) = loop {
        if cancellation.is_requested() {
            terminate_native_and_wait(&job, &child)?;
            break (ProcessTermination::Cancelled, None);
        }
        if output_exceeded.load(Ordering::Acquire) {
            terminate_native_and_wait(&job, &child)?;
            break (ProcessTermination::OutputLimitExceeded, None);
        }
        if started.elapsed() >= limits.wall_time {
            terminate_native_and_wait(&job, &child)?;
            break (ProcessTermination::TimedOut, None);
        }
        match child.exit_code_if_finished()? {
            Some(code) => {
                // Kill any descendants which inherited a pipe or outlived the
                // selected root process before waiting for reader completion.
                job.terminate()?;
                break (
                    if code == 0 {
                        ProcessTermination::Completed
                    } else {
                        ProcessTermination::NonZeroExit
                    },
                    Some(code as i32),
                );
            }
            None => thread::sleep(POLL_INTERVAL),
        }
    };

    let stdout = receive_reader(stdout_reader, "stdout")?;
    let stderr = receive_reader(stderr_reader, "stderr")?;
    if output_exceeded.load(Ordering::Acquire) {
        termination = ProcessTermination::OutputLimitExceeded;
    }
    Ok(ExistingEngineProcessOutput {
        termination,
        exit_code,
        stdout,
        stderr,
        elapsed: started.elapsed(),
    })
}

#[cfg(windows)]
fn terminate_native_and_wait(
    job: &WindowsKillOnCloseJob,
    child: &NativeSuspendedChild,
) -> Result<(), ProcessBoundaryError> {
    job.terminate()?;
    child.wait_for_exit(Duration::from_secs(5))
}

#[cfg(windows)]
fn windows_command_line(
    executable: &Path,
    arguments: &[OsString],
) -> Result<Vec<u16>, ProcessBoundaryError> {
    use std::os::windows::ffi::OsStrExt;
    let mut command_line = Vec::new();
    for (index, argument) in std::iter::once(executable.as_os_str())
        .chain(arguments.iter().map(OsString::as_os_str))
        .enumerate()
    {
        if index != 0 {
            command_line.push(b' ' as u16);
        }
        append_windows_quoted_argument(argument.encode_wide(), &mut command_line)?;
    }
    // CreateProcessW's documented command-line maximum includes the NUL.
    if command_line.len() >= 32_767 {
        return Err(ProcessBoundaryError::InvalidSpec(
            "native Windows command line exceeds 32767 UTF-16 code units".into(),
        ));
    }
    command_line.push(0);
    Ok(command_line)
}

#[cfg(windows)]
fn append_windows_quoted_argument(
    units: impl Iterator<Item = u16>,
    output: &mut Vec<u16>,
) -> Result<(), ProcessBoundaryError> {
    const BACKSLASH: u16 = b'\\' as u16;
    const QUOTE: u16 = b'"' as u16;
    output.push(QUOTE);
    let mut pending_backslashes = 0usize;
    for unit in units {
        if unit == 0 {
            return Err(ProcessBoundaryError::InvalidSpec(
                "Windows arguments cannot contain NUL".into(),
            ));
        }
        if unit == BACKSLASH {
            pending_backslashes += 1;
        } else if unit == QUOTE {
            output.extend(std::iter::repeat_n(BACKSLASH, pending_backslashes * 2 + 1));
            output.push(QUOTE);
            pending_backslashes = 0;
        } else {
            output.extend(std::iter::repeat_n(BACKSLASH, pending_backslashes));
            pending_backslashes = 0;
            output.push(unit);
        }
    }
    // Backslashes immediately before the closing quote must be doubled.
    output.extend(std::iter::repeat_n(BACKSLASH, pending_backslashes * 2));
    output.push(QUOTE);
    Ok(())
}

#[cfg(windows)]
struct OwnedWindowsHandle(windows::Win32::Foundation::HANDLE);

#[cfg(windows)]
impl OwnedWindowsHandle {
    fn into_file(self) -> std::fs::File {
        use std::os::windows::io::FromRawHandle;
        let value = std::mem::ManuallyDrop::new(self);
        unsafe { std::fs::File::from_raw_handle(value.0 .0) }
    }
}

#[cfg(windows)]
impl Drop for OwnedWindowsHandle {
    fn drop(&mut self) {
        unsafe {
            let _ = windows::Win32::Foundation::CloseHandle(self.0);
        }
    }
}

#[cfg(windows)]
struct NativeSuspendedChild {
    process: OwnedWindowsHandle,
    thread: OwnedWindowsHandle,
}

#[cfg(windows)]
struct ProcessThreadAttributeList {
    list: windows::Win32::System::Threading::LPPROC_THREAD_ATTRIBUTE_LIST,
    _storage: Vec<usize>,
}

#[cfg(windows)]
impl ProcessThreadAttributeList {
    fn standard_streams_only(
        handles: &[windows::Win32::Foundation::HANDLE; 3],
    ) -> Result<Self, ProcessBoundaryError> {
        use windows::Win32::System::Threading::{
            InitializeProcThreadAttributeList, UpdateProcThreadAttribute,
            LPPROC_THREAD_ATTRIBUTE_LIST, PROC_THREAD_ATTRIBUTE_HANDLE_LIST,
        };
        let mut bytes = 0usize;
        let _ = unsafe {
            InitializeProcThreadAttributeList(
                LPPROC_THREAD_ATTRIBUTE_LIST::default(),
                1,
                0,
                &mut bytes,
            )
        };
        if bytes == 0 {
            return Err(ProcessBoundaryError::SpawnFailed(
                "Windows did not report an attribute-list size".into(),
            ));
        }
        let words = bytes.div_ceil(std::mem::size_of::<usize>());
        let mut storage = vec![0usize; words];
        let list = LPPROC_THREAD_ATTRIBUTE_LIST(storage.as_mut_ptr().cast());
        unsafe { InitializeProcThreadAttributeList(list, 1, 0, &mut bytes) }
            .map_err(|error| ProcessBoundaryError::SpawnFailed(error.to_string()))?;
        if let Err(error) = unsafe {
            UpdateProcThreadAttribute(
                list,
                0,
                PROC_THREAD_ATTRIBUTE_HANDLE_LIST as usize,
                Some(handles.as_ptr().cast()),
                std::mem::size_of_val(handles),
                None,
                None,
            )
        } {
            unsafe {
                windows::Win32::System::Threading::DeleteProcThreadAttributeList(list);
            }
            return Err(ProcessBoundaryError::SpawnFailed(error.to_string()));
        }
        Ok(Self {
            list,
            _storage: storage,
        })
    }
}

#[cfg(windows)]
impl Drop for ProcessThreadAttributeList {
    fn drop(&mut self) {
        unsafe {
            windows::Win32::System::Threading::DeleteProcThreadAttributeList(self.list);
        }
    }
}

#[cfg(windows)]
impl NativeSuspendedChild {
    fn launch(
        executable: &Path,
        arguments: &[OsString],
    ) -> Result<(Self, std::fs::File, std::fs::File), ProcessBoundaryError> {
        use std::os::windows::ffi::OsStrExt;
        use windows::core::{PCWSTR, PWSTR};
        use windows::Win32::Foundation::{SetHandleInformation, BOOL, HANDLE, HANDLE_FLAG_INHERIT};
        use windows::Win32::Security::SECURITY_ATTRIBUTES;
        use windows::Win32::Storage::FileSystem::{
            CreateFileW, FILE_ATTRIBUTE_NORMAL, FILE_GENERIC_READ, FILE_SHARE_READ,
            FILE_SHARE_WRITE, OPEN_EXISTING,
        };
        use windows::Win32::System::Pipes::CreatePipe;
        use windows::Win32::System::Threading::{
            CreateProcessW, CREATE_NO_WINDOW, CREATE_SUSPENDED, EXTENDED_STARTUPINFO_PRESENT,
            PROCESS_CREATION_FLAGS, PROCESS_INFORMATION, STARTF_USESTDHANDLES, STARTUPINFOEXW,
            STARTUPINFOW,
        };

        let security = SECURITY_ATTRIBUTES {
            nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: std::ptr::null_mut(),
            bInheritHandle: BOOL(1),
        };
        let make_pipe =
            || -> Result<(OwnedWindowsHandle, OwnedWindowsHandle), ProcessBoundaryError> {
                let mut read = HANDLE::default();
                let mut write = HANDLE::default();
                unsafe { CreatePipe(&mut read, &mut write, Some(&raw const security), 0) }
                    .map_err(|error| ProcessBoundaryError::SpawnFailed(error.to_string()))?;
                let read = OwnedWindowsHandle(read);
                let write = OwnedWindowsHandle(write);
                unsafe { SetHandleInformation(read.0, HANDLE_FLAG_INHERIT.0, Default::default()) }
                    .map_err(|error| ProcessBoundaryError::SpawnFailed(error.to_string()))?;
                Ok((read, write))
            };
        let (stdout_read, stdout_write) = make_pipe()?;
        let (stderr_read, stderr_write) = make_pipe()?;

        let nul_name: Vec<u16> = "NUL\0".encode_utf16().collect();
        let stdin = unsafe {
            CreateFileW(
                PCWSTR(nul_name.as_ptr()),
                FILE_GENERIC_READ.0,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                Some(&raw const security),
                OPEN_EXISTING,
                FILE_ATTRIBUTE_NORMAL,
                HANDLE::default(),
            )
        }
        .map(OwnedWindowsHandle)
        .map_err(|error| ProcessBoundaryError::SpawnFailed(error.to_string()))?;

        let startup_info = STARTUPINFOW {
            cb: std::mem::size_of::<STARTUPINFOEXW>() as u32,
            dwFlags: STARTF_USESTDHANDLES,
            hStdInput: stdin.0,
            hStdOutput: stdout_write.0,
            hStdError: stderr_write.0,
            ..Default::default()
        };
        let inherited_handles = [stdin.0, stdout_write.0, stderr_write.0];
        let attributes = ProcessThreadAttributeList::standard_streams_only(&inherited_handles)?;
        let startup = STARTUPINFOEXW {
            StartupInfo: startup_info,
            lpAttributeList: attributes.list,
        };
        let mut information = PROCESS_INFORMATION::default();
        let mut application: Vec<u16> = executable.as_os_str().encode_wide().collect();
        if application.contains(&0) {
            return Err(ProcessBoundaryError::InvalidSpec(
                "Windows executable path cannot contain NUL".into(),
            ));
        }
        application.push(0);
        let mut command_line = windows_command_line(executable, arguments)?;
        let creation_flags = PROCESS_CREATION_FLAGS(
            CREATE_SUSPENDED.0 | CREATE_NO_WINDOW.0 | EXTENDED_STARTUPINFO_PRESENT.0,
        );
        unsafe {
            CreateProcessW(
                PCWSTR(application.as_ptr()),
                PWSTR(command_line.as_mut_ptr()),
                None,
                None,
                true,
                creation_flags,
                None,
                PCWSTR::null(),
                (&raw const startup).cast(),
                &raw mut information,
            )
        }
        .map_err(|error| ProcessBoundaryError::SpawnFailed(error.to_string()))?;

        // Parent copies of the inheritable write ends and stdin close here.
        drop(stdout_write);
        drop(stderr_write);
        drop(stdin);
        let child = Self {
            process: OwnedWindowsHandle(information.hProcess),
            thread: OwnedWindowsHandle(information.hThread),
        };
        Ok((child, stdout_read.into_file(), stderr_read.into_file()))
    }

    fn process_handle(&self) -> windows::Win32::Foundation::HANDLE {
        self.process.0
    }

    fn resume(&self) -> Result<(), ProcessBoundaryError> {
        let previous = unsafe { windows::Win32::System::Threading::ResumeThread(self.thread.0) };
        if previous == u32::MAX {
            return Err(ProcessBoundaryError::ProcessControlFailed(
                windows::core::Error::from_win32().to_string(),
            ));
        }
        Ok(())
    }

    fn terminate_direct(&self) -> Result<(), ProcessBoundaryError> {
        unsafe {
            windows::Win32::System::Threading::TerminateProcess(self.process.0, 1)
                .map_err(|error| ProcessBoundaryError::ProcessControlFailed(error.to_string()))
        }
    }

    fn exit_code_if_finished(&self) -> Result<Option<u32>, ProcessBoundaryError> {
        use windows::Win32::Foundation::{WAIT_OBJECT_0, WAIT_TIMEOUT};
        use windows::Win32::System::Threading::{GetExitCodeProcess, WaitForSingleObject};
        match unsafe { WaitForSingleObject(self.process.0, 0) } {
            WAIT_TIMEOUT => Ok(None),
            WAIT_OBJECT_0 => {
                let mut code = 0u32;
                unsafe { GetExitCodeProcess(self.process.0, &mut code) }.map_err(|error| {
                    ProcessBoundaryError::ProcessControlFailed(error.to_string())
                })?;
                Ok(Some(code))
            }
            value => Err(ProcessBoundaryError::ProcessControlFailed(format!(
                "unexpected process wait result: {}",
                value.0
            ))),
        }
    }

    fn wait_for_exit(&self, timeout: Duration) -> Result<(), ProcessBoundaryError> {
        use windows::Win32::Foundation::WAIT_OBJECT_0;
        use windows::Win32::System::Threading::WaitForSingleObject;
        let milliseconds = timeout.as_millis().min(u32::MAX as u128) as u32;
        if unsafe { WaitForSingleObject(self.process.0, milliseconds) } == WAIT_OBJECT_0 {
            Ok(())
        } else {
            Err(ProcessBoundaryError::ProcessControlFailed(
                "child did not exit within the bounded termination wait".into(),
            ))
        }
    }
}

type ReaderReceiver = mpsc::Receiver<Result<Vec<u8>, String>>;

fn spawn_bounded_reader(
    mut reader: impl Read + Send + 'static,
    limit: usize,
    exceeded: Arc<AtomicBool>,
) -> ReaderReceiver {
    let (sender, receiver) = mpsc::sync_channel(1);
    thread::spawn(move || {
        let mut retained = Vec::with_capacity(limit.min(4096));
        let mut buffer = [0u8; 4096];
        let result = loop {
            match reader.read(&mut buffer) {
                Ok(0) => break Ok(retained),
                Ok(count) => {
                    let remaining = limit.saturating_sub(retained.len());
                    retained.extend_from_slice(&buffer[..count.min(remaining)]);
                    if count > remaining {
                        exceeded.store(true, Ordering::Release);
                    }
                    // Continue draining after the limit so a full child pipe
                    // cannot hide the overflow from the controller.
                }
                Err(error) => break Err(error.to_string()),
            }
        };
        let _ = sender.send(result);
    });
    receiver
}

fn receive_reader(receiver: ReaderReceiver, label: &str) -> Result<Vec<u8>, ProcessBoundaryError> {
    receiver
        .recv_timeout(READER_COMPLETION_GRACE)
        .map_err(|error| {
            ProcessBoundaryError::PipeReaderFailed(format!(
                "{label} reader did not finish after process-tree termination: {error}"
            ))
        })?
        .map_err(|error| ProcessBoundaryError::PipeReaderFailed(format!("{label}: {error}")))
}

#[cfg(windows)]
struct WindowsKillOnCloseJob {
    handle: windows::Win32::Foundation::HANDLE,
}

#[cfg(windows)]
impl WindowsKillOnCloseJob {
    fn new() -> Result<Self, ProcessBoundaryError> {
        use windows::core::PCWSTR;
        use windows::Win32::System::JobObjects::{
            CreateJobObjectW, JobObjectExtendedLimitInformation, SetInformationJobObject,
            JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        };

        let handle = unsafe { CreateJobObjectW(None, PCWSTR::null()) }
            .map_err(|error| ProcessBoundaryError::ProcessControlFailed(error.to_string()))?;
        let mut information = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        information.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        let configured = unsafe {
            SetInformationJobObject(
                handle,
                JobObjectExtendedLimitInformation,
                (&raw const information).cast(),
                std::mem::size_of_val(&information) as u32,
            )
        };
        if let Err(error) = configured {
            unsafe {
                let _ = windows::Win32::Foundation::CloseHandle(handle);
            }
            return Err(ProcessBoundaryError::ProcessControlFailed(
                error.to_string(),
            ));
        }
        Ok(Self { handle })
    }

    fn assign_handle(
        &self,
        process: windows::Win32::Foundation::HANDLE,
    ) -> Result<(), ProcessBoundaryError> {
        use windows::Win32::System::JobObjects::AssignProcessToJobObject;

        unsafe { AssignProcessToJobObject(self.handle, process) }
            .map_err(|error| ProcessBoundaryError::ProcessControlFailed(error.to_string()))
    }

    fn terminate(&self) -> Result<(), ProcessBoundaryError> {
        unsafe {
            windows::Win32::System::JobObjects::TerminateJobObject(self.handle, 1)
                .map_err(|error| ProcessBoundaryError::ProcessControlFailed(error.to_string()))
        }
    }
}

#[cfg(windows)]
impl Drop for WindowsKillOnCloseJob {
    fn drop(&mut self) {
        unsafe {
            let _ = windows::Win32::Foundation::CloseHandle(self.handle);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn local_path(name: &str) -> PathBuf {
        if cfg!(windows) {
            PathBuf::from(format!(r"C:\fixture\{name}"))
        } else {
            PathBuf::from(format!("/fixture/{name}"))
        }
    }

    #[cfg(windows)]
    #[test]
    fn path_gate_accepts_only_normal_or_verbatim_local_drives() {
        assert!(validate_exact_local_path(Path::new(r"C:\fixture\model.gguf"), "artifact").is_ok());
        assert!(
            validate_exact_local_path(Path::new(r"\\?\C:\fixture\model.gguf"), "artifact").is_ok()
        );
        for rejected in [
            r"\\server\share\model.gguf",
            r"\\?\UNC\server\share\model.gguf",
            r"\\.\PhysicalDrive0",
            r"\\?\GLOBALROOT\Device\HarddiskVolume1\model.gguf",
            r"C:\fixture\model.gguf:stream",
        ] {
            assert!(
                validate_exact_local_path(Path::new(rejected), "artifact").is_err(),
                "{rejected} must not cross the local-drive path gate"
            );
        }
    }

    #[test]
    fn protocol_invocation_preserves_exact_runtime_flags_and_rejects_drift() {
        let artifact = local_path("model.gguf");
        let argv = [
            "-m",
            artifact.to_str().unwrap(),
            "-p",
            "512",
            "-n",
            "128",
            "-d",
            "16384",
            "-b",
            "2048",
            "-ub",
            "512",
            "-ctk",
            "f16",
            "-ctv",
            "f16",
            "-t",
            "14",
            "-ngl",
            "999",
            "-fa",
            "1",
            "-mmp",
            "1",
            "-r",
            "1",
            "-o",
            "json",
        ]
        .map(str::to_string)
        .to_vec();
        let invocation = crate::execution_protocol::BenchmarkInvocationSpec {
            phase: crate::execution_protocol::BenchmarkRunPhase::Measured,
            phase_run_number: 1,
            phase_run_count: 3,
            overall_run_number: 2,
            overall_run_count: 4,
            argv: argv.clone(),
        };
        let protocol = crate::execution_protocol::BenchmarkExecutionSpec {
            protocol_id: crate::execution_protocol::BENCHMARK_PROTOCOL_V1,
            executable_basename: "llama-bench.exe",
            invocations: vec![crate::execution_protocol::BenchmarkInvocationSpec {
                overall_run_number: 1,
                overall_run_count: 1,
                phase_run_count: 1,
                ..invocation.clone()
            }],
            expected_backend: crate::contracts::AcceleratorBackend::Cuda,
            expected_engine_build: "b10061 (5d5306bf3)".into(),
            context_test_depth_tokens: 16_384,
            prompt_tokens: 512,
            generation_tokens: 128,
            warmup_runs: 0,
            measured_runs: 1,
            measurement_kinds: vec![
                crate::contracts::MeasurementKind::PromptProcessing,
                crate::contracts::MeasurementKind::Generation,
            ],
            max_stdout_bytes: 1024,
            max_stderr_bytes: 1024,
            timeout_seconds: 60,
        };
        let invocation = protocol.invocations[0].clone();
        let value = ExistingEngineProcessSpec::from_benchmark_protocol(
            local_path("llama-bench.exe"),
            artifact.clone(),
            "a".repeat(64),
            "b".repeat(64),
            &protocol,
            &invocation,
        )
        .unwrap();
        assert_eq!(
            value.arguments(),
            argv.into_iter().map(OsString::from).collect::<Vec<_>>()
        );

        let mut drifted = invocation;
        drifted.argv.push("--caller-flag".into());
        assert!(ExistingEngineProcessSpec::from_benchmark_protocol(
            local_path("llama-bench.exe"),
            artifact,
            "a".repeat(64),
            "b".repeat(64),
            &protocol,
            &drifted,
        )
        .is_err());
    }

    #[test]
    fn quick_check_protocol_accepts_only_resolver_owned_fixed_prompt() {
        let artifact = local_path("model.gguf");
        let prompt = "Return only this data as one JSON object with exactly these keys and value types: project is the string Orchid, count is the number 3, and ready is the boolean true. Do not use markdown.";
        let argv = [
            "-m",
            artifact.to_str().unwrap(),
            "-p",
            prompt,
            "-n",
            "60",
            "-c",
            "16384",
            "-ctk",
            "f16",
            "-ctv",
            "f16",
            "-ngl",
            "999",
            "-b",
            "2048",
            "-ub",
            "512",
            "-t",
            "14",
            "--flash-attn",
            "on",
            "--mmap",
            "--chat-template",
            "chatml",
            "--temp",
            "0",
            "--top-p",
            "0.9",
            "--top-k",
            "40",
            "--min-p",
            "0.05",
            "--seed",
            "1",
            "--single-turn",
            "--simple-io",
            "--no-show-timings",
            "--color",
            "off",
        ]
        .map(str::to_string)
        .to_vec();
        let invocation = crate::execution_protocol::QuickCheckInvocationSpec {
            check_id: "json-schema",
            criterion: "Return the exact required JSON object.",
            argv: argv.clone(),
        };
        let protocol = crate::execution_protocol::QuickCheckExecutionSpec {
            protocol_id: crate::execution_protocol::QUICK_CHECK_PROTOCOL_V1,
            executable_basename: "llama-cli.exe",
            expected_backend: crate::contracts::AcceleratorBackend::Cuda,
            expected_engine_build: "b10061 (5d5306bf3)".into(),
            invocations: vec![invocation.clone()],
            max_stdout_bytes_per_invocation: 1024,
            max_stderr_bytes_per_invocation: 1024,
            timeout_seconds_per_invocation: 60,
        };
        let value = ExistingEngineProcessSpec::from_quick_check_protocol(
            local_path("llama-cli.exe"),
            artifact,
            "a".repeat(64),
            "b".repeat(64),
            &protocol,
            &invocation,
        )
        .unwrap();
        assert_eq!(value.arguments()[3], OsString::from(prompt));
        assert_eq!(
            value.arguments(),
            argv.into_iter().map(OsString::from).collect::<Vec<_>>()
        );

        let mut arbitrary = invocation;
        arbitrary.argv[3] = "weather next week; & whoami | echo".into();
        assert!(ExistingEngineProcessSpec::from_quick_check_protocol(
            local_path("llama-cli.exe"),
            local_path("model.gguf"),
            "a".repeat(64),
            "b".repeat(64),
            &protocol,
            &arbitrary,
        )
        .is_err());
    }

    #[test]
    fn limits_are_nonzero_and_cannot_exceed_boundary_maxima() {
        assert!(ProcessLimits::new(Duration::ZERO, 1, 1).is_err());
        assert!(ProcessLimits::new(MAX_WALL_TIME + Duration::from_secs(1), 1, 1).is_err());
        assert!(ProcessLimits::new(Duration::from_secs(1), MAX_STREAM_BYTES + 1, 1).is_err());
        assert!(ProcessLimits::new(Duration::from_secs(1), 1, 0).is_err());
        assert!(ProcessLimits::new(Duration::from_secs(1), 1024, 1024).is_ok());
    }

    #[test]
    fn bounded_reader_retains_only_limit_while_draining_the_stream() {
        let exceeded = Arc::new(AtomicBool::new(false));
        let receiver = spawn_bounded_reader(
            std::io::Cursor::new(vec![b'x'; 32]),
            8,
            Arc::clone(&exceeded),
        );
        assert_eq!(receive_reader(receiver, "fixture").unwrap(), vec![b'x'; 8]);
        assert!(exceeded.load(Ordering::Acquire));
    }

    #[test]
    fn cancellation_is_external_and_monotonic() {
        let cancellation = ExecutionCancellation::default();
        let other = cancellation.clone();
        assert!(!cancellation.is_requested());
        other.request();
        assert!(cancellation.is_requested());
    }

    #[cfg(windows)]
    fn quoted_argument(value: &str) -> String {
        use std::os::windows::ffi::OsStrExt;
        let mut encoded = Vec::new();
        append_windows_quoted_argument(std::ffi::OsStr::new(value).encode_wide(), &mut encoded)
            .unwrap();
        String::from_utf16(&encoded).unwrap()
    }

    #[cfg(windows)]
    #[test]
    fn windows_quoting_handles_spaces_unicode_quotes_backslashes_and_shell_metacharacters() {
        assert_eq!(quoted_argument("plain"), r#""plain""#);
        assert_eq!(quoted_argument("two words"), r#""two words""#);
        assert_eq!(quoted_argument("雪 model"), r#""雪 model""#);
        assert_eq!(quoted_argument(r#"say "hello""#), r#""say \"hello\"""#);
        assert_eq!(
            quoted_argument("C:\\models with spaces\\"),
            "\"C:\\models with spaces\\\\\""
        );
        assert_eq!(
            quoted_argument("& whoami | echo %PATH% ^ > result"),
            r#""& whoami | echo %PATH% ^ > result""#
        );
        assert!(append_windows_quoted_argument(
            [b'a' as u16, 0, b'b' as u16].into_iter(),
            &mut Vec::new()
        )
        .is_err());
    }

    #[cfg(windows)]
    fn powershell_path() -> PathBuf {
        PathBuf::from(std::env::var_os("WINDIR").unwrap())
            .join(r"System32\WindowsPowerShell\v1.0\powershell.exe")
    }

    #[cfg(windows)]
    #[test]
    fn suspended_native_child_starts_only_after_job_assignment_and_collects_both_pipes() {
        let arguments = [
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "[Console]::Out.Write('stdout-value'); [Console]::Error.Write('stderr-value')",
        ]
        .map(OsString::from);
        let output = run_native_process(
            &powershell_path(),
            &arguments,
            ProcessLimits::new(Duration::from_secs(5), 4096, 4096).unwrap(),
            &ExecutionCancellation::default(),
        )
        .unwrap();
        assert_eq!(output.termination, ProcessTermination::Completed);
        assert!(String::from_utf8(output.stdout)
            .unwrap()
            .contains("stdout-value"));
        assert!(String::from_utf8(output.stderr)
            .unwrap()
            .contains("stderr-value"));
    }

    #[cfg(windows)]
    #[test]
    fn system_boundary_honors_external_cancellation_and_waits() {
        let arguments = [
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Start-Sleep -Seconds 30",
        ]
        .map(OsString::from);
        let cancellation = ExecutionCancellation::default();
        let requester = cancellation.clone();
        let trigger = thread::spawn(move || {
            thread::sleep(Duration::from_millis(50));
            requester.request();
        });
        let output = run_native_process(
            &powershell_path(),
            &arguments,
            ProcessLimits::new(Duration::from_secs(5), 4096, 4096).unwrap(),
            &cancellation,
        )
        .unwrap();
        trigger.join().unwrap();
        assert_eq!(output.termination, ProcessTermination::Cancelled);
        assert!(output.elapsed < Duration::from_secs(2));
    }

    #[cfg(windows)]
    #[test]
    fn system_boundary_kills_on_output_overflow_and_retains_only_the_cap() {
        let arguments = [
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "[Console]::Out.Write('x' * 1000)",
        ]
        .map(OsString::from);
        let output = run_native_process(
            &powershell_path(),
            &arguments,
            ProcessLimits::new(Duration::from_secs(5), 64, 64).unwrap(),
            &ExecutionCancellation::default(),
        )
        .unwrap();
        assert_eq!(output.termination, ProcessTermination::OutputLimitExceeded);
        assert_eq!(output.stdout.len(), 64);
        assert!(output.stderr.len() <= 64);
    }
}

use runner_lib::existing_tool_probe::{
    probe_existing_tool, ExistingToolKind, ExistingToolProbeAction, ExistingToolProbeBoundary,
    ExistingToolProbeRequest, FileSnapshot, VersionProcessLimits, VersionProcessOutput,
};
use std::collections::VecDeque;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

const HASH_A: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B: &str = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

struct FakeBoundary {
    canonical_path: PathBuf,
    snapshots: Mutex<VecDeque<FileSnapshot>>,
    hashes: Mutex<VecDeque<String>>,
    output: VersionProcessOutput,
    observed_arguments: Mutex<Vec<String>>,
}

impl FakeBoundary {
    fn successful(kind: ExistingToolKind) -> Self {
        let path = tool_path(kind);
        Self {
            canonical_path: path,
            snapshots: Mutex::new(VecDeque::from([snapshot()])),
            hashes: Mutex::new(VecDeque::from([HASH_A.into()])),
            output: VersionProcessOutput {
                exit_code: Some(0),
                stdout: b"version: 10061 (5d5306bf3)\nbuilt with MSVC 19.39 for x86_64-pc-windows-msvc\n"
                    .to_vec(),
                stderr: vec![],
                stdout_truncated: false,
                stderr_truncated: false,
                timed_out: false,
            },
            observed_arguments: Mutex::new(vec![]),
        }
    }
}

impl ExistingToolProbeBoundary for FakeBoundary {
    type IdentityGuard = PathBuf;

    fn canonicalize(&self, _path: &Path) -> Result<PathBuf, String> {
        Ok(self.canonical_path.clone())
    }

    fn acquire_identity_guard(&self, path: &Path) -> Result<Self::IdentityGuard, String> {
        Ok(path.to_path_buf())
    }

    fn snapshot(&self, _guard: &Self::IdentityGuard) -> Result<FileSnapshot, String> {
        let mut values = self.snapshots.lock().unwrap();
        if values.len() > 1 {
            Ok(values.pop_front().unwrap())
        } else {
            Ok(values.front().unwrap().clone())
        }
    }

    fn sha256(&self, _guard: &Self::IdentityGuard) -> Result<String, String> {
        let mut values = self.hashes.lock().unwrap();
        if values.len() > 1 {
            Ok(values.pop_front().unwrap())
        } else {
            Ok(values.front().unwrap().clone())
        }
    }

    fn run_version(
        &self,
        _guard: &Self::IdentityGuard,
        arguments: &[&str],
        limits: VersionProcessLimits,
    ) -> Result<VersionProcessOutput, String> {
        *self.observed_arguments.lock().unwrap() =
            arguments.iter().map(|value| (*value).to_string()).collect();
        assert_eq!(limits.max_stdout_bytes, 16 * 1024);
        assert_eq!(limits.max_stderr_bytes, 16 * 1024);
        assert_eq!(limits.watchdog.as_secs(), 2);
        Ok(self.output.clone())
    }

    fn now_unix_millis(&self) -> Result<u128, String> {
        Ok(1_753_225_200_000)
    }
}

fn tool_path(kind: ExistingToolKind) -> PathBuf {
    let basename = match kind {
        ExistingToolKind::Benchmark => {
            if cfg!(windows) {
                "llama-bench.exe"
            } else {
                "llama-bench"
            }
        }
        ExistingToolKind::QuickCheck => {
            if cfg!(windows) {
                "llama-cli.exe"
            } else {
                "llama-cli"
            }
        }
        ExistingToolKind::FitProfileCapture => {
            if cfg!(windows) {
                "llama-fit-params.exe"
            } else {
                "llama-fit-params"
            }
        }
    };
    if cfg!(windows) {
        PathBuf::from(format!(r"C:\LocalArcade\tools\{basename}"))
    } else {
        PathBuf::from(format!("/opt/local-arcade/{basename}"))
    }
}

fn request(kind: ExistingToolKind) -> ExistingToolProbeRequest {
    ExistingToolProbeRequest {
        action: ExistingToolProbeAction::InspectExistingToolIdentityV1,
        kind,
        selected_path: tool_path(kind),
    }
}

fn snapshot() -> FileSnapshot {
    FileSnapshot {
        regular_file: true,
        size_bytes: 42,
        modified_unix_nanos: 1_753_225_100_000_000_000,
    }
}

#[test]
fn exact_probe_binds_canonical_file_and_strict_build_without_authorizing_work() {
    for kind in [
        ExistingToolKind::Benchmark,
        ExistingToolKind::QuickCheck,
        ExistingToolKind::FitProfileCapture,
    ] {
        let boundary = FakeBoundary::successful(kind);
        let receipt = probe_existing_tool(&request(kind), &boundary).unwrap();
        assert_eq!(receipt.kind(), kind);
        assert_eq!(receipt.canonical_path(), tool_path(kind));
        assert_eq!(receipt.sha256(), HASH_A);
        assert_eq!(receipt.size_bytes(), 42);
        assert_eq!(receipt.modified_unix_nanos(), 1_753_225_100_000_000_000);
        assert_eq!(receipt.observed_product(), "llama-cpp");
        assert_eq!(receipt.observed_engine(), "llama.cpp");
        assert_eq!(receipt.observed_engine_build(), "b10061 (5d5306bf3)");
        assert_eq!(receipt.probe_protocol_id(), "llama-cpp-version-v1");
        assert_eq!(receipt.observed_unix_millis(), 1_753_225_200_000);
        assert!(!receipt.grants_authorization());
        assert!(!receipt.child_write_isolation_enforced());
        assert!(!receipt.child_network_isolation_enforced());
        assert_eq!(
            *boundary.observed_arguments.lock().unwrap(),
            vec!["--version"]
        );
    }
}

#[test]
fn wrong_basename_and_nonlocal_path_shapes_fail_before_process_inspection() {
    let boundary = FakeBoundary::successful(ExistingToolKind::Benchmark);
    let mut value = request(ExistingToolKind::Benchmark);
    value.selected_path = tool_path(ExistingToolKind::QuickCheck);
    assert_eq!(
        probe_existing_tool(&value, &boundary).unwrap_err().code,
        "m-j.tool-probe.basename-mismatch"
    );

    value.selected_path = PathBuf::from(if cfg!(windows) {
        r"llama-bench.exe"
    } else {
        "llama-bench"
    });
    assert_eq!(
        probe_existing_tool(&value, &boundary).unwrap_err().code,
        "m-j.tool-probe.path-not-absolute"
    );

    if cfg!(windows) {
        value.selected_path = PathBuf::from(r"\\server\share\llama-bench.exe");
        assert_eq!(
            probe_existing_tool(&value, &boundary).unwrap_err().code,
            "m-j.tool-probe.network-path-blocked"
        );
        value.selected_path = PathBuf::from(r"C:\LocalArcade\tools\llama-bench.exe:payload");
        assert_eq!(
            probe_existing_tool(&value, &boundary).unwrap_err().code,
            "m-j.tool-probe.alternate-data-stream-blocked"
        );

        let mut verbatim = FakeBoundary::successful(ExistingToolKind::Benchmark);
        verbatim.canonical_path = PathBuf::from(r"\\?\C:\LocalArcade\tools\llama-bench.exe");
        assert!(
            probe_existing_tool(&request(ExistingToolKind::Benchmark), &verbatim).is_ok(),
            "Windows canonicalization commonly returns a local verbatim-disk path"
        );

        for blocked in [
            r"\\.\C:\LocalArcade\tools\llama-bench.exe",
            r"\\?\Volume{01234567-89ab-cdef-0123-456789abcdef}\tools\llama-bench.exe",
        ] {
            value.selected_path = PathBuf::from(blocked);
            assert_eq!(
                probe_existing_tool(&value, &boundary).unwrap_err().code,
                "m-j.tool-probe.network-path-blocked"
            );
        }
    }
}

#[test]
fn malformed_or_ambiguous_version_output_is_never_promoted_to_build_identity() {
    let mut windows_lines = FakeBoundary::successful(ExistingToolKind::Benchmark);
    windows_lines.output.stdout =
        b"version: 10061 (5d5306bf3)\r\nbuilt with MSVC 19.39 for x86_64-pc-windows-msvc\r\n"
            .to_vec();
    assert_eq!(
        probe_existing_tool(&request(ExistingToolKind::Benchmark), &windows_lines)
            .unwrap()
            .observed_engine_build(),
        "b10061 (5d5306bf3)"
    );

    let invalid = [
        b"llama.cpp version: 10061 (5d5306bf3)\n".as_slice(),
        b"version: b10061 (5d5306bf3)\n".as_slice(),
        b"version: 10061 (5D5306BF3)\n".as_slice(),
        b"version: 10061 (5d5306bf3)\nextra claim\n".as_slice(),
        b"version: 10061 (5d5306bf3)\rtrailing".as_slice(),
        b"version: 10061 (short)\n".as_slice(),
    ];
    for stdout in invalid {
        let mut boundary = FakeBoundary::successful(ExistingToolKind::Benchmark);
        boundary.output.stdout = stdout.to_vec();
        assert!(
            probe_existing_tool(&request(ExistingToolKind::Benchmark), &boundary)
                .unwrap_err()
                .code
                .starts_with("m-j.tool-probe.version-")
        );
    }
}

#[test]
fn timeout_nonzero_stderr_and_bounded_output_fail_closed() {
    let cases = [
        (
            VersionProcessOutput {
                timed_out: true,
                ..FakeBoundary::successful(ExistingToolKind::Benchmark).output
            },
            "m-j.tool-probe.timed-out",
        ),
        (
            VersionProcessOutput {
                exit_code: Some(2),
                ..FakeBoundary::successful(ExistingToolKind::Benchmark).output
            },
            "m-j.tool-probe.nonzero-exit",
        ),
        (
            VersionProcessOutput {
                stderr: b"warning".to_vec(),
                ..FakeBoundary::successful(ExistingToolKind::Benchmark).output
            },
            "m-j.tool-probe.unexpected-stderr",
        ),
        (
            VersionProcessOutput {
                stdout_truncated: true,
                ..FakeBoundary::successful(ExistingToolKind::Benchmark).output
            },
            "m-j.tool-probe.output-too-large",
        ),
    ];
    for (output, code) in cases {
        let mut boundary = FakeBoundary::successful(ExistingToolKind::Benchmark);
        boundary.output = output;
        assert_eq!(
            probe_existing_tool(&request(ExistingToolKind::Benchmark), &boundary)
                .unwrap_err()
                .code,
            code
        );
    }
}

#[test]
fn executable_replacement_or_metadata_change_during_probe_is_blocked() {
    let mut hash_drift = FakeBoundary::successful(ExistingToolKind::Benchmark);
    hash_drift.hashes = Mutex::new(VecDeque::from([HASH_A.into(), HASH_B.into()]));
    assert_eq!(
        probe_existing_tool(&request(ExistingToolKind::Benchmark), &hash_drift)
            .unwrap_err()
            .code,
        "m-j.tool-probe.identity-drift"
    );

    let mut metadata_drift = FakeBoundary::successful(ExistingToolKind::Benchmark);
    let mut changed = snapshot();
    changed.size_bytes += 1;
    metadata_drift.snapshots = Mutex::new(VecDeque::from([snapshot(), changed]));
    assert_eq!(
        probe_existing_tool(&request(ExistingToolKind::Benchmark), &metadata_drift)
            .unwrap_err()
            .code,
        "m-j.tool-probe.identity-drift"
    );
}

#[test]
fn directory_and_invalid_boundary_hash_are_rejected() {
    let mut directory = FakeBoundary::successful(ExistingToolKind::Benchmark);
    let mut directory_snapshot = snapshot();
    directory_snapshot.regular_file = false;
    directory.snapshots = Mutex::new(VecDeque::from([directory_snapshot]));
    assert_eq!(
        probe_existing_tool(&request(ExistingToolKind::Benchmark), &directory)
            .unwrap_err()
            .code,
        "m-j.tool-probe.not-regular-file"
    );

    let mut bad_hash = FakeBoundary::successful(ExistingToolKind::Benchmark);
    bad_hash.hashes = Mutex::new(VecDeque::from(["ABC".into()]));
    assert_eq!(
        probe_existing_tool(&request(ExistingToolKind::Benchmark), &bad_hash)
            .unwrap_err()
            .code,
        "m-j.tool-probe.hash-invalid"
    );
}

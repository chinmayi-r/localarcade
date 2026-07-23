//! Typed runner-local transport for the M-O execution lifecycle.
//!
//! This module is the only bridge from the non-authorizing preview store into
//! `ExecutionService`. IPC callers can present opaque process-local handles and
//! explicit acknowledgements, but cannot supply paths, argv, observations,
//! clocks, authorization receipts, or process identifiers.

use crate::contracts::VerificationResult;
use crate::execution_lifecycle::LifecycleSnapshotV1;
use crate::execution_service::ExecutionService;
use crate::preview_adapter::{parse_handle, PreviewAssembler};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct StartVerificationExecutionInput {
    pub prepared_handle: String,
    pub acknowledge_local_process_execution: bool,
    pub acknowledge_model_load: bool,
    pub acknowledge_machine_may_be_busy: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VerificationExecutionReferenceInput {
    pub execution_handle: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionStartViewV1 {
    pub execution_handle: String,
    pub snapshot: LifecycleSnapshotV1,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionResultReadV1 {
    pub snapshot: LifecycleSnapshotV1,
    pub verification_result: Option<VerificationResult>,
}

#[derive(Default)]
pub(crate) struct RunnerProcessState {
    preview: PreviewAssembler,
    execution: ExecutionService,
}

impl RunnerProcessState {
    pub(crate) fn preview_mut(&mut self) -> &mut PreviewAssembler {
        &mut self.preview
    }

    pub(crate) fn start(
        &mut self,
        input: StartVerificationExecutionInput,
    ) -> Result<ExecutionStartViewV1, Vec<String>> {
        validate_execution_acknowledgements(&input)?;
        let handle = parse_handle(&input.prepared_handle).map_err(|error| vec![error])?;

        // Removal is deliberate and fail-closed. Once an execution attempt
        // crosses this boundary, a stale or replayed preview handle cannot
        // authorize a later run, including after a failed integrity recheck.
        let prepared = self
            .preview
            .take_prepared_for_execution(&handle)
            .map_err(|error| vec![error])?;
        let confirmation = self
            .execution
            .confirm_prepared(&prepared)
            .map_err(|error| vec![error])?;
        let receipt = self.execution.start(prepared, confirmation)?;
        Ok(ExecutionStartViewV1 {
            execution_handle: receipt.authorization.execution_id().to_string(),
            snapshot: receipt.snapshot,
        })
    }

    pub(crate) fn status(
        &self,
        input: &VerificationExecutionReferenceInput,
    ) -> Result<LifecycleSnapshotV1, Vec<String>> {
        self.execution
            .snapshot(&input.execution_handle)
            .map_err(|error| vec![error])?
            .ok_or_else(|| vec!["m-o.execution.reference-invalid-or-stale".into()])
    }

    pub(crate) fn stop(
        &self,
        input: &VerificationExecutionReferenceInput,
    ) -> Result<LifecycleSnapshotV1, Vec<String>> {
        self.execution
            .stop(&input.execution_handle)
            .map_err(|error| vec![error])
    }

    pub(crate) fn result(
        &self,
        input: &VerificationExecutionReferenceInput,
    ) -> Result<ExecutionResultReadV1, Vec<String>> {
        let (snapshot, terminal) = self
            .execution
            .snapshot_and_terminal(&input.execution_handle)
            .map_err(|error| vec![error])?
            .ok_or_else(|| vec!["m-o.execution.reference-invalid-or-stale".into()])?;
        Ok(ExecutionResultReadV1 {
            snapshot,
            verification_result: terminal.map(|record| record.verification_result().clone()),
        })
    }
}

fn validate_execution_acknowledgements(
    input: &StartVerificationExecutionInput,
) -> Result<(), Vec<String>> {
    let mut missing = Vec::new();
    if !input.acknowledge_local_process_execution {
        missing.push("m-o.execution.consent-local-process-required".into());
    }
    if !input.acknowledge_model_load {
        missing.push("m-o.execution.consent-model-load-required".into());
    }
    if !input.acknowledge_machine_may_be_busy {
        missing.push("m-o.execution.consent-machine-busy-required".into());
    }
    if missing.is_empty() {
        Ok(())
    } else {
        Err(missing)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::contracts::VerificationPlan;
    use crate::execution_process::{
        ExecutionCancellation, ExistingEngineProcessSpec, ProcessLimits,
    };
    use crate::execution_service::{PrivateProcessResult, ProcessRunner};
    use crate::verification::{CheckedFileIdentity, PreparedVerification};
    use std::path::Path;
    use std::sync::Arc;

    fn start_input() -> StartVerificationExecutionInput {
        StartVerificationExecutionInput {
            prepared_handle: "prepared-1".into(),
            acknowledge_local_process_execution: true,
            acknowledge_model_load: true,
            acknowledge_machine_may_be_busy: true,
        }
    }

    #[test]
    fn all_three_side_effect_acknowledgements_are_required_before_handle_lookup() {
        let mut input = start_input();
        input.acknowledge_local_process_execution = false;
        input.acknowledge_model_load = false;
        input.acknowledge_machine_may_be_busy = false;
        assert_eq!(
            validate_execution_acknowledgements(&input).unwrap_err(),
            vec![
                "m-o.execution.consent-local-process-required",
                "m-o.execution.consent-model-load-required",
                "m-o.execution.consent-machine-busy-required",
            ]
        );
    }

    #[test]
    fn stale_or_restart_lost_references_fail_closed() {
        let state = RunnerProcessState::default();
        let reference = VerificationExecutionReferenceInput {
            execution_handle: "execution-from-an-earlier-process".into(),
        };
        assert_eq!(
            state.status(&reference).unwrap_err(),
            vec!["m-o.execution.reference-invalid-or-stale"]
        );
        assert_eq!(
            state.result(&reference).unwrap_err(),
            vec!["m-o.execution.reference-invalid-or-stale"]
        );
        assert_eq!(
            state.stop(&reference).unwrap_err(),
            vec!["m-o.execution.unknown-or-terminal-reference"]
        );
    }

    #[test]
    fn valid_consent_does_not_turn_a_forged_preview_handle_into_authority() {
        let mut state = RunnerProcessState::default();
        assert_eq!(
            state.start(start_input()).unwrap_err(),
            vec!["m-o.execution.prepared-handle-invalid-or-consumed"]
        );
    }

    #[test]
    fn caller_authored_execution_facts_are_rejected_at_deserialization() {
        let with_path = serde_json::json!({
            "preparedHandle": "prepared-1",
            "acknowledgeLocalProcessExecution": true,
            "acknowledgeModelLoad": true,
            "acknowledgeMachineMayBeBusy": true,
            "executablePath": "C:\\untrusted\\llama-bench.exe"
        });
        assert!(
            serde_json::from_value::<StartVerificationExecutionInput>(with_path).is_err(),
            "unknown path/argv/clock/observation fields must fail closed"
        );

        let with_pid = serde_json::json!({
            "executionHandle": "execution-1",
            "pid": 1234
        });
        assert!(
            serde_json::from_value::<VerificationExecutionReferenceInput>(with_pid).is_err(),
            "references contain only the process-local execution handle"
        );
    }

    struct FailingRunner;

    impl ProcessRunner for FailingRunner {
        fn artifact_size(&self, _artifact: &Path) -> Result<u64, String> {
            Ok(1)
        }

        fn run(
            &self,
            _spec: &ExistingEngineProcessSpec,
            _limits: ProcessLimits,
            _cancellation: &ExecutionCancellation,
        ) -> Result<PrivateProcessResult, String> {
            Err("fixture-process-failure".into())
        }
    }

    fn terminal_stop_prepared() -> PreparedVerification {
        let envelope: serde_json::Value = serde_json::from_str(include_str!(
            "../../../docs/contracts/fixtures/verification-plan.ok.json"
        ))
        .unwrap();
        let mut plan: VerificationPlan = serde_json::from_value(envelope["data"].clone()).unwrap();
        plan.quick_check_plan = None;
        let benchmark = plan.benchmark_plan.as_mut().unwrap();
        benchmark.runtime.sampler.temperature = Some(0.0);
        benchmark.runtime.sampler.top_p = Some(0.9);
        benchmark.runtime.sampler.top_k = Some(40);
        benchmark.runtime.sampler.min_p = Some(0.05);
        benchmark.runtime.sampler.seed = Some(1);
        benchmark.artifact_path = r"C:\Models\fixture.gguf".into();
        benchmark.expected_artifact_sha256 = "a".repeat(64);
        PreparedVerification::for_execution_service_test(
            plan,
            CheckedFileIdentity {
                path: r"C:\Models\fixture.gguf".into(),
                sha256: "a".repeat(64),
            },
            Some(CheckedFileIdentity {
                path: r"C:\llama\llama-bench.exe".into(),
                sha256: "b".repeat(64),
            }),
            None,
        )
    }

    #[test]
    fn transport_stop_is_idempotent_after_terminal_publication() {
        let mut state = RunnerProcessState::default();
        let prepared = terminal_stop_prepared();
        let confirmation = state.execution.confirm_prepared(&prepared).unwrap();
        let start = state
            .execution
            .start_with_runner(prepared, confirmation, Arc::new(FailingRunner))
            .unwrap();
        let reference = VerificationExecutionReferenceInput {
            execution_handle: start.authorization.execution_id().into(),
        };
        for _ in 0..500 {
            if state
                .execution
                .snapshot(&reference.execution_handle)
                .unwrap()
                .is_some_and(|snapshot| {
                    snapshot.state() == &crate::execution_lifecycle::LifecycleState::Terminal
                })
            {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(2));
        }
        let first = state.stop(&reference).unwrap();
        let second = state.stop(&reference).unwrap();
        assert_eq!(
            first.state(),
            &crate::execution_lifecycle::LifecycleState::Terminal
        );
        assert_eq!(second, first);
    }
}

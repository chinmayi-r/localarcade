use runner_lib::contracts::{canonical_json, validate_contract_json};
use serde_json::json;

const POSITIVE: &[(&str, &str)] = &[
    (
        "benchmark-plan.ok.json",
        include_str!("../../../docs/contracts/fixtures/benchmark-plan.ok.json"),
    ),
    (
        "benchmark-result.ok.json",
        include_str!("../../../docs/contracts/fixtures/benchmark-result.ok.json"),
    ),
    (
        "common-blocked.json",
        include_str!("../../../docs/contracts/fixtures/common-blocked.json"),
    ),
    (
        "common-error.json",
        include_str!("../../../docs/contracts/fixtures/common-error.json"),
    ),
    (
        "common-partial.json",
        include_str!("../../../docs/contracts/fixtures/common-partial.json"),
    ),
    (
        "common-unavailable.json",
        include_str!("../../../docs/contracts/fixtures/common-unavailable.json"),
    ),
    (
        "exact-configuration-candidate.ok.json",
        include_str!("../../../docs/contracts/fixtures/exact-configuration-candidate.ok.json"),
    ),
    (
        "fit-evidence-assessment.ok.json",
        include_str!("../../../docs/contracts/fixtures/fit-evidence-assessment.ok.json"),
    ),
    (
        "hardware-target.detected-partial.json",
        include_str!("../../../docs/contracts/fixtures/hardware-target.detected-partial.json"),
    ),
    (
        "hardware-target.ok.json",
        include_str!("../../../docs/contracts/fixtures/hardware-target.ok.json"),
    ),
    (
        "quick-check-plan.ok.json",
        include_str!("../../../docs/contracts/fixtures/quick-check-plan.ok.json"),
    ),
    (
        "quick-check-result.ok.json",
        include_str!("../../../docs/contracts/fixtures/quick-check-result.ok.json"),
    ),
    (
        "recommendation-portfolio.ok.json",
        include_str!("../../../docs/contracts/fixtures/recommendation-portfolio.ok.json"),
    ),
    (
        "recommendation-request.ok.json",
        include_str!("../../../docs/contracts/fixtures/recommendation-request.ok.json"),
    ),
    (
        "runner-handoff.ok.json",
        include_str!("../../../docs/contracts/fixtures/runner-handoff.ok.json"),
    ),
    (
        "verification-plan.ok.json",
        include_str!("../../../docs/contracts/fixtures/verification-plan.ok.json"),
    ),
    (
        "verification-result.conditioned.json",
        include_str!("../../../docs/contracts/fixtures/verification-result.conditioned.json"),
    ),
    (
        "verification-result.ok.json",
        include_str!("../../../docs/contracts/fixtures/verification-result.ok.json"),
    ),
];

const NEGATIVE: &[(&str, &str)] = &[
    (
        "candidate-bad-hash.json",
        include_str!("../../../docs/contracts/fixtures/invalid/candidate-bad-hash.json"),
    ),
    (
        "handoff-invalid-expiry.json",
        include_str!("../../../docs/contracts/fixtures/invalid/handoff-invalid-expiry.json"),
    ),
    (
        "hardware-source-enum.json",
        include_str!("../../../docs/contracts/fixtures/invalid/hardware-source-enum.json"),
    ),
    (
        "partial-untyped-data.json",
        include_str!("../../../docs/contracts/fixtures/invalid/partial-untyped-data.json"),
    ),
    (
        "portfolio-duplicate-family.json",
        include_str!("../../../docs/contracts/fixtures/invalid/portfolio-duplicate-family.json"),
    ),
    (
        "request-invalid-priority.json",
        include_str!("../../../docs/contracts/fixtures/invalid/request-invalid-priority.json"),
    ),
    (
        "request-missing-task.json",
        include_str!("../../../docs/contracts/fixtures/invalid/request-missing-task.json"),
    ),
    (
        "schema-version.json",
        include_str!("../../../docs/contracts/fixtures/invalid/schema-version.json"),
    ),
    (
        "verification-combined-samples.json",
        include_str!("../../../docs/contracts/fixtures/invalid/verification-combined-samples.json"),
    ),
    (
        "verification-empty-plan.json",
        include_str!("../../../docs/contracts/fixtures/invalid/verification-empty-plan.json"),
    ),
    (
        "verification-extra-field.json",
        include_str!("../../../docs/contracts/fixtures/invalid/verification-extra-field.json"),
    ),
];

#[test]
fn rust_accepts_every_shared_positive_fixture() {
    assert_eq!(POSITIVE.len(), 18);
    for (name, fixture) in POSITIVE {
        assert!(
            validate_contract_json(fixture).is_ok(),
            "{name}: {:?}",
            validate_contract_json(fixture)
        );
    }
}

#[test]
fn rust_rejects_every_shared_negative_fixture() {
    assert_eq!(NEGATIVE.len(), 11);
    for (name, fixture) in NEGATIVE {
        assert!(validate_contract_json(fixture).is_err(), "{name}");
    }
}

#[test]
fn canonical_serialization_is_key_order_independent() {
    assert_eq!(
        canonical_json(&json!({"z": 1, "a": {"y": 2, "x": 3}})),
        canonical_json(&json!({"a": {"x": 3, "y": 2}, "z": 1}))
    );
}

#[test]
fn forward_versions_fail_closed() {
    let fixture = r#"{"schemaVersion":2,"contract":"hardware-target","status":"error"}"#;
    assert!(validate_contract_json(fixture).is_err());
}

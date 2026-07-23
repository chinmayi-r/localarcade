use runner_lib::model_store::inventory::{
    adapt_scan_report, adapt_scan_report_with_registry_at, InventoryArtifactResolution,
    InventoryStatus,
};
use runner_lib::model_store::{
    admitted_identities, FoundArtifact, RegistryMatch, ScanReport, ScannedStore, UnreadableEntry,
};
use serde_json::{json, Map, Value};
use std::collections::HashMap;

const NOW_MS: i64 = 1_784_721_600_000;
const FRESH_AT: &str = "2026-07-19T12:00:00.000Z";
const SHA: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const IDENTITY_GOLDEN: &str =
    include_str!("../../../tests/fixtures/inventory-mc-identity-v1.golden.json");

fn field_provenance() -> Value {
    let fields = [
        "id",
        "publisher",
        "repository",
        "revision",
        "fileName",
        "sha256",
        "fileSizeBytes",
        "format",
        "quantization",
        "baseModel",
        "family",
        "model",
        "maxContextTokens",
        "license",
        "chatTemplate",
    ];
    let values: Map<String, Value> = fields
        .into_iter()
        .map(|field| {
            (
                field.into(),
                json!({
                    "sourceUrl": format!("https://example.invalid/{field}"),
                    "retrievedAt": FRESH_AT,
                    "kind": "hub-api"
                }),
            )
        })
        .collect();
    Value::Object(values)
}

fn artifact(status: &str, sha256: &str, bytes: u64) -> Value {
    json!({
        "id": "publisher/repository/model-Q4_K_M.gguf@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "publisher": "publisher",
        "repository": "repository",
        "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "fileName": "model-Q4_K_M.gguf",
        "sha256": sha256,
        "fileSizeBytes": bytes,
        "format": "GGUF",
        "quantization": "Q4_K_M",
        "baseModel": "publisher/base-model",
        "family": "publisher/base-model",
        "model": "base-model",
        "maxContextTokens": 32768,
        "chatTemplate": "{{ messages }}",
        "status": status,
        "license": { "id": "apache-2.0", "sourceUrl": "https://example.invalid/license" },
        "provenance": field_provenance()
    })
}

fn snapshot(artifacts: Vec<Value>, last_success: &str, quarantine: Vec<Value>) -> String {
    json!({
        "schemaVersion": 4,
        "snapshotId": "registry-test",
        "generatedAt": FRESH_AT,
        "lastIngestSucceededAt": last_success,
        "artifacts": artifacts,
        "quarantine": quarantine,
        "accelerators": [],
        "compatibilityAssertions": []
    })
    .to_string()
}

fn report(sha256: Option<&str>, bytes: u64) -> ScanReport {
    ScanReport {
        stores: vec![ScannedStore {
            kind: "directory".into(),
            path: "C:/models".into(),
            exists: true,
            truncated: false,
        }],
        artifacts: vec![FoundArtifact {
            path: "C:/models/model-Q4_K_M.gguf".into(),
            store: "directory".into(),
            label: "model-Q4_K_M.gguf".into(),
            file_size_bytes: bytes,
            sha256: sha256.map(str::to_owned),
            registry_match: RegistryMatch::None,
        }],
        duplicate_groups: vec![],
        unreadable: vec![],
        provenance: "scanned-locally",
    }
}

#[test]
fn promoted_hash_and_size_map_to_exact_m_c_identity() {
    let registry = snapshot(vec![artifact("promoted", SHA, 4_000)], FRESH_AT, vec![]);
    let result = adapt_scan_report_with_registry_at(report(Some(SHA), 4_000), &registry, NOW_MS);
    assert_eq!(result.status, InventoryStatus::Ok);
    let InventoryArtifactResolution::Verified { identity } = &result.data.artifacts[0].resolution
    else {
        panic!("exact promoted identity must verify");
    };
    assert_eq!(
        identity.model_family.model_family_id,
        "publisher/base-model"
    );
    assert_eq!(identity.model_family.display_name, "base-model");
    assert_eq!(
        identity.artifact.artifact_id,
        "publisher/repository/model-Q4_K_M.gguf@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
    assert_eq!(identity.artifact.repository, "publisher/repository");
    assert_eq!(identity.artifact.revision, "a".repeat(40));
    assert_eq!(identity.artifact.filename, "model-Q4_K_M.gguf");
    assert_eq!(identity.artifact.sha256, SHA);
    assert_eq!(identity.artifact.bytes, 4_000);
    assert_eq!(identity.artifact.format, "GGUF");
    assert_eq!(identity.artifact.quantization, "Q4_K_M");
    assert_eq!(identity.artifact.license, "apache-2.0");
    assert_eq!(identity.provenance.len(), 15);
    assert_eq!(identity.registry_metadata.field_provenance.len(), 15);
    let json = serde_json::to_value(identity).unwrap();
    assert_eq!(json["artifact"]["status"], "promoted");
    assert_eq!(json["provenance"][0]["method"], "imported");
    assert_eq!(
        json["provenance"][0]["configurationMatch"],
        "not-applicable"
    );
    let projection = json!({
        "modelFamily": json["modelFamily"],
        "artifact": json["artifact"],
        "provenanceRecordRefs": json["provenance"].as_array().unwrap().iter()
            .map(|item| item["rawSourceRecordRef"].clone()).collect::<Vec<_>>(),
        "registryMetadata": {
            "publisher": json["registryMetadata"]["publisher"],
            "baseModel": json["registryMetadata"]["baseModel"],
            "model": json["registryMetadata"]["model"],
            "maxContextTokens": json["registryMetadata"]["maxContextTokens"],
            "chatTemplate": json["registryMetadata"]["chatTemplate"],
            "licenseSourceUrl": json["registryMetadata"]["licenseSourceUrl"],
            "fieldProvenanceKeys": json["registryMetadata"]["fieldProvenance"]
                .as_object().unwrap().keys().cloned().collect::<Vec<_>>()
        }
    });
    let golden: Value = serde_json::from_str(IDENTITY_GOLDEN).unwrap();
    assert_eq!(projection, golden);
}

#[test]
fn size_only_match_is_candidate_and_never_verified() {
    let registry = snapshot(vec![artifact("promoted", SHA, 4_000)], FRESH_AT, vec![]);
    let result = adapt_scan_report_with_registry_at(report(None, 4_000), &registry, NOW_MS);
    assert_eq!(result.status, InventoryStatus::Partial);
    let InventoryArtifactResolution::CandidateBySize { candidates } =
        &result.data.artifacts[0].resolution
    else {
        panic!("size-only identity must remain a candidate");
    };
    assert_eq!(candidates.len(), 1);
    assert_eq!(candidates[0].artifact.sha256, SHA);
}

#[test]
fn triage_quarantine_and_hash_mismatches_fail_closed() {
    let triage_registry = snapshot(vec![artifact("triage", SHA, 4_000)], FRESH_AT, vec![]);
    let triage =
        adapt_scan_report_with_registry_at(report(Some(SHA), 4_000), &triage_registry, NOW_MS);
    assert_unavailable(&triage, "registry.artifact-not-promoted");

    let mut triage_alias = artifact("triage", SHA, 4_000);
    triage_alias["id"] = json!(
        "publisher/repository/triage-alias-Q4_K_M.gguf@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
    triage_alias["fileName"] = json!("triage-alias-Q4_K_M.gguf");
    let promoted_wins = snapshot(
        vec![artifact("promoted", SHA, 4_000), triage_alias],
        FRESH_AT,
        vec![],
    );
    let admitted =
        adapt_scan_report_with_registry_at(report(Some(SHA), 4_000), &promoted_wins, NOW_MS);
    assert!(matches!(
        admitted.data.artifacts[0].resolution,
        InventoryArtifactResolution::Verified { .. }
    ));

    let promoted_registry = snapshot(vec![artifact("promoted", SHA, 4_000)], FRESH_AT, vec![]);
    let size_mismatch =
        adapt_scan_report_with_registry_at(report(Some(SHA), 4_001), &promoted_registry, NOW_MS);
    assert_unavailable(&size_mismatch, "inventory.hash-size-mismatch");

    let other_hash = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    let hash_mismatch = adapt_scan_report_with_registry_at(
        report(Some(other_hash), 4_000),
        &promoted_registry,
        NOW_MS,
    );
    assert_unavailable(&hash_mismatch, "inventory.hash-not-admitted");

    let quarantine = vec![json!({
        "repository": "publisher/repository",
        "revision": "a".repeat(40),
        "fileName": "model-Q4_K_M.gguf",
        "code": "missing-license",
        "reason": "License missing",
        "sourceUrl": "https://example.invalid/quarantine",
        "recordedAt": FRESH_AT
    })];
    let quarantined_registry = snapshot(vec![], FRESH_AT, quarantine.clone());
    let quarantined =
        adapt_scan_report_with_registry_at(report(None, 4_000), &quarantined_registry, NOW_MS);
    assert_unavailable(&quarantined, "inventory.identity-unavailable");

    // A basename cannot establish the quarantined repository and revision.
    // An unrelated promoted artifact with the same name/size remains only a
    // size candidate instead of being falsely attributed to quarantine.
    let same_name = snapshot(vec![artifact("promoted", SHA, 4_000)], FRESH_AT, quarantine);
    let unrelated = adapt_scan_report_with_registry_at(report(None, 4_000), &same_name, NOW_MS);
    assert!(matches!(
        unrelated.data.artifacts[0].resolution,
        InventoryArtifactResolution::CandidateBySize { .. }
    ));
}

#[test]
fn stale_or_invalid_registry_is_unavailable_but_preserves_local_findings() {
    let stale = snapshot(
        vec![artifact("promoted", SHA, 4_000)],
        "2026-07-01T12:00:00.000Z",
        vec![],
    );
    let result = adapt_scan_report_with_registry_at(report(Some(SHA), 4_000), &stale, NOW_MS);
    assert_eq!(result.status, InventoryStatus::Unavailable);
    assert_eq!(result.data.artifacts.len(), 1);
    assert_eq!(result.data.artifacts[0].path, "C:/models/model-Q4_K_M.gguf");
    assert_unavailable(&result, "registry.snapshot-not-fresh");

    let invalid = adapt_scan_report_with_registry_at(report(Some(SHA), 4_000), "{}", NOW_MS);
    assert_eq!(invalid.status, InventoryStatus::Unavailable);
    assert_eq!(invalid.data.artifacts.len(), 1);
    assert_unavailable(&invalid, "registry.snapshot-invalid");
}

#[test]
fn per_file_errors_and_truncation_produce_partial_without_erasing_results() {
    let registry = snapshot(vec![artifact("promoted", SHA, 4_000)], FRESH_AT, vec![]);
    let mut scan = report(Some(SHA), 4_000);
    scan.stores[0].truncated = true;
    scan.unreadable.push(UnreadableEntry {
        path: "C:/models/broken.gguf".into(),
        reason: "permission denied".into(),
    });
    let result = adapt_scan_report_with_registry_at(scan, &registry, NOW_MS);
    assert_eq!(result.status, InventoryStatus::Partial);
    assert_eq!(result.data.artifacts.len(), 1);
    assert_eq!(result.data.unreadable.len(), 1);
    assert!(matches!(
        result.data.artifacts[0].resolution,
        InventoryArtifactResolution::Verified { .. }
    ));
    assert_eq!(result.warnings.len(), 2);
}

#[test]
fn generated_registry_crosses_the_same_promoted_identity_boundary() {
    let (artifact_id, sha256, bytes) = admitted_identities()
        .into_iter()
        .next()
        .expect("generated registry has an admitted identity");
    let mut scan = report(Some(&sha256), bytes);
    scan.artifacts[0].label = "generated-registry-artifact".into();
    scan.artifacts[0].path = "C:/models/generated-registry-artifact".into();
    let result = adapt_scan_report(scan);
    assert_eq!(result.status, InventoryStatus::Ok);
    let InventoryArtifactResolution::Verified { identity } = &result.data.artifacts[0].resolution
    else {
        panic!("generated promoted identity must verify");
    };
    assert_eq!(identity.artifact.artifact_id, artifact_id);
    assert_eq!(identity.artifact.sha256, sha256);
    assert_eq!(identity.artifact.bytes, bytes);
}

#[test]
fn generated_duplicate_identity_groups_never_verify_arbitrarily() {
    let mut groups: HashMap<(String, u64), Vec<String>> = HashMap::new();
    for (artifact_id, sha256, bytes) in admitted_identities() {
        groups.entry((sha256, bytes)).or_default().push(artifact_id);
    }
    let ((sha256, bytes), expected_ids) = groups
        .into_iter()
        .find(|(_, ids)| ids.len() > 1)
        .expect("generated registry keeps at least one duplicate content group explicit");
    let mut scan = report(Some(&sha256), bytes);
    scan.duplicate_groups = vec![vec![
        "C:/models/duplicate-a.gguf".into(),
        "C:/models/duplicate-b.gguf".into(),
    ]];
    let result = adapt_scan_report(scan);
    assert_eq!(result.status, InventoryStatus::Partial);
    let InventoryArtifactResolution::AmbiguousIdentity {
        candidates,
        reason_code,
        ..
    } = &result.data.artifacts[0].resolution
    else {
        panic!("duplicate promoted identities must remain explicitly ambiguous");
    };
    assert_eq!(reason_code, "inventory.identity-ambiguous");
    let mut actual_ids: Vec<_> = candidates
        .iter()
        .map(|candidate| candidate.artifact.artifact_id.clone())
        .collect();
    let mut expected_ids = expected_ids;
    actual_ids.sort();
    expected_ids.sort();
    assert_eq!(actual_ids, expected_ids);
    assert_eq!(result.data.duplicate_groups.len(), 1);
}

#[test]
fn snapshot_requires_complete_m_c_shape_and_admitted_accelerators() {
    let baseline: Value = serde_json::from_str(&snapshot(
        vec![artifact("promoted", SHA, 4_000)],
        FRESH_AT,
        vec![],
    ))
    .unwrap();
    for field in [
        "generatedAt",
        "quarantine",
        "accelerators",
        "compatibilityAssertions",
    ] {
        let mut malformed = baseline.clone();
        malformed.as_object_mut().unwrap().remove(field);
        assert_snapshot_invalid(malformed);
    }

    let mut malformed = baseline.clone();
    malformed["generatedAt"] = json!("not-a-timestamp");
    assert_snapshot_invalid(malformed);

    let mut malformed = baseline.clone();
    malformed["accelerators"] = json!([{
        "id": "gpu-1",
        "canonicalName": "GPU",
        "aliases": [],
        "variants": [],
        "supportedBackends": [],
        "source": {
            "sourceUrl": "https://example.invalid/gpu",
            "retrievedAt": FRESH_AT,
            "kind": "hub-api"
        }
    }]);
    assert_snapshot_invalid(malformed);

    let mut malformed = baseline;
    malformed["compatibilityAssertions"] = json!({});
    assert_snapshot_invalid(malformed);
}

#[test]
fn complete_nonempty_accelerator_compatibility_and_quarantine_shapes_are_admitted() {
    let mut baseline: Value = serde_json::from_str(&snapshot(
        vec![artifact("promoted", SHA, 4_000)],
        FRESH_AT,
        vec![json!({
            "repository": "publisher/repository",
            "revision": "b".repeat(40),
            "fileName": "rejected-Q4_K_M.gguf",
            "code": "missing-license",
            "reason": "License missing",
            "sourceUrl": "https://example.invalid/quarantine",
            "recordedAt": FRESH_AT
        })],
    ))
    .unwrap();
    baseline["accelerators"] = json!([{
        "id": "nvidia-test",
        "vendor": "nvidia",
        "canonicalName": "NVIDIA Test GPU",
        "aliases": ["Test GPU"],
        "variants": [{
            "id": "nvidia-test-8gb",
            "label": "8 GB desktop",
            "memoryBytes": 8_000_000_000_u64,
            "formFactor": "desktop",
            "sourceUrl": "https://example.invalid/gpu/variant"
        }],
        "supportedBackends": ["cuda"],
        "source": {
            "sourceUrl": "https://example.invalid/gpu",
            "retrievedAt": FRESH_AT,
            "kind": "schema-constant"
        }
    }]);
    baseline["compatibilityAssertions"] = json!([{
        "artifactId": "publisher/repository/model-Q4_K_M.gguf@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "productId": "ollama",
        "engineId": "llama.cpp",
        "status": "documented",
        "runtimeConstraint": {
            "minVersion": "0.5",
            "maxVersion": "1.0.0",
            "exactBuild": "build-123"
        },
        "conditions": {
            "operatingSystems": ["windows"],
            "cpuArchitectures": ["x86_64"],
            "backends": ["cuda"],
            "modelArchitectures": ["test"],
            "packageLayouts": ["gguf-single"],
            "quantizationSchemes": ["Q4_K_M"],
            "requiredFiles": ["model-Q4_K_M.gguf"],
            "limitations": ["illustrative structural fixture"]
        },
        "evidence": [{
            "url": "not-runtime-validated-by-typescript",
            "checkedAt": "declared-as-string",
            "sourceRevision": "source-revision"
        }]
    }]);

    let result =
        adapt_scan_report_with_registry_at(report(Some(SHA), 4_000), &baseline.to_string(), NOW_MS);
    assert_eq!(result.status, InventoryStatus::Ok);
    assert!(matches!(
        result.data.artifacts[0].resolution,
        InventoryArtifactResolution::Verified { .. }
    ));
}

#[test]
fn declared_registry_fields_and_enums_fail_closed_when_malformed() {
    let mut baseline: Value = serde_json::from_str(&snapshot(
        vec![artifact("promoted", SHA, 4_000)],
        FRESH_AT,
        vec![],
    ))
    .unwrap();
    baseline["accelerators"] = json!([{
        "id": "nvidia-test",
        "vendor": "nvidia",
        "canonicalName": "NVIDIA Test GPU",
        "aliases": ["Test GPU"],
        "variants": [{
            "id": "nvidia-test-8gb",
            "label": "8 GB desktop",
            "memoryBytes": 8_000_000_000_u64,
            "formFactor": "desktop",
            "sourceUrl": "https://example.invalid/gpu/variant"
        }],
        "supportedBackends": ["cuda"],
        "source": {
            "sourceUrl": "https://example.invalid/gpu",
            "retrievedAt": FRESH_AT,
            "kind": "hub-api"
        }
    }]);
    baseline["compatibilityAssertions"] = json!([{
        "artifactId": "artifact",
        "productId": "ollama",
        "engineId": "llama.cpp",
        "status": "documented",
        "runtimeConstraint": { "minVersion": "1.0" },
        "conditions": {
            "backends": ["cuda"],
            "packageLayouts": ["gguf-single"]
        },
        "evidence": []
    }]);

    for path in ["vendor", "aliases"] {
        let mut malformed = baseline.clone();
        malformed["accelerators"][0]
            .as_object_mut()
            .unwrap()
            .remove(path);
        assert_snapshot_invalid(malformed);
    }
    for path in ["label", "formFactor"] {
        let mut malformed = baseline.clone();
        malformed["accelerators"][0]["variants"][0]
            .as_object_mut()
            .unwrap()
            .remove(path);
        assert_snapshot_invalid(malformed);
    }
    for path in [
        "artifactId",
        "productId",
        "engineId",
        "status",
        "runtimeConstraint",
        "conditions",
        "evidence",
    ] {
        let mut malformed = baseline.clone();
        malformed["compatibilityAssertions"][0]
            .as_object_mut()
            .unwrap()
            .remove(path);
        assert_snapshot_invalid(malformed);
    }
    for path in ["url", "checkedAt"] {
        let mut malformed = baseline.clone();
        malformed["compatibilityAssertions"][0]["evidence"] = json!([{
            "url": "source",
            "checkedAt": "checked"
        }]);
        malformed["compatibilityAssertions"][0]["evidence"][0]
            .as_object_mut()
            .unwrap()
            .remove(path);
        assert_snapshot_invalid(malformed);
    }

    for (pointer, invalid) in [
        ("/accelerators/0/vendor", json!("unknown")),
        ("/accelerators/0/variants/0/formFactor", json!("handheld")),
        ("/compatibilityAssertions/0/productId", json!("unknown")),
        ("/compatibilityAssertions/0/engineId", json!("unknown")),
        ("/compatibilityAssertions/0/status", json!("unknown-status")),
        (
            "/compatibilityAssertions/0/conditions/backends",
            json!(["unknown"]),
        ),
        (
            "/compatibilityAssertions/0/conditions/packageLayouts",
            json!(["unknown"]),
        ),
    ] {
        let mut malformed = baseline.clone();
        *malformed.pointer_mut(pointer).unwrap_or_else(|| {
            panic!("test fixture pointer must exist before mutation: {pointer}")
        }) = invalid;
        assert_snapshot_invalid(malformed);
    }

    let mut null_constraint = baseline.clone();
    null_constraint["compatibilityAssertions"][0]["runtimeConstraint"]["minVersion"] = Value::Null;
    assert_snapshot_invalid(null_constraint);

    let mut null_condition = baseline.clone();
    null_condition["compatibilityAssertions"][0]["conditions"]["backends"] = Value::Null;
    assert_snapshot_invalid(null_condition);

    let mut numeric_version = baseline.clone();
    numeric_version["compatibilityAssertions"][0]["runtimeConstraint"]["minVersion"] = json!(1);
    assert_snapshot_invalid(numeric_version);

    let mut scalar_condition = baseline.clone();
    scalar_condition["compatibilityAssertions"][0]["conditions"]["operatingSystems"] =
        json!("windows");
    assert_snapshot_invalid(scalar_condition);

    let mut null_source_revision = baseline.clone();
    null_source_revision["compatibilityAssertions"][0]["evidence"] = json!([{
        "url": "source",
        "checkedAt": "checked",
        "sourceRevision": null
    }]);
    assert_snapshot_invalid(null_source_revision);

    let mut null_quarantine_file = baseline;
    null_quarantine_file["quarantine"] = json!([{
        "repository": "publisher/repository",
        "revision": "b".repeat(40),
        "fileName": null,
        "code": "missing-license",
        "reason": "License missing",
        "sourceUrl": "https://example.invalid/quarantine",
        "recordedAt": FRESH_AT
    }]);
    assert_snapshot_invalid(null_quarantine_file);
}

#[test]
fn malformed_urls_and_non_gguf_filenames_fail_m_c_admission() {
    let mut bad_filename = artifact("promoted", SHA, 4_000);
    bad_filename["fileName"] = json!("model-Q4_K_M.bin");
    assert_snapshot_invalid(
        serde_json::from_str(&snapshot(vec![bad_filename], FRESH_AT, vec![])).unwrap(),
    );

    let mut bad_license_url = artifact("promoted", SHA, 4_000);
    bad_license_url["license"]["sourceUrl"] = json!("https://[::1");
    assert_snapshot_invalid(
        serde_json::from_str(&snapshot(vec![bad_license_url], FRESH_AT, vec![])).unwrap(),
    );

    let mut bad_provenance_url = artifact("promoted", SHA, 4_000);
    bad_provenance_url["provenance"]["sha256"]["sourceUrl"] = json!("http://[invalid");
    assert_snapshot_invalid(
        serde_json::from_str(&snapshot(vec![bad_provenance_url], FRESH_AT, vec![])).unwrap(),
    );
}

fn assert_snapshot_invalid(snapshot: Value) {
    let result =
        adapt_scan_report_with_registry_at(report(Some(SHA), 4_000), &snapshot.to_string(), NOW_MS);
    assert_eq!(result.status, InventoryStatus::Unavailable);
    assert_unavailable(&result, "registry.snapshot-invalid");
}

fn assert_unavailable(result: &runner_lib::model_store::inventory::InventoryResult, code: &str) {
    let InventoryArtifactResolution::Unavailable { reason_code, .. } =
        &result.data.artifacts[0].resolution
    else {
        panic!("expected unavailable resolution");
    };
    assert_eq!(reason_code, code);
}

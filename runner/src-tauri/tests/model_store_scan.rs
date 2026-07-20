//! Integration tests for the R3 read-only model-store scan. Fixtures are
//! built in a temp directory; the scan module itself contains no write APIs
//! (enforced separately by tests/runner-boundary.test.mjs at the repo root).

use runner_lib::model_store::{admitted_identities, scan, RegistryMatch};
use std::fs;
use std::path::PathBuf;

struct FixtureHome {
    root: PathBuf,
}

impl FixtureHome {
    fn new(tag: &str) -> Self {
        let root =
            std::env::temp_dir().join(format!("la-runner-scan-{tag}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        Self { root }
    }

    fn write(&self, relative: &str, contents: &str) -> PathBuf {
        let path = self.root.join(relative);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, contents).unwrap();
        path
    }
}

impl Drop for FixtureHome {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn ollama_manifest(digest: &str) -> String {
    format!(
        r#"{{"schemaVersion":2,"layers":[
            {{"mediaType":"application/vnd.ollama.image.model","digest":"sha256:{digest}","size":4}},
            {{"mediaType":"application/vnd.ollama.image.template","digest":"sha256:aaaa","size":4}}
        ]}}"#
    )
}

#[test]
fn scans_ollama_lmstudio_and_extra_directories() {
    let home = FixtureHome::new("full");
    let digest = "e".repeat(64);
    home.write(
        ".ollama/models/manifests/registry.ollama.ai/library/qwen3/latest",
        &ollama_manifest(&digest),
    );
    home.write(&format!(".ollama/models/blobs/sha256-{digest}"), "gguf");
    home.write(".lmstudio/models/publisher/repo/model.gguf", "gguf-bytes");
    home.write(".lmstudio/models/publisher/repo/notes.txt", "ignored");
    let extra = home.root.join("loose");
    home.write("loose/local-model.gguf", "gguf-bytes-2");

    let report = scan(&home.root, &[extra]);

    assert_eq!(report.provenance, "scanned-locally");
    let stores: Vec<&str> = report
        .artifacts
        .iter()
        .map(|artifact| artifact.store.as_str())
        .collect();
    assert!(stores.contains(&"ollama"));
    assert!(stores.contains(&"lm-studio"));
    assert!(stores.contains(&"directory"));
    assert_eq!(report.artifacts.len(), 3, "the .txt file must be ignored");

    let ollama = report
        .artifacts
        .iter()
        .find(|artifact| artifact.store == "ollama")
        .unwrap();
    assert_eq!(ollama.sha256.as_deref(), Some(digest.as_str()));
    assert_eq!(ollama.label, "registry.ollama.ai/library/qwen3/latest");
    let loose = report
        .artifacts
        .iter()
        .find(|artifact| artifact.store == "directory")
        .unwrap();
    assert_eq!(
        loose.sha256, None,
        "loose files are never assigned a hash without hashing"
    );
}

#[test]
fn ollama_blob_digest_matching_registry_is_verified() {
    let (artifact_id, sha256, _) = admitted_identities()
        .into_iter()
        .next()
        .expect("registry has identities");
    let home = FixtureHome::new("verified");
    home.write(
        ".ollama/models/manifests/registry.ollama.ai/library/known/latest",
        &ollama_manifest(&sha256),
    );
    home.write(&format!(".ollama/models/blobs/sha256-{sha256}"), "x");

    let report = scan(&home.root, &[]);
    let found = report
        .artifacts
        .iter()
        .find(|artifact| artifact.store == "ollama")
        .unwrap();
    match &found.registry_match {
        RegistryMatch::Verified {
            artifact_id: matched,
        } => assert_eq!(matched, &artifact_id),
        other => panic!("digest equal to an admitted artifact must verify, got {other:?}"),
    }
}

#[test]
fn size_only_match_stays_candidate_never_verified() {
    let (_, _, size) = admitted_identities()
        .into_iter()
        .min_by_key(|(_, _, size)| *size)
        .expect("registry has identities");
    let home = FixtureHome::new("candidate");
    let path = home.root.join("loose/sized.gguf");
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    let file = fs::File::create(&path).unwrap();
    file.set_len(size).unwrap();

    let report = scan(&home.root, &[home.root.join("loose")]);
    let found = report
        .artifacts
        .iter()
        .find(|artifact| artifact.store == "directory")
        .unwrap();
    match &found.registry_match {
        RegistryMatch::CandidateBySize { artifact_ids } => assert!(!artifact_ids.is_empty()),
        other => panic!("size-only equality must stay a candidate, got {other:?}"),
    }
}

#[test]
fn malformed_manifests_and_missing_blobs_are_listed_not_skipped() {
    let home = FixtureHome::new("unreadable");
    home.write(
        ".ollama/models/manifests/registry.ollama.ai/library/broken/latest",
        "{ not json",
    );
    let dangling = "d".repeat(64);
    home.write(
        ".ollama/models/manifests/registry.ollama.ai/library/dangling/latest",
        &ollama_manifest(&dangling),
    );

    let report = scan(&home.root, &[]);
    assert!(report
        .unreadable
        .iter()
        .any(|entry| entry.reason.contains("not valid JSON")));
    assert!(report
        .unreadable
        .iter()
        .any(|entry| entry.reason.contains("missing blob")));
    assert!(report.artifacts.is_empty());
}

#[test]
fn duplicates_group_by_digest_and_by_size() {
    let home = FixtureHome::new("dupes");
    let digest = "f".repeat(64);
    for name in ["a", "b"] {
        home.write(
            &format!(".ollama/models/manifests/registry.ollama.ai/library/{name}/latest"),
            &ollama_manifest(&digest),
        );
    }
    home.write(&format!(".ollama/models/blobs/sha256-{digest}"), "shared");
    home.write("loose/one.gguf", "same-size!");
    home.write("loose/two.gguf", "same-size?");

    let report = scan(&home.root, &[home.root.join("loose")]);
    assert_eq!(
        report.duplicate_groups.len(),
        2,
        "one digest group and one size group expected"
    );
}

#[test]
fn live_scan_of_real_home_is_read_only_and_sane() {
    let home = std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" })
        .map(PathBuf::from)
        .expect("home directory exists");
    let report = scan(&home, &[]);
    assert_eq!(report.provenance, "scanned-locally");
    assert_eq!(
        report.stores.len(),
        3,
        "three default store locations are always reported"
    );
    println!(
        "live scan: {} artifacts, {} duplicate groups, {} unreadable; stores: {:?}",
        report.artifacts.len(),
        report.duplicate_groups.len(),
        report.unreadable.len(),
        report
            .stores
            .iter()
            .map(|store| format!("{}={}", store.kind, store.exists))
            .collect::<Vec<_>>()
    );
    for artifact in report.artifacts.iter().take(10) {
        println!(
            "  found: [{}] {} ({} bytes)",
            artifact.store, artifact.label, artifact.file_size_bytes
        );
    }
}

#[test]
fn nonexistent_extra_directory_is_reported() {
    let home = FixtureHome::new("missing-dir");
    let report = scan(&home.root, &[home.root.join("does-not-exist")]);
    assert!(report
        .unreadable
        .iter()
        .any(|entry| entry.reason.contains("does not exist")));
    assert!(report
        .stores
        .iter()
        .any(|store| store.kind == "directory" && !store.exists));
}

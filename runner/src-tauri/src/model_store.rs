//! R3: read-only model-store scan (decision-tree Tree F / E1).
//!
//! Contract: runs only on explicit request; reads directories and file
//! metadata only — this module contains no write APIs at all (enforced by
//! `tests/runner-boundary.test.mjs`); results stay on this machine.
//! Identity discipline: a store file's identity is `verified` only via a
//! SHA-256 match against the admitted artifact registry. A size-only match
//! is a `candidate` and is never silently upgraded.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

pub mod inventory;

/// Walk guard: stores can be huge; hitting a cap is reported, never silent.
const MAX_ENTRIES_PER_STORE: usize = 10_000;
const MAX_WALK_DEPTH: usize = 4;

/// Admitted artifact registry, embedded at compile time (same single-source
/// rule as the accelerator registry in `hardware.rs`). Only identity fields
/// are deserialized.
const ARTIFACTS_JSON: &str = include_str!("../../../registry/generated/artifacts.json");

#[derive(Deserialize)]
struct RegistryIndexSnapshot {
    artifacts: Vec<RegistryIndexEntry>,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RegistryIndexEntry {
    id: String,
    sha256: String,
    file_size_bytes: u64,
}

fn registry_index() -> Result<Vec<RegistryIndexEntry>, String> {
    serde_json::from_str::<RegistryIndexSnapshot>(ARTIFACTS_JSON)
        .map(|snapshot| snapshot.artifacts)
        .map_err(|error| format!("embedded artifact registry is invalid: {error}"))
}

/// Read-only view of admitted identities, exposed for integration tests and
/// (later) UI display. `(artifact id, sha256, file size in bytes)`.
pub fn admitted_identities() -> Vec<(String, String, u64)> {
    registry_index()
        .unwrap_or_default()
        .into_iter()
        .map(|entry| (entry.id, entry.sha256, entry.file_size_bytes))
        .collect()
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum RegistryMatch {
    /// SHA-256 equality with an admitted registry artifact.
    #[serde(rename_all = "camelCase")]
    Verified {
        artifact_id: String,
    },
    /// Exact byte-size equality only; identity requires hashing (not run
    /// during a scan — hashing multi-GB files is a separate explicit step).
    #[serde(rename_all = "camelCase")]
    CandidateBySize {
        artifact_ids: Vec<String>,
    },
    None,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FoundArtifact {
    pub path: String,
    pub store: String,
    pub label: String,
    pub file_size_bytes: u64,
    /// Known without reading file contents only when the store names blobs by
    /// digest (Ollama). Loose GGUF files scan with `None`.
    pub sha256: Option<String>,
    pub registry_match: RegistryMatch,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UnreadableEntry {
    pub path: String,
    pub reason: String,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScannedStore {
    pub kind: String,
    pub path: String,
    pub exists: bool,
    pub truncated: bool,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScanReport {
    pub stores: Vec<ScannedStore>,
    pub artifacts: Vec<FoundArtifact>,
    /// Groups sharing a digest (certain duplicates) or an exact byte size
    /// (possible duplicates pending hashing), keyed for display.
    pub duplicate_groups: Vec<Vec<String>>,
    pub unreadable: Vec<UnreadableEntry>,
    pub provenance: &'static str,
}

pub fn default_store_paths(home: &Path) -> Vec<(String, PathBuf)> {
    vec![
        ("ollama".to_string(), home.join(".ollama").join("models")),
        (
            "lm-studio".to_string(),
            home.join(".lmstudio").join("models"),
        ),
        (
            "lm-studio".to_string(),
            home.join(".cache").join("lm-studio").join("models"),
        ),
    ]
}

pub fn scan(home: &Path, extra_directories: &[PathBuf]) -> ScanReport {
    let registry = registry_index().unwrap_or_default();
    let mut stores = Vec::new();
    let mut artifacts = Vec::new();
    let mut unreadable = Vec::new();

    for (kind, path) in default_store_paths(home) {
        let exists = path.is_dir();
        let mut truncated = false;
        if exists {
            if kind == "ollama" {
                scan_ollama(
                    &path,
                    &registry,
                    &mut artifacts,
                    &mut unreadable,
                    &mut truncated,
                );
            } else {
                scan_gguf_tree(
                    &path,
                    &kind,
                    &registry,
                    &mut artifacts,
                    &mut unreadable,
                    &mut truncated,
                );
            }
        }
        stores.push(ScannedStore {
            kind,
            path: path.display().to_string(),
            exists,
            truncated,
        });
    }
    for directory in extra_directories {
        let exists = directory.is_dir();
        let mut truncated = false;
        if exists {
            scan_gguf_tree(
                directory,
                "directory",
                &registry,
                &mut artifacts,
                &mut unreadable,
                &mut truncated,
            );
        } else {
            unreadable.push(UnreadableEntry {
                path: directory.display().to_string(),
                reason: "directory does not exist or is not readable".into(),
            });
        }
        stores.push(ScannedStore {
            kind: "directory".into(),
            path: directory.display().to_string(),
            exists,
            truncated,
        });
    }

    let duplicate_groups = duplicate_groups(&artifacts);
    ScanReport {
        stores,
        artifacts,
        duplicate_groups,
        unreadable,
        provenance: "scanned-locally",
    }
}

fn duplicate_groups(artifacts: &[FoundArtifact]) -> Vec<Vec<String>> {
    let mut by_digest: BTreeMap<String, Vec<String>> = BTreeMap::new();
    let mut by_size: BTreeMap<u64, Vec<String>> = BTreeMap::new();
    for artifact in artifacts {
        match &artifact.sha256 {
            Some(digest) => by_digest
                .entry(digest.clone())
                .or_default()
                .push(artifact.path.clone()),
            None => by_size
                .entry(artifact.file_size_bytes)
                .or_default()
                .push(artifact.path.clone()),
        }
    }
    by_digest
        .into_values()
        .chain(by_size.into_values())
        .filter(|group| group.len() > 1)
        .collect()
}

fn match_registry(
    registry: &[RegistryIndexEntry],
    sha256: Option<&str>,
    size: u64,
) -> RegistryMatch {
    if let Some(digest) = sha256 {
        if let Some(entry) = registry
            .iter()
            .find(|entry| entry.sha256.eq_ignore_ascii_case(digest))
        {
            return RegistryMatch::Verified {
                artifact_id: entry.id.clone(),
            };
        }
    }
    let by_size: Vec<String> = registry
        .iter()
        .filter(|entry| entry.file_size_bytes == size)
        .map(|entry| entry.id.clone())
        .collect();
    if by_size.is_empty() {
        RegistryMatch::None
    } else {
        RegistryMatch::CandidateBySize {
            artifact_ids: by_size,
        }
    }
}

/// Ollama layout: `models/manifests/<registry>/<ns>/<model>/<tag>` JSON files
/// whose model layer digest names a file under `models/blobs/sha256-<hex>`.
/// Read as plain files — the Ollama application is never invoked (I4).
fn scan_ollama(
    root: &Path,
    registry: &[RegistryIndexEntry],
    artifacts: &mut Vec<FoundArtifact>,
    unreadable: &mut Vec<UnreadableEntry>,
    truncated: &mut bool,
) {
    #[derive(Deserialize)]
    struct Manifest {
        layers: Vec<Layer>,
    }
    #[derive(Deserialize)]
    struct Layer {
        #[serde(rename = "mediaType")]
        media_type: String,
        digest: String,
    }

    let manifest_root = root.join("manifests");
    // A store root without a manifests directory is an installed-but-empty
    // Ollama — a normal state, not an unreadable entry.
    if !manifest_root.is_dir() {
        return;
    }
    let mut manifest_paths = Vec::new();
    collect_files(
        &manifest_root,
        MAX_WALK_DEPTH + 2,
        &mut manifest_paths,
        unreadable,
        truncated,
    );
    for manifest_path in manifest_paths {
        let text = match std::fs::read_to_string(&manifest_path) {
            Ok(text) => text,
            Err(error) => {
                unreadable.push(UnreadableEntry {
                    path: manifest_path.display().to_string(),
                    reason: format!("manifest unreadable: {error}"),
                });
                continue;
            }
        };
        let manifest: Manifest = match serde_json::from_str(&text) {
            Ok(manifest) => manifest,
            Err(error) => {
                unreadable.push(UnreadableEntry {
                    path: manifest_path.display().to_string(),
                    reason: format!("manifest is not valid JSON: {error}"),
                });
                continue;
            }
        };
        let label = manifest_path
            .strip_prefix(&manifest_root)
            .map(|relative| relative.display().to_string().replace('\\', "/"))
            .unwrap_or_else(|_| manifest_path.display().to_string());
        for layer in manifest
            .layers
            .iter()
            .filter(|layer| layer.media_type.ends_with("image.model"))
        {
            let Some(hex) = layer.digest.strip_prefix("sha256:") else {
                unreadable.push(UnreadableEntry {
                    path: manifest_path.display().to_string(),
                    reason: format!("unsupported digest format: {}", layer.digest),
                });
                continue;
            };
            let blob = root.join("blobs").join(format!("sha256-{hex}"));
            match std::fs::metadata(&blob) {
                Ok(metadata) => {
                    let size = metadata.len();
                    artifacts.push(FoundArtifact {
                        path: blob.display().to_string(),
                        store: "ollama".into(),
                        label: label.clone(),
                        file_size_bytes: size,
                        sha256: Some(hex.to_lowercase()),
                        registry_match: match_registry(registry, Some(hex), size),
                    });
                }
                Err(error) => unreadable.push(UnreadableEntry {
                    path: blob.display().to_string(),
                    reason: format!("manifest references missing blob: {error}"),
                }),
            }
        }
    }
}

fn scan_gguf_tree(
    root: &Path,
    store: &str,
    registry: &[RegistryIndexEntry],
    artifacts: &mut Vec<FoundArtifact>,
    unreadable: &mut Vec<UnreadableEntry>,
    truncated: &mut bool,
) {
    let mut files = Vec::new();
    collect_files(root, MAX_WALK_DEPTH, &mut files, unreadable, truncated);
    for file in files {
        let is_gguf = file
            .extension()
            .map(|extension| extension.eq_ignore_ascii_case("gguf"))
            .unwrap_or(false);
        if !is_gguf {
            continue;
        }
        match std::fs::metadata(&file) {
            Ok(metadata) => {
                let size = metadata.len();
                artifacts.push(FoundArtifact {
                    path: file.display().to_string(),
                    store: store.to_string(),
                    label: file
                        .file_name()
                        .map(|name| name.to_string_lossy().to_string())
                        .unwrap_or_default(),
                    file_size_bytes: size,
                    sha256: None,
                    registry_match: match_registry(registry, None, size),
                });
            }
            Err(error) => unreadable.push(UnreadableEntry {
                path: file.display().to_string(),
                reason: format!("metadata unreadable: {error}"),
            }),
        }
    }
}

fn collect_files(
    root: &Path,
    depth: usize,
    out: &mut Vec<PathBuf>,
    unreadable: &mut Vec<UnreadableEntry>,
    truncated: &mut bool,
) {
    if depth == 0 || out.len() >= MAX_ENTRIES_PER_STORE {
        if out.len() >= MAX_ENTRIES_PER_STORE {
            *truncated = true;
        }
        return;
    }
    let entries = match std::fs::read_dir(root) {
        Ok(entries) => entries,
        Err(error) => {
            unreadable.push(UnreadableEntry {
                path: root.display().to_string(),
                reason: format!("directory unreadable: {error}"),
            });
            return;
        }
    };
    for entry in entries {
        if out.len() >= MAX_ENTRIES_PER_STORE {
            *truncated = true;
            return;
        }
        match entry {
            Ok(entry) => {
                let path = entry.path();
                if path.is_dir() {
                    collect_files(&path, depth - 1, out, unreadable, truncated);
                } else {
                    out.push(path);
                }
            }
            Err(error) => unreadable.push(UnreadableEntry {
                path: root.display().to_string(),
                reason: format!("entry unreadable: {error}"),
            }),
        }
    }
}

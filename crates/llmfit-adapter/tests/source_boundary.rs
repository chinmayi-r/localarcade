use std::fs;
use std::path::PathBuf;

#[test]
fn adapter_source_excludes_unsafe_upstream_paths() {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let source = read_rust_sources(&manifest.join("src"));
    let forbidden = [
        "build_model_fits",
        "InstalledIndex",
        "LocalBenchIndex",
        "CommunityBenchIndex",
        "MeasuredTpsIndex",
        "SystemSpecs::detect",
        "ModelDatabase::new",
        "analyze_with_forced_runtime",
        "rank_models",
        "providers::",
        "benchmarks::",
        "bench::",
        "share::",
        "update::",
        "quality::",
        "plan::",
        "std::env",
        "std::fs",
        "std::net",
        "std::process",
        "ureq",
        "reqwest",
        "http::",
        "dirs::",
        "which::",
        "llmfit_core::*",
        "unsafe ",
        "tauri::command",
        "extern \"C\"",
        "no_mangle",
        "ipc",
        "ffi::",
        ".score",
        "score_components",
        "measured_tps",
        ".installed",
    ];
    for symbol in forbidden {
        assert!(
            !source.contains(symbol),
            "adapter source must not use unsafe upstream path {symbol}"
        );
    }
}

fn read_rust_sources(directory: &std::path::Path) -> String {
    let mut source = String::new();
    for entry in fs::read_dir(directory).expect("read source directory") {
        let path = entry.expect("read source entry").path();
        if path.is_dir() {
            source.push_str(&read_rust_sources(&path));
        } else if path.extension().is_some_and(|extension| extension == "rs") {
            source.push_str(&fs::read_to_string(path).expect("read Rust source"));
        }
    }
    source
}

#[test]
fn dependency_is_exactly_pinned_and_notice_is_retained() {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let cargo = fs::read_to_string(manifest.join("Cargo.toml")).expect("read manifest");
    assert!(cargo.contains("version = \"=1.1.6\""));
    assert!(cargo.contains("rev = \"aaa2bc179cec214ccdc44501c853b98fba0b343b\""));
    let lock = fs::read_to_string(manifest.join("Cargo.lock")).expect("read lockfile");
    assert!(lock.contains("name = \"llmfit-core\"\nversion = \"1.1.6\""));
    assert!(lock.contains(
        "git+https://github.com/AlexsJones/llmfit?rev=aaa2bc179cec214ccdc44501c853b98fba0b343b#aaa2bc179cec214ccdc44501c853b98fba0b343b"
    ));

    let notice =
        fs::read_to_string(manifest.join("LICENSES/llmfit-MIT.txt")).expect("read MIT notice");
    assert!(notice.contains("Copyright (c) 2026 Alex Jones"));
    assert!(notice.contains("Permission is hereby granted"));
}

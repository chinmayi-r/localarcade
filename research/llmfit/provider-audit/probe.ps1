[CmdletBinding()]
param(
    [string]$Repository = "https://github.com/AlexsJones/llmfit.git",
    [string]$Revision = "aaa2bc179cec214ccdc44501c853b98fba0b343b"
)

$ErrorActionPreference = "Stop"
$audit = $PSScriptRoot
$scratch = Join-Path $audit ".probe-source"
$target = Join-Path $audit ".probe-target"
$sandbox = Join-Path $audit ".probe-home"
$utf8 = [System.Text.UTF8Encoding]::new($false)

function Invoke-Captured {
    param(
        [Parameter(Mandatory)][string]$File,
        [Parameter(Mandatory)][string[]]$Arguments,
        [Parameter(Mandatory)][string]$StdoutPath,
        [Parameter(Mandatory)][string]$StderrPath
    )

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $File
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    foreach ($argument in $Arguments) {
        $startInfo.ArgumentList.Add($argument)
    }

    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    if (-not $process.Start()) {
        throw "Failed to start $File"
    }
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    [System.IO.File]::WriteAllText($StdoutPath, $stdout, $utf8)
    [System.IO.File]::WriteAllText($StderrPath, $stderr, $utf8)
    return $process.ExitCode
}

foreach ($path in @($scratch, $target, $sandbox)) {
    $resolvedParent = [IO.Path]::GetFullPath((Split-Path -Parent $path))
    if ($resolvedParent -ne [IO.Path]::GetFullPath($audit)) {
        throw "Refusing to use scratch path outside the provider audit: $path"
    }
}

if (Test-Path -LiteralPath $scratch) {
    throw "Scratch source already exists: $scratch"
}

$original = @{}
foreach ($name in @(
    "APPDATA", "CARGO_HOME", "CARGO_TARGET_DIR", "DOCKER_MODEL_RUNNER_HOST",
    "HF_HOME", "HOME", "LLMFIT_BENCH_STORE", "LM_STUDIO_HOST",
    "LOCALAPPDATA", "MLX_LM_HOST", "OLLAMA_HOST", "OMLX_HOST",
    "RAMALAMA_HOST", "RUSTUP_HOME", "USERPROFILE", "VLLM_HOST",
    "XDG_CACHE_HOME", "XDG_CONFIG_HOME", "XDG_DATA_HOME"
)) {
    $original[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}

try {
    git clone --filter=blob:none --no-checkout $Repository $scratch
    if ($LASTEXITCODE -ne 0) { throw "git clone failed" }
    git -C $scratch checkout --detach $Revision
    if ($LASTEXITCODE -ne 0) { throw "git checkout failed" }

    $actual = (git -C $scratch rev-parse HEAD).Trim()
    if ($actual -ne $Revision) {
        throw "Revision mismatch: expected $Revision, got $actual"
    }

    $sourceFiles = @(
        "LICENSE",
        "Cargo.lock",
        "llmfit-core/src/analysis.rs",
        "llmfit-tui/src/main.rs",
        "llmfit-tui/src/display.rs"
    )
    $sourceHashes = foreach ($relativePath in $sourceFiles) {
        $sourcePath = Join-Path $scratch ($relativePath -replace "/", "\")
        [ordered]@{
            path = $relativePath
            sha256 = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }
    $sourceHashJson = $sourceHashes | ConvertTo-Json
    [System.IO.File]::WriteAllText(
        (Join-Path $audit "raw-source-hashes.json"),
        "$sourceHashJson`n",
        $utf8
    )
    [System.IO.File]::Copy(
        (Join-Path $scratch "LICENSE"),
        (Join-Path $audit "UPSTREAM-LICENSE.txt"),
        $true
    )

    $realUser = $env:USERPROFILE
    $env:CARGO_HOME = Join-Path $realUser ".cargo"
    $env:RUSTUP_HOME = Join-Path $realUser ".rustup"
    $env:CARGO_TARGET_DIR = $target
    $env:HOME = $sandbox
    $env:USERPROFILE = $sandbox
    $env:APPDATA = Join-Path $sandbox "AppData\Roaming"
    $env:LOCALAPPDATA = Join-Path $sandbox "AppData\Local"
    $env:XDG_CONFIG_HOME = Join-Path $sandbox "xdg-config"
    $env:XDG_CACHE_HOME = Join-Path $sandbox "xdg-cache"
    $env:XDG_DATA_HOME = Join-Path $sandbox "xdg-data"
    $env:HF_HOME = Join-Path $sandbox "hf"
    $env:LLMFIT_BENCH_STORE = Join-Path $sandbox "bench"

    # Force all provider discovery toward an unused loopback port. The probe
    # exercises advisory output only; it never benchmarks, downloads, or shares.
    foreach ($name in @(
        "DOCKER_MODEL_RUNNER_HOST", "LM_STUDIO_HOST", "MLX_LM_HOST",
        "OLLAMA_HOST", "OMLX_HOST", "RAMALAMA_HOST", "VLLM_HOST"
    )) {
        [Environment]::SetEnvironmentVariable(
            $name,
            "http://127.0.0.1:65530",
            "Process"
        )
    }

    New-Item -ItemType Directory -Force @(
        $env:APPDATA, $env:LOCALAPPDATA, $env:XDG_CONFIG_HOME,
        $env:XDG_CACHE_HOME, $env:XDG_DATA_HOME, $env:HF_HOME,
        $env:LLMFIT_BENCH_STORE
    ) | Out-Null

    cargo build --locked --manifest-path (Join-Path $scratch "Cargo.toml") -p llmfit
    if ($LASTEXITCODE -ne 0) { throw "cargo build failed" }

    $binary = Join-Path $target "debug\llmfit.exe"
    $versionExit = Invoke-Captured -File $binary -Arguments @("--version") `
        -StdoutPath (Join-Path $audit "raw-version.txt") `
        -StderrPath (Join-Path $audit "raw-version.stderr.txt")
    $common = @(
        "--memory", "12G", "--ram", "32G", "--cpu-cores", "16",
        "--max-context", "16384"
    )
    $systemExit = Invoke-Captured -File $binary `
        -Arguments ($common + @("system", "--json")) `
        -StdoutPath (Join-Path $audit "raw-system.json") `
        -StderrPath (Join-Path $audit "raw-system.stderr.txt")
    $recommendExit = Invoke-Captured -File $binary `
        -Arguments ($common + @(
            "recommend", "--limit", "3", "--use-case", "coding",
            "--min-fit", "marginal", "--runtime", "llamacpp", "--json"
        )) `
        -StdoutPath (Join-Path $audit "raw-recommend-coding.json") `
        -StderrPath (Join-Path $audit "raw-recommend-coding.stderr.txt")
    $invalidExit = Invoke-Captured -File $binary `
        -Arguments ($common + @(
            "recommend", "--limit", "1", "--use-case", "coding",
            "--min-fit", "definitely-invalid", "--runtime",
            "definitely-invalid", "--json"
        )) `
        -StdoutPath (Join-Path $audit "raw-recommend-invalid-enums.json") `
        -StderrPath (Join-Path $audit "raw-recommend-invalid-enums.stderr.txt")

    [ordered]@{
        version = $versionExit
        system = $systemExit
        recommend = $recommendExit
        invalidEnumRecommend = $invalidExit
    } | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $audit "raw-exit-codes.json")
}
finally {
    foreach ($name in $original.Keys) {
        [Environment]::SetEnvironmentVariable($name, $original[$name], "Process")
    }

    # These paths are created by this probe and were checked above to be direct
    # children of the audit directory. Raw outputs remain in the audit folder.
    foreach ($path in @($scratch, $target, $sandbox)) {
        if (Test-Path -LiteralPath $path) {
            Get-ChildItem -LiteralPath $path -Force -Recurse `
                -ErrorAction SilentlyContinue | ForEach-Object {
                    try {
                        $_.Attributes = [System.IO.FileAttributes]::Normal
                    }
                    catch {
                        # Directory deletion below remains authoritative.
                    }
                }
            [System.IO.Directory]::Delete($path, $true)
        }
    }
}

# ============================================================================
# 开发/编译缓存统一到 D 盘，避免 C 盘被 Cursor 沙盒与 Cargo 占满
# GitHub Actions 不启用：CI 使用 job 注入的 CARGO_TARGET_DIR（src-tauri/target）
# ============================================================================

if ($env:GITHUB_ACTIONS -eq 'true') {
    return
}

$DevCacheRoot = "D:\DevCache\LuoScope"

$CacheDirectories = @(
    "cargo-target",
    "cargo-home",
    "npm-cache",
    "temp",
    "cursor-sandbox-cache"
)

foreach ($DirectoryName in $CacheDirectories) {
    $DirectoryPath = Join-Path $DevCacheRoot $DirectoryName
    if (-not (Test-Path $DirectoryPath)) {
        New-Item -ItemType Directory -Path $DirectoryPath -Force | Out-Null
    }
}

# Rust 编译产物与依赖缓存
$env:CARGO_TARGET_DIR = Join-Path $DevCacheRoot "cargo-target"
$env:CARGO_HOME = Join-Path $DevCacheRoot "cargo-home"
$env:NPM_CONFIG_CACHE = Join-Path $DevCacheRoot "npm-cache"
$env:TMP = Join-Path $DevCacheRoot "temp"
$env:TEMP = Join-Path $DevCacheRoot "temp"

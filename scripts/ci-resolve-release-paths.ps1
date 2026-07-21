# ============================================================================
# GitHub Actions 专用：解析 Tauri Windows 编译产物路径
# GITHUB_ENV 只能写正斜杠路径；文件读写需用 GetFullPath 后的本地路径
# ============================================================================

$script:CiTargetRoot = [IO.Path]::GetFullPath((Join-Path $env:GITHUB_WORKSPACE 'src-tauri/target'))
$script:CiReleaseDir = [IO.Path]::GetFullPath((Join-Path $script:CiTargetRoot 'release'))
$script:CiNsisDir = [IO.Path]::GetFullPath((Join-Path $script:CiReleaseDir 'bundle/nsis'))

function Get-LuoScopeReleaseExe {
    $candidates = @(
        (Join-Path $script:CiReleaseDir 'LuoScope.exe'),
        (Join-Path $script:CiTargetRoot 'x86_64-pc-windows-msvc/release/LuoScope.exe')
    )

    foreach ($candidatePath in $candidates) {
        if (Test-Path -LiteralPath $candidatePath) {
            return $candidatePath
        }
    }

    $found = Get-ChildItem -Path $script:CiTargetRoot -Filter 'LuoScope.exe' -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch '\\bundle\\' } |
        Select-Object -First 1

    if ($found) {
        return $found.FullName
    }

    return $null
}

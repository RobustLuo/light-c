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

function Convert-ToReleaseSignature {
    param([string]$SignatureText)

    $trimmed = $SignatureText.Trim()
    if ($trimmed.StartsWith('untrusted comment:')) {
        return [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($trimmed))
    }
    return $trimmed
}

function Write-TauriExeSignatureAsset {
    param(
        [Parameter(Mandatory = $true)][string]$ExecutablePath,
        [Parameter(Mandatory = $true)][string]$OutputSigPath
    )

    if (-not (Test-Path -LiteralPath $ExecutablePath)) {
        throw "Cannot find executable to sign: $ExecutablePath"
    }

    $keyPath = ($env:TAURI_PRIVATE_KEY_PATH -replace '/', '\')
    if ([string]::IsNullOrWhiteSpace($keyPath)) {
        $keyPath = ($env:TAURI_SIGNING_PRIVATE_KEY -replace '/', '\')
    }
    $password = $env:TAURI_PRIVATE_KEY_PASSWORD
    if ([string]::IsNullOrWhiteSpace($password)) {
        $password = $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD
    }

    $generatedSigPath = "$ExecutablePath.sig"
    if (Test-Path -LiteralPath $generatedSigPath) {
        Remove-Item -LiteralPath $generatedSigPath -Force
    }

    $signatureOutput = npx tauri signer sign -f $keyPath -p $password $ExecutablePath 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        throw "Executable signing failed: $ExecutablePath`n$signatureOutput"
    }

    if (Test-Path -LiteralPath $generatedSigPath) {
        $signatureText = [IO.File]::ReadAllText($generatedSigPath, [Text.Encoding]::UTF8)
        $signatureBase64 = Convert-ToReleaseSignature $signatureText
    } else {
        $signatureBase64 = ($signatureOutput -split "`r?`n" | Where-Object { $_ -match '^[A-Za-z0-9+/=]+$' } | Select-Object -Last 1)
    }

    if ([string]::IsNullOrWhiteSpace($signatureBase64)) {
        throw "Signature output not found for: $ExecutablePath"
    }

    $signatureBase64 | Out-File -FilePath $OutputSigPath -Encoding utf8 -NoNewline
    Write-Host "Created signature asset: $OutputSigPath" -ForegroundColor Green
}

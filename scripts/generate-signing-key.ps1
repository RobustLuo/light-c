# ============================================================================
# 生成本地 Tauri 更新签名密钥对（首次发版 / 私钥丢失时使用）
# 用法：在项目根目录执行 .\scripts\generate-signing-key.ps1
# ============================================================================

#Requires -Version 5.1

$ErrorActionPreference = 'Stop'

chcp 65001 | Out-Null
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new()
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [System.Text.UTF8Encoding]::new()

$ProjectRoot = Split-Path $PSScriptRoot -Parent
$PrivateKeyPath = Join-Path $ProjectRoot '.tauri\luoscope.key'
$PublicKeyPath = Join-Path $ProjectRoot '.tauri\luoscope.key.pub'
$TauriConfigPath = Join-Path $ProjectRoot 'src-tauri\tauri.conf.json'

Push-Location $ProjectRoot
try {
    Write-Host '=== LuoScope 签名密钥生成 ===' -ForegroundColor Cyan
    Write-Host ''
    Write-Host '说明：'
    Write-Host '  - 私钥写入 .tauri\luoscope.key（已在 .gitignore，不会提交）'
    Write-Host '  - 公钥写入 .tauri\luoscope.key.pub，并同步到 tauri.conf.json'
    Write-Host '  - 请牢记下面设置的密码，pack.ps1 与 GitHub Secrets 都需要它'
    Write-Host ''

    if (Test-Path $PrivateKeyPath) {
        $confirm = Read-Host '检测到已有 luoscope.key，是否覆盖？(y/N)'
        if ($confirm -notin @('y', 'Y')) {
            Write-Host '已取消。' -ForegroundColor Yellow
            exit 0
        }
    }

    $securePassword = Read-Host '请设置签名私钥密码（请牢记）' -AsSecureString
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    )
    if ([string]::IsNullOrWhiteSpace($plainPassword)) {
        throw '密码不能为空'
    }

    $env:CI = 'true'
    npx tauri signer generate -w $PrivateKeyPath --ci -p $plainPassword -f
    if ($LASTEXITCODE -ne 0) {
        throw "tauri signer generate 失败，退出码 $LASTEXITCODE"
    }

    if (-not (Test-Path $PublicKeyPath)) {
        throw "未找到公钥文件: $PublicKeyPath"
    }

    $publicKeyBase64 = ([IO.File]::ReadAllText($PublicKeyPath, [Text.Encoding]::UTF8)).Trim()
    $configJson = [IO.File]::ReadAllText($TauriConfigPath, [Text.Encoding]::UTF8)
    $updatedConfig = [Regex]::Replace(
        $configJson,
        '"pubkey"\s*:\s*"[^"]*"',
        '"pubkey": "' + $publicKeyBase64 + '"'
    )
    [IO.File]::WriteAllText($TauriConfigPath, $updatedConfig, (New-Object System.Text.UTF8Encoding $false))

    $privateKeyForSecret = ([IO.File]::ReadAllText($PrivateKeyPath, [Text.Encoding]::UTF8)).Trim()
    $pastePath = Join-Path $ProjectRoot '.tauri\github-secrets-paste.local.txt'
    @"
=== GitHub Secrets（复制到仓库 Settings → Secrets → Actions）===
https://github.com/RobustLuo/light-c/settings/secrets/actions

1) Name: TAURI_SIGNING_PRIVATE_KEY
Value（整行复制 luoscope.key 原文，以 dW50 开头，不要二次 Base64）:
$privateKeyForSecret

2) Name: TAURI_SIGNING_PRIVATE_KEY_PASSWORD
Value:
$plainPassword

保存后 Run workflow: https://github.com/RobustLuo/light-c/actions/workflows/release.yml
"@ | Out-File -FilePath $pastePath -Encoding utf8

    Write-Host ''
    Write-Host '=== 完成 ===' -ForegroundColor Green
    Write-Host '  私钥: .tauri\luoscope.key'
    Write-Host '  公钥: .tauri\luoscope.key.pub'
    Write-Host '  已更新: src-tauri\tauri.conf.json -> plugins.updater.pubkey'
    Write-Host ''
    Write-Host '下一步：' -ForegroundColor Cyan
    Write-Host '  1. 本地打包：'
    Write-Host '       $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''你的密码'''
    Write-Host '       .\pack.ps1'
    Write-Host '  2. GitHub 发版：在仓库 Secrets 配置'
    Write-Host '       TAURI_SIGNING_PRIVATE_KEY = 直接粘贴 .tauri\luoscope.key 全文（单行，勿二次 Base64）'
    Write-Host '       TAURI_SIGNING_PRIVATE_KEY_PASSWORD = （同上密码，勿带换行）'
    Write-Host '       可复制 .tauri\github-secrets-paste.local.txt 里的内容'
    Write-Host ''
    Write-Host '注意：换密钥后，旧版已发布安装包的「官方 exe 校验」会失效，需重新发版。' -ForegroundColor Yellow
}
finally {
    Pop-Location
    Remove-Item Env:\CI -ErrorAction SilentlyContinue
}

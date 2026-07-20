# ============================================================================
# 在 D 盘缓存环境下执行 npm 脚本（dev / build / tauri 等）
# ============================================================================

param(
    [Parameter(Position = 0, Mandatory = $true)]
    [string]$Command,

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Rest
)

$ProjectRoot = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot "set-dev-cache-env.ps1")

Push-Location $ProjectRoot
try {
    switch ($Command) {
        "dev" {
            & npx vite @Rest
            exit $LASTEXITCODE
        }
        "build" {
            & npx tsc
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
            & npx vite build
            exit $LASTEXITCODE
        }
        "preview" {
            & npx vite preview @Rest
            exit $LASTEXITCODE
        }
        "tauri" {
            & npx tauri @Rest
            exit $LASTEXITCODE
        }
        default {
            Write-Error "未知命令: $Command"
            exit 1
        }
    }
}
finally {
    Pop-Location
}

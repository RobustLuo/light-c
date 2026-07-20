# ============================================================================
# 一次性将开发相关缓存迁移到 D 盘，并用目录联接重定向 Cursor 沙盒路径
# 用法（PowerShell）：.\scripts\setup-d-drive-cache.ps1
# ============================================================================

#Requires -Version 5.1

$ErrorActionPreference = 'Stop'

chcp 65001 | Out-Null
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new()
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [System.Text.UTF8Encoding]::new()

$DevCacheRoot = 'D:\DevCache\LuoScope'

$CacheDirectories = @(
    'cargo-target',
    'cargo-home',
    'npm-cache',
    'temp',
    'cursor-sandbox-cache'
)

function Get-DirectorySizeBytes {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return 0 }
    return (Get-ChildItem -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue |
        Measure-Object -Property Length -Sum).Sum
}

function Format-SizeGb {
    param([long]$Bytes)
    return [math]::Round($Bytes / 1GB, 2)
}

function Test-IsReparsePoint {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $false }
    return ([IO.FileAttributes]::ReparsePoint -band (Get-Item -LiteralPath $Path -Force).Attributes) -ne 0
}

function Merge-DirectoryContent {
    param(
        [string]$SourcePath,
        [string]$TargetPath
    )
    if (-not (Test-Path -LiteralPath $SourcePath)) { return 0 }

    New-Item -ItemType Directory -Path $TargetPath -Force | Out-Null
    $beforeBytes = Get-DirectorySizeBytes -Path $TargetPath

    # robocopy 退出码 0-7 均表示成功或部分成功
    $null = robocopy $SourcePath $TargetPath /E /MOVE /R:1 /W:1 /NFL /NDL /NJH /NJS /NP
    if ($LASTEXITCODE -gt 7) {
        throw "迁移失败: $SourcePath -> $TargetPath (robocopy exit $LASTEXITCODE)"
    }

    if (Test-Path -LiteralPath $SourcePath) {
        Remove-Item -LiteralPath $SourcePath -Recurse -Force -ErrorAction SilentlyContinue
    }

    $afterBytes = Get-DirectorySizeBytes -Path $TargetPath
    return [math]::Max(0, $afterBytes - $beforeBytes)
}

function Install-CacheJunction {
    param(
        [string]$LinkPath,
        [string]$TargetPath,
        [switch]$MigrateExisting
    )

    if ([string]::IsNullOrWhiteSpace($LinkPath)) {
        throw "目录联接路径为空，无法创建: $TargetPath"
    }
    if ([string]::IsNullOrWhiteSpace($TargetPath)) {
        throw "目录联接目标为空: $LinkPath"
    }

    New-Item -ItemType Directory -Path $TargetPath -Force | Out-Null

    if (Test-Path -LiteralPath $LinkPath) {
        if (Test-IsReparsePoint -Path $LinkPath) {
            $existing = (Get-Item -LiteralPath $LinkPath -Force).Target
            if ($existing -and ($existing -eq $TargetPath)) {
                Write-Host "[跳过] 已是 D 盘联接: $LinkPath"
                return 0
            }
            Remove-Item -LiteralPath $LinkPath -Force
        }
        elseif ($MigrateExisting) {
            $moved = Merge-DirectoryContent -SourcePath $LinkPath -TargetPath $TargetPath
            Write-Host ("[迁移] {0} -> {1} ({2} GB)" -f $LinkPath, $TargetPath, (Format-SizeGb $moved))
        }
        else {
            Remove-Item -LiteralPath $LinkPath -Recurse -Force
        }
    }

    New-Item -ItemType Junction -Path $LinkPath -Target $TargetPath -Force | Out-Null
    Write-Host "[联接] $LinkPath -> $TargetPath"
    return 0
}

function Set-UserEnvironmentVariable {
    param(
        [string]$Name,
        [string]$Value
    )
    $current = [Environment]::GetEnvironmentVariable($Name, 'User')
    if ($current -eq $Value) {
        Write-Host "[跳过] 用户环境变量已正确: $Name"
        return
    }
    [Environment]::SetEnvironmentVariable($Name, $Value, 'User')
    Set-Item -Path "Env:$Name" -Value $Value
    Write-Host "[环境] $Name=$Value"
}

function Resolve-UserPaths {
    $resolvedUserProfile = [Environment]::GetFolderPath('UserProfile')
    if ([string]::IsNullOrWhiteSpace($resolvedUserProfile)) {
        $resolvedUserProfile = $env:USERPROFILE
    }
    if ([string]::IsNullOrWhiteSpace($resolvedUserProfile)) {
        $resolvedUserProfile = $HOME
    }

    $resolvedLocalAppData = [Environment]::GetFolderPath('LocalApplicationData')
    if ([string]::IsNullOrWhiteSpace($resolvedLocalAppData)) {
        $resolvedLocalAppData = $env:LOCALAPPDATA
    }
    if ([string]::IsNullOrWhiteSpace($resolvedLocalAppData)) {
        try {
            $resolvedLocalAppData = (Get-ItemProperty 'HKCU:\Environment' -ErrorAction Stop).LOCALAPPDATA
        }
        catch {
            $resolvedLocalAppData = $null
        }
    }

    if ([string]::IsNullOrWhiteSpace($resolvedUserProfile) -or [string]::IsNullOrWhiteSpace($resolvedLocalAppData)) {
        throw '无法解析用户目录路径，请在普通 PowerShell 终端中运行此脚本'
    }

    return @{
        UserProfile  = $resolvedUserProfile
        LocalAppData = $resolvedLocalAppData
    }
}

Write-Host "=== LuoScope 开发缓存迁移到 D 盘 ==="
Write-Host "目标根目录: $DevCacheRoot"
Write-Host ''

foreach ($directoryName in $CacheDirectories) {
    $directoryPath = Join-Path $DevCacheRoot $directoryName
    if (-not (Test-Path -LiteralPath $directoryPath)) {
        New-Item -ItemType Directory -Path $directoryPath -Force | Out-Null
    }
}

$cargoHomeTarget = Join-Path $DevCacheRoot 'cargo-home'
$npmCacheTarget = Join-Path $DevCacheRoot 'npm-cache'
$tempTarget = Join-Path $DevCacheRoot 'temp'
$sandboxTarget = Join-Path $DevCacheRoot 'cursor-sandbox-cache'

# 用系统 API + 环境变量 + 约定路径回退，避免某些子进程里返回空值
$resolvedPaths = Resolve-UserPaths
$userProfile = $resolvedPaths.UserProfile
$localAppData = $resolvedPaths.LocalAppData
if ([string]::IsNullOrWhiteSpace($userProfile)) {
    $userProfile = $env:USERPROFILE
}
if ([string]::IsNullOrWhiteSpace($localAppData) -and -not [string]::IsNullOrWhiteSpace($userProfile)) {
    $localAppData = Join-Path $userProfile 'AppData\Local'
}
if ([string]::IsNullOrWhiteSpace($userProfile) -or [string]::IsNullOrWhiteSpace($localAppData)) {
    throw '无法解析用户目录路径，请在普通 PowerShell 终端中运行此脚本'
}
$tempRoot = Join-Path $localAppData 'Temp'

New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

# 用户目录下的 Cargo / npm 全局缓存迁到 D 盘并做联接
Install-CacheJunction -LinkPath (Join-Path $userProfile '.cargo') -TargetPath $cargoHomeTarget -MigrateExisting | Out-Null
Install-CacheJunction -LinkPath (Join-Path $localAppData 'npm-cache') -TargetPath $npmCacheTarget -MigrateExisting | Out-Null

# Cursor Agent 沙盒固定写 LOCALAPPDATA\Temp\cursor-sandbox-cache，用联接强制落到 D 盘
# 避免使用 $sandboxLink 变量名（部分 PowerShell 宿主下会被清空）
$cursorSandboxCacheLinkPath = [System.IO.Path]::Combine($tempRoot, 'cursor-sandbox-cache')
Install-CacheJunction -LinkPath $cursorSandboxCacheLinkPath -TargetPath $sandboxTarget -MigrateExisting | Out-Null

# 持久化用户环境变量：新开的终端 / 部分工具也会走 D 盘
Set-UserEnvironmentVariable -Name 'CARGO_HOME' -Value $cargoHomeTarget
Set-UserEnvironmentVariable -Name 'NPM_CONFIG_CACHE' -Value $npmCacheTarget
Set-UserEnvironmentVariable -Name 'TMP' -Value $tempTarget
Set-UserEnvironmentVariable -Name 'TEMP' -Value $tempTarget

# 当前会话立即生效
$env:CARGO_HOME = $cargoHomeTarget
$env:CARGO_TARGET_DIR = Join-Path $DevCacheRoot 'cargo-target'
$env:NPM_CONFIG_CACHE = $npmCacheTarget
$env:TMP = $tempTarget
$env:TEMP = $tempTarget

Write-Host ''
Write-Host '=== 完成 ==='
Write-Host ("D 盘缓存总占用: {0} GB" -f (Format-SizeGb (Get-DirectorySizeBytes -Path $DevCacheRoot)))
Write-Host ("C 盘剩余: {0} GB" -f ([math]::Round((Get-PSDrive C).Free / 1GB, 2)))
Write-Host ''
Write-Host '说明:'
Write-Host '  - cursor-sandbox-cache 已通过目录联接重定向，Agent 沙盒编译也会写 D 盘'
Write-Host '  - 请重启 Cursor / 终端后再跑 npm run tauri dev'
Write-Host '  - 应用运行数据仍在 %LOCALAPPDATA%\LuoScope（体积通常很小，不建议迁移）'

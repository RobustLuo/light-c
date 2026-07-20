// ============================================================================
// 垃圾软件扫描模块
// 通过注册表 Uninstall 项 + 特征库匹配常见捆绑/推广软件，供用户确认后卸载。
// ============================================================================

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::time::Instant;
use winreg::enums::*;
use winreg::RegKey;

/// Windows 子进程隐藏窗口标志（CREATE_NO_WINDOW）
#[cfg(windows)]
const HIDDEN_PROCESS_FLAGS: u32 = 0x08000000;

// ============================================================================
// 特征库
// ============================================================================

/// 单条垃圾软件特征：任一维度命中即视为匹配
struct BloatwareSignature {
    id: &'static str,
    label: &'static str,
    display_keywords: &'static [&'static str],
    publisher_keywords: &'static [&'static str],
    folder_keywords: &'static [&'static str],
}

/// 内置特征表：覆盖国内常见捆绑/推广类安全与工具软件
const BLOATWARE_SIGNATURES: &[BloatwareSignature] = &[
    BloatwareSignature {
        id: "360",
        label: "360 系列",
        display_keywords: &["360安全", "360 安全", "360杀毒", "360卫士", "360 total security", "360sd", "360safe"],
        publisher_keywords: &["qihoo", "奇虎", "360"],
        folder_keywords: &["360safe", "360sd", "360zip"],
    },
    BloatwareSignature {
        id: "ludashi",
        label: "鲁大师",
        display_keywords: &["鲁大师", "ludashi", "master lu"],
        publisher_keywords: &["鲁大师", "ludashi"],
        folder_keywords: &["ludashi", "lds"],
    },
    BloatwareSignature {
        id: "2345",
        label: "2345 系列",
        display_keywords: &["2345", "2345好压", "2345王牌", "2345浏览器", "2345卫士"],
        publisher_keywords: &["2345", "瑞创"],
        folder_keywords: &["2345", "2345soft"],
    },
    BloatwareSignature {
        id: "tencent-pcmgr",
        label: "腾讯电脑管家",
        display_keywords: &["电脑管家", "qqpcmgr", "tencent pc manager", "腾讯电脑管家"],
        publisher_keywords: &["tencent", "腾讯"],
        folder_keywords: &["qqpcmgr", "tencent"],
    },
    BloatwareSignature {
        id: "kingsoft",
        label: "金山系列",
        display_keywords: &["金山毒霸", "kingsoft", "金山卫士", "猎豹安全", "liebao"],
        publisher_keywords: &["kingsoft", "金山", "猎豹"],
        folder_keywords: &["kingsoft", "ksafe", "liebao"],
    },
    BloatwareSignature {
        id: "driver-assistant",
        label: "驱动类推广",
        display_keywords: &["驱动人生", "驱动精灵", "driver talent", "drivergenius"],
        publisher_keywords: &["驱动人生", "驱动精灵", "kyocera", "驱动之家"],
        folder_keywords: &["drivethelife", "drivergenius", "mydrivers"],
    },
    BloatwareSignature {
        id: "baidu-security",
        label: "百度安全系列",
        display_keywords: &["百度卫士", "百度杀毒", "baidu antivirus", "百度安全"],
        publisher_keywords: &["baidu", "百度"],
        folder_keywords: &["baidu", "baidusd"],
    },
    BloatwareSignature {
        id: "zip-bloat",
        label: "推广压缩软件",
        display_keywords: &["快压", "好压", "kuaizip", "haozip"],
        publisher_keywords: &["快压", "好压", "2345"],
        folder_keywords: &["kuaizip", "haozip"],
    },
    BloatwareSignature {
        id: "desktop-bloat",
        label: "桌面推广",
        display_keywords: &["布丁桌面", "壁纸助手", "360壁纸", "桌面助手"],
        publisher_keywords: &["布丁", "壁纸"],
        folder_keywords: &["pudding", "bizhi"],
    },
];

/// 发布者白名单：命中则跳过，避免误伤正规系统/硬件组件
const TRUSTED_PUBLISHER_KEYWORDS: &[&str] = &[
    "microsoft",
    "windows",
    "nvidia",
    "intel",
    "amd",
    "realtek",
    "dell",
    "lenovo",
    "hp inc",
    "hewlett-packard",
    "asus",
    "acer",
    "apple",
    "google",
    "mozilla",
    "adobe",
    "oracle",
    "vmware",
    "citrix",
];

// ============================================================================
// 对外类型
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BloatwareItem {
    /// 稳定 ID：注册表根 + 子键名，用于去重与卸载请求
    pub id: String,
    pub display_name: String,
    pub publisher: String,
    pub install_location: Option<String>,
    pub uninstall_command: String,
    pub silent_uninstall_command: Option<String>,
    pub estimated_size_mb: Option<u64>,
    pub signature_id: String,
    pub signature_label: String,
    pub match_reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BloatwareScanResult {
    pub items: Vec<BloatwareItem>,
    pub total_count: usize,
    pub scan_duration_ms: u64,
    pub is_admin: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BloatwareUninstallRequestItem {
    pub id: String,
    pub display_name: String,
    pub uninstall_command: String,
    pub silent_uninstall_command: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BloatwareUninstallItemResult {
    pub display_name: String,
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BloatwareUninstallResult {
    pub results: Vec<BloatwareUninstallItemResult>,
    pub success_count: usize,
    pub failed_count: usize,
}

// ============================================================================
// 扫描实现
// ============================================================================

pub struct BloatwareScanner;

impl BloatwareScanner {
    pub fn scan() -> BloatwareScanResult {
        let started = Instant::now();
        let mut items = Vec::new();
        let mut seen_ids = HashSet::new();

        let reg_paths = [
            (
                "HKLM",
                HKEY_LOCAL_MACHINE,
                r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
            ),
            (
                "HKLM_WOW64",
                HKEY_LOCAL_MACHINE,
                r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
            ),
            (
                "HKCU",
                HKEY_CURRENT_USER,
                r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
            ),
        ];

        for (root_label, hkey, path) in reg_paths {
            if let Ok(key) = RegKey::predef(hkey).open_subkey_with_flags(path, KEY_READ) {
                for subkey_name in key.enum_keys().filter_map(|k| k.ok()) {
                    if let Ok(subkey) = key.open_subkey_with_flags(&subkey_name, KEY_READ) {
                        if let Some(item) =
                            parse_registry_entry(root_label, &subkey_name, &subkey)
                        {
                            if seen_ids.insert(item.id.clone()) {
                                items.push(item);
                            }
                        }
                    }
                }
            }
        }

        items.sort_by(|a, b| a.display_name.cmp(&b.display_name));

        let scan_duration_ms = started.elapsed().as_millis() as u64;
        let total_count = items.len();

        log::info!(
            "垃圾软件扫描完成: 发现 {} 个匹配项, 耗时 {} ms",
            total_count,
            scan_duration_ms
        );

        BloatwareScanResult {
            items,
            total_count,
            scan_duration_ms,
            is_admin: crate::system_slim::check_admin(),
        }
    }
}

/// 解析单个 Uninstall 注册表项，不匹配特征或不可卸载则返回 None
fn parse_registry_entry(
    root_label: &str,
    subkey_name: &str,
    subkey: &RegKey,
) -> Option<BloatwareItem> {
    // SystemComponent=1 多为系统补丁/组件，跳过
    if subkey.get_value::<u32, _>("SystemComponent").unwrap_or(0) == 1 {
        return None;
    }

    let display_name: String = subkey.get_value("DisplayName").unwrap_or_default();
    if display_name.trim().is_empty() {
        return None;
    }

    let publisher: String = subkey.get_value("Publisher").unwrap_or_default();
    if is_trusted_publisher(&publisher) {
        return None;
    }

    let install_location: Option<String> = subkey
        .get_value::<String, _>("InstallLocation")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let uninstall_command: String = subkey
        .get_value::<String, _>("UninstallString")
        .unwrap_or_default()
        .trim()
        .to_string();
    let silent_uninstall_command: Option<String> = subkey
        .get_value::<String, _>("QuietUninstallString")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    // 至少需要一个可用的卸载命令
    if uninstall_command.is_empty() && silent_uninstall_command.is_none() {
        return None;
    }

    let primary_uninstall = if !uninstall_command.is_empty() {
        uninstall_command.clone()
    } else {
        silent_uninstall_command.clone().unwrap_or_default()
    };

    let (signature_id, signature_label, match_reason) =
        match_signature(&display_name, &publisher, install_location.as_deref())?;

    let estimated_size_mb = subkey
        .get_value::<u32, _>("EstimatedSize")
        .ok()
        .map(|kb| (kb as u64 + 1023) / 1024);

    Some(BloatwareItem {
        id: format!("{}\\{}", root_label, subkey_name),
        display_name,
        publisher,
        install_location,
        uninstall_command: primary_uninstall,
        silent_uninstall_command,
        estimated_size_mb,
        signature_id,
        signature_label,
        match_reason,
    })
}

fn is_trusted_publisher(publisher: &str) -> bool {
    let normalized = normalize_text(publisher);
    if normalized.is_empty() {
        return false;
    }
    TRUSTED_PUBLISHER_KEYWORDS
        .iter()
        .any(|keyword| normalized.contains(keyword))
}

fn match_signature(
    display_name: &str,
    publisher: &str,
    install_location: Option<&str>,
) -> Option<(String, String, String)> {
    let display_norm = normalize_text(display_name);
    let publisher_norm = normalize_text(publisher);
    let folder_norm = install_location
        .map(normalize_text)
        .unwrap_or_default();

    for sig in BLOATWARE_SIGNATURES {
        if sig
            .display_keywords
            .iter()
            .any(|kw| display_norm.contains(&normalize_text(kw)))
        {
            return Some((
                sig.id.to_string(),
                sig.label.to_string(),
                format!("软件名称匹配「{}」", sig.label),
            ));
        }
        if !publisher_norm.is_empty()
            && sig
                .publisher_keywords
                .iter()
                .any(|kw| publisher_norm.contains(&normalize_text(kw)))
        {
            return Some((
                sig.id.to_string(),
                sig.label.to_string(),
                format!("发布者匹配「{}」", sig.label),
            ));
        }
        if !folder_norm.is_empty()
            && sig
                .folder_keywords
                .iter()
                .any(|kw| folder_norm.contains(&normalize_text(kw)))
        {
            return Some((
                sig.id.to_string(),
                sig.label.to_string(),
                format!("安装目录匹配「{}」", sig.label),
            ));
        }
    }

    None
}

fn normalize_text(value: &str) -> String {
    value.trim().to_lowercase()
}

// ============================================================================
// 卸载实现
// ============================================================================

pub fn uninstall_bloatware_items(
    items: Vec<BloatwareUninstallRequestItem>,
) -> BloatwareUninstallResult {
    let mut results = Vec::with_capacity(items.len());
    let mut success_count = 0usize;
    let mut failed_count = 0usize;

    for item in items {
        let command = item
            .silent_uninstall_command
            .as_deref()
            .filter(|s| !s.is_empty())
            .or_else(|| {
                if item.uninstall_command.is_empty() {
                    None
                } else {
                    Some(item.uninstall_command.as_str())
                }
            });

        let result = match command {
            Some(cmd) => run_uninstall_command(&item.display_name, cmd),
            None => BloatwareUninstallItemResult {
                display_name: item.display_name.clone(),
                success: false,
                message: "未找到可用的卸载命令".to_string(),
            },
        };

        if result.success {
            success_count += 1;
        } else {
            failed_count += 1;
        }
        results.push(result);
    }

    BloatwareUninstallResult {
        results,
        success_count,
        failed_count,
    }
}

/// 通过 cmd /C 执行卸载命令，兼容带引号路径与 MsiExec 参数
#[cfg(windows)]
fn run_uninstall_command(display_name: &str, command: &str) -> BloatwareUninstallItemResult {
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    log::info!("开始卸载垃圾软件: {} -> {}", display_name, command);

    let output = Command::new("cmd")
        .args(["/C", command])
        .creation_flags(HIDDEN_PROCESS_FLAGS)
        .output();

    match output {
        Ok(result) => {
            if result.status.success() {
                BloatwareUninstallItemResult {
                    display_name: display_name.to_string(),
                    success: true,
                    message: "卸载命令已执行完成".to_string(),
                }
            } else {
                let code = result.status.code().unwrap_or(-1);
                let stderr = String::from_utf8_lossy(&result.stderr);
                let stdout = String::from_utf8_lossy(&result.stdout);
                let detail = if !stderr.trim().is_empty() {
                    stderr.trim().to_string()
                } else if !stdout.trim().is_empty() {
                    stdout.trim().to_string()
                } else {
                    format!("退出码 {}", code)
                };
                BloatwareUninstallItemResult {
                    display_name: display_name.to_string(),
                    success: false,
                    message: format!("卸载失败: {}", detail),
                }
            }
        }
        Err(error) => BloatwareUninstallItemResult {
            display_name: display_name.to_string(),
            success: false,
            message: format!("无法启动卸载程序: {}", error),
        },
    }
}

#[cfg(not(windows))]
fn run_uninstall_command(display_name: &str, _command: &str) -> BloatwareUninstallItemResult {
    BloatwareUninstallItemResult {
        display_name: display_name.to_string(),
        success: false,
        message: "仅支持 Windows 平台".to_string(),
    }
}

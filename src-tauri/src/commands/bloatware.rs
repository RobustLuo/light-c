// ============================================================================
// 垃圾软件扫描与卸载命令
// ============================================================================

use crate::scanner::{
    uninstall_bloatware_items, BloatwareScanResult, BloatwareScanner, BloatwareUninstallRequestItem,
    BloatwareUninstallResult,
};
use log::info;

/// 扫描已安装的常见垃圾/捆绑软件
#[tauri::command]
pub async fn scan_bloatware() -> Result<BloatwareScanResult, String> {
    info!("开始扫描垃圾软件...");

    let result = tokio::task::spawn_blocking(BloatwareScanner::scan)
        .await
        .map_err(|e| format!("扫描任务失败: {}", e))?;

    info!(
        "垃圾软件扫描完成: 发现 {} 个匹配项",
        result.total_count
    );

    Ok(result)
}

/// 按用户选择顺序卸载垃圾软件（优先静默卸载命令）
#[tauri::command]
pub async fn uninstall_bloatware(
    items: Vec<BloatwareUninstallRequestItem>,
) -> Result<BloatwareUninstallResult, String> {
    if items.is_empty() {
        return Err("未选择任何要卸载的软件".to_string());
    }

    info!("开始卸载 {} 个垃圾软件...", items.len());

    let result = tokio::task::spawn_blocking(move || uninstall_bloatware_items(items))
        .await
        .map_err(|e| format!("卸载任务失败: {}", e))?;

    info!(
        "垃圾软件卸载完成: 成功 {}, 失败 {}",
        result.success_count, result.failed_count
    );

    Ok(result)
}

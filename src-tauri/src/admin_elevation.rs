// ============================================================================
// 管理员提权重启
// Windows 不允许普通进程静默提权，只能通过 UAC 弹窗请求用户确认后重启。
// ============================================================================

use log::info;
use serde::Serialize;
use std::path::PathBuf;

/// 提权重启结果，供前端区分“已是管理员 / 已发起重启 / 用户拒绝”等场景。
#[derive(Debug, Clone, Serialize)]
pub struct AdminElevationResult {
    pub already_elevated: bool,
    pub launched: bool,
    pub message: String,
}

/// 以管理员身份重新启动当前程序；若已是管理员则直接返回成功状态。
pub fn restart_as_admin() -> Result<AdminElevationResult, String> {
    if crate::system_slim::check_admin() {
        return Ok(AdminElevationResult {
            already_elevated: true,
            launched: false,
            message: "当前已具备管理员权限".to_string(),
        });
    }

    // 开发/debug 产物不能脱离 tauri dev 直接 runas，否则 WebView2 无法加载前端。
    if is_unsupported_elevation_target() {
        return Err(
            "开发模式下不支持应用内提权重启。请关闭当前 dev 窗口，以管理员身份打开终端后在项目目录执行 npm run tauri dev。"
                .to_string(),
        );
    }

    #[cfg(target_os = "windows")]
    {
        restart_as_admin_windows()
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("仅 Windows 支持管理员提权".to_string())
    }
}

/// 判断当前 exe 是否不适合通过 ShellExecute 直接提权（debug / 沙箱临时目录）。
fn is_unsupported_elevation_target() -> bool {
    if cfg!(debug_assertions) {
        return true;
    }

    std::env::current_exe()
        .ok()
        .is_some_and(|path| {
            let normalized = path.to_string_lossy().replace('/', "\\").to_lowercase();
            normalized.contains("\\target\\debug\\")
                || normalized.contains("\\cargo-target\\debug\\")
                || normalized.contains("\\cursor-sandbox-cache\\")
                || normalized.contains("\\temp\\")
        })
}

#[cfg(target_os = "windows")]
fn restart_as_admin_windows() -> Result<AdminElevationResult, String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::ptr;

    let exe_path =
        std::env::current_exe().map_err(|error| format!("无法获取程序路径: {error}"))?;
    let working_directory = exe_path
        .parent()
        .map(|directory| directory.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));

    // 保留启动参数，避免便携版或自定义数据目录参数在提权后丢失。
    let params = std::env::args()
        .skip(1)
        .map(|argument| {
            if argument.contains(' ') || argument.contains('\t') {
                format!("\"{argument}\"")
            } else {
                argument
            }
        })
        .collect::<Vec<_>>()
        .join(" ");

    let exe_wide: Vec<u16> = exe_path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let params_wide: Vec<u16> = OsStr::new(&params)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let verb_wide: Vec<u16> = OsStr::new("runas")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let working_directory_wide: Vec<u16> = working_directory
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    #[link(name = "shell32")]
    extern "system" {
        fn ShellExecuteW(
            hwnd: *mut std::ffi::c_void,
            lp_operation: *const u16,
            lp_file: *const u16,
            lp_parameters: *const u16,
            lp_directory: *const std::ffi::c_void,
            n_show_cmd: i32,
        ) -> isize;
    }

    const SW_SHOWNORMAL: i32 = 1;

    let result = unsafe {
        ShellExecuteW(
            ptr::null_mut(),
            verb_wide.as_ptr(),
            exe_wide.as_ptr(),
            if params.is_empty() {
                ptr::null()
            } else {
                params_wide.as_ptr()
            },
            working_directory_wide.as_ptr() as *const std::ffi::c_void,
            SW_SHOWNORMAL,
        )
    };

    // ShellExecute 返回值 <= 32 表示失败，常见为 5（用户取消 UAC）。
    if result <= 32 {
        let error_message = match result {
            0 => "系统内存或资源不足",
            2 => "找不到程序文件",
            3 => "找不到指定路径",
            5 => "操作被拒绝（可能取消了 UAC 提示）",
            8 => "内存不足",
            26 => "共享文件冲突",
            27 => "文件名不正确",
            28 => "系统找不到关联程序",
            29 => "DDE 事务失败",
            30 => "DDE 事务超时",
            31 => "没有关联的应用程序",
            32 => "无法找到动态链接库",
            _ => "未知错误",
        };
        return Err(format!("提权启动失败: {error_message} (代码 {result})"));
    }

    info!(
        "已发起管理员提权重启: {} {}",
        exe_path.display(),
        if params.is_empty() {
            String::new()
        } else {
            format!("参数: {params}")
        }
    );

    Ok(AdminElevationResult {
        already_elevated: false,
        launched: true,
        message: "已请求管理员权限，当前窗口即将关闭".to_string(),
    })
}

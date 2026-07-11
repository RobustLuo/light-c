// ============================================================================
// 旧驱动清理模块
//
// 只通过 pnputil 管理 Driver Store 中的驱动包，不直接操作 DriverStore 文件，
// 这样可以让 Windows 自己负责驱动包的依赖、签名和删除安全检查。
// ============================================================================

use chrono::Local;
use log::{info, warn};
use quick_xml::{events::Event, Reader};
use serde::Serialize;
use std::cmp::Ordering;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

const DRIVER_BACKUP_DIR: &str = "driver_backups";

#[derive(Debug, Clone, Serialize)]
pub struct DriverPackageInfo {
    pub published_name: String,
    pub original_name: String,
    pub provider_name: String,
    pub class_name: String,
    pub driver_version: String,
    pub family_id: String,
    pub signer_name: String,
    pub device_count: usize,
    pub file_count: usize,
    pub status: String,
    pub actionable: bool,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DriverScanResult {
    pub is_admin: bool,
    pub packages: Vec<DriverPackageInfo>,
    pub recommended_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct DriverDeleteDetail {
    pub published_name: String,
    pub success: bool,
    pub verified_removed: bool,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DriverDeleteResult {
    pub backup_directory: String,
    pub success_count: usize,
    pub failed_count: usize,
    pub needs_reboot: bool,
    pub details: Vec<DriverDeleteDetail>,
}

#[derive(Debug, Default)]
struct RawDriverPackage {
    published_name: String,
    original_name: String,
    provider_name: String,
    class_name: String,
    driver_version: String,
    family_id: String,
    signer_name: String,
    device_count: usize,
    file_count: usize,
}

#[derive(Debug, Default)]
struct PnputilOutput {
    stdout: String,
    stderr: String,
}

pub fn scan() -> Result<DriverScanResult, String> {
    let raw_packages = enumerate_driver_packages()?;
    let packages = classify_packages(raw_packages);
    let recommended_count = packages.iter().filter(|package| package.actionable).count();

    Ok(DriverScanResult {
        is_admin: crate::system_slim::check_admin(),
        packages,
        recommended_count,
    })
}

pub fn delete(published_names: Vec<String>) -> Result<DriverDeleteResult, String> {
    if published_names.is_empty() {
        return Err("未选择要清理的驱动包".to_string());
    }
    if !crate::system_slim::check_admin() {
        return Err("删除驱动包需要管理员权限，请以管理员身份运行 LightC".to_string());
    }

    let selected_names = normalize_published_names(&published_names)?;
    let current_scan = scan()?;
    let selected_packages = validate_selected_packages(&current_scan, &selected_names)?;
    let backup_directory = create_backup_directory()?;

    // 所有备份成功后才进入删除阶段，避免只备份一部分却已经修改系统状态。
    for package in &selected_packages {
        export_driver_package(&package.published_name, &backup_directory)?;
    }

    let mut details = Vec::with_capacity(selected_packages.len());
    let mut needs_reboot = false;
    for package in selected_packages {
        let output = run_pnputil(&["/delete-driver", package.published_name.as_str()])?;
        let command_success = output.status_success;
        let output_text = format_command_output(&output.output);
        if output_text.to_ascii_lowercase().contains("restart")
            || output_text.to_ascii_lowercase().contains("reboot")
            || output_text.contains("重启")
        {
            needs_reboot = true;
        }

        details.push(DriverDeleteDetail {
            published_name: package.published_name,
            success: command_success,
            verified_removed: false,
            error_message: if command_success {
                None
            } else {
                Some(output_text)
            },
        });
    }

    // 一次复核所有删除结果，避免每个包都重新调用 pnputil，减少系统 IO 和进程开销。
    let remaining_names = enumerate_driver_packages()?
        .into_iter()
        .map(|package| package.published_name)
        .collect::<std::collections::HashSet<_>>();
    for detail in &mut details {
        detail.verified_removed = !remaining_names.contains(&detail.published_name);
        if detail.success && !detail.verified_removed {
            detail.success = false;
            detail.error_message = Some("pnputil 已执行，但重新检测仍发现该驱动包".to_string());
        }
    }

    let success_count = details.iter().filter(|detail| detail.success).count();
    let failed_count = details.len() - success_count;
    info!(
        "旧驱动清理完成: 成功 {}, 失败 {}, 备份目录 {}",
        success_count,
        failed_count,
        backup_directory.display()
    );

    Ok(DriverDeleteResult {
        backup_directory: backup_directory.to_string_lossy().to_string(),
        success_count,
        failed_count,
        needs_reboot,
        details,
    })
}

pub fn backup_directory() -> Result<String, String> {
    let directory = crate::data_dir::get_data_dir().join(DRIVER_BACKUP_DIR);
    fs::create_dir_all(&directory)
        .map_err(|error| format!("创建驱动备份目录失败 {}: {}", directory.display(), error))?;
    Ok(directory.to_string_lossy().to_string())
}

fn enumerate_driver_packages() -> Result<Vec<RawDriverPackage>, String> {
    let xml_path = temporary_xml_path();
    let xml_path_text = xml_path.to_string_lossy().to_string();
    let result = (|| {
        let output = run_pnputil(&[
            "/enum-drivers",
            "/files",
            "/ids",
            "/devices",
            "/format",
            "xml",
            "/output-file",
            &xml_path_text,
        ])?;
        if !output.status_success {
            return Err(format!(
                "枚举驱动包失败: {}",
                format_command_output(&output.output)
            ));
        }
        parse_driver_xml(&xml_path)
    })();

    if let Err(error) = fs::remove_file(&xml_path) {
        if error.kind() != std::io::ErrorKind::NotFound {
            warn!("删除临时驱动检测文件失败 {}: {}", xml_path.display(), error);
        }
    }
    result
}

fn classify_packages(raw_packages: Vec<RawDriverPackage>) -> Vec<DriverPackageInfo> {
    let mut family_versions: HashMap<String, Vec<Vec<u64>>> = HashMap::new();
    for package in &raw_packages {
        if let (Some(version), false) = (
            parse_driver_version(&package.driver_version),
            package.family_id.trim().is_empty(),
        ) {
            family_versions
                .entry(package.family_id.clone())
                .or_default()
                .push(version);
        }
    }

    raw_packages
        .into_iter()
        .map(|package| {
            let parsed_version = parse_driver_version(&package.driver_version);
            let has_newer_version = parsed_version.as_ref().is_some_and(|current_version| {
                family_versions
                    .get(&package.family_id)
                    .into_iter()
                    .flatten()
                    .any(|candidate| {
                        compare_versions(candidate, current_version) == Ordering::Greater
                    })
            });
            let (status, actionable, reason) = if package.device_count > 0 {
                (
                    "in_use",
                    false,
                    format!(
                        "已关联 {} 个设备，不能删除正在使用的驱动包",
                        package.device_count
                    ),
                )
            } else if package.family_id.trim().is_empty() || parsed_version.is_none() {
                (
                    "unknown",
                    false,
                    "缺少可用于版本判断的驱动族或版本信息，暂不建议删除".to_string(),
                )
            } else if has_newer_version {
                (
                    "recommended",
                    true,
                    "未关联设备，且同一驱动族存在更新版本".to_string(),
                )
            } else {
                (
                    "no_newer_version",
                    false,
                    "未关联设备，但未确认存在更新版本，暂不建议删除".to_string(),
                )
            };

            DriverPackageInfo {
                published_name: package.published_name,
                original_name: package.original_name,
                provider_name: package.provider_name,
                class_name: package.class_name,
                driver_version: package.driver_version,
                family_id: package.family_id,
                signer_name: package.signer_name,
                device_count: package.device_count,
                file_count: package.file_count,
                status: status.to_string(),
                actionable,
                reason,
            }
        })
        .collect()
}

fn validate_selected_packages(
    scan_result: &DriverScanResult,
    selected_names: &[String],
) -> Result<Vec<DriverPackageInfo>, String> {
    let packages_by_name = scan_result
        .packages
        .iter()
        .map(|package| (package.published_name.to_ascii_lowercase(), package))
        .collect::<HashMap<_, _>>();
    let mut selected_packages = Vec::with_capacity(selected_names.len());
    for name in selected_names {
        let Some(package) = packages_by_name.get(name) else {
            return Err(format!("驱动包 {} 已不存在，请重新检测", name));
        };
        if !package.actionable {
            return Err(format!(
                "驱动包 {} 当前不满足安全清理条件: {}",
                name, package.reason
            ));
        }
        selected_packages.push((*package).clone());
    }
    Ok(selected_packages)
}

fn normalize_published_names(names: &[String]) -> Result<Vec<String>, String> {
    let mut normalized = Vec::with_capacity(names.len());
    for name in names {
        let trimmed = name.trim();
        let lower = trimmed.to_ascii_lowercase();
        let number_part = lower
            .strip_prefix("oem")
            .and_then(|value| value.strip_suffix(".inf"));
        let is_valid = lower.starts_with("oem")
            && lower.ends_with(".inf")
            && number_part.is_some_and(|value| {
                !value.is_empty() && value.chars().all(|character| character.is_ascii_digit())
            });
        if !is_valid {
            return Err(format!("非法驱动包标识: {}", name));
        }
        if !normalized.contains(&lower) {
            normalized.push(lower);
        }
    }
    Ok(normalized)
}

fn export_driver_package(published_name: &str, backup_directory: &Path) -> Result<(), String> {
    let output = run_pnputil(&[
        "/export-driver",
        published_name,
        &backup_directory.to_string_lossy(),
    ])?;
    if output.status_success {
        Ok(())
    } else {
        Err(format!(
            "备份驱动包 {} 失败: {}",
            published_name,
            format_command_output(&output.output)
        ))
    }
}

fn create_backup_directory() -> Result<PathBuf, String> {
    let directory = crate::data_dir::get_data_dir()
        .join(DRIVER_BACKUP_DIR)
        .join(format!(
            "{}-{}",
            Local::now().format("%Y%m%d_%H%M%S"),
            std::process::id()
        ));
    fs::create_dir_all(&directory)
        .map_err(|error| format!("创建驱动备份目录失败 {}: {}", directory.display(), error))?;
    Ok(directory)
}

fn temporary_xml_path() -> PathBuf {
    std::env::temp_dir().join(format!(
        "lightc_driver_scan_{}_{}.xml",
        std::process::id(),
        Local::now().timestamp_nanos_opt().unwrap_or_default()
    ))
}

fn parse_driver_xml(path: &Path) -> Result<Vec<RawDriverPackage>, String> {
    let mut reader = Reader::from_file(path)
        .map_err(|error| format!("读取 pnputil XML 失败 {}: {}", path.display(), error))?;
    reader.config_mut().trim_text(true);
    let mut buffer = Vec::new();
    let mut current_package: Option<RawDriverPackage> = None;
    let mut current_text_element: Option<String> = None;
    let mut current_text = String::new();
    let mut packages = Vec::new();

    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Start(event)) => {
                let element_name = event.local_name().as_ref().to_vec();
                if element_name == b"Driver" {
                    current_package = Some(RawDriverPackage {
                        published_name: read_attribute(&event, b"DriverName")?,
                        ..RawDriverPackage::default()
                    });
                } else if let Some(package) = current_package.as_mut() {
                    if element_name == b"Device" {
                        package.device_count += 1;
                    } else if element_name == b"File" {
                        package.file_count += 1;
                    } else if is_driver_text_element(&element_name) {
                        current_text_element =
                            Some(String::from_utf8_lossy(&element_name).to_string());
                        current_text.clear();
                    }
                }
            }
            Ok(Event::Empty(event)) => {
                let element_name = event.local_name();
                if let Some(package) = current_package.as_mut() {
                    if element_name.as_ref() == b"Device" {
                        package.device_count += 1;
                    } else if element_name.as_ref() == b"File" {
                        package.file_count += 1;
                    }
                }
            }
            Ok(Event::Text(event)) => {
                if current_text_element.is_some() {
                    current_text.push_str(
                        &event
                            .decode()
                            .map_err(|error| format!("解析 pnputil XML 文本失败: {}", error))?,
                    );
                }
            }
            Ok(Event::End(event)) => {
                let element_name = event.local_name();
                if let Some(text_element) = current_text_element.as_deref() {
                    if text_element.as_bytes() == element_name.as_ref() {
                        if let Some(package) = current_package.as_mut() {
                            assign_driver_text(package, text_element, &current_text);
                        }
                        current_text_element = None;
                        current_text.clear();
                    }
                }
                if element_name.as_ref() == b"Driver" {
                    if let Some(package) = current_package.take() {
                        packages.push(package);
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(error) => return Err(format!("解析 pnputil XML 失败: {}", error)),
            _ => {}
        }
        buffer.clear();
    }
    Ok(packages)
}

fn is_driver_text_element(name: &[u8]) -> bool {
    matches!(
        name,
        b"OriginalName"
            | b"ProviderName"
            | b"ClassName"
            | b"DriverVersion"
            | b"FamilyId"
            | b"SignerName"
    )
}

fn assign_driver_text(package: &mut RawDriverPackage, element: &str, text: &str) {
    let target = match element {
        "OriginalName" => &mut package.original_name,
        "ProviderName" => &mut package.provider_name,
        "ClassName" => &mut package.class_name,
        "DriverVersion" => &mut package.driver_version,
        "FamilyId" => &mut package.family_id,
        "SignerName" => &mut package.signer_name,
        _ => return,
    };
    *target = text.trim().to_string();
}

fn read_attribute(
    event: &quick_xml::events::BytesStart<'_>,
    name: &[u8],
) -> Result<String, String> {
    for attribute in event.attributes().with_checks(false) {
        let attribute =
            attribute.map_err(|error| format!("解析 pnputil XML 属性失败: {}", error))?;
        if attribute.key.as_ref() == name {
            return attribute
                .unescape_value()
                .map(|value| value.into_owned())
                .map_err(|error| format!("解析 pnputil XML 属性值失败: {}", error));
        }
    }
    Ok(String::new())
}

fn parse_driver_version(version: &str) -> Option<Vec<u64>> {
    let version_token = version.split_whitespace().last()?;
    let components = version_token
        .split('.')
        .map(str::parse::<u64>)
        .collect::<Result<Vec<_>, _>>()
        .ok()?;
    (!components.is_empty()).then_some(components)
}

fn compare_versions(left: &[u64], right: &[u64]) -> Ordering {
    let max_length = left.len().max(right.len());
    (0..max_length)
        .map(|index| {
            (
                left.get(index).copied().unwrap_or(0),
                right.get(index).copied().unwrap_or(0),
            )
        })
        .find_map(
            |(left_value, right_value)| match left_value.cmp(&right_value) {
                Ordering::Equal => None,
                ordering => Some(ordering),
            },
        )
        .unwrap_or(Ordering::Equal)
}

struct CommandResult {
    status_success: bool,
    output: PnputilOutput,
}

fn run_pnputil(arguments: &[&str]) -> Result<CommandResult, String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new(pnputil_path())
            .args(arguments)
            .output()
            .map_err(|error| format!("启动 pnputil 失败: {}", error))?;
        return Ok(CommandResult {
            status_success: output.status.success(),
            output: PnputilOutput {
                stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
                stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
            },
        });
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = arguments;
        Err("旧驱动清理仅支持 Windows 系统".to_string())
    }
}

#[cfg(target_os = "windows")]
fn pnputil_path() -> PathBuf {
    std::env::var_os("SystemRoot")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(r"C:\Windows"))
        .join("System32")
        .join("pnputil.exe")
}

fn format_command_output(output: &PnputilOutput) -> String {
    let combined = format!("{} {}", output.stdout.trim(), output.stderr.trim());
    if combined.trim().is_empty() {
        "pnputil 未返回详细错误信息".to_string()
    } else {
        combined.trim().to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::{compare_versions, normalize_published_names, parse_driver_version};
    use std::cmp::Ordering;

    #[test]
    fn parses_pnputil_version_with_date_prefix() {
        assert_eq!(
            parse_driver_version("02/08/2024 2406.5.5.0"),
            Some(vec![2406, 5, 5, 0])
        );
    }

    #[test]
    fn compares_versions_with_different_component_lengths() {
        assert_eq!(compare_versions(&[1, 2], &[1, 2, 0]), Ordering::Equal);
        assert_eq!(compare_versions(&[1, 3], &[1, 2, 9]), Ordering::Greater);
    }

    #[test]
    fn rejects_non_published_driver_names() {
        assert!(normalize_published_names(&["DriverStore\\oem1.inf".to_string()]).is_err());
        assert_eq!(
            normalize_published_names(&["OEM12.INF".to_string()]).unwrap(),
            vec!["oem12.inf"]
        );
    }
}

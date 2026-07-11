// ============================================================================
// 旧驱动清理模块
// 只允许处理后端判定为“未关联设备且已有更新版本”的驱动包。
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, CheckCircle2, Cpu, FolderOpen, Loader2, ShieldAlert, Trash2 } from 'lucide-react';
import { ModuleCard } from '../ModuleCard';
import { ConfirmDialog } from '../ConfirmDialog';
import { EmptyState } from '../EmptyState';
import { useToast } from '../Toast';
import { useModuleDashboard } from '../../contexts/DashboardContext';
import {
  deleteOldDrivers,
  openDriverBackupDir,
  recordCleanupAction,
  scanOldDrivers,
  type DriverPackageInfo,
  type DriverScanResult,
} from '../../api/commands';
import { shouldSkipInactivePageRender, type ModuleRenderProps } from './moduleProps';

function getStatusLabel(packageInfo: DriverPackageInfo): string {
  switch (packageInfo.status) {
    case 'recommended':
      return '建议清理';
    case 'in_use':
      return '正在使用';
    case 'no_newer_version':
      return '未确认过时';
    default:
      return '暂不处理';
  }
}

export function DriverCleanupModule({ layoutMode = 'cards', isPageActive = true }: ModuleRenderProps) {
  const { moduleState, expandedModule, setExpandedModule, updateModuleState, oneClickScanTrigger } = useModuleDashboard('driverCleanup');
  const { showToast } = useToast();
  const lastScanTriggerRef = useRef(0);
  const [scanResult, setScanResult] = useState<DriverScanResult | null>(null);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    updateModuleState('driverCleanup', { status: 'scanning', error: null });
    try {
      const result = await scanOldDrivers();
      setScanResult(result);
      setSelectedNames(new Set());
      updateModuleState('driverCleanup', {
        status: 'done',
        fileCount: result.recommended_count,
        totalSize: 0,
      });
      setExpandedModule('driver-cleanup');
    } catch (error) {
      updateModuleState('driverCleanup', { status: 'error', error: String(error) });
    } finally {
      setLoading(false);
    }
  }, [setExpandedModule, updateModuleState]);

  useEffect(() => {
    if (oneClickScanTrigger > 0 && oneClickScanTrigger !== lastScanTriggerRef.current) {
      lastScanTriggerRef.current = oneClickScanTrigger;
      void loadDrivers();
    }
  }, [loadDrivers, oneClickScanTrigger]);

  const toggleSelection = useCallback((publishedName: string) => {
    setSelectedNames((current) => {
      const next = new Set(current);
      if (next.has(publishedName)) next.delete(publishedName);
      else next.add(publishedName);
      return next;
    });
  }, []);

  const handleDelete = useCallback(async () => {
    setShowConfirm(false);
    setDeleting(true);
    try {
      const names = Array.from(selectedNames);
      const result = await deleteOldDrivers(names);
      const detailByName = new Map(result.details.map((detail) => [detail.published_name, detail]));
      void recordCleanupAction(names.map((name) => {
        const detail = detailByName.get(name);
        return {
          category: '旧驱动清理',
          path: name,
          size: 0,
          success: detail?.success ?? false,
          error_message: detail?.error_message ?? undefined,
        };
      })).catch((error) => {
        showToast({ title: '清理日志记录失败', description: String(error), type: 'warning' });
      });

      showToast({
        title: result.failed_count === 0 ? '驱动清理完成' : '驱动清理部分完成',
        description: `成功 ${result.success_count} 个，失败 ${result.failed_count} 个。已创建备份，可重新检测确认结果。`,
        type: result.failed_count === 0 ? 'success' : 'warning',
      });
      if (result.needs_reboot) {
        showToast({ title: '需要重启', description: '部分驱动变更可能需要重启 Windows 后完成。', type: 'info' });
      }
      setSelectedNames(new Set());
      await loadDrivers();
    } catch (error) {
      showToast({ title: '驱动清理失败', description: String(error), type: 'error' });
    } finally {
      setDeleting(false);
    }
  }, [loadDrivers, selectedNames, showToast]);

  const isExpanded = expandedModule === 'driver-cleanup';
  if (shouldSkipInactivePageRender(layoutMode, isPageActive) && !deleting) return null;

  return (
    <>
      <ModuleCard
        id="driver-cleanup"
        title="旧驱动清理"
        description="检测没有设备绑定且已被新版本替代的第三方驱动包"
        icon={<Cpu className="w-6 h-6 text-[var(--brand-green)]" />}
        status={moduleState.status}
        fileCount={moduleState.fileCount}
        totalSize={moduleState.totalSize}
        countLabel="个驱动包"
        doneBadgeText="建议清理"
        emptyDoneBadgeText="未发现候选"
        expanded={isExpanded}
        onToggleExpand={() => setExpandedModule(isExpanded ? null : 'driver-cleanup')}
        onScan={() => void loadDrivers()}
        scanButtonText={loading ? '检测中...' : scanResult ? '重新检测' : '检测驱动'}
        error={moduleState.error}
        variant={layoutMode === 'pages' ? 'page' : 'card'}
        forceExpanded={layoutMode === 'pages'}
        headerExtra={scanResult ? (
          <span className={`text-xs px-2 py-1 rounded-full ${scanResult.is_admin ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
            {scanResult.is_admin ? '管理员' : '可检测，删除需管理员'}
          </span>
        ) : null}
      >
        <div className="p-4 space-y-3">
          {!scanResult && !loading && (
            <EmptyState icon={Cpu} title="尚未检测驱动包" description="LightC 只会通过 Windows pnputil 检查第三方驱动包，不直接删除驱动文件。" />
          )}

          {loading && !scanResult && (
            <div className="py-8 flex flex-col items-center justify-center text-[var(--fg-muted)]">
              <Loader2 className="w-7 h-7 text-emerald-500 animate-spin mb-2" />
              <p className="text-sm">正在读取 Windows 驱动包信息...</p>
            </div>
          )}

          {scanResult && (
            <>
              {!scanResult.is_admin && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>当前可以检测，但删除驱动包需要以管理员身份运行 LightC。</span>
                </div>
              )}

              {scanResult.packages.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="未发现第三方驱动包" description="pnputil 没有返回可分析的第三方驱动包。" tone="success" />
              ) : (
                <div className="space-y-2">
                  {scanResult.packages.map((packageInfo) => {
                    const selected = selectedNames.has(packageInfo.published_name);
                    return (
                      <label key={packageInfo.published_name} className={`block rounded-xl border p-3 transition ${packageInfo.actionable ? 'border-[var(--border-default)] hover:border-emerald-500/40' : 'border-[var(--border-muted)] opacity-70'}`}>
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={!packageInfo.actionable || !scanResult.is_admin || deleting}
                            onChange={() => toggleSelection(packageInfo.published_name)}
                            className="mt-1 h-4 w-4 accent-emerald-500"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-sm text-[var(--fg-primary)]">{packageInfo.provider_name || '未知厂商'}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] ${packageInfo.actionable ? 'bg-emerald-500/10 text-emerald-600' : 'bg-[var(--bg-hover)] text-[var(--fg-muted)]'}`}>{getStatusLabel(packageInfo)}</span>
                              <span className="text-[11px] text-[var(--fg-muted)]">{packageInfo.published_name}</span>
                            </div>
                            <p className="mt-1 text-xs text-[var(--fg-secondary)]">{packageInfo.original_name} · {packageInfo.driver_version || '版本未知'} · {packageInfo.class_name || '类别未知'}</p>
                            <p className="mt-1 text-[11px] text-[var(--fg-muted)]">{packageInfo.reason}</p>
                            <p className="mt-1 text-[11px] text-[var(--fg-muted)]">关联设备 {packageInfo.device_count} 个 · 驱动文件 {packageInfo.file_count} 个</p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--bg-elevated)] px-3 py-2 text-[11px] text-[var(--fg-muted)]">
                <span><Archive className="mr-1 inline h-3.5 w-3.5" />删除前会先导出驱动包备份，不使用强制删除。</span>
                <div className="flex gap-2">
                  <button onClick={() => {
                    void openDriverBackupDir().catch((error) => {
                      showToast({ title: '打开备份目录失败', description: String(error), type: 'error' });
                    });
                  }} className="inline-flex items-center gap-1 text-[var(--brand-green)] hover:underline"><FolderOpen className="h-3.5 w-3.5" />打开备份目录</button>
                  <button disabled={selectedNames.size === 0 || !scanResult.is_admin || deleting} onClick={() => setShowConfirm(true)} className="inline-flex items-center gap-1 rounded-lg bg-rose-500 px-3 py-1.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />删除选中 ({selectedNames.size})</button>
                </div>
              </div>
            </>
          )}
        </div>
      </ModuleCard>

      <ConfirmDialog
        isOpen={showConfirm}
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => void handleDelete()}
        title="确认删除旧驱动包"
        description={`将备份并删除选中的 ${selectedNames.size} 个驱动包。删除前后后端都会重新校验设备绑定状态。`}
        warning="仅删除未关联设备且已有更新版本的候选项；不会使用 /force，不会直接删除 .sys 文件。备份失败时会自动阻止删除。"
        confirmText="备份并删除"
        cancelText="取消"
        isDanger
      />
    </>
  );
}

export default DriverCleanupModule;

// ============================================================================
// 垃圾软件清理模块
// 扫描注册表中常见捆绑/推广软件，用户确认后调用官方卸载程序。
// ============================================================================

import { useCallback, useMemo, useState } from 'react';
import { Ban, CheckCircle2, FolderOpen, Loader2, ShieldOff, Trash2 } from 'lucide-react';
import { ModuleCard } from '../ModuleCard';
import { ConfirmDialog } from '../ConfirmDialog';
import { OperationProgressOverlay } from '../OperationProgressOverlay';
import { EmptyState } from '../EmptyState';
import { EmptyScanAction } from '../EmptyScanAction';
import { ModulePageContent } from '../ModulePageContent';
import { ModuleScanPanel } from '../ModuleScanPanel';
import { AdminElevationBanner } from '../AdminElevationBanner';
import { Checkbox } from '../ui/Checkbox';
import { useToast } from '../Toast';
import { useModuleDashboard } from '../../contexts/DashboardContext';
import {
  openInFolder,
  recordCleanupAction,
  scanBloatware,
  uninstallBloatware,
  type BloatwareItem,
  type BloatwareScanResult,
  type CleanupLogEntryInput,
} from '../../api/commands';
import { shouldSkipInactivePageRender, type ModuleRenderProps } from './moduleProps';
import { useOneClickScanListener } from '../../hooks/useOneClickScanListener';

export function BloatwareModule({ layoutMode = 'cards', isPageActive = true }: ModuleRenderProps) {
  const { moduleState, expandedModule, setExpandedModule, updateModuleState, triggerHealthRefresh } =
    useModuleDashboard('bloatware');
  const { showToast } = useToast();

  const [scanResult, setScanResult] = useState<BloatwareScanResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);

  const selectedItems = useMemo(() => {
    if (!scanResult) return [];
    return scanResult.items.filter((item) => selectedIds.has(item.id));
  }, [scanResult, selectedIds]);

  const handleScan = useCallback(async () => {
    updateModuleState('bloatware', { status: 'scanning', error: null });
    setScanResult(null);
    setSelectedIds(new Set());

    try {
      const result = await scanBloatware();
      setScanResult(result);
      // 卸载属于高风险操作，首版默认不勾选，由用户逐项确认
      setSelectedIds(new Set());

      updateModuleState('bloatware', {
        status: 'done',
        fileCount: result.total_count,
        totalSize: 0,
      });
      setExpandedModule('bloatware-clean');
    } catch (error) {
      console.error('垃圾软件扫描失败:', error);
      updateModuleState('bloatware', { status: 'error', error: String(error) });
    }
  }, [setExpandedModule, updateModuleState]);

  useOneClickScanListener('bloatware', handleScan);

  const toggleSelection = useCallback((itemId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (!scanResult) return;
    if (selectedIds.size === scanResult.items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(scanResult.items.map((item) => item.id)));
    }
  }, [scanResult, selectedIds.size]);

  const handleUninstall = useCallback(async () => {
    if (selectedItems.length === 0) return;

    setShowConfirm(false);
    setIsUninstalling(true);

    try {
      const result = await uninstallBloatware(
        selectedItems.map((item) => ({
          id: item.id,
          display_name: item.display_name,
          uninstall_command: item.uninstall_command,
          silent_uninstall_command: item.silent_uninstall_command,
        })),
      );

      const logEntries: CleanupLogEntryInput[] = result.results.map((entry) => ({
        category: '垃圾软件清理',
        path: entry.display_name,
        size: 0,
        success: entry.success,
        error_message: entry.success ? undefined : entry.message,
      }));
      recordCleanupAction(logEntries).catch((err) => {
        console.warn('记录清理日志失败:', err);
      });

      showToast({
        title: result.failed_count === 0 ? '卸载完成' : '卸载部分完成',
        description: `成功 ${result.success_count} 个，失败 ${result.failed_count} 个。建议重新扫描并检查卸载残留/注册表模块。`,
        type: result.failed_count === 0 ? 'success' : 'warning',
      });

      setSelectedIds(new Set());
      triggerHealthRefresh();
      await handleScan();
    } catch (error) {
      showToast({ title: '卸载失败', description: String(error), type: 'error' });
    } finally {
      setIsUninstalling(false);
    }
  }, [handleScan, selectedItems, showToast, triggerHealthRefresh]);

  const isExpanded = expandedModule === 'bloatware-clean';

  if (shouldSkipInactivePageRender(layoutMode, isPageActive) && !isUninstalling && !showConfirm) {
    return null;
  }

  return (
    <>
      <OperationProgressOverlay
        isOpen={isUninstalling}
        title="正在卸载软件"
        description={`正在依次执行 ${selectedItems.length} 个卸载程序，请勿关闭应用…`}
        tone="warning"
      />

      <ModuleCard
        variant={layoutMode === 'pages' ? 'page' : 'card'}
        forceExpanded={layoutMode === 'pages'}
        id="bloatware-clean"
        title="垃圾软件清理"
        description="识别 360、鲁大师等常见捆绑软件，调用官方卸载程序"
        icon={<ShieldOff className="h-6 w-6 text-[var(--brand-green)]" />}
        status={moduleState.status}
        fileCount={moduleState.fileCount}
        totalSize={0}
        countLabel="个软件"
        hideTotalSize
        hideDoneBadge
        emptyDoneBadgeText="未发现匹配项"
        expanded={isExpanded}
        onToggleExpand={() => setExpandedModule(isExpanded ? null : 'bloatware-clean')}
        onScan={() => void handleScan()}
        scanDisabled={isUninstalling}
        scanButtonText={moduleState.status === 'scanning' ? '扫描中...' : scanResult ? '重新扫描' : '开始扫描'}
        error={moduleState.error}
        titleExtra={
          scanResult ? (
            <span
              className={`rounded-full bg-[var(--bg-hover)] px-2 py-1 text-xs ${
                scanResult.is_admin ? 'text-[var(--brand-green)]' : 'text-orange-600 dark:text-orange-400'
              }`}
            >
              {scanResult.is_admin ? '管理员' : '可扫描，卸载建议提权'}
            </span>
          ) : null
        }
      >
        {moduleState.status === 'idle' && !scanResult && (
          <ModulePageContent layoutMode={layoutMode} centerIdle>
            <EmptyState
              page={layoutMode === 'pages'}
              icon={Ban}
              title="尚未扫描垃圾软件"
              description="通过注册表 Uninstall 项匹配常见捆绑/推广软件，卸载前请确认是否仍需保留。"
              action={<EmptyScanAction onClick={() => void handleScan()} />}
            />
          </ModulePageContent>
        )}

        {moduleState.status === 'scanning' && !scanResult && (
          <ModuleScanPanel
            icon={ShieldOff}
            title="正在扫描已安装软件"
            description="正在读取注册表 Uninstall 项，匹配 360、鲁大师、2345 等特征库条目，并过滤 Microsoft 等可信发布者。"
          />
        )}

        {scanResult && (
          <div className="space-y-4 p-5">
            {!scanResult.is_admin && (
              <AdminElevationBanner message="当前可以扫描匹配项，但部分卸载程序可能需要管理员权限才能完整执行。" />
            )}

            {scanResult.items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-[var(--brand-green)]" />
                <p className="text-sm font-medium text-[var(--text-primary)]">未发现匹配的垃圾软件</p>
                <p className="text-xs text-[var(--text-muted)]">特征库未命中时不会展示任何条目。</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-sm text-[var(--brand-green)] hover:underline"
                    >
                      {selectedIds.size === scanResult.items.length ? '取消全选' : '全选'}
                    </button>
                    <span className="text-sm text-[var(--text-muted)]">
                      已选 {selectedIds.size} / {scanResult.items.length} 项
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={selectedIds.size === 0 || isUninstalling || !scanResult.is_admin}
                    onClick={() => setShowConfirm(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isUninstalling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    卸载选中
                  </button>
                </div>

                <div className="space-y-2">
                  {scanResult.items.map((item) => (
                    <BloatwareItemRow
                      key={item.id}
                      item={item}
                      selected={selectedIds.has(item.id)}
                      disabled={isUninstalling || !scanResult.is_admin}
                      onToggle={() => toggleSelection(item.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </ModuleCard>

      <ConfirmDialog
        isOpen={showConfirm}
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => void handleUninstall()}
        title="确认卸载选中软件"
        description={`将依次调用 ${selectedItems.length} 个软件的官方卸载程序。`}
        warning="卸载后可能仍有残留文件夹或注册表项，建议在「卸载残留」「注册表冗余」模块中再次检查。部分软件卸载过程中可能弹出其自身界面。"
        confirmText="确认卸载"
        cancelText="取消"
        isDanger
      />
    </>
  );
}

interface BloatwareItemRowProps {
  item: BloatwareItem;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}

function BloatwareItemRow({ item, selected, disabled, onToggle }: BloatwareItemRowProps) {
  return (
    <label className="block rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3 transition hover:border-[var(--brand-green)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <Checkbox checked={selected} disabled={disabled} onChange={onToggle} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-[var(--fg-primary)]" title={item.display_name}>
              {item.display_name}
            </span>
            <span className="shrink-0 rounded-full bg-[var(--bg-hover)] px-2 py-0.5 text-xs text-[var(--brand-green)]">
              {item.signature_label}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
            {item.publisher && <span title={item.publisher}>发布者 {item.publisher}</span>}
            {item.estimated_size_mb != null && item.estimated_size_mb > 0 && (
              <span>约 {item.estimated_size_mb} MB</span>
            )}
            <span className="rounded-full bg-[var(--bg-hover)] px-2 py-0.5">{item.match_reason}</span>
          </div>
        </div>
        {item.install_location && (
          <button
            type="button"
            title="打开安装目录"
            disabled={disabled}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void openInFolder(item.install_location!).catch(() => undefined);
            }}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--brand-green-10)] hover:text-[var(--brand-green)] disabled:opacity-40"
          >
            <FolderOpen className="h-4 w-4" />
          </button>
        )}
      </div>
    </label>
  );
}

export default BloatwareModule;

// ============================================================================
// 垃圾清理模块组件
// 在仪表盘中展示垃圾文件扫描和清理功能
// ============================================================================

import { useState, useCallback, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { ModuleCard } from '../ModuleCard';
import { CategoryCard } from '../CategoryCard';
import { ScanSummary } from '../ScanSummary';
import { ConfirmDialog } from '../ConfirmDialog';
import { OperationProgressOverlay } from '../OperationProgressOverlay';
import { EmptyState } from '../EmptyState';
import { EmptyScanAction } from '../EmptyScanAction';
import { ModulePageContent } from '../ModulePageContent';
import { ModuleScanPanel } from '../ModuleScanPanel';
import { useToast } from '../Toast';
import { useModuleDashboard } from '../../contexts/DashboardContext';
import { useOneClickScanListener } from '../../hooks/useOneClickScanListener';
import { scanJunkFiles, enhancedDeleteFiles, recordCleanupAction, type EnhancedDeleteResult, type CleanupLogEntryInput } from '../../api/commands';
import { formatSize } from '../../utils/format';
import type { ScanResult, FileInfo } from '../../types';
import { shouldSkipInactivePageRender, type ModuleRenderProps } from './moduleProps';

// ============================================================================
// 组件实现
// ============================================================================

export function JunkCleanModule({ layoutMode = 'cards', isPageActive = true }: ModuleRenderProps) {
  const { moduleState, expandedModule, setExpandedModule, updateModuleState, triggerHealthRefresh } = useModuleDashboard('junk');
  const { showToast } = useToast();

  // 本地状态
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [deleteResult, setDeleteResult] = useState<EnhancedDeleteResult | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 计算选中文件大小
  const selectedSize = useMemo(() => {
    if (!scanResult) return 0;
    let total = 0;
    for (const category of scanResult.categories) {
      for (const f of category.files) {
        if (selectedPaths.has(f.path)) {
          total += f.size;
        }
      }
    }
    return total;
  }, [scanResult, selectedPaths]);

  // 开始扫描
  const handleScan = useCallback(async () => {
    updateModuleState('junk', { status: 'scanning', error: null });
    setScanResult(null);
    setDeleteResult(null);
    setSelectedPaths(new Set());

    try {
      const result = await scanJunkFiles();
      setScanResult(result);
      
      // 默认选中风险等级 <= 2 的文件
      const defaultSelected = new Set<string>();
      result.categories.forEach((category) => {
        if (category.risk_level <= 2) {
          category.files.forEach((file) => {
            defaultSelected.add(file.path);
          });
        }
      });
      setSelectedPaths(defaultSelected);

      updateModuleState('junk', {
        status: 'done',
        fileCount: result.total_file_count,
        totalSize: result.total_size,
      });

      // 自动展开模块
      setExpandedModule('junk');
    } catch (err) {
      console.error('扫描失败:', err);
      updateModuleState('junk', { status: 'error', error: String(err) });
    }
  }, [updateModuleState, setExpandedModule]);

  useOneClickScanListener('junk', handleScan);

  // 执行删除
  const handleDelete = useCallback(async () => {
    if (selectedPaths.size === 0) return;

    setIsDeleting(true);
    try {
      const paths = Array.from(selectedPaths);
      const result = await enhancedDeleteFiles(paths);
      setDeleteResult(result);

      // 记录清理日志（所有操作都记录，包括成功和失败）
      if (result.file_results.length > 0) {
        const logEntries: CleanupLogEntryInput[] = result.file_results.map((f) => ({
          category: '垃圾清理',
          path: f.path,
          size: f.physical_size,
          success: f.success,
          error_message: f.failure_reason ? JSON.stringify(f.failure_reason) : undefined,
        }));
        // 异步记录日志，不阻塞 UI
        recordCleanupAction(logEntries).catch((err) => {
          console.warn('记录清理日志失败:', err);
          showToast({
            type: 'warning',
            title: '清理完成，但日志记录失败',
            description: String(err),
          });
        });
      }

      if (result.success_count > 0) {
        const blockedText = result.failed_count > 0
          ? `，${result.failed_count} 个文件清理失败`
          : '';
        const rebootText = result.reboot_pending_count > 0
          ? `，${result.reboot_pending_count} 个文件将在重启后删除`
          : '';
        showToast({
          type: result.failed_count > 0 || result.reboot_pending_count > 0 ? 'warning' : 'success',
          title: '垃圾清理完成',
          description: `${result.summary_message || `成功释放 ${formatSize(result.freed_physical_size)}`}${blockedText}${rebootText}`,
        });
      } else if (result.failed_count > 0 || result.reboot_pending_count > 0) {
        const firstFailure = result.file_results.find((f) => !f.success && !f.marked_for_reboot);
        showToast({
          type: 'warning',
          title: '清理受阻',
          description: firstFailure
            ? `部分文件未能删除：${firstFailure.path}`
            : result.summary_message || '部分文件将在重启后删除',
        });
      } else {
        showToast({
          type: 'info',
          title: '没有文件被清理',
          description: result.summary_message || '所选文件未发生变化',
        });
      }

      // Shell 清空回收站按盘符处理整组条目，清理后重新扫描才能同步未选中的条目状态。
      if (scanResult && result.success_count > 0) {
        const deletedPaths = new Set(
          result.file_results
            .filter((f) => f.success)
            .map((f) => f.path)
        );
        const hasRecycleBinSuccess = Array.from(deletedPaths).some((path) =>
          path.toLowerCase().includes('\\$recycle.bin\\')
        );

        if (hasRecycleBinSuccess) {
          try {
            const refreshedResult = await scanJunkFiles();
            const visiblePaths = new Set(
              refreshedResult.categories.flatMap((category) => category.files.map((file) => file.path))
            );
            setScanResult(refreshedResult);
            updateModuleState('junk', {
              fileCount: refreshedResult.total_file_count,
              totalSize: refreshedResult.total_size,
            });
            setSelectedPaths((previous) => new Set(
              Array.from(previous).filter((path) => visiblePaths.has(path) && !deletedPaths.has(path))
            ));
            triggerHealthRefresh();
          } catch (refreshError) {
            // 清理已经完成时，重扫失败不应把成功结果改报为删除失败；保留当前结果并提示重试扫描。
            console.warn('清理后刷新回收站扫描失败:', refreshError);
            showToast({
              type: 'warning',
              title: '清理完成，但刷新扫描失败',
              description: '请重新扫描以获取最新回收站状态',
            });
          }
        } else {
          const updatedCategories = scanResult.categories.map((category) => {
            const remainingFiles = category.files.filter((f) => !deletedPaths.has(f.path));
            return {
              ...category,
              files: remainingFiles,
              file_count: remainingFiles.length,
              total_size: remainingFiles.reduce((sum, f) => sum + f.size, 0),
            };
          });

          const newResult = {
            ...scanResult,
            categories: updatedCategories,
            total_file_count: updatedCategories.reduce((acc, c) => acc + c.file_count, 0),
            total_size: updatedCategories.reduce((acc, c) => acc + c.total_size, 0),
          };

          setScanResult(newResult);
          updateModuleState('junk', {
            fileCount: newResult.total_file_count,
            totalSize: newResult.total_size,
          });

          setSelectedPaths((previous) => {
            const nextSelection = new Set(previous);
            deletedPaths.forEach((path) => nextSelection.delete(path));
            return nextSelection;
          });

          triggerHealthRefresh();
        }
      }
    } catch (err) {
      console.error('删除失败:', err);
      showToast({ type: 'error', title: '垃圾清理失败', description: String(err) });
    } finally {
      setIsDeleting(false);
    }
  }, [selectedPaths, scanResult, updateModuleState, triggerHealthRefresh, showToast]);

  // 切换文件选中状态
  const toggleFileSelection = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  // 切换分类选中状态
  const toggleCategorySelection = useCallback((files: FileInfo[], selected: boolean) => {
    setSelectedPaths((prev) => {
      const newSet = new Set(prev);
      files.forEach((file) => {
        if (selected) {
          newSet.add(file.path);
        } else {
          newSet.delete(file.path);
        }
      });
      return newSet;
    });
  }, []);

  // 全选/取消全选
  const toggleAllSelection = useCallback((selected: boolean) => {
    if (!scanResult) return;
    if (selected) {
      const allPaths = new Set<string>();
      scanResult.categories.forEach((category) => {
        category.files.forEach((file) => {
          allPaths.add(file.path);
        });
      });
      setSelectedPaths(allPaths);
    } else {
      setSelectedPaths(new Set());
    }
  }, [scanResult]);

  const isExpanded = expandedModule === 'junk';

  if (shouldSkipInactivePageRender(layoutMode, isPageActive) && !isDeleting && !showDeleteConfirm) {
    return null;
  }

  return (
    <>
      <OperationProgressOverlay
        isOpen={isDeleting}
        title="正在清理垃圾文件"
        description={`正在删除 ${selectedPaths.size.toLocaleString()} 个文件，请稍候…`}
        tone="brand"
      />

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="确认清理"
        description={`您即将删除 ${selectedPaths.size.toLocaleString()} 个文件，预计释放 ${formatSize(selectedSize)} 空间。此操作不可撤销。`}
        warning="免责声明：本软件仅清理常见的系统垃圾文件，但不对任何数据丢失承担责任。请确保您已了解所选文件的内容，重要数据请提前备份。"
        confirmText="确认清理"
        cancelText="取消"
        onConfirm={() => {
          setShowDeleteConfirm(false);
          handleDelete();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        isDanger
      />

      <ModuleCard
        variant={layoutMode === 'pages' ? 'page' : 'card'}
        forceExpanded={layoutMode === 'pages'}
        id="junk"
        title="垃圾清理"
        description="清理系统缓存、临时文件、日志等垃圾文件"
        icon={<Trash2 className="w-6 h-6 text-[var(--brand-green)]" />}
        status={moduleState.status}
        fileCount={moduleState.fileCount}
        totalSize={moduleState.totalSize}
        expanded={isExpanded}
        onToggleExpand={() => setExpandedModule(isExpanded ? null : 'junk')}
        onScan={handleScan}
        error={moduleState.error}
        headerExtra={
          scanResult && scanResult.total_file_count > 0 && (
            <>
              <div className="module-toolbar-segment">
                <button type="button" onClick={() => toggleAllSelection(true)} className="module-toolbar-link">
                  全选
                </button>
                <button type="button" onClick={() => toggleAllSelection(false)} className="module-toolbar-link">
                  取消
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={selectedPaths.size === 0}
                className={`module-toolbar-danger ${selectedPaths.size === 0 ? 'module-toolbar-danger-disabled' : ''}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                清理 {selectedPaths.size > 0 ? selectedPaths.size : ''}
              </button>
            </>
          )
        }
      >
        {/* 展开内容：页面模式 idle 时不包 p-4，避免圆角卡片底部露出白条 */}
        {layoutMode === 'pages' && moduleState.status === 'idle' && !scanResult ? (
          <ModulePageContent layoutMode={layoutMode} centerIdle>
            <EmptyState
              page
              icon={Trash2}
              title="尚未扫描垃圾文件"
              description="查找系统缓存、临时文件和日志等可清理内容。"
              action={<EmptyScanAction onClick={handleScan} />}
            />
          </ModulePageContent>
        ) : (
        <div className={layoutMode === 'pages' ? 'module-page-content module-page-content--filled' : 'p-4 space-y-3'}>
          {/* 扫描结果摘要 */}
          {scanResult && (
            <ScanSummary
              scanResult={scanResult}
              deleteResult={deleteResult}
              selectedCount={selectedPaths.size}
              selectedSize={selectedSize}
              onClearDeleteResult={() => setDeleteResult(null)}
            />
          )}

          {/* 分类列表 */}
          {scanResult ? (
            <div className="space-y-2">
              {scanResult.categories
                .filter((c) => c.files.length > 0)
                .sort((a, b) => b.total_size - a.total_size)
                .map((category) => (
                  <CategoryCard
                    key={category.display_name}
                    category={category}
                    selectedPaths={selectedPaths}
                    onToggleFile={toggleFileSelection}
                    onToggleCategory={toggleCategorySelection}
                  />
                ))}

              {scanResult.categories.every((c) => c.files.length === 0) && (
                <EmptyState
                  icon={Trash2}
                  title="没有发现可清理的垃圾文件"
                  description="常见临时文件、缓存和日志都很干净。"
                  tone="success"
                  compact
                />
              )}
            </div>
          ) : moduleState.status === 'scanning' ? (
            <ModuleScanPanel
              icon={Trash2}
              title="正在扫描垃圾文件"
              description="正在并行检查系统缓存、临时文件、回收站与日志等常见垃圾分类"
            />
          ) : null}
        </div>
        )}
      </ModuleCard>
    </>
  );
}

export default JunkCleanModule;

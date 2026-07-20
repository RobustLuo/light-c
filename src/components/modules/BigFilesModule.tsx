// ============================================================================
// 大文件清理模块组件
// 在仪表盘中展示大文件扫描和清理功能
// ============================================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { FileBox, Trash2, FileWarning, FolderOpen, ExternalLink, StopCircle, Search } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { ModuleCard } from '../ModuleCard';
import { ConfirmDialog } from '../ConfirmDialog';
import { OperationProgressOverlay } from '../OperationProgressOverlay';
import { EmptyState } from '../EmptyState';
import { EmptyScanAction } from '../EmptyScanAction';
import { ModulePageContent } from '../ModulePageContent';
import { ModuleScanPanel, ModuleScanStatusBar } from '../ModuleScanPanel';
import { useToast } from '../Toast';
import {
  defaultDriveLetter,
  DriveSelect,
  driveDisplayName,
  normalizeDriveLetter,
  useLocalDrives,
} from '../ui/DriveSelect';
import { useModuleDashboard } from '../../contexts/DashboardContext';
import { useSettings } from '../../contexts';
import { scanLargeFiles, cancelLargeFileScan, deleteFiles, openInFolder, openFile, recordCleanupAction, type CleanupLogEntryInput } from '../../api/commands';
import { formatSize, formatDate, getRiskLevelColor, getRiskLevelBgColor, getRiskLevelText } from '../../utils/format';
import { openSearchUrl } from '../../utils/searchEngine';
import type { LargeFileEntry, LargeFileScanProgress } from '../../types';
import { shouldSkipInactivePageRender, type ModuleRenderProps } from './moduleProps';
import { useOneClickScanListener } from '../../hooks/useOneClickScanListener';

// ============================================================================
// 组件实现
// ============================================================================

export function BigFilesModule({ layoutMode = 'cards', isPageActive = true }: ModuleRenderProps) {
  const { moduleState, expandedModule, setExpandedModule, updateModuleState, triggerHealthRefresh } = useModuleDashboard('bigFiles');
  const { showToast } = useToast();
  const { settings } = useSettings();
  const { drives } = useLocalDrives();

  // 防止重复扫描
  const scanningRef = useRef(false);
  // 扫描开始时间
  const scanStartRef = useRef(0);

  // 本地状态
  const [files, setFiles] = useState<LargeFileEntry[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [currentPath, setCurrentPath] = useState('');
  const [scanBackend, setScanBackend] = useState(''); // "mft" | "walkdir"
  const [scanStage, setScanStage] = useState('');
  const [scanMessage, setScanMessage] = useState('');
  const [backendElapsedMs, setBackendElapsedMs] = useState(0);
  const [scannedCount, setScannedCount] = useState(0);
  const [scanElapsed, setScanElapsed] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedDriveLetter, setSelectedDriveLetter] = useState('C:');
  const selectedDriveLabel = driveDisplayName(selectedDriveLetter);

  useEffect(() => {
    if (drives.length > 0) {
      setSelectedDriveLetter((current) => {
        const normalized = normalizeDriveLetter(current);
        return drives.some((drive) => drive.drive_letter === normalized)
          ? normalized
          : defaultDriveLetter(drives);
      });
    }
  }, [drives]);

  const resetBigFilesResult = useCallback(() => {
    // 切换磁盘后旧结果已经不再对应当前目标盘，必须清空避免用户误删其他盘文件。
    setFiles([]);
    setSelectedFiles(new Set());
    setCurrentPath('');
    setScanBackend('');
    setScanStage('');
    setScanMessage('');
    setBackendElapsedMs(0);
    setScannedCount(0);
    updateModuleState('bigFiles', { status: 'idle', error: null, fileCount: 0, totalSize: 0, progress: 0 });
  }, [updateModuleState]);

  const handleDriveChange = useCallback((driveLetter: string) => {
    if (scanningRef.current) return;
    setSelectedDriveLetter(normalizeDriveLetter(driveLetter));
    resetBigFilesResult();
  }, [resetBigFilesResult]);

  // 监听扫描进度事件
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      unlisten = await listen<LargeFileScanProgress>('large-file-scan:progress', (event) => {
        const { current_path, scanned_count, backend, stage, message, elapsed_ms } = event.payload;
        setCurrentPath(current_path);
        setScannedCount(scanned_count);
        setScanStage(stage || '');
        setScanMessage(message || current_path);
        setBackendElapsedMs(elapsed_ms || 0);
        if (backend) {
          setScanBackend(backend);
        }
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // 扫描计时器
  useEffect(() => {
    if (moduleState.status !== 'scanning') { setScanElapsed(0); return; }
    const interval = setInterval(() => {
      if (scanStartRef.current > 0) {
        setScanElapsed(Math.floor((performance.now() - scanStartRef.current) / 1000));
      }
    }, 200);
    return () => clearInterval(interval);
  }, [moduleState.status]);

  // 开始扫描 (带防抖 — scanningRef 防止重复触发)
  const handleScan = useCallback(async () => {
    if (scanningRef.current) return;
    scanningRef.current = true;

    updateModuleState('bigFiles', { status: 'scanning', error: null });
    setFiles([]);
    setCurrentPath('');
    setScanBackend('');
    setScanStage('');
    setScanMessage('');
    setBackendElapsedMs(0);
    setScannedCount(0);
    setScanElapsed(0);
    scanStartRef.current = performance.now();
    setSelectedFiles(new Set());

    try {
      const results = await scanLargeFiles(settings.bigFilesScanLimit, selectedDriveLetter);
      setFiles(results);

      const totalSize = results.reduce((sum, f) => sum + f.size, 0);
      updateModuleState('bigFiles', {
        status: 'done',
        fileCount: results.length,
        totalSize,
      });

      setExpandedModule('bigFiles');
    } catch (err) {
      console.error('扫描大文件失败:', err);
      updateModuleState('bigFiles', { status: 'error', error: String(err) });
    } finally {
      scanningRef.current = false;
    }
  }, [updateModuleState, setExpandedModule, settings.bigFilesScanLimit, selectedDriveLetter]);

  useOneClickScanListener('bigFiles', handleScan);

  // 停止扫描
  const handleStopScan = useCallback(async () => {
    try {
      await cancelLargeFileScan();
      showToast({ type: 'info', title: '扫描已停止', description: '将显示已扫描到的大文件' });
    } catch (err) {
      console.error('停止扫描失败:', err);
    }
  }, [showToast]);

  // 切换文件选中状态（后端风险等级 >= 4 锁定不可选）
  const handleSearchFile = useCallback(async (path: string) => {
    try {
      // 搜索时带上完整路径，帮助用户在删除前确认文件来源和风险。
      await openSearchUrl(`Windows 文件 ${path} 可以删除吗`);
    } catch (err) {
      console.error('搜索文件用途失败:', err);
      showToast({
        type: 'error',
        title: '打开搜索失败',
        description: String(err),
      });
    }
  }, [showToast]);

  const toggleFileSelection = useCallback((path: string, riskLevel: number) => {
    if (riskLevel >= 4) return;

    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // 全选/取消全选（后端风险等级 >= 4 锁定不可选）
  const toggleSelectAll = useCallback(() => {
    const selectable = files.filter((f) => f.risk_level <= 3);
    if (selectedFiles.size === selectable.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(selectable.map((f) => f.path)));
    }
  }, [selectedFiles.size, files]);

  // 执行删除
  const handleDelete = useCallback(async () => {
    const paths = Array.from(selectedFiles);
    if (paths.length === 0) return;

    setIsDeleting(true);

    try {
      const result = await deleteFiles(paths);

      // 记录清理日志（所有操作都记录）
      const failedPathSet = new Set(result.failed_files?.map((f) => f.path) || []);
      const logEntries: CleanupLogEntryInput[] = paths.map((path) => {
        const file = files.find((f) => f.path === path);
        const failedFile = result.failed_files?.find((f) => f.path === path);
        return {
          category: '大文件清理',
          path,
          size: file?.size || 0,
          success: !failedPathSet.has(path),
          error_message: failedFile?.reason,
        };
      });
      recordCleanupAction(logEntries).catch((err) => {
        console.warn('记录清理日志失败:', err);
      });

      if (result.failed_count === 0) {
        showToast({
          type: 'success',
          title: `成功删除 ${result.success_count} 个文件`,
          description: `已释放 ${formatSize(result.freed_size)} 空间`,
        });
      } else if (result.success_count === 0) {
        showToast({
          type: 'error',
          title: '删除失败',
          description: `${result.failed_count} 个文件无法删除`,
        });
      } else {
        showToast({
          type: 'warning',
          title: '部分成功',
          description: `${result.success_count} 个已删除，${result.failed_count} 个失败`,
        });
      }

      // 从列表中移除成功删除的文件，以返回结果为准重建状态
      if (result.success_count > 0) {
        const failedPaths = new Set(result.failed_files?.map((f) => f.path) ?? []);

        // 从文件列表中移除成功删除的（选中且不在失败列表中的）
        const newFiles = files.filter(
          (file) => !selectedFiles.has(file.path) || failedPaths.has(file.path)
        );
        setFiles(newFiles);

        // 选中状态只保留实际失败的文件
        setSelectedFiles(
          new Set([...failedPaths].filter((p) => selectedFiles.has(p)))
        );

        const newTotalSize = newFiles.reduce((sum, f) => sum + f.size, 0);
        updateModuleState('bigFiles', {
          fileCount: newFiles.length,
          totalSize: newTotalSize,
        });

        triggerHealthRefresh();
      }
    } catch (err) {
      console.error('删除大文件失败:', err);
      showToast({
        type: 'error',
        title: '删除失败',
        description: String(err),
      });
    } finally {
      setIsDeleting(false);
    }
  }, [selectedFiles, files, updateModuleState, triggerHealthRefresh, showToast]);

  // 计算选中文件的总大小
  const selectedSize = files
    .filter((f) => selectedFiles.has(f.path))
    .reduce((sum, f) => sum + f.size, 0);

  // 可选中文件数量（risk_level >= 4 被锁定，不可选）
  const selectableCount = files.filter((f) => f.risk_level <= 3).length;

  const isExpanded = expandedModule === 'bigFiles';
  const isScanning = moduleState.status === 'scanning';
  const displayElapsedSeconds = isScanning
    ? scanElapsed
    : Math.round(backendElapsedMs / 1000);
  const driveSelector = (
    <div className="flex items-center gap-2 shrink-0" onClick={(event) => event.stopPropagation()}>
      <DriveSelect
        value={selectedDriveLetter}
        drives={drives}
        onChange={handleDriveChange}
        disabled={isScanning}
      />
    </div>
  );

  if (shouldSkipInactivePageRender(layoutMode, isPageActive) && !isDeleting && !showDeleteConfirm) {
    return null;
  }

  return (
    <>
      <OperationProgressOverlay
        isOpen={isDeleting}
        title="正在删除文件"
        description={`正在删除 ${selectedFiles.size.toLocaleString()} 个文件，请稍候…`}
        tone="brand"
      />

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="确认删除大文件"
        description={`您即将删除 ${selectedFiles.size.toLocaleString()} 个大文件，共 ${formatSize(selectedSize)}。此操作不可撤销。`}
        warning="免责声明：大文件删除可能影响系统或软件正常运行，请确认文件用途后再执行。"
        confirmText="确认删除"
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
        id="bigFiles"
        title="大文件清理"
        description={`扫描 ${selectedDriveLabel} 体积最大的文件，快速释放存储空间`}
        icon={<FileBox className="w-6 h-6 text-[var(--brand-green)]" />}
        status={moduleState.status}
        fileCount={moduleState.fileCount}
        totalSize={moduleState.totalSize}
        expanded={isExpanded}
        onToggleExpand={() => setExpandedModule(isExpanded ? null : 'bigFiles')}
        onScan={handleScan}
        error={moduleState.error}
        titleExtra={driveSelector}
        headerExtra={
          <>
            {isScanning && (
              <button
                onClick={handleStopScan}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg text-xs font-medium text-amber-600 transition"
              >
                <StopCircle className="w-3.5 h-3.5" />
                停止
              </button>
            )}
            {files.length > 0 && !isScanning && (
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="text-xs text-[var(--fg-muted)] hover:text-emerald-600 transition"
                >
                  {selectedFiles.size === selectableCount && selectableCount > 0 ? '取消全选' : '全选'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={selectedFiles.size === 0}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                    ${selectedFiles.size === 0
                      ? 'bg-[var(--bg-hover)] text-[var(--fg-faint)] cursor-not-allowed'
                      : 'bg-rose-500 text-white hover:bg-rose-600'
                    }
                  `}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  删除 ({selectedFiles.size})
                </button>
              </div>
            )}
          </>
        }
      >
        {/* 展开内容：页面模式 idle 时不包 min-h，避免圆角卡片底部留白 */}
        {layoutMode === 'pages' && moduleState.status === 'idle' && files.length === 0 ? (
          <ModulePageContent layoutMode={layoutMode} centerIdle>
            <EmptyState
              page
              icon={FileBox}
              title="尚未扫描大文件"
              description="快速找出占用空间较大的文件。"
              action={<EmptyScanAction onClick={handleScan} disabled={isScanning} />}
            />
          </ModulePageContent>
        ) : (
        <div className={layoutMode === 'pages' ? 'module-page-content module-page-content--filled' : ''}>
          {/* 扫描进度 + 引擎 + 时长（扫描中 & 扫描完成后都显示） */}
          {(isScanning || scanBackend) && currentPath && (
            <ModuleScanStatusBar
              message={scanMessage || currentPath}
              isScanning={isScanning}
              backend={scanBackend}
              backendLabel={scanBackend === 'mft' ? 'MFT 全量扫描' : scanBackend === 'walkdir' ? '常规' : undefined}
              fileCount={scannedCount}
              stage={scanStage && scanBackend === 'mft' ? scanStage : undefined}
              elapsedSeconds={displayElapsedSeconds > 0 ? displayElapsedSeconds : undefined}
            />
          )}

          {/* 空状态（卡片模式） */}
          {layoutMode !== 'pages' && moduleState.status === 'idle' && files.length === 0 && (
            <div className="p-4">
              <EmptyState
                icon={FileBox}
                title="尚未扫描大文件"
                description="快速找出占用空间较大的文件。"
                action={<EmptyScanAction onClick={handleScan} disabled={isScanning} />}
              />
            </div>
          )}

          {/* 扫描中状态 */}
          {isScanning && files.length === 0 && (
            <ModuleScanPanel
              icon={FileBox}
              title={
                scanBackend === 'mft'
                  ? `MFT 全量模式扫描 ${selectedDriveLabel}`
                  : scanBackend === 'walkdir'
                    ? `正在遍历 ${selectedDriveLabel} 文件`
                    : '正在扫描大文件'
              }
              description={
                scanBackend === 'mft'
                  ? '通过 MFT 直读快速枚举全分区文件，并按体积排序'
                  : '正在遍历磁盘文件并识别体积较大的项目'
              }
              detail={scanMessage || undefined}
              backend={scanBackend}
              stats={[
                ...(scannedCount > 0
                  ? [{ label: '已扫描', value: scannedCount.toLocaleString() }]
                  : []),
                ...(displayElapsedSeconds > 0
                  ? [{ label: '耗时', value: `${displayElapsedSeconds}s` }]
                  : []),
              ]}
            />
          )}

          {/* 文件列表 */}
          {files.length > 0 && (
            <div className="divide-y divide-[var(--border-default)]">
              {files.map((file, index) => {
                const riskLevel = file.risk_level;
                const isSelected = selectedFiles.has(file.path);
                const isLocked = riskLevel >= 4; // 后端风险等级 >= 4，锁定不可删除

                return (
                  <div
                    key={file.path}
                    onClick={() => toggleFileSelection(file.path, riskLevel)}
                    className={`
                      px-4 py-3 flex items-center gap-3 cursor-pointer transition-all
                      ${isLocked ? 'bg-rose-500/5 cursor-not-allowed' :
                        isSelected ? 'bg-[var(--brand-green-10)] hover:bg-[var(--brand-green-10)]' : 'hover:bg-[var(--bg-hover)]'}
                    `}
                  >
                    {/* 序号 + 复选框 */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="w-5 text-center text-xs font-medium text-[var(--fg-faint)]">
                        {index + 1}
                      </span>
                      <div className={`
                        w-5 h-5 rounded border-2 flex items-center justify-center
                        ${isLocked
                          ? 'border-rose-300 bg-rose-100'
                          : isSelected
                            ? 'bg-[var(--brand-green)] border-[var(--brand-green)] cursor-pointer'
                            : 'border-[var(--text-faint)] cursor-pointer'
                        }
                      `}>
                        {isLocked ? (
                          <svg className="w-3 h-3 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        ) : isSelected ? (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : null}
                      </div>
                    </div>

                    {/* 文件图标 */}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${getRiskLevelBgColor(riskLevel)}`}>
                      <FileWarning className={`w-4 h-4 ${getRiskLevelColor(riskLevel)}`} />
                    </div>

                    {/* 文件信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-[var(--fg-primary)] truncate font-medium" title={file.path}>
                          {file.path.split('\\').pop() || file.path}
                        </p>
                        {file.source_label && file.source_label !== '未知来源' && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium bg-[var(--bg-hover)] text-[var(--fg-muted)]">
                            {file.source_label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--fg-muted)] truncate mt-0.5" title={file.path}>
                        {file.path}
                      </p>
                    </div>

                    {/* 右侧信息 */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-emerald-600">{formatSize(file.size)}</p>
                      <div className="flex items-center justify-end gap-2 mt-0.5">
                        <span className="text-[10px] text-[var(--fg-muted)]">{formatDate(file.modified)}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${getRiskLevelColor(riskLevel)} ${getRiskLevelBgColor(riskLevel)}`}>
                          {isLocked ? '🔒 ' : ''}{getRiskLevelText(riskLevel)}
                        </span>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSearchFile(file.path);
                        }}
                        className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg transition text-[var(--fg-muted)] hover:text-emerald-600"
                        title="搜索该文件能不能删"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openInFolder(file.path);
                        }}
                        className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg transition text-[var(--fg-muted)] hover:text-emerald-600"
                        title="打开所在文件夹"
                      >
                        <FolderOpen className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openFile(file.path);
                        }}
                        className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg transition text-[var(--fg-muted)] hover:text-emerald-600"
                        title="打开文件"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}
      </ModuleCard>
    </>
  );
}

export default BigFilesModule;

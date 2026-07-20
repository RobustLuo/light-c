// ============================================================================
// 大目录分析模块
// 深度分析 AppData 目录，定位占用空间的元凶
// ============================================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Flame, FolderOpen, Clock, HardDrive, ChevronDown, ChevronRight, Search, ShieldAlert, Shield, Eye, Trash2 } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { ModuleCard } from '../ModuleCard';
import { ConfirmDialog } from '../ConfirmDialog';
import { EmptyState } from '../EmptyState';
import { EmptyScanAction } from '../EmptyScanAction';
import { ModulePageContent } from '../ModulePageContent';
import { ModuleScanPanel } from '../ModuleScanPanel';
import {
  defaultDriveLetter,
  DriveSelect,
  driveDisplayName,
  normalizeDriveLetter,
  useLocalDrives,
} from '../ui/DriveSelect';
import { useToast } from '../Toast';
import { useModuleDashboard, useSettings } from '../../contexts';
import { scanHotspot, cancelHotspotScan, openInFolder, cleanupDirectoryContents, type HotspotScanResult, type HotspotEntry, type HotspotScanProgress } from '../../api/commands';
import { formatSize } from '../../utils/format';
import { openSearchUrl } from '../../utils/searchEngine';
import { DrillDownModal } from './DrillDownModal';
import { shouldSkipInactivePageRender, type ModuleRenderProps } from './moduleProps';
import { useOneClickScanListener } from '../../hooks/useOneClickScanListener';

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 格式化时间戳为 YYYY-MM-DD HH:mm
 */
function formatDateTime(timestamp: number): string | null {
  if (!timestamp) return null;
  // MFT 引擎返回 Unix 秒，常规遍历返回毫秒；这里做兼容，避免秒级时间戳被解析到 1970 年。
  const normalizedTimestamp = timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
  const date = new Date(normalizedTimestamp);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 中间省略长路径
 * 例如: C:\Users\xxx\AppData\Local\VeryLongFolderName -> C:\Users\...\VeryLongFolderName
 */
function middleEllipsis(path: string, maxLength: number = 45): string {
  if (path.length <= maxLength) return path;
  
  const parts = path.split('\\');
  if (parts.length <= 3) {
    // 路径太短，直接截断
    return path.slice(0, maxLength - 3) + '...';
  }
  
  // 保留前两部分和最后一部分
  const start = parts.slice(0, 2).join('\\');
  const end = parts[parts.length - 1];
  
  // 如果结尾部分太长，也需要截断
  const availableForEnd = maxLength - start.length - 5; // 5 = "\\...\\".length
  const truncatedEnd = end.length > availableForEnd 
    ? end.slice(0, availableForEnd - 3) + '...'
    : end;
  
  return `${start}\\...\\${truncatedEnd}`;
}

function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return '0.0s';
  return `${(ms / 1000).toFixed(1)}s`;
}

function getProgressStageLabel(stage?: string): string {
  switch (stage) {
    case 'mft':
      return '枚举 MFT';
    case 'index':
      return '建立索引';
    case 'metadata':
      return '读取大小';
    case 'aggregate':
      return '聚合目录';
    case 'result':
      return '生成结果';
    case 'walkdir':
      return '常规遍历';
    default:
      return '扫描中';
  }
}

// 诊断面板同时服务“扫描中”和“扫描完成”状态，避免两套指标重复展示。
function HotspotDiagnostics({
  logs,
  totalElapsedMs,
  currentProgress,
  compact = false,
}: {
  logs: HotspotScanProgress[];
  totalElapsedMs?: number;
  currentProgress?: HotspotScanProgress | null;
  compact?: boolean;
}) {
  if (logs.length === 0 && !totalElapsedMs && !currentProgress) return null;

  const latestLog = currentProgress || logs[logs.length - 1];
  // 相同阶段在监听器里已经合并，这里只负责过滤无效阶段，保持布局稳定。
  const visibleLogs = logs.filter((log) => log.stage && log.stage_elapsed_ms !== undefined);
  const processedCount = latestLog?.scanned_dirs || latestLog?.found_entries || 0;

  return (
    <div className={`rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] px-4 py-3 text-xs ${compact ? 'space-y-2' : 'space-y-3'}`}>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 md:gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 px-2 py-0.5 rounded-md bg-[var(--brand-green)] text-white font-medium">
            {getProgressStageLabel(latestLog?.stage)}
          </span>
          <span className="truncate text-[var(--text-primary)]" title={latestLog?.message || '本次扫描阶段耗时'}>
            {latestLog?.message || '本次扫描阶段耗时'}
          </span>
        </div>
        <div className="flex items-center justify-start md:justify-end gap-4 text-[var(--text-muted)] tabular-nums">
          {processedCount > 0 && <span>已处理 {processedCount.toLocaleString()}</span>}
          {totalElapsedMs !== undefined && <span>总耗时 {formatDuration(totalElapsedMs)}</span>}
        </div>
      </div>
      {visibleLogs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {visibleLogs.map((log, index) => (
            <div
              key={`${log.stage}-${index}`}
              className="min-w-0 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] px-2.5 py-2"
            >
              <div className="truncate text-[var(--text-muted)]">{getProgressStageLabel(log.stage)}</div>
              <div className="mt-0.5 text-[var(--text-primary)] font-semibold tabular-nums">
                {formatDuration(log.stage_elapsed_ms)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 大目录分析条目组件
// ============================================================================

interface HotspotItemProps {
  entry: HotspotEntry;
  rank: number;
  maxSize: number;
  isFullScan: boolean;
  onOpenFolder: (path: string) => void;
  onCleanup: (entry: HotspotEntry) => void;
  onSearch: (path: string) => void;
  parentName?: string;
  isChild?: boolean;
  treeDepth?: number;
  onDrillDown?: (path: string) => void;
}

function HotspotSummary({
  folderCount,
  totalSize,
  durationMs,
}: {
  folderCount: number;
  totalSize: number;
  durationMs: number;
}) {
  return (
    <div className="hotspot-summary-panel">
      <div className="hotspot-summary-panel__aurora" aria-hidden>
        <span className="hotspot-summary-panel__orb hotspot-summary-panel__orb--1" />
        <span className="hotspot-summary-panel__orb hotspot-summary-panel__orb--2" />
      </div>
      <div className="hotspot-summary">
        <div className="hotspot-summary__chip">
          <span className="hotspot-summary__icon" aria-hidden>
            <FolderOpen className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="hotspot-summary__copy">
            <span className="hotspot-summary__value tabular-nums">{folderCount.toLocaleString()}</span>
            <span className="hotspot-summary__label">扫描文件夹</span>
          </div>
        </div>
        <div className="hotspot-summary__chip hotspot-summary__chip--accent">
          <span className="hotspot-summary__icon hotspot-summary__icon--accent" aria-hidden>
            <HardDrive className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="hotspot-summary__copy">
            <span className="hotspot-summary__value tabular-nums">{formatSize(totalSize)}</span>
            <span className="hotspot-summary__label">覆盖总大小</span>
          </div>
        </div>
        <div className="hotspot-summary__chip">
          <span className="hotspot-summary__icon" aria-hidden>
            <Clock className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="hotspot-summary__copy">
            <span className="hotspot-summary__value tabular-nums">{(durationMs / 1000).toFixed(1)}s</span>
            <span className="hotspot-summary__label">扫描耗时</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 前三名序号样式，仅顶级行使用以突出「空间元凶」 */
function getRankBadgeClass(rank: number, isChild?: boolean): string {
  if (isChild || rank > 3) return '';
  return `hotspot-row__rank--top${rank}`;
}

/** 顶级前三名整行轻底色，与序号徽章呼应 */
function getTopRowClass(rank: number, isChild?: boolean): string {
  if (isChild || rank > 3) return '';
  return `hotspot-row--featured-${rank}`;
}

function HotspotItem({ entry, rank, maxSize, isFullScan, onOpenFolder, onCleanup, onSearch, parentName, isChild, treeDepth = 0, onDrillDown }: HotspotItemProps) {
  const { settings } = useSettings();
  const maxTreeDepth = settings.hotspotDepth;
  const percentage = maxSize > 0 ? (entry.total_size / maxSize) * 100 : 0;
  const canCleanup = !isFullScan && entry.is_safe_to_clean && entry.is_cache && !entry.is_program && !entry.is_protected;
  const displayName = parentName ? `${parentName} › ${entry.name}` : entry.name;
  const depthClass = treeDepth > 0 ? `hotspot-row--depth-${Math.min(treeDepth, 3)}` : '';
  const rankBadgeClass = getRankBadgeClass(rank, isChild);
  const featuredRowClass = getTopRowClass(rank, isChild);
  const barPercent = Math.max(percentage, 4);

  return (
    <div className="hotspot-tree-node">
      <div
        className={`hotspot-row group ${depthClass} ${featuredRowClass} ${
          entry.is_protected ? 'hotspot-row--protected' : ''
        } ${isChild ? 'hotspot-row--child' : ''}`}
      >
        <div className={`hotspot-row__rank tabular-nums ${rankBadgeClass}`} aria-hidden>
          {rank}
        </div>

        <div className={`hotspot-row__icon ${entry.is_protected ? 'hotspot-row__icon--danger' : ''}`}>
          <FolderOpen className="hotspot-row__icon-svg" strokeWidth={1.75} />
        </div>

        <div className="hotspot-row__body min-w-0 flex-1">
          <div className="hotspot-row__head">
            <span className="hotspot-row__name truncate" title={displayName}>
              {displayName}
            </span>
            <div className="hotspot-row__tags">
              {entry.depth > 0 && (
                <span className="hotspot-tag hotspot-tag--depth">L{entry.depth}</span>
              )}
              <span className={`hotspot-tag hotspot-tag--type ${getParentTypeTagClass(entry.parent_type)}`}>
                {entry.parent_type}
              </span>
              {entry.is_protected && (
                <span className="hotspot-tag hotspot-tag--danger">
                  <Shield className="h-3 w-3" />
                  系统保护
                </span>
              )}
              {entry.is_program && !entry.is_protected && (
                <span className="hotspot-tag hotspot-tag--danger">
                  <ShieldAlert className="h-3 w-3" />
                  系统/程序
                </span>
              )}
              {entry.is_cache && !entry.is_program && !entry.is_protected && !isFullScan && (
                <span className="hotspot-tag hotspot-tag--warn">
                  <Trash2 className="h-3 w-3" />
                  临时缓存
                </span>
              )}
              {isFullScan && !entry.is_protected && (
                <span className="hotspot-tag hotspot-tag--info">
                  <Eye className="h-3 w-3" />
                  仅查看
                </span>
              )}
            </div>
          </div>

          <p className="hotspot-row__path truncate" title={entry.path}>
            {middleEllipsis(entry.path)}
          </p>

          <div className="hotspot-row__bar-wrap">
            <div className="hotspot-row__bar" aria-hidden>
              <div
                className={`hotspot-row__bar-fill ${entry.is_protected ? 'hotspot-row__bar-fill--danger' : ''}`}
                style={{ width: `${barPercent}%` }}
              />
            </div>
            <span className="hotspot-row__bar-label tabular-nums">{percentage.toFixed(0)}%</span>
          </div>

          <div className="hotspot-row__meta">
            <span className="hotspot-row__meta-item">
              <HardDrive className="h-3 w-3" />
              {entry.file_count.toLocaleString()} 个
            </span>
            {formatDateTime(entry.last_modified) && (
              <span className="hotspot-row__meta-item hidden md:inline-flex">
                <Clock className="h-3 w-3" />
                {formatDateTime(entry.last_modified)}
              </span>
            )}
          </div>
        </div>

        <div className={`hotspot-row__size tabular-nums ${entry.is_protected ? 'hotspot-row__size--danger' : ''}`}>
          <span className="hotspot-row__size-pill">{formatSize(entry.total_size)}</span>
        </div>

        <div className="hotspot-row__actions">
          {onDrillDown && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDrillDown(entry.path);
              }}
              className="hotspot-action hotspot-action--brand"
              title="展开下级目录"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          {canCleanup && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onCleanup(entry);
              }}
              className="hotspot-action hotspot-action--warn"
              title="清理缓存文件"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSearch(entry.path);
            }}
            className="hotspot-action"
            title="搜索该文件夹是否可以删除"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenFolder(entry.path);
            }}
            className="hotspot-action"
            title="在文件资源管理器中打开"
          >
            <FolderOpen className="h-4 w-4" />
          </button>
        </div>
      </div>

      {treeDepth < maxTreeDepth - 1 && entry.children && entry.children.length > 0 && (
        <div className="hotspot-tree-children">
          {entry.children.map((child, idx) => (
            <HotspotItem
              key={child.path}
              entry={child}
              rank={idx + 1}
              maxSize={entry.total_size}
              isFullScan={isFullScan}
              onOpenFolder={onOpenFolder}
              onCleanup={onCleanup}
              onSearch={onSearch}
              parentName={entry.name}
              isChild
              treeDepth={treeDepth + 1}
              onDrillDown={onDrillDown}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** 父目录类型标签的语义色，改用 CSS 类避免行内 Tailwind 堆叠 */
function getParentTypeTagClass(type: string): string {
  switch (type) {
    case 'Local':
      return 'hotspot-tag--local';
    case 'Roaming':
      return 'hotspot-tag--roaming';
    case 'LocalLow':
      return 'hotspot-tag--locallow';
    case 'Windows':
      return 'hotspot-tag--windows';
    case 'Program Files':
    case 'Program Files (x86)':
      return 'hotspot-tag--programfiles';
    case 'Users':
      return 'hotspot-tag--users';
    case 'System':
      return 'hotspot-tag--system';
    default:
      return 'hotspot-tag--default';
  }
}

// ============================================================================
// 主组件
// ============================================================================

export function HotspotModule({ layoutMode = 'cards', isPageActive = true }: ModuleRenderProps) {
  const { moduleState, expandedModule, setExpandedModule, updateModuleState, stopScanTrigger } = useModuleDashboard('hotspot');
  const { showToast } = useToast();
  const { settings } = useSettings();
  const { drives } = useLocalDrives();

  const scanningRef = useRef(false);
  const cancelRequestedRef = useRef(false);
  const scanRunIdRef = useRef(0);

  // 本地状态
  const [scanResult, setScanResult] = useState<HotspotScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  // 深度扫描开关状态
  const [fullScanEnabled, setFullScanEnabled] = useState(false);
  const [selectedDriveLetter, setSelectedDriveLetter] = useState('C:');
  // 清理确认对话框状态
  const [cleanupTarget, setCleanupTarget] = useState<HotspotEntry | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);

  // ====== 扫描进度状态（仅深度扫描时有效） ======
  const [scanProgress, setScanProgress] = useState<HotspotScanProgress | null>(null);
  const [progressLogs, setProgressLogs] = useState<HotspotScanProgress[]>([]);
  const [scanElapsed, setScanElapsed] = useState(0);

  // ====== 下钻模态框状态 ======
  /** 选中的路径：非空时弹出 DrillDownModal */
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  // 是否展开
  const isExpanded = expandedModule === 'hotspot';
  const selectedDrive = drives.find((drive) => drive.drive_letter === selectedDriveLetter) ?? null;
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

  /** 点击下钻按钮 → 打开模态框 */
  const handleDrillDown = useCallback((targetPath: string) => {
    setSelectedPath(targetPath);
  }, []);

  /** 模态框内发生清理后的同步回调 → 重新扫描主列表 */
  const handleModalCleanupDone = useCallback(() => {
    // 延迟触发重新扫描，避免与模态框关闭动画冲突
    setTimeout(() => {
      handleScanRef.current?.();
    }, 100);
  }, []);

  // 使用 ref 打破 handleScan ↔ handleModalCleanupDone 的循环依赖
  const handleScanRef = useRef<(() => void) | null>(null);

  // ====== 监听扫描进度事件 ======
  useEffect(() => {
    let unlistenProgress: (() => void) | null = null;
    let unlistenCancelled: (() => void) | null = null;

    const setupListeners = async () => {
      unlistenProgress = await listen<HotspotScanProgress>('hotspot-scan:progress', (event) => {
        const progress = event.payload;
        setScanProgress(progress);
        setProgressLogs((prev) => {
          const last = prev[prev.length - 1];
          // 相同阶段只保留最新一条，避免 MFT 每 10k 条刷屏导致前端日志噪音过大。
          if (last?.stage === progress.stage) {
            return [...prev.slice(0, -1), progress].slice(-6);
          }
          return [...prev, progress].slice(-6);
        });
      });
      unlistenCancelled = await listen('hotspot-scan:cancelled', () => {
        // 扫描被取消，UI 由 handleScan 的 catch/finally 处理
      });
    };

    setupListeners();

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenCancelled) unlistenCancelled();
    };
  }, []);

  // 扫描计时器（仅在全盘扫描时显示）
  useEffect(() => {
    if (moduleState.status !== 'scanning') { setScanElapsed(0); return; }
    const t0 = performance.now();
    const interval = setInterval(() => setScanElapsed(Math.floor((performance.now() - t0) / 1000)), 500);
    return () => clearInterval(interval);
  }, [moduleState.status]);

  // 执行扫描
  const handleScan = useCallback(async () => {
    if (scanningRef.current) return;
    if (fullScanEnabled && selectedDrive && !selectedDrive.is_ntfs) {
      const message = `${selectedDriveLabel}当前文件系统为 ${selectedDrive.file_system || '未知'}，MFT 深度扫描仅支持 NTFS 分区。`;
      setError(message);
      updateModuleState('hotspot', { status: 'error', error: message });
      return;
    }
    scanningRef.current = true;
    cancelRequestedRef.current = false;
    const scanRunId = ++scanRunIdRef.current;

    updateModuleState('hotspot', { status: 'scanning' });
    setError(null);
    setScanResult(null);
    setShowAll(false);
    setSelectedPath(null);
    setScanProgress(null);
    setProgressLogs([]);

    try {
      // 根据深度扫描开关决定扫描模式（全盘扫描条目更多）
      const topN = fullScanEnabled ? 80 : 50;
      const result = await scanHotspot(
        topN,
        fullScanEnabled,
        settings.hotspotDepth,
        settings.hotspotSizeThreshold,
        settings.hotspotIgnoreSystemDirs,
        selectedDriveLetter,
      );
      if (cancelRequestedRef.current || scanRunId !== scanRunIdRef.current) {
        // 用户主动停止时不接收后端可能返回的半截结果，避免列表只剩一级目录造成误判。
        return;
      }
      setScanResult(result);

      // 卡片摘要：展示的目录数 + 扫描覆盖总大小（与内部统计行一致）
      updateModuleState('hotspot', {
        status: 'done',
        fileCount: result.entries.length,
        totalSize: result.scanned_total_size,
      });
    } catch (err) {
      if (cancelRequestedRef.current || scanRunId !== scanRunIdRef.current) {
        updateModuleState('hotspot', { status: 'idle', progress: 0 });
        return;
      }
      console.error('大目录分析扫描失败:', err);
      setError(String(err));
      updateModuleState('hotspot', { status: 'error' });
    } finally {
      if (scanRunId === scanRunIdRef.current) {
        scanningRef.current = false;
        setScanProgress(null);
      }
    }
  }, [updateModuleState, fullScanEnabled, settings, selectedDriveLetter, selectedDrive, selectedDriveLabel]);

  const resetHotspotResult = useCallback(() => {
    setScanResult(null);
    setError(null);
    setShowAll(false);
    setSelectedPath(null);
    setScanProgress(null);
    setProgressLogs([]);
    updateModuleState('hotspot', { status: 'idle', error: null, fileCount: 0, totalSize: 0, progress: 0 });
  }, [updateModuleState]);

  const handleDriveChange = useCallback((driveLetter: string) => {
    if (scanningRef.current) return;
    setSelectedDriveLetter(normalizeDriveLetter(driveLetter));
    resetHotspotResult();
  }, [resetHotspotResult]);

  // 取消扫描
  const handleStopScan = useCallback(async () => {
    cancelRequestedRef.current = true;
    scanRunIdRef.current += 1;
    scanningRef.current = false;
    updateModuleState('hotspot', { status: 'idle', progress: 0 });
    setScanProgress(null);
    try {
      await cancelHotspotScan();
      showToast({ type: 'info', title: '扫描已停止', description: '已取消本次扫描' });
    } catch (err) {
      console.error('停止扫描失败:', err);
    }
  }, [showToast, updateModuleState]);

  // 同步 handleScanRef 供模态框清理回调使用
  handleScanRef.current = handleScan;

  useOneClickScanListener('hotspot', handleScan);

  useEffect(() => {
    if (stopScanTrigger > 0 && scanningRef.current) {
      // 全局停止按钮已经通知后端取消，这里只负责阻止旧 Promise 回写半截结果。
      cancelRequestedRef.current = true;
      scanRunIdRef.current += 1;
      scanningRef.current = false;
      setScanProgress(null);
    }
  }, [stopScanTrigger]);

  // 打开文件夹
  const handleOpenFolder = useCallback(async (path: string) => {
    try {
      await openInFolder(path);
    } catch (err) {
      console.error('打开文件夹失败:', err);
    }
  }, []);

  // 触发清理确认对话框
  const handleCleanupClick = useCallback((entry: HotspotEntry) => {
    setCleanupTarget(entry);
  }, []);

  // 执行清理操作
  const handleCleanupConfirm = useCallback(async () => {
    if (!cleanupTarget) return;
    
    setIsCleaning(true);
    try {
      const result = await cleanupDirectoryContents(cleanupTarget.path);
      
      if (result.deleted_count > 0) {
        showToast({
          type: 'success',
          title: `清理完成`,
          description: `已删除 ${result.deleted_count} 项，释放 ${formatSize(result.freed_size)}`,
        });
        // 清理完成后重新扫描以更新数据
        handleScan();
      } else if (result.failed_count > 0) {
        showToast({
          type: 'warning',
          title: '清理受阻',
          description: `${result.failed_count} 个文件被占用无法删除`,
        });
      } else {
        showToast({
          type: 'info',
          title: '目录已为空',
          description: '没有需要清理的文件',
        });
      }
    } catch (err) {
      console.error('清理失败:', err);
      showToast({
        type: 'error',
        title: '清理失败',
        description: String(err),
      });
    } finally {
      setIsCleaning(false);
      setCleanupTarget(null);
    }
  }, [cleanupTarget, handleScan, showToast]);

  // 搜索文件夹是否可以删除 - 使用 Tauri opener 插件打开浏览器
  const handleSearch = useCallback(async (path: string) => {
    try {
      await openSearchUrl(`Windows 文件夹 ${path} 可以删除吗`);
    } catch (err) {
      console.error('打开搜索链接失败:', err);
    }
  }, []);

  // 显示的条目（默认显示 10 条，展开显示全部）
  const displayedEntries = showAll 
    ? scanResult?.entries || []
    : (scanResult?.entries || []).slice(0, 10);

  // 最大大小（用于计算占比条）
  const maxSize = scanResult?.entries[0]?.total_size || 0;
  const driveSelector = (
    <div className="flex items-center gap-2 shrink-0" onClick={(event) => event.stopPropagation()}>
      <DriveSelect
        value={selectedDriveLetter}
        drives={drives}
        onChange={handleDriveChange}
        disabled={moduleState.status === 'scanning'}
      />
    </div>
  );

  if (shouldSkipInactivePageRender(layoutMode, isPageActive) && !cleanupTarget && !selectedPath) {
    return null;
  }

  return (
    <ModuleCard
        variant={layoutMode === 'pages' ? 'page' : 'card'}
        forceExpanded={layoutMode === 'pages'}
      id="hotspot"
      title="大目录分析"
      description={fullScanEnabled ? `深度扫描 ${selectedDriveLabel}，定位空间占用元凶` : "深度分析 AppData 目录，定位占用空间的元凶"}
      icon={<Flame className="w-5 h-5 text-[var(--brand-green)]" />}
      status={moduleState.status}
      fileCount={moduleState.fileCount}
      totalSize={moduleState.totalSize}
      countLabel="个大目录"
      expanded={isExpanded}
      onToggleExpand={() => setExpandedModule(isExpanded ? null : 'hotspot')}
      onScan={handleScan}
      scanButtonText="开始扫描"
      scanDisabled={Boolean(fullScanEnabled && selectedDrive && !selectedDrive.is_ntfs)}
      error={error}
      titleExtra={fullScanEnabled ? driveSelector : null}
      headerExtra={
        // 深度扫描开关 - 参考卸载残留模块样式
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFullScanEnabled(!fullScanEnabled)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              fullScanEnabled
                ? 'bg-[var(--brand-green)] text-white'
                : 'bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-color)]'
            }`}
            title={fullScanEnabled ? '当前：全盘深度扫描' : '当前：仅扫描 AppData'}
          >
            <Eye className="w-3.5 h-3.5" />
            深度扫描
          </button>
        </div>
      }
    >
      {/* 扫描中状态 */}
      {moduleState.status === 'scanning' && (
        <ModuleScanPanel
          icon={Flame}
          title={
            fullScanEnabled
              ? `正在深度扫描 ${selectedDriveLabel}`
              : '正在扫描 AppData 目录'
          }
          description={
            fullScanEnabled
              ? '深度扫描可能需要较长时间，请耐心等待'
              : '这可能需要几秒钟'
          }
          backend={fullScanEnabled && scanProgress ? scanProgress.backend : undefined}
          backendLabel={
            fullScanEnabled && scanProgress
              ? scanProgress.backend === 'mft'
                ? 'MFT 直读'
                : '常规遍历'
              : undefined
          }
          warnings={[
            ...(fullScanEnabled && !settings.hotspotIgnoreSystemDirs
              ? ['已关闭系统目录过滤，扫描时间可能较长']
              : []),
            ...(fullScanEnabled && selectedDrive && !selectedDrive.is_ntfs
              ? ['当前分区不是 NTFS，将无法使用 MFT 深度扫描']
              : []),
          ]}
          onStop={fullScanEnabled ? handleStopScan : undefined}
          padded={false}
          className="mx-4 my-4 sm:mx-5 sm:my-5"
        >
          {fullScanEnabled && scanProgress && (
            <div className="mt-4 w-full max-w-2xl text-left">
              <HotspotDiagnostics
                logs={progressLogs}
                totalElapsedMs={scanProgress.elapsed_ms || scanElapsed * 1000}
                currentProgress={scanProgress}
              />
            </div>
          )}
        </ModuleScanPanel>
      )}

      {/* 扫描结果 */}
      {moduleState.status === 'done' && scanResult && (
        <div className="hotspot-results p-4 sm:p-5 space-y-4">
          {scanResult.is_full_scan && (
            <div className="hotspot-notice">
              <Eye className="h-4 w-4 shrink-0" />
              <span>深度扫描模式：仅供查看分析，清理功能已禁用以保护系统安全</span>
            </div>
          )}

          <HotspotSummary
            folderCount={scanResult.total_folders_scanned}
            totalSize={scanResult.scanned_total_size}
            durationMs={scanResult.scan_duration_ms}
          />

          {scanResult.is_full_scan && (
            <HotspotDiagnostics
              logs={progressLogs}
              totalElapsedMs={scanResult.scan_duration_ms}
              compact
            />
          )}

          <div className="hotspot-list">
            <div className="hotspot-list__header" aria-hidden>
              <span className="hotspot-list__col hotspot-list__col--rank">#</span>
              <span className="hotspot-list__col hotspot-list__col--icon" />
              <span className="hotspot-list__col hotspot-list__col--body">目录与路径</span>
              <span className="hotspot-list__col hotspot-list__col--size">占用</span>
              <span className="hotspot-list__col hotspot-list__col--actions">操作</span>
            </div>
            <div className="motion-stagger">
              {displayedEntries.map((entry, index) => (
              <HotspotItem
                key={entry.path}
                entry={entry}
                rank={index + 1}
                maxSize={maxSize}
                isFullScan={scanResult.is_full_scan}
                onOpenFolder={handleOpenFolder}
                onCleanup={handleCleanupClick}
                onSearch={handleSearch}
                treeDepth={0}
                onDrillDown={handleDrillDown}
              />
            ))}
            </div>
          </div>

          {scanResult.entries.length > 10 && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="hotspot-expand-btn"
            >
              <span>{showAll ? '收起' : `显示全部 ${scanResult.entries.length} 项`}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showAll ? 'rotate-180' : ''}`} />
            </button>
          )}

          {scanResult.entries.length === 0 && (
            <EmptyState
              icon={Flame}
              tone="success"
              title="未发现大型目录"
              description="当前阈值下没有需要特别关注的大目录。"
              compact
            />
          )}
        </div>
      )}

      {/* 初始状态 */}
      {moduleState.status === 'idle' && !scanResult && (
        <ModulePageContent layoutMode={layoutMode} centerIdle>
          <EmptyState
            page={layoutMode === 'pages'}
            icon={Flame}
            title="尚未分析大目录"
            description="定位占用空间较大的目录，优先关注可释放空间的热点。"
            action={<EmptyScanAction onClick={handleScan} />}
          />
        </ModulePageContent>
      )}

      {/* 清理确认对话框 */}
      {cleanupTarget && createPortal(
        <ConfirmDialog
          isOpen={!!cleanupTarget}
          title="确认清理"
          description={`确定清理 "${cleanupTarget.name}" 的临时文件吗？此操作将删除该目录下的所有文件，但保留目录本身。`}
          warning="被占用的文件将被跳过，不会影响正在运行的程序。"
          confirmText={isCleaning ? '清理中...' : '确认清理'}
          cancelText="取消"
          onConfirm={handleCleanupConfirm}
          onCancel={() => setCleanupTarget(null)}
          isDanger={false}
        />,
        document.body
      )}

      {/* 下钻模态框 - Portal 渲染到 body */}
      {selectedPath && (
        <DrillDownModal
          initialPath={selectedPath}
          onClose={() => setSelectedPath(null)}
          onCleanupDone={handleModalCleanupDone}
        />
      )}
    </ModuleCard>
  );
}

// ============================================================================
// 磁盘信息模块
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  HardDrive,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldQuestion,
} from 'lucide-react';
import { ModuleCard } from '../ModuleCard';
import { EmptyState } from '../EmptyState';
import { useToast } from '../Toast';
import { useModuleDashboard } from '../../contexts/DashboardContext';
import {
  getDiskHealth,
  type DiskHealthInfo,
  type DiskVolumeInfo,
} from '../../api/commands';
import { formatSize } from '../../utils/format';
import { shouldSkipInactivePageRender, type ModuleRenderProps } from './moduleProps';

const HEALTH_LABELS: Record<DiskHealthInfo['health_status'], string> = {
  Healthy: '健康',
  Warning: '警告',
  Unhealthy: '异常',
  Unknown: '未知',
};

function healthPresentation(status: DiskHealthInfo['health_status']) {
  switch (status) {
    case 'Healthy':
      return {
        icon: CheckCircle2,
        className: 'border-[var(--brand-green-20)] bg-[var(--brand-green-10)] text-[var(--brand-green)]',
      };
    case 'Warning':
      return {
        icon: CircleAlert,
        className: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
      };
    case 'Unhealthy':
      return {
        icon: ShieldAlert,
        className: 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
      };
    default:
      return {
        icon: ShieldQuestion,
        className: 'border-[var(--border-color)] bg-[var(--bg-hover)] text-[var(--text-muted)]',
      };
  }
}

function getDiskTitle(disk: DiskHealthInfo): string {
  return disk.model || (disk.number === null ? '未命名物理磁盘' : `磁盘 ${disk.number}`);
}

function getVolumeLabel(volume: DiskVolumeInfo): string {
  return volume.volume_name ? `${volume.drive_letter} · ${volume.volume_name}` : volume.drive_letter;
}

function formatSerial(serialNumber: string): string {
  if (!serialNumber) return '未提供';
  const normalized = serialNumber.trim();
  if (normalized.length <= 8) return normalized;
  return `${normalized.slice(0, 4)}•••${normalized.slice(-4)}`;
}

function formatMediaType(mediaType: string): string {
  switch (mediaType) {
    case 'SSD': return '固态硬盘';
    case 'HDD': return '机械硬盘';
    case 'SCM': return '存储类内存';
    default: return mediaType || '未知介质';
  }
}

function DiskHealthBadge({ status }: { status: DiskHealthInfo['health_status'] }) {
  const presentation = healthPresentation(status);
  const Icon = presentation.icon;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${presentation.className}`}>
      <Icon className="h-3.5 w-3.5" />
      {HEALTH_LABELS[status]}
    </span>
  );
}

function InfoItem({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-[var(--bg-main)] px-3 py-2.5">
      <p className="text-[11px] font-medium text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold text-[var(--text-primary)]" title={title ?? value}>
        {value}
      </p>
    </div>
  );
}

function DiskCard({ disk }: { disk: DiskHealthInfo }) {
  const totalVolumeSize = disk.volumes.reduce((sum, volume) => sum + volume.total_space, 0);

  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 transition-colors hover:border-[var(--brand-green-20)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-green-10)] text-[var(--brand-green)]">
          <HardDrive className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          {/* 标题只占可用空间，避免异常长的硬盘型号把健康标签挤出卡片。 */}
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--text-primary)]" title={getDiskTitle(disk)}>
              {getDiskTitle(disk)}
            </h3>
            <DiskHealthBadge status={disk.health_status} />
          </div>
          <p
            className="mt-1 truncate text-xs text-[var(--text-muted)]"
            title={`${disk.drive_letters.length > 0 ? disk.drive_letters.join(' / ') : '未分配盘符'} · ${formatMediaType(disk.media_type)} · ${disk.bus_type || '未知总线'}`}
          >
            {disk.drive_letters.length > 0 ? disk.drive_letters.join(' / ') : '未分配盘符'}
            {' · '}{formatMediaType(disk.media_type)}
            {' · '}{disk.bus_type || '未知总线'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <InfoItem label="容量" value={formatSize(disk.size || totalVolumeSize)} />
        <InfoItem label="介质" value={formatMediaType(disk.media_type)} />
        <InfoItem label="总线" value={disk.bus_type || '未知'} />
        <InfoItem label="工作状态" value={disk.operational_status || '未知'} title={disk.operational_status} />
        <InfoItem label="固件版本" value={disk.firmware_version || '未提供'} />
        <InfoItem label="序列号" value={formatSerial(disk.serial_number)} title={disk.serial_number || '未提供'} />
        <InfoItem label="磁盘编号" value={disk.number === null ? '未知' : `磁盘 ${disk.number}`} />
        <InfoItem label="盘符数量" value={`${disk.drive_letters.length} 个`} />
      </div>

      {disk.volumes.length > 0 && (
        <div className="mt-3 border-t border-[var(--border-color)] pt-3">
          <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">分区与空间</p>
          <div className="space-y-2">
            {disk.volumes.map(volume => (
              <div
                key={`${disk.number}-${volume.drive_letter}`}
                // 数值列使用 max-content，避免“可用”被挤到下一行；名称和进度区域负责自适应收缩。
                className="grid min-w-0 grid-cols-[minmax(0,7rem)_minmax(3rem,1fr)_minmax(0,6.5rem)_minmax(0,3.25rem)] items-center gap-3 overflow-hidden rounded-xl bg-[var(--bg-main)] px-3 py-2"
              >
                <span className="min-w-0 truncate text-xs font-semibold text-[var(--text-primary)]" title={getVolumeLabel(volume)}>
                  {getVolumeLabel(volume)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-hover)]">
                    <div className="h-full rounded-full bg-[var(--brand-green)]" style={{ width: `${Math.min(Math.max(volume.usage_percent, 0), 100)}%` }} />
                  </div>
                </div>
                <span className="min-w-0 truncate whitespace-nowrap text-right text-[11px] tabular-nums text-[var(--text-muted)]" title={`${formatSize(volume.free_space)} 可用`}>
                  {formatSize(volume.free_space)} 可用
                </span>
                <span className="min-w-0 truncate whitespace-nowrap text-right text-xs font-semibold tabular-nums text-[var(--text-primary)]">
                  {volume.usage_percent.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export function DiskInfoModule({ layoutMode = 'cards', isPageActive = true }: ModuleRenderProps) {
  const { moduleState, expandedModule, setExpandedModule, updateModuleState, oneClickScanTrigger } = useModuleDashboard('diskHealth');
  const { showToast } = useToast();
  const [disks, setDisks] = useState<DiskHealthInfo[]>([]);
  const scanningRef = useRef(false);
  const lastScanTriggerRef = useRef(0);

  const handleScan = useCallback(async () => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    updateModuleState('diskHealth', { status: 'scanning', error: null });
    setExpandedModule('diskInfo');
    try {
      const result = await getDiskHealth();
      setDisks(result);
      updateModuleState('diskHealth', { status: 'done', fileCount: result.length, totalSize: 0 });
    } catch (error) {
      const message = String(error);
      updateModuleState('diskHealth', { status: 'error', error: message });
      showToast({ type: 'error', title: '读取磁盘信息失败', description: message });
    } finally {
      scanningRef.current = false;
    }
  }, [setExpandedModule, showToast, updateModuleState]);

  useEffect(() => {
    if (oneClickScanTrigger > 0 && oneClickScanTrigger !== lastScanTriggerRef.current) {
      lastScanTriggerRef.current = oneClickScanTrigger;
      handleScan();
    }
  }, [handleScan, oneClickScanTrigger]);

  const isExpanded = expandedModule === 'diskInfo';
  const isScanning = moduleState.status === 'scanning';
  if (shouldSkipInactivePageRender(layoutMode, isPageActive)) return null;

  return (
    <ModuleCard
      variant={layoutMode === 'pages' ? 'page' : 'card'}
      forceExpanded={layoutMode === 'pages'}
      id="diskInfo"
      title="磁盘信息"
      description="查看物理磁盘基础信息与 Windows 报告的健康状态"
      icon={<HardDrive className="h-6 w-6 text-[var(--brand-green)]" />}
      status={moduleState.status}
      fileCount={moduleState.fileCount}
      totalSize={0}
      hideDoneBadge
      hideTotalSize
      countLabel="块磁盘"
      expanded={isExpanded}
      onToggleExpand={() => setExpandedModule(isExpanded ? null : 'diskInfo')}
      onScan={handleScan}
      scanButtonText={isScanning ? '读取中...' : disks.length > 0 ? '重新读取' : '读取信息'}
      error={moduleState.error}
    >
      <div className="space-y-4 p-5">
        <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2.5 text-xs text-blue-700 dark:text-blue-300">
          <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0" />
          <p>健康状态来自 Windows Storage 与设备报告，不代表完整 SMART 检测；显示“未知”不等于健康或故障。</p>
        </div>

        {isScanning && (
          <div className="flex items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-main)] py-12 text-sm text-[var(--text-muted)]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-[var(--brand-green)]" /> 正在读取本机磁盘信息...
          </div>
        )}

        {!isScanning && disks.length === 0 && moduleState.status !== 'error' && (
          <EmptyState icon={HardDrive} title="尚未读取磁盘信息" description="点击右上角按钮读取本机物理磁盘和分区信息" />
        )}

        {!isScanning && disks.length > 0 && (
          <div className="space-y-3">
            {disks.map((disk, index) => <DiskCard key={`${disk.number ?? 'unknown'}-${disk.model}-${index}`} disk={disk} />)}
          </div>
        )}

        {!isScanning && disks.length > 0 && (
          <div className="flex items-center justify-end gap-1.5 text-[11px] text-[var(--text-muted)]">
            <RefreshCw className="h-3 w-3" /> 手动重新读取可获取最新状态
          </div>
        )}
      </div>
    </ModuleCard>
  );
}

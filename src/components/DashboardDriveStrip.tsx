// ============================================================================
// 顶栏磁盘条 — 展示全部固定盘与 U 盘，Apple 风格分组卡片 + 横向滚动
// ============================================================================

import { useMemo } from 'react';
import { FileSearch, HardDrive, Trash2, Usb } from 'lucide-react';
import type { LocalDriveInfo } from '../api/commands';
import type { AppModuleId } from '../config/moduleMeta';
import { formatSize } from '../utils/format';

/** 盘数较少时卡片均分宽度，避免右侧大块空白 */
const FEW_DRIVES_THRESHOLD = 3;
/** 系统盘使用率超过该值时显示空间偏紧提示 */
const SYSTEM_DRIVE_TIGHT_USAGE_PERCENT = 75;
/** 系统盘可用空间低于 20GB 时也视为偏紧 */
const SYSTEM_DRIVE_LOW_FREE_BYTES = 20 * 1024 ** 3;

interface DashboardDriveStripProps {
  drives: LocalDriveInfo[];
  loading?: boolean;
  /** 洞察条快捷入口：跳转到指定功能模块 */
  onNavigateModule?: (moduleId: AppModuleId) => void;
}

/** 根据使用率返回进度条色阶 */
function usageBarTone(percent: number): string {
  if (percent > 90) return 'dashboard-drive-card__bar--danger';
  if (percent > 75) return 'dashboard-drive-card__bar--warning';
  return 'dashboard-drive-card__bar--normal';
}

function driveSubtitle(drive: LocalDriveInfo): string {
  if (drive.volume_name) return drive.volume_name;
  if (drive.is_removable) return '可移动存储';
  return '本地磁盘';
}

function driveBadge(drive: LocalDriveInfo): string | null {
  if (drive.is_system) return '系统';
  if (drive.is_removable) return 'U 盘';
  return null;
}

function DriveCard({ drive }: { drive: LocalDriveInfo }) {
  const badge = driveBadge(drive);
  const letter = drive.drive_letter.replace(':', '');

  return (
    <article
      className={`dashboard-drive-card ${drive.is_removable ? 'dashboard-drive-card--removable' : ''}`}
      title={`${drive.drive_letter} ${driveSubtitle(drive)} · 可用 ${formatSize(drive.free_space)} / ${formatSize(drive.total_space)}`}
    >
      <div className="dashboard-drive-card__head">
        <div className={`dashboard-drive-card__icon ${drive.is_removable ? 'dashboard-drive-card__icon--usb' : ''}`}>
          {drive.is_removable ? <Usb className="h-3.5 w-3.5" /> : <HardDrive className="h-3.5 w-3.5" />}
        </div>
        <div className="dashboard-drive-card__meta min-w-0">
          <div className="dashboard-drive-card__title-row">
            <span className="dashboard-drive-card__letter">{letter}</span>
            {badge && <span className="dashboard-drive-card__badge">{badge}</span>}
          </div>
          <p className="dashboard-drive-card__subtitle truncate">{driveSubtitle(drive)}</p>
        </div>
        <span className="dashboard-drive-card__percent tabular-nums">{drive.usage_percent.toFixed(0)}%</span>
      </div>

      <div className="dashboard-drive-card__track" aria-hidden>
        <div
          className={`dashboard-drive-card__bar ${usageBarTone(drive.usage_percent)}`}
          style={{ width: `${Math.min(100, Math.max(0, drive.usage_percent))}%` }}
        />
      </div>

      <p className="dashboard-drive-card__caption tabular-nums">
        可用 {formatSize(drive.free_space)}
        <span className="dashboard-drive-card__caption-dot" aria-hidden>
          ·
        </span>
        共 {formatSize(drive.total_space)}
      </p>
    </article>
  );
}

function DriveSkeleton() {
  return (
    <div className="dashboard-drive-card dashboard-drive-card--skeleton" aria-hidden>
      <div className="dashboard-drive-card__head">
        <div className="dashboard-drive-card__icon dashboard-drive-card__icon--skeleton" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 w-16 rounded bg-[var(--bg-hover)]" />
          <div className="h-2.5 w-24 rounded bg-[var(--bg-hover)]" />
        </div>
      </div>
      <div className="dashboard-drive-card__track dashboard-drive-card__track--skeleton" />
    </div>
  );
}

/** 判断系统盘是否空间偏紧 */
function isSystemDriveTight(drive: LocalDriveInfo): boolean {
  return drive.usage_percent > SYSTEM_DRIVE_TIGHT_USAGE_PERCENT || drive.free_space < SYSTEM_DRIVE_LOW_FREE_BYTES;
}

interface StorageInsightProps {
  systemDrive: LocalDriveInfo;
  onNavigateModule?: (moduleId: AppModuleId) => void;
}

/** 系统盘偏紧时在右侧展示一行洞察 + 快捷入口 */
function StorageInsight({ systemDrive, onNavigateModule }: StorageInsightProps) {
  const toneClass =
    systemDrive.usage_percent > 90
      ? 'dashboard-drive-strip__insight--danger'
      : 'dashboard-drive-strip__insight--warning';

  return (
    <aside className={`dashboard-drive-strip__insight ${toneClass}`} aria-label="系统盘空间提示">
      <p className="dashboard-drive-strip__insight-text tabular-nums">
        {systemDrive.drive_letter} 可用 {formatSize(systemDrive.free_space)}
        <span className="dashboard-drive-strip__insight-sep" aria-hidden>
          ·
        </span>
        空间偏紧
      </p>
      {onNavigateModule && (
        <div className="dashboard-drive-strip__insight-actions">
          <button
            type="button"
            className="dashboard-drive-strip__insight-btn"
            onClick={() => onNavigateModule('junk-clean')}
          >
            <Trash2 className="h-3 w-3 shrink-0" aria-hidden />
            垃圾清理
          </button>
          <button
            type="button"
            className="dashboard-drive-strip__insight-btn"
            onClick={() => onNavigateModule('big-files')}
          >
            <FileSearch className="h-3 w-3 shrink-0" aria-hidden />
            大文件
          </button>
        </div>
      )}
    </aside>
  );
}

export function DashboardDriveStrip({ drives, loading = false, onNavigateModule }: DashboardDriveStripProps) {
  const fixedCount = drives.filter((drive) => !drive.is_removable).length;
  const removableCount = drives.filter((drive) => drive.is_removable).length;

  const { totalFree, totalSpace, systemDrive, showInsight } = useMemo(() => {
    const aggregateFree = drives.reduce((sum, drive) => sum + drive.free_space, 0);
    const aggregateTotal = drives.reduce((sum, drive) => sum + drive.total_space, 0);
    const system = drives.find((drive) => drive.is_system) ?? null;

    return {
      totalFree: aggregateFree,
      totalSpace: aggregateTotal,
      systemDrive: system,
      showInsight: system != null && isSystemDriveTight(system),
    };
  }, [drives]);

  const useFewDriveLayout = !loading && drives.length > 0 && drives.length <= FEW_DRIVES_THRESHOLD;
  const scrollClassName = [
    'dashboard-drive-strip__scroll',
    useFewDriveLayout ? 'dashboard-drive-strip__scroll--few' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className="dashboard-drive-strip" aria-label="磁盘空间">
      <header className="dashboard-drive-strip__head">
        <h2 className="dashboard-drive-strip__title">存储空间</h2>
        {!loading && drives.length > 0 && (
          <p className="dashboard-drive-strip__summary tabular-nums">
            {fixedCount} 个磁盘
            {removableCount > 0 ? ` · ${removableCount} 个 U 盘` : ''}
            {' · '}
            可用 {formatSize(totalFree)}
            {' · '}
            共 {formatSize(totalSpace)}
          </p>
        )}
      </header>

      <div className="dashboard-drive-strip__body">
        <div className={scrollClassName}>
          {loading ? (
            <>
              <DriveSkeleton />
              <DriveSkeleton />
            </>
          ) : drives.length > 0 ? (
            drives.map((drive) => <DriveCard key={drive.drive_letter} drive={drive} />)
          ) : (
            <p className="dashboard-drive-strip__empty">暂无可用磁盘信息</p>
          )}
        </div>

        {!loading && showInsight && systemDrive && (
          <StorageInsight systemDrive={systemDrive} onNavigateModule={onNavigateModule} />
        )}
      </div>
    </section>
  );
}

export default DashboardDriveStrip;

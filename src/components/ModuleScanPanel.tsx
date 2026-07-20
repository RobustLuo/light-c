// ============================================================================
// 模块内扫描态 — 与 EmptyState 同系的毛玻璃占位，统一各模块扫描中的视觉
// ============================================================================

import type { ComponentType, ReactNode } from 'react';
import { Radar, StopCircle } from 'lucide-react';

/** 统计 chip：文件数、耗时等 */
export interface ModuleScanStat {
  label: string;
  value: string;
}

export interface ModuleScanPanelProps {
  /** 模块图标，默认 Radar */
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  /** 当前路径 / 阶段等实时说明 */
  detail?: string;
  stats?: ModuleScanStat[];
  /** 扫描引擎标识，用于样式区分 MFT / 常规 */
  backend?: 'mft' | 'walkdir' | string;
  /** 自定义引擎标签文案 */
  backendLabel?: string;
  /** 扫描过程中的警告提示（如 NTFS / 系统目录过滤） */
  warnings?: string[];
  onStop?: () => void;
  stopLabel?: string;
  children?: ReactNode;
  compact?: boolean;
  /** 外层是否加模块内容区内边距 */
  padded?: boolean;
  className?: string;
}

export interface ModuleScanStatusBarProps {
  /** 当前路径或阶段说明 */
  message: string;
  isScanning?: boolean;
  backend?: 'mft' | 'walkdir' | string;
  backendLabel?: string;
  fileCount?: number;
  fileCountLabel?: string;
  stage?: string;
  elapsedSeconds?: number;
  className?: string;
}

/** 解析引擎标签：MFT 高亮，其余走中性胶囊 */
function resolveBackendLabel(backend?: string, backendLabel?: string): string | null {
  if (backendLabel) return backendLabel;
  if (!backend) return null;
  if (backend === 'mft') return 'MFT 全量扫描';
  if (backend === 'walkdir') return '常规遍历';
  return '常规';
}

function BackendBadge({ backend, label }: { backend?: string; label?: string }) {
  const text = resolveBackendLabel(backend, label);
  if (!text) return null;
  const isMft = backend === 'mft';
  const display = isMft && !text.startsWith('⚡') ? `⚡ ${text}` : text;

  return (
    <span
      className={`module-scan-status-bar__badge ${
        isMft ? 'module-scan-status-bar__badge--mft' : 'module-scan-status-bar__badge--neutral'
      }`}
    >
      {display}
    </span>
  );
}

/** 模块内容区顶部的实时进度条（路径 / 引擎 / 计数 / 耗时） */
export function ModuleScanStatusBar({
  message,
  isScanning = true,
  backend,
  backendLabel,
  fileCount,
  fileCountLabel = '文件',
  stage,
  elapsedSeconds,
  className = '',
}: ModuleScanStatusBarProps) {
  const prefix = isScanning ? '正在扫描' : '扫描完成';

  return (
    <div
      className={`module-scan-status-bar ${
        backend === 'mft' ? 'module-scan-status-bar--mft' : ''
      } ${className}`}
    >
      <span className="module-scan-status-bar__message truncate">
        {prefix}: {message}
      </span>
      <BackendBadge backend={backend} label={backendLabel} />
      {typeof fileCount === 'number' && (
        <span className="module-scan-status-bar__meta tabular-nums shrink-0">
          {fileCount.toLocaleString()} {fileCountLabel}
        </span>
      )}
      {stage && (
        <span className="module-scan-status-bar__meta tabular-nums shrink-0">{stage}</span>
      )}
      {typeof elapsedSeconds === 'number' && elapsedSeconds > 0 && (
        <span className="module-scan-status-bar__meta tabular-nums shrink-0">{elapsedSeconds}s</span>
      )}
    </div>
  );
}

/** 模块内容区居中的扫描占位面板 */
export function ModuleScanPanel({
  icon,
  title,
  description,
  detail,
  stats,
  backend,
  backendLabel,
  warnings,
  onStop,
  stopLabel = '停止扫描',
  children,
  compact = false,
  padded = true,
  className = '',
}: ModuleScanPanelProps) {
  const Icon = icon ?? Radar;
  const backendText = resolveBackendLabel(backend, backendLabel);

  const panel = (
    <div
      className={`module-scan-panel ${compact ? 'module-scan-panel--compact' : ''} motion-enter ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* 背景光斑：慢速漂移，不做图标弹跳 */}
      <div className="module-scan-panel__aurora" aria-hidden>
        <span className="module-scan-panel__orb module-scan-panel__orb--1" />
        <span className="module-scan-panel__orb module-scan-panel__orb--2" />
        <span className="module-scan-panel__orb module-scan-panel__orb--3" />
      </div>

      <div className="module-scan-panel__stage">
        <div className="module-scan-panel__indicator" aria-hidden>
          <div className="module-scan-panel__ring" />
          <div className="module-scan-panel__icon">
            <Icon className="module-scan-panel__icon-svg" strokeWidth={1.75} />
          </div>
        </div>

        {backendText && (
          <span
            className={`module-scan-panel__backend ${
              backend === 'mft' ? 'module-scan-panel__backend--mft' : ''
            }`}
          >
            {backend === 'mft' && !backendText.startsWith('⚡') ? '⚡ ' : ''}
            {backendText}
          </span>
        )}

        <p className="module-scan-panel__title">{title}</p>
        {description && <p className="module-scan-panel__desc">{description}</p>}
        {detail && <p className="module-scan-panel__detail truncate max-w-md">{detail}</p>}

        {stats && stats.length > 0 && (
          <div className="module-scan-panel__stats">
            {stats.map((item) => (
              <div key={item.label} className="module-scan-panel__stat">
                <span className="module-scan-panel__stat-value tabular-nums">{item.value}</span>
                <span className="module-scan-panel__stat-label">{item.label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="module-scan-panel__track" aria-hidden>
          <div className="module-scan-panel__shimmer" />
        </div>

        {warnings && warnings.length > 0 && (
          <ul className="module-scan-panel__warnings">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}

        {children}

        {onStop && (
          <button type="button" onClick={onStop} className="module-scan-panel__stop">
            <StopCircle className="h-3.5 w-3.5" />
            {stopLabel}
          </button>
        )}
      </div>
    </div>
  );

  if (!padded) return panel;

  return <div className="p-4 sm:p-5">{panel}</div>;
}

export default ModuleScanPanel;

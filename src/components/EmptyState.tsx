// ============================================================================
// 通用空数据占位组件 — 毛玻璃占位，无弹跳/外圈干扰
// ============================================================================

import type { ComponentType, ReactNode } from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  /** 用图标承载当前状态，避免不同模块各自写一套空白占位。 */
  icon?: ComponentType<{ className?: string }>;
  title?: string;
  description?: string;
  action?: ReactNode;
  tone?: 'neutral' | 'success';
  compact?: boolean;
  /** 页面模式扫描前引导：撑满内容区、弱化边框，与模块卡片融合 */
  page?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  title = '暂无数据',
  description = '开始扫描后，这里会展示可处理的结果。',
  action,
  tone = 'neutral',
  compact = false,
  page = false,
  className = '',
}: EmptyStateProps) {
  const Icon = icon ?? (tone === 'success' ? CheckCircle2 : Sparkles);

  return (
    <div
      className={`empty-state empty-state--${tone} ${compact ? 'empty-state--compact' : ''} ${
        page ? 'empty-state--page' : ''
      } motion-enter ${className}`}
    >
      {/* 背景光斑：仅环境氛围，不做图标级动效 */}
      <div className="empty-state__aurora" aria-hidden>
        <span className="empty-state__orb empty-state__orb--1" />
        <span className="empty-state__orb empty-state__orb--2" />
        <span className="empty-state__orb empty-state__orb--3" />
      </div>

      <div className="empty-state__stage">
        <div className="empty-state__icon-shell">
          <div className="empty-state__icon">
            <Icon className="empty-state__icon-svg" strokeWidth={1.75} />
          </div>
        </div>

        <p className="empty-state__title">{title}</p>
        {description && <p className="empty-state__desc">{description}</p>}
        {action && <div className="empty-state__action">{action}</div>}
      </div>
    </div>
  );
}

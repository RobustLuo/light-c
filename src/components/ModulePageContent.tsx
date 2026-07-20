// ============================================================================
// 模块内容区容器 — 页面模式 idle 时撑满并居中空状态引导
// ============================================================================

import type { ReactNode } from 'react';
import type { LayoutMode } from '../config/moduleMeta';

interface ModulePageContentProps {
  layoutMode?: LayoutMode;
  /** 扫描前空状态：垂直居中，避免内容贴顶 */
  centerIdle?: boolean;
  children: ReactNode;
  className?: string;
}

export function getModulePageContentClass(
  layoutMode: LayoutMode = 'cards',
  options: { centerIdle?: boolean } = {},
): string {
  if (layoutMode !== 'pages') {
    return 'p-4 space-y-3';
  }

  return [
    'module-page-content',
    options.centerIdle ? 'module-page-content--idle' : 'module-page-content--filled',
  ].join(' ');
}

export function ModulePageContent({
  layoutMode = 'cards',
  centerIdle = false,
  className = '',
  children,
}: ModulePageContentProps) {
  return (
    <div className={`${getModulePageContentClass(layoutMode, { centerIdle })} ${className}`.trim()}>
      {children}
    </div>
  );
}

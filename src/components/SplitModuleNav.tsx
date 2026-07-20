// ============================================================================
// 分栏模式 — 左侧模块列表（含扫描状态与可清理量摘要）
// ============================================================================

import { useCallback, useMemo } from 'react';
import { APP_MODULE_META, type AppModuleId } from '../config/moduleMeta';
import { useDashboard, type ModuleState, type ModulesState } from '../contexts/DashboardContext';
import { useSettings } from '../contexts';
import { useSlidingNavIndicator } from '../hooks/useSlidingNavIndicator';
import { APP_ID_TO_DASHBOARD_KEY } from '../utils/moduleDashboardMap';
import { formatSize } from '../utils/format';

interface SplitModuleNavProps {
  activeModuleId: AppModuleId;
}

/** 汇总各模块扫描进度，供分栏侧栏顶部展示 */
function useSplitNavSummary(modules: ModulesState) {
  return useMemo(() => {
    let scannedCount = 0;
    let reclaimableSize = 0;
    let scanningCount = 0;
    let reclaimableItems = 0;

    for (const moduleMeta of APP_MODULE_META) {
      const state = modules[APP_ID_TO_DASHBOARD_KEY[moduleMeta.id]];
      if (state.status === 'scanning') scanningCount += 1;
      if (state.status === 'done') {
        scannedCount += 1;
        reclaimableItems += state.fileCount;
        reclaimableSize += state.totalSize;
      }
    }

    return {
      totalCount: APP_MODULE_META.length,
      scannedCount,
      scanningCount,
      reclaimableItems,
      reclaimableSize,
    };
  }, [modules]);
}

function ModuleStatusMeta({ state }: { state: ModuleState }) {
  if (state.status === 'scanning') {
    return (
      <span className="split-module-nav__badge split-module-nav__badge--scanning">
        <span className="split-module-nav__pulse" aria-hidden />
        扫描中
      </span>
    );
  }

  if (state.status === 'error') {
    return <span className="split-module-nav__badge split-module-nav__badge--error">扫描异常</span>;
  }

  if (state.status === 'done') {
    if (state.fileCount > 0) {
      const sizeText = state.totalSize > 0 ? formatSize(state.totalSize) : null;
      return (
        <span className="split-module-nav__badge split-module-nav__badge--done">
          {state.fileCount.toLocaleString()} 项{sizeText ? ` · ${sizeText}` : ''}
        </span>
      );
    }
    return <span className="split-module-nav__badge split-module-nav__badge--empty">已扫描 · 无清理项</span>;
  }

  return <span className="split-module-nav__badge split-module-nav__badge--idle">尚未扫描</span>;
}

export function SplitModuleNav({ activeModuleId }: SplitModuleNavProps) {
  const { updateSettings } = useSettings();
  const { modules } = useDashboard();
  const summary = useSplitNavSummary(modules);
  const { navRef, registerItem, indicator } = useSlidingNavIndicator(activeModuleId);

  const handleSelect = useCallback(
    (moduleId: AppModuleId) => {
      updateSettings({ activeModuleId: moduleId });
    },
    [updateSettings],
  );

  const summaryText = (() => {
    if (summary.scanningCount > 0) {
      return `正在扫描 ${summary.scanningCount} 个模块…`;
    }
    if (summary.scannedCount === 0) {
      return '扫描后此处汇总各模块可清理量';
    }
    const sizePart = summary.reclaimableSize > 0 ? ` · ${formatSize(summary.reclaimableSize)}` : '';
    return `${summary.scannedCount}/${summary.totalCount} 已扫描${sizePart}`;
  })();

  return (
    <aside className="split-module-nav glass-panel" aria-label="模块列表">
      <div className="split-module-nav__head">
        <p className="split-module-nav__eyebrow">分栏模式</p>
        <p className="split-module-nav__hint">模块状态一览，右侧专注操作</p>
        <div className="split-module-nav__summary" aria-live="polite">
          <span className="split-module-nav__summary-label">扫描总览</span>
          <span className="split-module-nav__summary-value">{summaryText}</span>
          {summary.reclaimableItems > 0 && (
            <span className="split-module-nav__summary-chip">
              {summary.reclaimableItems.toLocaleString()} 项待处理
            </span>
          )}
        </div>
      </div>

      <nav ref={navRef} className="split-module-nav__list nav-with-indicator">
        <span
          className="nav-sliding-indicator nav-sliding-indicator--split"
          aria-hidden
          style={{
            transform: `translateY(${indicator.top}px)`,
            height: indicator.height,
            opacity: indicator.opacity,
          }}
        />
        {APP_MODULE_META.map((moduleMeta) => {
          const Icon = moduleMeta.icon;
          const isActive = activeModuleId === moduleMeta.id;
          const dashboardKey = APP_ID_TO_DASHBOARD_KEY[moduleMeta.id];
          const moduleState = modules[dashboardKey];

          return (
            <button
              key={moduleMeta.id}
              ref={(node) => registerItem(moduleMeta.id, node)}
              type="button"
              onClick={() => handleSelect(moduleMeta.id)}
              className={`split-module-nav__item ${isActive ? 'split-module-nav__item--active' : ''}`}
            >
              <span className={`split-module-nav__icon ${isActive ? 'split-module-nav__icon--active' : ''}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="split-module-nav__copy">
                <span className="split-module-nav__label">{moduleMeta.label}</span>
                <ModuleStatusMeta state={moduleState} />
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

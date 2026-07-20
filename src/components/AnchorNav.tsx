// ============================================================================
// 左侧模块导航栏 — 固定毛玻璃侧栏，替代原悬浮图标展开菜单
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_MODULE_META, type AppModuleId } from '../config/moduleMeta';
import { useSettings } from '../contexts';
import { isSingleModuleLayout } from '../utils/layoutMode';
import { useSlidingNavIndicator } from '../hooks/useSlidingNavIndicator';

interface AnchorNavProps {
  scrollContainerRef: React.RefObject<HTMLElement | null>;
}

export function AnchorNav({ scrollContainerRef }: AnchorNavProps) {
  const { settings, updateSettings } = useSettings();
  const [activeAnchorId, setActiveAnchorId] = useState<AppModuleId>(settings.activeModuleId);
  const clickLockRef = useRef<{ id: AppModuleId; timeout: number } | null>(null);
  const isPageMode = settings.layoutMode === 'pages';
  const activeId = isSingleModuleLayout(settings.layoutMode) ? settings.activeModuleId : activeAnchorId;
  const { navRef, registerItem, indicator } = useSlidingNavIndicator(activeId);

  const handleNavigate = useCallback((moduleId: AppModuleId) => {
    if (isPageMode) {
      updateSettings({ activeModuleId: moduleId });
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) return;

    const targetElement = container.querySelector(`[data-module-id="${moduleId}"]`);
    if (!targetElement) return;

    setActiveAnchorId(moduleId);
    if (clickLockRef.current?.timeout) {
      clearTimeout(clickLockRef.current.timeout);
    }
    clickLockRef.current = {
      id: moduleId,
      timeout: window.setTimeout(() => {
        clickLockRef.current = null;
      }, 600),
    };

    const containerRect = container.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    const scrollTop = container.scrollTop + targetRect.top - containerRect.top - 16;
    container.scrollTo({ top: scrollTop, behavior: 'smooth' });
  }, [isPageMode, scrollContainerRef, updateSettings]);

  // 卡片模式下根据滚动位置高亮当前模块
  useEffect(() => {
    if (isPageMode) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (clickLockRef.current) return;

      const containerRect = container.getBoundingClientRect();
      const containerTop = containerRect.top;
      let currentActiveId = APP_MODULE_META[0]?.id ?? settings.activeModuleId;
      let minDistance = Infinity;

      for (const moduleConfig of APP_MODULE_META) {
        const element = container.querySelector(`[data-module-id="${moduleConfig.id}"]`);
        if (!element) continue;

        const rect = element.getBoundingClientRect();
        const relativeTop = rect.top - containerTop;
        if (relativeTop <= containerRect.height * 0.5 && rect.bottom > containerTop) {
          const distance = Math.abs(relativeTop);
          if (relativeTop >= -50 && distance < minDistance) {
            minDistance = distance;
            currentActiveId = moduleConfig.id;
          } else if (relativeTop < -50 && !currentActiveId) {
            currentActiveId = moduleConfig.id;
          }
        }
      }

      setActiveAnchorId(currentActiveId);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isPageMode, scrollContainerRef, settings.activeModuleId]);

  useEffect(() => {
    return () => {
      if (clickLockRef.current?.timeout) {
        clearTimeout(clickLockRef.current.timeout);
      }
    };
  }, []);

  return (
    <aside className="sidebar-nav shrink-0 flex flex-col border-r border-[var(--border-color)] glass-panel">
      {/* 侧栏标题区：与主内容区顶栏形成视觉对齐 */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-[var(--border-muted)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
          功能模块
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {settings.layoutMode === 'split' ? '状态总览（分栏）' : isPageMode ? '单页切换' : '锚点滚动'}
        </p>
      </div>

      {/* 模块列表：模块较多时侧栏内部滚动，避免挤压主内容 */}
      <nav
        ref={navRef}
        className="sidebar-nav-list nav-with-indicator relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-2"
      >
        <span
          className="nav-sliding-indicator"
          aria-hidden
          style={{
            transform: `translateY(${indicator.top}px)`,
            height: indicator.height,
            opacity: indicator.opacity,
          }}
        />
        {APP_MODULE_META.map((moduleConfig) => {
          const Icon = moduleConfig.icon;
          const isActive = activeId === moduleConfig.id;

          return (
            <button
              key={moduleConfig.id}
              ref={(node) => registerItem(moduleConfig.id, node)}
              type="button"
              onClick={() => handleNavigate(moduleConfig.id)}
              title={moduleConfig.label}
              className={`app-nav-item group ${isActive ? 'app-nav-item-active' : 'text-[var(--text-secondary)]'}`}
            >
              <span className={`app-nav-icon ${isActive ? 'app-nav-icon-active' : ''}`}>
                <Icon className="w-4 h-4" />
              </span>
              <span className="min-w-0 flex-1 text-[13px] font-medium leading-tight truncate">
                {moduleConfig.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* 底部留白，避免最后一项贴边 */}
      <div className="shrink-0 h-2" />
    </aside>
  );
}

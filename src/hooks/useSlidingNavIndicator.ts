// ============================================================================
// 侧栏滑动指示器 — 选中项背景胶囊随 activeId 平滑位移，替代瞬时背景切换
// ============================================================================

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface NavIndicatorMetrics {
  top: number;
  height: number;
  opacity: number;
}

interface UseSlidingNavIndicatorOptions {
  /** 关闭时不渲染指示条，避免卡片/页面模式切换时出现错位动画 */
  enabled?: boolean;
}

export function useSlidingNavIndicator<T extends string>(
  activeId: T,
  options: UseSlidingNavIndicatorOptions = {},
) {
  const { enabled = true } = options;
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef(new Map<T, HTMLButtonElement>());
  const [indicator, setIndicator] = useState<NavIndicatorMetrics>({
    top: 0,
    height: 0,
    opacity: 0,
  });

  const registerItem = useCallback((id: T, node: HTMLButtonElement | null) => {
    if (node) {
      itemRefs.current.set(id, node);
      return;
    }
    itemRefs.current.delete(id);
  }, []);

  const updateIndicator = useCallback(() => {
    if (!enabled) {
      setIndicator((current) => ({ ...current, opacity: 0 }));
      return;
    }

    const nav = navRef.current;
    const activeElement = itemRefs.current.get(activeId);
    if (!nav || !activeElement) {
      return;
    }

    const navRect = nav.getBoundingClientRect();
    const itemRect = activeElement.getBoundingClientRect();
    setIndicator({
      top: itemRect.top - navRect.top + nav.scrollTop,
      height: itemRect.height,
      opacity: 1,
    });
  }, [activeId, enabled]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) {
      return;
    }

    const resizeObserver = new ResizeObserver(updateIndicator);
    resizeObserver.observe(nav);
    itemRefs.current.forEach((element) => resizeObserver.observe(element));

    nav.addEventListener('scroll', updateIndicator, { passive: true });
    window.addEventListener('resize', updateIndicator);

    return () => {
      resizeObserver.disconnect();
      nav.removeEventListener('scroll', updateIndicator);
      window.removeEventListener('resize', updateIndicator);
    };
  }, [updateIndicator]);

  return { navRef, registerItem, indicator };
}

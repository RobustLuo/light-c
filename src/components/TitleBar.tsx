// ============================================================================
// 自定义标题栏 — Aurora 玻璃材质
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Copy, Minus, Settings, Square, X } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { AppBrandLogo } from './AppBrandLogo';

interface TitleBarProps {
  onSettingsClick: () => void;
}

const DRAG_START_THRESHOLD = 4;

export function TitleBar({ onSettingsClick }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const appWindowRef = useRef(getCurrentWindow());
  const appWindow = appWindowRef.current;

  const refreshMaximizedState = useCallback(() => {
    appWindow.isMaximized().then(setIsMaximized).catch((error) => {
      console.error('同步窗口最大化状态失败:', error);
    });
  }, [appWindow]);

  useEffect(() => {
    refreshMaximizedState();

    const unlisteners: Array<() => void> = [];
    let disposed = false;

    Promise.all([
      appWindow.onResized(refreshMaximizedState),
      appWindow.onMoved(refreshMaximizedState),
      appWindow.onScaleChanged(refreshMaximizedState),
      appWindow.onFocusChanged(refreshMaximizedState),
    ])
      .then((items) => {
        if (disposed) {
          items.forEach((unlisten) => unlisten());
          return;
        }
        unlisteners.push(...items);
      })
      .catch((error) => {
        console.error('监听窗口状态失败:', error);
      });

    return () => {
      disposed = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [appWindow, refreshMaximizedState]);

  const handleMinimize = () => appWindow.minimize();

  const handleMaximize = async () => {
    const maximized = await appWindow.isMaximized();
    if (maximized) {
      await appWindow.unmaximize();
      setIsMaximized(false);
    } else {
      await appWindow.maximize();
      setIsMaximized(true);
    }
  };

  const handleClose = () => appWindow.close();

  const isWindowControl = (target: EventTarget | null) => {
    return target instanceof HTMLElement && Boolean(target.closest('[data-window-control]'));
  };

  const handleTitleBarMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.detail > 1 || isWindowControl(event.target)) return;
    if (isMaximized) return;
    dragStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handleTitleBarMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current;
    if (!dragStart) return;

    const distanceX = Math.abs(event.clientX - dragStart.x);
    const distanceY = Math.abs(event.clientY - dragStart.y);
    if (distanceX < DRAG_START_THRESHOLD && distanceY < DRAG_START_THRESHOLD) return;

    dragStartRef.current = null;
    appWindow.startDragging().catch((error) => {
      console.error('拖动窗口失败:', error);
    });
  };

  const handleTitleBarMouseUp = () => {
    dragStartRef.current = null;
  };

  const handleTitleBarDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isWindowControl(event.target)) return;
    event.preventDefault();
    dragStartRef.current = null;
    handleMaximize();
  };

  return (
    <header
      className="title-bar glass-panel"
      onDoubleClick={handleTitleBarDoubleClick}
      onMouseDown={handleTitleBarMouseDown}
      onMouseMove={handleTitleBarMouseMove}
      onMouseLeave={handleTitleBarMouseUp}
      onMouseUp={handleTitleBarMouseUp}
    >
      {/* 左侧品牌区：单行紧凑，避免副标题把顶栏撑高 */}
      <div className="title-bar__brand">
        <AppBrandLogo size="sm" />
        <div className="title-bar__brand-copy">
          <span className="title-bar__brand-name">LuoScope</span>
          <span className="title-bar__brand-dot" aria-hidden />
          <span className="title-bar__brand-tag">C 盘智能清理</span>
        </div>
      </div>

      {/* 中间留白供拖拽，不堆控件 */}
      <div className="title-bar__drag" aria-hidden />

      {/* 右侧：工具胶囊 + 窗口控件分组，层次更清晰 */}
      <div className="title-bar__actions">
        <div className="title-bar__toolbar" data-window-control>
          <ThemeToggle variant="inline" />
          <span className="title-bar__toolbar-divider" aria-hidden />
          <button
            type="button"
            data-window-control
            onClick={onSettingsClick}
            className="title-bar__tool-btn"
            title="设置"
            aria-label="设置"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>

        <div className="title-bar__window-group">
          <button
            type="button"
            data-window-control
            onClick={handleMinimize}
            className="title-bar__window-btn"
            title="最小化"
            aria-label="最小化"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            data-window-control
            onClick={handleMaximize}
            className="title-bar__window-btn"
            title={isMaximized ? '还原' : '最大化'}
            aria-label={isMaximized ? '还原' : '最大化'}
          >
            {isMaximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            data-window-control
            onClick={handleClose}
            className="title-bar__window-btn title-bar__window-btn--close"
            title="关闭"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

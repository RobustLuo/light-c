// ============================================================================
// C盘清理工具 - 主应用组件
// 单页仪表盘布局，支持浅色/深色/跟随系统主题
// ============================================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  SettingsModal,
  TitleBar,
  ToastProvider,
  WelcomeModal,
  shouldShowWelcome,
  UpdateModal,
  DashboardHeader,
  DashboardGuideBanner,
  SplashScreen,
  AnchorNav,
  BackToTopButton,
  SplitModuleNav,
} from './components';
import { DashboardProvider, useDashboardActions, FontSizeProvider, SettingsProvider, useSettings } from './contexts';
import { useAutoAdminElevation } from './hooks/useAutoAdminElevation';
import type { AppModuleId } from './config/moduleMeta';
import { APP_MODULES } from './config/modules';
import { isSingleModuleLayout, isSplitLayout, toModuleLayoutMode } from './utils/layoutMode';
import './App.css';

function DashboardContent() {
  const { triggerOneClickScan } = useDashboardActions();
  const { settings, updateSettings } = useSettings();
  useAutoAdminElevation();

  const [showSettings, setShowSettings] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => shouldShowWelcome());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const layoutMode = settings.layoutMode;
  const singleModuleLayout = isSingleModuleLayout(layoutMode);
  const splitLayout = isSplitLayout(layoutMode);
  const moduleLayoutMode = toModuleLayoutMode(layoutMode);

  const [visibleModuleId, setVisibleModuleId] = useState(settings.activeModuleId);
  const [pageEnteringModuleId, setPageEnteringModuleId] = useState<string | null>(
    () => (singleModuleLayout ? settings.activeModuleId : null),
  );
  const visibleModuleIdRef = useRef(settings.activeModuleId);
  const pageEnterTimerRef = useRef<number | null>(null);

  const triggerPageEnter = useCallback((moduleId: string) => {
    if (pageEnterTimerRef.current !== null) {
      window.clearTimeout(pageEnterTimerRef.current);
    }
    setPageEnteringModuleId(null);
    window.requestAnimationFrame(() => {
      setPageEnteringModuleId(moduleId);
    });
    pageEnterTimerRef.current = window.setTimeout(() => {
      setPageEnteringModuleId(null);
      pageEnterTimerRef.current = null;
    }, 520);
  }, []);

  const handleOneClickScan = useCallback(() => {
    triggerOneClickScan();
  }, [triggerOneClickScan]);

  /** 顶栏洞察条：单模块布局切模块，卡片模式滚动到锚点 */
  const handleNavigateModule = useCallback(
    (moduleId: AppModuleId) => {
      if (singleModuleLayout) {
        updateSettings({ activeModuleId: moduleId });
        return;
      }

      const container = scrollContainerRef.current;
      if (!container) return;

      const targetElement = container.querySelector(`[data-module-id="${moduleId}"]`);
      if (!targetElement) return;

      const containerRect = container.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      const scrollTop = container.scrollTop + targetRect.top - containerRect.top - 16;
      container.scrollTo({ top: scrollTop, behavior: 'smooth' });
    },
    [singleModuleLayout, updateSettings],
  );

  useEffect(() => {
    if (!singleModuleLayout) {
      setVisibleModuleId(settings.activeModuleId);
      visibleModuleIdRef.current = settings.activeModuleId;
      setPageEnteringModuleId(null);
      if (pageEnterTimerRef.current !== null) {
        window.clearTimeout(pageEnterTimerRef.current);
        pageEnterTimerRef.current = null;
      }
      return;
    }

    const previousModuleId = visibleModuleIdRef.current;
    if (settings.activeModuleId === previousModuleId) return;

    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    visibleModuleIdRef.current = settings.activeModuleId;
    setVisibleModuleId(settings.activeModuleId);
    triggerPageEnter(settings.activeModuleId);
  }, [singleModuleLayout, settings.activeModuleId, triggerPageEnter]);

  useEffect(() => {
    return () => {
      if (pageEnterTimerRef.current !== null) {
        window.clearTimeout(pageEnterTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!singleModuleLayout) return;

    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    triggerPageEnter(settings.activeModuleId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleModuleLayout]);

  return (
    <div className="h-screen flex flex-col aurora-shell overflow-hidden select-none">
      <TitleBar onSettingsClick={() => setShowSettings(true)} />
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <WelcomeModal isOpen={showWelcome} onClose={() => setShowWelcome(false)} />
      <UpdateModal autoCheck={true} />

      <div className="flex flex-1 min-h-0 min-w-0">
        {splitLayout ? (
          <SplitModuleNav activeModuleId={visibleModuleId} />
        ) : (
          <AnchorNav scrollContainerRef={scrollContainerRef} />
        )}

        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <DashboardHeader
            onOneClickScan={handleOneClickScan}
            onShowWelcome={() => setShowWelcome(true)}
            hideOneClickScan={singleModuleLayout}
            onNavigateModule={handleNavigateModule}
          />

          <BackToTopButton scrollContainerRef={scrollContainerRef} />

          <main className="dashboard-main flex-1 min-h-0 overflow-hidden relative z-[1]">
            <div className="dashboard-main-inner h-full min-h-0 flex flex-col">
              <div
                ref={scrollContainerRef}
                className={`dashboard-scroll flex-1 min-h-0 overflow-auto ${singleModuleLayout ? 'dashboard-scroll--page' : ''}`}
              >
                <div
                  className={`dashboard-content-shell ${
                    singleModuleLayout ? 'dashboard-content-shell--page' : 'dashboard-content-shell--cards'
                  }`}
                >
                  <DashboardGuideBanner hidden={singleModuleLayout} />

                  {APP_MODULES.map((moduleConfig) => {
                    const ModuleComponent = moduleConfig.component;
                    const isActivePage = visibleModuleId === moduleConfig.id;
                    const isPageEntering = pageEnteringModuleId === moduleConfig.id;
                    return (
                      <div
                        key={moduleConfig.id}
                        data-module-id={moduleConfig.id}
                        className={
                          singleModuleLayout
                            ? isActivePage
                              ? `page-content-stage relative z-10 overflow-visible${isPageEntering ? ' page-content-enter' : ''}`
                              : 'hidden'
                            : 'relative'
                        }
                        style={isActivePage && singleModuleLayout ? { contentVisibility: 'auto' } : undefined}
                      >
                        <ModuleComponent layoutMode={moduleLayoutMode} isPageActive={isActivePage} />
                      </div>
                    );
                  })}

                  {!singleModuleLayout && <div className="h-4" />}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [windowLabel, setWindowLabel] = useState<string | null>(null);

  useEffect(() => {
    getCurrentWindow().label && setWindowLabel(getCurrentWindow().label);
  }, []);

  if (windowLabel === null) {
    return null;
  }

  if (windowLabel === 'splashscreen') {
    return <SplashScreen />;
  }

  return (
    <FontSizeProvider>
      <SettingsProvider>
        <ToastProvider>
          <DashboardProvider>
            <DashboardContent />
          </DashboardProvider>
        </ToastProvider>
      </SettingsProvider>
    </FontSizeProvider>
  );
}

export default App;

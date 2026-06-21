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
  SplashScreen,
  Footer,
  AnchorNav,
} from './components';
import { DashboardProvider, useDashboard, FontSizeProvider, SettingsProvider, useSettings } from './contexts';
import { APP_MODULES } from './config/modules';
import './App.css';

// ============================================================================
// 仪表盘内容组件
// ============================================================================

function DashboardContent() {
  const { triggerOneClickScan } = useDashboard();
  const { settings } = useSettings();

  // 设置弹窗状态
  const [showSettings, setShowSettings] = useState(false);
  // 欢迎弹窗状态
  const [showWelcome, setShowWelcome] = useState(() => shouldShowWelcome());
  // 滚动容器 ref；卡片模式用于锚点滚动，页面模式用于承载单模块页面。
  const scrollContainerRef = useRef<HTMLElement>(null);
  const isPageMode = settings.layoutMode === 'pages';

  // 一键扫描：通过触发器并发启动所有模块扫描
  const handleOneClickScan = useCallback(() => {
    triggerOneClickScan();
  }, [triggerOneClickScan]);

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-base)] overflow-hidden select-none">
      {/* 自定义标题栏 */}
      <TitleBar onSettingsClick={() => setShowSettings(true)} />

      {/* 顶部统计栏 */}
      <DashboardHeader 
        onOneClickScan={handleOneClickScan}
        onShowWelcome={() => setShowWelcome(true)}
      />

      {/* 设置弹窗 */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* 欢迎弹窗 */}
      <WelcomeModal isOpen={showWelcome} onClose={() => setShowWelcome(false)} />

      {/* 自动更新检查弹窗 */}
      <UpdateModal autoCheck={true} />

      {/* 侧边导航：卡片模式滚动到锚点，页面模式切换当前模块。 */}
      <AnchorNav scrollContainerRef={scrollContainerRef} />

      {/* 主内容区 - 页面模式仍保持所有模块挂载，只隐藏非当前模块，保证切换后状态不丢。 */}
      <main ref={scrollContainerRef} className="flex-1 overflow-auto bg-[var(--bg-base)]">
        <div className={`${isPageMode ? 'max-w-6xl' : 'max-w-5xl'} mx-auto p-6 space-y-5`}>
          {APP_MODULES.map((moduleConfig) => {
            const ModuleComponent = moduleConfig.component;
            const isActivePage = settings.activeModuleId === moduleConfig.id;
            return (
              <div
                key={moduleConfig.id}
                data-module-id={moduleConfig.id}
                className={isPageMode && !isActivePage ? 'hidden' : undefined}
              >
                <ModuleComponent layoutMode={settings.layoutMode} />
              </div>
            );
          })}

          {/* 底部留白 */}
          <div className="h-4" />
        </div>

        {/* 底部版权声明 */}
        <Footer />
      </main>
    </div>
  );
}

// ============================================================================
// 主应用组件
// ============================================================================

function App() {
  const [windowLabel, setWindowLabel] = useState<string | null>(null);

  useEffect(() => {
    getCurrentWindow().label && setWindowLabel(getCurrentWindow().label);
  }, []);

  // 等待窗口标签检测完成
  if (windowLabel === null) {
    return null;
  }

  // 启动屏幕窗口
  if (windowLabel === 'splashscreen') {
    return <SplashScreen />;
  }

  // 主窗口
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

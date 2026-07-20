// ============================================================================
// 设置弹窗组件
// ============================================================================

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTheme } from '../contexts';
import { useOverlayAnimation } from '../hooks/useOverlayAnimation';
import { useSlidingNavIndicator } from '../hooks/useSlidingNavIndicator';
import { AboutSettings } from './settings/AboutSettings';
import { FeedbackSettings } from './settings/FeedbackSettings';
import { FeatureSettings } from './settings/FeatureSettings';
import { GeneralSettings } from './settings/GeneralSettings';
import { GuideSettings } from './settings/GuideSettings';
import { SecuritySettings } from './settings/SecuritySettings';
import { DiskInfoSettings } from './settings/DiskInfoSettings';
import { SETTINGS_TABS } from './settings/constants';
import type { SettingsTab } from './settings/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [renderedTab, setRenderedTab] = useState<SettingsTab>('general');
  const [tabVisible, setTabVisible] = useState(true);
  const { mode, setMode } = useTheme();
  const { isVisible, shouldRender, enteredRef } = useOverlayAnimation(isOpen, { exitDuration: 280 });
  const { navRef, registerItem, indicator } = useSlidingNavIndicator(activeTab, { enabled: isOpen });

  useEffect(() => {
    if (activeTab === renderedTab) {
      return;
    }

    setTabVisible(false);
    const timer = window.setTimeout(() => {
      setRenderedTab(activeTab);
      setTabVisible(true);
    }, 140);

    return () => window.clearTimeout(timer);
  }, [activeTab, renderedTab]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!shouldRender) {
    return null;
  }

  const activeTabMeta = SETTINGS_TABS.find((tab) => tab.id === renderedTab);

  const renderTabContent = () => {
    switch (renderedTab) {
      case 'general':
        return <GeneralSettings mode={mode} setMode={setMode} />;
      case 'features':
        return <FeatureSettings />;
      case 'disk-info':
        return <DiskInfoSettings />;
      case 'guide':
        return <GuideSettings />;
      case 'security':
        return <SecuritySettings />;
      case 'feedback':
        return <FeedbackSettings />;
      case 'about':
        return <AboutSettings />;
      default:
        return null;
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-5">
      <div
        className={`absolute inset-0 bg-black/35 backdrop-blur-md ${
          isVisible ? 'modal-overlay-in' : enteredRef.current ? 'modal-overlay-out' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      <div
        className={`settings-modal-shell relative flex h-[min(80vh,760px)] w-[min(920px,calc(100vw-32px))] min-h-0 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--glass-border)] glass-panel-strong shadow-[var(--shadow-lg)] ${
          isVisible ? 'settings-modal-in' : enteredRef.current ? 'settings-modal-out' : 'opacity-0'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="设置"
      >
        <aside className="settings-sidebar shrink-0">
          <div className="px-5 pt-5 pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">Preferences</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-[var(--text-primary)]">设置</h2>
          </div>

          <nav
            ref={navRef}
            className="settings-sidebar-nav nav-with-indicator relative min-h-0 flex-1 overflow-y-auto px-3 pb-4"
          >
            <span
              className="nav-sliding-indicator nav-sliding-indicator--settings"
              aria-hidden
              style={{
                transform: `translateY(${indicator.top}px)`,
                height: indicator.height,
                opacity: indicator.opacity,
              }}
            />
            {SETTINGS_TABS.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  ref={(node) => registerItem(id, node)}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`settings-nav-item ${isActive ? 'settings-nav-item-active' : ''}`}
                >
                  <span className={`settings-nav-icon ${isActive ? 'settings-nav-icon-active' : ''}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-[var(--bg-glass)]/60 backdrop-blur-xl">
          <header className="flex min-h-[56px] items-center justify-between border-b border-[var(--border-muted)] px-6">
            <div>
              <p className="text-[11px] text-[var(--text-faint)]">当前页面</p>
              <h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
                {activeTabMeta?.label}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost rounded-[var(--radius-md)] p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              aria-label="关闭设置"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div
            className={`settings-tab-content min-h-0 flex-1 overflow-auto px-6 py-5 ${
              tabVisible ? 'settings-tab-in' : 'settings-tab-out'
            }`}
          >
            {renderTabContent()}
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}

export default SettingsModal;

// ============================================================================
// 欢迎弹窗 — 首次启动引导，跟随浅色/深色主题
// ============================================================================

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Shield, Sparkles, X, Zap } from 'lucide-react';
import { AppBrandLogo } from './AppBrandLogo';
import { Checkbox } from './ui/Checkbox';
import { useOverlayAnimation } from '../hooks/useOverlayAnimation';
import { readMigratedStorageItem } from '../utils/storageMigration';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WELCOME_FEATURES = [
  { icon: Sparkles, title: '轻量极速', desc: '小巧无广告，启动即用' },
  { icon: Shield, title: '安全可靠', desc: '智能识别，保护系统文件' },
  { icon: Zap, title: '高效清理', desc: '一键扫描，快速释放空间' },
] as const;

const STORAGE_KEY = 'luoscope_welcome_dismissed';
const LEGACY_STORAGE_KEYS = ['lightc_welcome_dismissed'];

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const { isVisible, shouldRender, enteredRef } = useOverlayAnimation(isOpen, { exitDuration: 260 });

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    onClose();
  };

  if (!shouldRender) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-6">
      <div
        className={`absolute inset-0 bg-black/30 backdrop-blur-md ${
          isVisible ? 'modal-overlay-in' : enteredRef.current ? 'modal-overlay-out' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      <div
        className={`welcome-modal glass-panel-strong ${
          isVisible ? 'modal-content-in' : enteredRef.current ? 'modal-content-out' : 'opacity-0'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          className="welcome-modal__close btn-ghost"
          aria-label="关闭欢迎弹窗"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="welcome-modal__inner">
          <header className="welcome-modal__head">
            <AppBrandLogo size="lg" className="welcome-modal__logo" />
            <h2 id="welcome-modal-title" className="welcome-modal__title">
              欢迎使用 LuoScope
            </h2>
            <p className="welcome-modal__pill">轻量 · 安全 · 高效</p>
          </header>

          <p className="welcome-modal__lead">
            Windows 智能磁盘空间管理工具，帮助您分析占用、清理垃圾、释放空间，让系统运行更流畅。
          </p>

          <ul className="welcome-modal__highlights">
            {WELCOME_FEATURES.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="welcome-modal__highlight">
                <span className="welcome-modal__highlight-icon" aria-hidden>
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="welcome-modal__highlight-copy">
                  <span className="welcome-modal__highlight-title">{title}</span>
                  <span className="welcome-modal__highlight-desc">{desc}</span>
                </span>
              </li>
            ))}
          </ul>

          <footer className="welcome-modal__footer">
            <label className="welcome-modal__checkbox">
              <Checkbox
                checked={dontShowAgain}
                onChange={(checked) => setDontShowAgain(checked)}
              />
              <span>不再显示</span>
            </label>
            <button type="button" onClick={handleClose} className="btn-primary welcome-modal__cta">
              开始使用
            </button>
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** 检查是否应该显示欢迎弹窗 */
export function shouldShowWelcome(): boolean {
  return readMigratedStorageItem(STORAGE_KEY, LEGACY_STORAGE_KEYS) !== 'true';
}

/** 重置欢迎弹窗状态（用于测试） */
export function resetWelcomeState(): void {
  localStorage.removeItem(STORAGE_KEY);
  for (const legacyKey of LEGACY_STORAGE_KEYS) {
    localStorage.removeItem(legacyKey);
  }
}

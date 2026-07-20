// ============================================================================
// 启动屏 — 独立透明窗口，全幅毛玻璃 + 底部进度 Dock
// ============================================================================

import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { AppBrandLogo } from './AppBrandLogo';
import { useTheme } from '../contexts';

/** 启动屏总展示时长（毫秒） */
const SPLASH_DURATION_MS = 2600;
/** 关闭启动屏前的淡出时长（毫秒） */
const SPLASH_EXIT_MS = 320;

/** 启动阶段文案，按时间切换给用户反馈感 */
const LOADING_STEPS = [
  { at: 0, text: '正在启动 LuoScope' },
  { at: 900, text: '正在加载界面' },
  { at: 1700, text: '即将进入主界面' },
] as const;

interface SplashScreenProps {
  onComplete?: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const { theme } = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [loadingText, setLoadingText] = useState<string>(LOADING_STEPS[0].text);

  useEffect(() => {
    const stepTimers = LOADING_STEPS.map(({ at, text }, index) =>
      window.setTimeout(() => {
        setActiveStep(index);
        setLoadingText(text);
      }, at),
    );

    const closeTimer = window.setTimeout(() => {
      setIsVisible(false);

      window.setTimeout(async () => {
        try {
          await invoke('close_splashscreen');
        } catch (error) {
          console.error('关闭启动屏失败:', error);
        }
        onComplete?.();
      }, SPLASH_EXIT_MS);
    }, SPLASH_DURATION_MS);

    return () => {
      stepTimers.forEach(clearTimeout);
      clearTimeout(closeTimer);
    };
  }, [onComplete]);

  const motionDuration = prefersReducedMotion ? 0.01 : 0.62;
  const motionEase = [0.22, 1, 0.36, 1] as const;
  // 进度与阶段同步，末段略留余量避免“已结束”错觉
  const progressPercent = Math.min(100, ((activeStep + 1) / LOADING_STEPS.length) * 90 + 6);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={`splash-screen ${theme}`}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.01 : SPLASH_EXIT_MS / 1000 }}
        >
          <motion.div
            className="splash-screen__frame glass-panel-strong"
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: motionDuration, ease: motionEase }}
          >
            <div className="splash-screen__grid" aria-hidden />
            <div className="splash-screen__sheen" aria-hidden />
            <div className="splash-screen__glow splash-screen__glow--tl" aria-hidden />
            <div className="splash-screen__glow splash-screen__glow--br" aria-hidden />

            <div className="splash-screen__body">
              <motion.div
                className="splash-screen__mark"
                initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: motionDuration * 0.85, ease: motionEase, delay: 0.06 }}
              >
                <AppBrandLogo size="lg" withGlow className="splash-screen__logo" />
              </motion.div>

              <motion.div
                className="splash-screen__brand"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: motionDuration * 0.75, ease: motionEase, delay: 0.14 }}
              >
                <h1 className="splash-screen__title">LuoScope</h1>
                <p className="splash-screen__tagline" aria-label="轻量、安全、高效">
                  <span>轻量</span>
                  <span>安全</span>
                  <span>高效</span>
                </p>
              </motion.div>
            </div>

            <div className="splash-screen__dock">
              <div className="splash-screen__dock-head">
                <motion.p
                  key={loadingText}
                  className="splash-screen__status"
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24 }}
                >
                  {loadingText}
                </motion.p>
                <span className="splash-screen__step-index" aria-hidden>
                  {String(activeStep + 1).padStart(2, '0')}
                  <span className="splash-screen__step-index-sep">/</span>
                  {String(LOADING_STEPS.length).padStart(2, '0')}
                </span>
              </div>

              <div
                className="splash-screen__progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progressPercent)}
                aria-label="启动进度"
              >
                <div className="splash-screen__progress-track">
                  <div
                    className={`splash-screen__progress-fill${
                      prefersReducedMotion ? ' splash-screen__progress-fill--static' : ''
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <p className="splash-screen__credit">RobustLuo · 官方维护</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SplashScreen;

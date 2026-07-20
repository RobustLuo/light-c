// ============================================================================
// 遮罩层动画 Hook — 统一弹窗/浮层的入退场生命周期，避免各组件重复写计时器
// ============================================================================

import { useEffect, useRef, useState } from 'react';

interface UseOverlayAnimationOptions {
  /** 退场动画时长（ms），需与 CSS 动画时长对齐 */
  exitDuration?: number;
}

export function useOverlayAnimation(isOpen: boolean, options: UseOverlayAnimationOptions = {}) {
  const { exitDuration = 260 } = options;
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const enteredRef = useRef(false);

  if (isVisible) {
    enteredRef.current = true;
  }

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      setIsVisible(true);
      return;
    }

    setIsVisible(false);
    const timer = window.setTimeout(() => {
      setIsAnimating(false);
    }, exitDuration);

    return () => window.clearTimeout(timer);
  }, [isOpen, exitDuration]);

  return {
    isVisible,
    isAnimating,
    enteredRef,
    shouldRender: isOpen || isAnimating,
  };
}

// ============================================================================
// 操作进度遮罩 — 简约高端的全局处理提示，统一入退场动画
// ============================================================================

import { createPortal } from 'react-dom';
import { useOverlayAnimation } from '../hooks/useOverlayAnimation';

export type OperationProgressTone = 'brand' | 'warning' | 'danger';

export interface OperationProgressOverlayProps {
  /** 是否显示遮罩 */
  isOpen: boolean;
  /** 主标题 */
  title: string;
  /** 副标题 / 进度说明 */
  description: string;
  /** 底部提示，默认提醒用户保持窗口打开 */
  hint?: string;
  /** 强调色：品牌蓝 / 警告橙 / 危险红 */
  tone?: OperationProgressTone;
}

export function OperationProgressOverlay({
  isOpen,
  title,
  description,
  hint = '处理中，请保持窗口打开',
  tone = 'brand',
}: OperationProgressOverlayProps) {
  const { isVisible, shouldRender, enteredRef } = useOverlayAnimation(isOpen, { exitDuration: 260 });

  if (!shouldRender) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className={`absolute inset-0 bg-black/30 backdrop-blur-md ${
          isVisible ? 'modal-overlay-in' : enteredRef.current ? 'modal-overlay-out' : 'opacity-0'
        }`}
      />

      <div
        data-tone={tone}
        className={`operation-progress-panel glass-panel-strong ${
          isVisible ? 'operation-progress-in' : enteredRef.current ? 'operation-progress-out' : 'opacity-0'
        }`}
      >
        <div className="operation-progress-panel__ambient" aria-hidden />

        <div className="operation-progress-panel__body">
          <div className="operation-progress-indicator" aria-hidden>
            <div className="operation-progress-ring" />
          </div>

          <h3 className="operation-progress-panel__title">{title}</h3>
          <p className="operation-progress-panel__desc">{description}</p>

          <div className="operation-progress-track" aria-hidden>
            <div className="operation-progress-shimmer" />
          </div>

          <p className="operation-progress-panel__hint">{hint}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default OperationProgressOverlay;

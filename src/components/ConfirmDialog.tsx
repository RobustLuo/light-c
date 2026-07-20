// ============================================================================
// 确认对话框组件 - 用于清理前的二次确认
// ============================================================================

import { memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { useOverlayAnimation } from '../hooks/useOverlayAnimation';

interface ConfirmDialogProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 标题 */
  title: string;
  /** 描述信息 */
  description: string;
  /** 警告信息（可选） */
  warning?: string;
  /** 确认按钮文字 */
  confirmText?: string;
  /** 取消按钮文字 */
  cancelText?: string;
  /** 确认回调 */
  onConfirm: () => void;
  /** 取消回调 */
  onCancel: () => void;
  /** 是否为危险操作 */
  isDanger?: boolean;
}

/** 将「免责声明：正文」拆成标题 + 正文，提升可读性与排版层次 */
function splitNoticeText(warning: string): { label: string; body: string } {
  const matched = warning.match(/^免责声明[：:]\s*([\s\S]*)$/);
  if (matched) {
    return { label: '免责声明', body: matched[1] };
  }
  return { label: '请注意', body: warning };
}

export const ConfirmDialog = memo(function ConfirmDialog({
  isOpen,
  title,
  description,
  warning,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
  isDanger = false,
}: ConfirmDialogProps) {
  const { isVisible, shouldRender, enteredRef } = useOverlayAnimation(isOpen, { exitDuration: 260 });
  const notice = useMemo(() => (warning ? splitNoticeText(warning) : null), [warning]);

  if (!shouldRender) return null;

  return createPortal(
    // 确认弹窗需要压过设置页和模块详情弹窗，避免危险操作确认被父级弹窗遮住。
    <div className="fixed inset-0 z-[10050] flex items-center justify-center px-4 py-6">
      <div
        className={`absolute inset-0 bg-black/30 backdrop-blur-md ${
          isVisible ? 'modal-overlay-in' : enteredRef.current ? 'modal-overlay-out' : 'opacity-0'
        }`}
        onClick={onCancel}
      />

      <div
        className={`confirm-dialog glass-panel-strong ${
          isVisible ? 'modal-content-in' : enteredRef.current ? 'modal-content-out' : 'opacity-0'
        }`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="confirm-dialog__header">
          <div className="confirm-dialog__title-wrap">
            <span
              className={`confirm-dialog__icon ${isDanger ? 'confirm-dialog__icon--danger' : 'confirm-dialog__icon--safe'}`}
              aria-hidden
            >
              <AlertTriangle className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </span>
            <h3 id="confirm-dialog-title" className="confirm-dialog__title">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="confirm-dialog__close btn-ghost"
            aria-label="关闭确认弹窗"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="confirm-dialog__body">
          <p className="confirm-dialog__description">{description}</p>

          {notice && (
            <div className="confirm-dialog__notice">
              <p className="confirm-dialog__notice-label">{notice.label}</p>
              <p className="confirm-dialog__notice-text">{notice.body}</p>
            </div>
          )}
        </div>

        <footer className="confirm-dialog__footer">
          <button type="button" onClick={onCancel} className="confirm-dialog__cancel">
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`confirm-dialog__confirm ${isDanger ? 'confirm-dialog__confirm--danger' : 'btn-primary'}`}
          >
            {confirmText}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
});

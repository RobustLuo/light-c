// ============================================================================
// 管理员提权提示条 — MFT / 系统瘦身等模块复用
// ============================================================================

import { useState } from 'react';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from './Toast';
import { tryRequestAdminElevation } from '../hooks/useAutoAdminElevation';

interface AdminElevationBannerProps {
  /** 主提示文案 */
  message: string;
  /** 补充说明，默认解释 UAC 与系统占用文件的区别 */
  detail?: string;
  /** 紧凑模式：嵌入模块引导区，避免大块橙色横幅抢占版面 */
  compact?: boolean;
  /** 视觉风格：neutral 与深色毛玻璃主题一致，warning 保留琥珀强调 */
  tone?: 'warning' | 'neutral';
  className?: string;
}

export function AdminElevationBanner({
  message,
  detail,
  compact = false,
  tone = 'warning',
  className = '',
}: AdminElevationBannerProps) {
  const { showToast } = useToast();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleElevate = async () => {
    try {
      setIsRequesting(true);
      await tryRequestAdminElevation();
      showToast({
        type: 'info',
        title: '正在请求管理员权限',
        description: '请在 UAC 弹窗中点击“是”，确认后应用将以管理员身份重启。',
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: '提权失败',
        description: String(error),
      });
    } finally {
      setIsRequesting(false);
    }
  };

  if (compact) {
    const isNeutral = tone === 'neutral';
    return (
      <div
        className={`admin-elevation-banner admin-elevation-banner--compact ${
          isNeutral ? 'admin-elevation-banner--neutral' : ''
        } ${className}`}
      >
        <div className="admin-elevation-banner__content">
          <AlertTriangle className={`admin-elevation-banner__icon h-3.5 w-3.5 ${isNeutral ? 'admin-elevation-banner__icon--neutral' : ''}`} />
          <p className="admin-elevation-banner__message">{message}</p>
        </div>
        <button
          type="button"
          onClick={handleElevate}
          disabled={isRequesting}
          className={`admin-elevation-banner__action ${isNeutral ? 'admin-elevation-banner__action--neutral' : ''}`}
        >
          {isRequesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
          {isRequesting ? '请求中…' : '管理员重启'}
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-start ${className}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="min-w-0 space-y-1">
          <p className="text-[13px] font-medium text-amber-700 dark:text-amber-400">{message}</p>
          <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
            {detail ??
              (import.meta.env.DEV
                ? '开发模式下请关闭 dev 窗口，以管理员身份打开终端并执行 npm run tauri dev。正式版可在 UAC 弹窗确认后以管理员重启。'
                : 'Windows 不允许程序静默获取管理员权限，需通过 UAC 确认一次。部分系统文件即使提权也可能因被占用而跳过。')}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleElevate}
        disabled={isRequesting}
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRequesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
        {isRequesting ? '正在请求...' : '以管理员身份重启'}
      </button>
    </div>
  );
}

// ============================================================================
// 仪表盘功能提示 — 卡片模式下一行轻量引导，可关闭；页面模式由模块卡片承接说明
// ============================================================================

import { useState } from 'react';
import { Info, X } from 'lucide-react';
import { readMigratedStorageItem } from '../utils/storageMigration';

const STORAGE_KEY = 'luoscope_dashboard_guide_dismissed';
const LEGACY_STORAGE_KEYS = ['lightc_dashboard_guide_dismissed'];

interface DashboardGuideBannerProps {
  /** 页面模式不在此处展示，避免与模块卡片标题/图标重复 */
  hidden?: boolean;
}

export function DashboardGuideBanner({ hidden = false }: DashboardGuideBannerProps) {
  const [dismissed, setDismissed] = useState(
    () => readMigratedStorageItem(STORAGE_KEY, LEGACY_STORAGE_KEYS) === 'true',
  );

  if (hidden || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  };

  return (
    <section className="dashboard-guide-strip" aria-label="使用提示">
      <Info className="dashboard-guide-strip__icon h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
      <p className="dashboard-guide-strip__text min-w-0 flex-1">
        左侧选择模块并展开，点击「开始扫描」；顶栏「一键扫描」可并行检测（可在
        <span className="dashboard-guide-strip__emphasis">设置 → 功能设置</span>
        调整范围）。
      </p>
      <button
        type="button"
        onClick={handleDismiss}
        className="dashboard-guide-strip__dismiss btn-ghost"
        aria-label="关闭使用提示"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </section>
  );
}

export default DashboardGuideBanner;

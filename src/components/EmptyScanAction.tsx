// ============================================================================
// 空状态扫描按钮 — 与模块头部扫描入口共用同一 handler
// ============================================================================

import { Search } from 'lucide-react';

interface EmptyScanActionProps {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}

export function EmptyScanAction({
  onClick,
  disabled = false,
  label = '开始扫描',
}: EmptyScanActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="empty-state__scan-btn btn-primary"
    >
      <Search className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}

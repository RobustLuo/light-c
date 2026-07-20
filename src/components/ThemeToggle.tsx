// ============================================================================
// 主题切换组件 — 毛玻璃分段控件
// ============================================================================

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, type ThemeMode } from '../contexts';

const themes: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
  { mode: 'light', icon: Sun, label: '浅色' },
  { mode: 'dark', icon: Moon, label: '深色' },
  { mode: 'system', icon: Monitor, label: '系统' },
];

interface ThemeToggleProps {
  /** 标题栏内嵌模式：去掉外层 glass，与工具栏胶囊一体 */
  variant?: 'default' | 'inline';
}

export function ThemeToggle({ variant = 'default' }: ThemeToggleProps) {
  const { mode, setMode } = useTheme();
  const isInline = variant === 'inline';

  return (
    <div
      className={isInline ? 'title-bar-theme-inline' : 'flex items-center gap-0.5 p-0.5 rounded-[var(--radius-sm)] glass-panel'}
      role="group"
      aria-label="主题模式"
    >
      {themes.map(({ mode: themeMode, icon: Icon, label }) => (
        <button
          key={themeMode}
          type="button"
          onClick={() => setMode(themeMode)}
          title={label}
          aria-label={label}
          aria-pressed={mode === themeMode}
          className={`title-bar-theme-btn ${mode === themeMode ? 'title-bar-theme-btn--active' : ''}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

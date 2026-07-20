// ============================================================================
// 设置页共享 UI — 统一毛玻璃卡片、行布局与分段控件
// ============================================================================

import type { ComponentType, ReactNode } from 'react';

interface SettingsSectionProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
  className?: string;
}

/** 设置分组标题 */
export function SettingsSection({ icon: Icon, title, children, className = '' }: SettingsSectionProps) {
  return (
    <section className={`settings-section space-y-3 ${className}`}>
      <h4 className="settings-section-title">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </h4>
      {children}
    </section>
  );
}

interface SettingsPanelProps {
  children: ReactNode;
  divided?: boolean;
  className?: string;
}

/** 设置内容毛玻璃面板 */
export function SettingsPanel({ children, divided = false, className = '' }: SettingsPanelProps) {
  return (
    <div className={`settings-panel ${divided ? 'settings-panel-divided' : ''} ${className}`}>
      {children}
    </div>
  );
}

interface SettingsRowProps {
  label: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  bordered?: boolean;
  /** 控件换行到说明下方，适合布局预览卡片等宽内容 */
  stacked?: boolean;
  className?: string;
}

/** 设置行：左侧说明 + 右侧控件 */
export function SettingsRow({ label, description, children, bordered = false, stacked = false, className = '' }: SettingsRowProps) {
  return (
    <div className={`settings-row ${stacked ? 'settings-row--stacked' : ''} ${bordered ? 'settings-row-bordered' : ''} ${className}`}>
      <div className="settings-row-copy min-w-0 flex-1">
        <div className="text-sm font-medium text-[var(--text-primary)]">{label}</div>
        {description && <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{description}</p>}
      </div>
      <div className={`settings-row-control ${stacked ? 'settings-row-control--stacked' : 'shrink-0'}`}>{children}</div>
    </div>
  );
}

interface SettingsSegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  title?: string;
}

interface SettingsSegmentedProps<T extends string> {
  options: SettingsSegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  compact?: boolean;
}

/** 简约分段控件，选中态用描边胶囊而非实心色块 */
export function SettingsSegmented<T extends string>({
  options,
  value,
  onChange,
  compact = false,
}: SettingsSegmentedProps<T>) {
  return (
    <div className={`settings-segment ${compact ? 'settings-segment-compact' : ''}`}>
      {options.map(({ value: optionValue, label, icon: Icon, title }) => {
        const isActive = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            title={title ?? label}
            onClick={() => onChange(optionValue)}
            className={`settings-segment-item ${isActive ? 'settings-segment-item-active' : ''}`}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" />}
            {!compact && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}

interface SettingsIconSegmentedProps<T extends string> {
  options: SettingsSegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** 仅图标的分段控件（主题切换等） */
export function SettingsIconSegmented<T extends string>(props: SettingsIconSegmentedProps<T>) {
  return <SettingsSegmented {...props} compact />;
}

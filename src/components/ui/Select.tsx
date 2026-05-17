// ============================================================================
// 通用下拉选择组件 - 适配主题配色
// ============================================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string = string> {
  /** 当前选中值 */
  value: T;
  /** 选项列表 */
  options: SelectOption<T>[];
  /** 选中回调 */
  onChange: (value: T) => void;
  /** 宽度类名，默认 w-28 */
  widthClass?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

export function Select<T extends string = string>({
  value,
  options,
  onChange,
  widthClass = 'w-28',
  disabled = false,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, handleClickOutside]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div ref={containerRef} className={`relative ${widthClass}`}>
      {/* 触发器 */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm
          bg-[var(--bg-card)] border border-[var(--border-color)]
          text-[var(--text-primary)] font-medium
          hover:border-[var(--brand-green)]/50 hover:bg-[var(--bg-hover)]
          focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)]/20
          transition-all duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${open ? 'border-[var(--brand-green)] ring-2 ring-[var(--brand-green)]/20' : ''}`}
      >
        <span>{selectedOption?.label ?? value}</span>
        <ChevronDown
          className={`w-4 h-4 text-[var(--text-muted)] transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* 下拉列表 */}
      {open && (
        <div
          className={`absolute top-full left-0 mt-1.5 w-full py-1 rounded-xl
            bg-[var(--bg-card)] border border-[var(--border-color)]
            shadow-lg shadow-black/5 z-50
            animate-in fade-in slide-in-from-top-1 duration-150`}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm
                  transition-colors duration-100
                  ${isSelected
                    ? 'bg-[var(--brand-green)]/10 text-[var(--brand-green)] font-medium'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  }`}
              >
                <span>{option.label}</span>
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-green)]" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

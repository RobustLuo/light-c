// ============================================================================
// 布局模式选择 — 带线框预览的设置卡片
// ============================================================================

import type { LayoutMode } from '../../config/moduleMeta';
import { LAYOUT_MODE_OPTIONS } from './constants';

interface LayoutModePickerProps {
  value: LayoutMode;
  onChange: (mode: LayoutMode) => void;
}

function LayoutPreview({ mode }: { mode: LayoutMode }) {
  return (
    <div className={`layout-mode-preview layout-mode-preview--${mode}`} aria-hidden>
      <span className="layout-mode-preview__sidebar" />
      <span className="layout-mode-preview__body">
        {mode === 'cards' && (
          <>
            <span className="layout-mode-preview__block layout-mode-preview__block--sm" />
            <span className="layout-mode-preview__block layout-mode-preview__block--sm" />
            <span className="layout-mode-preview__block layout-mode-preview__block--sm" />
          </>
        )}
        {mode === 'pages' && (
          <span className="layout-mode-preview__block layout-mode-preview__block--lg layout-mode-preview__block--solo" />
        )}
        {mode === 'split' && (
          <>
            <span className="layout-mode-preview__split-list">
              <span className="layout-mode-preview__split-item layout-mode-preview__split-item--done" />
              <span className="layout-mode-preview__split-item layout-mode-preview__split-item--idle" />
              <span className="layout-mode-preview__split-item layout-mode-preview__split-item--scan" />
            </span>
            <span className="layout-mode-preview__block layout-mode-preview__block--lg layout-mode-preview__block--solo" />
          </>
        )}
      </span>
    </div>
  );
}

export function LayoutModePicker({ value, onChange }: LayoutModePickerProps) {
  return (
    <div className="layout-mode-picker" role="radiogroup" aria-label="布局模式">
      {LAYOUT_MODE_OPTIONS.map((option) => {
        const isActive = value === option.mode;
        return (
          <button
            key={option.mode}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.mode)}
            className={`layout-mode-picker__card ${isActive ? 'layout-mode-picker__card--active' : ''}`}
          >
            <LayoutPreview mode={option.mode} />
            <span className="layout-mode-picker__title">{option.label}</span>
            <span className="layout-mode-picker__desc">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
}

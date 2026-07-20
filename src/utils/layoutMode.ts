// ============================================================================
// 布局模式工具 — 统一判断 pages / split / cards 行为
// ============================================================================

import type { LayoutMode } from '../config/moduleMeta';

/** 是否为单模块布局（页面模式或分栏模式） */
export function isSingleModuleLayout(mode: LayoutMode): boolean {
  return mode === 'pages' || mode === 'split';
}

/** 是否为分栏模式 */
export function isSplitLayout(mode: LayoutMode): boolean {
  return mode === 'split';
}

/** 传给模块组件的布局：分栏与页面共用 page 变体 */
export function toModuleLayoutMode(mode: LayoutMode): 'pages' | 'cards' {
  return isSingleModuleLayout(mode) ? 'pages' : 'cards';
}

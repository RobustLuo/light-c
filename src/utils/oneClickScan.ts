// ============================================================================
// 一键扫描模块配置 — Dashboard 模块键与设置页 AppModuleId 的映射
// ============================================================================

import { APP_MODULE_META, type AppModuleId } from '../config/moduleMeta';
import type { ModulesState } from '../contexts/DashboardContext';

export type OneClickScanModules = Record<AppModuleId, boolean>;

/** Dashboard 内部模块键 → 设置/导航用的稳定模块 ID */
export const DASHBOARD_MODULE_APP_IDS: Record<keyof ModulesState, AppModuleId> = {
  junk: 'junk-clean',
  bigFiles: 'big-files',
  social: 'social-clean',
  system: 'system-slim',
  driverCleanup: 'driver-cleanup',
  bloatware: 'bloatware-clean',
  leftovers: 'leftovers',
  registry: 'registry',
  contextMenu: 'context-menu',
  hotspot: 'hotspot',
  diskGrowth: 'disk-growth',
  aiModels: 'ai-models',
};

/** 新安装默认仅启用轻量扫描模块，避免一键扫描触发过多 MFT/管理员任务 */
export const DEFAULT_ONE_CLICK_SCAN_MODULES: Record<AppModuleId, boolean> = Object.fromEntries(
  APP_MODULE_META.map((module) => [
    module.id,
    ['junk-clean', 'big-files', 'social-clean', 'hotspot'].includes(module.id),
  ]),
) as Record<AppModuleId, boolean>;

/**
 * 归一化一键扫描模块开关。
 * legacyAllEnabled=true 表示旧版缓存未写入该字段，保持「全部参与」避免升级后行为突变。
 */
export function normalizeOneClickScanModules(
  incoming?: Partial<Record<AppModuleId, boolean>>,
  legacyAllEnabled = false,
): Record<AppModuleId, boolean> {
  if (legacyAllEnabled || !incoming) {
    return Object.fromEntries(APP_MODULE_META.map((module) => [module.id, true])) as Record<
      AppModuleId,
      boolean
    >;
  }

  const normalized = { ...DEFAULT_ONE_CLICK_SCAN_MODULES };
  for (const module of APP_MODULE_META) {
    if (typeof incoming[module.id] === 'boolean') {
      normalized[module.id] = incoming[module.id]!;
    }
  }
  return normalized;
}

/** 判断某个 Dashboard 模块是否应响应一键扫描 */
export function isOneClickScanEnabled(
  moduleKey: keyof ModulesState,
  oneClickScanModules: Record<AppModuleId, boolean>,
): boolean {
  const appModuleId = DASHBOARD_MODULE_APP_IDS[moduleKey];
  return oneClickScanModules[appModuleId] ?? true;
}

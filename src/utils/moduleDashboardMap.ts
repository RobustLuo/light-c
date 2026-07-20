// ============================================================================
// AppModuleId ↔ Dashboard 模块键映射
// ============================================================================

import type { AppModuleId } from '../config/moduleMeta';
import type { ModulesState } from '../contexts/DashboardContext';
import { DASHBOARD_MODULE_APP_IDS } from './oneClickScan';

/** 设置/导航模块 ID → Dashboard 内部状态键 */
export const APP_ID_TO_DASHBOARD_KEY = Object.fromEntries(
  Object.entries(DASHBOARD_MODULE_APP_IDS).map(([dashboardKey, appId]) => [appId, dashboardKey]),
) as Record<AppModuleId, keyof ModulesState>;

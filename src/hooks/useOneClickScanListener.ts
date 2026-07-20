// ============================================================================
// 一键扫描监听 — 各模块统一判断设置开关后再触发扫描，避免重复样板代码
// ============================================================================

import { useEffect, useRef } from 'react';
import type { ModulesState } from '../contexts/DashboardContext';
import { useDashboardSignals } from '../contexts/DashboardContext';
import { useSettings } from '../contexts/SettingsContext';
import { isOneClickScanEnabled } from '../utils/oneClickScan';

/**
 * 监听全局一键扫描触发器；仅当设置中启用该模块时才执行 onTrigger。
 */
export function useOneClickScanListener(
  moduleKey: keyof ModulesState,
  onTrigger: () => void,
) {
  const { oneClickScanTrigger } = useDashboardSignals();
  const { settings } = useSettings();
  const lastScanTriggerRef = useRef(0);

  useEffect(() => {
    if (oneClickScanTrigger <= 0 || oneClickScanTrigger === lastScanTriggerRef.current) {
      return;
    }

    lastScanTriggerRef.current = oneClickScanTrigger;
    if (isOneClickScanEnabled(moduleKey, settings.oneClickScanModules)) {
      onTrigger();
    }
  }, [oneClickScanTrigger, onTrigger, moduleKey, settings.oneClickScanModules]);
}

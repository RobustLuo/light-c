// ============================================================================
// 启动时自动请求管理员提权
// 同一浏览器会话内只尝试一次，避免用户取消 UAC 后反复弹窗。
// ============================================================================

import { useEffect } from 'react';
import { useSettings } from '../contexts';
import { checkAdminPrivilege, requestAdminElevationRestart } from '../api/commands';

const SESSION_ATTEMPT_KEY = 'luoscope-admin-elevation-attempted';
const LEGACY_SESSION_ATTEMPT_KEYS = ['lightc-admin-elevation-attempted'];

/** 标记本会话已尝试过提权，防止取消 UAC 后循环弹窗。 */
export function markAdminElevationAttempted(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SESSION_ATTEMPT_KEY, '1');
  for (const legacyKey of LEGACY_SESSION_ATTEMPT_KEYS) {
    sessionStorage.removeItem(legacyKey);
  }
}

/** 本会话是否已尝试过提权。 */
export function hasAdminElevationAttempted(): boolean {
  if (typeof window === 'undefined') return false;
  if (sessionStorage.getItem(SESSION_ATTEMPT_KEY) === '1') {
    return true;
  }
  // 更名升级后沿用旧 sessionStorage 标记，避免同一会话重复弹 UAC。
  return LEGACY_SESSION_ATTEMPT_KEYS.some((key) => sessionStorage.getItem(key) === '1');
}

/** 尝试以管理员身份重启；成功发起后会由后端关闭当前窗口。 */
export async function tryRequestAdminElevation(): Promise<void> {
  const isAdmin = await checkAdminPrivilege();
  if (isAdmin) return;

  markAdminElevationAttempted();
  await requestAdminElevationRestart();
}

/** 设置开启后，启动时自动检测并请求管理员提权。 */
export function useAutoAdminElevation(): void {
  const { settings } = useSettings();

  useEffect(() => {
    if (!settings.autoRequestAdminOnStartup) return;
    if (hasAdminElevationAttempted()) return;

    let cancelled = false;

    (async () => {
      try {
        const isAdmin = await checkAdminPrivilege();
        if (cancelled || isAdmin) return;
        await tryRequestAdminElevation();
      } catch {
        // 用户取消 UAC 或提权失败时静默结束，避免打断正常使用。
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [settings.autoRequestAdminOnStartup]);
}

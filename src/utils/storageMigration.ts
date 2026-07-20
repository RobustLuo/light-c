// ============================================================================
// localStorage 更名迁移：读取新 key，不存在时回退旧 key 并写入新 key
// ============================================================================

/** 读取 localStorage，若新 key 不存在则依次尝试旧 key 并迁移到新 key。 */
export function readMigratedStorageItem(
  primaryKey: string,
  legacyKeys: string[],
): string | null {
  const primary = localStorage.getItem(primaryKey);
  if (primary !== null) {
    return primary;
  }

  for (const legacyKey of legacyKeys) {
    const legacy = localStorage.getItem(legacyKey);
    if (legacy !== null) {
      localStorage.setItem(primaryKey, legacy);
      return legacy;
    }
  }

  return null;
}

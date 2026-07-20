// ============================================================================
// 官方下载渠道配置
// Fork 版统一指向 RobustLuo 仓库，避免继续读取原项目的 download.json。
// ============================================================================

export interface OfficialDownloadConfig {
  githubReleasesUrl: string;
  /** 微信公众号名称，用于设置页展示 */
  wechatOfficialAccountName?: string;
  /** 公众号文章或主页链接（https），可选 */
  wechatOfficialAccountUrl?: string;
  netDiskUrl?: string;
  bilibiliUrl: string;
  douyinUrl: string;
}

const GITHUB_REPO_URL = 'https://github.com/RobustLuo/light-c';
const DOWNLOAD_CONFIG_URL = `${GITHUB_REPO_URL}/releases/latest/download/download.json`;

const DEFAULT_DOWNLOAD_CONFIG: OfficialDownloadConfig = {
  githubReleasesUrl: `${GITHUB_REPO_URL}/releases`,
  wechatOfficialAccountName: 'LuoScope',
  bilibiliUrl: 'https://github.com/RobustLuo',
  douyinUrl: 'https://github.com/RobustLuo',
};

let cachedConfigPromise: Promise<OfficialDownloadConfig> | null = null;

function isSafeHttpsUrl(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith('https://');
}

function mergeDownloadConfig(remoteConfig: unknown): OfficialDownloadConfig {
  if (!remoteConfig || typeof remoteConfig !== 'object') {
    return DEFAULT_DOWNLOAD_CONFIG;
  }

  const config = remoteConfig as Partial<Record<keyof OfficialDownloadConfig, unknown>>;

  return {
    // 远端字段必须是 https，避免被异常 JSON 注入到非官方或本地协议。
    githubReleasesUrl: isSafeHttpsUrl(config.githubReleasesUrl)
      ? config.githubReleasesUrl
      : DEFAULT_DOWNLOAD_CONFIG.githubReleasesUrl,
    wechatOfficialAccountName:
      typeof config.wechatOfficialAccountName === 'string' && config.wechatOfficialAccountName.trim()
        ? config.wechatOfficialAccountName.trim()
        : DEFAULT_DOWNLOAD_CONFIG.wechatOfficialAccountName,
    wechatOfficialAccountUrl: isSafeHttpsUrl(config.wechatOfficialAccountUrl)
      ? config.wechatOfficialAccountUrl
      : undefined,
    bilibiliUrl: isSafeHttpsUrl(config.bilibiliUrl)
      ? config.bilibiliUrl
      : DEFAULT_DOWNLOAD_CONFIG.bilibiliUrl,
    douyinUrl: isSafeHttpsUrl(config.douyinUrl)
      ? config.douyinUrl
      : DEFAULT_DOWNLOAD_CONFIG.douyinUrl,
    netDiskUrl: isSafeHttpsUrl(config.netDiskUrl) ? config.netDiskUrl : undefined,
  };
}

export async function getOfficialDownloadConfig(): Promise<OfficialDownloadConfig> {
  if (!cachedConfigPromise) {
    cachedConfigPromise = fetch(DOWNLOAD_CONFIG_URL, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`download.json 请求失败: ${response.status}`);
        }
        return response.json();
      })
      .then(mergeDownloadConfig)
      .catch((error) => {
        console.warn('读取官方下载配置失败，已降级到内置官方渠道:', error);
        return DEFAULT_DOWNLOAD_CONFIG;
      });
  }

  return cachedConfigPromise;
}

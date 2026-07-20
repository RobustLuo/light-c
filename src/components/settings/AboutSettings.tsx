// ============================================================================
// 关于页面
// ============================================================================

import { useEffect, useState } from 'react';
import {
  Clock,
  Cpu,
  ExternalLink,
  HardDrive,
  HelpCircle,
  Info,
  Monitor as MonitorIcon,
  RefreshCw,
  Sparkles,
  User,
} from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';
import { getDistributionChannel, getSystemInfo, type DistributionChannel, type SystemInfo } from '../../api/commands';
import { formatSize } from '../../utils/format';
import { AppBrandLogo } from '../AppBrandLogo';
import { SettingsPanel, SettingsSection } from './SettingsUi';

/** 系统信息行配置，便于统一渲染卡片网格 */
const SYSTEM_INFO_FIELDS: Array<{
  key: keyof SystemInfo;
  label: string;
  icon: typeof MonitorIcon;
  format?: (info: SystemInfo) => string;
}> = [
  { key: 'os_version', label: '操作系统', icon: MonitorIcon },
  { key: 'os_arch', label: '系统架构', icon: HardDrive },
  { key: 'cpu_info', label: '处理器', icon: Cpu },
  { key: 'cpu_cores', label: 'CPU 核心', icon: Cpu, format: (info) => `${info.cpu_cores} 核` },
  {
    key: 'total_memory',
    label: '内存',
    icon: HardDrive,
    format: (info) => `${formatSize(info.available_memory)} 可用 / ${formatSize(info.total_memory)}`,
  },
  { key: 'computer_name', label: '计算机名', icon: User },
  { key: 'user_name', label: '当前用户', icon: User },
  {
    key: 'uptime_seconds',
    label: '运行时间',
    icon: Clock,
    format: (info) => {
      const days = Math.floor(info.uptime_seconds / 86400);
      const hours = Math.floor((info.uptime_seconds % 86400) / 3600);
      const minutes = Math.floor((info.uptime_seconds % 3600) / 60);
      return `${days} 天 ${hours} 小时 ${minutes} 分钟`;
    },
  },
];

function formatSystemInfoValue(info: SystemInfo, field: (typeof SYSTEM_INFO_FIELDS)[number]): string {
  if (field.format) return field.format(info);
  const raw = info[field.key];
  return raw === undefined || raw === null ? '—' : String(raw);
}

export function AboutSettings() {
  const [appVersion, setAppVersion] = useState('');
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loadingSystemInfo, setLoadingSystemInfo] = useState(true);
  const [distributionChannel, setDistributionChannel] = useState<DistributionChannel>('installer');

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion('未知'));

    getSystemInfo()
      .then(setSystemInfo)
      .catch((error) => console.error('获取系统信息失败:', error))
      .finally(() => setLoadingSystemInfo(false));

    // 便携版使用 zip 覆盖更新，关于页需要把入口文案改成作者渠道下载，避免误导用户走安装器更新。
    getDistributionChannel()
      .then(setDistributionChannel)
      .catch((error) => console.error('获取发行渠道失败:', error));
  }, []);

  const channelLabel = distributionChannel === 'portable' ? '便携版' : '安装版';

  return (
    <div className="space-y-8">
      <SettingsSection icon={Info} title="应用信息">
        <div className="about-hero glass-panel-strong">
          <div className="about-hero__glow" aria-hidden />

          <div className="about-hero__content">
            <AppBrandLogo size="lg" withGlow />

            <div className="about-hero__copy">
              <div className="about-hero__title-row">
                <h3 className="about-hero__title">LuoScope</h3>
                <span className="about-hero__badge">v{appVersion || '…'}</span>
                <span className="about-hero__badge about-hero__badge--muted">{channelLabel}</span>
              </div>
              <p className="about-hero__subtitle">Windows 智能磁盘空间管理</p>
              <p className="about-hero__tagline">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--brand-green)]" />
                轻量 · 安全 · 高效释放磁盘空间
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('luoscope:check-update'))}
            className="about-hero__action"
          >
            <RefreshCw className="h-4 w-4" />
            {distributionChannel === 'portable' ? '作者渠道下载' : '检查更新'}
          </button>

          <p className="about-hero__hint">
            {distributionChannel === 'portable'
              ? '便携版不会自动安装更新，推荐从作者网盘下载新版 zip 后覆盖当前目录，GitHub Releases 作为官方备用渠道。'
              : '更新源为 GitHub，国内可能出现间歇性 DNS 污染，失败时可稍后重试。'}
          </p>
        </div>
      </SettingsSection>

      <SettingsSection icon={MonitorIcon} title="系统信息">
        <SettingsPanel className="about-system-panel">
          {loadingSystemInfo ? (
            <div className="about-system-loading">
              <RefreshCw className="h-5 w-5 animate-spin text-[var(--brand-green)]" />
              <span>正在读取本机信息…</span>
            </div>
          ) : systemInfo ? (
            <div className="about-system-grid">
              {SYSTEM_INFO_FIELDS.map((field) => {
                const Icon = field.icon;
                const value = formatSystemInfoValue(systemInfo, field);
                return (
                  <div key={field.label} className="about-system-item">
                    <div className="about-system-item__head">
                      <span className="about-system-item__icon">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="about-system-item__label">{field.label}</span>
                    </div>
                    <p className="about-system-item__value" title={value}>
                      {value}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-[var(--text-muted)]">无法获取系统信息</p>
          )}
        </SettingsPanel>
      </SettingsSection>

      <SettingsSection icon={HelpCircle} title="为什么叫 LuoScope">
        <SettingsPanel>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--brand-green)]">Luo</span> 来自作者 RobustLuo，代表持续维护与可靠；
            <span className="font-medium text-[var(--brand-green)]"> Scope</span> 意为「视野 / 范围」，寓意全面审视磁盘空间。
            LuoScope 致力于安全、高效地清理垃圾文件、分析磁盘占用，释放空间并让系统运行更流畅。
          </p>
        </SettingsPanel>
      </SettingsSection>

      <footer className="about-footer">
        <a
          href="https://github.com/RobustLuo"
          target="_blank"
          rel="noopener noreferrer"
          className="about-footer__author"
        >
          <span className="about-footer__author-icon" aria-hidden>
            <User className="h-4 w-4" />
          </span>
          <span className="about-footer__author-copy">
            <span className="about-footer__author-label">开发者</span>
            <span className="about-footer__author-name">@RobustLuo</span>
          </span>
          <ExternalLink className="about-footer__author-arrow h-4 w-4 shrink-0" aria-hidden />
        </a>
        <p className="about-footer__copyright">© {new Date().getFullYear()} RobustLuo</p>
      </footer>
    </div>
  );
}

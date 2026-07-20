// ============================================================================
// 安全与校验页面
// ============================================================================

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Download, ExternalLink, Info, RefreshCw, Shield, ShieldCheck, XCircle } from 'lucide-react';
import { useToast } from '../Toast';
import { getOfficialDownloadConfig, type OfficialDownloadConfig } from '../../utils/downloadConfig';
import { checkAdminPrivilege, verifyIntegrity, type VerifyIntegrityResult } from '../../api/commands';
import { useSettings } from '../../contexts';
import { tryRequestAdminElevation } from '../../hooks/useAutoAdminElevation';
import { SettingsPanel, SettingsRow, SettingsSection } from './SettingsUi';
import { WechatOfficialAccountChannel } from './WechatOfficialAccountChannel';

export function SecuritySettings() {
  const [verifyResult, setVerifyResult] = useState<VerifyIntegrityResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [downloadConfig, setDownloadConfig] = useState<OfficialDownloadConfig | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isRequestingElevation, setIsRequestingElevation] = useState(false);
  const { settings, updateSettings } = useSettings();
  const { showToast } = useToast();

  useEffect(() => {
    // 渠道链接放在 Release 的 download.json，设置页只展示通过 https 校验后的官方入口。
    getOfficialDownloadConfig()
      .then(setDownloadConfig)
      .catch((error) => {
        console.warn('读取官方下载配置失败:', error);
      });
  }, []);

  useEffect(() => {
    checkAdminPrivilege()
      .then(setIsAdmin)
      .catch(() => setIsAdmin(false));
  }, []);

  const handleToggleAutoElevation = async (enabled: boolean) => {
    updateSettings({ autoRequestAdminOnStartup: enabled });
    if (!enabled || isAdmin) return;

    try {
      setIsRequestingElevation(true);
      await tryRequestAdminElevation();
      showToast({
        type: 'info',
        title: '正在请求管理员权限',
        description: '请在 UAC 弹窗中点击“是”，确认后应用将以管理员身份重启。',
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: '提权失败',
        description: String(error),
      });
    } finally {
      setIsRequestingElevation(false);
    }
  };

  const handleManualElevation = async () => {
    try {
      setIsRequestingElevation(true);
      await tryRequestAdminElevation();
      showToast({
        type: 'info',
        title: '正在请求管理员权限',
        description: '请在 UAC 弹窗中点击“是”，确认后应用将以管理员身份重启。',
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: '提权失败',
        description: String(error),
      });
    } finally {
      setIsRequestingElevation(false);
    }
  };

  const handleVerifyIntegrity = async () => {
    try {
      setIsVerifying(true);
      const result = await verifyIntegrity();
      setVerifyResult(result);

      if (result.status === 'verified') {
        showToast({ type: 'success', title: '校验通过', description: result.message });
      } else if (result.status === 'network_error') {
        showToast({ type: 'info', title: '无法连接 GitHub', description: '请检查网络后重试。' });
      } else if (result.status === 'release_unavailable') {
        showToast({ type: 'info', title: '签名资产未发布', description: '当前版本需要等 Release 完成后才能校验。' });
      } else if (result.status === 'signature_error') {
        showToast({ type: 'error', title: '签名资产异常', description: '官方签名文件格式异常，请等待作者修复发布资产。' });
      } else {
        showToast({ type: 'error', title: '校验未通过', description: '当前文件未匹配到对应版本的官方 exe 签名。' });
      }
    } catch (error) {
      setVerifyResult({
        verified: false,
        status: 'network_error',
        version: '',
        channel: '',
        message: `无法连接到 GitHub，请检查网络：${String(error)}`,
        official_url: 'https://github.com/RobustLuo/light-c/releases',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSection icon={Shield} title="管理员权限">
        <SettingsPanel>
          <SettingsRow
            label="启动时自动请求管理员权限"
            description="开启后，若检测到非管理员运行，会在启动时弹出 Windows UAC 请求提权。MFT 全盘分析、系统瘦身、旧驱动清理等功能需要管理员权限。"
          >
            <button
              type="button"
              onClick={() => handleToggleAutoElevation(!settings.autoRequestAdminOnStartup)}
              disabled={isRequestingElevation || isAdmin === true}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
                settings.autoRequestAdminOnStartup ? 'bg-[var(--brand-green)]' : 'bg-[var(--bg-switch)]'
              }`}
              title={isAdmin ? '当前已是管理员模式' : undefined}
            >
              <span
                className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-300 ${
                  settings.autoRequestAdminOnStartup ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </SettingsRow>

          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[var(--border-muted)] bg-[var(--bg-card)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">当前权限状态</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {isAdmin === null
                  ? '正在检测...'
                  : isAdmin
                    ? '已以管理员身份运行，MFT 与系统级清理功能可用。'
                    : '当前为普通用户权限，部分功能会降级或跳过。'}
              </p>
            </div>
            {!isAdmin && (
              <button
                type="button"
                onClick={handleManualElevation}
                disabled={isRequestingElevation}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--brand-green)] px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRequestingElevation ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                {isRequestingElevation ? '正在请求...' : '立即以管理员重启'}
              </button>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/10 p-3">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]" />
              <div className="space-y-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                <p>
                  Windows 安全策略不允许任何程序绕过 UAC 静默提权。LuoScope 只能在您确认 UAC 弹窗后以管理员身份重启自身；
                  「文件被系统占用」的跳过项与权限无关，提权后仍可能无法访问正在使用的系统文件。
                </p>
                {import.meta.env.DEV && (
                  <p className="font-medium text-[var(--color-warning)]">
                    开发模式（npm run tauri dev）不支持应用内提权重启。请以管理员身份打开终端后重新执行 npm run tauri dev。
                  </p>
                )}
              </div>
            </div>
          </div>
        </SettingsPanel>
      </SettingsSection>

      <div className="space-y-3">
        <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          官方原版校验
        </h4>
        <div className="settings-panel p-5 space-y-4">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">校验文件完整性</p>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed mt-1">
              使用官方公钥读取签名来验证当前运行的 LuoScope.exe。
            </p>
          </div>

          <button
            onClick={handleVerifyIntegrity}
            disabled={isVerifying}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[var(--brand-green)] rounded-xl hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isVerifying ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            {isVerifying ? '正在校验...' : '校验文件完整性'}
          </button>

          {verifyResult && <VerifyIntegrityResultCard result={verifyResult} />}
        </div>
      </div>

      {/* 先给出官方渠道，再说明第三方风险，避免用户只看到警告却不知道应该去哪里下载。 */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
          <Download className="w-3.5 h-3.5" />
          官方下载渠道
        </h4>
        <div className="settings-panel p-5 space-y-3">
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            LuoScope 的官方文件仅通过以下渠道发布，其他来源均为第三方转载。
          </p>

          <a
            href={downloadConfig?.githubReleasesUrl ?? 'https://github.com/RobustLuo/light-c/releases'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl bg-[var(--bg-card)] px-3 py-3 transition-colors hover:bg-[var(--bg-hover)] group"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">GitHub Releases</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">唯一的原始发布地址，所有版本均可在此获取</p>
            </div>
            <ExternalLink className="h-4 w-4 shrink-0 text-[var(--text-faint)] group-hover:text-[var(--brand-green)]" />
          </a>

          {downloadConfig?.netDiskUrl && (
            <a
              href={downloadConfig.netDiskUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl bg-[var(--bg-card)] px-3 py-3 transition-colors hover:bg-[var(--bg-hover)] group"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">作者网盘下载</p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">由当前 Release 的 download.json 动态提供，适合便携版下载与覆盖更新</p>
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-[var(--text-faint)] group-hover:text-[var(--brand-green)]" />
            </a>
          )}

          <WechatOfficialAccountChannel
            accountName={downloadConfig?.wechatOfficialAccountName ?? 'LuoScope'}
            accountUrl={downloadConfig?.wechatOfficialAccountUrl}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/10 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] mt-0.5 shrink-0" />
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-medium text-[var(--text-primary)]">第三方渠道的风险</p>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              非官方转载的论坛、网盘分享等第三方渠道发布的 LuoScope 文件，可能存在版本滞后、二次打包、捆绑推广软件或广告程序等问题。
            </p>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              部分网盘链接需要积分或关注，属于借助本软件的商业引流行为。以上风险与作者无关，作者对第三方渠道分发的文件内容不承担任何责任。
            </p>
            <p className="text-xs font-medium leading-relaxed text-[var(--color-warning)]">
              建议使用上方“校验文件完整性”功能，验证当前运行的文件是否为官方原版。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function VerifyIntegrityResultCard({ result }: { result: VerifyIntegrityResult }) {
  if (result.status === 'verified') {
    return (
      <div className="rounded-xl border border-[var(--brand-green)]/20 bg-[var(--brand-green)]/10 p-3">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-4 h-4 text-[var(--brand-green)] mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--brand-green)]">当前为官方原版 v{result.version}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">{result.channel} · 签名验证通过</p>
          </div>
        </div>
      </div>
    );
  }

  if (result.status === 'network_error') {
    return (
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-[var(--text-muted)] mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)]">无法连接到 GitHub</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">请检查网络后重试，或稍后再进行完整性校验。</p>
          </div>
        </div>
      </div>
    );
  }

  if (result.status === 'release_unavailable') {
    return (
      <div className="rounded-xl border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/10 p-3">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-[var(--color-warning)] mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)]">当前版本暂未发布官方签名资产</p>
            <p className="text-xs text-[var(--text-muted)] mt-1 break-all">{result.message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (result.status === 'signature_error') {
    return (
      <div className="rounded-xl border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/10 p-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)]">官方签名资产格式异常</p>
            <p className="text-xs text-[var(--text-muted)] mt-1 break-all">{result.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 p-3">
      <div className="flex items-start gap-3">
        <XCircle className="w-4 h-4 text-[var(--color-danger)] mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-danger)]">签名与当前文件不匹配</p>
          <p className="text-xs text-[var(--text-muted)] mt-1 break-all">{result.message}</p>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            可能原因包括：文件来源不一致、文件被修改，或当前 Release 的 exe 签名资产需要作者重新上传。
          </p>
          <a
            href={result.official_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-green)] hover:opacity-80"
          >
            官方 GitHub Releases
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}


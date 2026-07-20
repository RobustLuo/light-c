// ============================================================================
// 微信公众号官方下载渠道卡片
// 内置关注二维码，用户扫码即可获取安装包与更新通知。
// ============================================================================

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, MessageCircle, X } from 'lucide-react';
import wechatOfficialAccountQr from '../../assets/wechat_official_account_qr.png';

interface WechatOfficialAccountChannelProps {
  accountName: string;
  /** 公众号文章或主页链接，可选 */
  accountUrl?: string;
}

export function WechatOfficialAccountChannel({ accountName, accountUrl }: WechatOfficialAccountChannelProps) {
  const [showModal, setShowModal] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const openModal = () => {
    setShowModal(true);
    requestAnimationFrame(() => setModalVisible(true));
  };

  const closeModal = () => {
    setModalVisible(false);
    setTimeout(() => setShowModal(false), 200);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showModal) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal]);

  return (
    <>
      <div className="rounded-xl bg-[var(--bg-card)] px-3 py-3 sm:px-4 sm:py-4">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 shrink-0 text-[#07C160]" />
              <p className="text-sm font-medium text-[var(--text-primary)]">微信公众号</p>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">
              微信扫码关注「{accountName}」，获取最新安装包与更新通知。
            </p>
            <p className="mt-1 text-[10px] text-[var(--text-faint)]">
              也可在微信搜索公众号名称关注
            </p>
            {accountUrl && (
              <a
                href={accountUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-green)] hover:opacity-80"
              >
                在浏览器打开公众号
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* 二维码固定白底，保证深色模式下仍可被微信正常识别 */}
          <button
            type="button"
            onClick={openModal}
            className="group relative shrink-0 rounded-xl border border-[var(--border-color)] bg-white p-1.5 transition-all duration-200 hover:border-[#07C160]/60 hover:shadow-md"
            title="点击放大二维码"
          >
            <img
              src={wechatOfficialAccountQr}
              alt={`${accountName} 微信公众号二维码`}
              className="h-[88px] w-[88px] object-contain sm:h-[96px] sm:w-[96px]"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 transition-colors group-hover:bg-black/5">
              <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                放大
              </span>
            </div>
          </button>
        </div>
      </div>

      {showModal &&
        createPortal(
          <div
            className={`fixed inset-0 z-[10000] flex items-center justify-center transition-all duration-200 ${
              modalVisible ? 'bg-black/50 backdrop-blur-sm' : 'bg-transparent'
            }`}
            onClick={closeModal}
          >
            <div
              className={`relative rounded-2xl bg-white p-5 shadow-2xl transition-all duration-200 ${
                modalVisible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
              }`}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeModal}
                className="absolute -right-2 -top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-card)] text-[var(--text-muted)] shadow-lg transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>

              <p className="mb-3 text-center text-sm font-medium text-gray-800">关注「{accountName}」</p>
              <img
                src={wechatOfficialAccountQr}
                alt={`${accountName} 微信公众号二维码`}
                className="h-72 w-72 object-contain"
              />
              <p className="mt-3 text-center text-xs text-gray-500">打开微信扫一扫，获取官方安装包与更新</p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

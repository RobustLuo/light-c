// ============================================================================
// 模块卡片组件
// 通用的可展开清理模块卡片，用于仪表盘布局
// ============================================================================

import { ReactNode, useRef, useState, useEffect } from 'react';
import { ChevronDown, Loader2, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatSize } from '../utils/format';
import type { ModuleStatus } from '../contexts/DashboardContext';

// ============================================================================
// 类型定义
// ============================================================================

export interface ModuleCardProps {
  /** 模块唯一标识 */
  id: string;
  /** 模块标题 */
  title: string;
  /** 模块描述 */
  description: string;
  /** 模块图标 */
  icon: ReactNode;
  /** 图标背景色类名 */
  iconBgClass?: string;
  /** 模块状态 */
  status: ModuleStatus;
  /** 发现的文件数量 */
  fileCount: number;
  /** 可清理的总大小（字节） */
  totalSize: number;
  /** 完成且有结果时的状态文案，分析类模块不应默认显示“可清理”。 */
  doneBadgeText?: string;
  /** 完成但没有结果时的状态文案，避免非清理模块显示“已清理”。 */
  emptyDoneBadgeText?: string;
  /** 隐藏完成状态徽章，适合检测类模块避免显示无意义的“已检测”。 */
  hideDoneBadge?: boolean;
  /** fileCount 的单位标签，默认"个文件"。大目录模块可传"个大目录" */
  countLabel?: string;
  /** 仅展示数量，不展示不适用的空间统计。 */
  hideTotalSize?: boolean;
  /** 是否展开 */
  expanded: boolean;
  /** 展开/收起回调 */
  onToggleExpand: () => void;
  /** 扫描按钮点击回调 */
  onScan: () => void;
  /** 扫描按钮文本 */
  scanButtonText?: string;
  /** 是否禁用扫描按钮 */
  scanDisabled?: boolean;
  /** 隐藏头部扫描按钮（页面模式 idle 引导区已有主按钮时使用） */
  hideScanButton?: boolean;
  /** 展开后的内容 */
  children: ReactNode;
  /** 标题旁额外内容，适合放轻量筛选器或模式切换。 */
  titleExtra?: ReactNode;
  /** 头部右侧额外内容 */
  headerExtra?: ReactNode;
  /** 错误信息 */
  error?: string | null;
  /** 展示模式：卡片模式保持手风琴，页面模式用于传统 PC 功能页。 */
  variant?: 'card' | 'page';
  /** 页面模式下强制展示内容，避免切换模块后还要再次展开。 */
  forceExpanded?: boolean;
  /** 允许模块内容中的 sticky 元素跨越卡片内容滚动时保持可见。 */
  allowStickyContent?: boolean;
}

// ============================================================================
// 组件实现
// ============================================================================

export function ModuleCard({
  // id 保留用于未来扩展（如数据追踪）
  id: _id,
  title,
  description,
  icon,
  // 图标背景色默认使用微信绿 10% 透明度
  iconBgClass = 'bg-[var(--brand-green-10)]',
  status,
  fileCount,
  totalSize,
  doneBadgeText = '可清理',
  emptyDoneBadgeText = '已清理',
  hideDoneBadge = false,
  countLabel = '个文件',
  hideTotalSize = false,
  expanded,
  onToggleExpand,
  onScan,
  scanButtonText,
  scanDisabled = false,
  hideScanButton = false,
  children,
  titleExtra,
  headerExtra,
  error,
  variant = 'card',
  forceExpanded = false,
  allowStickyContent = false,
}: ModuleCardProps) {
  const isScanning = status === 'scanning';
  const isDone = status === 'done';
  const hasError = status === 'error' || !!error;
  const isPageVariant = variant === 'page';
  const contentExpanded = forceExpanded || expanded;

  // 获取状态标签 - 使用微信绿色系
  const getStatusBadge = () => {
    if (isScanning) {
      return (
        <span className="module-card-scan-badge" aria-live="polite">
          <span className="module-card-scan-badge__dot" aria-hidden />
          扫描中
        </span>
      );
    }
    if (hasError) {
      return (
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--color-danger)]/10 text-[var(--color-danger)]">
          <AlertCircle className="w-3 h-3" />
          出错
        </span>
      );
    }
    if (isDone && fileCount > 0) {
      if (hideDoneBadge) return null;
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--brand-green-10)] text-[var(--brand-green)]">
          {doneBadgeText}
        </span>
      );
    }
    if (isDone && fileCount === 0) {
      if (hideDoneBadge) return null;
      return (
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--bg-hover)] text-[var(--text-muted)]">
          <CheckCircle2 className="w-3 h-3" />
          {emptyDoneBadgeText}
        </span>
      );
    }
    return null;
  };

  // 扫描中按钮仅保留图标，避免与标题徽章重复「扫描中」文案
  const getButtonText = () => {
    if (isScanning) return null;
    if (scanButtonText) return scanButtonText;
    if (isDone) return '重新扫描';
    return '开始扫描';
  };

  const buttonText = getButtonText();

  return (
    <div
      className={`
        module-card surface-card overflow-hidden
        ${allowStickyContent ? '!overflow-visible' : ''}
        ${isPageVariant ? 'module-card--page' : ''}
        ${isPageVariant
          ? 'shadow-[var(--shadow-sm)]'
          : expanded
            ? 'shadow-[var(--shadow-md)] ring-1 ring-[var(--brand-green-20)]'
            : ''
        }
      `}
    >
      <div className={`module-card-header ${isPageVariant ? 'module-card-header-page' : ''}`}>
        {/* 主信息行：图标 + 标题 + 扫描按钮，避免所有控件挤在一行 */}
        <div className="module-card-header-main">
          {!isPageVariant && (
            <button
              onClick={onToggleExpand}
              className={`module-card-expand btn-ghost ${expanded ? 'module-card-expand-open' : ''}`}
              aria-label={expanded ? '收起模块' : '展开模块'}
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          )}

          <div className={`module-card-icon ${iconBgClass}`}>{icon}</div>

          <div
            className={`module-card-copy min-w-0 flex-1 ${isPageVariant ? '' : 'cursor-pointer'}`}
            onClick={isPageVariant ? undefined : onToggleExpand}
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="module-card-title">{title}</h3>
              {titleExtra}
              {getStatusBadge()}
            </div>
            <p className="module-card-desc">{description}</p>
            {isPageVariant && status !== 'idle' && (
              <p className="module-card-page-hint">
                清理/删除会二次确认，请仔细核对结果后再执行。
              </p>
            )}
          </div>

          {!hideScanButton && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onScan();
            }}
            disabled={isScanning || scanDisabled}
            className={`module-card-scan ${isScanning || scanDisabled ? 'module-card-scan-disabled' : isDone ? 'module-card-scan-secondary' : 'btn-primary'}`}
          >
            {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {buttonText && <span>{buttonText}</span>}
          </button>
          )}
        </div>

        {/* 统计 + 模块操作：单独一行，页面模式下不再和标题抢宽度 */}
        {(isDone && fileCount > 0) || headerExtra ? (
          <div className="module-card-toolbar">
            {isDone && fileCount > 0 ? (
              <div className="module-stat-chip">
                {!hideTotalSize && <span className="module-stat-value tabular-nums">{formatSize(totalSize)}</span>}
                {!hideTotalSize && <span className="module-stat-dot" aria-hidden="true" />}
                <span className="module-stat-meta tabular-nums">
                  {fileCount.toLocaleString()} {countLabel}
                </span>
              </div>
            ) : (
              <div />
            )}
            {headerExtra && <div className="module-card-toolbar-actions">{headerExtra}</div>}
          </div>
        ) : null}

        {isScanning && (
          <div className="module-card-progress">
            <div className="module-card-progress-track">
              <div className="module-card-progress-shimmer" />
            </div>
          </div>
        )}

        {hasError && error && (
          <div className="module-card-error">
            <p>{error}</p>
          </div>
        )}
      </div>

      {/* 展开内容 - 手风琴动画 */}
      <AccordionContent expanded={contentExpanded} animated={!isPageVariant && !allowStickyContent}>
        <div
          className={
            isPageVariant
              ? 'module-card-page-body'
              : 'border-t border-[var(--border-muted)] pb-2'
          }
        >
          {children}
        </div>
      </AccordionContent>
    </div>
  );
}

// ============================================================================
// 手风琴动画组件
// ============================================================================

interface AccordionContentProps {
  expanded: boolean;
  children: ReactNode;
  animated?: boolean;
}

function AccordionContent({ expanded, children, animated = true }: AccordionContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>(expanded ? 'auto' : 0);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevExpandedRef = useRef(expanded);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const wasExpanded = prevExpandedRef.current;
    prevExpandedRef.current = expanded;

    if (expanded && !wasExpanded) {
      // 展开：先设置实际高度，动画结束后设为 auto
      const scrollHeight = content.scrollHeight;
      setHeight(scrollHeight);
      setIsAnimating(true);
      
      const timer = setTimeout(() => {
        setHeight('auto');
        setIsAnimating(false);
      }, 320);
      
      return () => clearTimeout(timer);
    } else if (!expanded && wasExpanded) {
      // 折叠：先获取当前高度，再动画到 0
      const scrollHeight = content.scrollHeight;
      // 先设置为具体高度（从 auto 转换）
      setHeight(scrollHeight);
      setIsAnimating(true);
      
      // 使用 requestAnimationFrame 确保浏览器先渲染具体高度
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setHeight(0);
        });
      });
      
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 320);
      
      return () => clearTimeout(timer);
    }
  }, [expanded]);

  const shouldRender = expanded || height !== 0 || isAnimating;

  if (!shouldRender) return null;

  if (!animated) {
    // 页面模式或悬浮操作模块不做高度动画，避免 overflow 规则截断 sticky 子元素。
    return expanded ? (
      <div ref={contentRef} className="module-card-page-stage">
        {children}
      </div>
    ) : null;
  }

  return (
    <div
      ref={contentRef}
      className="accordion-motion"
      data-expanded={expanded ? 'true' : 'false'}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        overflow: 'hidden',
      }}
    >
      <div className="accordion-motion-inner">{children}</div>
    </div>
  );
}

export default ModuleCard;

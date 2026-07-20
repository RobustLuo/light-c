// ============================================================================
// 仪表盘顶部统计栏组件
// 显示 C 盘健康评分、磁盘使用情况和一键扫描按钮
// ============================================================================

import { useEffect, useState, useRef, type ComponentType } from 'react';
import { HardDrive, Moon, Trash2, Zap, Square } from 'lucide-react';
import type { AppModuleId } from '../config/moduleMeta';
import { useDashboardActions, useDashboardSummary } from '../contexts/DashboardContext';
import { DashboardDriveStrip } from './DashboardDriveStrip';

// ============================================================================
// 数字跳动动画 Hook
// ============================================================================

function useAnimatedNumber(targetValue: number, duration: number = 800) {
  const [displayValue, setDisplayValue] = useState(0);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef<number>(0);

  useEffect(() => {
    startValueRef.current = displayValue;
    startTimeRef.current = null;

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // 使用 easeOutExpo 缓动函数
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const currentValue = Math.round(startValueRef.current + (targetValue - startValueRef.current) * easeProgress);

      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetValue, duration]);

  return displayValue;
}

// ============================================================================
// 根据分数获取颜色配置
// ============================================================================

interface ScoreColorConfig {
  text: string;
  stroke: string;
  ringGlow: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  bar: string;
  label: string;
}

function getScoreColor(score: number): ScoreColorConfig {
  if (score >= 80) {
    return {
      text: 'text-[var(--color-success)]',
      stroke: 'stroke-[var(--color-success)]',
      ringGlow: 'shadow-[inset_0_0_0_1px_rgba(5,150,105,0.12)]',
      badgeBg: 'bg-[var(--color-success)]/10',
      badgeText: 'text-[var(--color-success)]',
      badgeBorder: 'border-[var(--color-success)]/25',
      bar: 'bg-[var(--color-success)]',
      label: '优秀',
    };
  }
  if (score >= 60) {
    return {
      text: 'text-[var(--color-warning)]',
      stroke: 'stroke-[var(--color-warning)]',
      ringGlow: 'shadow-[inset_0_0_0_1px_rgba(217,119,6,0.12)]',
      badgeBg: 'bg-[var(--color-warning)]/10',
      badgeText: 'text-[var(--color-warning)]',
      badgeBorder: 'border-[var(--color-warning)]/25',
      bar: 'bg-[var(--color-warning)]',
      label: '良好',
    };
  }
  return {
    text: 'text-[var(--color-danger)]',
    stroke: 'stroke-[var(--color-danger)]',
    ringGlow: 'shadow-[inset_0_0_0_1px_rgba(220,38,38,0.12)]',
    badgeBg: 'bg-[var(--color-danger)]/10',
    badgeText: 'text-[var(--color-danger)]',
    badgeBorder: 'border-[var(--color-danger)]/25',
    bar: 'bg-[var(--color-danger)]',
    label: '需优化',
  };
}

// ============================================================================
// 健康评分子项
// ============================================================================

interface HealthMetricProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  max: number;
  barClass: string;
  title: string;
}

function HealthMetric({ icon: Icon, label, value, max, barClass, title }: HealthMetricProps) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;

  return (
    <div
      title={title}
      className="min-w-0 flex-1 rounded-[10px] border border-[var(--border-muted)] bg-[var(--bg-hover)]/70 px-2.5 py-2 cursor-help"
    >
      <div className="flex items-center gap-1 text-[10px] text-[var(--text-faint)]">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-0.5">
        <span className="text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">{value}</span>
        <span className="text-[10px] tabular-nums text-[var(--text-faint)]">/{max}</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--border-muted)]">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${barClass}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// 组件 Props
// ============================================================================

interface DashboardHeaderProps {
  /** 一键扫描回调 */
  onOneClickScan: () => void;
  /** 显示欢迎弹窗回调（彩蛋） */
  onShowWelcome?: () => void;
  /** 页面模式聚焦单模块，隐藏一键扫描可以避免用户误以为只扫描当前页。 */
  hideOneClickScan?: boolean;
  /** 存储洞察条跳转模块（卡片模式滚动 / 页面模式切换） */
  onNavigateModule?: (moduleId: AppModuleId) => void;
}

// ============================================================================
// 组件实现
// ============================================================================

export function DashboardHeader({
  onOneClickScan,
  onShowWelcome,
  hideOneClickScan = false,
  onNavigateModule,
}: DashboardHeaderProps) {
  const { localDrives, healthData, isLoadingHealth, isLoadingDrives, isAnyScanning } = useDashboardSummary();
  const { stopAllScans } = useDashboardActions();

  const animatedScore = useAnimatedNumber(healthData?.score ?? 0);
  const scoreColor = getScoreColor(healthData?.score ?? 0);

  // 三连击计数器（彩蛋）
  const [clickCount, setClickCount] = useState(0);
  const clickTimerRef = useRef<number | null>(null);

  const handleTripleClick = () => {
    setClickCount((prev) => prev + 1);

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    clickTimerRef.current = window.setTimeout(() => {
      setClickCount(0);
    }, 500);

    if (clickCount >= 2) {
      setClickCount(0);
      onShowWelcome?.();
    }
  };

  return (
    <div className="glass-panel sticky top-0 z-20 border-b border-[var(--border-color)] px-5 py-3.5">
      <div className="mx-auto dashboard-shell-width flex items-stretch gap-4">
        {/* 健康评分：独立卡片，避免与磁盘条挤在同一视觉层 */}
        <div
          className="dashboard-health-panel shrink-0 cursor-pointer rounded-[var(--radius-lg)] border border-[var(--border-muted)] bg-[var(--bg-glass-strong)] px-3.5 py-3 backdrop-blur-md"
          onClick={handleTripleClick}
        >
          <div className="flex items-start gap-3.5">
            {/* 评分环：略放大并加柔光，主视觉更聚焦 */}
            <div
              className={`relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[var(--bg-hover)] ${scoreColor.ringGlow}`}
            >
              <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="4" className="stroke-[var(--border-muted)]" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className={scoreColor.stroke}
                  strokeDasharray={`${(healthData?.score ?? 0) * 2.64} 264`}
                  style={{ transition: 'stroke-dasharray 640ms cubic-bezier(0.23, 1, 0.32, 1)' }}
                />
              </svg>
              <span className={`text-lg font-bold tabular-nums leading-none ${scoreColor.text}`}>
                {isLoadingHealth ? '--' : animatedScore}
              </span>
            </div>

            <div className="min-w-[248px]">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">健康评分</span>
                {healthData && (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${scoreColor.badgeBg} ${scoreColor.badgeText} ${scoreColor.badgeBorder}`}
                  >
                    {scoreColor.label}
                  </span>
                )}
              </div>

              {healthData ? (
                <div className="mt-2.5 flex gap-2">
                  <HealthMetric
                    icon={HardDrive}
                    label="磁盘"
                    value={healthData.disk_score}
                    max={40}
                    barClass={scoreColor.bar}
                    title="磁盘空间评分（满分40）&#10;• 可用空间 ≥30%：40分&#10;• 可用空间 20-30%：30分&#10;• 可用空间 10-20%：20分&#10;• 可用空间 <10%：10分"
                  />
                  <HealthMetric
                    icon={Moon}
                    label="休眠"
                    value={healthData.hibernation_score}
                    max={30}
                    barClass={scoreColor.bar}
                    title="休眠文件评分（满分30）&#10;• 已关闭休眠：30分&#10;• 休眠文件存在：0分&#10;休眠文件通常占用 8-32GB 空间"
                  />
                  <HealthMetric
                    icon={Trash2}
                    label="垃圾"
                    value={healthData.junk_score}
                    max={30}
                    barClass={scoreColor.bar}
                    title="垃圾文件评分（满分30）&#10;• 垃圾 <500MB：30分&#10;• 垃圾 500MB-2GB：20分&#10;• 垃圾 2-5GB：10分&#10;• 垃圾 >5GB：0分"
                  />
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-[var(--text-faint)]">正在计算健康评分…</p>
              )}
            </div>
          </div>
        </div>

        {/* 全部分区：固定盘 + U 盘，横向滚动卡片 */}
        <DashboardDriveStrip
          drives={localDrives}
          loading={isLoadingDrives}
          onNavigateModule={onNavigateModule}
        />

        {!hideOneClickScan && (
          <>
            <div className="my-1 w-px shrink-0 bg-[var(--border-color)]" />

            <div className="flex shrink-0 items-center">
              {isAnyScanning ? (
                <button
                  onClick={stopAllScans}
                  className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-danger)]/12 px-4 py-2.5 text-[13px] font-semibold text-[var(--color-danger)] transition-transform duration-100 hover:bg-[var(--color-danger)]/18 active:scale-[0.97]"
                  title="停止扫描"
                >
                  <Square className="h-4 w-4" />
                  停止扫描
                </button>
              ) : (
                <button onClick={onOneClickScan} className="btn-primary">
                  <Zap className="h-4 w-4" />
                  一键扫描
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default DashboardHeader;

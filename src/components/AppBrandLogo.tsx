// ============================================================================
// 应用品牌 Logo — 标题栏 / 关于页 / 欢迎弹窗复用
// ============================================================================

interface AppBrandLogoProps {
  /** sm=标题栏，md=关于页，lg=关于页主视觉 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否显示品牌色外圈光晕 */
  withGlow?: boolean;
  className?: string;
}

const sizeClassMap = {
  sm: 'app-brand-logo--sm',
  md: 'app-brand-logo--md',
  lg: 'app-brand-logo--lg',
} as const;

export function AppBrandLogo({ size = 'sm', withGlow = false, className = '' }: AppBrandLogoProps) {
  return (
    <div className={`app-brand-logo ${sizeClassMap[size]} ${withGlow ? 'app-brand-logo--glow' : ''} ${className}`}>
      <img src="/logo.png" alt="LuoScope" className="app-brand-logo__image" draggable={false} />
    </div>
  );
}

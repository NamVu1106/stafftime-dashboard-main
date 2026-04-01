import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'primary' | 'success' | 'warning' | 'info' | 'destructive';
  description?: string;
  /** Thẻ có thể bấm (ví dụ mở chi tiết) */
  onClick?: () => void;
  /** Gọn hơn để nhét nhiều thẻ trên một màn hình */
  density?: 'comfortable' | 'compact';
}

const variantStyles = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
  destructive: 'bg-destructive/10 text-destructive',
};

export const StatCard = ({
  title,
  value,
  icon: Icon,
  trend,
  variant = 'primary',
  description,
  onClick,
  density = 'comfortable',
}: StatCardProps) => {
  const compact = density === 'compact';
  return (
    <div
      className={cn(
        'stat-card group',
        compact && 'p-3 md:p-3 hover:translate-y-0 hover:shadow-sm',
        onClick && 'cursor-pointer transition-colors hover:bg-muted/40'
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={cn('text-muted-foreground font-medium mb-0.5', compact ? 'text-[11px] leading-tight' : 'text-sm mb-1')}>{title}</p>
          <p
            className={cn(
              'font-bold text-foreground tabular-nums leading-tight',
              compact ? 'text-lg md:text-xl' : 'text-2xl md:text-3xl'
            )}
          >
            {value}
          </p>
          {description && (
            <p className={cn('text-muted-foreground mt-0.5', compact ? 'text-[10px] leading-snug line-clamp-2' : 'text-xs mt-1')}>
              {description}
            </p>
          )}
          {trend && (
            <p className={cn(
              "text-sm mt-2 font-medium",
              trend.isPositive ? "text-success" : "text-destructive"
            )}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% so với hôm qua
            </p>
          )}
        </div>
        <div
          className={cn(
            'stat-card-icon shrink-0',
            variantStyles[variant],
            compact && '!w-9 !h-9 rounded-md group-hover:scale-100 group-hover:rotate-0'
          )}
        >
          <Icon className={compact ? 'w-4 h-4' : 'w-6 h-6'} />
        </div>
      </div>
    </div>
  );
};

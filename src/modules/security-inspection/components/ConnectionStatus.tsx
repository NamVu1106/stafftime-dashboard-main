import { Cloud, CloudOff } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';

export function ConnectionStatus({
  online,
  pending = 0,
  className,
}: {
  online: boolean;
  pending?: number;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold',
        online ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900',
        className
      )}
      role="status"
    >
      {online ? <Cloud className="h-5 w-5" /> : <CloudOff className="h-5 w-5" />}
      <span>{online ? t('securityInspection.online') : t('securityInspection.offline')}</span>
      {pending > 0 && (
        <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs">
          {t('securityInspection.pendingSync', { n: pending })}
        </span>
      )}
    </div>
  );
}

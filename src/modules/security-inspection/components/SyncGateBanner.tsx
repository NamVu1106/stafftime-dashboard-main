import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';

/** Chỉ kết thúc ca khi đám mây xanh — cảnh báo khi còn hàng đợi đồng bộ */
export function SyncGateBanner({
  online,
  pending,
  syncing,
}: {
  online: boolean;
  pending: number;
  syncing?: boolean;
}) {
  const { t } = useI18n();
  const synced = online && pending === 0 && !syncing;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-bold',
        synced
          ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
          : 'border-amber-400 bg-amber-50 text-amber-950'
      )}
      role="status"
    >
      {syncing ? (
        <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
      ) : synced ? (
        <Cloud className="h-5 w-5 shrink-0 text-emerald-600" />
      ) : (
        <CloudOff className="h-5 w-5 shrink-0" />
      )}
      <span>
        {syncing
          ? t('securityInspection.syncing')
          : synced
            ? t('securityInspection.syncReady')
            : t('securityInspection.syncPending', { n: pending })}
      </span>
    </div>
  );
}

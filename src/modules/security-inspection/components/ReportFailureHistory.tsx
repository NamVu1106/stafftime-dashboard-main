import { useQuery } from '@tanstack/react-query';
import { History, Loader2 } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { securityInspectionAPI } from '../api';
import { photoUrl } from '../lib/photoUrl';
import { cn } from '@/lib/utils';

export function ReportFailureHistory({ from, to }: { from: string; to: string }) {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ['security-failure-history', from, to],
    queryFn: () => securityInspectionAPI.getFailureHistory(from, to),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const rows = data?.data ?? [];
  if (rows.length === 0) {
    return <p className="py-8 text-center text-slate-500">{t('securityInspection.reportEmpty')}</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <article
          key={row.id}
          className={cn(
            'overflow-hidden rounded-xl border-2 bg-white shadow-sm',
            row.resolved_at ? 'border-slate-200' : 'border-red-200'
          )}
        >
          {row.photo_url ? (
            <a href={photoUrl(row.photo_url)} target="_blank" rel="noreferrer">
              <img
                src={photoUrl(row.photo_url)}
                alt=""
                className="h-40 w-full object-cover"
              />
            </a>
          ) : (
            <div className="flex h-24 items-center justify-center bg-slate-100 text-sm text-slate-400">
              {t('securityInspection.noPhoto')}
            </div>
          )}
          <div className="p-3">
            <div className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-500">
              <History className="h-3 w-3" />
              {row.created_at.slice(0, 10)}
            </div>
            <p className="font-bold text-slate-900">{row.item_label}</p>
            <p className="text-xs text-slate-600">
              {row.asset_name} · {row.qr_code}
            </p>
            {row.note && <p className="mt-2 text-sm">{row.note}</p>}
            {row.resolved_at && (
              <p className="mt-2 text-xs font-bold text-emerald-700">
                {t('securityInspection.resolvedLabel', {
                  by: row.resolved_by ?? '—',
                  at: row.resolved_at.slice(0, 10),
                })}
              </p>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

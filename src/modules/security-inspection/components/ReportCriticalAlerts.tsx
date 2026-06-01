import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/useI18n';
import { Button } from '@/components/ui/button';
import { securityInspectionAPI } from '../api';
import { photoUrl } from '../lib/photoUrl';

export function ReportCriticalAlerts({ from, to }: { from: string; to: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['security-critical-alerts', from, to],
    queryFn: () => securityInspectionAPI.getCriticalAlerts(from, to),
  });

  const resolveMut = useMutation({
    mutationFn: (id: number) => securityInspectionAPI.resolveFailure(id),
    onSuccess: () => {
      toast.success(t('securityInspection.resolveOk'));
      qc.invalidateQueries({ queryKey: ['security-critical-alerts'] });
      qc.invalidateQueries({ queryKey: ['security-failure-history'] });
      qc.invalidateQueries({ queryKey: ['security-report-dashboard'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  const rows = data?.data ?? [];
  if (rows.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-6">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        <p className="font-bold text-emerald-900">{t('securityInspection.noOpenAlerts')}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li
          key={row.id}
          className="rounded-xl border-2 border-red-200 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-2">
              <AlertTriangle className="h-6 w-6 shrink-0 text-red-600" />
              <div>
                <p className="font-bold text-red-900">{row.item_label}</p>
                <p className="text-sm text-slate-600">
                  {row.department_name} · {row.asset_name} ({row.qr_code})
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {row.created_at.slice(0, 16)} · {row.inspector_username} · {row.shift_label}
                </p>
                {row.note && (
                  <p className="mt-2 text-sm font-semibold text-slate-800">{row.note}</p>
                )}
                {row.numeric_value != null && (
                  <p className="text-sm font-bold text-red-700">
                    {t('securityInspection.measuredValue')}: {row.numeric_value}
                  </p>
                )}
              </div>
            </div>
            {row.photo_url && (
              <a
                href={photoUrl(row.photo_url)}
                target="_blank"
                rel="noreferrer"
                className="block shrink-0 overflow-hidden rounded-lg border-2 border-slate-200"
              >
                <img
                  src={photoUrl(row.photo_url)}
                  alt=""
                  className="h-24 w-24 object-cover"
                />
              </a>
            )}
          </div>
          <Button
            type="button"
            className="sec-touch-btn mt-3 min-h-12 w-full font-bold sm:w-auto"
            disabled={resolveMut.isPending}
            onClick={() => resolveMut.mutate(row.id)}
          >
            {resolveMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t('securityInspection.markResolved')
            )}
          </Button>
        </li>
      ))}
    </ul>
  );
}

import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';
import type { InspectionItemStatus } from '../types';

export function PassFailButtons({
  value,
  onChange,
}: {
  value: InspectionItemStatus;
  onChange: (v: InspectionItemStatus) => void;
}) {
  const { t } = useI18n();
  const btn = (v: InspectionItemStatus, label: string, colors: string) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      className={cn(
        'sec-touch-btn min-h-12 flex-1 rounded-xl border-2 text-base font-bold transition',
        value === v ? colors : 'border-slate-200 bg-white text-slate-700'
      )}
    >
      {label}
    </button>
  );
  return (
    <div className="flex gap-2">
      {btn('pass', t('securityInspection.pass'), 'border-emerald-600 bg-emerald-600 text-white')}
      {btn('fail', t('securityInspection.fail'), 'border-red-600 bg-red-600 text-white')}
      {btn('skip', t('securityInspection.skip'), 'border-slate-500 bg-slate-500 text-white')}
    </div>
  );
}

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
  const btn = (
    v: InspectionItemStatus,
    label: string,
    colors: string,
    large?: boolean
  ) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      className={cn(
        'sec-touch-btn flex-1 rounded-xl border-2 font-bold transition active:scale-[0.98]',
        large ? 'min-h-[56px] text-lg sm:text-xl' : 'min-h-11 text-sm',
        value === v ? colors : 'border-slate-200 bg-white text-slate-700'
      )}
    >
      {label}
    </button>
  );
  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        {btn('pass', t('securityInspection.pass'), 'border-emerald-600 bg-emerald-600 text-white', true)}
        {btn('fail', t('securityInspection.fail'), 'border-red-600 bg-red-600 text-white', true)}
      </div>
      {btn('skip', t('securityInspection.skip'), 'border-slate-400 bg-slate-100 text-slate-700')}
    </div>
  );
}

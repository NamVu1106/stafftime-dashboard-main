import { CheckCircle2, ClipboardList, QrCode, Send, UserCircle } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';

export type ChecksheetWorkflowStep = 1 | 2 | 3 | 4;

const STEPS: { n: ChecksheetWorkflowStep; icon: typeof UserCircle }[] = [
  { n: 1, icon: UserCircle },
  { n: 2, icon: QrCode },
  { n: 3, icon: ClipboardList },
  { n: 4, icon: Send },
];

export function ChecksheetWorkflowStepper({ current }: { current: ChecksheetWorkflowStep }) {
  const { t } = useI18n();
  const labels: Record<ChecksheetWorkflowStep, string> = {
    1: t('securityInspection.workflowStep1'),
    2: t('securityInspection.workflowStep2'),
    3: t('securityInspection.workflowStep3'),
    4: t('securityInspection.workflowStep4'),
  };

  return (
    <nav
      className="rounded-xl border-2 border-slate-200 bg-white p-3"
      aria-label={t('securityInspection.workflowTitle')}
    >
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        {t('securityInspection.workflowTitle')}
      </p>
      <ol className="flex gap-1">
        {STEPS.map(({ n, icon: Icon }) => {
          const done = n < current;
          const active = n === current;
          return (
            <li key={n} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2',
                  done && 'border-emerald-600 bg-emerald-600 text-white',
                  active && !done && 'border-emerald-600 bg-emerald-50 text-emerald-800',
                  !done && !active && 'border-slate-200 bg-slate-50 text-slate-400'
                )}
              >
                {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <span
                className={cn(
                  'line-clamp-2 text-center text-[10px] font-bold leading-tight sm:text-xs',
                  active ? 'text-emerald-900' : 'text-slate-500'
                )}
              >
                {labels[n]}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

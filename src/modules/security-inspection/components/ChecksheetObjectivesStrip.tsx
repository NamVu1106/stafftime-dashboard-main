import { Camera, Cloud, Database, ListChecks } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';

export function ChecksheetObjectivesStrip({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const items = [
    { icon: Database, title: t('securityInspection.objectiveDigitize'), desc: t('securityInspection.objectiveDigitizeDesc') },
    { icon: Camera, title: t('securityInspection.objectiveAccountability'), desc: t('securityInspection.objectiveAccountabilityDesc') },
    { icon: Cloud, title: t('securityInspection.objectiveRealtime'), desc: t('securityInspection.objectiveRealtimeDesc') },
    { icon: ListChecks, title: t('securityInspection.objectiveStandard'), desc: t('securityInspection.objectiveStandardDesc') },
  ];

  if (compact) {
    return (
      <p className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-white">
        {t('securityInspection.objectivesCompact')}
      </p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map(({ icon: Icon, title, desc }) => (
        <div
          key={title}
          className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
        >
          <Icon className="h-8 w-8 shrink-0 text-emerald-700" />
          <div>
            <p className="text-sm font-bold text-slate-900">{title}</p>
            <p className="text-xs text-slate-600">{desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

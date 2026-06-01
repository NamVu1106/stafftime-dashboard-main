import { ChevronRight } from 'lucide-react';
import type { SecurityDepartment } from '../types';
import { cn } from '@/lib/utils';

export function DeptCard({
  dept,
  onClick,
}: {
  dept: SecurityDepartment;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'sec-touch-card flex min-h-[140px] w-full flex-col justify-between rounded-2xl border-2 p-5 text-left shadow-md transition active:scale-[0.98]',
        'bg-white text-slate-900'
      )}
      style={{ borderColor: dept.color }}
    >
      <div>
        <div
          className="mb-2 inline-block h-3 w-12 rounded-full"
          style={{ backgroundColor: dept.color }}
        />
        <h3 className="text-xl font-bold leading-tight">{dept.name}</h3>
        <p className="mt-1 text-sm font-medium text-slate-600">
          {dept.progressPercent}% · {dept.submittedToday} gửi / {dept.draftToday} nháp
        </p>
      </div>
      <div className="flex items-center justify-end text-slate-500">
        <ChevronRight className="h-8 w-8" strokeWidth={2.5} />
      </div>
    </button>
  );
}

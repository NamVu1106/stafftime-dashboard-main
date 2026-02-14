import { Filter } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useTimeFilter } from '@/contexts/TimeFilterContext';
import { useI18n } from '@/contexts/I18nContext';
import { cn } from '@/lib/utils';

interface TimeFilterProps {
  /** Khi sidebar thu gọn: hiển thị compact */
  collapsed?: boolean;
  /** Gọn hơn cho sidebar */
  compact?: boolean;
}

export const TimeFilter = ({ collapsed = false, compact = true }: TimeFilterProps) => {
  const { t } = useI18n();
  const {
    filterMode,
    setFilterMode,
    selectedDate,
    setSelectedDate,
    dateRange,
    setDateRange,
    toLocalYmd,
  } = useTimeFilter();

  const todayIso = toLocalYmd(new Date());

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 py-2 px-2 border-t border-sidebar-hover shrink-0" title={t('dashboard.timeFilter')}>
        <Filter className="w-5 h-5 text-sidebar-foreground/70" />
        <span className="text-[10px] text-sidebar-foreground/60 truncate w-full text-center">
          {filterMode === 'day' && t('dashboard.today')}
          {filterMode === 'month' && t('dashboard.thisMonth')}
          {filterMode === 'year' && t('dashboard.thisYear')}
          {filterMode === 'single' && t('dashboard.oneDay')}
          {filterMode === 'range' && t('dashboard.period')}
        </span>
      </div>
    );
  }

  return (
    <div className="border-t border-sidebar-hover p-3 space-y-3 shrink-0">
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-sidebar-foreground/70 shrink-0" />
        <h3 className="text-sm font-semibold text-sidebar-foreground">{t('dashboard.timeFilter')}</h3>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {[
            { value: 'day' as const, label: t('dashboard.today') },
            { value: 'month' as const, label: t('dashboard.thisMonth') },
            { value: 'year' as const, label: t('dashboard.thisYear') },
            { value: 'single' as const, label: t('dashboard.oneDay') },
            { value: 'range' as const, label: t('dashboard.period') },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="global-filter-mode"
                value={opt.value}
                checked={filterMode === opt.value}
                onChange={() => {
                  setFilterMode(opt.value);
                  if (opt.value !== 'single' && opt.value !== 'range') {
                    setSelectedDate(todayIso);
                  }
                  if (opt.value === 'range' && !dateRange.start && !dateRange.end) {
                    const end = new Date();
                    const start = new Date();
                    start.setDate(start.getDate() - 90);
                    setDateRange({
                      start: toLocalYmd(start),
                      end: toLocalYmd(end),
                    });
                  }
                }}
                className="w-3.5 h-3.5 text-primary"
              />
              <span className="text-xs text-sidebar-foreground">{opt.label}</span>
            </label>
          ))}
        </div>
        {filterMode === 'single' && (
          <div className="space-y-1">
            <Label htmlFor="global-date-filter" className="text-xs text-sidebar-foreground/80">
              {t('dashboard.selectDate')}
            </Label>
            <Input
              id="global-date-filter"
              type="date"
              value={selectedDate || ''}
              onChange={(e) => setSelectedDate(e.target.value || null)}
              max={todayIso}
              className="h-8 text-xs bg-sidebar-hover/30 border-sidebar-hover text-white"
            />
          </div>
        )}
        {filterMode === 'range' && (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="global-start-date" className="text-xs text-sidebar-foreground/80">
                {t('dashboard.fromDate')}
              </Label>
              <Input
                id="global-start-date"
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                max={dateRange.end || todayIso}
                className="h-8 text-xs bg-sidebar-hover/30 border-sidebar-hover text-white"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="global-end-date" className="text-xs text-sidebar-foreground/80">
                {t('dashboard.toDate')}
              </Label>
              <Input
                id="global-end-date"
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                min={dateRange.start}
                max={todayIso}
                className="h-8 text-xs bg-sidebar-hover/30 border-sidebar-hover text-white"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

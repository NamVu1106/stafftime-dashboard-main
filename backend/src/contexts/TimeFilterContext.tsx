import { createContext, useContext, useState, useMemo, ReactNode } from 'react';

export type FilterMode = 'day' | 'month' | 'year' | 'single' | 'range';

/** Bộ lọc trong Giai đoạn: thời vụ, chính thức, nam, nữ */
export interface PeriodFilters {
  thoiVu: boolean;
  chinhThuc: boolean;
  nam: boolean;
  nu: boolean;
}

interface TimeFilterContextType {
  filterMode: FilterMode;
  setFilterMode: (v: FilterMode) => void;
  selectedDate: string | null;
  setSelectedDate: (v: string | null) => void;
  dateRange: { start: string; end: string };
  setDateRange: (v: { start: string; end: string } | ((prev: { start: string; end: string }) => { start: string; end: string })) => void;
  /** Bộ lọc Giai đoạn: thời vụ, chính thức, nam, nữ */
  periodFilters: PeriodFilters;
  setPeriodFilters: (v: PeriodFilters | ((prev: PeriodFilters) => PeriodFilters)) => void;
  /** Ngày dùng để tính baseDate (YYYY-MM-DD) */
  baseDate: string;
  /** Params cho API: date, start_date, end_date, employment_type, gender */
  params: { date?: string; start_date?: string; end_date?: string; employment_type?: string; gender?: string };
  toLocalYmd: (dt: Date) => string;
  parseYmdLocal: (ymd: string) => Date;
  getMonthRange: (dateStr: string) => { start: string; end: string };
}

const TimeFilterContext = createContext<TimeFilterContextType | undefined>(undefined);

export const useTimeFilter = () => {
  const ctx = useContext(TimeFilterContext);
  if (!ctx) {
    throw new Error('useTimeFilter must be used within TimeFilterProvider');
  }
  return ctx;
};

/** Optional - dùng cho trang không bắt buộc có filter */
export const useTimeFilterOptional = () => {
  return useContext(TimeFilterContext);
};

interface TimeFilterProviderProps {
  children: ReactNode;
}

const toLocalYmd = (dt: Date) => {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseYmdLocal = (ymd: string) => {
  const parts = ymd.split('-').map(Number);
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
    const [y, m, d] = parts;
    return new Date(y, m - 1, d);
  }
  return new Date(ymd);
};

const getMonthRange = (dateStr: string) => {
  const d = parseYmdLocal(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start: toLocalYmd(start), end: toLocalYmd(end) };
};

const defaultPeriodFilters: PeriodFilters = {
  thoiVu: true,
  chinhThuc: true,
  nam: true,
  nu: true,
};

export const TimeFilterProvider = ({ children }: TimeFilterProviderProps) => {
  const todayIso = toLocalYmd(new Date());
  const [filterMode, setFilterMode] = useState<FilterMode>('day');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [periodFilters, setPeriodFilters] = useState<PeriodFilters>(defaultPeriodFilters);

  const baseDate = selectedDate || todayIso;

  const params = useMemo(() => {
    if (filterMode === 'month') {
      const { start, end } = getMonthRange(baseDate);
      return { date: undefined, start_date: start, end_date: end };
    }
    if (filterMode === 'year') {
      const year = new Date().getFullYear();
      return { date: undefined, start_date: `${year}-01-01`, end_date: `${year}-12-31` };
    }
    if (filterMode === 'range') {
      let start_date: string;
      let end_date: string;
      if (dateRange.start && dateRange.end) {
        start_date = dateRange.start;
        end_date = dateRange.end;
      } else {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 90);
        start_date = toLocalYmd(start);
        end_date = toLocalYmd(end);
      }
      const employmentTypes: string[] = [];
      if (periodFilters.chinhThuc) employmentTypes.push('Chính thức');
      if (periodFilters.thoiVu) employmentTypes.push('Thời vụ');
      const genders: string[] = [];
      if (periodFilters.nam) genders.push('Nam');
      if (periodFilters.nu) genders.push('Nữ');
      return {
        date: undefined,
        start_date,
        end_date,
        employment_type: employmentTypes.length > 0 ? employmentTypes.join(',') : undefined,
        gender: genders.length > 0 ? genders.join(',') : undefined,
      };
    }
    if (filterMode === 'single') {
      return { date: selectedDate || undefined, start_date: undefined, end_date: undefined };
    }
    // day
    return { date: undefined, start_date: undefined, end_date: undefined };
  }, [filterMode, baseDate, dateRange, selectedDate, periodFilters]);

  const value: TimeFilterContextType = {
    filterMode,
    setFilterMode,
    selectedDate,
    setSelectedDate,
    dateRange,
    setDateRange,
    periodFilters,
    setPeriodFilters,
    baseDate,
    params,
    toLocalYmd,
    parseYmdLocal,
    getMonthRange,
  };

  return (
    <TimeFilterContext.Provider value={value}>
      {children}
    </TimeFilterContext.Provider>
  );
};

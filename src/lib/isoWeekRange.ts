import { endOfISOWeek, format, getISOWeek, getISOWeekYear, setISOWeek, startOfISOWeek } from 'date-fns';

/** Giá trị `<input type="week" />`: `YYYY-Www` → khoảng Thứ 2–Chủ nhật (YYYY-MM-DD). */
export function isoWeekStringToRange(weekStr: string): { start: string; end: string } | null {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(weekStr.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (!year || week < 1 || week > 53) return null;
  const ref = new Date(year, 0, 4);
  const d = setISOWeek(ref, week);
  const s = startOfISOWeek(d);
  const e = endOfISOWeek(d);
  return {
    start: format(s, 'yyyy-MM-dd'),
    end: format(e, 'yyyy-MM-dd'),
  };
}

/** Tuần ISO hiện tại dạng `YYYY-Www` cho input week. */
export function currentIsoWeekInputValue(): string {
  const now = new Date();
  const y = getISOWeekYear(now);
  const w = getISOWeek(now);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

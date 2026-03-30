import type { HrTemplateId } from '@/data/hrReportTemplates';

type HrSheet = {
  name: string;
  rows: (string | number)[][];
};

/** Khớp JSON `productionSnapshot` từ API attendance-count (TT SX — cộng dồn các ngày trong kỳ lọc). */
export type AttendanceCountShiftBlock = {
  headOfficial: number;
  headSeasonal: number;
  headNew: number;
  presentOfficial: number;
  presentSeasonal: number;
  presentNew: number;
  absentOfficial: number;
  absentSeasonal: number;
  rateOfficialPct: number;
  rateSeasonalPct: number;
};

export type AttendanceCountProductionSnapshot = {
  snapshotDate: string;
  aggregationStart: string;
  aggregationEnd: string;
  aggregationDays: number;
  monthYm: string;
  note?: string;
  day: AttendanceCountShiftBlock;
  night: AttendanceCountShiftBlock;
};

export type HrGridResponse =
  | {
      rows: (string | number)[][];
      merges?: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
      productionSnapshot?: AttendanceCountProductionSnapshot;
    }
  | { sheets: HrSheet[]; productionSnapshot?: AttendanceCountProductionSnapshot };

const normalizeText = (value: unknown) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();

const hasNeedle = (text: unknown, needle: string) => {
  if (!needle.trim()) return true;
  const haystack = ` ${normalizeText(text)} `;
  const expected = ` ${normalizeText(needle)} `;
  return haystack.includes(expected);
};

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value).trim();
  if (!raw) return null;
  const cleaned = raw
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(/,/g, '.')
    .replace(/[^\d.-]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const firstSheetRows = (grid: HrGridResponse | null | undefined) => {
  if (!grid) return [] as (string | number)[][];
  if ('sheets' in grid && Array.isArray(grid.sheets)) return grid.sheets?.[0]?.rows || [];
  return 'rows' in grid && Array.isArray(grid.rows) ? grid.rows : [];
};

const getSummaryValue = (row: (string | number)[]) => {
  const preferred = row.length >= 2 ? toNumber(row[row.length - 2]) : null;
  if (preferred !== null) return preferred;
  for (let i = row.length - 1; i >= 0; i--) {
    const parsed = toNumber(row[i]);
    if (parsed !== null) return parsed;
  }
  return null;
};

const findMetricRow = (
  rows: (string | number)[][],
  groupNeedles: string[],
  metricNeedles: string[]
) => {
  return rows.find((row) => {
    const groupText = row[0];
    const metricText = row[1];
    return (
      groupNeedles.every((needle) => hasNeedle(groupText, needle)) &&
      metricNeedles.every((needle) => hasNeedle(metricText, needle))
    );
  });
};

const findAttendanceRateHeaderRow = (rows: (string | number)[][]) =>
  rows.findIndex((row) => normalizeText(row[0]) === 'no' && normalizeText(row[1]) === 'vendor');

const extractAttendanceRateStatsFromGrid = (grid: HrGridResponse) => {
  const rows = firstSheetRows(grid);
  if (!rows.length) return null;

  const headerRowIndex = findAttendanceRateHeaderRow(rows);
  if (headerRowIndex >= 0) {
    const dataRows = rows.slice(headerRowIndex + 3);
    let total = 0;
    let attended = 0;
    let foundTotalRow = false;

    for (const row of dataRows) {
      const vendor = String(row[1] ?? '').trim();
      if (!vendor || vendor.startsWith('(') || /^vendor$/i.test(vendor)) continue;

      const monthSl = toNumber(row[2]) ?? 0;
      const monthDl = toNumber(row[3]) ?? 0;
      if (/^total$/i.test(vendor)) {
        total = monthSl;
        attended = monthDl;
        foundTotalRow = true;
        continue;
      }
      if (!foundTotalRow) {
        total += monthSl;
        attended += monthDl;
      }
    }

    if (foundTotalRow || total > 0 || attended > 0) {
      return {
        overall: {
          total,
          attended,
          rate: total > 0 ? Math.round((attended / total) * 1000) / 10 : 0,
        },
        groups: [],
      };
    }
  }

  const groups: Array<{ total: number; attended: number; rate: number }> = [];
  let total = 0;
  let attended = 0;

  for (const row of rows.slice(5)) {
    const vendor = String(row[1] ?? '').trim();
    if (!vendor || vendor.startsWith('(')) continue;
    let sumSl = 0;
    let sumDl = 0;
    for (let c = 2; c < row.length; c += 9) {
      sumSl += toNumber(row[c]) ?? 0;
      sumDl += toNumber(row[c + 1]) ?? 0;
    }
    if (sumSl <= 0 && sumDl <= 0) continue;
    total += sumSl;
    attended += sumDl;
    groups.push({
      total: sumSl,
      attended: sumDl,
      rate: sumSl > 0 ? Math.round((sumDl / sumSl) * 1000) / 10 : 0,
    });
  }

  return {
    overall: {
      total,
      attended,
      rate: total > 0 ? Math.round((attended / total) * 1000) / 10 : 0,
    },
    groups,
  };
};

const extractAttendanceCountStatsFromGrid = (grid: HrGridResponse) => {
  const snap = grid && typeof grid === 'object' ? grid.productionSnapshot : undefined;
  if (snap) {
    const official = snap.day.presentOfficial + snap.night.presentOfficial;
    const seasonal = snap.day.presentSeasonal + snap.night.presentSeasonal;
    const newEmployees = snap.day.presentNew + snap.night.presentNew;
    return {
      sums: {
        official,
        seasonal,
        newEmployees,
      },
      usesProductionSnapshot: true as const,
    };
  }
  const rows = firstSheetRows(grid);
  const official = getSummaryValue(findMetricRow(rows, ['chinh thuc'], ['so di lam']) || []);
  const seasonal = getSummaryValue(findMetricRow(rows, ['thoi vu'], ['so di lam']) || []);
  const newEmployees = getSummaryValue(findMetricRow(rows, ['he thong'], ['nhan vien moi']) || []);
  return {
    sums: {
      official: official ?? 0,
      seasonal: seasonal ?? 0,
      newEmployees: newEmployees ?? 0,
    },
    usesProductionSnapshot: false as const,
  };
};

const extractTimesheetStatsFromGrid = (grid: HrGridResponse, paidMetric?: string[]) => {
  const rows = firstSheetRows(grid);
  const employeesCount = getSummaryValue(findMetricRow(rows, [''], ['so nv', 'di lam']) || []);
  const workDays = getSummaryValue(findMetricRow(rows, [''], ['tong cong']) || []);
  const workHours = getSummaryValue(findMetricRow(rows, [''], ['tong gio cong']) || []);
  const overtimeHours = getSummaryValue(findMetricRow(rows, [''], ['ot']) || []);
  const paidHours = paidMetric
    ? getSummaryValue(findMetricRow(rows, [''], paidMetric) || [])
    : null;

  return {
    employeesCount: employeesCount ?? 0,
    sums: {
      workDays: workDays ?? 0,
      workHours: workHours ?? 0,
      overtimeHours: overtimeHours ?? 0,
      ...(paidHours !== null ? { paidHours } : {}),
    },
  };
};

const extractWeeklyOneDayStatsFromGrid = (grid: HrGridResponse) => {
  const rows = firstSheetRows(grid);
  const dataRows = rows.slice(3).filter((row) => String(row[0] ?? '').trim());
  let attended = 0;
  let total = 0;

  for (const row of dataRows) {
    attended += toNumber(row[1]) ?? 0;
    total += toNumber(row[2]) ?? 0;
  }

  return {
    overall: {
      total,
      attended,
      rate: total > 0 ? Math.round((attended / total) * 1000) / 10 : 0,
    },
  };
};

const extractLaborRateStatsFromGrid = (grid: HrGridResponse) => {
  const rows = firstSheetRows(grid);
  const rateRow = findMetricRow(rows, ['tong'], ['ty le di lam']);
  const rate = getSummaryValue(rateRow || []);
  return {
    overall: {
      total: null,
      attended: null,
      value: null,
      rate: rate ?? 0,
    },
  };
};

const extractDailyWageStatsFromGrid = (grid: HrGridResponse) => {
  const rows = firstSheetRows(grid);
  const totalRow = findMetricRow(rows, ['chi tra'], ['tong chi tra']);
  return {
    grandTotal: getSummaryValue(totalRow || []) ?? 0,
  };
};

const extractPayrollStatsFromGrid = (grid: HrGridResponse) => {
  const rows = firstSheetRows(grid);
  const taxRow = findMetricRow(rows, ['thue'], ['thue tncn']);
  const grossRow = findMetricRow(rows, ['chi tra'], ['tong gross']);
  const netRow = findMetricRow(rows, ['thuc nhan'], ['tong net']);
  return {
    tax: {
      totalSum: getSummaryValue(taxRow || []) ?? 0,
    },
    overview: {
      gross: getSummaryValue(grossRow || []) ?? 0,
      net: getSummaryValue(netRow || []) ?? 0,
    },
  };
};

const extractWorkforceStatsFromGrid = (grid: HrGridResponse) => {
  const rows = firstSheetRows(grid);
  const totalRow = findMetricRow(rows, ['toan cong ty'], ['tong nhan su']);
  const attendedRow = findMetricRow(rows, ['toan cong ty'], ['di lam']);
  const rateRow = findMetricRow(rows, ['toan cong ty'], ['ty le di lam']);
  return {
    overall: {
      total: getSummaryValue(totalRow || []) ?? 0,
      attended: getSummaryValue(attendedRow || []) ?? 0,
      rate: getSummaryValue(rateRow || []) ?? 0,
    },
  };
};

export function extractHrBuiltInStats(reportType: string, grid: HrGridResponse | null | undefined) {
  if (!grid) return null;

  switch (reportType as HrTemplateId | string) {
    case 'attendance-rate':
      return { overall: extractAttendanceRateStatsFromGrid(grid)?.overall };
    case 'attendance-count':
      return { attendanceCount: extractAttendanceCountStatsFromGrid(grid) };
    case 'temp-timesheet':
      return { timesheet: extractTimesheetStatsFromGrid(grid) };
    case 'official-timesheet':
      return { timesheet: extractTimesheetStatsFromGrid(grid, ['total tinh luong']) };
    case 'weekly-one-day-workers':
      return extractWeeklyOneDayStatsFromGrid(grid);
    case 'labor-rate':
      return extractLaborRateStatsFromGrid(grid);
    case 'daily-wage':
      return { dailyWage: extractDailyWageStatsFromGrid(grid) };
    case 'payroll':
      return { payroll: extractPayrollStatsFromGrid(grid) };
    case 'workforce-summary':
      return extractWorkforceStatsFromGrid(grid);
    default:
      return null;
  }
}

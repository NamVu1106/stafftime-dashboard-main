import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import XLSX from 'xlsx';
import { query, queryOne } from '../db/sqlServer';

type GridResponse = {
  rows: (string | number)[][];
  merges?: { s: { r: number; c: number }; e: { r: number; c: number } }[];
  rowStyles?: Record<number, Record<string, string | undefined>>;
  cellStyles?: Record<string, Record<string, string | undefined>>;
  colWidths?: Record<number, number>;
  rowHeights?: Record<number, number>;
  hiddenCols?: number[];
  hiddenRows?: number[];
};

/** Số cột ngày trong tháng (1-31) */
const DAY_COLS = 31;

/**
 * Bảng chốt công Thời vụ - header giống "Bang chôt cong TV mẫu.xlsx" sheet Data
 * Cột: No, No CC, ID Mới, Name, BP, Start date, End date, Birthday, Total T7, Total (số giờ) T7, ...
 * Sau đó 26 cột ngày (1-26), rồi Công T6 chưa TT, Total T6 chưa TT, Công T6+7, Total T6+7, Nghỉ có phép, Nghỉ ko phép
 */
function buildTempTimesheetHeader(monthLabel: string): (string | number)[][] {
  const titleRow = [
    'BẢNG CHẤM CÔNG THÁNG ' + monthLabel + ' - THỜI VỤ',
    ...Array(27).fill(''),
  ];
  const dayRow = [
    '',
    '',
    ...Array.from({ length: DAY_COLS }, (_, i) => i + 1),
  ].slice(0, 35);
  const headerRow = [
    'No',
    'No CC',
    'ID Mới',
    'Name',
    'BP',
    'Start date',
    'End date',
    'Birthday',
    'Total T7',
    'Total (số giờ) T7',
    '',
    '',
    '',
    '',
    'Công T6 chưa TT',
    'Total (số giờ) T6 chưa TT',
    '',
    '',
    '',
    '',
    'Công T6+7',
    'Total (số giờ) T6+7',
    '',
    '',
    '',
    '',
    'Nghỉ có phép',
    'Nghỉ ko phép',
  ];
  return [titleRow, dayRow, headerRow];
}

/**
 * Chốt công Chính thức - header đơn giản
 */
function buildOfficialTimesheetHeader(monthLabel: string): (string | number)[][] {
  const titleRow = ['BẢNG CHẤM CÔNG THÁNG ' + monthLabel + ' - CHÍNH THỨC', ...Array(38).fill('')];
  const dayRow = ['', '', ...Array.from({ length: DAY_COLS }, (_, i) => i + 1)];
  const headerRow = [
    'STT',
    'Mã NV',
    'Họ tên',
    'BP',
    ...Array.from({ length: DAY_COLS }, (_, i) => (i + 1).toString()),
    'Tổng công',
    'Tổng giờ',
  ];
  return [titleRow, dayRow, headerRow];
}

/**
 * Số lượng đi làm - header theo mẫu (vài dòng tiêu đề + dòng nhóm)
 */
function buildAttendanceCountHeader(): (string | number)[][] {
  return [
    ['Báo cáo số lượng đi làm', ...Array(15).fill('')],
    ['Nội dung', '2025 Total', 'T8 Total', 'T9 Total', ...Array(10).fill('')],
  ];
}

/**
 * Tỉ lệ đi làm - header đơn giản
 */
function buildAttendanceRateHeader(monthLabel: string): (string | number)[][] {
  return [
    ['Báo cáo tỉ lệ đi làm ' + monthLabel, ...Array(10).fill('')],
    ['STT', 'Bộ phận', 'Tổng NV', 'Đi làm', 'Tỉ lệ %', ...Array(5).fill('')],
  ];
}

/**
 * Công nhân 1 ngày/tuần
 */
function buildWeeklyOneDayHeader(): (string | number)[][] {
  return [
    ['BC số lượng làm 1 công trong tuần', ...Array(8).fill('')],
    ['Tuần', 'Số lượng', 'Ghi chú', ...Array(5).fill('')],
  ];
}

/** ===== Generic builders for HR templates without auto-calculation yet ===== */
function padRow(arr: (string | number)[], len: number): (string | number)[] {
  const out = [...arr];
  while (out.length < len) out.push('');
  return out.slice(0, len);
}

function buildBlankTemplateRows(
  title: string,
  subtitle: string,
  headers: string[],
  cols: number,
  blankDataRows = 12
): (string | number)[][] {
  const rows: (string | number)[][] = [
    padRow([title], cols),
    padRow([subtitle], cols),
    padRow(headers, cols),
  ];
  for (let i = 0; i < blankDataRows; i++) {
    rows.push(padRow(['', ...Array(Math.max(cols - 1, 0)).fill('')], cols));
  }
  return rows;
}

function getBlankTemplateStyles(cols: number, headerRow = 2) {
  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: cols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: cols - 1 } },
  ];
  const rowStyles: Record<number, { backgroundColor: string; color: string; fontWeight: string; textAlign: 'center' }> = {
    0: { backgroundColor: '#1e3a5f', color: '#fff', fontWeight: 'bold', textAlign: 'center' },
    1: { backgroundColor: '#f8fafc', color: '#334155', fontWeight: 'normal', textAlign: 'center' },
    [headerRow]: { backgroundColor: '#e5e7eb', color: '#111827', fontWeight: 'bold', textAlign: 'center' },
  };
  return { merges, rowStyles };
}

function buildLaborRateSheet(monthLabel: string) {
  const cols = 16;
  const rows = buildBlankTemplateRows(
    `BC TỈ LỆ CÂN CHỈNH NHÂN LỰC (${monthLabel})`,
    'Biểu mẫu trống - sẽ tự tính từ dữ liệu hệ thống',
    ['STT', 'Bộ phận', 'Tổng NV', 'Đi làm', 'Tỉ lệ đi làm (%)', 'Vắng', 'Tỉ lệ vắng (%)', 'Ghi chú'],
    cols,
    18
  );
  return { name: 'Sheet1', rows, ...getBlankTemplateStyles(cols) };
}

const COLS_LABOR_RATE_MAIN = 35; // Nhóm, chỉ số, 31 ngày, TB tháng, ghi chú

function buildLaborRateMainSheet(
  monthLabel: string,
  dateStr: string,
  totals: { all: number; official: number; seasonal: number },
  byDay: Map<number, { all: number; official: number; seasonal: number }>
) {
  const dayHeaders = Array.from({ length: DAY_COLS }, (_, i) => i + 1);
  const [y, m, d] = (dateStr || new Date().toISOString().slice(0, 10)).split('-');
  const dateDisplay = `${y}-${m}-${d}`;
  const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);
  const avg = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
  const dayValues = (key: 'all' | 'official' | 'seasonal', den: number) =>
    Array.from({ length: DAY_COLS }, (_, i) => {
      const dVal = byDay.get(i + 1);
      return toFixed1(pct(dVal?.[key] || 0, den));
    });

  const rows: (string | number)[][] = [];
  rows.push(padRow([`BC TỈ LỆ NHÂN LỰC (${monthLabel})`], COLS_LABOR_RATE_MAIN));
  rows.push(padRow([`Dữ liệu tính tự động từ hệ thống chấm công | Ngày chốt: ${dateDisplay}`], COLS_LABOR_RATE_MAIN));
  rows.push(padRow(['Nhóm', 'Chỉ số', ...dayHeaders, 'TB tháng', 'Ghi chú'], COLS_LABOR_RATE_MAIN));

  const allRate = dayValues('all', totals.all);
  const officialRate = dayValues('official', totals.official);
  const seasonalRate = dayValues('seasonal', totals.seasonal);
  rows.push(padRow(['Tổng', 'Tỷ lệ đi làm (%)', ...allRate, toFixed1(avg(allRate)), ''], COLS_LABOR_RATE_MAIN));
  rows.push(padRow(['Chính thức', 'Tỷ lệ đi làm (%)', ...officialRate, toFixed1(avg(officialRate)), ''], COLS_LABOR_RATE_MAIN));
  rows.push(padRow(['Thời vụ', 'Tỷ lệ đi làm (%)', ...seasonalRate, toFixed1(avg(seasonalRate)), ''], COLS_LABOR_RATE_MAIN));
  rows.push(padRow(['Tổng', 'Số đi làm (người)', ...Array.from({ length: DAY_COLS }, (_, i) => byDay.get(i + 1)?.all || 0), '', ''], COLS_LABOR_RATE_MAIN));
  rows.push(padRow(['Chính thức', 'Số đi làm (người)', ...Array.from({ length: DAY_COLS }, (_, i) => byDay.get(i + 1)?.official || 0), '', ''], COLS_LABOR_RATE_MAIN));
  rows.push(padRow(['Thời vụ', 'Số đi làm (người)', ...Array.from({ length: DAY_COLS }, (_, i) => byDay.get(i + 1)?.seasonal || 0), '', ''], COLS_LABOR_RATE_MAIN));

  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: COLS_LABOR_RATE_MAIN - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: COLS_LABOR_RATE_MAIN - 1 } },
  ];
  const rowStyles: Record<number, { backgroundColor: string; color: string; fontWeight: string; textAlign: 'center' }> = {
    0: { backgroundColor: '#1e3a5f', color: '#fff', fontWeight: 'bold', textAlign: 'center' },
    1: { backgroundColor: '#f1f5f9', color: '#334155', fontWeight: 'normal', textAlign: 'center' },
    2: { backgroundColor: '#e5e7eb', color: '#111827', fontWeight: 'bold', textAlign: 'center' },
    3: { backgroundColor: '#fff7ed', color: '#111827', fontWeight: 'normal', textAlign: 'center' },
    4: { backgroundColor: '#ecfeff', color: '#111827', fontWeight: 'normal', textAlign: 'center' },
    5: { backgroundColor: '#f0fdf4', color: '#111827', fontWeight: 'normal', textAlign: 'center' },
  };
  const cellStyles: Record<string, { backgroundColor?: string }> = {};
  const weekendCols = [2 + 6, 2 + 13, 2 + 20, 2 + 27];
  for (const c of weekendCols) {
    if (c < COLS_LABOR_RATE_MAIN) {
      for (let r = 2; r < rows.length; r++) cellStyles[`${r},${c}`] = { backgroundColor: '#fdba74' };
    }
  }

  return {
    name: 'BC Tỉ lệ nhân lực',
    rows,
    merges,
    rowStyles,
    cellStyles,
  };
}

function buildLaborRateDepartmentSheet(
  monthLabel: string,
  deptRows: Array<{ dept: string; total: number; attended: number; rate: number }>
) {
  const cols = 10;
  const rows: (string | number)[][] = [
    padRow([`CHI TIẾT PHÒNG BAN - TỈ LỆ NHÂN LỰC (${monthLabel})`], cols),
    padRow(['STT', 'Bộ phận', 'Tổng NV', 'Đi làm', 'Tỉ lệ đi làm (%)', 'Vắng', 'Ghi chú'], cols),
  ];
  let stt = 1;
  for (const d of deptRows) {
    rows.push(padRow([stt++, d.dept, d.total, d.attended, toFixed1(d.rate), Math.max(d.total - d.attended, 0), ''], cols));
  }
  return {
    name: 'Theo phòng ban',
    rows,
    merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: cols - 1 } }],
    rowStyles: {
      0: { backgroundColor: '#1e3a5f', color: '#fff', fontWeight: 'bold', textAlign: 'center' as const },
      1: { backgroundColor: '#e5e7eb', color: '#111827', fontWeight: 'bold', textAlign: 'center' as const },
    },
  };
}

function buildDailyWageSheet(monthLabel: string) {
  const cols = 18;
  const rows = buildBlankTemplateRows(
    `BÁO CÁO TIỀN CÔNG HÀNG NGÀY (${monthLabel})`,
    'Biểu mẫu trống - chờ công thức tính tự động',
    ['Ngày', 'Mã NV', 'Họ tên', 'Bộ phận', 'Công', 'Giờ công', 'Đơn giá', 'Thành tiền', 'Ghi chú'],
    cols,
    20
  );
  return { name: 'Sheet1', rows, ...getBlankTemplateStyles(cols) };
}

function buildBhxhListSheet(monthLabel: string) {
  const cols = 20;
  const rows = buildBlankTemplateRows(
    `DANH SÁCH THAM GIA BHXH (${monthLabel})`,
    'Biểu mẫu trống - sẽ tự tổng hợp từ dữ liệu nhân sự',
    ['STT', 'Mã NV', 'Họ tên', 'Bộ phận', 'Mã BHXH', 'Mức đóng', 'Tăng/Giảm', 'Tháng hiệu lực', 'Ghi chú'],
    cols,
    16
  );
  return { name: 'Sheet1', rows, ...getBlankTemplateStyles(cols) };
}

function buildInsuranceMasterSheets(monthLabel: string) {
  const cols = 18;
  const baseRows = buildBlankTemplateRows(
    `BẢNG TỔNG HỢP BẢO HIỂM (${monthLabel})`,
    'Biểu mẫu trống - chờ auto-calc',
    ['STT', 'Mã NV', 'Họ tên', 'BHXH NLĐ', 'BHXH DN', 'BHYT', 'BHTN', 'KPCĐ', 'Ghi chú'],
    cols,
    14
  );
  const familyRows = buildBlankTemplateRows(
    `PHỤ LỤC BẢO HIỂM NGƯỜI PHỤ THUỘC (${monthLabel})`,
    'Biểu mẫu trống',
    ['STT', 'Mã NV', 'Họ tên NV', 'Quan hệ', 'Họ tên người phụ thuộc', 'Ngày sinh', 'Ghi chú'],
    cols,
    10
  );
  return [
    { name: 'Sheet1', rows: baseRows, ...getBlankTemplateStyles(cols) },
    { name: 'Phụ lục', rows: familyRows, ...getBlankTemplateStyles(cols) },
  ];
}

function buildPayrollSheets(monthLabel: string) {
  const cols = 22;
  const salaryRows = buildBlankTemplateRows(
    `BẢNG LƯƠNG TỔNG HỢP (${monthLabel})`,
    'Biểu mẫu trống - sẽ tính từ công + master lương',
    ['STT', 'Mã NV', 'Họ tên', 'Bộ phận', 'Lương cơ bản', 'Phụ cấp', 'OT', 'BHXH NLĐ', 'Thuế TNCN', 'Thực nhận', 'Ghi chú'],
    cols,
    18
  );
  const taxRows = buildBlankTemplateRows(
    `THUẾ TNCN / BHXH (${monthLabel})`,
    'Biểu mẫu trống',
    ['STT', 'Mã NV', 'Họ tên', 'Thu nhập chịu thuế', 'Giảm trừ', 'Thuế phải nộp', 'BHXH', 'BHYT', 'BHTN', 'Ghi chú'],
    cols,
    18
  );
  return [
    { name: 'Sheet1', rows: salaryRows, ...getBlankTemplateStyles(cols) },
    { name: 'Thuế-BHXH', rows: taxRows, ...getBlankTemplateStyles(cols) },
  ];
}

function buildDrugInventorySheet(monthLabel: string) {
  const cols = 18;
  const rows = buildBlankTemplateRows(
    `BÁO CÁO XUẤT NHẬP TỒN THUỐC (${monthLabel})`,
    'Biểu mẫu trống',
    ['STT', 'Mã thuốc', 'Tên thuốc', 'ĐVT', 'Tồn đầu', 'Nhập', 'Xuất', 'Tồn cuối', 'Ghi chú'],
    cols,
    22
  );
  return { name: 'Sheet1', rows, ...getBlankTemplateStyles(cols) };
}

function buildMedicalRoomUsageSheet(monthLabel: string) {
  const cols = 18;
  const rows = buildBlankTemplateRows(
    `BC HIỆN TRẠNG SỬ DỤNG PHÒNG Y TẾ (${monthLabel})`,
    'Biểu mẫu trống',
    ['Ngày', 'Tổng lượt', 'Bệnh thông thường', 'Tai nạn', 'Thuốc sử dụng', 'Chi phí', 'Ghi chú'],
    cols,
    18
  );
  return { name: 'Sheet1', rows, ...getBlankTemplateStyles(cols) };
}

function buildArrearsCollectionSheet(monthLabel: string) {
  const cols = 16;
  const rows = buildBlankTemplateRows(
    `BẢNG TRUY THU (${monthLabel})`,
    'Biểu mẫu trống',
    ['STT', 'Mã NV', 'Họ tên', 'Nội dung truy thu', 'Số tiền', 'Kỳ áp dụng', 'Ghi chú'],
    cols,
    16
  );
  return { name: 'Sheet1', rows, ...getBlankTemplateStyles(cols) };
}

const OFFICIAL_HOURLY_RATE = 32000;
const SEASONAL_HOURLY_RATE = 26000;
const OVERTIME_MULTIPLIER = 1.5;

type SheetRowStyle = {
  backgroundColor?: string;
  color?: string;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  borderTop?: string;
  borderRight?: string;
  borderBottom?: string;
  borderLeft?: string;
  verticalAlign?: 'top' | 'middle' | 'bottom';
  whiteSpace?: 'normal' | 'nowrap' | 'pre-wrap';
  fontSize?: string;
  fontFamily?: string;
};

type SheetCellStyle = SheetRowStyle;

type EmployeeLite = {
  employee_code: string;
  name: string;
  department: string;
  employment_type: string;
  date_of_birth?: string;
  created_at?: string;
  updated_at?: string;
};

type TimekeepingLite = {
  id?: number;
  employee_code: string;
  employee_name: string;
  date: string;
  check_in?: string;
  check_out?: string;
  workday?: number;
  total_hours?: number;
  total_all_hours?: number;
  overtime_hours?: number;
  late_minutes?: number;
  early_minutes?: number;
  shift?: string;
  department?: string;
  created_at?: string;
  is_archived?: number;
};

type EmployeeAggregate = {
  employee_code: string;
  name: string;
  department: string;
  employment_type: string;
  date_of_birth: string;
  created_at: string;
  totalWorkday: number;
  totalHours: number;
  overtimeHours: number;
  dayWorkdays: number[];
  dayHours: number[];
  workedDates: Set<string>;
};

type WorkforceGroupKey =
  | '관리(QL)'
  | '제조 기술 (EQM)'
  | '관리(HQ)'
  | '생산(SX)'
  | '품질(QC)'
  | '자재(MM)'
  | '영업(SM)';

const normalizeCode = (code: unknown) => String(code ?? '').trim().toUpperCase();

const looksLikeCode = (val: unknown) => {
  const v = String(val ?? '').trim();
  return !!v && !/\s/.test(v) && /[0-9]/.test(v);
};

const resolveRecordCode = (record: { employee_code?: unknown; employee_name?: unknown }) => {
  const code1 = normalizeCode(record.employee_code);
  const code2 = normalizeCode(record.employee_name);
  if (looksLikeCode(code1)) return code1;
  if (looksLikeCode(code2)) return code2;
  return code1 || code2;
};

const normalizeTextValue = (val: unknown) =>
  String(val ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const normDeptCompact = (dept: unknown) => normalizeTextValue(dept).replace(/\s+/g, '');

const isOfficialEmployee = (employmentType: unknown) => {
  const normalized = normalizeTextValue(employmentType);
  return normalized.includes('chinh thuc') || normalized.includes('정규');
};

const isSeasonalDepartment = (department: unknown) => {
  const normalized = normalizeTextValue(department);
  return (
    normalized.includes('thoi vu') ||
    normalized.includes('thoivu') ||
    normalized.includes('seasonal') ||
    normalized.includes('temp')
  );
};

const isSeasonalEmployee = (employmentType: unknown) => {
  const normalized = normalizeTextValue(employmentType);
  return (
    normalized.includes('thoi vu') ||
    normalized.includes('seasonal') ||
    normalized.includes('temp') ||
    normalized.includes('계약') ||
    normalized.includes('비정규')
  );
};

const resolveEmploymentCategory = (employmentType: unknown, department?: unknown) => {
  if (isSeasonalEmployee(employmentType) || isSeasonalDepartment(department)) return 'Thời vụ';
  if (isOfficialEmployee(employmentType)) return 'Chính thức';
  return String(employmentType ?? '').trim();
};

const toLocalYmd = (dt: Date) => {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseYmdLocal = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map((part) => parseInt(part, 10));
  return new Date(y, (m || 1) - 1, d || 1);
};

const clampYmd = (ymd: string) => (/^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : '');

async function resolveReportRange(start_date: string, end_date: string) {
  let start = clampYmd(String(start_date || '').trim());
  let end = clampYmd(String(end_date || '').trim());

  if (!start || !end) {
    const latest = await queryOne<{ date: string }>(
      'SELECT TOP 1 date FROM timekeeping_records WHERE is_archived = 0 ORDER BY date DESC',
      {}
    );
    const refDate = latest?.date ? parseYmdLocal(String(latest.date).slice(0, 10)) : new Date();
    start = toLocalYmd(new Date(refDate.getFullYear(), refDate.getMonth(), 1));
    end = toLocalYmd(new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0));
  }

  if (start > end) {
    [start, end] = [end, start];
  }

  const startDt = parseYmdLocal(start);
  const endDt = parseYmdLocal(end);
  const dates: string[] = [];
  for (let dt = new Date(startDt); dt <= endDt; dt.setDate(dt.getDate() + 1)) {
    dates.push(toLocalYmd(dt));
  }

  /** Ngày chốt báo cáo SX: không vượt quá hôm nay (server local) — tránh chốt 31/3 khi mới 30/3 → đi làm = 0. */
  const todayYmd = toLocalYmd(new Date());
  let snapshotDate = end > todayYmd ? todayYmd : end;
  if (snapshotDate < start) snapshotDate = start;

  return {
    start,
    end,
    dates,
    monthLabel: `${start.slice(5, 7)}/${start.slice(0, 4)}`,
    snapshotDate,
  };
}

async function loadEmployeesLite(): Promise<EmployeeLite[]> {
  const [employees, typeOverrides] = await Promise.all([
    query<EmployeeLite>(
      `SELECT employee_code, name, department, employment_type, date_of_birth, created_at, updated_at
       FROM employees
       ORDER BY department, employee_code`,
      {}
    ),
    loadEmploymentTypeOverrides(),
  ]);

  return employees.map((emp) => {
    const code = normalizeCode(emp.employee_code);
    return {
      ...emp,
      employment_type: resolveEmploymentCategory(typeOverrides.get(code) || emp.employment_type, emp.department),
    };
  });
}

async function loadTimekeepingLite(start: string, end: string): Promise<TimekeepingLite[]> {
  const rows = await query<TimekeepingLite>(
    `SELECT id, employee_code, employee_name, date, check_in, check_out, workday, total_hours, total_all_hours,
            overtime_hours, late_minutes, early_minutes, shift, department, created_at, is_archived
     FROM timekeeping_records
     WHERE date >= @sd AND date <= @ed
     ORDER BY date, employee_code, created_at DESC`,
    { sd: start, ed: end }
  );
  return dedupeLatestTimekeepingRecords(rows).filter(hasAttendanceSignal);
}

async function loadEmployeeStoreRows(type: 'official' | 'seasonal'): Promise<Record<string, unknown>[]> {
  const store = await queryOne<{ rows: string }>(
    'SELECT rows FROM employee_excel_store WHERE type = @typ',
    { typ: type }
  );
  if (!store?.rows) return [];
  try {
    const parsed = JSON.parse(store.rows);
    return Array.isArray(parsed)
      ? parsed.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row))
      : [];
  } catch {
    return [];
  }
}

function parseLooseDate(value: unknown): string {
  if (value == null || value === '') return '';

  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const epoch = new Date(1899, 11, 30);
    const dt = new Date(epoch.getTime() + value * 24 * 60 * 60 * 1000);
    return toLocalYmd(dt);
  }

  if (value instanceof Date && !isNaN(value.getTime())) {
    return toLocalYmd(value);
  }

  const raw = String(value).trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parts = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (parts) {
    const a = parseInt(parts[1], 10);
    const b = parseInt(parts[2], 10);
    let year = parseInt(parts[3], 10);
    if (year < 100) year += 2000;
    const dayFirst = a > 12;
    const month = dayFirst ? b : a;
    const day = dayFirst ? a : b;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? raw : toLocalYmd(parsed);
}

function getRowValueByHeader(
  row: Record<string, unknown> | undefined,
  needleGroups: string[][]
): string {
  if (!row) return '';
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeTextValue(key);
    if (needleGroups.some((group) => group.every((needle) => normalizedKey.includes(needle)))) {
      return String(value ?? '').trim();
    }
  }
  return '';
}

function isLikelyEmployeeCodeToken(value: unknown): boolean {
  const raw = String(value ?? '').trim();
  const token = normalizeCode(raw);
  if (!token || /\s/.test(token)) return false;
  if (token.length < 4 || token.length > 20) return false;
  if (!/[0-9]/.test(token)) return false;
  if (/^\d{1,3}$/.test(token)) return false;
  if (/^\d{9,}$/.test(token)) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(token)) return false;
  if (/GMT|:\d{2}|T\d{2}/i.test(raw)) return false;
  return true;
}

function scoreEmployeeCodeToken(value: unknown): number {
  const token = normalizeCode(value);
  let score = 0;
  if (/[A-Z]/.test(token) && /[0-9]/.test(token)) score += 6;
  if (/^[A-Z]{0,4}\d{4,}[A-Z]{0,4}$/.test(token)) score += 5;
  if (/\d{6,}/.test(token)) score += 2;
  if (token.length >= 6 && token.length <= 14) score += 2;
  if (/^\d+$/.test(token)) score -= 2;
  return score;
}

function extractEmployeeCodeFromStoreRow(row: Record<string, unknown>): string {
  const byHeader = normalizeCode(
    getRowValueByHeader(row, [
      ['ma nv'],
      ['mã nv'],
      ['ma nhan vien'],
      ['mã nhân viên'],
      ['employee', 'code'],
    ])
  );
  if (byHeader) return byHeader;

  const valueCandidates: string[] = [];
  for (const value of Object.values(row)) {
    if (isLikelyEmployeeCodeToken(value)) valueCandidates.push(normalizeCode(value));
  }
  if (valueCandidates.length > 0) {
    valueCandidates.sort((a, b) => scoreEmployeeCodeToken(b) - scoreEmployeeCodeToken(a) || a.localeCompare(b, 'vi'));
    return valueCandidates[0] || '';
  }

  const keyCandidates: string[] = [];
  for (const key of Object.keys(row)) {
    if (isLikelyEmployeeCodeToken(key)) keyCandidates.push(normalizeCode(key));
  }
  if (!keyCandidates.length) return '';
  keyCandidates.sort((a, b) => scoreEmployeeCodeToken(b) - scoreEmployeeCodeToken(a) || a.localeCompare(b, 'vi'));
  return keyCandidates[0] || '';
}

function buildStoreRowMap(rows: Record<string, unknown>[]): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const code = extractEmployeeCodeFromStoreRow(row);
    if (code) map.set(code, row);
  }
  return map;
}

async function loadEmploymentTypeOverrides(): Promise<Map<string, string>> {
  const [officialRows, seasonalRows] = await Promise.all([
    loadEmployeeStoreRows('official'),
    loadEmployeeStoreRows('seasonal'),
  ]);

  const typeMap = new Map<string, string>();
  for (const code of buildStoreRowMap(officialRows).keys()) {
    typeMap.set(code, 'Chính thức');
  }
  for (const code of buildStoreRowMap(seasonalRows).keys()) {
    typeMap.set(code, 'Thời vụ');
  }
  return typeMap;
}

function buildEmployeeAggregates(
  employees: EmployeeLite[],
  records: TimekeepingLite[]
): Map<string, EmployeeAggregate> {
  const aggregates = new Map<string, EmployeeAggregate>();

  for (const emp of employees) {
    const code = normalizeCode(emp.employee_code);
    if (!code) continue;
    aggregates.set(code, {
      employee_code: code,
      name: String(emp.name ?? '').trim(),
      department: String(emp.department ?? '').trim(),
      employment_type: String(emp.employment_type ?? '').trim(),
      date_of_birth: String(emp.date_of_birth ?? '').trim(),
      created_at: String(emp.created_at ?? '').trim(),
      totalWorkday: 0,
      totalHours: 0,
      overtimeHours: 0,
      dayWorkdays: Array(DAY_COLS).fill(0),
      dayHours: Array(DAY_COLS).fill(0),
      workedDates: new Set<string>(),
    });
  }

  for (const record of records) {
    const code = resolveRecordCode(record);
    if (!code) continue;

    let agg = aggregates.get(code);
    if (!agg) {
      agg = {
        employee_code: code,
        name: String(record.employee_name ?? '').trim(),
        department: String(record.department ?? '').trim(),
        employment_type: resolveEmploymentCategory('', record.department),
        date_of_birth: '',
        created_at: '',
        totalWorkday: 0,
        totalHours: 0,
        overtimeHours: 0,
        dayWorkdays: Array(DAY_COLS).fill(0),
        dayHours: Array(DAY_COLS).fill(0),
        workedDates: new Set<string>(),
      };
      aggregates.set(code, agg);
    }

    const dateStr = String(record.date ?? '').slice(0, 10);
    const day = parseInt(dateStr.slice(8, 10), 10);
    const workday = Number(record.workday) || 0;
    const hours = getHours(record);
    const overtime = Number(record.overtime_hours) || 0;

    agg.totalWorkday += workday;
    agg.totalHours += hours;
    agg.overtimeHours += overtime;

    if (day >= 1 && day <= DAY_COLS) {
      agg.dayWorkdays[day - 1] += workday;
      agg.dayHours[day - 1] += hours;
    }

    if (dateStr) agg.workedDates.add(dateStr);
    if (!agg.name) agg.name = String(record.employee_name ?? '').trim();
    if (!agg.department) agg.department = String(record.department ?? '').trim();
  }

  return aggregates;
}

function sortAggregates(a: EmployeeAggregate, b: EmployeeAggregate) {
  return (
    String(a.department || '').localeCompare(String(b.department || ''), 'vi') ||
    String(a.employee_code || '').localeCompare(String(b.employee_code || ''), 'vi')
  );
}

function buildSimpleTableSheet(args: {
  name: string;
  title: string;
  subtitle: string;
  headers: (string | number)[];
  dataRows: (string | number)[][];
  dayStartCol?: number;
}): TemplateSheetGrid {
  const cols = Math.max(args.headers.length, 1, ...args.dataRows.map((row) => row.length));
  const rows: (string | number)[][] = [
    padRow([args.title], cols),
    padRow([args.subtitle], cols),
    padRow(args.headers, cols),
    ...args.dataRows.map((row) => padRow(row, cols)),
  ];

  const rowStyles: Record<number, SheetRowStyle> = {
    0: { backgroundColor: '#1e3a5f', color: '#fff', fontWeight: 'bold', textAlign: 'center' },
    1: { backgroundColor: '#f8fafc', color: '#334155', fontWeight: 'normal', textAlign: 'center' },
    2: { backgroundColor: '#e5e7eb', color: '#111827', fontWeight: 'bold', textAlign: 'center' },
  };
  const cellStyles: Record<string, SheetCellStyle> = {};

  if (args.dayStartCol !== undefined) {
    for (const day of [7, 14, 21, 28]) {
      const col = args.dayStartCol + day - 1;
      if (col >= cols) continue;
      for (let r = 2; r < rows.length; r++) {
        cellStyles[`${r},${col}`] = { backgroundColor: '#fdba74' };
      }
    }
  }

  const colWidths: Record<number, number> = {};
  for (let c = 0; c < cols; c++) {
    const header = String(args.headers[c] ?? '').trim().toLowerCase();
    if (c === 0 || header === 'stt' || header === 'no') {
      colWidths[c] = 52;
    } else if (args.dayStartCol !== undefined && c >= args.dayStartCol && c < args.dayStartCol + DAY_COLS) {
      colWidths[c] = 48;
    } else if (/mã|ma nv|no cc|id mới|id moi|code/.test(header)) {
      colWidths[c] = 92;
    } else if (/họ tên|ho ten|name/.test(header)) {
      colWidths[c] = 180;
    } else if (/bp|bộ phận|bo phan|dept/.test(header)) {
      colWidths[c] = 120;
    } else if (/ngày|ngay|date/.test(header)) {
      colWidths[c] = 96;
    } else if (/ghi chú|ghi chu|note/.test(header)) {
      colWidths[c] = 140;
    } else {
      colWidths[c] = 84;
    }
  }

  return {
    name: args.name,
    rows,
    merges: [
      { s: { r: 0, c: 0 }, e: { r: 0, c: cols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: cols - 1 } },
    ],
    rowStyles,
    cellStyles,
    colWidths,
  };
}

function mapWorkforceGroup(dept: unknown): WorkforceGroupKey {
  const compact = normDeptCompact(dept);
  if (['vpql'].includes(compact)) return '관리(QL)';
  if (['eqm', 'phongeqm', 'e'].includes(compact)) return '제조 기술 (EQM)';
  if (['qc', 'phongqc', 'q'].includes(compact)) return '품질(QC)';
  if (['mm', 'phongmm', 'm'].includes(compact)) return '자재(MM)';
  if (['sm', 'phongsm', 's'].includes(compact)) return '영업(SM)';
  if (['sx', 'sanxuat', 'sanxuất', 'prod', 'production', 'p', 'p2'].includes(compact)) return '생산(SX)';
  return '관리(HQ)';
}

function toFixed1(n: number): number {
  return Math.round((n || 0) * 10) / 10;
}

function toFixed0(n: number): number {
  return Math.round(n || 0);
}

/** Row từ DB — total_hours có thể null/Decimal */
function getHours(record: { total_all_hours?: unknown; total_hours?: unknown }): number {
  const t1 = Number(record.total_all_hours);
  const t2 = Number(record.total_hours);
  if (Number.isFinite(t1) && t1 > 0) return t1;
  if (Number.isFinite(t2) && t2 > 0) return t2;
  return 0;
}

function hasAttendanceSignal(record: {
  check_in?: unknown;
  check_out?: unknown;
  workday?: unknown;
  total_hours?: unknown;
  total_all_hours?: unknown;
  overtime_hours?: unknown;
  late_minutes?: unknown;
  early_minutes?: unknown;
}) {
  const hasText = (value: unknown) => String(value ?? '').trim() !== '';
  return (
    hasText(record.check_in) ||
    hasText(record.check_out) ||
    Number(record.workday) > 0 ||
    Number(record.total_hours) > 0 ||
    Number(record.total_all_hours) > 0 ||
    Number(record.overtime_hours) > 0 ||
    Number(record.late_minutes) > 0 ||
    Number(record.early_minutes) > 0
  );
}

function compareTimekeepingVersion(a: TimekeepingLite, b: TimekeepingLite) {
  const activeA = Number(a.is_archived || 0) === 0 ? 1 : 0;
  const activeB = Number(b.is_archived || 0) === 0 ? 1 : 0;
  if (activeA !== activeB) return activeA - activeB;
  const createdA = String(a.created_at || '');
  const createdB = String(b.created_at || '');
  if (createdA !== createdB) return createdA.localeCompare(createdB, 'vi');
  return Number(a.id || 0) - Number(b.id || 0);
}

function dedupeLatestTimekeepingRecords(records: TimekeepingLite[]) {
  const latest = new Map<string, TimekeepingLite>();
  for (const record of records) {
    const code = resolveRecordCode(record);
    const date = String(record.date || '').slice(0, 10);
    if (!code || !date) continue;
    const key = `${code}\t${date}`;
    const prev = latest.get(key);
    if (!prev || compareTimekeepingVersion(record, prev) > 0) {
      latest.set(key, record);
    }
  }
  return [...latest.values()].sort(
    (a, b) =>
      String(a.date || '').localeCompare(String(b.date || ''), 'vi') ||
      resolveRecordCode(a).localeCompare(resolveRecordCode(b), 'vi')
  );
}

function getHourlyRate(employmentType: string): number {
  return employmentType === 'Chính thức' ? OFFICIAL_HOURLY_RATE : SEASONAL_HOURLY_RATE;
}

function buildMonthOverviewSheet(
  title: string,
  subtitle: string,
  rowDefs: Array<{ group: string; metric: string; values: number[]; summary?: number | string; note?: string }>
) {
  const cols = 35;
  const headers = ['Nhóm', 'Chỉ số', ...Array.from({ length: DAY_COLS }, (_, i) => i + 1), 'Tổng/TB', 'Ghi chú'];
  const rows: (string | number)[][] = [padRow([title], cols), padRow([subtitle], cols), padRow(headers, cols)];
  for (const r of rowDefs) {
    const values = Array.from({ length: DAY_COLS }, (_, i) => toFixed1(r.values[i] || 0));
    rows.push(padRow([r.group, r.metric, ...values, r.summary ?? '', r.note ?? ''], cols));
  }
  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: cols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: cols - 1 } },
  ];
  const rowStyles: Record<number, { backgroundColor: string; color: string; fontWeight: string; textAlign: 'center' }> = {
    0: { backgroundColor: '#1e3a5f', color: '#fff', fontWeight: 'bold', textAlign: 'center' },
    1: { backgroundColor: '#f1f5f9', color: '#334155', fontWeight: 'normal', textAlign: 'center' },
    2: { backgroundColor: '#e5e7eb', color: '#111827', fontWeight: 'bold', textAlign: 'center' },
  };
  const cellStyles: Record<string, { backgroundColor?: string }> = {};
  const weekendCols = [8, 15, 22, 29]; // columns in day block (1-based day 7/14/21/28 shifted by 2)
  for (const c of weekendCols) {
    if (c < cols) {
      for (let r = 2; r < rows.length; r++) {
        cellStyles[`${r},${c}`] = { backgroundColor: '#fdba74' };
      }
    }
  }
  const colWidths: Record<number, number> = {
    0: 110,
    1: 180,
    33: 96,
    34: 120,
  };
  for (let c = 2; c < 33; c++) colWidths[c] = 48;
  return { rows, merges, rowStyles, cellStyles, colWidths };
}

const COLS_KPI = 45;

/** N/A symbol giống Excel */
const NA_CELL = '✕';

/**
 * Sheet 1: 인건비 현황 - giống 100% Excel: 2 dòng title merge, header 2 dòng, 10 dòng KPI, màu nền, chữ đỏ, ô ✕
 */
function buildSheet1Ingunbi(monthLabel: string, byDay: Map<number, { count: number; totalHours: number; overtimeHours: number; codes: Set<string> }>): (string | number)[][] {
  const dayHeaders = Array.from({ length: DAY_COLS }, (_, i) => i + 1);
  const pad = (arr: (string | number)[], len: number) => {
    const out = [...arr];
    while (out.length < len) out.push('');
    return out.slice(0, len);
  };
  const dayV = (get: (d: number) => string | number) =>
    Array.from({ length: DAY_COLS }, (_, i) => {
      const v = get(i + 1);
      return (typeof v === 'number' && v === 0) ? ' - ' : v;
    });
  const emptyCols = () => Array(6).fill(' - ') as string[];
  const naAtJanEnd = () => [' - ', ' - ', ' - ', NA_CELL, ' - ', ' - '] as (string | number)[];
  const ml = monthLabel.replace(/\//g, '.');
  const headerRows: (string | number)[][] = [
    ['◆일자별 인사팀 KPI 분석 현황 (' + ml + ')', ...Array(COLS_KPI - 1).fill('')],
    ['Hiện trạng phân tích KPI phòng nhân sự theo ngày', ...Array(COLS_KPI - 1).fill('')],
    ['', '', '', '', '', '', '0.1239', '1', '', ...Array(COLS_KPI - 9).fill('')],
    ['Date', '기준\r\nTiêu chuẩn', '목표\r\nTarget', '11월 실적\r\nThực tích tháng 11', '12월 실적\r\nThực tích tháng 12', '1월 실적\r\nThực tích tháng 1', '1월말 예상\r\nDự tính cuối tháng 1', ...dayHeaders, '', ''],
  ];
  const row5 = pad(['당일 급여\r\n(개인 지급계)\r\nLương theo ngày\r\n(Tổng chi cá nhân)', '①+②\r\n(기본급+수당+개인보험+잔업)\r\n(LCB + PC + BHXH + OT)', '', ...emptyCols(), '', ...dayV(d => { const a = byDay.get(d)!; return a.totalHours > 0 ? Math.round(a.totalHours * 10) / 10 : ' - '; }), '', ''], COLS_KPI);
  const row6 = pad(['당일 잔업\r\nOT theo ngày', '②', '', ...emptyCols(), '', ...dayV(d => { const a = byDay.get(d)!; return a.overtimeHours > 0 ? Math.round(a.overtimeHours * 10) / 10 : ' - '; }), '', ''], COLS_KPI);
  const row7 = pad(['당일 출근 인원수\r\nSố nhân viên đi làm theo ngày', '특근일제외\r\nNgoại trừ đi làm ngày lễ', '', ...naAtJanEnd(), '', ...dayV(d => byDay.get(d)!.count), '', ''], COLS_KPI);
  const row8 = pad(['잔업비 비율(%)\r\nTỷ lệ tiền OT(%)', '②/(①+②)', '10%↓', ' - ', ' - ', ' - ', NA_CELL, ...dayV(d => { const a = byDay.get(d)!; const pct = a.totalHours > 0 ? (a.overtimeHours / a.totalHours) * 100 : 0; return pct.toFixed(1) + '%'; }), '', ''], COLS_KPI);
  const row9 = pad(['인당 평균 임금\r\nLương bình quân đầu người', 'K VND', '', ...emptyCols(), '', ...dayV(d => { const a = byDay.get(d)!; return a.count === 0 ? ' - ' : (a.totalHours / a.count).toFixed(1); }), '', ''], COLS_KPI);
  const row10 = pad(['매출 ST\r\nDoanh thu ST', '', '', ...emptyCols(), '', ...Array(DAY_COLS).fill(' - '), '', ''], COLS_KPI);
  const row11 = pad(['총 매출 (VND)\r\nTổng doanh thu', 'M VND', '', ...emptyCols(), '', ...Array(DAY_COLS).fill(' - '), '', ''], COLS_KPI);
  const row12 = pad(['총 인건비/매출\r\nTổng Lương/Doanh thu', '', '65%↓', ' - ', ' - ', ' - ', NA_CELL, ...Array(DAY_COLS).fill('100.0%'), '', ''], COLS_KPI);
  const row13 = pad(['분당 인건비\r\nLương phút', '①/매출ST\r\n/ Doanh thu ST', '', ...naAtJanEnd(), '', ...Array(DAY_COLS).fill(' - '), '', ''], COLS_KPI);
  const row14 = pad(['달라 환율\r\nTỷ giá USD', '$ → VND', '', '', '', ' - ', NA_CELL, ...Array(DAY_COLS).fill(''), '', ''], COLS_KPI);
  return [...headerRows, row5, row6, row7, row8, row9, row10, row11, row12, row13, row14];
}

/** Merges + rowStyles + cellStyles cho sheet 1 KPI giống Excel */
function getSheet1KpiStyles(cols: number) {
  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: cols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: cols - 1 } },
  ];
  const rowStyles: Record<number, { backgroundColor: string; color: string; fontWeight: string; textAlign: 'center' }> = {
    0: { backgroundColor: '#1e3a5f', color: '#fff', fontWeight: 'bold', textAlign: 'center' },
    1: { backgroundColor: '#1e3a5f', color: '#fff', fontWeight: 'bold', textAlign: 'center' },
    2: { backgroundColor: '#fff', color: '#000', fontWeight: 'bold', textAlign: 'center' },
    3: { backgroundColor: '#fff', color: '#000', fontWeight: 'bold', textAlign: 'center' },
    6: { backgroundColor: '#fef9c3', color: '#000', fontWeight: 'normal', textAlign: 'center' },
    7: { backgroundColor: '#fef9c3', color: '#000', fontWeight: 'normal', textAlign: 'center' },
    9: { backgroundColor: '#dbeafe', color: '#000', fontWeight: 'normal', textAlign: 'center' },
    10: { backgroundColor: '#dbeafe', color: '#000', fontWeight: 'normal', textAlign: 'center' },
    11: { backgroundColor: '#dbeafe', color: '#000', fontWeight: 'normal', textAlign: 'center' },
  };
  const cellStyles: Record<string, { color: string }> = {
    '7,2': { color: '#dc2626' },
    '10,1': { color: '#dc2626' },
    '11,2': { color: '#dc2626' },
  };
  return { merges, rowStyles, cellStyles };
}

/** Sheet 2: 종합 급여 현황 - giống 100% Excel: title xanh đậm, header 2 dòng, dòng Total vàng, viền đỏ, chữ đỏ ô cuối */
const COLS_SHEET2 = 17;

function buildSheet2Jonghab(monthLabel: string, employeesByDept: { stt: string; name: string; dept: string }[]): (string | number)[][] {
  const pad2 = (arr: (string | number)[], len: number) => {
    const out = [...arr];
    while (out.length < len) out.push('');
    return out.slice(0, len);
  };
  const ml = monthLabel.replace(/\//g, '.');
  const titleRow = ['◆ 급여 지출 총액 현황 (' + ml + ')', ...Array(COLS_SHEET2 - 1).fill('')];
  const header1: (string | number)[] = [
    'STT', '구분 (Phan loai)', 'Bộ phận',
    '전월 급여 총액 T11', '11월 매출대비', '전월 급여 총액 T12', '12월 매출대비',
    '당월 지급 기본급 (Luong co ban)', '수당소계 (Tong phu cap)', '잔업 금액 소계 (Tong tang ca)',
    '본인 부담 보험 BHXH (10.5%) + ĐP (0.5%)', '개인 별 지급액 Tổng Lương Thực Tế', '회사 부담 보험+ 소득세 Thuế TNCN HQ BHXH (21%) + KPCD (2%)',
    '당월 급여 총액 Tổng chi trả', '1월말예상', '전월 대비', '매출대비',
  ];
  const header2: (string | number)[] = [
    '', '', '',
    '', '', '', '',
    '①', '②', '②', '③', '④ = ① + ② - ③', '⑤', '⑥ = ① + ② + ⑤',
    '1', '', '%',
  ];
  const totalRow: (string | number)[] = ['A', '1월 Total', '-', '-', '0.0%', '-', '0.0%', '-', '-', '-', '-', '-', '-', '-', '1', '0.0%', '%'];
  const deptRows = employeesByDept.map((e, i) => {
    const lastCol = i === employeesByDept.length - 1 ? '%' : '0.0%';
    return pad2([e.stt, e.name, e.dept, '-', '0.0%', '-', '0.0%', '-', '0', '-', '-', '-', '-', '-', '-', '0.0%', lastCol], COLS_SHEET2);
  });
  return [
    pad2(titleRow, COLS_SHEET2),
    pad2(header1, COLS_SHEET2),
    pad2(header2, COLS_SHEET2),
    pad2(totalRow, COLS_SHEET2),
    ...deptRows,
  ];
}

/** Merges + rowStyles + cellStyles + borders cho sheet 2 giống Excel */
function getSheet2JonghabStyles() {
  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: COLS_SHEET2 - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
    { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },
    { s: { r: 1, c: 2 }, e: { r: 2, c: 2 } },
  ];
  const rowStyles: Record<number, { backgroundColor: string; color: string; fontWeight: string; textAlign: 'center' }> = {
    0: { backgroundColor: '#1e3a5f', color: '#fff', fontWeight: 'bold', textAlign: 'center' },
    1: { backgroundColor: '#fff', color: '#000', fontWeight: 'bold', textAlign: 'center' },
    2: { backgroundColor: '#fff', color: '#000', fontWeight: 'bold', textAlign: 'center' },
    3: { backgroundColor: '#fef08a', color: '#000', fontWeight: 'normal', textAlign: 'center' },
  };
  const lastDataRow = 3 + 8;
  const cellStyles: Record<string, { color?: string; borderRight?: string; borderBottom?: string; borderTop?: string; textAlign?: 'left' | 'center' | 'right' }> = {
    '1,2': { borderRight: '2px solid #dc2626', textAlign: 'left' },
    '2,2': { borderRight: '2px solid #dc2626', textAlign: 'left' },
    '1,13': { borderRight: '2px solid #dc2626' },
    '2,13': { borderRight: '2px solid #dc2626' },
    [lastDataRow + ',16']: { color: '#dc2626', borderBottom: '2px solid #dc2626' },
  };
  ['1,0', '1,1', '2,0', '2,1'].forEach((k) => { cellStyles[k] = { ...cellStyles[k], textAlign: 'left' }; });
  for (let c = 0; c < COLS_SHEET2; c++) {
    cellStyles['3,' + c] = { ...cellStyles['3,' + c], borderTop: '1px dashed #94a3b8', textAlign: c < 3 ? 'left' : 'center' };
    if (c !== 16) cellStyles[lastDataRow + ',' + c] = { borderBottom: '2px solid #dc2626', textAlign: c < 3 ? 'left' : undefined };
    else cellStyles[lastDataRow + ',16'].textAlign = 'center';
  }
  for (let r = 4; r <= lastDataRow; r++) {
    cellStyles[r + ',0'] = { ...cellStyles[r + ',0'], textAlign: 'left' };
    cellStyles[r + ',1'] = { ...cellStyles[r + ',1'], textAlign: 'left' };
    cellStyles[r + ',2'] = { ...cellStyles[r + ',2'], textAlign: 'left' };
  }
  return { merges, rowStyles, cellStyles };
}

/** Sheet 1 – 근태 종합 보고 (근태종합): biểu mẫu trống 100% giống Excel, đúng tên, không dữ liệu */
const COLS_GEUNTAE_JONGHAB = 38;
const EMPTY_DATA = Array(COLS_GEUNTAE_JONGHAB - 2).fill('') as string[];

function buildSheet1GeuntaeJonghab(monthLabel: string, dateStr: string, _stats: { total: number; attended: number; byDept: Record<string, { total: number; attended: number }> }): (string | number)[][] {
  const pad = (arr: (string | number)[], len: number) => [...arr, ...Array(len).fill('')].slice(0, len);
  const ml = monthLabel.replace(/\//g, '.');
  const dayHeaders = Array.from({ length: 31 }, (_, i) => i + 1);
  const reportDate = dateStr || new Date().toISOString().slice(0, 10);
  const [y, m, d] = reportDate.split('-');
  const dateDisplay = `${y} 년 ${m}월 ${d}`;
  const row = (a: (string | number)[], b: (string | number)[]) => pad([...a, ...b, ...EMPTY_DATA.slice(a.length + b.length)], COLS_GEUNTAE_JONGHAB);
  const dataRow = (col0: string, col1: string) => row([col0, col1], []);
  const rows: (string | number)[][] = [
    pad(['근태 종합 보고 (' + ml + ')', ...Array(COLS_GEUNTAE_JONGHAB - 1).fill('')], COLS_GEUNTAE_JONGHAB),
    pad(['', '보고 부서', '', '비고', '', '간접1 (G.T)', '', '직접 1 (T.T)', '', ...Array(COLS_GEUNTAE_JONGHAB - 9).fill('')], COLS_GEUNTAE_JONGHAB),
    pad(['', '작성자', '', '', '', '간접 2 (G.T)', '', '직접 2 (T.T)', '', ...Array(COLS_GEUNTAE_JONGHAB - 9).fill('')], COLS_GEUNTAE_JONGHAB),
    pad(['', '페이지 번호', '', '', '', '', '', '', '', ...Array(COLS_GEUNTAE_JONGHAB - 9).fill('')], COLS_GEUNTAE_JONGHAB),
    pad(['', '작성일자', '', '', '', '', '', '', '', ...Array(COLS_GEUNTAE_JONGHAB - 9).fill('')], COLS_GEUNTAE_JONGHAB),
    pad(['근태 일자 : ' + dateDisplay, ...Array(COLS_GEUNTAE_JONGHAB - 1).fill('')], COLS_GEUNTAE_JONGHAB),
    pad(['구분', '', '2026', '1계', '2계', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', ...dayHeaders.slice(17, 31), '', ''], COLS_GEUNTAE_JONGHAB),
  ];
  const SECT = {
    tong: '전체 (Tổng)',
    tyLeTong: 'Tỷ lệ tổng',
    diLam: '출근인원 (Đi làm)',
    tyLeDiLam: '출근율 (Tỷ lệ đi làm)',
    nghiViec: '퇴사인원 (Nghỉ việc)',
    tyLeNghiViec: '퇴사율 (Tỷ lệ nghỉ việc)',
    boPhan: '부서별 출근 현황',
  };
  rows.push(dataRow(SECT.tong, 'Total'));
  rows.push(dataRow(SECT.tong, '정규 (CT)'));
  rows.push(dataRow(SECT.tong, '간접 1 (G.T)'));
  rows.push(dataRow(SECT.tong, '직접 1 (T.T)'));
  rows.push(dataRow(SECT.tong, '용역 (TV)'));
  rows.push(dataRow(SECT.tong, '간접 2 (G.T)'));
  rows.push(dataRow(SECT.tong, '직접 2 (T.T)'));
  rows.push(dataRow(SECT.tyLeTong, 'Total'));
  rows.push(dataRow(SECT.tyLeTong, '정규 (CT)'));
  rows.push(dataRow(SECT.tyLeTong, '간접 1 (G.T)'));
  rows.push(dataRow(SECT.tyLeTong, '직접 1 (T.T)'));
  rows.push(dataRow(SECT.tyLeTong, '용역 (TV)'));
  rows.push(dataRow(SECT.tyLeTong, '간접 2 (G.T)'));
  rows.push(dataRow(SECT.tyLeTong, '직접 2 (T.T)'));
  rows.push(dataRow('', 'Total'));
  rows.push(dataRow('+/-', ''));
  rows.push(dataRow(SECT.diLam, 'Total'));
  rows.push(dataRow(SECT.diLam, '정규 (CT)'));
  rows.push(dataRow(SECT.diLam, '간접 1 (G.T)'));
  rows.push(dataRow(SECT.diLam, '직접 1 (T.T)'));
  rows.push(dataRow(SECT.diLam, '용역 (TV)'));
  rows.push(dataRow(SECT.diLam, '간접 2 (G.T)'));
  rows.push(dataRow(SECT.diLam, '직접 2 (T.T)'));
  rows.push(dataRow(SECT.tyLeDiLam, 'Total'));
  rows.push(dataRow(SECT.tyLeDiLam, '정규 (CT)'));
  rows.push(dataRow(SECT.tyLeDiLam, '간접 1 (G.T)'));
  rows.push(dataRow(SECT.tyLeDiLam, '직접 1 (T.T)'));
  rows.push(dataRow(SECT.tyLeDiLam, '용역 (TV)'));
  rows.push(dataRow(SECT.tyLeDiLam, '간접 2 (G.T)'));
  rows.push(dataRow(SECT.tyLeDiLam, '직접 2 (T.T)'));
  rows.push(dataRow('', 'Total'));
  rows.push(dataRow(SECT.nghiViec, 'Total'));
  rows.push(dataRow(SECT.nghiViec, '정규 (CT)'));
  rows.push(dataRow(SECT.nghiViec, '간접 1 (G.T)'));
  rows.push(dataRow(SECT.nghiViec, '직접 1 (T.T)'));
  rows.push(dataRow(SECT.nghiViec, '용역 (TV)'));
  rows.push(dataRow(SECT.nghiViec, '간접 2 (G.T)'));
  rows.push(dataRow(SECT.nghiViec, '직접 2 (T.T)'));
  rows.push(dataRow('', 'Total %'));
  rows.push(dataRow(SECT.tyLeNghiViec, 'Total'));
  rows.push(dataRow(SECT.tyLeNghiViec, '정규 (CT)'));
  rows.push(dataRow(SECT.tyLeNghiViec, '간접 1 (G.T)'));
  rows.push(dataRow(SECT.tyLeNghiViec, '직접 1 (T.T)'));
  rows.push(dataRow(SECT.tyLeNghiViec, '용역 (TV)'));
  rows.push(dataRow(SECT.tyLeNghiViec, '간접 2 (G.T)'));
  rows.push(dataRow(SECT.tyLeNghiViec, '직접 2 (T.T)'));
  rows.push(dataRow(SECT.boPhan, '관리(QL)%'));
  rows.push(dataRow(SECT.boPhan, '제조 기술 (EQM)%'));
  rows.push(dataRow(SECT.boPhan, '제조(SX)%'));
  rows.push(dataRow(SECT.boPhan, '품질(QC)%'));
  rows.push(dataRow(SECT.boPhan, '자재(MM)%'));
  rows.push(dataRow(SECT.boPhan, '영업(SM)%'));
  return rows;
}

function getSheet1GeuntaeStyles(cols: number) {
  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: cols - 1 } },
    { s: { r: 5, c: 0 }, e: { r: 5, c: cols - 1 } },
  ];
  const rowStyles: Record<number, { backgroundColor: string; color: string; fontWeight: string; textAlign: 'center' }> = {
    0: { backgroundColor: '#1e3a5f', color: '#fff', fontWeight: 'bold', textAlign: 'center' },
    6: { backgroundColor: '#e5e7eb', color: '#000', fontWeight: 'bold', textAlign: 'center' },
    22: { backgroundColor: '#fef08a', color: '#000', fontWeight: 'normal', textAlign: 'center' },
  };
  const cellStyles: Record<string, { backgroundColor?: string; color?: string }> = {};
  const dataEndRow = 6 + 7 + 7 + 1 + 1 + 7 + 1 + 7 + 1 + 7 + 1 + 7 + 6;
  const weekendDayCols = [11, 18, 25, 32];
  weekendDayCols.forEach((c) => {
    if (c < cols) cellStyles['6,' + c] = { backgroundColor: '#fdba74' };
    for (let r = 7; r <= dataEndRow; r++) {
      if (c < cols) cellStyles[r + ',' + c] = { backgroundColor: '#fdba74' };
    }
  });
  for (let c = 1; c <= 10; c++) cellStyles['22,' + c] = { backgroundColor: '#fef08a' };
  return { merges, rowStyles, cellStyles };
}

/** Sheet 2 – 근태 상황 보고서: biểu mẫu trống 100%, đúng tên, không dữ liệu */
const COLS_GEUNTAE_SITUATION = 28;
const DEPT_COLS = ['관리(QL)', '제조 기술 (EQM)', '관리(HQ)', '생산(SX)', '품질(QC)', '자재(MM)', '영업(SM)'];

function buildSheet2GeuntaeSituationTemplate(dateStr: string): (string | number)[][] {
  const pad = (arr: (string | number)[], len: number) => [...arr, ...Array(len).fill('')].slice(0, len);
  const [y, m, d] = (dateStr || new Date().toISOString().slice(0, 10)).split('-');
  const dateDisplay = `${y} 년 ${m}월 ${d}`;
  const emptyCells = (n: number) => Array(n).fill('') as string[];
  const rows: (string | number)[][] = [
    pad(['근태 상황 보고서', ...Array(COLS_GEUNTAE_SITUATION - 1).fill('')], COLS_GEUNTAE_SITUATION),
    pad(['', '', '', '', '', '', '', '', '', '', '', '', '', '보고 부서', '', '인사팀', '', '', '작성자', '', '', '', '페이지 번호', '', dateStr, ''], COLS_GEUNTAE_SITUATION),
    pad(['', '', '', '', '', '', '', '', '', '', '', '', '', '작성일자', '', dateStr, ...emptyCells(COLS_GEUNTAE_SITUATION - 16)], COLS_GEUNTAE_SITUATION),
    pad(['근태 일자 : ' + dateDisplay, '', '', '', '', '', '', '', '', '', '', '', '', '(단위 : 명)', ...emptyCells(COLS_GEUNTAE_SITUATION - 14)], COLS_GEUNTAE_SITUATION),
    pad(['', '구분', '관리(QL)', '', '', '제조 기술 (EQM)', '', '', '관리(HQ)', '생산(SX)', '', '', '품질(QC)', '', '', '자재(MM)', '', '', '영업(SM)', '', '', '합계', '', '', '', 'Total', ''], COLS_GEUNTAE_SITUATION),
    pad(['', '', '간접 1\r\n(G.T)', '직접 1\r\n(T.T)', '직접 2\r\n(T.T)', '간접 1\r\n(G.T)', '직접 1\r\n(T.T)', '직접 2\r\n(T.T)', '', '간접 1\r\n(G.T)', '직접 1\r\n(T.T)', '간접 2\r\n(G.T)', '직접 2\r\n(T.T)', '간접 1\r\n(G.T)', '직접 1\r\n(T.T)', '직접 2\r\n(T.T)', '간접 1\r\n(G.T)', '직접 1\r\n(T.T)', '직접 2\r\n(T.T)', '간접 1\r\n(G.T)', '직접 1\r\n(T.T)', '직접 2\r\n(T.T)', '간접 1\r\n(G.T)', '직접 1\r\n(T.T)', '간접 2\r\n(G.T)', '직접 2\r\n(T.T)', ''], COLS_GEUNTAE_SITUATION),
  ];
  rows.push(pad(['전체\r\n(Tong)', '총 인원수(TOTAL)', ...emptyCells(COLS_GEUNTAE_SITUATION - 2)], COLS_GEUNTAE_SITUATION));
  rows.push(pad(['', '출근 인원수(DL)', ...emptyCells(COLS_GEUNTAE_SITUATION - 2)], COLS_GEUNTAE_SITUATION));
  for (const label of ['결근인원수(V)', '무단결근(Ko.Ly Do)', '휴가(Co Ly Do)', '기타(Khac)', '퇴사 (Nghi viec)']) {
    rows.push(pad(['', label, ...Array(COLS_GEUNTAE_SITUATION - 2).fill('-')], COLS_GEUNTAE_SITUATION));
  }
  rows.push(pad(['', '출근율(%)', '', ...emptyCells(COLS_GEUNTAE_SITUATION - 3)], COLS_GEUNTAE_SITUATION));
  return rows;
}

function getSheet2GeuntaeSituationStyles() {
  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: COLS_GEUNTAE_SITUATION - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } },
    { s: { r: 6, c: 0 }, e: { r: 13, c: 0 } },
  ];
  const rowStyles: Record<number, { backgroundColor: string; color: string; fontWeight: string; textAlign: 'center' }> = {
    0: { backgroundColor: '#1e3a5f', color: '#fff', fontWeight: 'bold', textAlign: 'center' },
    4: { backgroundColor: '#e5e7eb', color: '#000', fontWeight: 'bold', textAlign: 'center' },
    5: { backgroundColor: '#e5e7eb', color: '#000', fontWeight: 'bold', textAlign: 'center' },
    13: { backgroundColor: '#fef9c3', color: '#000', fontWeight: 'normal', textAlign: 'center' },
  };
  const cellStyles: Record<string, { backgroundColor?: string }> = {};
  for (let c = 1; c < COLS_GEUNTAE_SITUATION; c++) cellStyles['13,' + c] = { backgroundColor: '#fef9c3' };
  return { merges, rowStyles, cellStyles };
}

type TemplateSheetGrid = {
  name: string;
  rows: (string | number)[][];
  merges: { s: { r: number; c: number }; e: { r: number; c: number } }[];
  rowStyles?: Record<number, SheetRowStyle>;
  cellStyles?: Record<string, SheetCellStyle>;
  colWidths?: Record<number, number>;
  rowHeights?: Record<number, number>;
  hiddenCols?: number[];
  hiddenRows?: number[];
};

type TemplateWorkbookBundle = {
  workbook: ExcelJS.Workbook;
  loadedAt: number;
};

const templateWorkbookBundleCache = new Map<string, TemplateWorkbookBundle>();

async function getTemplateWorkbookBundle(filePath: string): Promise<TemplateWorkbookBundle> {
  const cached = templateWorkbookBundleCache.get(filePath);
  if (cached) return cached;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const next = { workbook, loadedAt: Date.now() };
  templateWorkbookBundleCache.set(filePath, next);
  return next;
}

const DEFAULT_THEME_COLORS: Record<number, string> = {
  0: '#ffffff',
  1: '#000000',
  2: '#eeece1',
  3: '#1f497d',
  4: '#4f81bd',
  5: '#c0504d',
  6: '#9bbb59',
  7: '#8064a2',
  8: '#4bacc6',
  9: '#f79646',
};

function normalizeArgbColor(argb: string | undefined): string | undefined {
  if (!argb) return undefined;
  const clean = String(argb).trim();
  if (clean.length === 8) return `#${clean.slice(2)}`.toLowerCase();
  if (clean.length === 6) return `#${clean}`.toLowerCase();
  return undefined;
}

function excelColorToCss(color: any): string | undefined {
  if (!color) return undefined;
  if (typeof color.argb === 'string') return normalizeArgbColor(color.argb);
  if (typeof color.theme === 'number') return DEFAULT_THEME_COLORS[color.theme];
  return undefined;
}

function borderStyleToCss(style?: string): string {
  switch (style) {
    case 'thick':
      return '2px solid';
    case 'double':
      return '3px double';
    case 'dashed':
    case 'mediumDashed':
      return '1px dashed';
    case 'dotted':
      return '1px dotted';
    case 'hair':
      return '1px solid';
    case 'medium':
    case 'mediumDashDot':
    case 'mediumDashDotDot':
      return '2px solid';
    case 'dashDot':
    case 'dashDotDot':
    case 'slantDashDot':
      return '1px dashed';
    case 'thin':
    default:
      return '1px solid';
  }
}

const DEFAULT_CELL_BORDER = '1px solid #94a3b8';

function excelBorderToCss(borderPart: any): string | undefined {
  if (!borderPart?.style) return undefined;
  const color = excelColorToCss(borderPart.color) || '#94a3b8';
  return `${borderStyleToCss(borderPart.style)} ${color}`;
}

function extractExcelCellStyle(cell: ExcelJS.Cell): SheetCellStyle {
  const style: SheetCellStyle = {};
  const fillColor = excelColorToCss((cell.fill as any)?.fgColor) || excelColorToCss((cell.fill as any)?.bgColor);
  if (fillColor) style.backgroundColor = fillColor;
  const fontColor = excelColorToCss((cell.font as any)?.color);
  if (fontColor) style.color = fontColor;
  if ((cell.font as any)?.bold) style.fontWeight = 'bold';
  if (typeof (cell.font as any)?.size === 'number' && Math.round((cell.font as any).size) !== 11) {
    style.fontSize = `${Math.round((cell.font as any).size)}px`;
  }
  if ((cell.font as any)?.name && !/times new roman/i.test(String((cell.font as any).name))) {
    style.fontFamily = String((cell.font as any).name);
  }

  const horizontal = (cell.alignment as any)?.horizontal;
  if (horizontal === 'center' || horizontal === 'right') {
    style.textAlign = horizontal;
  }
  const vertical = (cell.alignment as any)?.vertical;
  if (vertical === 'middle' || vertical === 'bottom') {
    style.verticalAlign = vertical;
  }
  if ((cell.alignment as any)?.wrapText === false) style.whiteSpace = 'nowrap';

  const border = cell.border as any;
  const borderTop = excelBorderToCss(border?.top);
  const borderRight = excelBorderToCss(border?.right);
  const borderBottom = excelBorderToCss(border?.bottom);
  const borderLeft = excelBorderToCss(border?.left);
  if (borderTop && borderTop !== DEFAULT_CELL_BORDER) style.borderTop = borderTop;
  if (borderRight && borderRight !== DEFAULT_CELL_BORDER) style.borderRight = borderRight;
  if (borderBottom && borderBottom !== DEFAULT_CELL_BORDER) style.borderBottom = borderBottom;
  if (borderLeft && borderLeft !== DEFAULT_CELL_BORDER) style.borderLeft = borderLeft;
  return style;
}

function hasStyleFields(style: SheetCellStyle): boolean {
  return Object.values(style).some((value) => value !== undefined && value !== '');
}

let workforceTemplateCache: { workbook: XLSX.WorkBook; loadedAt: number } | null = null;

function resolveWorkforceTemplatePath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'New folder', '근태 현황 보고서_Rev.3 260209 mẫu.xlsx'),
    path.resolve(process.cwd(), '..', 'New folder', '근태 현황 보고서_Rev.3 260209 mẫu.xlsx'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Không tìm thấy file mẫu: 근태 현황 보고서_Rev.3 260209 mẫu.xlsx');
}

function getWorkforceTemplateWorkbook(): XLSX.WorkBook {
  if (workforceTemplateCache) return workforceTemplateCache.workbook;
  const filePath = resolveWorkforceTemplatePath();
  const workbook = XLSX.readFile(filePath, { cellStyles: true, cellNF: true });
  workforceTemplateCache = { workbook, loadedAt: Date.now() };
  return workbook;
}

function sheetToTemplateGrid(workbook: XLSX.WorkBook, sheetName: string): TemplateSheetGrid {
  const ws = workbook.Sheets[sheetName];
  if (!ws || !ws['!ref']) {
    throw new Error(`Sheet "${sheetName}" không có dữ liệu`);
  }
  const range = XLSX.utils.decode_range(ws['!ref']);
  const rows: (string | number)[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: (string | number)[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      // Keep Excel display format (e.g. 1 -> 100%) instead of raw value.
      row.push((cell?.w ?? cell?.v ?? '') as string | number);
    }
    rows.push(row);
  }
  const merges = ((ws['!merges'] || []) as XLSX.Range[])
    .filter((m) => m.s.r >= range.s.r && m.e.r <= range.e.r && m.s.c >= range.s.c && m.e.c <= range.e.c)
    .map((m) => ({
      s: { r: m.s.r - range.s.r, c: m.s.c - range.s.c },
      e: { r: m.e.r - range.s.r, c: m.e.c - range.s.c },
    }));

  return { name: sheetName, rows, merges };
}

async function sheetToStyledTemplateGrid(
  workbook: XLSX.WorkBook,
  sheetName: string,
  filePath: string
): Promise<TemplateSheetGrid> {
  const baseGrid = sheetToTemplateGrid(workbook, sheetName);
  const ws = workbook.Sheets[sheetName];
  if (!ws || !ws['!ref']) return baseGrid;

  const bundle = await getTemplateWorkbookBundle(filePath);
  const excelSheet = bundle.workbook.getWorksheet(sheetName);
  if (!excelSheet) return baseGrid;

  const range = XLSX.utils.decode_range(ws['!ref']);
  const cellStyles: Record<string, SheetCellStyle> = {};
  const colWidths: Record<number, number> = {};
  const rowHeights: Record<number, number> = {};
  const hiddenCols: number[] = [];
  const hiddenRows: number[] = [];
  const totalCells = (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1);
  const maxStyledRows = totalCells > 12000 ? 40 : Number.POSITIVE_INFINITY;

  for (let c = range.s.c; c <= range.e.c; c++) {
    const col = excelSheet.getColumn(c + 1);
    const localCol = c - range.s.c;
    if (typeof col.width === 'number' && Number.isFinite(col.width)) {
      colWidths[localCol] = Math.max(Math.round(col.width * 7.2), 24);
    }
    if (col.hidden) hiddenCols.push(localCol);
  }

  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = excelSheet.getRow(r + 1);
    const localRow = r - range.s.r;
    if (typeof row.height === 'number' && Number.isFinite(row.height)) {
      rowHeights[localRow] = row.height;
    }
    if (row.hidden) hiddenRows.push(localRow);

    if (localRow >= maxStyledRows) continue;

    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = excelSheet.getCell(r + 1, c + 1);
      const localCol = c - range.s.c;
      const style = extractExcelCellStyle(cell);
      const displayValue = baseGrid.rows[localRow]?.[localCol];
      const hasDisplayValue =
        displayValue !== null &&
        displayValue !== undefined &&
        String(displayValue).trim() !== '';
      if (!hasDisplayValue) {
        delete style.textAlign;
        delete style.verticalAlign;
        delete style.fontSize;
        delete style.fontFamily;
        delete style.whiteSpace;
      }
      if (hasStyleFields(style)) {
        cellStyles[`${localRow},${localCol}`] = style;
      }
    }
  }

  return {
    ...baseGrid,
    ...(Object.keys(cellStyles).length ? { cellStyles } : {}),
    ...(Object.keys(colWidths).length ? { colWidths } : {}),
    ...(Object.keys(rowHeights).length ? { rowHeights } : {}),
    ...(hiddenCols.length ? { hiddenCols } : {}),
    ...(hiddenRows.length ? { hiddenRows } : {}),
  };
}

function isDateLikeCell(val: string | number): boolean {
  if (typeof val === 'number') return true;
  const s = String(val).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) return true;
  if (/^\d{4}\s*년\s*\d{1,2}\s*월/.test(s)) return true;
  if (/\d{4}\s*년|\d{1,2}\/\d{1,2}\/\d{2}/.test(s)) return true;
  if (/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(s)) return true;
  return false;
}

function blankWorkforceSummaryRows(rows: (string | number)[][]): (string | number)[][] {
  const next = rows.map((r) => [...r]);
  for (let r = 0; r < next.length; r++) {
    for (let c = 0; c < next[r].length; c++) {
      const cell = next[r][c];
      if (typeof cell === 'number') {
        next[r][c] = '';
      } else if (typeof cell === 'string' && isDateLikeCell(cell)) {
        next[r][c] = '';
      }
      if (r >= 5 && c >= 2) next[r][c] = '';
    }
  }
  return next;
}

function blankWorkforceSituationRows(rows: (string | number)[][]): (string | number)[][] {
  const next = rows.map((r) => [...r]);
  for (let r = 0; r < next.length; r++) {
    for (let c = 0; c < next[r].length; c++) {
      const cell = next[r][c];
      if (typeof cell === 'number') next[r][c] = '';
      else if (typeof cell === 'string' && isDateLikeCell(cell)) next[r][c] = '';
      if (r >= 6 && c >= 2) next[r][c] = '';
    }
  }
  return next;
}

function loadWorkforceTemplateSheets(dateStr: string): { summary: TemplateSheetGrid; situation: TemplateSheetGrid } {
  const wb = getWorkforceTemplateWorkbook();
  const month = (dateStr || '').slice(5, 7);
  const summarySheetName =
    wb.SheetNames.find((s) => month && s.includes(`(${month}월)`)) ||
    wb.SheetNames.find((s) => s.includes('근태종합'));
  if (!summarySheetName) throw new Error('Không tìm thấy sheet 근태종합 trong file mẫu');

  const preferredSituationName = month ? `01.${month}` : '';
  const situationSheetName =
    (preferredSituationName && wb.Sheets[preferredSituationName]?.['!ref'] ? preferredSituationName : '') ||
    wb.SheetNames.find((s) => /^\d{2}\.\d{2}$/.test(s) && wb.Sheets[s]?.['!ref']) ||
    wb.SheetNames.find((s) => {
      const ws = wb.Sheets[s];
      const c2 = ws?.C2?.v;
      return typeof c2 === 'string' && c2.includes('근태 상황 보고서');
    });
  if (!situationSheetName) throw new Error('Không tìm thấy sheet 근태 상황 보고서 trong file mẫu');

  const summary = sheetToTemplateGrid(wb, summarySheetName);
  const situation = sheetToTemplateGrid(wb, situationSheetName);

  return {
    summary: { ...summary, rows: blankWorkforceSummaryRows(summary.rows) },
    situation: { ...situation, rows: blankWorkforceSituationRows(situation.rows) },
  };
}

let attendanceRateTemplateCache: { workbook: XLSX.WorkBook; loadedAt: number } | null = null;

function resolveAttendanceRateTemplatePath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'New folder', 'TI LE DI LAM 01.2026.xlsx'),
    path.resolve(process.cwd(), '..', 'New folder', 'TI LE DI LAM 01.2026.xlsx'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Không tìm thấy file mẫu: TI LE DI LAM 01.2026.xlsx');
}

function getAttendanceRateTemplateWorkbook(): XLSX.WorkBook {
  if (attendanceRateTemplateCache) return attendanceRateTemplateCache.workbook;
  const filePath = resolveAttendanceRateTemplatePath();
  const workbook = XLSX.readFile(filePath, { cellStyles: true, cellNF: true });
  attendanceRateTemplateCache = { workbook, loadedAt: Date.now() };
  return workbook;
}

function blankAttendanceRateRows(rows: (string | number)[][]): (string | number)[][] {
  const next = rows.map((r) => [...r]);
  for (let r = 0; r < next.length; r++) {
    for (let c = 0; c < next[r].length; c++) {
      if (typeof next[r][c] === 'number') next[r][c] = '';
      if (r >= 7) next[r][c] = '';
    }
  }
  return next;
}

function loadAttendanceRateTemplateSheet(dateStr: string): TemplateSheetGrid {
  const wb = getAttendanceRateTemplateWorkbook();
  const month = (dateStr || '').slice(5, 7);
  const monthSheetName =
    wb.SheetNames.find((s) => s.toLowerCase().includes(`thang ${month}.`)) ||
    wb.SheetNames.find((s) => s.toLowerCase().includes('thang 01.2026 tv')) ||
    wb.SheetNames.find((s) => {
      const ws = wb.Sheets[s];
      const b2 = ws?.B2?.v;
      return typeof b2 === 'string' && b2.includes('Báo cáo tỉ lệ đi làm thời vụ');
    });
  if (!monthSheetName) throw new Error('Không tìm thấy sheet mẫu cho Tỉ lệ đi làm');
  const grid = sheetToTemplateGrid(wb, monthSheetName);
  return { ...grid, rows: blankAttendanceRateRows(grid.rows) };
}

function normTkCode(c: unknown): string {
  return String(c ?? '')
    .trim()
    .toUpperCase();
}

function isNightShiftTk(shift: unknown): boolean {
  const s = String(shift ?? '').toUpperCase();
  return /DEM|ĐÊM|DÊM|NIGHT|CA\s*ĐÊM|CA\s*2\b|MAIN\s*\(\s*N\)|MAIN\s+N\b/.test(s);
}

/** Nhận dạng text ca (DS hoặc cột shift trên chấm công) — dùng chung để khớp Excel. */
function parseRosterMainShift(val: unknown): 'day' | 'night' | null {
  const raw = String(val ?? '').trim();
  if (!raw) return null;
  const s = raw
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!s) return null;

  const hasMainD = /MAIN\s*\(\s*D\s*\)|MAIN\s+D\b/.test(s);
  const hasMainN = /MAIN\s*\(\s*N\s*\)|MAIN\s+N\b/.test(s);
  if (hasMainN && !hasMainD) return 'night';
  if (hasMainD && !hasMainN) return 'day';
  if (hasMainN && hasMainD) return null;

  if (/CA\s*DEM|CA\s*DE\b|CA\s*2\b|CA2\b|DEM\b|NIGHT|H\s*DEM|HDEM|\bTOI\b|CHIEU\s*DEM/i.test(s)) {
    return 'night';
  }
  if (/CA\s*NGAY|CA\s*1\b|CA1\b|\bNGAY\b|\bSANG\b|\bTRUA\b|DAY\s*SHIFT|HC\s*NGAY/i.test(s)) {
    return 'day';
  }

  const compact = s.replace(/\s+/g, '');
  if (/^(D|DAY|NGAY)$/.test(compact)) return 'day';
  if (/^(N|NIGHT|DEM|TOI)$/.test(compact)) return 'night';

  if (/^CA0*1$/i.test(compact) || /^1$/.test(compact)) return 'day';
  if (/^CA0*2$/i.test(compact) || /^2$/.test(compact)) return 'night';

  if (/SX\s*-?\s*N|SAN\s*XUAT\s*-?\s*N/i.test(s)) return 'night';
  if (/SX\s*-?\s*D|SAN\s*XUAT\s*-?\s*D/i.test(s)) return 'day';

  return null;
}

/** Một mã NV / một ngày: gom các dòng chấm công, quyết định ca ngày vs ca đêm (khớp logic bảng Excel: Tổng = ca ngày + ca đêm, hai tập rời nhau). */
function inferAttendanceCountShiftBucket(records: TimekeepingLite[]): 'day' | 'night' {
  let nightW = 0;
  let dayW = 0;
  for (const r of records) {
    const fromCell = parseRosterMainShift(r.shift);
    if (fromCell === 'night') {
      nightW += 5;
      continue;
    }
    if (fromCell === 'day') {
      dayW += 5;
      continue;
    }
    if (isNightShiftTk(r.shift)) {
      nightW += 3;
      continue;
    }
    const s = String(r.shift ?? '').toUpperCase();
    if (/NGAY|DAY|CA\s*NGAY|MAIN\s*\(\s*D\s*\)|\(\s*D\s*\)/.test(s)) {
      dayW += 3;
      continue;
    }
    const cin = String(r.check_in || '').trim();
    const m = cin.match(/(\d{1,2})[:.h](\d{2})/i);
    if (m) {
      const h = parseInt(m[1], 10);
      if (h >= 18 || h <= 5) nightW += 2;
      else dayW += 2;
      continue;
    }
    dayW += 1;
  }
  return nightW > dayW ? 'night' : 'day';
}

/** Ngày vào làm (ưu tiên cột trong file danh sách CT/TV đã import vào employee_excel_store), fallback created_at bảng employees. */
async function loadHireDateByCodeMap(): Promise<Map<string, string>> {
  const [officialRows, seasonalRows, emps] = await Promise.all([
    loadEmployeeStoreRows('official'),
    loadEmployeeStoreRows('seasonal'),
    query<{ employee_code: string; created_at: string }>(
      `SELECT employee_code, created_at FROM employees`,
      {}
    ),
  ]);
  const map = new Map<string, string>();
  for (const e of emps) {
    const c = normalizeCode(e.employee_code);
    const ymd = clampYmd(String(e.created_at || '').slice(0, 10));
    if (c && ymd) map.set(c, ymd);
  }
  const ingest = (rows: Record<string, unknown>[]) => {
    for (const row of rows) {
      const code = extractEmployeeCodeFromStoreRow(row);
      if (!code) continue;
      const hireRaw = getRowValueByHeader(row, [
        ['ngay vao'],
        ['ngay bat dau'],
        ['ngay nhan viec'],
        ['ngay ky hd'],
        ['tu ngay'],
      ]);
      const ymd = clampYmd(parseLooseDate(hireRaw));
      if (ymd) map.set(code, ymd);
    }
  };
  ingest(officialRows);
  ingest(seasonalRows);
  return map;
}

const UNASSIGNED_VENDOR = '— Chưa gán NCC —';

type AttendanceRateBlock =
  | { kind: 'month'; label: string; dates: string[] }
  | { kind: 'week'; label: string; dates: string[] }
  | { kind: 'day'; label: string; date: string };

type AttendanceRateMetric = {
  totalSl: number;
  totalDl: number;
  daySl: number;
  dayDl: number;
  nightSl: number;
  nightDl: number;
};

type AttendanceRateShiftStats = {
  dayHits: number;
  nightHits: number;
  latestDate: string;
  latestShift: 'day' | 'night';
};

type AttendanceRateBase = {
  totalCodes: Set<string>;
  dayCodes: Set<string>;
  nightCodes: Set<string>;
};

type AttendanceRateDailyAgg = {
  totalCodes: Set<string>;
  dayCodes: Set<string>;
  nightCodes: Set<string>;
};

const ZERO_ATTENDANCE_RATE_METRIC: AttendanceRateMetric = {
  totalSl: 0,
  totalDl: 0,
  daySl: 0,
  dayDl: 0,
  nightSl: 0,
  nightDl: 0,
};

function formatAttendanceRateDayLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${Number(month)}/${Number(day)}/${year.slice(2)}`;
}

function getAttendanceRateWeekOfMonth(dateStr: string): number {
  const dt = parseYmdLocal(dateStr);
  const firstDay = new Date(dt.getFullYear(), dt.getMonth(), 1);
  return Math.floor((dt.getDate() + firstDay.getDay() - 1) / 7) + 1;
}

function getAttendanceRateWeekKey(dateStr: string): string {
  const month = Number(dateStr.slice(5, 7));
  return `W${getAttendanceRateWeekOfMonth(dateStr)}/T${month}`;
}

function buildAttendanceRateBlocks(dates: string[]): AttendanceRateBlock[] {
  if (!dates.length) return [];

  const uniqueMonths = [...new Set(dates.map((date) => date.slice(0, 7)))];
  const monthLabel = uniqueMonths.length === 1 ? `Tháng ${dates[0].slice(5, 7)}` : 'TB kỳ';
  const weekKeys = new Set(dates.map((date) => `${date.slice(0, 7)}-${getAttendanceRateWeekOfMonth(date)}`));
  const shouldShowWeekTotals = weekKeys.size > 1;

  const blocks: AttendanceRateBlock[] = [{ kind: 'month', label: monthLabel, dates: [...dates] }];
  let weekBucket: string[] = [];

  for (let index = 0; index < dates.length; index += 1) {
    const dateStr = dates[index];
    const nextDate = dates[index + 1];

    blocks.push({
      kind: 'day',
      label: formatAttendanceRateDayLabel(dateStr),
      date: dateStr,
    });
    weekBucket.push(dateStr);

    const currentWeekKey = `${dateStr.slice(0, 7)}-${getAttendanceRateWeekOfMonth(dateStr)}`;
    const nextWeekKey = nextDate ? `${nextDate.slice(0, 7)}-${getAttendanceRateWeekOfMonth(nextDate)}` : '';
    const isWeekBoundary = !nextDate || currentWeekKey !== nextWeekKey;

    if (shouldShowWeekTotals && isWeekBoundary && weekBucket.length > 0) {
      blocks.push({
        kind: 'week',
        label: getAttendanceRateWeekKey(dateStr),
        dates: [...weekBucket],
      });
    }

    if (isWeekBoundary) {
      weekBucket = [];
    }
  }

  return blocks;
}

function createAttendanceRateBase(): AttendanceRateBase {
  return {
    totalCodes: new Set<string>(),
    dayCodes: new Set<string>(),
    nightCodes: new Set<string>(),
  };
}

function createAttendanceRateDailyAgg(): AttendanceRateDailyAgg {
  return {
    totalCodes: new Set<string>(),
    dayCodes: new Set<string>(),
    nightCodes: new Set<string>(),
  };
}

function sumAttendanceRateMetrics(metrics: AttendanceRateMetric[]): AttendanceRateMetric {
  const sum = { ...ZERO_ATTENDANCE_RATE_METRIC };
  for (const metric of metrics) {
    sum.totalSl += metric.totalSl;
    sum.totalDl += metric.totalDl;
    sum.daySl += metric.daySl;
    sum.dayDl += metric.dayDl;
    sum.nightSl += metric.nightSl;
    sum.nightDl += metric.nightDl;
  }
  return sum;
}

function averageAttendanceRateMetrics(metrics: AttendanceRateMetric[]): AttendanceRateMetric {
  if (!metrics.length) return { ...ZERO_ATTENDANCE_RATE_METRIC };
  const sum = sumAttendanceRateMetrics(metrics);
  const divisor = metrics.length;
  return {
    totalSl: sum.totalSl / divisor,
    totalDl: sum.totalDl / divisor,
    daySl: sum.daySl / divisor,
    dayDl: sum.dayDl / divisor,
    nightSl: sum.nightSl / divisor,
    nightDl: sum.nightDl / divisor,
  };
}

function formatAttendanceRateCount(value: number): string | number {
  if (!Number.isFinite(value) || Math.abs(value) < 0.0001) return 0;
  const rounded = Math.round(value * 10) / 10;
  return Math.abs(rounded - Math.round(rounded)) < 0.0001 ? Math.round(rounded) : rounded;
}

function formatAttendanceRatePercent(attended: number, total: number): string {
  const rawRate = total > 0 ? (attended / total) * 100 : 0;
  const rate = Math.max(0, Math.min(100, Math.round(rawRate * 10) / 10));
  const formatted = Number.isInteger(rate) ? rate.toFixed(0) : rate.toFixed(1).replace(/\.0$/, '');
  return `${formatted}%`;
}

function getDailyAttendanceRateMetric(
  base: AttendanceRateBase | undefined,
  dailyAgg?: AttendanceRateDailyAgg
): AttendanceRateMetric {
  const totalBase = base?.totalCodes.size || 0;
  const totalDl = dailyAgg?.totalCodes.size || 0;
  const dayDl = dailyAgg?.dayCodes.size || 0;
  const nightDl = dailyAgg?.nightCodes.size || 0;

  if (!base || totalBase <= 0) {
    return {
      totalSl: totalDl,
      totalDl,
      daySl: dayDl,
      dayDl,
      nightSl: nightDl,
      nightDl,
    };
  }

  let daySl = base.dayCodes.size;
  let nightSl = Math.max(totalBase - daySl, 0);

  if (dayDl > daySl) {
    const need = dayDl - daySl;
    const movable = Math.max(nightSl - nightDl, 0);
    const moved = Math.min(need, movable);
    daySl += moved;
    nightSl -= moved;
  }

  if (nightDl > nightSl) {
    const need = nightDl - nightSl;
    const movable = Math.max(daySl - dayDl, 0);
    const moved = Math.min(need, movable);
    nightSl += moved;
    daySl -= moved;
  }

  daySl = Math.max(daySl, dayDl);
  nightSl = Math.max(nightSl, nightDl);
  const totalSl = Math.max(totalBase, daySl + nightSl, totalDl);

  return {
    totalSl,
    totalDl,
    daySl,
    dayDl,
    nightSl,
    nightDl,
  };
}

function buildAttendanceRateMetricCells(
  metric: AttendanceRateMetric,
  kind: AttendanceRateBlock['kind']
): (string | number)[] {
  if (kind === 'day') {
    return [
      formatAttendanceRateCount(metric.totalSl),
      formatAttendanceRateCount(metric.totalDl),
      formatAttendanceRatePercent(metric.totalDl, metric.totalSl),
      formatAttendanceRateCount(metric.daySl),
      formatAttendanceRateCount(metric.dayDl),
      formatAttendanceRatePercent(metric.dayDl, metric.daySl),
      formatAttendanceRateCount(metric.nightSl),
      formatAttendanceRateCount(metric.nightDl),
      formatAttendanceRatePercent(metric.nightDl, metric.nightSl),
    ];
  }

  return [
    formatAttendanceRateCount(metric.totalSl),
    formatAttendanceRateCount(metric.totalDl),
    formatAttendanceRatePercent(metric.totalDl, metric.totalSl),
  ];
}

/**
 * Tỉ lệ đi làm: Vendor = nhà cung cấp (bảng employee_vendor_map), không dùng phòng ban.
 * Gán NV → NCC tại trang «Gán Vendor» hoặc upload Excel 2 cột (Mã NV, Vendor).
 */
async function buildAttendanceRateFromTimekeeping(
  start_date: string,
  end_date: string
): Promise<TemplateSheetGrid> {
  let sd = start_date;
  let ed = end_date;
  if (!sd || !ed) {
    const n = new Date();
    const y = n.getFullYear();
    const m = n.getMonth();
    sd = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    ed = `${y}-${String(m + 1).padStart(2, '0')}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, '0')}`;
  }
  if (sd > ed) {
    return {
      name: 'Tỉ lệ đi làm',
      rows: [['Chọn khoảng ngày hợp lệ (Bộ lọc thời gian). start_date ≤ end_date.', '']],
      merges: [],
    };
  }

  const tkRowsAllRaw = await query<TimekeepingLite>(
    `SELECT id, employee_code, employee_name, date, shift, workday, check_in, department, created_at, is_archived
     FROM timekeeping_records
     WHERE date >= @sd AND date <= @ed
     ORDER BY date, employee_code, created_at DESC`,
    { sd, ed }
  );
  const tkRowsAllLatest = dedupeLatestTimekeepingRecords(tkRowsAllRaw);
  const availableDates = [...new Set(
    tkRowsAllLatest
      .map((row) => String(row.date || '').slice(0, 10))
      .filter(Boolean)
  )].sort();
  const dates = availableDates.length > 62 ? availableDates.slice(-62) : availableDates;
  const dateSet = new Set(dates);

  if (dates.length === 0) {
    return {
      name: 'Tỉ lệ đi làm',
      rows: [['Chưa có dữ liệu chấm công trong khoảng lọc hiện tại.', '']],
      merges: [],
    };
  }

  let vrows: { employee_code: string; vendor_name: string }[] = [];
  try {
    vrows = await query(
      'SELECT employee_code, vendor_name FROM employee_vendor_map',
      {}
    );
  } catch {
    vrows = [];
  }
  const codeToVendorName = new Map<string, string>();
  for (const v of vrows) {
    const c = normTkCode(v.employee_code);
    if (c) codeToVendorName.set(c, String(v.vendor_name || '').trim() || UNASSIGNED_VENDOR);
  }

  const employeesAll = await loadEmployeesLite();
  const masterSeasonalCodes = new Set<string>();
  for (const e of employeesAll.filter((emp) => isSeasonalEmployee(emp.employment_type))) {
    const code = normTkCode(e.employee_code);
    if (code) masterSeasonalCodes.add(code);
  }

  const codeToVendor = new Map<string, string>();
  const ensureVendorCode = (code: string) => {
    const vendor = codeToVendorName.get(code) || UNASSIGNED_VENDOR;
    codeToVendor.set(code, vendor);
  };
  for (const code of codeToVendorName.keys()) {
    ensureVendorCode(code);
  }

  const isAttendanceRateSeasonalCode = (code: string, department?: string) =>
    masterSeasonalCodes.has(code) || codeToVendorName.has(code) || isSeasonalDepartment(department);

  const periodSeasonalCodes = new Set<string>();
  const shiftStatsByCode = new Map<string, AttendanceRateShiftStats>();
  const tkRowsAll = tkRowsAllLatest.filter((row) => dateSet.has(String(row.date || '').slice(0, 10)));
  for (const row of tkRowsAll) {
    const code = normTkCode(row.employee_code);
    if (!code) continue;
    if (!isAttendanceRateSeasonalCode(code, row.department)) continue;

    periodSeasonalCodes.add(code);
    ensureVendorCode(code);

    const bucket = isNightShiftTk(row.shift) ? 'night' : 'day';
    const dateStr = String(row.date || '').slice(0, 10);
    const current = shiftStatsByCode.get(code) || {
      dayHits: 0,
      nightHits: 0,
      latestDate: '',
      latestShift: bucket as 'day' | 'night',
    };
    if (bucket === 'night') current.nightHits += 1;
    else current.dayHits += 1;
    if (!current.latestDate || dateStr >= current.latestDate) {
      current.latestDate = dateStr;
      current.latestShift = bucket;
    }
    shiftStatsByCode.set(code, current);
  }

  const baseByVendor = new Map<string, AttendanceRateBase>();
  for (const code of periodSeasonalCodes) {
    const vendor = codeToVendor.get(code) || codeToVendorName.get(code) || UNASSIGNED_VENDOR;
    const shiftStats = shiftStatsByCode.get(code);
    const shiftBucket =
      shiftStats?.latestShift ||
      ((shiftStats?.nightHits || 0) > (shiftStats?.dayHits || 0) ? 'night' : 'day');

    if (!baseByVendor.has(vendor)) {
      baseByVendor.set(vendor, createAttendanceRateBase());
    }
    const base = baseByVendor.get(vendor)!;
    base.totalCodes.add(code);
    if (shiftBucket === 'night') base.nightCodes.add(code);
    else base.dayCodes.add(code);
  }

  const tkRows = tkRowsAll.filter(hasAttendanceSignal);
  const aggKey = (vendor: string, dateStr: string) => `${vendor}\t${dateStr}`;
  const agg = new Map<string, AttendanceRateDailyAgg>();
  const ensureAgg = (vendor: string, d: string): AttendanceRateDailyAgg => {
    const k = aggKey(vendor, d);
    if (!agg.has(k)) agg.set(k, createAttendanceRateDailyAgg());
    return agg.get(k)!;
  };

  for (const r of tkRows as { employee_code: string; date: string; shift: string; workday: number; check_in: string; department?: string }[]) {
    const dateStr = String(r.date || '').slice(0, 10);
    if (!dateStr) continue;
    const wd = Number(r.workday) || 0;
    const cin = String(r.check_in || '').trim();
    if (wd <= 0 && !cin) continue;
    const code = normTkCode(r.employee_code);
    if (!code) continue;
    if (!isAttendanceRateSeasonalCode(code, r.department)) continue;

    ensureVendorCode(code);
    const vendor = codeToVendor.get(code) || codeToVendorName.get(code) || UNASSIGNED_VENDOR;
    if (!vendor) continue;
    const a = ensureAgg(vendor, dateStr);
    a.totalCodes.add(code);
    if (isNightShiftTk(r.shift)) a.nightCodes.add(code);
    else a.dayCodes.add(code);
  }

  const vendors = [...baseByVendor.keys()].filter((v) => v !== UNASSIGNED_VENDOR).sort((a, b) => a.localeCompare(b, 'vi'));
  if (baseByVendor.has(UNASSIGNED_VENDOR)) vendors.push(UNASSIGNED_VENDOR);

  const blocks = buildAttendanceRateBlocks(dates);
  const blockWidth = (block: AttendanceRateBlock) => (block.kind === 'day' ? 9 : 3);
  const numCols = 2 + blocks.reduce((sum, block) => sum + blockWidth(block), 0);
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(numCols - 1, 1) } });
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(numCols - 1, 1) } });
  merges.push({ s: { r: 2, c: 0 }, e: { r: 4, c: 0 } });
  merges.push({ s: { r: 2, c: 1 }, e: { r: 4, c: 1 } });

  const rows: (string | number)[][] = [];
  rows.push([
    'BÁO CÁO TỈ LỆ ĐI LÀM THỜI VỤ THEO NCC',
    ...Array(Math.max(numCols - 1, 0)).fill(''),
  ]);
  rows.push([
    `Khoảng lọc ${sd} → ${ed} | Ngày có dữ liệu: ${dates[0]} → ${dates[dates.length - 1]} | Tháng/Tuần = trung bình theo ngày có dữ liệu.`,
    ...Array(Math.max(numCols - 1, 0)).fill(''),
  ]);
  const h1: (string | number)[] = ['No', 'Vendor'];
  const h2: (string | number)[] = ['', ''];
  const h3: (string | number)[] = ['', ''];
  let c = 2;
  for (const block of blocks) {
    if (block.kind === 'day') {
      merges.push({ s: { r: 2, c }, e: { r: 2, c: c + 8 } });
      merges.push({ s: { r: 3, c }, e: { r: 3, c: c + 2 } });
      merges.push({ s: { r: 3, c: c + 3 }, e: { r: 3, c: c + 5 } });
      merges.push({ s: { r: 3, c: c + 6 }, e: { r: 3, c: c + 8 } });
      h1.push(block.label, '', '', '', '', '', '', '', '');
      h2.push('Tổng', '', '', 'Ca ngày', '', '', 'Ca đêm', '', '');
      h3.push(
        'Số lượng',
        'Đi làm',
        'Tỉ lệ',
        'Số lượng',
        'Đi làm',
        'Tỉ lệ',
        'Số lượng',
        'Đi làm',
        'Tỉ lệ'
      );
      c += 9;
    } else {
      merges.push({ s: { r: 2, c }, e: { r: 2, c: c + 2 } });
      merges.push({ s: { r: 3, c }, e: { r: 3, c: c + 2 } });
      h1.push(block.label, '', '');
      h2.push('Tổng', '', '');
      h3.push('Số lượng', 'Đi làm', 'Tỉ lệ');
      c += 3;
    }
  }
  rows.push(h1);
  rows.push(h2);
  rows.push(h3);

  const metricCache = new Map<string, AttendanceRateMetric>();
  const getBlockMetric = (vendor: string, block: AttendanceRateBlock): AttendanceRateMetric => {
    const key = `${vendor}\t${block.kind}\t${block.label}\t${block.kind === 'day' ? block.date : block.dates.join(',')}`;
    if (metricCache.has(key)) return metricCache.get(key)!;

    const base = baseByVendor.get(vendor);
    let metric = { ...ZERO_ATTENDANCE_RATE_METRIC };
    if (block.kind === 'day') {
      metric = getDailyAttendanceRateMetric(base, agg.get(aggKey(vendor, block.date)));
    } else {
      metric = averageAttendanceRateMetrics(
        block.dates.map((dateStr) => getDailyAttendanceRateMetric(base, agg.get(aggKey(vendor, dateStr))))
      );
    }
    metricCache.set(key, metric);
    return metric;
  };

  const totalRow: (string | number)[] = ['', 'Total'];
  for (const block of blocks) {
    const totalMetric = sumAttendanceRateMetrics(vendors.map((vendor) => getBlockMetric(vendor, block)));
    totalRow.push(...buildAttendanceRateMetricCells(totalMetric, block.kind));
  }
  rows.push(totalRow);

      let no = 1;
  for (const vendor of vendors) {
    const row: (string | number)[] = [no++, vendor];
    for (const block of blocks) {
      row.push(...buildAttendanceRateMetricCells(getBlockMetric(vendor, block), block.kind));
    }
    rows.push(row);
  }

  if (vendors.length === 0) {
    rows.push([
      1,
      '(Chưa có dữ liệu NCC thời vụ)',
      ...Array(Math.max(numCols - 2, 0)).fill(''),
    ]);
  }

  const rowStyles: Record<number, SheetRowStyle> = {
    0: { backgroundColor: '#1e3a5f', color: '#fff', fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap' },
    1: { backgroundColor: '#f8fafc', color: '#334155', textAlign: 'left', whiteSpace: 'nowrap' },
    2: { backgroundColor: '#1f497d', color: '#fff', fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap' },
    3: { backgroundColor: '#dbeafe', color: '#0f172a', fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap' },
    4: { backgroundColor: '#eff6ff', color: '#0f172a', fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap' },
    5: { backgroundColor: '#f8fafc', color: '#0f172a', fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap' },
  };
  const cellStyles: Record<string, SheetCellStyle> = {};
  const colWidths: Record<number, number> = {
    0: 56,
    1: 220,
  };
  for (let r = 5; r < rows.length; r += 1) {
    cellStyles[`${r},0`] = { textAlign: 'center', whiteSpace: 'nowrap' };
    cellStyles[`${r},1`] = { textAlign: 'left', whiteSpace: 'nowrap' };
  }
  let blockStart = 2;
  for (const block of blocks) {
    const borderColor = block.kind === 'month' ? '#d97706' : block.kind === 'week' ? '#64748b' : '#94a3b8';
    if (block.kind === 'day') {
      const totalColor = '#e0f2fe';
      const dayColor = '#dcfce7';
      const nightColor = '#ede9fe';
      const rateColor = '#f8fafc';

      for (let offset = 0; offset < 9; offset += 1) {
        colWidths[blockStart + offset] = offset % 3 === 2 ? 72 : 62;
        cellStyles[`3,${blockStart + offset}`] = {
          backgroundColor: offset < 3 ? totalColor : offset < 6 ? dayColor : nightColor,
          textAlign: 'center',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
        };
        cellStyles[`4,${blockStart + offset}`] = {
          backgroundColor:
            offset % 3 === 2 ? rateColor : offset < 3 ? totalColor : offset < 6 ? dayColor : nightColor,
          textAlign: 'center',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
        };
      }
      cellStyles[`2,${blockStart}`] = { borderLeft: `2px solid ${borderColor}` };
      cellStyles[`3,${blockStart}`] = { ...cellStyles[`3,${blockStart}`], borderLeft: `2px solid ${borderColor}` };
      cellStyles[`4,${blockStart}`] = { ...cellStyles[`4,${blockStart}`], borderLeft: `2px solid ${borderColor}` };
      blockStart += 9;
    } else {
      const blockColor = block.kind === 'month' ? '#fef3c7' : '#e2e8f0';
      for (let offset = 0; offset < 3; offset += 1) {
        colWidths[blockStart + offset] = offset === 2 ? 72 : 62;
        cellStyles[`3,${blockStart + offset}`] = {
          backgroundColor: blockColor,
          textAlign: 'center',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
        };
        cellStyles[`4,${blockStart + offset}`] = {
          backgroundColor: blockColor,
          textAlign: 'center',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
        };
      }
      cellStyles[`2,${blockStart}`] = { borderLeft: `2px solid ${borderColor}` };
      cellStyles[`3,${blockStart}`] = { ...cellStyles[`3,${blockStart}`], borderLeft: `2px solid ${borderColor}` };
      cellStyles[`4,${blockStart}`] = { ...cellStyles[`4,${blockStart}`], borderLeft: `2px solid ${borderColor}` };
      blockStart += 3;
    }
  }

  return { name: 'Tỉ lệ đi làm (NCC)', rows, merges, rowStyles, cellStyles, colWidths };
}

let tempTimesheetTemplateCache: { workbook: XLSX.WorkBook; loadedAt: number } | null = null;

function resolveTempTimesheetTemplatePath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'New folder', 'Bang chôt cong TV mẫu.xlsx'),
    path.resolve(process.cwd(), '..', 'New folder', 'Bang chôt cong TV mẫu.xlsx'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Không tìm thấy file mẫu: Bang chôt cong TV mẫu.xlsx');
}

function getTempTimesheetTemplateWorkbook(): XLSX.WorkBook {
  if (tempTimesheetTemplateCache) return tempTimesheetTemplateCache.workbook;
  const filePath = resolveTempTimesheetTemplatePath();
  const workbook = XLSX.readFile(filePath, { cellStyles: true, cellNF: true });
  tempTimesheetTemplateCache = { workbook, loadedAt: Date.now() };
  return workbook;
}

function blankTempTimesheetRows(rows: (string | number)[][]): (string | number)[][] {
  const next = rows.map((r) => [...r]);
  for (let r = 0; r < next.length; r++) {
    for (let c = 0; c < next[r].length; c++) {
      // Keep first 4 header rows from template, clear all data rows.
      if (r >= 4) next[r][c] = '';
    }
  }
  return next;
}

function loadTempTimesheetTemplateSheet(): TemplateSheetGrid {
  const wb = getTempTimesheetTemplateWorkbook();
  const sheetName = wb.SheetNames.find((s) => s.toLowerCase() === 'data') || wb.SheetNames[0];
  if (!sheetName) throw new Error('Không tìm thấy sheet Data trong mẫu chốt công TV');
  const grid = sheetToTemplateGrid(wb, sheetName);
  return { ...grid, rows: blankTempTimesheetRows(grid.rows) };
}

let officialTimesheetTemplateCache: { workbook: XLSX.WorkBook; loadedAt: number } | null = null;

function resolveOfficialTimesheetTemplatePath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'New folder', 'Chốt công chính thức mẫu.xlsx'),
    path.resolve(process.cwd(), '..', 'New folder', 'Chốt công chính thức mẫu.xlsx'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Không tìm thấy file mẫu: Chốt công chính thức mẫu.xlsx');
}

function getOfficialTimesheetTemplateWorkbook(): XLSX.WorkBook {
  if (officialTimesheetTemplateCache) return officialTimesheetTemplateCache.workbook;
  const filePath = resolveOfficialTimesheetTemplatePath();
  const workbook = XLSX.readFile(filePath, { cellStyles: true, cellNF: true });
  officialTimesheetTemplateCache = { workbook, loadedAt: Date.now() };
  return workbook;
}

function blankOfficialTimesheetRows(rows: (string | number)[][]): (string | number)[][] {
  const next = rows.map((r) => [...r]);
  for (let r = 0; r < next.length; r++) {
    for (let c = 0; c < next[r].length; c++) {
      // Keep 4 header rows from template, clear all detail rows.
      if (r >= 4) next[r][c] = '';
    }
  }
  return next;
}

function loadOfficialTimesheetTemplateSheet(): TemplateSheetGrid {
  const wb = getOfficialTimesheetTemplateWorkbook();
  const sheetName =
    wb.SheetNames.find((s) => s.toLowerCase() === 'attendance list') ||
    wb.SheetNames[0];
  if (!sheetName) throw new Error('Không tìm thấy sheet Attendance list trong mẫu chốt công chính thức');
  const grid = sheetToTemplateGrid(wb, sheetName);
  return { ...grid, rows: blankOfficialTimesheetRows(grid.rows) };
}

let insuranceTemplateCache: { workbook: XLSX.WorkBook; loadedAt: number } | null = null;

function resolveInsuranceTemplatePath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'New folder', 'file mẫu bảo hiểm.xlsx'),
    path.resolve(process.cwd(), '..', 'New folder', 'file mẫu bảo hiểm.xlsx'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Không tìm thấy file mẫu: file mẫu bảo hiểm.xlsx');
}

function getInsuranceTemplateWorkbook(): XLSX.WorkBook {
  if (insuranceTemplateCache) return insuranceTemplateCache.workbook;
  const filePath = resolveInsuranceTemplatePath();
  const workbook = XLSX.readFile(filePath, { cellStyles: true, cellNF: true });
  insuranceTemplateCache = { workbook, loadedAt: Date.now() };
  return workbook;
}

function blankInsuranceRows(rows: (string | number)[][]): (string | number)[][] {
  const next = rows.map((r) => [...r]);
  for (let r = 0; r < next.length; r++) {
    for (let c = 0; c < next[r].length; c++) {
      // Keep header rows only, clear all sample/data lines.
      if (r >= 3) next[r][c] = '';
    }
  }
  return next;
}

async function loadInsuranceTemplateSheets(): Promise<TemplateSheetGrid[]> {
  const filePath = resolveInsuranceTemplatePath();
  const wb = getInsuranceTemplateWorkbook();
  const dataName =
    wb.SheetNames.find((s) => s.toLowerCase().includes('dữ liệu')) ||
    wb.SheetNames.find((s) => s.toLowerCase().includes('du lieu'));
  const appendixName =
    wb.SheetNames.find((s) => s.toLowerCase().includes('phụ lục')) ||
    wb.SheetNames.find((s) => s.toLowerCase().includes('phu luc'));

  if (!dataName || !appendixName) {
    throw new Error('Không tìm thấy 2 sheet Dữ Liệu / Phụ lục trong file mẫu bảo hiểm');
  }

  const dataSheet = await sheetToStyledTemplateGrid(wb, dataName, filePath);
  const appendixSheet = await sheetToStyledTemplateGrid(wb, appendixName, filePath);
  return [
    { ...dataSheet, rows: blankInsuranceRows(dataSheet.rows) },
    { ...appendixSheet, rows: blankInsuranceRows(appendixSheet.rows) },
  ];
}

let attendanceCountTemplateCache: { workbook: XLSX.WorkBook; loadedAt: number } | null = null;

function resolveAttendanceCountTemplatePath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'New folder', 'BC SO LUONG DI LAM 012026 - mẫu.xlsx'),
    path.resolve(process.cwd(), '..', 'New folder', 'BC SO LUONG DI LAM 012026 - mẫu.xlsx'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Không tìm thấy file mẫu: BC SO LUONG DI LAM 012026 - mẫu.xlsx');
}

function getAttendanceCountTemplateWorkbook(): XLSX.WorkBook {
  if (attendanceCountTemplateCache) return attendanceCountTemplateCache.workbook;
  const filePath = resolveAttendanceCountTemplatePath();
  const workbook = XLSX.readFile(filePath, { cellStyles: true, cellNF: true });
  attendanceCountTemplateCache = { workbook, loadedAt: Date.now() };
  return workbook;
}

function blankAttendanceCountRows(rows: (string | number)[][]): (string | number)[][] {
  const next = rows.map((r) => [...r]);
  const dateLike = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
  for (let r = 0; r < next.length; r++) {
    for (let c = 0; c < next[r].length; c++) {
      const cell = next[r][c];
      // Remove date headers like 12/1/25 from template.
      if (typeof cell === 'string' && dateLike.test(cell.trim())) {
        next[r][c] = '';
      }
      // Keep only header band; clear Total + detail rows
      if (r >= 5) next[r][c] = '';
    }
  }
  return next;
}

function loadAttendanceCountTemplateSheet(): TemplateSheetGrid {
  const wb = getAttendanceCountTemplateWorkbook();
  const sheetName = wb.SheetNames.find((s) => s.toLowerCase() === 'sheet1') || wb.SheetNames[0];
  if (!sheetName) throw new Error('Không tìm thấy sheet mẫu cho báo cáo số lượng đi làm');
  const grid = sheetToTemplateGrid(wb, sheetName);
  return { ...grid, rows: blankAttendanceCountRows(grid.rows) };
}

let weeklyOneDayTemplateCache: { workbook: XLSX.WorkBook; loadedAt: number } | null = null;

function resolveWeeklyOneDayTemplatePath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'New folder', 'BC so luong lam 1 cong trong tuan.xlsx'),
    path.resolve(process.cwd(), '..', 'New folder', 'BC so luong lam 1 cong trong tuan.xlsx'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Không tìm thấy file mẫu: BC so luong lam 1 cong trong tuan.xlsx');
}

function getWeeklyOneDayTemplateWorkbook(): XLSX.WorkBook {
  if (weeklyOneDayTemplateCache) return weeklyOneDayTemplateCache.workbook;
  const filePath = resolveWeeklyOneDayTemplatePath();
  const workbook = XLSX.readFile(filePath, { cellStyles: true, cellNF: true });
  weeklyOneDayTemplateCache = { workbook, loadedAt: Date.now() };
  return workbook;
}

function blankWeeklyOneDayRows(rows: (string | number)[][]): (string | number)[][] {
  const next = rows.map((r) => [...r]);
  const dateLike = /\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?|\d{1,2}\.\d{2}\s*~\s*\d{1,2}\.\d{2}/;
  for (let r = 0; r < next.length; r++) {
    for (let c = 0; c < next[r].length; c++) {
      const cell = next[r][c];
      if (typeof cell === 'string' && dateLike.test(cell)) {
        next[r][c] = cell
          .replace(/\(\s*\d{1,2}[./-]\d{1,2}\s*~\s*\d{1,2}[./-]\d{1,2}\s*\)/g, '')
          .replace(/\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?/g, '')
          .replace(/\s{2,}/g, ' ')
          .trim();
      }
      if (r >= 6) next[r][c] = '';
    }
  }
  return next;
}

function loadWeeklyOneDayTemplateSheet(): TemplateSheetGrid {
  const wb = getWeeklyOneDayTemplateWorkbook();
  const sheetName = wb.SheetNames.find((s) => s.toLowerCase() === 'bc') || wb.SheetNames[0];
  if (!sheetName) throw new Error('Không tìm thấy sheet BC trong mẫu công 1 tuần');
  const grid = sheetToTemplateGrid(wb, sheetName);
  return { ...grid, rows: blankWeeklyOneDayRows(grid.rows) };
}

let dailyWageTemplateCache: { workbook: XLSX.WorkBook; loadedAt: number } | null = null;

function resolveDailyWageTemplatePath(): string {
  const roots = [
    path.resolve(process.cwd(), 'New folder'),
    path.resolve(process.cwd(), '..', 'New folder'),
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const match = fs.readdirSync(root).find((n) =>
      n.toLowerCase().includes('t1.02') && n.toLowerCase().endsWith('.xlsx') && !n.startsWith('~$')
    );
    if (match) return path.join(root, match);
  }
  throw new Error('Không tìm thấy file mẫu báo cáo tiền công hàng ngày T1.02');
}

function getDailyWageTemplateWorkbook(): XLSX.WorkBook {
  if (dailyWageTemplateCache) return dailyWageTemplateCache.workbook;
  const filePath = resolveDailyWageTemplatePath();
  const workbook = XLSX.readFile(filePath, { cellStyles: true, cellNF: true });
  dailyWageTemplateCache = { workbook, loadedAt: Date.now() };
  return workbook;
}

function blankDailyWageRows(rows: (string | number)[][]): (string | number)[][] {
  const next = rows.map((r) => [...r]);
  for (let r = 0; r < next.length; r++) {
    for (let c = 0; c < next[r].length; c++) {
      if (r >= 3 && c >= 2) next[r][c] = '';
    }
  }
  return next;
}

function loadDailyWageTemplateSheet(): TemplateSheetGrid {
  const wb = getDailyWageTemplateWorkbook();
  const sheetName =
    wb.SheetNames.find((s) => s.toLowerCase().includes('tổng') || s.toLowerCase().includes('tong')) ||
    wb.SheetNames.find((s) => wb.Sheets[s]?.['!ref']) ||
    wb.SheetNames[0];
  if (!sheetName) throw new Error('Không tìm thấy sheet mẫu báo cáo tiền công');
  const grid = sheetToTemplateGrid(wb, sheetName);
  return { ...grid, rows: blankDailyWageRows(grid.rows) };
}

let laborRateTemplateCache: { workbook: XLSX.WorkBook; loadedAt: number } | null = null;

function resolveLaborRateTemplatePath(): string {
  const roots = [
    path.resolve(process.cwd(), 'New folder'),
    path.resolve(process.cwd(), '..', 'New folder'),
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const match = fs.readdirSync(root).find((n) =>
      n.toLowerCase().includes('ti le cc nhan luc') && n.toLowerCase().endsWith('.xlsx') && !n.startsWith('~$')
    );
    if (match) return path.join(root, match);
  }
  throw new Error('Không tìm thấy file mẫu tỷ lệ nhân lực');
}

function getLaborRateTemplateWorkbook(): XLSX.WorkBook {
  if (laborRateTemplateCache) return laborRateTemplateCache.workbook;
  const filePath = resolveLaborRateTemplatePath();
  const workbook = XLSX.readFile(filePath, { cellStyles: true, cellNF: true });
  laborRateTemplateCache = { workbook, loadedAt: Date.now() };
  return workbook;
}

function blankLaborRateMainRows(rows: (string | number)[][]): (string | number)[][] {
  const next = rows.map((r) => [...r]);
  const dateRegex = /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}-[A-Za-z]{3})$/;
  const numericLikeRegex = /^[\d\s.,%/-]+$/;
  for (let r = 0; r < next.length; r++) {
    for (let c = 0; c < next[r].length; c++) {
      const cell = next[r][c];
      if (typeof cell === 'string' && dateRegex.test(cell.trim())) {
        next[r][c] = '';
      }
      if (typeof cell === 'number' && r >= 7) {
        next[r][c] = '';
      }
      if (typeof cell === 'string' && r >= 7 && numericLikeRegex.test(cell.trim())) {
        next[r][c] = '';
      }
      if (r >= 7 && c >= 0) {
        next[r][c] = '';
      }
    }
  }
  return next;
}

function blankLaborRateDetailRows(rows: (string | number)[][]): (string | number)[][] {
  const next = rows.map((r) => [...r]);
  const dateRegex = /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}-[A-Za-z]{3})$/;
  const numericLikeRegex = /^[\d\s.,%/-]+$/;
  for (let r = 0; r < next.length; r++) {
    for (let c = 0; c < next[r].length; c++) {
      const cell = next[r][c];
      if (typeof cell === 'string' && dateRegex.test(cell.trim())) {
        next[r][c] = '';
      }
      if (typeof cell === 'number' && r >= 3) {
        next[r][c] = '';
      }
      if (typeof cell === 'string' && r >= 3 && numericLikeRegex.test(cell.trim())) {
        next[r][c] = '';
      }
      if ((r >= 3 && r <= 14) || r >= 18) {
        next[r][c] = '';
      }
    }
  }
  return next;
}

function loadLaborRateTemplateSheets(): TemplateSheetGrid[] {
  const wb = getLaborRateTemplateWorkbook();
  const mainName =
    wb.SheetNames.find((s) => s.toLowerCase() === 'bc') ||
    wb.SheetNames.find((s) => s.toLowerCase().includes('bc')) ||
    wb.SheetNames.find((s) => wb.Sheets[s]?.['!ref']) ||
    wb.SheetNames[0];
  if (!mainName) throw new Error('Không tìm thấy sheet chính mẫu tỷ lệ nhân lực');
  const detailName =
    wb.SheetNames.find((s) => s.toLowerCase().includes('sheet3')) ||
    wb.SheetNames.find((s) => s !== mainName && !!wb.Sheets[s]?.['!ref']);

  const mainGrid = sheetToTemplateGrid(wb, mainName);
  const sheets: TemplateSheetGrid[] = [{ ...mainGrid, rows: blankLaborRateMainRows(mainGrid.rows) }];

  if (detailName) {
    const detailGrid = sheetToTemplateGrid(wb, detailName);
    sheets.push({ ...detailGrid, rows: blankLaborRateDetailRows(detailGrid.rows) });
  }
  return sheets;
}

let bhxhListTemplateCache: { workbook: XLSX.WorkBook; loadedAt: number } | null = null;

function resolveBhxhListTemplatePath(): string {
  const roots = [
    path.resolve(process.cwd(), 'New folder'),
    path.resolve(process.cwd(), '..', 'New folder'),
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const match = fs.readdirSync(root).find((n) =>
      n.toLowerCase().includes('tham gia bhxh') && n.toLowerCase().endsWith('.xlsx') && !n.startsWith('~$')
    );
    if (match) return path.join(root, match);
  }
  throw new Error('Không tìm thấy file mẫu danh sách tham gia BHXH');
}

function getBhxhListTemplateWorkbook(): XLSX.WorkBook {
  if (bhxhListTemplateCache) return bhxhListTemplateCache.workbook;
  const filePath = resolveBhxhListTemplatePath();
  const workbook = XLSX.readFile(filePath, { cellStyles: true, cellNF: true });
  bhxhListTemplateCache = { workbook, loadedAt: Date.now() };
  return workbook;
}

function blankBhxhListRows(rows: (string | number)[][]): (string | number)[][] {
  const next = rows.map((r) => [...r]);
  const dateRegex = /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}-[A-Za-z]{3})$/;
  for (let r = 0; r < next.length; r++) {
    for (let c = 0; c < next[r].length; c++) {
      const cell = next[r][c];
      if (typeof cell === 'string' && dateRegex.test(cell.trim())) {
        next[r][c] = '';
      }
      if (r >= 4) {
        next[r][c] = '';
      }
    }
  }
  return next;
}

async function loadBhxhListTemplateSheet(): Promise<TemplateSheetGrid> {
  const filePath = resolveBhxhListTemplatePath();
  const wb = getBhxhListTemplateWorkbook();
  const sheetName =
    wb.SheetNames.find((s) => s.toLowerCase().includes('tháng') || s.toLowerCase().includes('thang')) ||
    wb.SheetNames.find((s) => wb.Sheets[s]?.['!ref']) ||
    wb.SheetNames[0];
  if (!sheetName) throw new Error('Không tìm thấy sheet mẫu danh sách tham gia BHXH');
  const grid = await sheetToStyledTemplateGrid(wb, sheetName, filePath);
  return { ...grid, rows: blankBhxhListRows(grid.rows) };
}

let drugInventoryTemplateCache: { workbook: XLSX.WorkBook; loadedAt: number } | null = null;

function resolveDrugInventoryTemplatePath(): string {
  const roots = [
    path.resolve(process.cwd(), 'New folder'),
    path.resolve(process.cwd(), '..', 'New folder'),
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const match = fs.readdirSync(root).find(
      (n) =>
        (n.includes('THUỐC') || n.toLowerCase().includes('thuoc')) &&
        (n.includes('XUẤT') || n.includes('XUAT') || n.toLowerCase().includes('xuat')) &&
        n.endsWith('.xlsx') &&
        !n.startsWith('~$')
    );
    if (match) return path.join(root, match);
  }
  throw new Error('Không tìm thấy file mẫu xuất nhập tồn thuốc');
}

function getDrugInventoryTemplateWorkbook(): XLSX.WorkBook {
  if (drugInventoryTemplateCache) return drugInventoryTemplateCache.workbook;
  const filePath = resolveDrugInventoryTemplatePath();
  const workbook = XLSX.readFile(filePath, { cellStyles: true, cellNF: true });
  drugInventoryTemplateCache = { workbook, loadedAt: Date.now() };
  return workbook;
}

function blankDrugInventoryRows(rows: (string | number)[][]): (string | number)[][] {
  const next = rows.map((r) => [...r]);
  // Giữ đúng 4 dòng tiêu đề như Google Sheet: title, trống, header (TT, Tên Vật Tư...), sub-header (Tồn đầu kỳ, Nhập xuất, 1..31).
  // File Excel mẫu có thể có thêm dòng trống trên đầu → tìm hàng chứa "Tồn đầu kỳ" hoặc "Nhập xuất" làm hàng header cuối, xóa từ hàng sau nó.
  let lastHeaderRow = -1;
  for (let r = 0; r < next.length; r++) {
    const rowText = next[r].map((v) => String(v ?? '').trim()).join(' ');
    if (/Tồn đầu kỳ|Nhập xuất|Tên Vật Tư|Ảnh Minh Họa|Công Dụng|Hạn Sử/.test(rowText) || (r <= 3 && /TT|Đơn vị|Số lượng|Tổng|Tồn cuối/.test(rowText))) {
      lastHeaderRow = r;
    }
  }
  const clearFrom = lastHeaderRow >= 0 ? lastHeaderRow + 1 : 4;
  for (let r = 0; r < next.length; r++) {
    for (let c = 0; c < next[r].length; c++) {
      if (r >= clearFrom) {
        next[r][c] = '';
        continue;
      }
      if (r < clearFrom && typeof next[r][c] === 'number' && (next[r][c] as number) > 31) next[r][c] = '';
    }
  }
  return next;
}

async function loadDrugInventoryTemplateSheet(): Promise<TemplateSheetGrid> {
  const filePath = resolveDrugInventoryTemplatePath();
  const wb = getDrugInventoryTemplateWorkbook();
  const sheetName =
    wb.SheetNames.find((s) => /thang\s*\d|tháng\s*\d|sheet1/i.test(s) && wb.Sheets[s]?.['!ref']) ||
    wb.SheetNames.find((s) => wb.Sheets[s]?.['!ref']) ||
    wb.SheetNames[0];
  if (!sheetName) throw new Error('Không tìm thấy sheet mẫu xuất nhập tồn thuốc');
  const grid = await sheetToStyledTemplateGrid(wb, sheetName, filePath);
  return { ...grid, rows: blankDrugInventoryRows(grid.rows) };
}

let medicalRoomUsageTemplateCache: { workbook: XLSX.WorkBook; loadedAt: number } | null = null;

function resolveMedicalRoomUsageTemplatePath(): string {
  const roots = [
    path.resolve(process.cwd(), 'New folder'),
    path.resolve(process.cwd(), '..', 'New folder'),
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const match = fs.readdirSync(root).find(
      (n) =>
        (n.toLowerCase().includes('phòng yte') || n.toLowerCase().includes('phong yte')) &&
        (n.toLowerCase().includes('hiện trạng') || n.toLowerCase().includes('hien trang')) &&
        n.endsWith('.xlsx') &&
        !n.startsWith('~$')
    );
    if (match) return path.join(root, match);
  }
  throw new Error('Không tìm thấy file mẫu BC hiện trạng sử dụng phòng y tế');
}

function getMedicalRoomUsageTemplateWorkbook(): XLSX.WorkBook {
  if (medicalRoomUsageTemplateCache) return medicalRoomUsageTemplateCache.workbook;
  const filePath = resolveMedicalRoomUsageTemplatePath();
  const workbook = XLSX.readFile(filePath, { cellStyles: true, cellNF: true });
  medicalRoomUsageTemplateCache = { workbook, loadedAt: Date.now() };
  return workbook;
}

function blankMedicalRoomUsageRows(rows: (string | number)[][]): (string | number)[][] {
  const next = rows.map((r) => [...r]);
  for (let r = 0; r < next.length; r++) {
    for (let c = 0; c < next[r].length; c++) {
      if (r < 4) {
        if (typeof next[r][c] === 'number') next[r][c] = '';
      } else {
        next[r][c] = '';
      }
    }
  }
  return next;
}

async function loadMedicalRoomUsageTemplateSheet(): Promise<TemplateSheetGrid> {
  const filePath = resolveMedicalRoomUsageTemplatePath();
  const wb = getMedicalRoomUsageTemplateWorkbook();
  const sheetName =
    wb.SheetNames.find((s) => s === 'BC' && wb.Sheets[s]?.['!ref']) ||
    wb.SheetNames.find((s) => /phong|y\s*te|hiện\s*trạng|hien\s*trang|báo\s*cáo/i.test(s) && wb.Sheets[s]?.['!ref']) ||
    wb.SheetNames.find((s) => wb.Sheets[s]?.['!ref']) ||
    wb.SheetNames[0];
  if (!sheetName) throw new Error('Không tìm thấy sheet mẫu phòng y tế');
  const grid = await sheetToStyledTemplateGrid(wb, sheetName, filePath);
  return { ...grid, rows: blankMedicalRoomUsageRows(grid.rows) };
}

let arrearsCollectionTemplateCache: { workbook: XLSX.WorkBook; loadedAt: number } | null = null;

function resolveArrearsCollectionTemplatePath(): string {
  const roots = [
    path.resolve(process.cwd(), 'New folder'),
    path.resolve(process.cwd(), '..', 'New folder'),
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const match = fs.readdirSync(root).find(
      (n) =>
        n.toLowerCase().includes('truy thu') &&
        n.toLowerCase().includes('mẫu') &&
        n.endsWith('.xlsx') &&
        !n.startsWith('~$')
    );
    if (match) return path.join(root, match);
  }
  throw new Error('Không tìm thấy file mẫu truy thu (TRUY THU MẪU -.xlsx)');
}

function getArrearsCollectionTemplateWorkbook(): XLSX.WorkBook {
  if (arrearsCollectionTemplateCache) return arrearsCollectionTemplateCache.workbook;
  const filePath = resolveArrearsCollectionTemplatePath();
  const workbook = XLSX.readFile(filePath, { cellStyles: true, cellNF: true });
  arrearsCollectionTemplateCache = { workbook, loadedAt: Date.now() };
  return workbook;
}

function blankArrearsCollectionRows(rows: (string | number)[][]): (string | number)[][] {
  const next = rows.map((r) => [...r]);
  const dateLike = /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$|\d{4}년\s*\d{1,2}월/;
  const codeLike = /^\d{8,12}[A-Z]{2,4}$/i;
  const amountLike = /^[\d.,\s]+$/;
  const isStructuralRow = (r: number) => {
    const row = next[r];
    if (!row || row.length === 0) return true;
    const a0 = String(row[0] ?? '').trim();
    const a1 = String(row[1] ?? '').trim();
    if (/^TRUY THU|의료|보험/.test(a0)) return true;
    if (/^STT$|^MÃ|HỌ TÊN|SỐ SỔ|BỘ PHẬN|NGÀY SINH|NGÀY NGHỈ|SỐ TIỀN/i.test(a0) || /^MÃ|HỌ TÊN/i.test(a1)) return true;
    if (a0 === 'TỔNG') return true;
    if (/^NGƯỜI LẬP|KIỂM TRA|TRƯỞNG|DUYỆT$/i.test(a0)) return true;
    return false;
  };
  for (let r = 0; r < next.length; r++) {
    const structural = isStructuralRow(r);
    for (let c = 0; c < next[r].length; c++) {
      const v = next[r][c];
      if (structural) {
        if (typeof v === 'number' && c > 0) next[r][c] = '';
        continue;
      }
      if (typeof v === 'number') {
        if (c === 0 && v >= 1 && v <= 20) continue;
        next[r][c] = '';
        continue;
      }
      const s = String(v).trim();
      if (s === '' || s === '-') continue;
      if (c === 0 && /^\d{1,2}$/.test(s)) continue;
      if (c >= 1 && c <= 7) {
        next[r][c] = '';
        continue;
      }
      if (/^(STT|MÃ|HỌ TÊN|SỐ SỐ|SỐ SỔ|BỘ PHẬN|NGÀY SINH|NGÀY NGHỈ|SỐ TIỀN|TỔNG|TRUY THU|NGƯỜI LẬP|KIỂM TRA|TRƯỞNG|DUYỆT)/i.test(s)) continue;
      if (/의료|보험|공제|년|월/.test(s)) continue;
      if (dateLike.test(s) || codeLike.test(s)) next[r][c] = '';
      else if (s.length > 2 && amountLike.test(s.replace(/\s/g, ''))) next[r][c] = '';
    }
  }
  return next;
}

async function loadArrearsCollectionTemplateSheet(): Promise<TemplateSheetGrid> {
  const filePath = resolveArrearsCollectionTemplatePath();
  const wb = getArrearsCollectionTemplateWorkbook();
  const sheetName =
    wb.SheetNames.find((s) => wb.Sheets[s]?.['!ref']) || wb.SheetNames[0];
  if (!sheetName) throw new Error('Không tìm thấy sheet mẫu truy thu');
  const grid = await sheetToStyledTemplateGrid(wb, sheetName, filePath);
  return { ...grid, rows: blankArrearsCollectionRows(grid.rows) };
}

let payrollKpiTemplateCache: { workbook: XLSX.WorkBook; loadedAt: number } | null = null;

function resolvePayrollKpiTemplatePath(): string {
  const roots = [
    path.resolve(process.cwd(), 'New folder'),
    path.resolve(process.cwd(), '..', 'New folder'),
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const match = fs.readdirSync(root).find(
      (n) => n.toLowerCase().includes('kpi') && n.toLowerCase().endsWith('.xlsx') && !n.startsWith('~$')
    );
    if (match) return path.join(root, match);
  }
  throw new Error('Không tìm thấy file mẫu KPI (01 월 전체 직원 급여 mẫu KPI.xlsx)');
}

function getPayrollKpiTemplateWorkbook(): XLSX.WorkBook {
  if (payrollKpiTemplateCache) return payrollKpiTemplateCache.workbook;
  const filePath = resolvePayrollKpiTemplatePath();
  const workbook = XLSX.readFile(filePath, { cellStyles: true, cellNF: true });
  payrollKpiTemplateCache = { workbook, loadedAt: Date.now() };
  return workbook;
}

function blankPayrollKpiIngunbiRows(rows: (string | number)[][]): (string | number)[][] {
  const next = rows.map((r) => [...r]);
  const numLike = /^[\d.,%\s\-]+$/;
  for (let r = 0; r < next.length; r++) {
    for (let c = 0; c < next[r].length; c++) {
      const cell = next[r][c];
      if (r === 0) {
        if (typeof cell === 'number' || (typeof cell === 'string' && (numLike.test(String(cell).trim()) || String(cell).trim() === '-' || String(cell).trim() === ' - '))) {
          next[r][c] = '';
        }
      } else if (r === 1) {
        next[r][c] = '';
      } else if (r >= 3 && c >= 2) {
        next[r][c] = '';
      } else if (r >= 13) {
        next[r][c] = '';
      }
    }
  }
  return next;
}

function blankPayrollKpiJonghabRows(rows: (string | number)[][]): (string | number)[][] {
  const next = rows.map((r) => [...r]);
  for (let r = 0; r < next.length; r++) {
    for (let c = 0; c < next[r].length; c++) {
      if (r >= 22 && c >= 3) next[r][c] = '';
      else if (r >= 21 && c >= 4) {
        const cell = next[r][c];
        if (typeof cell === 'number') next[r][c] = '';
        else if (typeof cell === 'string' && /^[\d.,%\s\-]+$/.test(cell.trim())) next[r][c] = '';
      }
    }
  }
  return next;
}

function loadPayrollKpiTemplateSheets(): TemplateSheetGrid[] {
  const wb = getPayrollKpiTemplateWorkbook();
  const ingunbiName = wb.SheetNames.find((s) => s === '인건비 현황' || s.includes('인건비'));
  const jonghabName = wb.SheetNames.find((s) => s === '종합 급여 현황' || s.includes('종합'));
  if (!ingunbiName || !wb.Sheets[ingunbiName]?.['!ref']) {
    throw new Error('Không tìm thấy sheet 인건비 현황 trong file mẫu KPI');
  }
  if (!jonghabName || !wb.Sheets[jonghabName]?.['!ref']) {
    throw new Error('Không tìm thấy sheet 종합 급여 현황 trong file mẫu KPI');
  }
  const ingunbi = sheetToTemplateGrid(wb, ingunbiName);
  const jonghab = sheetToTemplateGrid(wb, jonghabName);
  return [
    { ...ingunbi, rows: blankPayrollKpiIngunbiRows(ingunbi.rows) },
    { ...jonghab, rows: blankPayrollKpiJonghabRows(jonghab.rows) },
  ];
}

async function buildTempTimesheetFromSystem(
  start_date: string,
  end_date: string
): Promise<TemplateSheetGrid[]> {
  const range = await resolveReportRange(start_date, end_date);
  const [employeesAll, records, seasonalStoreRows] = await Promise.all([
    loadEmployeesLite(),
    loadTimekeepingLite(range.start, range.end),
    loadEmployeeStoreRows('seasonal'),
  ]);

  const seasonalEmployees = employeesAll.filter((emp) => isSeasonalEmployee(emp.employment_type));
  const aggregates = buildEmployeeAggregates(seasonalEmployees, records);
  const storeMap = buildStoreRowMap(seasonalStoreRows);
  const includeFallbackRecords = seasonalEmployees.length === 0;

  const dayPeople = Array.from({ length: DAY_COLS }, () => new Set<string>());
  const dayWorkday = Array(DAY_COLS).fill(0);
  const dayHours = Array(DAY_COLS).fill(0);
  const dayOt = Array(DAY_COLS).fill(0);

  for (const record of records) {
    const code = resolveRecordCode(record);
    const agg = aggregates.get(code);
    if (!agg) continue;
    if (!includeFallbackRecords && !isSeasonalEmployee(agg.employment_type)) continue;

    const day = parseInt(String(record.date || '').slice(8, 10), 10);
    if (day < 1 || day > DAY_COLS) continue;
    dayPeople[day - 1].add(code);
    dayWorkday[day - 1] += Number(record.workday) || 0;
    dayHours[day - 1] += getHours(record);
    dayOt[day - 1] += Number(record.overtime_hours) || 0;
  }

  const summary = buildMonthOverviewSheet(
    `TỔNG QUAN CÔNG THỜI VỤ (${range.monthLabel})`,
    `Tự động từ dữ liệu chấm công | Khoảng ${range.start} → ${range.end}`,
    [
      {
        group: 'Thời vụ',
        metric: 'Số NV đi làm',
        values: dayPeople.map((set) => set.size),
        summary: dayPeople.reduce((sum, set) => sum + set.size, 0),
        note: 'Người/ngày',
      },
      {
        group: 'Thời vụ',
        metric: 'Tổng công',
        values: dayWorkday,
        summary: toFixed1(dayWorkday.reduce((sum, value) => sum + value, 0)),
        note: 'Công',
      },
      {
        group: 'Thời vụ',
        metric: 'Tổng giờ công',
        values: dayHours,
        summary: toFixed1(dayHours.reduce((sum, value) => sum + value, 0)),
        note: 'Giờ',
      },
      {
        group: 'Thời vụ',
        metric: 'OT',
        values: dayOt,
        summary: toFixed1(dayOt.reduce((sum, value) => sum + value, 0)),
        note: 'Giờ',
      },
    ]
  );

  const activeRows = [...aggregates.values()]
    .filter((agg) => (includeFallbackRecords || isSeasonalEmployee(agg.employment_type)) && (agg.totalHours > 0 || agg.totalWorkday > 0))
    .sort(sortAggregates);

  const detailRows =
    activeRows.length > 0
      ? activeRows.map((agg, index) => {
          const storeRow = storeMap.get(agg.employee_code);
          const startDateValue =
            parseLooseDate(
              getRowValueByHeader(storeRow, [
                ['ngay vao'],
                ['ngay bat dau'],
                ['ngay nhan viec'],
                ['ngay ky hd'],
                ['tu ngay'],
                ['start'],
              ])
            ) || parseLooseDate(agg.created_at);
          const endDateValue = parseLooseDate(
            getRowValueByHeader(storeRow, [['ngay ket thuc'], ['ngay het han'], ['den ngay'], ['end']])
          );
          const birthdayValue =
            parseLooseDate(getRowValueByHeader(storeRow, [['ngay sinh']])) ||
            parseLooseDate(agg.date_of_birth);
          return [
            index + 1,
            agg.employee_code,
            agg.employee_code,
            agg.name,
            agg.department,
            startDateValue,
            endDateValue,
            birthdayValue,
            ...Array.from({ length: DAY_COLS }, (_, i) =>
              agg.dayWorkdays[i] > 0 ? toFixed1(agg.dayWorkdays[i]) : ''
            ),
            toFixed1(agg.totalWorkday),
            toFixed1(agg.totalHours),
            toFixed1(agg.overtimeHours),
          '',
          '',
          ];
        })
      : [['(Chưa có dữ liệu thời vụ trong khoảng đã chọn)']];

  return [
    {
      name: 'Tổng quan tháng',
      rows: summary.rows,
      merges: summary.merges,
      rowStyles: summary.rowStyles,
      cellStyles: summary.cellStyles,
      colWidths: summary.colWidths,
    },
    buildSimpleTableSheet({
      name: 'Data',
      title: `BẢNG CHẤM CÔNG THỜI VỤ (${range.monthLabel})`,
      subtitle: `Tự động từ chấm công + danh sách nhân viên | ${range.start} → ${range.end}`,
      headers: [
        'STT',
        'Mã NV',
        'ID Mới',
        'Họ tên',
        'BP',
        'Ngày vào',
        'Ngày hết hạn',
        'Ngày sinh',
        ...Array.from({ length: DAY_COLS }, (_, i) => i + 1),
        'Tổng công',
        'Tổng giờ',
        'OT',
        'Nghỉ có phép',
        'Nghỉ ko phép',
      ],
      dataRows: detailRows,
      dayStartCol: 8,
    }),
  ];
}

async function buildOfficialTimesheetFromSystem(
  start_date: string,
  end_date: string
): Promise<TemplateSheetGrid[]> {
  const range = await resolveReportRange(start_date, end_date);
  const [employeesAll, records] = await Promise.all([
    loadEmployeesLite(),
    loadTimekeepingLite(range.start, range.end),
  ]);

  const officialEmployees = employeesAll.filter((emp) => isOfficialEmployee(emp.employment_type));
  const aggregates = buildEmployeeAggregates(officialEmployees, records);
  const includeFallbackRecords = officialEmployees.length === 0;

  const dayPeople = Array.from({ length: DAY_COLS }, () => new Set<string>());
  const dayWorkday = Array(DAY_COLS).fill(0);
  const dayHours = Array(DAY_COLS).fill(0);
  const dayPaidHours = Array(DAY_COLS).fill(0);

  for (const record of records) {
    const code = resolveRecordCode(record);
    const agg = aggregates.get(code);
    if (!agg) continue;
    if (!includeFallbackRecords && !isOfficialEmployee(agg.employment_type)) continue;

    const day = parseInt(String(record.date || '').slice(8, 10), 10);
    if (day < 1 || day > DAY_COLS) continue;
    const hours = getHours(record);
    const overtime = Number(record.overtime_hours) || 0;
    dayPeople[day - 1].add(code);
    dayWorkday[day - 1] += Number(record.workday) || 0;
    dayHours[day - 1] += hours;
    dayPaidHours[day - 1] += hours + overtime;
  }

  const summary = buildMonthOverviewSheet(
    `TỔNG QUAN CÔNG CHÍNH THỨC (${range.monthLabel})`,
    `Tự động từ dữ liệu chấm công | Khoảng ${range.start} → ${range.end}`,
    [
      {
        group: 'Chính thức',
        metric: 'Số NV đi làm',
        values: dayPeople.map((set) => set.size),
        summary: dayPeople.reduce((sum, set) => sum + set.size, 0),
        note: 'Người/ngày',
      },
      {
        group: 'Chính thức',
        metric: 'Tổng công',
        values: dayWorkday,
        summary: toFixed1(dayWorkday.reduce((sum, value) => sum + value, 0)),
        note: 'Công',
      },
      {
        group: 'Chính thức',
        metric: 'Tổng giờ công',
        values: dayHours,
        summary: toFixed1(dayHours.reduce((sum, value) => sum + value, 0)),
        note: 'Giờ',
      },
      {
        group: 'Chính thức',
        metric: 'Total tính lương',
        values: dayPaidHours,
        summary: toFixed1(dayPaidHours.reduce((sum, value) => sum + value, 0)),
        note: 'Giờ',
      },
    ]
  );

  const activeRows = [...aggregates.values()]
    .filter((agg) => (includeFallbackRecords || isOfficialEmployee(agg.employment_type)) && (agg.totalHours > 0 || agg.totalWorkday > 0))
    .sort(sortAggregates);

  const detailRows =
    activeRows.length > 0
      ? activeRows.map((agg, index) => [
          index + 1,
          agg.employee_code,
          agg.name,
          agg.department,
          ...Array.from({ length: DAY_COLS }, (_, i) =>
            agg.dayWorkdays[i] > 0 ? toFixed1(agg.dayWorkdays[i]) : ''
          ),
          toFixed1(agg.totalWorkday),
          toFixed1(agg.totalHours),
          toFixed1(agg.totalHours + agg.overtimeHours),
          toFixed1(agg.overtimeHours),
        ])
      : [['(Chưa có dữ liệu chính thức trong khoảng đã chọn)']];

  return [
    {
      name: 'Tổng quan tháng',
      rows: summary.rows,
      merges: summary.merges,
      rowStyles: summary.rowStyles,
      cellStyles: summary.cellStyles,
      colWidths: summary.colWidths,
    },
    buildSimpleTableSheet({
      name: 'Attendance list',
      title: `BẢNG CHẤM CÔNG CHÍNH THỨC (${range.monthLabel})`,
      subtitle: `Tự động từ chấm công | ${range.start} → ${range.end}`,
      headers: [
        'STT',
        'Mã NV',
        'Họ tên',
        'BP',
        ...Array.from({ length: DAY_COLS }, (_, i) => i + 1),
        'Tổng công',
        'Tổng giờ công',
        'Total tính lương',
        'OT',
      ],
      dataRows: detailRows,
      dayStartCol: 4,
    }),
  ];
}

/** Khối số liệu một ca (ca ngày / ca đêm) — khớp hàng trong báo cáo Excel TT SX. */
type AttendanceCountShiftProductionBlock = {
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

type AttendanceCountProductionSnapshot = {
  /** Ngày cuối trong kỳ gộp (mốc DS). */
  snapshotDate: string;
  /** Ngày đầu / cuối thực tế được cộng dồn (theo bộ lọc, không vượt quá hôm nay). */
  aggregationStart: string;
  aggregationEnd: string;
  /** Số ngày cộng dồn (đi làm / nghỉ = tổng lượt; mẫu số tỉ lệ = nhân lực × số ngày). */
  aggregationDays: number;
  monthYm: string;
  note?: string;
  day: AttendanceCountShiftProductionBlock;
  night: AttendanceCountShiftProductionBlock;
};

/** Lấy text ca từ nhiều kiểu tên cột file Excel. */
function pickShiftRawFromStoreRow(row: Record<string, unknown>): string {
  const headerGroups: string[][] = [
    ['ca lam viec'],
    ['ca làm việc'],
    ['ca lam'],
    ['ca làm'],
    ['loai ca'],
    ['loại ca'],
    ['ten ca'],
    ['tên ca'],
    ['ca chinh'],
    ['ca chính'],
    ['phan cong ca'],
    ['phan ca'],
    ['shift'],
    ['gio ca'],
    ['giờ ca'],
  ];
  for (const g of headerGroups) {
    const v = getRowValueByHeader(row, [g]);
    if (String(v ?? '').trim()) return String(v).trim();
  }
  for (const [k, v] of Object.entries(row)) {
    const nk = normalizeTextValue(k);
    if (!/\bca\b|shift|lam\s*viec|lamviec|phan\s*ca|loai\s*ca|ten\s*ca/.test(nk)) continue;
    const sv = String(v ?? '').trim();
    if (!sv || sv.length > 80) continue;
    if (parseRosterMainShift(sv)) return sv;
  }
  return '';
}

function isIndirectAttendanceCountRow(row: Record<string, unknown>): boolean {
  const job = normalizeTextValue(
    getRowValueByHeader(row, [['chuc vu'], ['chức vụ'], ['chuc danh'], ['chức danh']])
  );
  const line = normalizeTextValue(getRowValueByHeader(row, [['line'], ['to'], ['tổ']]));
  const t = ` ${job} ${line} `;
  return /to\s*truong|tổ\s*trưởng|doi\s*truong|đội\s*trưởng|\btransfer\b|\bkitting\b|ke\s*chang|kechang|pho\s*phong|phó\s*phòng|giam\s*doc|giám\s*đốc/i.test(
    t
  );
}

/**
 * TT sản xuất (hàng SX trong báo cáo Excel): phải biết BP/phòng/tổ hoặc phòng trên hệ thống.
 * Trước đây `!bp && !dept → true` khiến cả nghìn dòng TV thiếu cột bộ phận vẫn vào nhân lực → lệch Excel.
 */
function isProductionDirectLaborRow(row: Record<string, unknown>, fallbackDept?: string | null): boolean {
  const bp = normalizeTextValue(getRowValueByHeader(row, [['bp'], ['bo phan'], ['bộ phận']]));
  const dept = normalizeTextValue(getRowValueByHeader(row, [['phong'], ['phòng'], ['phòng ban']]));
  const line = normalizeTextValue(getRowValueByHeader(row, [['line'], ['to'], ['tổ']]));
  let c = `${bp} ${dept} ${line}`.replace(/\s+/g, ' ').trim();
  if (!c) {
    c = normalizeTextValue(fallbackDept ?? '').replace(/\s+/g, ' ').trim();
  }
  if (!c) return false;
  if (
    /^h$|^h\s|hanh\s*chinh|ke\s*toan|nhan\s*su|nhân\s*sự|moi\s*truong|bao\s*tri|ky\s*thuat\s*don|kho\s*vat\s*tu|admin|office|van\s*phong|hc\b/i.test(
      c
    )
  ) {
    return false;
  }
  /** Khối gián tiếp / phi SX trong layout tổ chức (QL-EQM-HQ-QC-MM-SM…), khớp tinh thần cột SX Excel */
  if (
    /\b(qc|eqm|mm|sm|ql|hq)\b|quality|chất\s*lượng|kiểm\s*tra|chat\s*luong|materials?|vật\s*tư|vat\s*tu|warehouse|kho\b|mua\s*hàng|purchase|marketing|kinh\s*doanh|bán\s*hàng|ban\s*hang|office\s*admin|giám\s*sát\s*chất|품질|자재|영업|기술\s*\(eqm\)|관리\s*\(\s*ql|관리\s*\(\s*hq|제조\s*기술/i.test(
      c
    )
  ) {
    return false;
  }
  return true;
}

function parseHireYmdFromStoreRow(row: Record<string, unknown>): string {
  const hireRaw = getRowValueByHeader(row, [
    ['ngay vao'],
    ['ngay bat dau'],
    ['ngay nhan viec'],
    ['ngay ky hd'],
    ['tu ngay'],
  ]);
  return clampYmd(parseLooseDate(hireRaw));
}

function parseQuitYmdFromStoreRow(row: Record<string, unknown>): string {
  const raw = getRowValueByHeader(row, [
    ['ngay nghi'],
    ['ngày nghỉ'],
    ['ngay thoi viec'],
    ['ngày thôi việc'],
    ['ngay nghi viec'],
    ['den ngay'],
    ['đến ngày'],
  ]);
  return clampYmd(parseLooseDate(raw));
}

function activeRosterOnDate(hireYmd: string, quitYmd: string, d: string): boolean {
  if (hireYmd && hireYmd > d) return false;
  if (quitYmd && quitYmd < d) return false;
  return true;
}

/** CT hoặc TV; NV mới vẫn thuộc CT/TV, isNew chỉ để cột «Người mới» (theo hướng dẫn nhân sự). */
type RosterEmployment = 'official' | 'seasonal';

type RosterMeta = { shift: 'day' | 'night'; kind: RosterEmployment; isNew: boolean };

function buildProductionRosterByCode(
  officialRows: Record<string, unknown>[],
  seasonalRows: Record<string, unknown>[],
  snapshotDate: string,
  monthYm: string,
  byDateCode: Map<string, TimekeepingLite[]>,
  employeeMap: Map<string, EmployeeLite>
): {
  byCode: Map<string, RosterMeta>;
  inferredFromTk: number;
  defaultedShiftDay: number;
} {
  const byCode = new Map<string, RosterMeta>();
  let inferredFromTk = 0;
  let defaultedShiftDay = 0;

  const ingest = (rows: Record<string, unknown>[], employment: 'official' | 'seasonal') => {
    for (const row of rows) {
      const code = extractEmployeeCodeFromStoreRow(row);
      if (!code) continue;
      if (isIndirectAttendanceCountRow(row)) continue;
      const empDept = employeeMap.get(code)?.department ?? null;
      if (!isProductionDirectLaborRow(row, empDept)) continue;
      const hireYmd = parseHireYmdFromStoreRow(row);
      const quitYmd = parseQuitYmdFromStoreRow(row);
      if (!activeRosterOnDate(hireYmd, quitYmd, snapshotDate)) continue;
      const shiftRaw = pickShiftRawFromStoreRow(row);
      let shift = parseRosterMainShift(shiftRaw);
      if (!shift) {
        const tk = byDateCode.get(`${snapshotDate}\t${code}`);
        if (tk?.length) {
          shift = inferAttendanceCountShiftBucket(tk);
          inferredFromTk += 1;
        }
      }
      if (!shift) {
        shift = 'day';
        defaultedShiftDay += 1;
      }
      const isNew = !!(hireYmd && hireYmd.slice(0, 7) === monthYm);
      const kind: RosterEmployment = employment === 'seasonal' ? 'seasonal' : 'official';
      byCode.set(code, { shift, kind, isNew });
    }
  };

  ingest(officialRows, 'official');
  ingest(seasonalRows, 'seasonal');
  return { byCode, inferredFromTk, defaultedShiftDay };
}

/** Khi không có DS sau lọc: gom NV có chấm công trong các ngày kỳ (mỗi mã, ngày sau ghi đè ca nếu trùng). */
function buildTkOnlyRosterForSnapshot(
  effectiveDates: string[],
  monthYm: string,
  byDateCode: Map<string, TimekeepingLite[]>,
  hireByCode: Map<string, string>,
  employeeMap: Map<string, EmployeeLite>
): Map<string, RosterMeta> {
  const map = new Map<string, RosterMeta>();
  for (const d of effectiveDates) {
    const prefix = `${d}\t`;
    for (const [key, group] of byDateCode) {
      if (!key.startsWith(prefix)) continue;
      const code = key.slice(prefix.length);
      if (!code) continue;
      const emp = employeeMap.get(code);
      if (emp) {
        const dept = normalizeTextValue(emp.department);
        if (/hanh\s*chinh|ke\s*toan|nhan\s*su|hc\b/i.test(dept)) continue;
      }
      const shift = inferAttendanceCountShiftBucket(group);
      const hireYmd = hireByCode.get(code) || '';
      const isNew = !!(hireYmd && hireYmd.slice(0, 7) === monthYm);
      const kind: RosterEmployment =
        emp && resolveEmploymentCategory(emp.employment_type, emp.department) === 'Thời vụ'
          ? 'seasonal'
          : emp
            ? 'official'
            : 'seasonal';
      map.set(code, { shift, kind, isNew });
    }
  }
  return map;
}

function rosterSetsForShift(
  byCode: Map<string, RosterMeta>,
  bucket: 'day' | 'night'
): { official: Set<string>; seasonal: Set<string>; neu: Set<string> } {
  const official = new Set<string>();
  const seasonal = new Set<string>();
  const neu = new Set<string>();
  for (const [code, meta] of byCode) {
    if (meta.shift !== bucket) continue;
    if (meta.kind === 'seasonal') seasonal.add(code);
    else official.add(code);
    if (meta.isNew) neu.add(code);
  }
  return { official, seasonal, neu };
}

/**
 * Đi làm theo ca trên DS: ưu tiên khớp suy từ cả cụm dòng chấm công; nếu có dòng có cột ca rõ (Ca1/Main D…)
 * thì khớp theo từng dòng; nếu cột ca trống nhưng có công → tính đi làm đúng ca DS (tránh lệch hàng nghìn «nghỉ vắng» giả).
 */
function recordPresentForRosterShift(
  group: TimekeepingLite[] | undefined,
  rosterBucket: 'day' | 'night'
): boolean {
  if (!group?.length) return false;
  if (inferAttendanceCountShiftBucket(group) === rosterBucket) return true;
  for (const r of group) {
    const cell = parseRosterMainShift(r.shift);
    if (cell === rosterBucket) return true;
    if (rosterBucket === 'night' && isNightShiftTk(r.shift)) return true;
  }
  const hasExplicitShift = group.some((r) => String(r.shift ?? '').trim() !== '');
  if (!hasExplicitShift) return true;
  return false;
}

function countPresentInShiftBucket(
  codes: Set<string>,
  snapshotDate: string,
  expectedBucket: 'day' | 'night',
  byDateCode: Map<string, TimekeepingLite[]>
): number {
  let n = 0;
  for (const code of codes) {
    const key = `${snapshotDate}\t${code}`;
    const group = byDateCode.get(key);
    if (!group?.length) continue;
    if (recordPresentForRosterShift(group, expectedBucket)) n += 1;
  }
  return n;
}

/**
 * Cột Người mới: chỉ thể hiện số. Đi làm / nghỉ / tỉ lệ: cộng dồn theo từng ngày trong `effectiveDates`
 * (tổng lượt); mẫu tỉ lệ = nhân lực × số ngày.
 */
function buildShiftProductionBlock(
  official: Set<string>,
  seasonal: Set<string>,
  neu: Set<string>,
  effectiveDates: string[],
  bucket: 'day' | 'night',
  byDateCode: Map<string, TimekeepingLite[]>
): AttendanceCountShiftProductionBlock {
  const ho = official.size;
  const hs = seasonal.size;
  const hn = neu.size;
  const nDays = Math.max(1, effectiveDates.length);
  let po = 0;
  let ps = 0;
  let pn = 0;
  for (const d of effectiveDates) {
    po += countPresentInShiftBucket(official, d, bucket, byDateCode);
    ps += countPresentInShiftBucket(seasonal, d, bucket, byDateCode);
    pn += countPresentInShiftBucket(neu, d, bucket, byDateCode);
  }
  const capO = ho * nDays;
  const capS = hs * nDays;
  return {
    headOfficial: ho,
    headSeasonal: hs,
    headNew: hn,
    presentOfficial: po,
    presentSeasonal: ps,
    presentNew: pn,
    absentOfficial: Math.max(0, capO - po),
    absentSeasonal: Math.max(0, capS - ps),
    rateOfficialPct: capO > 0 ? toFixed1((po / capO) * 100) : 0,
    rateSeasonalPct: capS > 0 ? toFixed1((ps / capS) * 100) : 0,
  };
}

function buildAttendanceCountProductionSnapshot(
  range: Awaited<ReturnType<typeof resolveReportRange>>,
  byDateCode: Map<string, TimekeepingLite[]>,
  officialRows: Record<string, unknown>[],
  seasonalRows: Record<string, unknown>[],
  hireByCode: Map<string, string>,
  employeeMap: Map<string, EmployeeLite>
): AttendanceCountProductionSnapshot {
  const effectiveDates = range.dates.filter((d) => d <= range.snapshotDate);
  const rosterAnchor = effectiveDates[effectiveDates.length - 1] || range.snapshotDate;
  const aggregationStart = effectiveDates[0] || range.snapshotDate;
  const aggregationEnd = rosterAnchor;
  const aggregationDays = Math.max(1, effectiveDates.length);
  const monthYm = rosterAnchor.slice(0, 7);

  let { byCode, inferredFromTk, defaultedShiftDay } = buildProductionRosterByCode(
    officialRows,
    seasonalRows,
    rosterAnchor,
    monthYm,
    byDateCode,
    employeeMap
  );

  const notes: string[] = [];
  notes.push(
    `Đang gộp ${aggregationDays} ngày (${aggregationStart} → ${aggregationEnd}): đi làm / nghỉ là tổng lượt các ngày trong bộ lọc (không quá hôm nay); tỉ lệ = đi làm ÷ (nhân lực × ${aggregationDays}).`
  );

  if (byCode.size === 0) {
    byCode = buildTkOnlyRosterForSnapshot(
      effectiveDates,
      monthYm,
      byDateCode,
      hireByCode,
      employeeMap
    );
    if (byCode.size === 0) {
      notes.push(
        'Không có nhân sự sau lọc: kiểm tra import DS CT/TV, cột mã NV, hoặc chấm công trong các ngày kỳ.'
      );
    } else {
      notes.push(
        'Không đọc được DS CT/TV sau lọc — nhân lực suy từ chấm công các ngày kỳ. Nên import DS đầy đủ để khớp Excel.'
      );
    }
  } else {
    if (inferredFromTk > 0) {
      notes.push(
        `${inferredFromTk} dòng DS: ca suy từ chấm công ngày ${rosterAnchor} (cột ca trên DS trống hoặc khác định dạng).`
      );
    }
    if (defaultedShiftDay > 0) {
      notes.push(
        `${defaultedShiftDay} dòng DS: không đọc được ca và không có chấm công ngày ${rosterAnchor} — tạm xếp ca ngày (nên sửa cột Ca: Main (D)/(N), Ca ngày/đêm, hoặc Ca 1/2).`
      );
    }
  }

  const daySets = rosterSetsForShift(byCode, 'day');
  const nightSets = rosterSetsForShift(byCode, 'night');

  const day = buildShiftProductionBlock(
    daySets.official,
    daySets.seasonal,
    daySets.neu,
    effectiveDates,
    'day',
    byDateCode
  );
  const night = buildShiftProductionBlock(
    nightSets.official,
    nightSets.seasonal,
    nightSets.neu,
    effectiveDates,
    'night',
    byDateCode
  );

  return {
    snapshotDate: rosterAnchor,
    aggregationStart,
    aggregationEnd,
    aggregationDays,
    monthYm,
    ...(notes.length ? { note: notes.join(' ') } : {}),
    day,
    night,
  };
}

async function buildAttendanceCountFromSystem(
  start_date: string,
  end_date: string
): Promise<{ sheets: TemplateSheetGrid[]; productionSnapshot: AttendanceCountProductionSnapshot }> {
  const range = await resolveReportRange(start_date, end_date);
  const [employeesAll, records, hireByCode, officialRows, seasonalRows] = await Promise.all([
    loadEmployeesLite(),
    loadTimekeepingLite(range.start, range.end),
    loadHireDateByCodeMap(),
    loadEmployeeStoreRows('official'),
    loadEmployeeStoreRows('seasonal'),
  ]);

  const employeeMap = new Map(
    employeesAll.map((emp) => [normalizeCode(emp.employee_code), emp] as const)
  );

  const officialDayByDay = Array.from({ length: DAY_COLS }, () => new Set<string>());
  const officialNightByDay = Array.from({ length: DAY_COLS }, () => new Set<string>());
  const seasonalDayByDay = Array.from({ length: DAY_COLS }, () => new Set<string>());
  const seasonalNightByDay = Array.from({ length: DAY_COLS }, () => new Set<string>());
  const totalByDay = Array.from({ length: DAY_COLS }, () => new Set<string>());
  const newEmployeesByDaySets = Array.from({ length: DAY_COLS }, () => new Set<string>());

  const byDateCode = new Map<string, TimekeepingLite[]>();
  for (const record of records) {
    const code = resolveRecordCode(record);
    const dateStr = String(record.date || '').slice(0, 10);
    if (!code || !dateStr) continue;
    const key = `${dateStr}\t${code}`;
    if (!byDateCode.has(key)) byDateCode.set(key, []);
    byDateCode.get(key)!.push(record);
  }

  for (const [key, group] of byDateCode) {
    const tab = key.indexOf('\t');
    const dateStr = key.slice(0, tab);
    const code = key.slice(tab + 1);
    const day = parseInt(dateStr.slice(8, 10), 10);
    if (day < 1 || day > DAY_COLS) continue;
    const idx = day - 1;
    const employee = employeeMap.get(code);
    const employmentType = resolveEmploymentCategory(
      employee?.employment_type,
      employee?.department || group[0]?.department
    );
    const shiftBucket = inferAttendanceCountShiftBucket(group);

    totalByDay[idx].add(code);

    if (employmentType === 'Chính thức') {
      if (shiftBucket === 'night') officialNightByDay[idx].add(code);
      else officialDayByDay[idx].add(code);
    } else if (employmentType === 'Thời vụ') {
      if (shiftBucket === 'night') seasonalNightByDay[idx].add(code);
      else seasonalDayByDay[idx].add(code);
    }

    const hireYmd = hireByCode.get(code);
    if (hireYmd && hireYmd === dateStr) {
      newEmployeesByDaySets[idx].add(code);
    }
  }

  const officialCounts = officialDayByDay.map((set, i) => set.size + officialNightByDay[i].size);
  const seasonalCounts = seasonalDayByDay.map((set, i) => set.size + seasonalNightByDay[i].size);
  const totalCounts = totalByDay.map((set) => set.size);
  const newEmployeesByDay = newEmployeesByDaySets.map((set) => set.size);
  const rateValues = totalCounts.map((count) =>
    employeesAll.length > 0 ? toFixed1((count / employeesAll.length) * 100) : 0
  );

  const summary = buildMonthOverviewSheet(
    `BÁO CÁO SỐ LƯỢNG ĐI LÀM (${range.monthLabel})`,
    `Khoảng ${range.start} → ${range.end} | Tổng NV hệ thống: ${employeesAll.length}. Số đi làm CT/TV mỗi ngày = ca ngày + ca đêm (rời nhau, theo shift hoặc giờ vào). Nhân viên mới: có ngày vào = ngày công (ưu tiên cột ngày vào trong DS CT/TV đã import; fallback ngày tạo NV).`,
    [
      {
        group: 'Chính thức',
        metric: 'Số đi làm',
        values: officialCounts,
        summary: officialCounts.reduce((sum, value) => sum + value, 0),
        note: 'Người',
      },
      {
        group: 'Thời vụ',
        metric: 'Số đi làm',
        values: seasonalCounts,
        summary: seasonalCounts.reduce((sum, value) => sum + value, 0),
        note: 'Người',
      },
      {
        group: 'Hệ thống',
        metric: 'Nhân viên mới',
        values: newEmployeesByDay,
        summary: newEmployeesByDay.reduce((sum, value) => sum + value, 0),
        note: 'Người',
      },
      {
        group: 'Toàn bộ',
        metric: 'Tổng đi làm',
        values: totalCounts,
        summary: totalCounts.reduce((sum, value) => sum + value, 0),
        note: 'Người',
      },
    ]
  );

  const avg = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

  const productionSnapshot = buildAttendanceCountProductionSnapshot(
    range,
    byDateCode,
    officialRows,
    seasonalRows,
    hireByCode,
    employeeMap
  );

  const sheets: TemplateSheetGrid[] = [
    {
      name: 'Tổng quan tháng',
      rows: summary.rows,
      merges: summary.merges,
      rowStyles: summary.rowStyles,
      cellStyles: summary.cellStyles,
      colWidths: summary.colWidths,
    },
    buildSimpleTableSheet({
      name: 'Sheet1',
      title: `CHI TIẾT SỐ LƯỢNG ĐI LÀM (${range.monthLabel})`,
      subtitle: `Tự động từ chấm công + nhân sự (ca ngày/đêm; NV mới theo ngày vào) | ${range.start} → ${range.end}`,
      headers: ['Nhóm', ...Array.from({ length: DAY_COLS }, (_, i) => i + 1), 'Tổng kỳ', 'TB/ngày'],
      dataRows: [
        ['Chính thức', ...officialCounts, officialCounts.reduce((sum, value) => sum + value, 0), toFixed1(avg(officialCounts))],
        ['Thời vụ', ...seasonalCounts, seasonalCounts.reduce((sum, value) => sum + value, 0), toFixed1(avg(seasonalCounts))],
        ['Nhân viên mới', ...newEmployeesByDay, newEmployeesByDay.reduce((sum, value) => sum + value, 0), toFixed1(avg(newEmployeesByDay))],
        ['Tổng đi làm', ...totalCounts, totalCounts.reduce((sum, value) => sum + value, 0), toFixed1(avg(totalCounts))],
        ['Tỉ lệ đi làm (%)', ...rateValues, '', toFixed1(avg(rateValues))],
      ],
      dayStartCol: 1,
    }),
  ];

  return { sheets, productionSnapshot };
}

function splitRangeIntoWeeks(start: string, end: string) {
  const startDt = parseYmdLocal(start);
  const endDt = parseYmdLocal(end);
  const cursor = new Date(startDt);
  const diff = cursor.getDay() === 0 ? -6 : 1 - cursor.getDay();
  cursor.setDate(cursor.getDate() + diff);

  const weeks: Array<{ start: string; end: string; label: string }> = [];
  while (cursor <= endDt) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const actualStart = weekStart < startDt ? new Date(startDt) : weekStart;
    const actualEnd = weekEnd > endDt ? new Date(endDt) : weekEnd;
    if (actualStart <= actualEnd) {
      weeks.push({
        start: toLocalYmd(actualStart),
        end: toLocalYmd(actualEnd),
        label: `${toLocalYmd(actualStart).slice(5)} → ${toLocalYmd(actualEnd).slice(5)}`,
      });
    }

    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

async function buildWeeklyOneDayWorkersFromSystem(
  start_date: string,
  end_date: string
): Promise<TemplateSheetGrid[]> {
  const range = await resolveReportRange(start_date, end_date);
  const [employeesAll, records] = await Promise.all([
    loadEmployeesLite(),
    loadTimekeepingLite(range.start, range.end),
  ]);

  const seasonalEmployees = employeesAll.filter((emp) => isSeasonalEmployee(emp.employment_type));
  const seasonalMap = new Map(
    seasonalEmployees.map((emp) => [normalizeCode(emp.employee_code), emp] as const)
  );

  const weekRows = splitRangeIntoWeeks(range.start, range.end);
  const summaryRows: (string | number)[][] = [];
  const detailRows: (string | number)[][] = [];

  for (const week of weekRows) {
    const weekRecords = records.filter((record) => {
      const dateStr = String(record.date || '').slice(0, 10);
      return dateStr >= week.start && dateStr <= week.end;
    });

    const workedDays = new Map<string, Set<string>>();
    const sampleRecord = new Map<string, TimekeepingLite>();
    const byDept = new Map<string, number>();

    for (const record of weekRecords) {
      const code = resolveRecordCode(record);
      if (!code || (seasonalMap.size > 0 && !seasonalMap.has(code))) continue;
      const dateStr = String(record.date || '').slice(0, 10);
      if (!workedDays.has(code)) workedDays.set(code, new Set<string>());
      workedDays.get(code)!.add(dateStr);
      if (!sampleRecord.has(code)) sampleRecord.set(code, record);
    }

    const oneDayCodes = [...workedDays.entries()]
      .filter(([, dates]) => dates.size === 1)
      .map(([code]) => code)
      .sort((a, b) => a.localeCompare(b, 'vi'));

    for (const code of oneDayCodes) {
      const record = sampleRecord.get(code);
      const employee = seasonalMap.get(code);
      const workDate = [...(workedDays.get(code) || new Set<string>())][0] || '';
      const department = employee?.department || String(record?.department || '').trim() || 'Chưa xác định';
      byDept.set(department, (byDept.get(department) || 0) + 1);
      detailRows.push([
        week.label,
        workDate,
        code,
        employee?.name || String(record?.employee_name || '').trim() || code,
        department,
        toFixed1(Number(record?.workday) || 0),
        toFixed1(getHours(record || {})),
        String(record?.check_in || ''),
        String(record?.check_out || ''),
      ]);
    }

    const topDept = [...byDept.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    summaryRows.push([
      week.label,
      oneDayCodes.length,
      seasonalEmployees.length,
      seasonalEmployees.length > 0 ? toFixed1((oneDayCodes.length / seasonalEmployees.length) * 100) : 0,
      topDept,
    ]);
  }

  return [
    buildSimpleTableSheet({
      name: 'Tổng quan tuần',
      title: `CÔNG NHÂN THỜI VỤ 1 NGÀY/TUẦN (${range.monthLabel})`,
      subtitle: `Tự động từ chấm công | ${range.start} → ${range.end}`,
      headers: ['Tuần', 'Số CN 1 ngày', 'Tổng thời vụ', 'Tỉ lệ %', 'BP nhiều nhất'],
      dataRows: summaryRows.length > 0 ? summaryRows : [['(Chưa có dữ liệu trong khoảng đã chọn)']],
    }),
    buildSimpleTableSheet({
      name: 'Chi tiết',
      title: `CHI TIẾT CN 1 NGÀY/TUẦN (${range.monthLabel})`,
      subtitle: `Danh sách thời vụ đi làm đúng 1 ngày trong tuần`,
      headers: ['Tuần', 'Ngày công', 'Mã NV', 'Họ tên', 'BP', 'Công', 'Giờ công', 'Giờ vào', 'Giờ ra'],
      dataRows: detailRows.length > 0 ? detailRows : [['(Chưa có dòng chi tiết)']],
    }),
  ];
}

async function buildDailyWageFromSystem(
  start_date: string,
  end_date: string
): Promise<TemplateSheetGrid[]> {
  const range = await resolveReportRange(start_date, end_date);
  const [employeesAll, records] = await Promise.all([
    loadEmployeesLite(),
    loadTimekeepingLite(range.start, range.end),
  ]);

  const employeeMap = new Map(
    employeesAll.map((emp) => [normalizeCode(emp.employee_code), emp] as const)
  );
  const dayBase = Array(DAY_COLS).fill(0);
  const dayOt = Array(DAY_COLS).fill(0);
  const dayTotal = Array(DAY_COLS).fill(0);

  const detailRows = [...records]
    .sort(
      (a, b) =>
        String(a.date || '').localeCompare(String(b.date || ''), 'vi') ||
        resolveRecordCode(a).localeCompare(resolveRecordCode(b), 'vi')
    )
    .map((record) => {
      const code = resolveRecordCode(record);
      const employee = employeeMap.get(code);
      const employmentType = resolveEmploymentCategory(employee?.employment_type, employee?.department || record.department) || 'Thời vụ';
      const hours = getHours(record);
      const overtimeHours = Number(record.overtime_hours) || 0;
      const rate = getHourlyRate(employmentType);
      const basePay = toFixed0(hours * rate);
      const otPay = toFixed0(overtimeHours * rate * OVERTIME_MULTIPLIER);
      const totalPay = basePay + otPay;
      const day = parseInt(String(record.date || '').slice(8, 10), 10);
      if (day >= 1 && day <= DAY_COLS) {
        dayBase[day - 1] += basePay;
        dayOt[day - 1] += otPay;
        dayTotal[day - 1] += totalPay;
      }
      return [
        String(record.date || '').slice(0, 10),
        code,
        employee?.name || String(record.employee_name || '').trim() || code,
        employee?.department || String(record.department || '').trim(),
        employmentType,
        toFixed1(Number(record.workday) || 0),
        toFixed1(hours),
        toFixed1(overtimeHours),
        rate,
        basePay,
        otPay,
        totalPay,
      ];
    });

  const summary = buildMonthOverviewSheet(
    `TỔNG QUAN TIỀN CÔNG HÀNG NGÀY (${range.monthLabel})`,
    `Ước tính từ giờ công + đơn giá mặc định | ${range.start} → ${range.end}`,
    [
      {
        group: 'Chi trả',
        metric: 'Tiền công thường',
        values: dayBase,
        summary: toFixed0(dayBase.reduce((sum, value) => sum + value, 0)),
        note: 'VND',
      },
      {
        group: 'Chi trả',
        metric: 'Tiền OT',
        values: dayOt,
        summary: toFixed0(dayOt.reduce((sum, value) => sum + value, 0)),
        note: 'VND',
      },
      {
        group: 'Chi trả',
        metric: 'Tổng chi trả',
        values: dayTotal,
        summary: toFixed0(dayTotal.reduce((sum, value) => sum + value, 0)),
        note: 'VND',
      },
    ]
  );

  return [
    {
      name: 'Tổng quan tháng',
      rows: summary.rows,
      merges: summary.merges,
      rowStyles: summary.rowStyles,
      cellStyles: summary.cellStyles,
      colWidths: summary.colWidths,
    },
    buildSimpleTableSheet({
      name: 'Sheet1',
      title: `BÁO CÁO TIỀN CÔNG HÀNG NGÀY (${range.monthLabel})`,
      subtitle: `Tự động từ chấm công + loại nhân viên`,
      headers: [
        'Ngày',
        'Mã NV',
        'Họ tên',
        'Bộ phận',
        'Loại NV',
        'Công',
        'Giờ công',
        'OT',
        'Đơn giá',
        'Tiền công',
        'Tiền OT',
        'Thành tiền',
      ],
      dataRows: detailRows.length > 0 ? detailRows : [['(Chưa có dữ liệu tiền công)']],
    }),
  ];
}

async function buildLaborRateFromSystem(
  start_date: string,
  end_date: string
): Promise<TemplateSheetGrid[]> {
  const range = await resolveReportRange(start_date, end_date);
  const [employeesAll, records] = await Promise.all([
    loadEmployeesLite(),
    loadTimekeepingLite(range.start, range.end),
  ]);

  const employeeMap = new Map(
    employeesAll.map((emp) => [normalizeCode(emp.employee_code), emp] as const)
  );
  const officialCount = employeesAll.filter((emp) => isOfficialEmployee(emp.employment_type)).length;
  const seasonalCount = employeesAll.filter((emp) => isSeasonalEmployee(emp.employment_type)).length;

  const byDate = new Map<
    string,
    { all: Set<string>; official: Set<string>; seasonal: Set<string> }
  >();

  for (const record of records) {
    const code = resolveRecordCode(record);
    const dateStr = String(record.date || '').slice(0, 10);
    if (!code || !dateStr) continue;
    if (!byDate.has(dateStr)) {
      byDate.set(dateStr, { all: new Set<string>(), official: new Set<string>(), seasonal: new Set<string>() });
    }
    const bucket = byDate.get(dateStr)!;
    bucket.all.add(code);
    const employee = employeeMap.get(code);
    const employmentType = resolveEmploymentCategory(employee?.employment_type, employee?.department || record.department);
    if (employmentType === 'Chính thức') bucket.official.add(code);
    if (employmentType === 'Thời vụ') bucket.seasonal.add(code);
  }

  const byDay = new Map<number, { all: number; official: number; seasonal: number }>();
  for (const dateStr of range.dates) {
    const bucket = byDate.get(dateStr);
    const day = parseInt(dateStr.slice(8, 10), 10);
    if (day < 1 || day > DAY_COLS) continue;
    byDay.set(day, {
      all: bucket?.all.size || 0,
      official: bucket?.official.size || 0,
      seasonal: bucket?.seasonal.size || 0,
    });
  }

  const snapshotDate = [...byDate.keys()].sort().pop() || range.snapshotDate;
  const snapshotAttended = byDate.get(snapshotDate)?.all || new Set<string>();
  const snapshotRecords = new Map<string, TimekeepingLite>();
  for (const record of records) {
    const code = resolveRecordCode(record);
    const dateStr = String(record.date || '').slice(0, 10);
    if (code && dateStr === snapshotDate && !snapshotRecords.has(code)) {
      snapshotRecords.set(code, record);
    }
  }
  const deptMap = new Map<string, { total: number; attended: Set<string> }>();

  for (const employee of employeesAll) {
    const dept = String(employee.department || '').trim() || 'Chưa xác định';
    if (!deptMap.has(dept)) deptMap.set(dept, { total: 0, attended: new Set<string>() });
    deptMap.get(dept)!.total += 1;
  }

  for (const code of snapshotAttended) {
    const employee = employeeMap.get(code);
    const dept = String(employee?.department || snapshotRecords.get(code)?.department || '').trim() || 'Chưa xác định';
    if (!deptMap.has(dept)) deptMap.set(dept, { total: 0, attended: new Set<string>() });
    if (!employee) deptMap.get(dept)!.total += 1;
    deptMap.get(dept)!.attended.add(code);
  }

  const deptRows = [...deptMap.entries()]
    .map(([dept, info]) => ({
      dept,
      total: info.total,
      attended: info.attended.size,
      rate: info.total > 0 ? (info.attended.size / info.total) * 100 : 0,
    }))
    .sort((a, b) => a.dept.localeCompare(b.dept, 'vi'));

  return [
    buildLaborRateMainSheet(range.monthLabel, snapshotDate, {
      all: employeesAll.length,
      official: officialCount,
      seasonal: seasonalCount,
    }, byDay),
    buildLaborRateDepartmentSheet(range.monthLabel, deptRows),
  ];
}

async function buildWorkforceSummaryFromSystem(
  start_date: string,
  end_date: string
): Promise<TemplateSheetGrid[]> {
  const range = await resolveReportRange(start_date, end_date);
  const [employeesAll, records] = await Promise.all([
    loadEmployeesLite(),
    loadTimekeepingLite(range.start, range.end),
  ]);

  const employeeMap = new Map(
    employeesAll.map((emp) => [normalizeCode(emp.employee_code), emp] as const)
  );
  const byDate = new Map<
    string,
    { all: Set<string>; official: Set<string>; seasonal: Set<string> }
  >();

  for (const record of records) {
    const code = resolveRecordCode(record);
    const dateStr = String(record.date || '').slice(0, 10);
    if (!code || !dateStr) continue;
    if (!byDate.has(dateStr)) {
      byDate.set(dateStr, { all: new Set<string>(), official: new Set<string>(), seasonal: new Set<string>() });
    }
    const bucket = byDate.get(dateStr)!;
    bucket.all.add(code);
    const employee = employeeMap.get(code);
    const employmentType = resolveEmploymentCategory(employee?.employment_type, employee?.department || record.department);
    if (employmentType === 'Chính thức') bucket.official.add(code);
    if (employmentType === 'Thời vụ') bucket.seasonal.add(code);
  }

  const dayAll = Array(DAY_COLS).fill(0);
  const dayOfficial = Array(DAY_COLS).fill(0);
  const daySeasonal = Array(DAY_COLS).fill(0);
  const dayRate = Array(DAY_COLS).fill(0);

  for (const dateStr of range.dates) {
    const day = parseInt(dateStr.slice(8, 10), 10);
    if (day < 1 || day > DAY_COLS) continue;
    const bucket = byDate.get(dateStr);
    const allCount = bucket?.all.size || 0;
    const officialCount = bucket?.official.size || 0;
    const seasonalCount = bucket?.seasonal.size || 0;
    dayAll[day - 1] = allCount;
    dayOfficial[day - 1] = officialCount;
    daySeasonal[day - 1] = seasonalCount;
    dayRate[day - 1] = employeesAll.length > 0 ? toFixed1((allCount / employeesAll.length) * 100) : 0;
  }

  const snapshotDate = [...byDate.keys()].sort().pop() || range.snapshotDate;
  const snapshotCodes = byDate.get(snapshotDate)?.all || new Set<string>();
  const snapshotRecords = new Map<string, TimekeepingLite>();
  for (const record of records) {
    const code = resolveRecordCode(record);
    const dateStr = String(record.date || '').slice(0, 10);
    if (code && dateStr === snapshotDate && !snapshotRecords.has(code)) {
      snapshotRecords.set(code, record);
    }
  }
  const groupStats = new Map<WorkforceGroupKey, { total: number; attended: Set<string> }>();
  for (const groupName of DEPT_COLS as WorkforceGroupKey[]) {
    groupStats.set(groupName, { total: 0, attended: new Set<string>() });
  }

  for (const employee of employeesAll) {
    const groupName = mapWorkforceGroup(employee.department);
    groupStats.get(groupName)!.total += 1;
  }

  for (const code of snapshotCodes) {
    const employee = employeeMap.get(code);
    const groupName = mapWorkforceGroup(employee?.department || snapshotRecords.get(code)?.department || '');
    if (!employee) groupStats.get(groupName)!.total += 1;
    groupStats.get(groupName)!.attended.add(code);
  }

  const detailRows = (DEPT_COLS as WorkforceGroupKey[]).map((groupName) => {
    const info = groupStats.get(groupName)!;
    const attended = info.attended.size;
    const total = info.total;
    return [
      groupName,
      total,
      attended,
      total > 0 ? toFixed1((attended / total) * 100) : 0,
      Math.max(total - attended, 0),
      snapshotDate,
    ];
  });

  detailRows.push([
    'Total',
    employeesAll.length,
    snapshotCodes.size,
    employeesAll.length > 0 ? toFixed1((snapshotCodes.size / employeesAll.length) * 100) : 0,
    Math.max(employeesAll.length - snapshotCodes.size, 0),
    snapshotDate,
  ]);

  const summary = buildMonthOverviewSheet(
    `TỔNG HỢP NHÂN LỰC (${range.monthLabel})`,
    `Tự động từ hệ thống | Ảnh chụp cuối kỳ: ${snapshotDate}`,
    [
      {
        group: 'Toàn công ty',
        metric: 'Tổng nhân sự',
        values: Array(DAY_COLS).fill(employeesAll.length),
        summary: employeesAll.length,
        note: 'Người',
      },
      {
        group: 'Toàn công ty',
        metric: 'Đi làm',
        values: dayAll,
        summary: dayAll.reduce((sum, value) => sum + value, 0),
        note: 'Người',
      },
      {
        group: 'Toàn công ty',
        metric: 'Tỉ lệ đi làm (%)',
        values: dayRate,
        summary: toFixed1(dayRate.reduce((sum, value) => sum + value, 0) / Math.max(range.dates.length, 1)),
        note: '%',
      },
      {
        group: 'Chính thức',
        metric: 'Đi làm',
        values: dayOfficial,
        summary: dayOfficial.reduce((sum, value) => sum + value, 0),
        note: 'Người',
      },
      {
        group: 'Thời vụ',
        metric: 'Đi làm',
        values: daySeasonal,
        summary: daySeasonal.reduce((sum, value) => sum + value, 0),
        note: 'Người',
      },
    ]
  );

  return [
    {
      name: '근태종합(자동)',
      rows: summary.rows,
      merges: summary.merges,
      rowStyles: summary.rowStyles,
      cellStyles: summary.cellStyles,
      colWidths: summary.colWidths,
    },
    buildSimpleTableSheet({
      name: '근태 상황 보고서',
      title: `근태 상황 보고서 (${range.monthLabel})`,
      subtitle: `Chi tiết theo nhóm bộ phận | Ngày chốt ${snapshotDate}`,
      headers: ['Nhóm', 'Tổng nhân sự', 'Đi làm', 'Tỉ lệ %', 'Vắng', 'Ngày chốt'],
      dataRows: detailRows,
    }),
  ];
}

async function buildPayrollKpiFromSystem(
  start_date: string,
  end_date: string
): Promise<TemplateSheetGrid[]> {
  const range = await resolveReportRange(start_date, end_date);
  const [employeesAll, records] = await Promise.all([
    loadEmployeesLite(),
    loadTimekeepingLite(range.start, range.end),
  ]);

  const employeeMap = new Map(
    employeesAll.map((emp) => [normalizeCode(emp.employee_code), emp] as const)
  );
      const byDay = new Map<number, { count: number; totalHours: number; overtimeHours: number; codes: Set<string> }>();
  for (let day = 1; day <= DAY_COLS; day++) {
    byDay.set(day, { count: 0, totalHours: 0, overtimeHours: 0, codes: new Set<string>() });
  }

  const deptAgg = new Map<string, { codes: Set<string>; totalHours: number; overtimeHours: number; estimatedCost: number }>();

  for (const record of records) {
    const code = resolveRecordCode(record);
    const day = parseInt(String(record.date || '').slice(8, 10), 10);
    const employee = employeeMap.get(code);
    const dept = String(employee?.department || record.department || '').trim() || 'Chưa xác định';
    const hours = getHours(record);
    const overtimeHours = Number(record.overtime_hours) || 0;
    const rate = getHourlyRate(employee?.employment_type || 'Thời vụ');

        if (day >= 1 && day <= DAY_COLS) {
      const bucket = byDay.get(day)!;
      bucket.codes.add(code);
      bucket.count = bucket.codes.size;
      bucket.totalHours += hours;
      bucket.overtimeHours += overtimeHours;
    }

    if (!deptAgg.has(dept)) {
      deptAgg.set(dept, { codes: new Set<string>(), totalHours: 0, overtimeHours: 0, estimatedCost: 0 });
    }
    const deptInfo = deptAgg.get(dept)!;
    deptInfo.codes.add(code);
    deptInfo.totalHours += hours;
    deptInfo.overtimeHours += overtimeHours;
    deptInfo.estimatedCost += hours * rate + overtimeHours * rate * OVERTIME_MULTIPLIER;
  }

  const sheet1Rows = buildSheet1Ingunbi(range.monthLabel, byDay);
      const sheet1Styles = getSheet1KpiStyles(COLS_KPI);
  const deptRows = [...deptAgg.entries()]
    .sort((a, b) => b[1].estimatedCost - a[1].estimatedCost)
    .map(([dept, info], index) => [
      index + 1,
      dept,
      info.codes.size,
      toFixed1(info.totalHours),
      toFixed1(info.overtimeHours),
      toFixed0(info.estimatedCost),
    ]);

  return [
    {
      name: '인건비 현황',
      rows: sheet1Rows,
      merges: sheet1Styles.merges,
      rowStyles: sheet1Styles.rowStyles,
      cellStyles: sheet1Styles.cellStyles,
    },
    buildSimpleTableSheet({
      name: '종합 급여 현황',
      title: `종합 급여 현황 (${range.monthLabel.replace(/\//g, '.')})`,
      subtitle: `Tổng hợp KPI theo bộ phận | ${range.start} → ${range.end}`,
      headers: ['STT', 'Bộ phận', 'Số NV có công', 'Giờ công', 'OT', 'Chi phí ước tính'],
      dataRows: deptRows.length > 0 ? deptRows : [['(Chưa có dữ liệu KPI)']],
    }),
  ];
}

/** Dùng cho script audit / test tự động (cùng pipeline với API attendance-count). */
export async function runAttendanceCountSnapshotAudit(start_date: string, end_date: string) {
  return buildAttendanceCountFromSystem(start_date, end_date);
}

/** GET /api/hr-templates/:reportType/grid?start_date=&end_date= */
export const getHrTemplateGrid = async (req: Request, res: Response) => {
  try {
    const reportType = (Array.isArray(req.params.reportType) ? req.params.reportType[0] : req.params.reportType) || '';
    const reportTypeStr = String(reportType).trim();
    const start_date = (req.query.start_date as string) || '';
    const end_date = (req.query.end_date as string) || '';

    if (!reportTypeStr) {
      return res.status(400).json({ error: 'reportType required' });
    }

    let result: GridResponse = { rows: [], merges: [] };

    if (reportTypeStr === 'temp-timesheet') {
      const sheets = await buildTempTimesheetFromSystem(start_date, end_date);
      return res.json({ sheets });
    } else if (reportTypeStr === 'official-timesheet') {
      const sheets = await buildOfficialTimesheetFromSystem(start_date, end_date);
      return res.json({ sheets });
    } else if (reportTypeStr === 'attendance-count') {
      const { sheets, productionSnapshot } = await buildAttendanceCountFromSystem(start_date, end_date);
      const summaryOnly =
        String(req.query.summary_only ?? req.query.summaryOnly ?? '').toLowerCase() === '1' ||
        String(req.query.summary_only ?? req.query.summaryOnly ?? '').toLowerCase() === 'true';
      if (summaryOnly && sheets.length > 0) {
        return res.json({ sheets: [sheets[0]], productionSnapshot });
      }
      return res.json({ sheets, productionSnapshot });
    } else if (reportTypeStr === 'attendance-rate') {
      const sheet = await buildAttendanceRateFromTimekeeping(start_date, end_date);
      return res.json({ sheets: [sheet] });
    } else if (reportTypeStr === 'weekly-one-day-workers') {
      const sheets = await buildWeeklyOneDayWorkersFromSystem(start_date, end_date);
      return res.json({ sheets });
    } else if (reportTypeStr === 'labor-rate') {
      const sheets = await buildLaborRateFromSystem(start_date, end_date);
      return res.json({ sheets });
    } else if (reportTypeStr === 'daily-wage') {
      const sheets = await buildDailyWageFromSystem(start_date, end_date);
      return res.json({ sheets });
    } else if (reportTypeStr === 'bhxh-list') {
      const template = await loadBhxhListTemplateSheet();
      return res.json({
        sheets: [
          {
            name: template.name,
            rows: template.rows,
            merges: template.merges,
            rowStyles: template.rowStyles,
            cellStyles: template.cellStyles,
            colWidths: template.colWidths,
            rowHeights: template.rowHeights,
            hiddenCols: template.hiddenCols,
            hiddenRows: template.hiddenRows,
          },
        ],
      });
    } else if (reportTypeStr === 'insurance-master') {
      const sheets = await loadInsuranceTemplateSheets();
      return res.json({
        sheets: sheets.map((s) => ({
          name: s.name,
          rows: s.rows,
          merges: s.merges,
          rowStyles: s.rowStyles,
          cellStyles: s.cellStyles,
          colWidths: s.colWidths,
          rowHeights: s.rowHeights,
          hiddenCols: s.hiddenCols,
          hiddenRows: s.hiddenRows,
        })),
      });
    } else if (reportTypeStr === 'payroll') {
      const monthLabel = start_date && end_date
        ? `${start_date.slice(5, 7)}/${start_date.slice(0, 4)}`
        : '..';
      const [employees, records] = await Promise.all([
        loadEmployeesLite(),
        start_date && end_date
          ? loadTimekeepingLite(start_date, end_date)
          : query(
              'SELECT employee_code, employee_name, date, workday, total_hours, total_all_hours, overtime_hours, created_at, is_archived FROM timekeeping_records WHERE is_archived = 0',
              {}
            ),
      ]);
      const aggByCode = new Map<string, { workday: number; hours: number; overtime: number }>();
      const aggByCodeDay = new Map<string, number[]>();
      const employeeTypeMap = new Map(employees.map((e) => [e.employee_code, e.employment_type || 'Thời vụ']));
      for (const r of records) {
        if (!aggByCode.has(r.employee_code)) aggByCode.set(r.employee_code, { workday: 0, hours: 0, overtime: 0 });
        const agg = aggByCode.get(r.employee_code)!;
        agg.workday += r.workday || 0;
        agg.hours += getHours(r);
        agg.overtime += r.overtime_hours || 0;
        const day = parseInt((r.date || '').slice(8, 10), 10);
        if (!isNaN(day) && day >= 1 && day <= DAY_COLS) {
          if (!aggByCodeDay.has(r.employee_code)) aggByCodeDay.set(r.employee_code, Array(DAY_COLS).fill(0));
          aggByCodeDay.get(r.employee_code)![day - 1] += getHours(r);
        }
      }
      const sheets = buildPayrollSheets(monthLabel);
      const salaryRows: (string | number)[][] = [sheets[0].rows[0], sheets[0].rows[1], sheets[0].rows[2]];
      const taxRows: (string | number)[][] = [sheets[1].rows[0], sheets[1].rows[1], sheets[1].rows[2]];
      const dailyGross = Array(DAY_COLS).fill(0) as number[];
      const dailyTax = Array(DAY_COLS).fill(0) as number[];
      const dailyNet = Array(DAY_COLS).fill(0) as number[];
      let stt = 1;
      for (const emp of employees) {
        const agg = aggByCode.get(emp.employee_code) || { workday: 0, hours: 0, overtime: 0 };
        if (agg.hours <= 0 && agg.overtime <= 0) continue;
        const rate = getHourlyRate(emp.employment_type || 'Thời vụ');
        const base = agg.hours * rate;
        const allowance = base * 0.1;
        const otPay = agg.overtime * rate * OVERTIME_MULTIPLIER;
        const bhxhNld = (base + allowance) * 0.105;
        const taxable = base + allowance + otPay - bhxhNld;
        const personalDeduction = 11000000;
        const taxableAfterDeduction = Math.max(taxable - personalDeduction, 0);
        const tax = taxableAfterDeduction * 0.1;
        const net = taxable - tax;
        const dayHours = aggByCodeDay.get(emp.employee_code) || Array(DAY_COLS).fill(0);
        dayHours.forEach((h, idx) => {
          if (h <= 0) return;
          const dRate = getHourlyRate(employeeTypeMap.get(emp.employee_code) || 'Thời vụ');
          const dayBase = h * dRate;
          const dayAllowance = dayBase * 0.1;
          const dayBhxh = (dayBase + dayAllowance) * 0.105;
          const dayTaxable = dayBase + dayAllowance - dayBhxh;
          const dayTax = Math.max(dayTaxable, 0) * 0.1;
          dailyGross[idx] += dayBase + dayAllowance;
          dailyTax[idx] += dayTax;
          dailyNet[idx] += dayTaxable - dayTax;
        });
        salaryRows.push(
          padRow([
            stt,
            emp.employee_code,
            emp.name,
            emp.department,
            toFixed0(base),
            toFixed0(allowance),
            toFixed0(otPay),
            toFixed0(bhxhNld),
            toFixed0(tax),
            toFixed0(net),
            '',
          ], 22)
        );
        taxRows.push(
          padRow([
            stt,
            emp.employee_code,
            emp.name,
            toFixed0(taxable),
            personalDeduction,
            toFixed0(tax),
            toFixed0((base + allowance) * 0.105),
            toFixed0((base + allowance) * 0.015),
            toFixed0((base + allowance) * 0.01),
            '',
          ], 22)
        );
        stt++;
      }
      sheets[0].rows = salaryRows;
      sheets[1].rows = taxRows;
      const overview = buildMonthOverviewSheet(
        `TỔNG QUAN LƯƠNG (${monthLabel})`,
        'Tự động tổng hợp theo công và cấu hình tỷ lệ',
        [
          { group: 'Chi trả', metric: 'Tổng gross theo ngày', values: dailyGross.map(toFixed0), summary: toFixed0(dailyGross.reduce((a, b) => a + b, 0)), note: 'VND' },
          { group: 'Thuế', metric: 'Thuế TNCN theo ngày', values: dailyTax.map(toFixed0), summary: toFixed0(dailyTax.reduce((a, b) => a + b, 0)), note: 'VND' },
          { group: 'Thực nhận', metric: 'Tổng net theo ngày', values: dailyNet.map(toFixed0), summary: toFixed0(dailyNet.reduce((a, b) => a + b, 0)), note: 'VND' },
        ]
      );
      return res.json({
        sheets: [
          { name: 'Tổng quan tháng', rows: overview.rows, merges: overview.merges, rowStyles: overview.rowStyles, cellStyles: overview.cellStyles, colWidths: overview.colWidths },
          ...sheets.map((s) => ({
            name: s.name,
            rows: s.rows,
            merges: s.merges,
            rowStyles: s.rowStyles,
          })),
        ],
      });
    } else if (reportTypeStr === 'drug-inventory') {
      const template = await loadDrugInventoryTemplateSheet();
      return res.json({
        sheets: [
          {
            name: template.name,
            rows: template.rows,
            merges: template.merges,
            rowStyles: template.rowStyles,
            cellStyles: template.cellStyles,
            colWidths: template.colWidths,
            rowHeights: template.rowHeights,
            hiddenCols: template.hiddenCols,
            hiddenRows: template.hiddenRows,
          },
        ],
      });
    } else if (reportTypeStr === 'medical-room-usage') {
      const template = await loadMedicalRoomUsageTemplateSheet();
      return res.json({
        sheets: [
          {
            name: template.name,
            rows: template.rows,
            merges: template.merges,
            rowStyles: template.rowStyles,
            cellStyles: template.cellStyles,
            colWidths: template.colWidths,
            rowHeights: template.rowHeights,
            hiddenCols: template.hiddenCols,
            hiddenRows: template.hiddenRows,
          },
        ],
      });
    } else if (reportTypeStr === 'arrears-collection') {
      const template = await loadArrearsCollectionTemplateSheet();
      return res.json({
        sheets: [
          {
            name: template.name,
            rows: template.rows,
            merges: template.merges,
            rowStyles: template.rowStyles,
            cellStyles: template.cellStyles,
            colWidths: template.colWidths,
            rowHeights: template.rowHeights,
            hiddenCols: template.hiddenCols,
            hiddenRows: template.hiddenRows,
          },
        ],
      });
    } else if (reportTypeStr === 'payroll-kpi') {
      const sheets = await buildPayrollKpiFromSystem(start_date, end_date);
      return res.json({ sheets });
    } else if (reportTypeStr === 'workforce-summary') {
      const sheets = await buildWorkforceSummaryFromSystem(start_date, end_date);
      return res.json({ sheets });
    } else {
      return res.status(400).json({ error: 'Report type chưa hỗ trợ grid từ dữ liệu hệ thống: ' + reportTypeStr });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

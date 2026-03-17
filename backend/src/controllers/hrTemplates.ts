import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { prisma } from '../server';

type GridResponse = { rows: (string | number)[][]; merges?: { s: { r: number; c: number }; e: { r: number; c: number } }[] };

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

function toFixed1(n: number): number {
  return Math.round((n || 0) * 10) / 10;
}

function toFixed0(n: number): number {
  return Math.round(n || 0);
}

function getHours(record: { total_all_hours: number; total_hours: number }): number {
  return record.total_all_hours || record.total_hours || 0;
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
  return { rows, merges, rowStyles, cellStyles };
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
};

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

function loadInsuranceTemplateSheets(): TemplateSheetGrid[] {
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

  const dataSheet = sheetToTemplateGrid(wb, dataName);
  const appendixSheet = sheetToTemplateGrid(wb, appendixName);
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

function loadBhxhListTemplateSheet(): TemplateSheetGrid {
  const wb = getBhxhListTemplateWorkbook();
  const sheetName =
    wb.SheetNames.find((s) => s.toLowerCase().includes('tháng') || s.toLowerCase().includes('thang')) ||
    wb.SheetNames.find((s) => wb.Sheets[s]?.['!ref']) ||
    wb.SheetNames[0];
  if (!sheetName) throw new Error('Không tìm thấy sheet mẫu danh sách tham gia BHXH');
  const grid = sheetToTemplateGrid(wb, sheetName);
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

function loadDrugInventoryTemplateSheet(): TemplateSheetGrid {
  const wb = getDrugInventoryTemplateWorkbook();
  const sheetName =
    wb.SheetNames.find((s) => /thang\s*\d|tháng\s*\d|sheet1/i.test(s) && wb.Sheets[s]?.['!ref']) ||
    wb.SheetNames.find((s) => wb.Sheets[s]?.['!ref']) ||
    wb.SheetNames[0];
  if (!sheetName) throw new Error('Không tìm thấy sheet mẫu xuất nhập tồn thuốc');
  const grid = sheetToTemplateGrid(wb, sheetName);
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

function loadMedicalRoomUsageTemplateSheet(): TemplateSheetGrid {
  const wb = getMedicalRoomUsageTemplateWorkbook();
  const sheetName =
    wb.SheetNames.find((s) => s === 'BC' && wb.Sheets[s]?.['!ref']) ||
    wb.SheetNames.find((s) => /phong|y\s*te|hiện\s*trạng|hien\s*trang|báo\s*cáo/i.test(s) && wb.Sheets[s]?.['!ref']) ||
    wb.SheetNames.find((s) => wb.Sheets[s]?.['!ref']) ||
    wb.SheetNames[0];
  if (!sheetName) throw new Error('Không tìm thấy sheet mẫu phòng y tế');
  const grid = sheetToTemplateGrid(wb, sheetName);
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

function loadArrearsCollectionTemplateSheet(): TemplateSheetGrid {
  const wb = getArrearsCollectionTemplateWorkbook();
  const sheetName =
    wb.SheetNames.find((s) => wb.Sheets[s]?.['!ref']) || wb.SheetNames[0];
  if (!sheetName) throw new Error('Không tìm thấy sheet mẫu truy thu');
  const grid = sheetToTemplateGrid(wb, sheetName);
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
      const template = loadTempTimesheetTemplateSheet();
      return res.json({
        sheets: [
          { name: template.name, rows: template.rows, merges: template.merges },
        ],
      });
    } else if (reportTypeStr === 'official-timesheet') {
      const template = loadOfficialTimesheetTemplateSheet();
      return res.json({
        sheets: [
          { name: template.name, rows: template.rows, merges: template.merges },
        ],
      });
    } else if (reportTypeStr === 'attendance-count') {
      const template = loadAttendanceCountTemplateSheet();
      return res.json({
        sheets: [
          { name: template.name, rows: template.rows, merges: template.merges },
        ],
      });
    } else if (reportTypeStr === 'attendance-rate') {
      const dateStr = end_date || start_date || new Date().toISOString().slice(0, 10);
      const template = loadAttendanceRateTemplateSheet(dateStr);
      return res.json({
        sheets: [
          { name: template.name, rows: template.rows, merges: template.merges },
        ],
      });
    } else if (reportTypeStr === 'weekly-one-day-workers') {
      const template = loadWeeklyOneDayTemplateSheet();
      return res.json({
        sheets: [
          { name: template.name, rows: template.rows, merges: template.merges },
        ],
      });
    } else if (reportTypeStr === 'labor-rate') {
      const templates = loadLaborRateTemplateSheets();
      return res.json({
        sheets: templates.map((sheet) => ({
          name: sheet.name,
          rows: sheet.rows,
          merges: sheet.merges,
        })),
      });
    } else if (reportTypeStr === 'daily-wage') {
      const template = loadDailyWageTemplateSheet();
      return res.json({
        sheets: [
          { name: template.name, rows: template.rows, merges: template.merges },
        ],
      });
    } else if (reportTypeStr === 'bhxh-list') {
      const template = loadBhxhListTemplateSheet();
      return res.json({
        sheets: [
          { name: template.name, rows: template.rows, merges: template.merges },
        ],
      });
    } else if (reportTypeStr === 'insurance-master') {
      const sheets = loadInsuranceTemplateSheets();
      return res.json({
        sheets: sheets.map((s) => ({
          name: s.name,
          rows: s.rows,
          merges: s.merges,
        })),
      });
    } else if (reportTypeStr === 'payroll') {
      const monthLabel = start_date && end_date
        ? `${start_date.slice(5, 7)}/${start_date.slice(0, 4)}`
        : '..';
      const where: any = { is_archived: 0 };
      if (start_date && end_date) where.date = { gte: start_date, lte: end_date };
      const [employees, records] = await Promise.all([
        prisma.employee.findMany({
          select: { employee_code: true, name: true, department: true, employment_type: true },
          orderBy: [{ department: 'asc' }, { employee_code: 'asc' }],
        }),
        prisma.timekeepingRecord.findMany({
          where,
          select: {
            employee_code: true,
            date: true,
            workday: true,
            total_hours: true,
            total_all_hours: true,
            overtime_hours: true,
          },
        }),
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
          { name: 'Tổng quan tháng', rows: overview.rows, merges: overview.merges, rowStyles: overview.rowStyles, cellStyles: overview.cellStyles },
          ...sheets.map((s) => ({
            name: s.name,
            rows: s.rows,
            merges: s.merges,
            rowStyles: s.rowStyles,
          })),
        ],
      });
    } else if (reportTypeStr === 'drug-inventory') {
      const template = loadDrugInventoryTemplateSheet();
      return res.json({
        sheets: [
          { name: template.name, rows: template.rows, merges: template.merges },
        ],
      });
    } else if (reportTypeStr === 'medical-room-usage') {
      const template = loadMedicalRoomUsageTemplateSheet();
      return res.json({
        sheets: [
          { name: template.name, rows: template.rows, merges: template.merges },
        ],
      });
    } else if (reportTypeStr === 'arrears-collection') {
      const template = loadArrearsCollectionTemplateSheet();
      return res.json({
        sheets: [
          { name: template.name, rows: template.rows, merges: template.merges },
        ],
      });
    } else if (reportTypeStr === 'payroll-kpi') {
      const templates = loadPayrollKpiTemplateSheets();
      return res.json({
        sheets: templates.map((sheet) => ({
          name: sheet.name,
          rows: sheet.rows,
          merges: sheet.merges,
        })),
      });
    } else if (reportTypeStr === 'workforce-summary') {
      const dateStr = end_date || start_date || new Date().toISOString().slice(0, 10);
      const sheets = loadWorkforceTemplateSheets(dateStr);
      return res.json({
        sheets: [
          { name: sheets.summary.name, rows: sheets.summary.rows, merges: sheets.summary.merges },
          { name: '근태 상황 보고서', rows: sheets.situation.rows, merges: sheets.situation.merges },
        ],
      });
    } else {
      return res.status(400).json({ error: 'Report type chưa hỗ trợ grid từ dữ liệu hệ thống: ' + reportTypeStr });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

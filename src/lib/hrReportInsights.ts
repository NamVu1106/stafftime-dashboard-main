import { extractHrBuiltInStats, type AttendanceCountProductionSnapshot } from '@/lib/hrBuiltInStats';
import { formatNumberPlain } from '@/lib/utils';

type GridRows = (string | number)[][];

type SheetLike = {
  name: string;
  rows: GridRows;
};

type GridLike =
  | {
      rows?: GridRows;
      sheets?: SheetLike[];
      productionSnapshot?: AttendanceCountProductionSnapshot;
    }
  | null
  | undefined;

type LatestUploadLike = {
  original_file_name?: string;
  default_sheet?: string;
  created_at?: string;
} | null | undefined;

type ReportStatsLike =
  | {
      stats?: Record<string, any>;
      sheetName?: string;
    }
  | null
  | undefined;

export type HrSummaryMetric = {
  label: string;
  value: string;
  hint?: string;
};

export type HrSummaryPanel = {
  title: string;
  description?: string;
  metrics: HrSummaryMetric[];
  notes: string[];
};

export type OverviewRow = {
  group: string;
  metric: string;
  values: number[];
  summary: number;
  note: string;
  raw: (string | number)[];
};

export type OverviewTable = {
  headerRowIndex: number;
  summaryColIndex: number;
  noteColIndex: number;
  rows: OverviewRow[];
};

export const normalizeHrReportText = (value: unknown) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9%]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();

export const parseHrReportNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value).trim();
  if (!raw || raw === '-' || raw === '—' || raw === '✕') return 0;
  const withoutPercent = raw.endsWith('%') ? raw.slice(0, -1) : raw;
  const compact = withoutPercent.replace(/\s/g, '');
  const hasComma = compact.includes(',');
  const hasDot = compact.includes('.');
  let normalized = compact;
  if (hasComma && hasDot) {
    normalized = compact.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    normalized = compact.replace(',', '.');
  }
  const cleaned = normalized.replace(/[^\d.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getPrimaryGridRows = (grid: GridLike): GridRows => {
  if (!grid) return [];
  if ('sheets' in grid && Array.isArray(grid.sheets) && grid.sheets.length > 0) {
    return grid.sheets[0]?.rows || [];
  }
  if ('rows' in grid && Array.isArray(grid.rows)) {
    return grid.rows;
  }
  return [];
};

export const extractOverviewTable = (rows: GridRows): OverviewTable | null => {
  if (!rows.length) return null;
  const headerRowIndex = rows.findIndex((row) => {
    return normalizeHrReportText(row[0]) === 'nhom' && normalizeHrReportText(row[1]) === 'chi so';
  });
  if (headerRowIndex < 0) return null;

  const headerRow = rows[headerRowIndex] || [];
  let summaryColIndex = headerRow.findIndex((cell) => {
    const text = normalizeHrReportText(cell);
    return text === 'tong tb' || text === 'tb thang' || text === 'tong/tb';
  });

  if (summaryColIndex < 0) {
    summaryColIndex = Math.max(headerRow.length - 2, 2);
  }

  const noteColIndex = Math.min(summaryColIndex + 1, Math.max(headerRow.length - 1, summaryColIndex));
  const dataRows: OverviewRow[] = [];

  for (const row of rows.slice(headerRowIndex + 1)) {
    const group = String(row[0] ?? '').trim();
    const metric = String(row[1] ?? '').trim();
    if (!group || !metric) continue;
    if (group.startsWith('(') || metric.startsWith('(')) continue;
    const values = row.slice(2, summaryColIndex).map((cell) => parseHrReportNumber(cell));
    dataRows.push({
      group,
      metric,
      values,
      summary: parseHrReportNumber(row[summaryColIndex]),
      note: String(row[noteColIndex] ?? '').trim(),
      raw: row,
    });
  }

  return {
    headerRowIndex,
    summaryColIndex,
    noteColIndex,
    rows: dataRows,
  };
};

export const findOverviewRow = (
  overview: OverviewTable | null,
  groupNeedles: string[],
  metricNeedles: string[]
) => {
  if (!overview) return null;
  return (
    overview.rows.find((row) => {
      const groupText = ` ${normalizeHrReportText(row.group)} `;
      const metricText = ` ${normalizeHrReportText(row.metric)} `;
      return (
        groupNeedles.every((needle) => groupText.includes(` ${normalizeHrReportText(needle)} `)) &&
        metricNeedles.every((needle) => metricText.includes(` ${normalizeHrReportText(needle)} `))
      );
    }) || null
  );
};

export const pickPeakOverviewValue = (values: number[]) => {
  let bestIndex = -1;
  let bestValue = 0;
  values.forEach((value, index) => {
    if (value > bestValue) {
      bestValue = value;
      bestIndex = index;
    }
  });
  if (bestIndex < 0 || bestValue <= 0) return null;
  return { index: bestIndex, value: bestValue };
};

const formatMetricValue = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return formatNumberPlain(value);
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('vi-VN');
};

const buildCommonUploadNotes = (
  latestUpload: LatestUploadLike,
  sheetNames: string[] | undefined,
  reportStats: ReportStatsLike
) => {
  const notes: string[] = [];
  if (latestUpload?.original_file_name) notes.push(`File gần nhất: ${latestUpload.original_file_name}.`);
  if (latestUpload?.created_at) notes.push(`Cập nhật lúc: ${formatDateTime(latestUpload.created_at)}.`);
  if (sheetNames?.length) notes.push(`Số sheet hiện có: ${sheetNames.length}.`);
  if (latestUpload?.default_sheet) notes.push(`Sheet mặc định: ${latestUpload.default_sheet}.`);
  const sheetRef = (reportStats as any)?.stats?.sheetInfo?.ref;
  if (sheetRef) notes.push(`Vùng dữ liệu parser đã đọc: ${sheetRef}.`);
  return notes;
};

const buildRangeLabel = (range?: { start_date?: string; end_date?: string }) =>
  range?.start_date && range?.end_date ? `${range.start_date} → ${range.end_date}` : 'Khoảng đang chọn';

const extractPayrollKpiSeries = (rows: GridRows, labelNeedles: string[]) => {
  const headerRowIndex = rows.findIndex((row) => normalizeHrReportText(row[0]) === 'date');
  if (headerRowIndex < 0) return [] as number[];
  const headerRow = rows[headerRowIndex];
  let dayStartCol = -1;
  for (let c = 0; c < headerRow.length; c++) {
    if (parseHrReportNumber(headerRow[c]) === 1) {
      dayStartCol = c;
      break;
    }
  }
  if (dayStartCol < 0) return [];
  let dayEndCol = dayStartCol;
  for (let c = dayStartCol; c < headerRow.length; c++) {
    const value = parseHrReportNumber(headerRow[c]);
    if (value >= 1 && value <= 31) dayEndCol = c;
  }
  const row = rows.find((item) => {
    const label = normalizeHrReportText(item[0]);
    return labelNeedles.every((needle) => label.includes(normalizeHrReportText(needle)));
  });
  if (!row) return [];
  return row.slice(dayStartCol, dayEndCol + 1).map((cell) => parseHrReportNumber(cell));
};

export function buildHrBuiltInSummary(
  reportKey: string,
  templateGrid: GridLike,
  range?: { start_date?: string; end_date?: string }
): HrSummaryPanel | null {
  if (!templateGrid) return null;

  const builtInStats = extractHrBuiltInStats(reportKey, templateGrid as any) as any;
  const rows = getPrimaryGridRows(templateGrid);
  const overview = extractOverviewTable(rows);
  const notes: string[] = [`Nguồn dữ liệu hệ thống: ${buildRangeLabel(range)}.`];
  const isSingleDay = range?.start_date && range?.end_date && range.start_date === range.end_date;

  switch (reportKey) {
    case 'attendance-rate': {
      const overall = builtInStats?.overall;
      if (!overall) return null;
      return {
        title: 'Tóm tắt tỷ lệ đi làm',
        description: 'Tổng hợp theo dữ liệu chấm công, nhà cung cấp và phạm vi thời gian đang lọc.',
        metrics: [
          { label: 'Tổng quy mô', value: formatMetricValue(overall.total), hint: 'SL' },
          { label: 'Đi làm', value: formatMetricValue(overall.attended), hint: 'ĐL' },
          { label: 'Tỷ lệ đi làm', value: `${formatMetricValue(overall.rate)}%`, hint: 'TB trong kỳ' },
        ],
        notes,
      };
    }
    case 'attendance-count': {
      const sums = builtInStats?.attendanceCount?.sums;
      if (!sums) return null;
      const snap = templateGrid?.productionSnapshot;
      const ct = Number(sums.official || 0);
      const tv = Number(sums.seasonal || 0);
      const nm = Number(sums.newEmployees || 0);
      const totalAttended = ct + tv;
      const officialShareCtTv =
        ct + tv > 0 ? ((ct / (ct + tv)) * 100).toFixed(1) : '0.0';
      notes.push(`Tỷ trọng chính thức trong khối CT+TV (tổng lượt đi làm kỳ): ${officialShareCtTv}%.`);
      if (snap) {
        const rng =
          snap.aggregationStart && snap.aggregationEnd
            ? `${snap.aggregationStart} → ${snap.aggregationEnd} (${snap.aggregationDays ?? 1} ngày)`
            : snap.snapshotDate;
        notes.push(
          `Bảng TT SX gộp kỳ ${rng}: nhân lực theo DS (ngày ${snap.snapshotDate}); đi làm / nghỉ là tổng lượt qua các ngày trong bộ lọc.`
        );
        if (snap.note) notes.push(snap.note);
      }
      return {
        title: 'Tóm tắt số lượng đi làm',
        description: snap
          ? 'Ca ngày / ca đêm; đi làm và nghỉ cộng dồn theo từng ngày trong kỳ lọc; tỉ lệ = đi làm ÷ (nhân lực × số ngày). Nhân lực hiển thị theo DS tại ngày cuối kỳ (mốc danh sách).'
          : 'So sánh nhân sự chính thức, thời vụ và biến động nhân viên mới trong kỳ.',
        metrics: [
          { label: 'Chính thức', value: formatMetricValue(sums.official), hint: snap ? 'Tổng lượt đi làm kỳ' : 'Người' },
          { label: 'Thời vụ', value: formatMetricValue(sums.seasonal), hint: snap ? 'Tổng lượt đi làm kỳ' : 'Người' },
          { label: 'Tổng đi làm', value: formatMetricValue(totalAttended), hint: snap ? 'Tổng lượt CT + TV (đã gộp NV mới)' : 'Người' },
          { label: 'Nhân viên mới', value: formatMetricValue(sums.newEmployees), hint: snap ? 'Chỉ để thống kê (đã nằm trong CT/TV)' : 'Người' },
        ],
        notes,
      };
    }
    case 'temp-timesheet':
    case 'official-timesheet': {
      const timesheet = builtInStats?.timesheet;
      if (!timesheet) return null;
      const employeeLabel = reportKey === 'temp-timesheet' ? 'Thời vụ có công' : 'Chính thức có công';
      const paidHours = reportKey === 'official-timesheet' ? timesheet?.sums?.paidHours : null;
      const attendanceRow = findOverviewRow(
        overview,
        [reportKey === 'temp-timesheet' ? 'thoi vu' : 'chinh thuc'],
        ['so nv', 'di lam']
      );
      const peak = attendanceRow ? pickPeakOverviewValue(attendanceRow.values) : null;
      if (peak) {
        notes.push(`Ngày cao điểm: ngày ${peak.index + 1} với ${formatMetricValue(peak.value)} nhân viên đi làm.`);
      }
      if (isSingleDay && Number(timesheet?.sums?.workHours || 0) <= 0 && Number(timesheet?.employeesCount || 0) > 0) {
        notes.push('Ngày đang xem đã có người đi làm nhưng giờ công chưa chốt, nên tổng giờ có thể vẫn đang bằng 0.');
      }
      return {
        title: reportKey === 'temp-timesheet' ? 'Tóm tắt chốt công thời vụ' : 'Tóm tắt chốt công chính thức',
        description: 'Tổng hợp số người có công, tổng công, tổng giờ và số liệu liên quan trong kỳ lọc.',
        metrics: [
          { label: employeeLabel, value: formatMetricValue(timesheet.employeesCount), hint: 'Người' },
          { label: 'Tổng công', value: formatMetricValue(timesheet?.sums?.workDays), hint: 'Công' },
          { label: 'Tổng giờ công', value: formatMetricValue(timesheet?.sums?.workHours), hint: 'Giờ' },
          reportKey === 'official-timesheet'
            ? { label: 'Giờ tính lương', value: formatMetricValue(paidHours), hint: 'Giờ' }
            : { label: 'OT', value: formatMetricValue(timesheet?.sums?.overtimeHours), hint: 'Giờ' },
        ],
        notes,
      };
    }
    case 'weekly-one-day-workers': {
      const overall = builtInStats?.overall;
      if (!overall) return null;
      return {
        title: 'Tóm tắt thời vụ làm 1 công/tuần',
        description: 'Phản ánh số lượng và tỷ lệ nhân sự thời vụ chỉ có 1 ngày công trong tuần.',
        metrics: [
          { label: 'Tổng thời vụ', value: formatMetricValue(overall.total), hint: 'Người' },
          { label: 'Làm 1 công', value: formatMetricValue(overall.attended), hint: 'Người' },
          { label: 'Tỷ lệ', value: `${formatMetricValue(overall.rate)}%`, hint: 'Trong kỳ' },
        ],
        notes,
      };
    }
    case 'labor-rate': {
      const totalRateRow = findOverviewRow(overview, ['tong'], ['ty le', 'di lam']);
      const officialRateRow = findOverviewRow(overview, ['chinh thuc'], ['ty le', 'di lam']);
      const seasonalRateRow = findOverviewRow(overview, ['thoi vu'], ['ty le', 'di lam']);
      const peak = totalRateRow ? pickPeakOverviewValue(totalRateRow.values) : null;
      if (peak) {
        notes.push(`Ngày có tỷ lệ nhân lực cao nhất: ngày ${peak.index + 1} với ${formatMetricValue(peak.value)}%.`);
      }
      return {
        title: 'Tóm tắt tỷ lệ nhân lực',
        description: 'Đối chiếu tỷ lệ đi làm giữa tổng thể, khối chính thức và khối thời vụ.',
        metrics: [
          { label: 'Tổng bình quân', value: `${formatMetricValue(totalRateRow?.summary)}%`, hint: 'TB tháng' },
          { label: 'Chính thức', value: `${formatMetricValue(officialRateRow?.summary)}%`, hint: 'TB tháng' },
          { label: 'Thời vụ', value: `${formatMetricValue(seasonalRateRow?.summary)}%`, hint: 'TB tháng' },
        ],
        notes,
      };
    }
    case 'daily-wage': {
      const dailyWage = builtInStats?.dailyWage;
      if (!dailyWage) return null;
      return {
        title: 'Tóm tắt tiền công hàng ngày',
        description: 'Tổng chi trả được tổng hợp tự động từ dữ liệu chấm công trong kỳ.',
        metrics: [{ label: 'Tổng chi trả', value: formatMetricValue(dailyWage.grandTotal), hint: 'VNĐ' }],
        notes,
      };
    }
    case 'payroll': {
      const payroll = builtInStats?.payroll;
      if (!payroll) return null;
      const gross = Number(payroll?.overview?.gross || 0);
      const net = Number(payroll?.overview?.net || 0);
      const tax = Number(payroll?.tax?.totalSum || 0);
      if (gross > 0) {
        notes.push(`Tỷ lệ thực nhận / gross: ${((net / gross) * 100).toFixed(1)}%.`);
      }
      return {
        title: 'Tóm tắt lương và thuế',
        description: 'Tổng hợp gross, net và thuế TNCN từ báo cáo lương tự động.',
        metrics: [
          { label: 'Gross', value: formatMetricValue(gross), hint: 'VNĐ' },
          { label: 'Net', value: formatMetricValue(net), hint: 'VNĐ' },
          { label: 'Thuế TNCN', value: formatMetricValue(tax), hint: 'VNĐ' },
        ],
        notes,
      };
    }
    case 'workforce-summary': {
      const overall = builtInStats?.overall;
      if (!overall) return null;
      const officialAttendedRow = findOverviewRow(overview, ['chinh thuc'], ['di lam']);
      const seasonalAttendedRow = findOverviewRow(overview, ['thoi vu'], ['di lam']);
      return {
        title: 'Tóm tắt tổng hợp nhân lực',
        description: 'Ảnh chụp nhân lực cuối kỳ và mức độ tham gia đi làm của các nhóm nhân sự.',
        metrics: [
          { label: 'Tổng nhân sự', value: formatMetricValue(overall.total), hint: 'Người' },
          { label: 'Đi làm', value: formatMetricValue(overall.attended), hint: 'Người' },
          { label: 'Tỷ lệ đi làm', value: `${formatMetricValue(overall.rate)}%`, hint: 'Toàn công ty' },
          { label: 'Chính thức / Thời vụ', value: `${formatMetricValue(officialAttendedRow?.summary)} / ${formatMetricValue(seasonalAttendedRow?.summary)}`, hint: 'Người đi làm' },
        ],
        notes,
      };
    }
    case 'payroll-kpi': {
      const salarySeries = extractPayrollKpiSeries(rows, ['luong theo ngay']);
      const otSeries = extractPayrollKpiSeries(rows, ['ot theo ngay']);
      const attendanceSeries = extractPayrollKpiSeries(rows, ['so nhan vien di lam theo ngay']);
      const otRateSeries = extractPayrollKpiSeries(rows, ['ty le tien ot']);
      const avgWageSeries = extractPayrollKpiSeries(rows, ['luong binh quan dau nguoi']);
      const activeAttendanceDays = attendanceSeries.filter((value) => value > 0).length;
      const peakAttendance = pickPeakOverviewValue(attendanceSeries);
      if (peakAttendance) {
        notes.push(`Ngày có số đi làm cao nhất: ngày ${peakAttendance.index + 1} với ${formatMetricValue(peakAttendance.value)} người.`);
      }
      notes.push('KPI lấy từ sheet hệ thống theo ngày, phù hợp để đối chiếu nhanh với payroll thực tế.');
      return {
        title: 'Tóm tắt KPI nhân sự',
        description: 'Tổng hợp các chỉ số lương, OT và nhân lực theo ngày trong kỳ.',
        metrics: [
          { label: 'Lương theo ngày', value: formatMetricValue(salarySeries.reduce((sum, value) => sum + value, 0)), hint: 'Tổng kỳ' },
          { label: 'OT theo ngày', value: formatMetricValue(otSeries.reduce((sum, value) => sum + value, 0)), hint: 'Tổng kỳ' },
          { label: 'Đi làm bình quân', value: formatMetricValue(activeAttendanceDays > 0 ? attendanceSeries.reduce((sum, value) => sum + value, 0) / activeAttendanceDays : 0), hint: 'Người/ngày' },
          { label: 'OT rate cao nhất', value: `${formatMetricValue(Math.max(...otRateSeries, 0))}%`, hint: 'Đỉnh kỳ' },
          { label: 'Lương bình quân', value: formatMetricValue(avgWageSeries.length ? Math.max(...avgWageSeries, 0) : 0), hint: 'K VND' },
        ],
        notes,
      };
    }
    default:
      return null;
  }
}

export function buildHrUploadSummary(
  reportKey: string,
  reportStats: ReportStatsLike,
  latestUpload: LatestUploadLike,
  sheetNames?: string[]
): HrSummaryPanel | null {
  if (!latestUpload && !reportStats) return null;

  const notes = buildCommonUploadNotes(latestUpload, sheetNames, reportStats);
  const stats = (reportStats as any)?.stats || {};

  switch (reportKey) {
    case 'bhxh-list': {
      const bhxh = stats.bhxhList;
      return {
        title: 'Tóm tắt danh sách BHXH',
        description: 'Tổng hợp nhanh các giá trị phải nộp và chênh lệch phát sinh từ file BHXH đã upload.',
        metrics: [
          { label: 'Số phải nộp', value: formatMetricValue(bhxh?.soPhaiNop?.value), hint: 'VNĐ' },
          { label: 'Phát sinh phải đóng', value: formatMetricValue(bhxh?.phatSinhPhaiDong?.value), hint: 'VNĐ' },
          { label: 'Truy thu', value: formatMetricValue(bhxh?.truyThu?.value), hint: 'VNĐ' },
          { label: 'Thừa kỳ trước', value: formatMetricValue(bhxh?.thua?.value), hint: 'VNĐ' },
        ],
        notes,
      };
    }
    case 'insurance-master': {
      const insurance = stats.insuranceMaster;
      if (insurance?.sheets?.employees) notes.push(`Sheet nhân sự chính: ${insurance.sheets.employees}.`);
      if (insurance?.sheets?.family) notes.push(`Sheet người thân: ${insurance.sheets.family}.`);
      return {
        title: 'Tóm tắt biểu mẫu bảo hiểm',
        description: 'Tổng hợp nhanh quy mô hồ sơ bảo hiểm theo dữ liệu upload mới nhất.',
        metrics: [
          { label: 'Số nhân viên', value: formatMetricValue(insurance?.employeesCount), hint: 'Hồ sơ' },
          { label: 'Người thân', value: formatMetricValue(insurance?.familyMembersCount), hint: 'Hồ sơ' },
          { label: 'Số sheet', value: formatMetricValue(sheetNames?.length ?? 0), hint: 'Sheet' },
        ],
        notes,
      };
    }
    case 'drug-inventory': {
      const drug = stats.drugInventory;
      const netQty = Number(drug?.importQty || 0) - Number(drug?.exportQty || 0);
      return {
        title: 'Tóm tắt xuất nhập tồn thuốc',
        description: 'Tổng hợp nhanh số lượng nhập, xuất và chênh lệch tồn theo file đã upload.',
        metrics: [
          { label: 'Tổng nhập', value: formatMetricValue(drug?.importQty), hint: 'Số lượng' },
          { label: 'Tổng xuất', value: formatMetricValue(drug?.exportQty), hint: 'Số lượng' },
          { label: 'Chênh lệch', value: formatMetricValue(netQty), hint: 'Nhập - xuất' },
          { label: 'Số dòng nhập / xuất', value: `${formatMetricValue(drug?.importRows)} / ${formatMetricValue(drug?.exportRows)}`, hint: 'Dòng' },
        ],
        notes,
      };
    }
    case 'medical-room-usage': {
      const medical = stats.medicalRoomUsage;
      if (medical?.sheetName) notes.push(`Sheet báo cáo đang dùng: ${medical.sheetName}.`);
      return {
        title: 'Tóm tắt sử dụng phòng y tế',
        description: 'Tổng hợp số tiền, số lượt người và tỷ lệ nổi bật từ sheet báo cáo y tế.',
        metrics: [
          { label: 'Tổng chi phí', value: formatMetricValue(medical?.money?.sum), hint: 'VNĐ' },
          { label: 'Số lượt người', value: formatMetricValue(medical?.people?.sum), hint: 'Lượt' },
          { label: 'Tỷ lệ cao nhất', value: `${formatMetricValue(medical?.rate?.max)}%`, hint: 'Đỉnh kỳ' },
        ],
        notes,
      };
    }
    case 'arrears-collection': {
      const arrears = stats.arrearsCollection;
      return {
        title: 'Tóm tắt truy thu',
        description: 'Tổng hợp nhanh giá trị truy thu lớn nhất, tổng truy thu và số lượng giá trị đã nhận diện.',
        metrics: [
          { label: 'Giá trị lớn nhất', value: formatMetricValue(arrears?.amountMax), hint: 'VNĐ' },
          { label: 'Tổng cộng', value: formatMetricValue(arrears?.amountSum), hint: 'VNĐ' },
          { label: 'Số giá trị đọc được', value: formatMetricValue(arrears?.numbersCount), hint: 'Ô số' },
        ],
        notes,
      };
    }
    default:
      return {
        title: 'Tóm tắt file upload',
        description: 'Tổng hợp nhanh tình trạng file Excel và vùng dữ liệu đã parser được.',
        metrics: [
          { label: 'Số sheet', value: formatMetricValue(sheetNames?.length ?? 0), hint: 'Sheet' },
          { label: 'Sheet mặc định', value: latestUpload?.default_sheet || '—' },
        ],
        notes: notes.length > 0 ? notes : ['Đã có file upload nhưng chưa có KPI chuyên biệt cho loại báo cáo này.'],
      };
  }
}

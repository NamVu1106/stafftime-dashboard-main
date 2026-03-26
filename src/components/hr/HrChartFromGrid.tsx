import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  extractOverviewTable,
  findOverviewRow,
  getPrimaryGridRows,
  parseHrReportNumber,
  pickPeakOverviewValue,
} from '@/lib/hrReportInsights';

type SheetItem = {
  name: string;
  rows: (string | number)[][];
};

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

type AttendanceRatePieItem = {
  name: string;
  rate: number;
  value: number;
  fullName: string;
};

function formatCompactNumber(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function extractAttendanceRatePieFromMonthlyBlock(rows: (string | number)[][]): {
  items: AttendanceRatePieItem[];
  summary: { overallRate: number; totalSl: number; totalDl: number; topByRate?: AttendanceRatePieItem; topByDl?: AttendanceRatePieItem };
} | null {
  const headerRowIndex = rows.findIndex((row) => {
    const first = String(row[0] ?? '').trim().toLowerCase();
    const second = String(row[1] ?? '').trim().toLowerCase();
    return first === 'no' && second === 'vendor';
  });
  if (headerRowIndex < 0) return null;

  const dataRows = rows.slice(headerRowIndex + 3);
  const items: AttendanceRatePieItem[] = [];
  let totalSlAll = 0;
  let totalDlAll = 0;
  let foundTotalRow = false;

  for (const row of dataRows) {
    const vendor = String(row[1] ?? '').trim();
    if (!vendor) continue;

    const monthSl = parseHrReportNumber(row[2]);
    const monthDl = parseHrReportNumber(row[3]);
    if (/^total$/i.test(vendor)) {
      totalSlAll = monthSl;
      totalDlAll = monthDl;
      foundTotalRow = monthSl > 0 || monthDl > 0;
      continue;
    }
    if (/^vendor$/i.test(vendor) || vendor.startsWith('(')) continue;
    if (monthSl <= 0 && monthDl <= 0) continue;

    const rate = monthSl > 0 ? (monthDl * 100) / monthSl : 0;
    items.push({
      name: vendor.length > 14 ? vendor.slice(0, 14) + '…' : vendor,
      fullName: vendor,
      rate: Math.round(rate * 10) / 10,
      value: monthDl,
    });
  }

  if (!items.length) return null;
  if (!foundTotalRow) {
    totalSlAll = items.reduce((sum, item) => sum + (item.rate > 0 ? (item.value * 100) / item.rate : 0), 0);
    totalDlAll = items.reduce((sum, item) => sum + item.value, 0);
  }

  items.sort((a, b) => b.value - a.value);
  const topByRate = [...items].sort((a, b) => b.rate - a.rate)[0];
  const topByDl = items[0];
  const overallRate = totalSlAll > 0 ? (totalDlAll * 100) / totalSlAll : 0;

  return {
    items: items.slice(0, 10),
    summary: {
      overallRate: Math.round(overallRate * 10) / 10,
      totalSl: Math.round(totalSlAll * 10) / 10,
      totalDl: Math.round(totalDlAll * 10) / 10,
      topByRate,
      topByDl,
    },
  };
}

function extractAttendanceRatePie(rows: (string | number)[][]): {
  items: AttendanceRatePieItem[];
  summary: { overallRate: number; totalSl: number; totalDl: number; topByRate?: AttendanceRatePieItem; topByDl?: AttendanceRatePieItem };
} | null {
  const monthlyBlock = extractAttendanceRatePieFromMonthlyBlock(rows);
  if (monthlyBlock) return monthlyBlock;
  if (!rows?.length) return null;
  const dataRows = rows.slice(4); // Bỏ 4 dòng đầu (mô tả + header)
  const items: AttendanceRatePieItem[] = [];

  let totalSlAll = 0;
  let totalDlAll = 0;

  for (const row of dataRows) {
    const vendor = String(row[1] ?? '').trim();
    if (!vendor || vendor.startsWith('(')) continue;

    let sumSl = 0;
    let sumDl = 0;
    for (let c = 2; c < row.length; c += 9) {
      const tSl = parseHrReportNumber(row[c]);
      const tDl = parseHrReportNumber(row[c + 1]);
      sumSl += tSl;
      sumDl += tDl;
    }

    if (sumSl <= 0 && sumDl <= 0) continue;
    const rate = sumSl > 0 ? (sumDl * 100) / sumSl : 0;
    totalSlAll += sumSl;
    totalDlAll += sumDl;

    items.push({
      name: vendor.length > 14 ? vendor.slice(0, 14) + '…' : vendor,
      fullName: vendor,
      rate: Math.round(rate * 10) / 10,
      value: sumDl,
    });
  }

  if (!items.length) return null;
  items.sort((a, b) => b.value - a.value);

  const topByRate = [...items].sort((a, b) => b.rate - a.rate)[0];
  const topByDl = items[0];
  const overallRate = totalSlAll > 0 ? (totalDlAll * 100) / totalSlAll : 0;

  return {
    items: items.slice(0, 10),
    summary: {
      overallRate: Math.round(overallRate * 10) / 10,
      totalSl: Math.round(totalSlAll),
      totalDl: Math.round(totalDlAll),
      topByRate,
      topByDl,
    },
  };
}

type SplitPieItem = { name: string; value: number; fullName: string };

type ComparisonSummaryRow = { label: string; value: string };

function extractSplitPieChart(
  rows: (string | number)[][],
  title: string,
  configs: Array<{ label: string; groupNeedles: string[]; metricNeedles: string[] }>,
  extraSummary: (overview: ReturnType<typeof extractOverviewTable>) => ComparisonSummaryRow[]
): { type: 'split-pie'; title: string; items: SplitPieItem[]; summaryRows: ComparisonSummaryRow[] } | null {
  const overview = extractOverviewTable(rows);
  if (!overview) return null;
  const items = configs
    .map((config) => {
      const row = findOverviewRow(overview, config.groupNeedles, config.metricNeedles);
      const value = Number(row?.summary || 0);
      return value > 0
        ? {
            name: config.label,
            fullName: config.label,
            value,
          }
        : null;
    })
    .filter((item): item is SplitPieItem => !!item);

  if (!items.length) return null;

  return {
    type: 'split-pie',
    title,
    items,
    summaryRows: extraSummary(overview),
  };
}

function extractLaborRateBars(rows: (string | number)[][]) {
  const overview = extractOverviewTable(rows);
  if (!overview) return null;
  const totalRateRow = findOverviewRow(overview, ['tong'], ['ty le', 'di lam']);
  const officialRateRow = findOverviewRow(overview, ['chinh thuc'], ['ty le', 'di lam']);
  const seasonalRateRow = findOverviewRow(overview, ['thoi vu'], ['ty le', 'di lam']);
  const items = [
    { name: 'Tổng', value: Number(totalRateRow?.summary || 0) },
    { name: 'Chính thức', value: Number(officialRateRow?.summary || 0) },
    { name: 'Thời vụ', value: Number(seasonalRateRow?.summary || 0) },
  ];
  if (!items.some((item) => item.value > 0)) return null;
  const peak = totalRateRow ? pickPeakOverviewValue(totalRateRow.values) : null;
  return {
    type: 'rate-bars' as const,
    title: 'Biểu đồ: Tỷ lệ nhân lực bình quân',
    items,
    summaryRows: [
      { label: 'Tổng bình quân', value: `${formatCompactNumber(items[0].value)}%` },
      { label: 'Chính thức', value: `${formatCompactNumber(items[1].value)}%` },
      { label: 'Thời vụ', value: `${formatCompactNumber(items[2].value)}%` },
      ...(peak ? [{ label: 'Ngày cao nhất', value: `${peak.index + 1} (${formatCompactNumber(peak.value)}%)` }] : []),
    ],
  };
}

function extractTimesheetDailyBars(rows: (string | number)[][], groupNeedle: string, title: string, extraMetricNeedle: string[]) {
  const overview = extractOverviewTable(rows);
  if (!overview) return null;
  const attendanceRow = findOverviewRow(overview, [groupNeedle], ['so nv', 'di lam']);
  if (!attendanceRow) return null;

  const workdayRow = findOverviewRow(overview, [groupNeedle], ['tong cong']);
  const workHoursRow = findOverviewRow(overview, [groupNeedle], ['tong gio cong']);
  const extraRow = findOverviewRow(overview, [groupNeedle], extraMetricNeedle);
  const items = attendanceRow.values
    .map((value, index) => ({ name: `${index + 1}`, value }))
    .filter((item) => item.value > 0);

  if (!items.length) return null;
  const peak = pickPeakOverviewValue(attendanceRow.values);
  return {
    type: 'daily-bars' as const,
    title,
    items,
    summaryRows: [
      { label: 'Tổng lượt đi làm', value: formatCompactNumber(attendanceRow.summary || items.reduce((sum, item) => sum + item.value, 0)) },
      { label: 'Tổng công', value: formatCompactNumber(workdayRow?.summary || 0) },
      { label: 'Tổng giờ công', value: formatCompactNumber(workHoursRow?.summary || 0) },
      {
        label: extraMetricNeedle.some((needle) => needle.includes('tinh luong')) ? 'Giờ tính lương' : 'OT',
        value: formatCompactNumber(extraRow?.summary || 0),
      },
      ...(peak ? [{ label: 'Ngày cao nhất', value: `${peak.index + 1} (${formatCompactNumber(peak.value)})` }] : []),
    ],
  };
}

interface HrChartFromGridProps {
  reportType: string;
  /** Grid từ API: { rows } hoặc { sheets: [{ name, rows }] } */
  templateGrid: { rows?: (string | number)[][]; sheets?: SheetItem[] } | null;
  className?: string;
}

export function HrChartFromGrid({ reportType, templateGrid, className = '' }: HrChartFromGridProps) {
  const chartData = useMemo(() => {
    if (!templateGrid) return null;
    const rows = getPrimaryGridRows(templateGrid);
    if (!rows?.length) return null;

    switch (reportType) {
      case 'attendance-rate': {
        const extracted = extractAttendanceRatePie(rows);
        return extracted ? { type: 'attendance-rate' as const, ...extracted } : null;
      }
      case 'attendance-count':
        return extractSplitPieChart(
          rows,
          'Biểu đồ: Cơ cấu đi làm chính thức vs thời vụ',
          [
            { label: 'Chính thức', groupNeedles: ['chinh thuc'], metricNeedles: ['so di lam'] },
            { label: 'Thời vụ', groupNeedles: ['thoi vu'], metricNeedles: ['so di lam'] },
          ],
          (overview) => {
            const totalRow = findOverviewRow(overview, ['toan bo'], ['tong di lam']);
            const newEmployeesRow = findOverviewRow(overview, ['he thong'], ['nhan vien moi']);
            return [
              { label: 'Tổng đi làm', value: formatCompactNumber(totalRow?.summary || 0) },
              { label: 'Nhân viên mới', value: formatCompactNumber(newEmployeesRow?.summary || 0) },
            ];
          }
        );
      case 'workforce-summary':
        return extractSplitPieChart(
          rows,
          'Biểu đồ: Cơ cấu đi làm theo loại hình',
          [
            { label: 'Chính thức', groupNeedles: ['chinh thuc'], metricNeedles: ['di lam'] },
            { label: 'Thời vụ', groupNeedles: ['thoi vu'], metricNeedles: ['di lam'] },
          ],
          (overview) => {
            const totalRow = findOverviewRow(overview, ['toan cong ty'], ['tong nhan su']);
            const attendedRow = findOverviewRow(overview, ['toan cong ty'], ['di lam']);
            const rateRow = findOverviewRow(overview, ['toan cong ty'], ['ty le', 'di lam']);
            const peak = attendedRow ? pickPeakOverviewValue(attendedRow.values) : null;
            return [
              { label: 'Tổng nhân sự', value: formatCompactNumber(totalRow?.summary || 0) },
              { label: 'Đi làm', value: formatCompactNumber(attendedRow?.summary || 0) },
              { label: 'Tỷ lệ', value: `${formatCompactNumber(rateRow?.summary || 0)}%` },
              ...(peak ? [{ label: 'Ngày cao nhất', value: `${peak.index + 1} (${formatCompactNumber(peak.value)})` }] : []),
            ];
          }
        );
      case 'labor-rate':
        return extractLaborRateBars(rows);
      case 'temp-timesheet':
        return extractTimesheetDailyBars(rows, 'thoi vu', 'Biểu đồ: Đi làm thời vụ theo ngày', ['ot']);
      case 'official-timesheet':
        return extractTimesheetDailyBars(rows, 'chinh thuc', 'Biểu đồ: Đi làm chính thức theo ngày', ['total tinh luong']);
      default:
        return null;
    }
  }, [reportType, templateGrid]);

  if (!chartData) return null;

  if (chartData.type === 'attendance-rate') {
    const { items, summary } = chartData;
    const topRate = summary.topByRate;
    const topDl = summary.topByDl;

    return (
      <div className={`rounded-lg border bg-card p-3 ${className}`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-center">
          <div>
            <h4 className="text-xs font-semibold mb-1">Biểu đồ: Tỉ trọng đi làm trung bình theo NCC</h4>
            <div className="h-[176px] w-full min-w-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={items}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={74}
                    isAnimationActive={false}
                  >
                    {items.map((item, i) => (
                      <Cell key={`${item.fullName}-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, _name: any, payload: any) => {
                      const rate = payload?.[0]?.payload?.rate;
                      const n = typeof value === 'number' ? value : 0;
                      return [`${formatCompactNumber(n)} đi làm TB/ngày`, rate != null ? `Tỉ lệ TB: ${rate}%` : ''];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded border bg-muted/20 p-2.5">
            <div className="text-xs font-semibold mb-1.5">Báo cáo tổng hợp nhanh</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Tỉ lệ đi làm TB</span>
                <span className="font-semibold shrink-0">{summary.overallRate}%</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Đi làm TB / SL TB</span>
                <span className="font-semibold shrink-0">
                  {formatCompactNumber(summary.totalDl)} / {formatCompactNumber(summary.totalSl)}
                </span>
              </div>
              {topDl && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground truncate">NCC ĐL TB cao nhất</span>
                  <span className="font-semibold shrink-0 truncate max-w-[120px]" title={topDl.fullName}>{topDl.name}</span>
                </div>
              )}
              {topRate && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground truncate">NCC tỉ lệ cao nhất</span>
                  <span className="font-semibold shrink-0 truncate max-w-[120px]" title={topRate.fullName}>{topRate.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (chartData.type === 'split-pie') {
    const { items, title, summaryRows } = chartData;
    return (
      <div className={`rounded-lg border bg-card p-3 ${className}`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-center">
          <div>
            <h4 className="text-xs font-semibold mb-1">{title}</h4>
            <div className="h-[200px] w-full min-w-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={items} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88} isAnimationActive={false}>
                    {items.map((item, i) => (
                      <Cell key={`${item.fullName}-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [`${Number(value || 0).toLocaleString()}`, 'Giá trị']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded border bg-muted/20 p-2">
            <div className="text-xs font-semibold mb-1.5">Báo cáo tổng hợp nhanh</div>
            <div className="space-y-1 text-xs">
              {summaryRows.map((row, index) => (
                <div key={`${row.label}-${row.value}-${index}`} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-semibold truncate max-w-[160px]">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (chartData.type === 'rate-bars') {
    return (
      <div className={`rounded-lg border bg-card p-3 ${className}`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-center">
          <div>
            <h4 className="text-xs font-semibold mb-1">{chartData.title}</h4>
            <div className="h-[220px] w-full min-w-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.items}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(value: any) => [`${formatCompactNumber(Number(value || 0))}%`, 'Tỷ lệ']} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.items.map((item, index) => (
                      <Cell key={`${item.name}-${item.value}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded border bg-muted/20 p-2">
            <div className="text-xs font-semibold mb-1.5">Báo cáo tổng hợp nhanh</div>
            <div className="space-y-1 text-xs">
              {chartData.summaryRows.map((row, index) => (
                <div key={`${row.label}-${row.value}-${index}`} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-semibold truncate max-w-[160px]">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (chartData.type === 'daily-bars') {
    return (
      <div className={`rounded-lg border bg-card p-3 ${className}`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-center">
          <div>
            <h4 className="text-xs font-semibold mb-1">{chartData.title}</h4>
            <div className="h-[220px] w-full min-w-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.items}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(value: any) => [formatCompactNumber(Number(value || 0)), 'Số đi làm']} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} fill={CHART_COLORS[0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded border bg-muted/20 p-2">
            <div className="text-xs font-semibold mb-1.5">Báo cáo tổng hợp nhanh</div>
            <div className="space-y-1 text-xs">
              {chartData.summaryRows.map((row, index) => (
                <div key={`${row.label}-${row.value}-${index}`} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-semibold truncate max-w-[160px]">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

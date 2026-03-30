import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExcelGrid } from '@/components/shared/ExcelGrid';
import { employeesAPI, hrExcelAPI, hrTemplatesAPI, vendorAssignmentsAPI } from '@/services/api';
import { formatNumberPlain } from '@/lib/utils';
import { hasBuiltInGrid } from '@/data/hrReportTemplates';
import { HR_REPORT_DEFS } from '@/data/hrReportDefs';
import { filterBuiltInTimesheetSheet, findTimesheetHeaderRowIndex } from '@/lib/hrAttendanceListFilter';
import { buildHrBuiltInSummary, buildHrUploadSummary } from '@/lib/hrReportInsights';
import { useTimeFilterOptional } from '@/contexts/TimeFilterContext';
import type { AttendanceCountProductionSnapshot } from '@/lib/hrBuiltInStats';
import { AttendanceCountSnapshotPanel } from './AttendanceCountSnapshotPanel';
import { HrChartFromGrid } from './HrChartFromGrid';
import { useI18n } from '@/hooks/useI18n';

const MAX_VENDOR_EDITOR_ROWS = 200;

function safeParseSheetNames(sheetNamesRaw: any): string[] {
  if (!sheetNamesRaw) return [];
  if (Array.isArray(sheetNamesRaw)) return sheetNamesRaw.map(String);
  if (typeof sheetNamesRaw === 'string') {
    try {
      const v = JSON.parse(sheetNamesRaw);
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function formatYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function calendarMonthRangeFromYm(ym: string): { start: string; end: string } {
  const [y, mo] = ym.split('-').map(Number);
  const start = new Date(y, mo - 1, 1);
  const end = new Date(y, mo, 0);
  return { start: formatYmdLocal(start), end: formatYmdLocal(end) };
}

/** Giá trị input type=month khi start/end đúng cả tháng lịch */
function fullCalendarMonthValue(start: string, end: string): string {
  if (!start || !end || start.slice(0, 7) !== end.slice(0, 7)) return '';
  const [y, m] = start.split('-').map(Number);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastD = new Date(y, m, 0).getDate();
  const last = `${y}-${String(m).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
  return start === first && end === last ? start.slice(0, 7) : '';
}

/** Nhập Vendor trên cùng trang Tỉ lệ đi làm — lưu xong grid bên dưới cập nhật theo NCC */
function InlineVendorNccPanel({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('');
  const [vendorDraft, setVendorDraft] = useState<Record<string, string>>({});
  const [draftDirty, setDraftDirty] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [quickCode, setQuickCode] = useState('');
  const [quickVendor, setQuickVendor] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: emps = [], isLoading: loadingEmps } = useQuery({
    queryKey: ['employees', 'inline-vendor-thoi-vu'],
    queryFn: async () => {
      const r = await employeesAPI.getAll({ employment_type: 'Thời vụ' });
      let list = Array.isArray(r) ? r : [];
      if (!list.length) {
        const r2 = await employeesAPI.getAll();
        list = (Array.isArray(r2) ? r2 : []).filter((e: any) =>
          /thời|seasonal|비정규|temp/i.test(String(e.employment_type || ''))
        );
      }
      return [...list].sort((a: any, b: any) =>
        String(a.employee_code ?? '').localeCompare(String(b.employee_code ?? ''))
      );
    },
  });

  const { data: vaData, isLoading: loadingVa, isError: vaError } = useQuery({
    queryKey: ['vendor-assignments'],
    queryFn: () => vendorAssignmentsAPI.list(),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const items = vaData?.items ?? [];

  const itemsSignature = useMemo(() => items.map((i) => `${i.employee_code}:${i.vendor_name}`).join('|'), [items]);
  const empsSignature = useMemo(() => emps.map((e: any) => String(e.employee_code ?? '')).join('|'), [emps]);

  useEffect(() => {
    if (loadingEmps || loadingVa || draftDirty) return;
    const vaMap = new Map(items.map((i) => [i.employee_code.toUpperCase(), i.vendor_name]));
    const m: Record<string, string> = {};
    if (emps.length) {
      for (const e of emps) {
        const c = String(e.employee_code ?? '').toUpperCase();
        if (!c) continue;
        m[c] = vaMap.get(c) ?? '';
      }
    } else {
      for (const it of items) {
        const c = it.employee_code.toUpperCase();
        m[c] = it.vendor_name ?? '';
      }
    }
    setVendorDraft((prev) => {
      const next = { ...m };
      if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
      return next;
    });
  }, [loadingEmps, loadingVa, draftDirty, itemsSignature, empsSignature]);

  const syncMut = useMutation({
    mutationFn: () => {
      if (emps.length) {
        return vendorAssignmentsAPI.sync(
          emps.map((e: any) => ({
            employee_code: String(e.employee_code ?? ''),
            vendor_name: (vendorDraft[String(e.employee_code ?? '').toUpperCase()] ?? '').trim(),
          }))
        );
      }
      const codes = [...new Set(items.map((i) => i.employee_code.toUpperCase()))];
      return vendorAssignmentsAPI.sync(
        codes.map((c) => ({
          employee_code: c,
          vendor_name: (vendorDraft[c] ?? '').trim(),
        }))
      );
    },
    onSuccess: async (d) => {
      toast.success(
        t('hrReport.toastSaveVendorOk', { saved: String(d.saved), removed: String(d.removed) })
      );
      await qc.refetchQueries({ queryKey: ['vendor-assignments'] });
      setDraftDirty(false);
      await qc.invalidateQueries({ queryKey: ['hrTemplates', 'grid', 'attendance-rate', startDate, endDate] });
    },
    onError: (e: any) => toast.error(e?.message || t('hrReport.toastSaveVendorFail')),
  });

  const uploadMut = useMutation({
    mutationFn: (f: File) => vendorAssignmentsAPI.upload(f),
    onSuccess: async (d) => {
      toast.success(d.message || t('hrReport.toastImportOk', { n: String(d.upserted ?? 0) }));
      await qc.refetchQueries({ queryKey: ['vendor-assignments'] });
      setDraftDirty(false);
      await qc.invalidateQueries({ queryKey: ['hrTemplates', 'grid', 'attendance-rate', startDate, endDate] });
    },
    onError: (e: any) => toast.error(e?.message || t('hrReport.toastImportFail')),
  });

  const addOneMut = useMutation({
    mutationFn: () =>
      vendorAssignmentsAPI.save([
        { employee_code: quickCode.trim().toUpperCase(), vendor_name: quickVendor.trim() },
      ]),
    onSuccess: async () => {
      toast.success(t('hrReport.toastQuickAssignOk'));
      setQuickCode('');
      setQuickVendor('');
      setDraftDirty(false);
      await qc.refetchQueries({ queryKey: ['vendor-assignments'] });
      await qc.invalidateQueries({ queryKey: ['hrTemplates', 'grid', 'attendance-rate', startDate, endDate] });
    },
    onError: (e: any) => toast.error(e?.message || t('hrReport.toastQuickAssignFail')),
  });

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return emps;
    return emps.filter(
      (e: any) =>
        String(e.employee_code || '').toLowerCase().includes(q) ||
        String(e.name || '').toLowerCase().includes(q)
    );
  }, [emps, filter]);

  const itemsFiltered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.employee_code.toLowerCase().includes(q) ||
        (i.vendor_name || '').toLowerCase().includes(q)
    );
  }, [items, filter]);

  const editableCodes = useMemo(() => {
    const employeeCodes = emps.map((e: any) => String(e.employee_code ?? '').toUpperCase()).filter(Boolean);
    const mappedCodes = items.map((item) => item.employee_code.toUpperCase()).filter(Boolean);
    return [...new Set([...employeeCodes, ...mappedCodes])];
  }, [emps, items]);

  const assignedCount = useMemo(
    () => editableCodes.filter((code) => String(vendorDraft[code] ?? '').trim()).length,
    [editableCodes, vendorDraft]
  );

  const vendorTableState = useMemo(() => {
    const hasFilter = filter.trim().length > 0;

    if (emps.length > 0) {
      const assignedEmployees = emps.filter((e: any) => {
        const code = String(e.employee_code ?? '').toUpperCase();
        return String(vendorDraft[code] ?? '').trim();
      });
      const source = hasFilter ? filtered : assignedEmployees.length > 0 ? assignedEmployees : filtered;
      return {
        mode: 'employees' as const,
        rows: source.slice(0, MAX_VENDOR_EDITOR_ROWS),
        total: source.length,
        truncated: source.length > MAX_VENDOR_EDITOR_ROWS,
        hasFilter,
        prefersAssigned: !hasFilter && assignedEmployees.length > 0,
      };
    }

    return {
      mode: 'assignments' as const,
      rows: itemsFiltered.slice(0, MAX_VENDOR_EDITOR_ROWS),
      total: itemsFiltered.length,
      truncated: itemsFiltered.length > MAX_VENDOR_EDITOR_ROWS,
      hasFilter,
      prefersAssigned: false,
    };
  }, [emps, filter, filtered, itemsFiltered, vendorDraft]);

  const loadingPanel = loadingEmps || loadingVa;

  useEffect(() => {
    if (vaError) setIsEditorOpen(true);
  }, [vaError]);

  return (
    <Collapsible open={isEditorOpen} onOpenChange={setIsEditorOpen}>
      <Card className="mb-4 border-primary/20 bg-muted/30">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-sm">{t('hrReport.vendorPanelTitle')}</CardTitle>
              <CardDescription>
                {editableCodes.length > 0
                  ? t('hrReport.vendorAssignedHint', {
                      assigned: String(assignedCount),
                      total: String(editableCodes.length),
                    })
                  : t('hrReport.vendorNoDataHint')}
              </CardDescription>
            </div>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto">
                {isEditorOpen ? t('hrReport.vendorCollapseClose') : t('hrReport.vendorCollapseOpen')}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            {loadingPanel ? (
              <div className="text-sm text-muted-foreground py-2">{t('hrReport.loading')}</div>
            ) : null}
            {vaError ? (
              <div className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-2">
                {t('hrReport.vendorApiError')}
              </div>
            ) : null}

            <div className="rounded-lg border bg-background p-3 space-y-2">
              <div className="text-sm font-medium">{t('hrReport.quickAddTitle')}</div>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="w-[140px]">
                  <Label htmlFor="vendor-quick-code">{t('hrReport.labelEmployeeCode')}</Label>
                  <Input
                    id="vendor-quick-code"
                    value={quickCode}
                    onChange={(e) => setQuickCode(e.target.value)}
                    placeholder={t('hrReport.placeholderCodeExample')}
                    className="font-mono"
                  />
                </div>
                <div className="flex-1 min-w-[180px]">
                  <Label htmlFor="vendor-quick-ncc">{t('hrReport.labelVendor')}</Label>
                  <Input
                    id="vendor-quick-ncc"
                    value={quickVendor}
                    onChange={(e) => setQuickVendor(e.target.value)}
                    placeholder={t('hrReport.placeholderVendorName')}
                  />
                </div>
                <Button
                  type="button"
                  disabled={!quickCode.trim() || !quickVendor.trim() || addOneMut.isPending}
                  onClick={() => addOneMut.mutate()}
                >
                  {addOneMut.isPending ? t('hrReport.savePending') : t('hrReport.addMapping')}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 items-end">
              {emps.length > 0 ? (
                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="vendor-filter-nv">{t('hrReport.filterCodeName')}</Label>
                  <Input
                    id="vendor-filter-nv"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder={t('hrReport.searchPlaceholder')}
                  />
                </div>
              ) : items.length > 0 ? (
                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="vendor-filter-va">{t('hrReport.filterCodeVendor')}</Label>
                  <Input
                    id="vendor-filter-va"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder={t('hrReport.searchPlaceholder')}
                  />
                </div>
              ) : null}
              <Button
                type="button"
                onClick={() => syncMut.mutate()}
                disabled={syncMut.isPending || (emps.length === 0 && items.length === 0)}
              >
                {syncMut.isPending
                  ? t('hrReport.savePending')
                  : emps.length
                    ? t('hrReport.saveTableEmployees')
                    : t('hrReport.saveTableBelow')}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadMut.mutate(f);
                  e.target.value = '';
                }}
              />
              <Button type="button" variant="outline" disabled={uploadMut.isPending} onClick={() => fileRef.current?.click()}>
                {uploadMut.isPending ? t('hrReport.importPending') : t('hrReport.importExcel')}
              </Button>
            </div>

            <div className="max-h-60 overflow-auto border rounded-md text-sm bg-background">
              {(emps.length > MAX_VENDOR_EDITOR_ROWS || items.length > MAX_VENDOR_EDITOR_ROWS) && (
                <div className="border-b bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  {vendorTableState.hasFilter
                    ? `Kết quả đang khớp ${formatNumberPlain(vendorTableState.total)} dòng.`
                    : vendorTableState.prefersAssigned
                      ? `Đang ưu tiên hiển thị ${formatNumberPlain(vendorTableState.total)} mã đã gán NCC.`
                      : `Đang có ${formatNumberPlain(emps.length || items.length)} dòng dữ liệu NCC.`}{' '}
                  {vendorTableState.truncated
                    ? `Chỉ hiển thị ${formatNumberPlain(MAX_VENDOR_EDITOR_ROWS)} dòng đầu để tránh treo trình duyệt. Hãy lọc theo Mã NV / tên hoặc dùng Import Excel khi cần chỉnh hàng loạt.`
                    : null}
                </div>
              )}
              <table className="w-full">
                <thead className="bg-muted sticky top-0 z-[1]">
                  <tr>
                    <th className="text-left p-2">{t('hrReport.tableHeaderCode')}</th>
                    <th className="text-left p-2">{t('hrReport.tableHeaderName')}</th>
                    <th className="text-left p-2 min-w-[220px]">{t('hrReport.tableHeaderVendor')}</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorTableState.mode === 'employees'
                    ? vendorTableState.rows.map((e: any) => {
                        const c = String(e.employee_code ?? '').toUpperCase();
                        return (
                          <tr key={e.id ?? c} className="border-t border-border/60">
                            <td className="p-2 font-mono text-xs">{e.employee_code}</td>
                            <td className="p-2">{e.name ?? '—'}</td>
                            <td className="p-1 pr-2">
                              <Input
                                className="h-8 text-sm"
                                value={vendorDraft[c] ?? ''}
                                onChange={(ev) => {
                                  setDraftDirty(true);
                                  setVendorDraft((p) => ({ ...p, [c]: ev.target.value }));
                                }}
                                placeholder={t('hrReport.placeholderVendorName')}
                              />
                            </td>
                          </tr>
                        );
                      })
                    : vendorTableState.total > 0
                      ? vendorTableState.rows.map((i) => {
                          const c = i.employee_code.toUpperCase();
                          return (
                            <tr key={c} className="border-t border-border/60">
                              <td className="p-2 font-mono text-xs">{i.employee_code}</td>
                              <td className="p-2 text-muted-foreground">—</td>
                              <td className="p-1 pr-2">
                                <Input
                                  className="h-8 text-sm"
                                  value={vendorDraft[c] ?? ''}
                                  onChange={(ev) => {
                                    setDraftDirty(true);
                                    setVendorDraft((p) => ({ ...p, [c]: ev.target.value }));
                                  }}
                                  placeholder={t('hrReport.placeholderVendorName')}
                                />
                              </td>
                            </tr>
                          );
                        })
                      : !loadingPanel && (
                          <tr>
                            <td colSpan={3} className="p-4 text-center text-muted-foreground text-sm">
                              {t('hrReport.emptyVendorHint')}
                            </td>
                          </tr>
                        )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface HrReportContentProps {
  reportType: string;
  /** Khi embed inline (không có padding wrapper) */
  compact?: boolean;
}

export const HrReportContent = ({ reportType, compact }: HrReportContentProps) => {
  const { t } = useI18n();
  const reportKey = reportType || '';
  const reportDef = HR_REPORT_DEFS[reportKey];
  const isBuiltIn = hasBuiltInGrid(reportKey);
  const isBuiltInTimesheetReport = reportKey === 'official-timesheet' || reportKey === 'temp-timesheet';
  /** Chỉ cần số liệu + biểu đồ, không render bảng Excel (nhẹ trang). */
  const isStatsOnlyBuiltInReport = reportKey === 'attendance-count';

  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [activeTemplateSheet, setActiveTemplateSheet] = useState<string>('');
  const [attendanceTab, setAttendanceTab] = useState<'overview' | 'detail'>('overview');
  const [rowLimit, setRowLimit] = useState<number>(200);
  const [colLimit, setColLimit] = useState<number>(80);
  const [builtInTimesheetCodeSearch, setBuiltInTimesheetCodeSearch] = useState('');
  const [builtInTimesheetNameSearch, setBuiltInTimesheetNameSearch] = useState('');
  const [timesheetStart, setTimesheetStart] = useState('');
  const [timesheetEnd, setTimesheetEnd] = useState('');

  const {
    data: latestUpload,
    isLoading: loadingLatest,
    refetch: refetchLatest,
  } = useQuery({
    queryKey: ['hrExcel', 'latest', reportKey],
    queryFn: () => hrExcelAPI.getLatest(reportKey),
    enabled: !!reportKey && !isBuiltIn,
  });

  const sheetNames = useMemo(() => safeParseSheetNames((latestUpload as any)?.sheet_names), [latestUpload]);

  useEffect(() => {
    setSelectedSheet('');
    setAttendanceTab('overview');
  }, [reportKey]);

  useEffect(() => {
    if (!latestUpload) {
      setSelectedSheet('');
      return;
    }

    const defRow = reportDef?.defaultRowLimit ?? 200;
    const defCol = reportDef?.defaultColLimit ?? 80;
    setRowLimit(defRow);
    setColLimit(defCol);

    const defaultSheet = (latestUpload as any)?.default_sheet as string | undefined;
    const initial = defaultSheet || sheetNames[0] || '';
    setSelectedSheet((prev) => {
      if (prev && sheetNames.includes(prev)) {
        return prev;
      }
      return initial;
    });
  }, [(latestUpload as any)?.id, reportKey, sheetNames, reportDef?.defaultRowLimit, reportDef?.defaultColLimit]);

  const uploadMutation = useMutation({
    mutationFn: async (f: File) => {
      return hrExcelAPI.upload(reportKey, f);
    },
    onSuccess: async () => {
      toast.success(t('hrReport.toastUploadOk'));
      setFile(null);
      setSelectedSheet('');
      await queryClient.invalidateQueries({ queryKey: ['hrExcel', 'latest', reportKey] });
      await refetchLatest();
    },
    onError: (err: any) => {
      toast.error(err?.message || t('hrReport.toastUploadFail'));
    },
  });

  const {
    data: sheetView,
    isLoading: loadingSheet,
    error: sheetError,
  } = useQuery({
    queryKey: ['hrExcel', 'sheet', (latestUpload as any)?.id, selectedSheet, rowLimit, colLimit],
    queryFn: () =>
      hrExcelAPI.getSheet((latestUpload as any).id, selectedSheet, {
        rowStart: 0,
        rowLimit,
        colStart: 0,
        colLimit,
      }),
    enabled: !!(latestUpload as any)?.id && !!selectedSheet,
  });

  const { data: reportStats } = useQuery({
    queryKey: ['hrExcel', 'stats', reportKey],
    queryFn: () => hrExcelAPI.getStats(reportKey),
    enabled: !!reportKey && !isBuiltIn,
  });

  const timeFilter = useTimeFilterOptional();
  const defaultBuiltInRange = useMemo(() => {
    if (timeFilter?.params?.start_date && timeFilter?.params?.end_date) {
      return { start_date: timeFilter.params.start_date, end_date: timeFilter.params.end_date };
    }
    if (timeFilter?.filterMode === 'month' && timeFilter?.baseDate) {
      const { start, end } = timeFilter.getMonthRange(timeFilter.baseDate);
      return { start_date: start, end_date: end };
    }
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return {
      start_date: `${y}-${m}-01`,
      end_date: `${y}-${m}-${new Date(y, now.getMonth() + 1, 0).getDate()}`,
    };
  }, [
    timeFilter?.params?.start_date,
    timeFilter?.params?.end_date,
    timeFilter?.filterMode,
    timeFilter?.baseDate,
  ]);

  const gridParams = useMemo(() => {
    if (
      isBuiltInTimesheetReport &&
      timesheetStart &&
      timesheetEnd &&
      timesheetStart <= timesheetEnd
    ) {
      return { start_date: timesheetStart, end_date: timesheetEnd };
    }
    return defaultBuiltInRange;
  }, [isBuiltInTimesheetReport, timesheetStart, timesheetEnd, defaultBuiltInRange]);

  useEffect(() => {
    if (!isBuiltInTimesheetReport) return;
    setTimesheetStart(defaultBuiltInRange.start_date);
    setTimesheetEnd(defaultBuiltInRange.end_date);
  }, [isBuiltInTimesheetReport, defaultBuiltInRange.start_date, defaultBuiltInRange.end_date, reportKey]);

  const { data: templateGrid, isLoading: loadingGrid } = useQuery({
    queryKey: [
      'hrTemplates',
      'grid',
      reportKey,
      gridParams.start_date,
      gridParams.end_date,
      isStatsOnlyBuiltInReport ? 'summary' : 'full',
    ],
    queryFn: () =>
      hrTemplatesAPI.getGrid(reportKey, {
        ...gridParams,
        summary_only: isStatsOnlyBuiltInReport,
      }),
    enabled: !!reportKey && isBuiltIn,
  });

  type SheetItem = {
    name: string;
    rows: (string | number)[][];
    merges?: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
    rowStyles?: Record<number, { backgroundColor?: string; color?: string; fontWeight?: string; textAlign?: 'left' | 'center' | 'right'; borderTop?: string; borderRight?: string; borderBottom?: string; borderLeft?: string; verticalAlign?: 'top' | 'middle' | 'bottom'; whiteSpace?: 'normal' | 'nowrap' | 'pre-wrap'; fontSize?: string; fontFamily?: string }>;
    cellStyles?: Record<string, { backgroundColor?: string; color?: string; fontWeight?: string; textAlign?: 'left' | 'center' | 'right'; borderTop?: string; borderRight?: string; borderBottom?: string; borderLeft?: string; verticalAlign?: 'top' | 'middle' | 'bottom'; whiteSpace?: 'normal' | 'nowrap' | 'pre-wrap'; fontSize?: string; fontFamily?: string }>;
    colWidths?: Record<number, number>;
    rowHeights?: Record<number, number>;
    hiddenCols?: number[];
    hiddenRows?: number[];
  };

  const multiSheets = useMemo(
    () =>
      templateGrid && 'sheets' in templateGrid && Array.isArray((templateGrid as { sheets?: SheetItem[] }).sheets)
        ? (templateGrid as { sheets: SheetItem[] }).sheets
        : null,
    [templateGrid]
  );

  useEffect(() => {
    if (!multiSheets?.length) {
      setActiveTemplateSheet('');
      return;
    }
    setActiveTemplateSheet((prev) =>
      prev && multiSheets.some((sheet) => sheet.name === prev) ? prev : multiSheets[0].name
    );
  }, [multiSheets]);

  useEffect(() => {
    setBuiltInTimesheetCodeSearch('');
    setBuiltInTimesheetNameSearch('');
  }, [reportKey]);

  const activeBuiltInSheetRaw = useMemo(
    () => multiSheets?.find((sheet) => sheet.name === activeTemplateSheet) || multiSheets?.[0] || null,
    [multiSheets, activeTemplateSheet],
  );

  const activeBuiltInSheet = useMemo(() => {
    if (!activeBuiltInSheetRaw) return null;
    if (reportKey !== 'official-timesheet' && reportKey !== 'temp-timesheet') return activeBuiltInSheetRaw;
    return filterBuiltInTimesheetSheet(
      activeBuiltInSheetRaw as SheetItem,
      builtInTimesheetCodeSearch,
      builtInTimesheetNameSearch,
    );
  }, [activeBuiltInSheetRaw, reportKey, builtInTimesheetCodeSearch, builtInTimesheetNameSearch]);

  const createdAt = (latestUpload as any)?.created_at
    ? new Date((latestUpload as any).created_at).toLocaleString()
    : '';

  const wrapperClass = compact ? 'space-y-4' : 'p-4 space-y-4';

  const singleGrid =
    templateGrid && 'rows' in templateGrid
      ? (templateGrid as {
          rows: (string | number)[][];
          merges?: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
          rowStyles?: SheetItem['rowStyles'];
          cellStyles?: SheetItem['cellStyles'];
          colWidths?: Record<number, number>;
          rowHeights?: Record<number, number>;
          hiddenCols?: number[];
          hiddenRows?: number[];
        })
      : null;
  const templateMerges = singleGrid?.merges ? singleGrid.merges.map((m) => ({ s: m.s, e: m.e })) : [];
  const isAttendanceRateLayout = isBuiltIn && reportKey === 'attendance-rate';
  const reportSummary = useMemo(() => {
    if (isBuiltIn) {
      return buildHrBuiltInSummary(reportKey, templateGrid as any, gridParams);
    }
    return buildHrUploadSummary(reportKey, reportStats as any, latestUpload as any, sheetNames);
  }, [gridParams, isBuiltIn, latestUpload, reportKey, reportStats, sheetNames, templateGrid]);

  const attendanceProductionSnapshot = useMemo((): AttendanceCountProductionSnapshot | null => {
    if (!templateGrid || typeof templateGrid !== 'object') return null;
    const s = (templateGrid as { productionSnapshot?: AttendanceCountProductionSnapshot }).productionSnapshot;
    return s ?? null;
  }, [templateGrid]);

  if (!reportDef) {
    return (
      <div className={compact ? 'py-4' : 'p-6'}>
        <PageHeader title={t('hrReport.pageInvalidTitle')} description={t('hrReport.pageInvalidDesc')} />
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <PageHeader title={reportDef.title} description={reportDef.description} />

      {reportSummary && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{reportSummary.title}</CardTitle>
            {reportSummary.description ? (
              <CardDescription>{reportSummary.description}</CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {reportSummary.metrics.map((metric) => (
                <div key={`${metric.label}-${metric.value}`} className="rounded-lg border bg-muted/20 p-3">
                  <div className="text-xs font-medium text-muted-foreground">{metric.label}</div>
                  <div className="mt-1 text-xl font-semibold">{metric.value}</div>
                  {metric.hint ? (
                    <div className="mt-1 text-xs text-muted-foreground">{metric.hint}</div>
                  ) : null}
                </div>
              ))}
            </div>
            {reportSummary.notes.length > 0 ? (
              <div className="rounded-lg border bg-background p-3">
                <div className="text-sm font-medium">{t('hrReport.quickComment')}</div>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {reportSummary.notes.map((note) => (
                    <div key={note}>- {note}</div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {isBuiltIn && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('hrReport.builtInReportTitle')}</CardTitle>
            <CardDescription className="text-xs">
              {isStatsOnlyBuiltInReport
                ? t('hrReport.builtInDescStatsOnly', {
                    start: gridParams.start_date,
                    end: gridParams.end_date,
                  })
                : reportKey === 'attendance-rate'
                  ? t('hrReport.builtInDescAttendance', {
                      start: gridParams.start_date,
                      end: gridParams.end_date,
                    })
                  : t('hrReport.builtInDescFilter', {
                      start: gridParams.start_date,
                      end: gridParams.end_date,
                    })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {isBuiltInTimesheetReport && (
              <div className="rounded-md border border-border bg-muted/20 p-3 space-y-4">
                <div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor="hr-ts-start" className="text-xs text-muted-foreground">
                        {t('reports.fromDate')}
                      </Label>
                      <Input
                        id="hr-ts-start"
                        type="date"
                        className="h-9"
                        value={timesheetStart}
                        onChange={(e) => setTimesheetStart(e.target.value)}
                        max={timesheetEnd || undefined}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="hr-ts-end" className="text-xs text-muted-foreground">
                        {t('reports.toDate')}
                      </Label>
                      <Input
                        id="hr-ts-end"
                        type="date"
                        className="h-9"
                        value={timesheetEnd}
                        onChange={(e) => setTimesheetEnd(e.target.value)}
                        min={timesheetStart || undefined}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                      <Label htmlFor="hr-ts-month" className="text-xs text-muted-foreground">
                        {t('reports.quickPickMonth')}
                      </Label>
                      <Input
                        id="hr-ts-month"
                        type="month"
                        className="h-9"
                        value={fullCalendarMonthValue(timesheetStart, timesheetEnd)}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) return;
                          const { start, end } = calendarMonthRangeFromYm(v);
                          setTimesheetStart(start);
                          setTimesheetEnd(end);
                        }}
                      />
                      <p className="text-xs text-muted-foreground">{t('reports.quickPickMonthHint')}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{t('hrReport.timesheetDateRangeHint')}</p>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end">
                    <div className="w-full md:w-56">
                      <Label className="text-xs text-muted-foreground">{t('hrReport.timesheetSearchCode')}</Label>
                      <Input
                        className="h-9 mt-1"
                        value={builtInTimesheetCodeSearch}
                        onChange={(e) => setBuiltInTimesheetCodeSearch(e.target.value)}
                        placeholder={t('hrReport.timesheetSearchCodePh')}
                      />
                    </div>
                    <div className="w-full md:flex-1">
                      <Label className="text-xs text-muted-foreground">{t('hrReport.timesheetSearchName')}</Label>
                      <Input
                        className="h-9 mt-1"
                        value={builtInTimesheetNameSearch}
                        onChange={(e) => setBuiltInTimesheetNameSearch(e.target.value)}
                        placeholder={t('hrReport.timesheetSearchNamePh')}
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{t('hrReport.timesheetSearchHint')}</p>
                </div>
              </div>
            )}
            {loadingGrid ? (
              <div className="py-4 text-center text-sm text-muted-foreground">{t('hrReport.loadingData')}</div>
            ) : isStatsOnlyBuiltInReport ? (
              <div className="space-y-3">
                {!loadingGrid && templateGrid ? (
                  <>
                    {attendanceProductionSnapshot ? (
                      <AttendanceCountSnapshotPanel snapshot={attendanceProductionSnapshot} />
                    ) : null}
                    <HrChartFromGrid reportType={reportKey} templateGrid={templateGrid} />
                  </>
                ) : (
                  <div className="py-4 text-center text-sm text-muted-foreground">{t('hrReport.noChartData')}</div>
                )}
              </div>
            ) : isAttendanceRateLayout ? (
              <Tabs
                value={attendanceTab}
                onValueChange={(value) => setAttendanceTab(value === 'detail' ? 'detail' : 'overview')}
                className="space-y-3"
              >
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <TabsList className="w-full lg:w-auto">
                    <TabsTrigger value="overview" className="flex-1 lg:flex-none">
                      {t('hrReport.tabOverview')}
                    </TabsTrigger>
                    <TabsTrigger value="detail" className="flex-1 lg:flex-none">
                      {t('hrReport.tabDetail')}
                    </TabsTrigger>
                  </TabsList>
                  <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    {t('hrReport.tabHint')}
                  </div>
                </div>

                <TabsContent value="overview" className="mt-0">
                  {!loadingGrid && templateGrid ? (
                    <HrChartFromGrid reportType={reportKey} templateGrid={templateGrid} />
                  ) : (
                    <div className="py-4 text-center text-sm text-muted-foreground">{t('hrReport.noChartData')}</div>
                  )}
                  <InlineVendorNccPanel startDate={gridParams.start_date} endDate={gridParams.end_date} />
                </TabsContent>

                <TabsContent value="detail" className="mt-0 space-y-3">
                  {multiSheets && multiSheets.length > 1 ? (
                    <div className="flex flex-wrap gap-2">
                      {multiSheets.map((sheet) => (
                        <Button
                          key={sheet.name}
                          type="button"
                          size="sm"
                          variant={sheet.name === activeBuiltInSheetRaw?.name ? 'default' : 'outline'}
                          className="h-8"
                          onClick={() => setActiveTemplateSheet(sheet.name)}
                        >
                          {sheet.name}
                        </Button>
                      ))}
                    </div>
                  ) : null}

                  {activeBuiltInSheetRaw && activeBuiltInSheet ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
                        <span>
                          {t('hrReport.detailByNccRange', {
                            start: gridParams.start_date,
                            end: gridParams.end_date,
                          })}
                        </span>
                        <span>{t('hrReport.scrollHorizontally')}</span>
                      </div>
                      {(() => {
                        const hi = findTimesheetHeaderRowIndex(activeBuiltInSheet.rows);
                        const filteredEmpty =
                          (builtInTimesheetCodeSearch.trim() || builtInTimesheetNameSearch.trim()) &&
                          (activeBuiltInSheet.name === 'Attendance list' ||
                            activeBuiltInSheet.name === 'Data') &&
                          hi >= 0 &&
                          activeBuiltInSheet.rows.length <= hi + 1;
                        return filteredEmpty ? (
                          <p className="text-sm text-muted-foreground">{t('hrReport.attendanceListFilteredEmpty')}</p>
                        ) : null;
                      })()}
                      <div className="rounded border">
                        <ExcelGrid
                          rows={activeBuiltInSheet.rows}
                          merges={activeBuiltInSheet.merges}
                          rowStyles={activeBuiltInSheet.rowStyles}
                          cellStyles={activeBuiltInSheet.cellStyles}
                          colWidths={activeBuiltInSheet.colWidths}
                          rowHeights={activeBuiltInSheet.rowHeights}
                          hiddenCols={activeBuiltInSheet.hiddenCols}
                          hiddenRows={activeBuiltInSheet.hiddenRows}
                        />
                      </div>
                    </div>
                  ) : singleGrid && (singleGrid.rows?.length ?? 0) > 0 ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
                        <span>
                          {t('hrReport.detailByNccRange', {
                            start: gridParams.start_date,
                            end: gridParams.end_date,
                          })}
                        </span>
                        <span>{t('hrReport.scrollHorizontally')}</span>
                      </div>
                      <div className="rounded border">
                        <ExcelGrid
                          rows={singleGrid.rows}
                          merges={templateMerges}
                          rowStyles={singleGrid.rowStyles}
                          cellStyles={singleGrid.cellStyles}
                          colWidths={singleGrid.colWidths}
                          rowHeights={singleGrid.rowHeights}
                          hiddenCols={singleGrid.hiddenCols}
                          hiddenRows={singleGrid.hiddenRows}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center text-sm text-muted-foreground">{t('hrReport.noDetailData')}</div>
                  )}
                </TabsContent>
              </Tabs>
            ) : activeBuiltInSheetRaw && activeBuiltInSheet ? (
              <div className="space-y-3">
                {!loadingGrid && templateGrid && (
                  <HrChartFromGrid reportType={reportKey} templateGrid={templateGrid} />
                )}
                {multiSheets && multiSheets.length > 1 ? (
                  <div className="flex flex-wrap gap-2">
                    {multiSheets.map((sheet) => (
                      <Button
                        key={sheet.name}
                        type="button"
                        size="sm"
                        variant={sheet.name === activeBuiltInSheetRaw.name ? 'default' : 'outline'}
                        className="h-8"
                        onClick={() => setActiveTemplateSheet(sheet.name)}
                      >
                        {sheet.name}
                      </Button>
                    ))}
                  </div>
                ) : null}
                {(() => {
                  const hi = findTimesheetHeaderRowIndex(activeBuiltInSheet.rows);
                  const filteredEmpty =
                    (builtInTimesheetCodeSearch.trim() || builtInTimesheetNameSearch.trim()) &&
                    (activeBuiltInSheet.name === 'Attendance list' ||
                      activeBuiltInSheet.name === 'Data') &&
                    hi >= 0 &&
                    activeBuiltInSheet.rows.length <= hi + 1;
                  return filteredEmpty ? (
                    <p className="text-sm text-muted-foreground">{t('hrReport.attendanceListFilteredEmpty')}</p>
                  ) : null;
                })()}
                <div className="rounded border">
                  <ExcelGrid
                    rows={activeBuiltInSheet.rows}
                    merges={activeBuiltInSheet.merges}
                    rowStyles={activeBuiltInSheet.rowStyles}
                    cellStyles={activeBuiltInSheet.cellStyles}
                    colWidths={activeBuiltInSheet.colWidths}
                    rowHeights={activeBuiltInSheet.rowHeights}
                    hiddenCols={activeBuiltInSheet.hiddenCols}
                    hiddenRows={activeBuiltInSheet.hiddenRows}
                  />
                </div>
              </div>
            ) : singleGrid && (singleGrid.rows?.length ?? 0) > 0 ? (
              <div className="rounded border">
                <ExcelGrid
                  rows={singleGrid.rows}
                  merges={templateMerges}
                  rowStyles={singleGrid.rowStyles}
                  cellStyles={singleGrid.cellStyles}
                  colWidths={singleGrid.colWidths}
                  rowHeights={singleGrid.rowHeights}
                  hiddenCols={singleGrid.hiddenCols}
                  hiddenRows={singleGrid.hiddenRows}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {!loadingGrid && templateGrid && (
                  <HrChartFromGrid reportType={reportKey} templateGrid={templateGrid} />
                )}
                <div className="py-4 text-center text-sm text-muted-foreground">{t('hrReport.noDataForRange')}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* File Excel đã upload — hiển thị cho mọi loại báo cáo khi có file (đồng bộ upload → biểu mẫu) */}
      {!isBuiltIn && latestUpload && sheetNames.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('hrReport.excelUploadedTitle')}</CardTitle>
            <CardDescription>
              {createdAt
                ? t('hrReport.excelUploadedDesc', {
                    title: String(reportDef?.title ?? reportKey),
                    time: createdAt,
                  })
                : t('hrReport.excelPickSheet')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end flex-wrap">
              <div className="space-y-2 flex-1 min-w-[200px]">
                <Label>Sheet</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                >
                  {sheetNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setRowLimit((v) => v + 100)}
                  disabled={!sheetView || !(sheetView as any).hasMoreRows}
                >
                  {t('hrReport.moreRows')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setColLimit((v) => v + 50)}
                  disabled={!sheetView || !(sheetView as any).hasMoreCols}
                >
                  {t('hrReport.moreCols')}
                </Button>
              </div>
              <div className="flex gap-2 items-end">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  id={`hr-upload-${reportKey}`}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadMutation.mutate(f);
                    e.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById(`hr-upload-${reportKey}`)?.click()}
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? t('hrReport.uploading') : t('hrReport.pickNewFile')}
                </Button>
              </div>
            </div>

            {loadingSheet ? (
              <div className="text-sm text-muted-foreground">{t('hrReport.loadingSheet')}</div>
            ) : sheetError ? (
              <div className="text-sm text-destructive">
                {(sheetError as any)?.message || t('hrReport.sheetLoadError')}
              </div>
            ) : sheetView ? (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  {t('hrReport.sheetViewSize', {
                    r: String((sheetView as any)?.slice?.rows ?? ''),
                    c: String((sheetView as any)?.slice?.cols ?? ''),
                    tr: String((sheetView as any)?.total?.rows ?? ''),
                    tc: String((sheetView as any)?.total?.cols ?? ''),
                  })}
                </div>
                <ExcelGrid rows={(sheetView as any).rows || []} merges={(sheetView as any).merges || []} />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">{t('hrReport.noSheetData')}</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Khi chưa có file upload — gợi ý tải lên (mọi loại báo cáo) */}
      {!isBuiltIn && !latestUpload && !loadingLatest && (
        <Card className="mb-6 border-dashed">
          <CardHeader>
            <CardTitle className="text-base">{t('hrReport.noExcelFileTitle')}</CardTitle>
            <CardDescription>{t('hrReport.noExcelFileDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              id={`hr-upload-first-${reportKey}`}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadMutation.mutate(f);
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              onClick={() => document.getElementById(`hr-upload-first-${reportKey}`)?.click()}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? t('hrReport.uploading') : t('hrReport.pickExcelUpload')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

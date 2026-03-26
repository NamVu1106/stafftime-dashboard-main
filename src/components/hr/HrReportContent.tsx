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
import { buildHrBuiltInSummary, buildHrUploadSummary } from '@/lib/hrReportInsights';
import { useTimeFilterOptional } from '@/contexts/TimeFilterContext';
import { HrChartFromGrid } from './HrChartFromGrid';

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

/** Nhập Vendor trên cùng trang Tỉ lệ đi làm — lưu xong grid bên dưới cập nhật theo NCC */
function InlineVendorNccPanel({ startDate, endDate }: { startDate: string; endDate: string }) {
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
      toast.success(`Đã lưu NCC (${d.saved} cập nhật, ${d.removed} đã bỏ gán)`);
      await qc.refetchQueries({ queryKey: ['vendor-assignments'] });
      setDraftDirty(false);
      await qc.invalidateQueries({ queryKey: ['hrTemplates', 'grid', 'attendance-rate', startDate, endDate] });
    },
    onError: (e: any) => toast.error(e?.message || 'Lưu thất bại'),
  });

  const uploadMut = useMutation({
    mutationFn: (f: File) => vendorAssignmentsAPI.upload(f),
    onSuccess: async (d) => {
      toast.success(d.message || `Đã import ${d.upserted ?? 0} dòng`);
      await qc.refetchQueries({ queryKey: ['vendor-assignments'] });
      setDraftDirty(false);
      await qc.invalidateQueries({ queryKey: ['hrTemplates', 'grid', 'attendance-rate', startDate, endDate] });
    },
    onError: (e: any) => toast.error(e?.message || 'Import thất bại'),
  });

  const addOneMut = useMutation({
    mutationFn: () =>
      vendorAssignmentsAPI.save([
        { employee_code: quickCode.trim().toUpperCase(), vendor_name: quickVendor.trim() },
      ]),
    onSuccess: async () => {
      toast.success('Đã gán NCC cho Mã NV');
      setQuickCode('');
      setQuickVendor('');
      setDraftDirty(false);
      await qc.refetchQueries({ queryKey: ['vendor-assignments'] });
      await qc.invalidateQueries({ queryKey: ['hrTemplates', 'grid', 'attendance-rate', startDate, endDate] });
    },
    onError: (e: any) => toast.error(e?.message || 'Thêm thất bại'),
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
              <CardTitle className="text-sm">Nguồn NCC cho báo cáo tỉ lệ đi làm</CardTitle>
              <CardDescription>
                {editableCodes.length > 0
                  ? `Đã gán ${assignedCount}/${editableCodes.length} mã NV. Mở khi cần chỉnh NCC để báo cáo phía trên nhóm đúng theo Vendor.`
                  : 'Chưa có dữ liệu NCC để chỉnh. Có thể thêm nhanh theo Mã NV hoặc import file map Vendor.'}
              </CardDescription>
            </div>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto">
                {isEditorOpen ? 'Thu gọn chỉnh NCC' : 'Mở chỉnh NCC'}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            {loadingPanel ? (
              <div className="text-sm text-muted-foreground py-2">Đang tải…</div>
            ) : null}
            {vaError ? (
              <div className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-2">
                Không kết nối được API Gán Vendor (404). Hãy khởi động lại backend hoặc dùng menu «Gán Vendor (NCC)».
              </div>
            ) : null}

            <div className="rounded-lg border bg-background p-3 space-y-2">
              <div className="text-sm font-medium">Thêm nhanh (luôn dùng được)</div>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="w-[140px]">
                  <Label htmlFor="vendor-quick-code">Mã NV</Label>
                  <Input
                    id="vendor-quick-code"
                    value={quickCode}
                    onChange={(e) => setQuickCode(e.target.value)}
                    placeholder="VD: 12345"
                    className="font-mono"
                  />
                </div>
                <div className="flex-1 min-w-[180px]">
                  <Label htmlFor="vendor-quick-ncc">Nhà cung cấp (Vendor)</Label>
                  <Input
                    id="vendor-quick-ncc"
                    value={quickVendor}
                    onChange={(e) => setQuickVendor(e.target.value)}
                    placeholder="Tên NCC"
                  />
                </div>
                <Button
                  type="button"
                  disabled={!quickCode.trim() || !quickVendor.trim() || addOneMut.isPending}
                  onClick={() => addOneMut.mutate()}
                >
                  {addOneMut.isPending ? 'Đang lưu…' : 'Thêm gán'}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 items-end">
              {emps.length > 0 ? (
                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="vendor-filter-nv">Lọc Mã NV / tên</Label>
                  <Input
                    id="vendor-filter-nv"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Tìm…"
                  />
                </div>
              ) : items.length > 0 ? (
                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="vendor-filter-va">Lọc Mã NV / NCC</Label>
                  <Input
                    id="vendor-filter-va"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Tìm…"
                  />
                </div>
              ) : null}
              <Button
                type="button"
                onClick={() => syncMut.mutate()}
                disabled={syncMut.isPending || (emps.length === 0 && items.length === 0)}
              >
                {syncMut.isPending ? 'Đang lưu…' : emps.length ? 'Lưu NCC (bảng NV)' : 'Lưu thay đổi (bảng dưới)'}
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
                {uploadMut.isPending ? 'Import…' : 'Import Excel'}
              </Button>
            </div>

            <div className="max-h-60 overflow-auto border rounded-md text-sm bg-background">
              <table className="w-full">
                <thead className="bg-muted sticky top-0 z-[1]">
                  <tr>
                    <th className="text-left p-2">Mã NV</th>
                    <th className="text-left p-2">Họ tên</th>
                    <th className="text-left p-2 min-w-[220px]">Nhà cung cấp (Vendor)</th>
                  </tr>
                </thead>
                <tbody>
                  {emps.length > 0
                    ? filtered.map((e: any) => {
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
                                placeholder="Tên NCC"
                              />
                            </td>
                          </tr>
                        );
                      })
                    : itemsFiltered.length > 0
                      ? itemsFiltered.map((i) => {
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
                                  placeholder="Tên NCC"
                                />
                              </td>
                            </tr>
                          );
                        })
                      : !loadingPanel && (
                          <tr>
                            <td colSpan={3} className="p-4 text-center text-muted-foreground text-sm">
                              Chưa có dòng nào. Nhập <strong>Mã NV</strong> + <strong>NCC</strong> ở khung «Thêm nhanh» bên trên rồi bấm <strong>Thêm gán</strong>, hoặc Import Excel.
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
  const reportKey = reportType || '';
  const reportDef = HR_REPORT_DEFS[reportKey];
  const isBuiltIn = hasBuiltInGrid(reportKey);

  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [activeTemplateSheet, setActiveTemplateSheet] = useState<string>('');
  const [rowLimit, setRowLimit] = useState<number>(200);
  const [colLimit, setColLimit] = useState<number>(80);

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
      toast.success('Upload HR Excel thành công');
      setFile(null);
      setSelectedSheet('');
      await queryClient.invalidateQueries({ queryKey: ['hrExcel', 'latest', reportKey] });
      await refetchLatest();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Upload thất bại');
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
  const gridParams = (() => {
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
    return { start_date: `${y}-${m}-01`, end_date: `${y}-${m}-${new Date(y, now.getMonth() + 1, 0).getDate()}` };
  })();

  const { data: templateGrid, isLoading: loadingGrid } = useQuery({
    queryKey: ['hrTemplates', 'grid', reportKey, gridParams.start_date, gridParams.end_date],
    queryFn: () => hrTemplatesAPI.getGrid(reportKey, gridParams),
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

  if (!reportDef) {
    return (
      <div className={compact ? 'py-4' : 'p-6'}>
        <PageHeader title="HR Report" description="Report type không tồn tại" />
      </div>
    );
  }

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
  const activeBuiltInSheet = multiSheets?.find((sheet) => sheet.name === activeTemplateSheet) || multiSheets?.[0] || null;
  const isAttendanceRateLayout = isBuiltIn && reportKey === 'attendance-rate';
  const reportSummary = useMemo(() => {
    if (isBuiltIn) {
      return buildHrBuiltInSummary(reportKey, templateGrid as any, gridParams);
    }
    return buildHrUploadSummary(reportKey, reportStats as any, latestUpload as any, sheetNames);
  }, [gridParams, isBuiltIn, latestUpload, reportKey, reportStats, sheetNames, templateGrid]);

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
                <div className="text-sm font-medium">Nhận xét nhanh</div>
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
            <CardTitle className="text-base">Báo cáo từ dữ liệu hệ thống</CardTitle>
            <CardDescription className="text-xs">
              {reportKey === 'attendance-rate'
                ? `Chấm công + NV thời vụ + NCC. Khoảng: ${gridParams.start_date} → ${gridParams.end_date}`
                : `Bộ lọc: ${gridParams.start_date} → ${gridParams.end_date}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {loadingGrid ? (
              <div className="py-4 text-center text-sm text-muted-foreground">Đang tải dữ liệu...</div>
            ) : isAttendanceRateLayout ? (
              <Tabs defaultValue="overview" className="space-y-3">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <TabsList className="w-full lg:w-auto">
                    <TabsTrigger value="overview" className="flex-1 lg:flex-none">
                      Tổng quan
                    </TabsTrigger>
                    <TabsTrigger value="detail" className="flex-1 lg:flex-none">
                      Bảng chi tiết
                    </TabsTrigger>
                  </TabsList>
                  <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    Gợi ý: xem nhanh ở tab Tổng quan, chuyển sang Bảng chi tiết khi cần kiểm tra đầy đủ theo NCC.
                  </div>
                </div>

                <TabsContent value="overview" className="mt-0">
                  {!loadingGrid && templateGrid ? (
                    <HrChartFromGrid reportType={reportKey} templateGrid={templateGrid} />
                  ) : (
                    <div className="py-4 text-center text-sm text-muted-foreground">Chưa có dữ liệu biểu đồ cho khoảng thời gian này.</div>
                  )}
                </TabsContent>

                <TabsContent value="detail" className="mt-0 space-y-3">
                  {multiSheets && multiSheets.length > 1 ? (
                    <div className="flex flex-wrap gap-2">
                      {multiSheets.map((sheet) => (
                        <Button
                          key={sheet.name}
                          type="button"
                          size="sm"
                          variant={sheet.name === activeBuiltInSheet?.name ? 'default' : 'outline'}
                          className="h-8"
                          onClick={() => setActiveTemplateSheet(sheet.name)}
                        >
                          {sheet.name}
                        </Button>
                      ))}
                    </div>
                  ) : null}

                  {activeBuiltInSheet ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
                        <span>Dữ liệu chi tiết theo NCC cho khoảng {gridParams.start_date} → {gridParams.end_date}.</span>
                        <span>Cuộn ngang để xem đủ các mốc tháng / tuần / ngày.</span>
                      </div>
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
                        <span>Dữ liệu chi tiết theo NCC cho khoảng {gridParams.start_date} → {gridParams.end_date}.</span>
                        <span>Cuộn ngang để xem đủ các mốc tháng / tuần / ngày.</span>
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
                    <div className="py-4 text-center text-sm text-muted-foreground">Chưa có dữ liệu chi tiết cho khoảng thời gian này.</div>
                  )}
                </TabsContent>
              </Tabs>
            ) : activeBuiltInSheet ? (
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
                        variant={sheet.name === activeBuiltInSheet.name ? 'default' : 'outline'}
                        className="h-8"
                        onClick={() => setActiveTemplateSheet(sheet.name)}
                      >
                        {sheet.name}
                      </Button>
                    ))}
                  </div>
                ) : null}
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
                <div className="py-4 text-center text-sm text-muted-foreground">Chưa có dữ liệu cho khoảng thời gian này.</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isBuiltIn && reportKey === 'attendance-rate' && (
        <InlineVendorNccPanel startDate={gridParams.start_date} endDate={gridParams.end_date} />
      )}

      {/* File Excel đã upload — hiển thị cho mọi loại báo cáo khi có file (đồng bộ upload → biểu mẫu) */}
      {!isBuiltIn && latestUpload && sheetNames.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>File Excel đã tải lên</CardTitle>
            <CardDescription>
              {isBuiltIn
                ? `Dữ liệu từ file đã upload (loại báo cáo: ${reportDef?.title ?? reportKey}). Cập nhật lúc: ${createdAt}.`
                : 'Chọn sheet để xem nội dung (hỗ trợ file nhiều sheet).'}
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
                  +100 dòng
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setColLimit((v) => v + 50)}
                  disabled={!sheetView || !(sheetView as any).hasMoreCols}
                >
                  +50 cột
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
                  {uploadMutation.isPending ? 'Đang tải lên…' : 'Chọn file mới'}
                </Button>
              </div>
            </div>

            {loadingSheet ? (
              <div className="text-sm text-muted-foreground">Đang tải sheet...</div>
            ) : sheetError ? (
              <div className="text-sm text-destructive">
                {(sheetError as any)?.message || 'Có lỗi khi tải sheet'}
              </div>
            ) : sheetView ? (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  Đang hiển thị {(sheetView as any)?.slice?.rows}×{(sheetView as any)?.slice?.cols} ô. Tổng sheet{' '}
                  {(sheetView as any)?.total?.rows}×{(sheetView as any)?.total?.cols}.
                </div>
                <ExcelGrid rows={(sheetView as any).rows || []} merges={(sheetView as any).merges || []} />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Chưa có dữ liệu sheet.</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Khi chưa có file upload — gợi ý tải lên (mọi loại báo cáo) */}
      {!isBuiltIn && !latestUpload && !loadingLatest && (
        <Card className="mb-6 border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Chưa có file Excel nào</CardTitle>
            <CardDescription>
              Tải file lên để dữ liệu hiển thị ngay trên biểu mẫu. Có thể upload tại đây hoặc tại trang Upload (chọn đúng loại báo cáo).
            </CardDescription>
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
              {uploadMutation.isPending ? 'Đang tải lên…' : 'Chọn file Excel để tải lên'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

import { Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { prisma } from '../server';

type HrReportType =
  | 'attendance-rate'
  | 'attendance-count'
  | 'weekly-one-day-workers'
  | 'bhxh-list'
  | 'insurance-master'
  | 'payroll'
  | 'official-timesheet'
  | 'temp-timesheet'
  | 'daily-wage'
  | 'labor-rate'
  | 'drug-inventory'
  | 'medical-room-usage'
  | 'arrears-collection'
  | 'other';

const sanitizeSlug = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '');

const normalizeReportType = (input: string): HrReportType => {
  const slug = sanitizeSlug(input).replace(/_/g, '-');
  return (slug as HrReportType) || 'other';
};

const getHrUploadDir = () => {
  const base = process.env.UPLOAD_DIR || './uploads';
  return path.join(base, 'hr-excel');
};

const ensureHrExcelUploadsTable = async () => {
  // Ensure the table exists even if migrations haven't been applied yet.
  // This keeps the feature working out-of-the-box for SQLite deployments.
  await (prisma as any).$executeRawUnsafe?.(`
    CREATE TABLE IF NOT EXISTS "hr_excel_uploads" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "report_type" TEXT NOT NULL,
      "original_file_name" TEXT NOT NULL,
      "stored_file_name" TEXT NOT NULL,
      "sheet_names" TEXT NOT NULL,
      "default_sheet" TEXT NOT NULL,
      "created_at" TEXT NOT NULL DEFAULT ""
    );
  `);
  await (prisma as any).$executeRawUnsafe?.(
    `CREATE INDEX IF NOT EXISTS "hr_excel_uploads_report_type_idx" ON "hr_excel_uploads"("report_type");`
  );
  await (prisma as any).$executeRawUnsafe?.(
    `CREATE INDEX IF NOT EXISTS "hr_excel_uploads_created_at_idx" ON "hr_excel_uploads"("created_at");`
  );
};

type HrExcelUploadRecord = {
  id: number;
  report_type: string;
  original_file_name: string;
  stored_file_name: string;
  sheet_names: string;
  default_sheet: string;
  created_at: string;
};

const hrExcelUploadCreate = async (data: Omit<HrExcelUploadRecord, 'id'>) => {
  const delegate = (prisma as any).hrExcelUpload;
  if (delegate?.create) {
    return delegate.create({ data });
  }

  // Fallback: raw SQL (works even if Prisma client hasn't been regenerated)
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO "hr_excel_uploads" ("report_type","original_file_name","stored_file_name","sheet_names","default_sheet","created_at")
     VALUES (?,?,?,?,?,?);`,
    data.report_type,
    data.original_file_name,
    data.stored_file_name,
    data.sheet_names,
    data.default_sheet,
    data.created_at
  );
  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT * FROM "hr_excel_uploads" WHERE "id" = last_insert_rowid() LIMIT 1;`
  );
  return Array.isArray(rows) ? rows[0] : rows;
};

const hrExcelUploadFindLatestByType = async (report_type: string): Promise<HrExcelUploadRecord | null> => {
  const delegate = (prisma as any).hrExcelUpload;
  if (delegate?.findFirst) {
    return delegate.findFirst({
      where: { report_type },
      orderBy: { id: 'desc' },
    });
  }

  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT * FROM "hr_excel_uploads" WHERE "report_type" = ? ORDER BY "id" DESC LIMIT 1;`,
    report_type
  );
  return Array.isArray(rows) ? (rows[0] || null) : (rows || null);
};

const hrExcelUploadFindUniqueById = async (id: number): Promise<HrExcelUploadRecord | null> => {
  const delegate = (prisma as any).hrExcelUpload;
  if (delegate?.findUnique) {
    return delegate.findUnique({ where: { id } });
  }

  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT * FROM "hr_excel_uploads" WHERE "id" = ? LIMIT 1;`,
    id
  );
  return Array.isArray(rows) ? (rows[0] || null) : (rows || null);
};

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = getHrUploadDir();
    ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const reportTypeRaw = String((req.body as any)?.report_type || 'other');
    const reportType = sanitizeSlug(reportTypeRaw) || 'other';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `hr-${reportType}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExt = new Set(['.xlsx', '.xls']);
    const allowedMime = new Set([
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      // Some clients (curl, some browsers) may send a generic mimetype
      'application/octet-stream',
    ]);

    if (allowedExt.has(ext) && allowedMime.has(file.mimetype)) return cb(null, true);
    if (allowedExt.has(ext)) return cb(null, true);
    return cb(new Error('Invalid file type'));
  },
});

const hasCellValue = (cell: XLSX.CellObject | undefined) => {
  if (!cell) return false;
  const v: any = (cell as any).w ?? (cell as any).v;
  if (v === undefined || v === null) return false;
  if (typeof v === 'number') return true;
  if (v instanceof Date) return true;
  return String(v).trim() !== '';
};

const pickDefaultSheet = (workbook: XLSX.WorkBook) => {
  for (const name of workbook.SheetNames) {
    const sh = workbook.Sheets[name];
    if (!sh) continue;
    const keys = Object.keys(sh).filter(k => k[0] !== '!');
    // quick check: if any cell has a non-empty value, choose this sheet
    for (let i = 0; i < Math.min(keys.length, 500); i++) {
      const addr = keys[i];
      if (hasCellValue(sh[addr] as any)) return name;
    }
  }
  return workbook.SheetNames[0] || '';
};

const normalizeText = (s: any) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();

const pickSheetByKeywords = (sheetNames: string[], keywords: string[], blacklist: string[] = []) => {
  const normalized = sheetNames.map(n => ({ name: n, norm: normalizeText(n) }));
  const filtered = blacklist.length
    ? normalized.filter(x => !blacklist.some(b => x.norm.includes(b)))
    : normalized;

  for (const kw of keywords) {
    const m = filtered.find(x => x.norm.includes(kw));
    if (m) return m.name;
  }
  return null;
};

const parseMonthYearFromSheetName = (sheetName: string): { month: number; year: number } | null => {
  const s = normalizeText(sheetName).replace(/\s+/g, ' ');

  // Common forms: "04.2025", "thang 01.2026", "t1-2026", "t10-2025"
  const m1 = s.match(/(^|[^0-9])(\d{1,2})[.\-/](\d{4})([^0-9]|$)/);
  if (m1) {
    const month = Number(m1[2]);
    const year = Number(m1[3]);
    if (month >= 1 && month <= 12) return { month, year };
  }

  const m2 = s.match(/\bt\s*(\d{1,2})\s*[-_/ ]\s*(\d{4})\b/);
  if (m2) {
    const month = Number(m2[1]);
    const year = Number(m2[2]);
    if (month >= 1 && month <= 12) return { month, year };
  }

  const m3 = s.match(/\bthang\s*(\d{1,2})\.(\d{4})\b/);
  if (m3) {
    const month = Number(m3[1]);
    const year = Number(m3[2]);
    if (month >= 1 && month <= 12) return { month, year };
  }

  return null;
};

const pickLatestMonthYearSheet = (sheetNames: string[], blacklist: string[] = []) => {
  const filtered = blacklist.length
    ? sheetNames.filter(n => !blacklist.some(b => normalizeText(n).includes(b)))
    : sheetNames;

  let best: { name: string; key: number } | null = null;
  for (const name of filtered) {
    const my = parseMonthYearFromSheetName(name);
    if (!my) continue;
    const key = my.year * 100 + my.month;
    if (!best || key > best.key) best = { name, key };
  }
  return best?.name || null;
};

const parseMonthYearFromFileName = (fileName: string): { month: string; year: string } | null => {
  const base = path.basename(fileName);
  const mmDotYYYY = base.match(/(^|[^0-9])(\d{2})\.(\d{4})([^0-9]|$)/);
  if (mmDotYYYY) return { month: mmDotYYYY[2], year: mmDotYYYY[3] };
  const mmYYYY = base.match(/(^|[^0-9])(\d{2})(\d{4})([^0-9]|$)/);
  if (mmYYYY) return { month: mmYYYY[2], year: mmYYYY[3] };
  return null;
};

const pickDefaultSheetForReport = (
  reportType: HrReportType,
  workbook: XLSX.WorkBook,
  originalFileName: string
) => {
  // Prefer summary sheets for each report type to avoid huge raw-data sheets.
  const names = workbook.SheetNames || [];

  const byKeywords = (keywords: string[], blacklist: string[] = []) =>
    pickSheetByKeywords(names, keywords, blacklist);

  const byLatestMonth = (blacklist: string[] = []) =>
    pickLatestMonthYearSheet(names, blacklist);

  if (reportType === 'attendance-rate') {
    const my = parseMonthYearFromFileName(originalFileName);
    if (my) {
      const needle = normalizeText(`${my.month}.${my.year}`);
      const match = workbook.SheetNames.find(n => normalizeText(n).includes(needle));
      if (match) return match;
    }

    // fallback: choose first "Thang ..." sheet if present
    const thangSheet = workbook.SheetNames.find(n => normalizeText(n).includes('thang'));
    if (thangSheet) return thangSheet;
  }

  if (reportType === 'weekly-one-day-workers') {
    return byKeywords(['bc', 'over view', 'overview']) || pickDefaultSheet(workbook);
  }

  if (reportType === 'labor-rate') {
    return byKeywords(['bc']) || pickDefaultSheet(workbook);
  }

  if (reportType === 'attendance-count') {
    return byKeywords(['sheet1', 'bc', 'tong']) || pickDefaultSheet(workbook);
  }

  if (reportType === 'daily-wage') {
    return byKeywords(['tong'], ['kangatang']) || pickDefaultSheet(workbook);
  }

  if (reportType === 'insurance-master') {
    return byKeywords(['tong hop', 'tong']) || pickDefaultSheet(workbook);
  }

  if (reportType === 'bhxh-list') {
    // Prefer monthly sheet then "tang/giam" sheets
    return byLatestMonth(['sheet']) || byKeywords(['thang', 'tang', 'giam']) || pickDefaultSheet(workbook);
  }

  if (reportType === 'medical-room-usage') {
    // Avoid very large raw sheets like "DS CNV"
    return (
      byKeywords(['bao cao', 'bc', 'so luong'], ['ds cnv', 'chart', 'data']) ||
      pickDefaultSheet(workbook)
    );
  }

  if (reportType === 'drug-inventory') {
    // Many sheets -> choose the latest month sheet
    return byLatestMonth(['sheet']) || byKeywords(['thang', 't'], ['sheet']) || pickDefaultSheet(workbook);
  }

  if (reportType === 'arrears-collection') {
    return byLatestMonth() || pickDefaultSheet(workbook);
  }

  if (reportType === 'payroll') {
    return byKeywords(['ty le', 'thue', 'bhxh', 'tong'], ['attendance list']) || pickDefaultSheet(workbook);
  }

  if (reportType === 'official-timesheet') {
    return byKeywords(['attendance list', 'thang', 'kp']) || pickDefaultSheet(workbook);
  }

  if (reportType === 'temp-timesheet') {
    return byKeywords(['data']) || pickDefaultSheet(workbook);
  }

  return pickDefaultSheet(workbook);
};

const getSheetSlice = (
  sheet: XLSX.WorkSheet,
  opts: {
    rowStart: number;
    rowLimit: number;
    colStart: number;
    colLimit: number;
  }
) => {
  const ref = sheet['!ref'] || 'A1';
  const baseRange = XLSX.utils.decode_range(ref);

  const totalRows = baseRange.e.r - baseRange.s.r + 1;
  const totalCols = baseRange.e.c - baseRange.s.c + 1;

  const rowStartAbs = baseRange.s.r + Math.max(0, opts.rowStart);
  const colStartAbs = baseRange.s.c + Math.max(0, opts.colStart);

  const rowEndAbs = Math.min(baseRange.e.r, rowStartAbs + Math.max(1, opts.rowLimit) - 1);
  const colEndAbs = Math.min(baseRange.e.c, colStartAbs + Math.max(1, opts.colLimit) - 1);

  const rows: Array<Array<string | number>> = [];
  for (let r = rowStartAbs; r <= rowEndAbs; r++) {
    const row: Array<string | number> = [];
    for (let c = colStartAbs; c <= colEndAbs; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr] as any;
      let v: any = '';
      if (cell) {
        v = cell.w ?? cell.v ?? '';
        if (v instanceof Date) v = v.toISOString().slice(0, 10);
      }
      row.push(v);
    }
    rows.push(row);
  }

  const merges = (sheet['!merges'] || []) as XLSX.Range[];
  const mergesInSlice = merges
    .filter(m => {
      // Only render merges whose START cell is inside the slice.
      // If a merge spans beyond slice boundaries, we'll clamp it to the slice so UI can still hide covered cells.
      return (
        m.s.r >= rowStartAbs &&
        m.s.r <= rowEndAbs &&
        m.s.c >= colStartAbs &&
        m.s.c <= colEndAbs &&
        m.e.r >= rowStartAbs &&
        m.e.c >= colStartAbs
      );
    })
    .map(m => ({
      s: { r: m.s.r - rowStartAbs, c: m.s.c - colStartAbs },
      e: {
        r: Math.min(m.e.r, rowEndAbs) - rowStartAbs,
        c: Math.min(m.e.c, colEndAbs) - colStartAbs,
      },
    }));

  return {
    ref,
    baseRange: {
      s: { r: baseRange.s.r, c: baseRange.s.c },
      e: { r: baseRange.e.r, c: baseRange.e.c },
    },
    slice: {
      rowStart: rowStartAbs,
      rowEnd: rowEndAbs,
      colStart: colStartAbs,
      colEnd: colEndAbs,
      rows: rowEndAbs - rowStartAbs + 1,
      cols: colEndAbs - colStartAbs + 1,
    },
    total: { rows: totalRows, cols: totalCols },
    hasMoreRows: rowEndAbs < baseRange.e.r,
    hasMoreCols: colEndAbs < baseRange.e.c,
    merges: mergesInSlice,
    rows,
  };
};

// POST /api/hr-excel/upload
export const uploadHrExcel = [
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      await ensureHrExcelUploadsTable();
      const reportTypeRaw = String((req.body as any)?.report_type || '').trim();
      const report_type: HrReportType = normalizeReportType(reportTypeRaw);

      if (!reportTypeRaw) {
        return res.status(400).json({ error: 'report_type is required' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // IMPORTANT: avoid parsing whole workbook on upload (can be very slow for large templates).
      // We only need sheet names here. Full parsing will happen on-demand for sheet view / stats.
      const workbook = XLSX.readFile(req.file.path, {
        bookSheets: true,
      });

      const sheetNames = workbook.SheetNames || [];
      if (sheetNames.length === 0) {
        return res.status(400).json({ error: 'Excel file has no sheets' });
      }

      const requestedDefaultSheet = String((req.body as any)?.default_sheet || '').trim();
      const default_sheet =
        (requestedDefaultSheet && sheetNames.includes(requestedDefaultSheet))
          ? requestedDefaultSheet
          : pickDefaultSheetForReport(report_type, workbook, req.file.originalname);

      const record = await hrExcelUploadCreate({
        report_type,
        original_file_name: req.file.originalname,
        stored_file_name: path.basename(req.file.filename),
        sheet_names: JSON.stringify(sheetNames),
        default_sheet,
        created_at: new Date().toISOString(),
      });

      res.status(201).json(record);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
];

// GET /api/hr-excel/latest?report_type=...
export const getLatestHrExcelUpload = async (req: Request, res: Response) => {
  try {
    await ensureHrExcelUploadsTable();
    const reportTypeRaw = String(req.query.report_type || '').trim();
    if (!reportTypeRaw) {
      return res.status(400).json({ error: 'report_type is required' });
    }

    const report_type: HrReportType = normalizeReportType(reportTypeRaw);
    const latest = await hrExcelUploadFindLatestByType(report_type);

    res.json(latest || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/hr-excel/:id
export const getHrExcelUploadById = async (req: Request, res: Response) => {
  try {
    await ensureHrExcelUploadsTable();
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(idParam);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const record = await hrExcelUploadFindUniqueById(id);
    if (!record) return res.status(404).json({ error: 'Not found' });
    res.json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/hr-excel/:id/sheets/:sheetName?rowStart=0&rowLimit=200&colStart=0&colLimit=50
export const getHrExcelSheetView = async (req: Request, res: Response) => {
  try {
    await ensureHrExcelUploadsTable();
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(idParam);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const record = await hrExcelUploadFindUniqueById(id);
    if (!record) return res.status(404).json({ error: 'Not found' });

    const uploadDir = getHrUploadDir();
    const filePath = path.join(uploadDir, record.stored_file_name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Uploaded file not found on server' });
    }

    const report_type: HrReportType = normalizeReportType(record.report_type);

    // Limit parsed rows to keep sheet viewing responsive (some sheets are extremely large).
    const sheetRows =
      report_type === 'temp-timesheet' || report_type === 'official-timesheet'
        ? 8000
        : report_type === 'insurance-master'
          ? 2500
          : 1500;

    const workbook = XLSX.readFile(filePath, { cellDates: true, sheetStubs: true, sheetRows });
    const sheetName = decodeURIComponent(String(req.params.sheetName || ''));
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return res.status(404).json({ error: 'Sheet not found', availableSheets: workbook.SheetNames });
    }

    const rowStart = parseInt(String(req.query.rowStart || '0'));
    const rowLimit = parseInt(String(req.query.rowLimit || '200'));
    const colStart = parseInt(String(req.query.colStart || '0'));
    const colLimit = parseInt(String(req.query.colLimit || '50'));

    const slice = getSheetSlice(sheet, {
      rowStart: Number.isFinite(rowStart) ? rowStart : 0,
      rowLimit: Number.isFinite(rowLimit) ? rowLimit : 200,
      colStart: Number.isFinite(colStart) ? colStart : 0,
      colLimit: Number.isFinite(colLimit) ? colLimit : 50,
    });

    res.json({
      upload: {
        id: record.id,
        report_type: record.report_type,
        original_file_name: record.original_file_name,
        stored_file_name: record.stored_file_name,
        created_at: record.created_at,
        default_sheet: record.default_sheet,
        sheet_names: safeParseJsonArray(record.sheet_names),
      },
      sheetName,
      ...slice,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const safeParseJsonArray = (json: string | null | undefined): string[] => {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};

// GET /api/hr-excel/stats?report_type=...
export const getHrExcelReportStats = async (req: Request, res: Response) => {
  try {
    await ensureHrExcelUploadsTable();
    const reportTypeRaw = String(req.query.report_type || '').trim();
    if (!reportTypeRaw) {
      return res.status(400).json({ error: 'report_type is required' });
    }
    const report_type: HrReportType = normalizeReportType(reportTypeRaw);

    const latest = await hrExcelUploadFindLatestByType(report_type);
    if (!latest) return res.json(null);

    const uploadDir = getHrUploadDir();
    const filePath = path.join(uploadDir, latest.stored_file_name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Uploaded file not found on server' });
    }

    // Limit parsed rows to keep stats fast on very large templates.
    const sheetRows =
      report_type === 'temp-timesheet' || report_type === 'official-timesheet'
        ? 8000
        : report_type === 'insurance-master'
          ? 2500
          : report_type === 'drug-inventory'
            ? 800
            : report_type === 'payroll'
              ? 2500
              : 1500;

    const workbook = XLSX.readFile(filePath, { cellDates: true, sheetStubs: true, sheetRows });
    const sheetName =
      latest.default_sheet ||
      pickDefaultSheetForReport(report_type, workbook, latest.original_file_name) ||
      pickDefaultSheet(workbook);
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return res.json({ report_type, sheetName, stats: null });

    // Extract stats per report type.
    // - attendance-rate / weekly-one-day-workers: triplets (total, attended, rate%)
    // - attendance-count: triplets (official, seasonal, newEmployees) -> sums
    const isRateTriplet = new Set([
      'attendance-rate',
      'weekly-one-day-workers',
    ]).has(report_type);

    const attendanceTriplets = isRateTriplet ? extractAttendanceRateStats(sheet) : null;
    const laborRate = report_type === 'labor-rate' ? extractLaborRateStats(sheet) : null;
    const attendanceCount = report_type === 'attendance-count' ? extractAttendanceCountStats(sheet) : null;
    const totalRow = extractTotalRowValues(sheet);
    const totalRowSummary = summarizeTotalRow(totalRow);
    const bhxhList = report_type === 'bhxh-list' ? extractBhxhListStats(workbook) : null;
    const payroll = report_type === 'payroll' ? extractPayrollStats(workbook) : null;
    const timesheet =
      report_type === 'official-timesheet'
        ? extractOfficialTimesheetStats(sheet)
        : report_type === 'temp-timesheet'
          ? extractTempTimesheetStats(sheet)
          : null;
    const dailyWage = report_type === 'daily-wage' ? extractDailyWageStats(sheet) : null;
    const arrearsCollection = report_type === 'arrears-collection' ? extractArrearsCollectionStats(sheet) : null;
    const insuranceMaster = report_type === 'insurance-master' ? extractInsuranceMasterStats(workbook) : null;
    const medicalRoomUsage = report_type === 'medical-room-usage' ? extractMedicalRoomUsageStats(workbook) : null;
    const drugInventory = report_type === 'drug-inventory' ? extractDrugInventoryStats(sheet) : null;

    return res.json({
      report_type,
      sheetName,
      uploadId: latest.id,
      stats: {
        ...(attendanceTriplets || {}),
        ...(laborRate || {}),
        attendanceCount,
        totalRow,
        totalRowSummary,
        bhxhList,
        payroll,
        timesheet,
        dailyWage,
        arrearsCollection,
        insuranceMaster,
        medicalRoomUsage,
        drugInventory,
        sheetInfo: {
          ref: sheet['!ref'] || 'A1',
          merges: ((sheet as any)['!merges'] || []).length,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const DASHBOARD_HR_REPORT_TYPES = [
  'arrears-collection',
  'temp-timesheet',
  'daily-wage',
  'insurance-master',
] as const;

// GET /api/hr-excel/status — trạng thái upload + file + stats cho từng loại (dashboard)
export const getHrExcelStatus = async (req: Request, res: Response) => {
  try {
    await ensureHrExcelUploadsTable();
    const uploadDir = getHrUploadDir();
    const results: Array<{
      report_type: string;
      hasUpload: boolean;
      fileExists: boolean;
      hasStats: boolean | null;
      uploadId?: number;
      fileName?: string;
      message?: string;
    }> = [];

    for (const report_type of DASHBOARD_HR_REPORT_TYPES) {
      const latest = await hrExcelUploadFindLatestByType(report_type);
      if (!latest) {
        results.push({
          report_type,
          hasUpload: false,
          fileExists: false,
          hasStats: null,
          message: 'Chưa upload file. Vào Nhân sự (HR) → chọn loại tương ứng và upload.',
        });
        continue;
      }

      const filePath = path.join(uploadDir, latest.stored_file_name);
      const fileExists = fs.existsSync(filePath);
      if (!fileExists) {
        results.push({
          report_type,
          hasUpload: true,
          fileExists: false,
          hasStats: null,
          uploadId: latest.id,
          fileName: latest.original_file_name,
          message: 'Đã có bản ghi upload nhưng file không tìm thấy trên server.',
        });
        continue;
      }

      let hasStats: boolean = false;
      try {
        const workbook = XLSX.readFile(filePath, { cellDates: true, sheetStubs: true, sheetRows: 2000 });
        const sheetName =
          latest.default_sheet ||
          pickDefaultSheetForReport(report_type as HrReportType, workbook, latest.original_file_name) ||
          (workbook.SheetNames && workbook.SheetNames[0]) ||
          '';
        const sheet = workbook.Sheets[sheetName];
        if (sheet) {
          if (report_type === 'arrears-collection') {
            hasStats = !!extractArrearsCollectionStats(sheet);
          } else if (report_type === 'temp-timesheet') {
            hasStats = !!extractTempTimesheetStats(sheet);
          } else if (report_type === 'daily-wage') {
            hasStats = !!extractDailyWageStats(sheet);
          } else if (report_type === 'insurance-master') {
            hasStats = !!extractInsuranceMasterStats(workbook);
          }
        }
      } catch (_e) {
        // ignore parse errors for status
      }

      results.push({
        report_type,
        hasUpload: true,
        fileExists: true,
        hasStats,
        uploadId: latest.id,
        fileName: latest.original_file_name,
        message: hasStats
          ? 'Có dữ liệu — dashboard sẽ hiển thị.'
          : 'File tồn tại nhưng parser không nhận ra cấu trúc (header/ sheet khác mẫu).',
      });
    }

    res.json({ items: results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const toNumber = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).replace(/,/g, '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const toPercent = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.endsWith('%')) {
    const n = Number(s.slice(0, -1).trim().replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(s.replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  // Heuristic: 0..1 -> treat as ratio
  if (n >= 0 && n <= 1) return n * 100;
  return n;
};

const findTotalRowInSheet = (sheet: XLSX.WorkSheet) => {
  const ref = sheet['!ref'] || 'A1';
  const baseRange = XLSX.utils.decode_range(ref);
  const maxRowsToScan = Math.min(baseRange.e.r, baseRange.s.r + 400);
  const maxColsToScan = Math.min(baseRange.e.c, baseRange.s.c + 600);

  let best:
    | { score: number; row0: number; col0: number; value: any }
    | null = null;

  const scoreCandidate = (r: number, c: number) => {
    const scanEnd = Math.min(maxColsToScan, c + 300);
    let numericCount = 0;
    let percentCount = 0;

    for (let cc = c + 1; cc <= scanEnd; cc++) {
      const addr = XLSX.utils.encode_cell({ r, c: cc });
      const cell: any = sheet[addr];
      const v: any = cell ? (cell.w ?? cell.v ?? '') : '';
      if (typeof v === 'string' && v.trim().endsWith('%')) {
        const p = toPercent(v);
        if (p !== null) percentCount++;
        continue;
      }
      const n = toNumber(v);
      if (n !== null) numericCount++;
    }

    // Weight numeric cells higher; this helps skip header rows like "Tổng / Ca ngày / Ca đêm"
    return numericCount * 10 + percentCount;
  };

  for (let r = baseRange.s.r; r <= maxRowsToScan; r++) {
    for (let c = baseRange.s.c; c <= maxColsToScan; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell: any = sheet[addr];
      const v: any = cell ? (cell.w ?? cell.v ?? '') : '';
      const t = normalizeText(v);
      const isTotalLabel =
        t === 'total' || t === 'tong' || t === 'tong cong' || t === 'sum' ||
        t === 'tong ket' || t === 'tong truy thu' || t.includes('truy thu');
      if (!isTotalLabel) continue;

      const score = scoreCandidate(r, c);
      if (!best || score > best.score) {
        best = { score, row0: r, col0: c, value: v };
      }
    }
  }

  if (!best) {
    return { row0: null, col0: null, value: null, ref, baseRange };
  }

  return { row0: best.row0, col0: best.col0, value: best.value, ref, baseRange };
};

const extractTotalRowValues = (sheet: XLSX.WorkSheet) => {
  const hit = findTotalRowInSheet(sheet);
  if (hit.row0 === null || hit.col0 === null) return null;

  const { baseRange } = hit;
  const maxColsToRead = Math.min(baseRange.e.c, baseRange.s.c + 600);

  const rowValues: any[] = [];
  for (let c = baseRange.s.c; c <= maxColsToRead; c++) {
    const addr = XLSX.utils.encode_cell({ r: hit.row0, c });
    const cell: any = sheet[addr];
    let v: any = cell ? (cell.w ?? cell.v ?? '') : '';
    if (v instanceof Date) v = v.toISOString().slice(0, 10);
    rowValues.push(v);
  }

  const idxLabel = hit.col0 - baseRange.s.c;
  const values = rowValues
    .map((v, i) => ({ c0: baseRange.s.c + i, c1: baseRange.s.c + i + 1, value: v }))
    .filter(x => String(x.value ?? '').trim() !== '');

  return {
    label: { r1: hit.row0 + 1, c1: hit.col0 + 1, value: hit.value },
    idxLabel,
    values,
  };
};

const summarizeTotalRow = (totalRow: ReturnType<typeof extractTotalRowValues>) => {
  if (!totalRow) return null;

  const numbers: number[] = [];
  const percents: number[] = [];

  for (const cell of totalRow.values || []) {
    const v: any = (cell as any).value;
    const n = toNumber(v);
    if (n !== null) numbers.push(n);

    const isPercent = typeof v === 'string' && v.trim().endsWith('%');
    if (isPercent) {
      const p = toPercent(v);
      if (p !== null) percents.push(p);
    }
  }

  const numbersSum = numbers.reduce((a, b) => a + b, 0);
  const numbersMax = numbers.length ? Math.max(...numbers) : null;
  const numbersMin = numbers.length ? Math.min(...numbers) : null;
  const firstNumber = numbers.length ? numbers[0] : null;
  const firstPercent = percents.length ? percents[0] : null;

  return {
    numbersCount: numbers.length,
    numbersSum,
    numbersMin,
    numbersMax,
    firstNumber,
    percentsCount: percents.length,
    firstPercent,
  };
};

const extractKeyValueFromSheet = (
  sheet: XLSX.WorkSheet,
  labelNeedles: readonly string[],
  opts?: { maxRows?: number; maxCols?: number; valueSearchCols?: number }
) => {
  const ref = sheet['!ref'] || 'A1';
  const baseRange = XLSX.utils.decode_range(ref);

  const maxRowsToScan = Math.min(baseRange.e.r, baseRange.s.r + (opts?.maxRows ?? 120));
  const maxColsToScan = Math.min(baseRange.e.c, baseRange.s.c + (opts?.maxCols ?? 40));
  const valueSearchCols = opts?.valueSearchCols ?? 6;

  const needles = labelNeedles.map(normalizeText);

  for (let r = baseRange.s.r; r <= maxRowsToScan; r++) {
    for (let c = baseRange.s.c; c <= maxColsToScan; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell: any = sheet[addr];
      const raw: any = cell ? (cell.w ?? cell.v ?? '') : '';
      const t = normalizeText(raw);
      if (!t) continue;

      const hit = needles.find(n => t.includes(n));
      if (!hit) continue;

      // Look to the right for the first numeric value
      const end = Math.min(baseRange.e.c, c + valueSearchCols);
      for (let cc = c + 1; cc <= end; cc++) {
        const vAddr = XLSX.utils.encode_cell({ r, c: cc });
        const vCell: any = sheet[vAddr];
        const vRaw: any = vCell ? (vCell.w ?? vCell.v ?? '') : '';
        const n = toNumber(vRaw);
        if (n !== null) {
          return {
            label: raw,
            value: n,
            valueRaw: vRaw,
            pos: { r1: r + 1, c1: c + 1, valueC1: cc + 1 },
          };
        }
      }
    }
  }

  return null;
};

const extractAttendanceCountStats = (sheet: XLSX.WorkSheet) => {
  const ref = sheet['!ref'] || 'A1';
  const baseRange = XLSX.utils.decode_range(ref);
  const maxRowsToScan = Math.min(baseRange.e.r, baseRange.s.r + 200);
  const maxColsToScan = Math.min(baseRange.e.c, baseRange.s.c + 800);

  const rowToArray = (r: number) => {
    const row: any[] = [];
    for (let c = baseRange.s.c; c <= maxColsToScan; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell: any = sheet[addr];
      let v: any = '';
      if (cell) {
        v = cell.w ?? cell.v ?? '';
        if (v instanceof Date) v = v.toISOString().slice(0, 10);
      }
      row.push(v);
    }
    return row;
  };

  // Find the "Total/Tổng" row that actually contains numbers (skip header rows).
  const hit = findTotalRowInSheet(sheet);
  if (hit.row0 === null || hit.col0 === null) return null;
  if (hit.row0 > maxRowsToScan) return null;

  const totalRow = rowToArray(hit.row0);
  const idxLabel = hit.col0 - baseRange.s.c;
  if (idxLabel < 0) return null;

  const triples: Array<{ official: number; seasonal: number; newEmployees: number }> = [];

  // Attendance-count templates often repeat 3 columns: Chính thức / Thời vụ / Người mới
  // There may be blank columns between groups (e.g. "Total", "", 228, 285, 38, ...)
  const buf: number[] = [];
  for (let i = idxLabel + 1; i < totalRow.length; i++) {
    const n = toNumber(totalRow[i]);
    if (n === null) continue;
    buf.push(n);
    if (buf.length === 3) {
      triples.push({
        official: buf[0],
        seasonal: buf[1],
        newEmployees: buf[2],
      });
      buf.length = 0;
    }
  }

  const sums = triples.reduce(
    (acc, t) => {
      acc.official += t.official;
      acc.seasonal += t.seasonal;
      acc.newEmployees += t.newEmployees;
      return acc;
    },
    { official: 0, seasonal: 0, newEmployees: 0 }
  );

  return {
    sums,
    triplesCount: triples.length,
    // Provide the first group as a quick "headline" snapshot
    first: triples[0] || null,
  };
};

const extractAttendanceRateStats = (sheet: XLSX.WorkSheet) => {
  const ref = sheet['!ref'] || 'A1';
  const baseRange = XLSX.utils.decode_range(ref);
  const maxRowsToScan = Math.min(baseRange.e.r, baseRange.s.r + 300);
  const maxColsToScan = Math.min(baseRange.e.c, baseRange.s.c + 600);

  const rowToArray = (r: number) => {
    const row: any[] = [];
    for (let c = baseRange.s.c; c <= maxColsToScan; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell: any = sheet[addr];
      let v: any = '';
      if (cell) {
        v = cell.w ?? cell.v ?? '';
        if (v instanceof Date) v = v.toISOString().slice(0, 10);
      }
      row.push(v);
    }
    return row;
  };

  const hit = findTotalRowInSheet(sheet);
  if (hit.row0 === null || hit.col0 === null) return null;
  if (hit.row0 > maxRowsToScan) return null;

  const totalRow = rowToArray(hit.row0);
  const idxTotal = hit.col0 - baseRange.s.c;
  if (idxTotal < 0) return null;
  const groups: Array<{ total: number; attended: number; rate: number | null; rateStr?: string }> = [];

  let i = idxTotal + 1;
  while (i < totalRow.length) {
    const total = toNumber(totalRow[i]);
    if (total === null) {
      i++;
      continue;
    }
    const attended = toNumber(totalRow[i + 1]);
    const rateRaw = totalRow[i + 2];
    const rate = toPercent(rateRaw);
    if (attended !== null) {
      groups.push({
        total,
        attended,
        rate,
        rateStr: typeof rateRaw === 'string' ? rateRaw : undefined,
      });
      i += 3;
      continue;
    }
    i++;
  }

  const overall = groups[0] || null;
  return { overall, groups };
};

const extractLaborRateStats = (sheet: XLSX.WorkSheet) => {
  const ref = sheet['!ref'] || 'A1';
  const baseRange = XLSX.utils.decode_range(ref);
  const maxColsToScan = Math.min(baseRange.e.c, baseRange.s.c + 800);

  const rowToArray = (r: number) => {
    const row: any[] = [];
    for (let c = baseRange.s.c; c <= maxColsToScan; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell: any = sheet[addr];
      let v: any = '';
      if (cell) {
        v = cell.w ?? cell.v ?? '';
        if (v instanceof Date) v = v.toISOString().slice(0, 10);
      }
      row.push(v);
    }
    return row;
  };

  const hit = findTotalRowInSheet(sheet);
  if (hit.row0 === null || hit.col0 === null) return null;

  const totalRow = rowToArray(hit.row0);
  const idx = hit.col0 - baseRange.s.c;
  if (idx < 0) return null;

  const groups: Array<{ total: number | null; attended: number | null; value: number | null; rate: number | null }> = [];
  const nums: number[] = [];

  for (let i = idx + 1; i < totalRow.length; i++) {
    const v: any = totalRow[i];
    const isPercent = typeof v === 'string' && v.trim().endsWith('%');
    if (isPercent) {
      const p = toPercent(v);
      const a = nums.length >= 3 ? nums[nums.length - 3] : null;
      const b = nums.length >= 2 ? nums[nums.length - 2] : null;
      const c = nums.length >= 1 ? nums[nums.length - 1] : null;
      groups.push({ total: a, attended: b, value: c, rate: p });
      continue;
    }

    const n = toNumber(v);
    if (n !== null) nums.push(n);
  }

  // Fallback: if no % cells found, fall back to attendance-like triplets
  if (groups.length === 0) {
    const triplets = extractAttendanceRateStats(sheet);
    return triplets || null;
  }

  const overall = groups[0] || null;
  // Keep the same top-level shape used by attendance reports (overall + groups),
  // but overall here includes an extra "value" field.
  return { overall, groups };
};

const extractBhxhListStats = (workbook: XLSX.WorkBook) => {
  // This template often has a small summary sheet containing rows like:
  // "Phát sinh phải đóng", "Truy thu", "Số phải nộp" with large numeric values.
  const keys = [
    { key: 'soPhaiNop', needles: ['so phai nop'] },
    { key: 'phatSinhPhaiDong', needles: ['phat sinh phai dong'] },
    { key: 'truyThu', needles: ['truy thu'] },
    { key: 'thua', needles: ['thua'] },
  ] as const;

  for (const sheetName of workbook.SheetNames || []) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const soPhaiNop = extractKeyValueFromSheet(sheet, keys[0].needles, { maxRows: 120, maxCols: 30 });
    if (!soPhaiNop) continue;

    const phatSinhPhaiDong = extractKeyValueFromSheet(sheet, keys[1].needles, { maxRows: 120, maxCols: 30 });
    const truyThu = extractKeyValueFromSheet(sheet, keys[2].needles, { maxRows: 120, maxCols: 30 });
    const thua = extractKeyValueFromSheet(sheet, keys[3].needles, { maxRows: 120, maxCols: 30 });

    return {
      sheetName,
      soPhaiNop,
      phatSinhPhaiDong,
      truyThu,
      thua,
    };
  }

  return null;
};

const extractPayrollStats = (workbook: XLSX.WorkBook) => {
  const sheetNames = workbook.SheetNames || [];
  const bhxhSheetName =
    sheetNames.find(n => {
      const t = normalizeText(n);
      return t.includes('bhxh') && t.includes('ty le');
    }) || null;
  const taxSheetName = sheetNames.find(n => normalizeText(n).includes('tncn')) || null;

  const bhxh = (() => {
    if (!bhxhSheetName) return null;
    const sheet = workbook.Sheets[bhxhSheetName];
    if (!sheet) return null;

    const ref = sheet['!ref'] || 'A1';
    const baseRange = XLSX.utils.decode_range(ref);
    const maxRowsToScan = Math.min(baseRange.e.r, baseRange.s.r + 200);
    const maxColsToScan = Math.min(baseRange.e.c, baseRange.s.c + 50);

    const rowToArray = (r: number) => {
      const row: any[] = [];
      for (let c = baseRange.s.c; c <= maxColsToScan; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell: any = sheet[addr];
        let v: any = '';
        if (cell) v = cell.w ?? cell.v ?? '';
        if (v instanceof Date) v = v.toISOString().slice(0, 10);
        row.push(v);
      }
      return row;
    };

    type SectionKey = 'korean' | 'vietnamese';
    const out: Record<SectionKey, { period: string; rate: number } | null> = {
      korean: null,
      vietnamese: null,
    };

    let section: SectionKey | null = null;
    let totalCol = -1;

    for (let r = baseRange.s.r; r <= maxRowsToScan; r++) {
      const row = rowToArray(r);
      const rowText = row.map(v => normalizeText(v));

      if (rowText.some(t => t.includes('ty le bhxh nguoi han'))) {
        section = 'korean';
        totalCol = -1;
        continue;
      }
      if (rowText.some(t => t.includes('ty le bhxh nguoi viet'))) {
        section = 'vietnamese';
        totalCol = -1;
        continue;
      }

      if (!section) continue;

      if (totalCol < 0) {
        const hasGiaiDoan = rowText.some(t => t.includes('giai doan'));
        const idxTong = rowText.findIndex(t => t === 'tong');
        if (hasGiaiDoan && idxTong >= 0) {
          totalCol = idxTong;
        }
        continue;
      }

      const periodRaw = String(row[0] ?? '').trim();
      if (!periodRaw) continue;
      if (!normalizeText(periodRaw).includes('tu')) continue;

      const rate = toPercent(row[totalCol]);
      if (rate === null) continue;
      out[section] = { period: periodRaw, rate };
    }

    return {
      sheetName: bhxhSheetName,
      ...out,
    };
  })();

  const tax = (() => {
    if (!taxSheetName) return null;
    const sheet = workbook.Sheets[taxSheetName];
    if (!sheet) return null;

    const ref = sheet['!ref'] || 'A1';
    const baseRange = XLSX.utils.decode_range(ref);
    const maxRowsToScan = Math.min(baseRange.e.r, baseRange.s.r + 250);
    const maxColsToScan = Math.min(baseRange.e.c, baseRange.s.c + 80);

    const rowToArray = (r: number) => {
      const row: any[] = [];
      for (let c = baseRange.s.c; c <= maxColsToScan; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell: any = sheet[addr];
        let v: any = '';
        if (cell) v = cell.w ?? cell.v ?? '';
        if (v instanceof Date) v = v.toISOString().slice(0, 10);
        row.push(v);
      }
      return row;
    };

    // Find the "Total" column from the first header row that contains it.
    let totalCol = -1;
    let headerRow0 = -1;
    for (let r = baseRange.s.r; r <= Math.min(maxRowsToScan, baseRange.s.r + 10); r++) {
      const rowText = rowToArray(r).map(v => normalizeText(v));
      const idx = rowText.findIndex(t => t === 'total');
      if (idx >= 0) {
        totalCol = idx;
        headerRow0 = r;
        break;
      }
    }
    if (totalCol < 0) return null;

    let sum = 0;
    let max: number | null = null;
    let count = 0;

    for (let r = headerRow0 + 1; r <= maxRowsToScan; r++) {
      const row = rowToArray(r);
      const n = toNumber(row[totalCol]);
      if (n === null) continue;
      sum += n;
      max = max === null ? n : Math.max(max, n);
      count++;
    }

    return {
      sheetName: taxSheetName,
      totalSum: sum,
      totalMax: max,
      valuesCount: count,
      totalCol1: baseRange.s.c + totalCol + 1,
    };
  })();

  return { bhxh, tax };
};

const extractOfficialTimesheetStats = (sheet: XLSX.WorkSheet) => {
  const ref = sheet['!ref'] || 'A1';
  const baseRange = XLSX.utils.decode_range(ref);
  const maxRowsToScan = Math.min(baseRange.e.r, baseRange.s.r + 60);
  const maxColsToScan = Math.min(baseRange.e.c, baseRange.s.c + 120);

  const rowToArray = (r: number, full = false) => {
    const row: any[] = [];
    const cEnd = full ? baseRange.e.c : maxColsToScan;
    for (let c = baseRange.s.c; c <= cEnd; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell: any = sheet[addr];
      let v: any = '';
      if (cell) v = cell.w ?? cell.v ?? '';
      if (v instanceof Date) v = v.toISOString().slice(0, 10);
      row.push(v);
    }
    return row;
  };

  let headerRow0: number | null = null;
  let headers: any[] = [];
  for (let r = baseRange.s.r; r <= maxRowsToScan; r++) {
    const row = rowToArray(r);
    const t = row.map(v => normalizeText(v));
    if (t.some(x => x.includes('ma nv')) && t.some(x => x.includes('tong cong'))) {
      headerRow0 = r;
      headers = row;
      break;
    }
  }
  if (headerRow0 === null) return null;

  const headerNorm = headers.map(v => normalizeText(v));
  const findCol = (needles: string[]) => headerNorm.findIndex(h => needles.every(n => h.includes(n)));

  const colMaNv = findCol(['ma nv']);
  const colTongCong = findCol(['tong cong']);
  const colTongGioCong = findCol(['tong gio cong']);
  const colTinhLuong = findCol(['total tinh luong']);

  if (colMaNv < 0) return null;

  let employeesCount = 0;
  let sumWorkDays = 0;
  let sumWorkHours = 0;
  let sumPaidHours = 0;

  let emptyStreak = 0;
  for (let r = headerRow0 + 1; r <= baseRange.e.r; r++) {
    const row = rowToArray(r, true);
    const maNv = String(row[colMaNv] ?? '').trim();
    if (!maNv) {
      emptyStreak++;
      if (emptyStreak >= 50) break;
      continue;
    }
    emptyStreak = 0;

    employeesCount++;
    if (colTongCong >= 0) sumWorkDays += toNumber(row[colTongCong]) ?? 0;
    if (colTongGioCong >= 0) sumWorkHours += toNumber(row[colTongGioCong]) ?? 0;
    if (colTinhLuong >= 0) sumPaidHours += toNumber(row[colTinhLuong]) ?? 0;
  }

  return {
    employeesCount,
    sums: {
      workDays: Math.round(sumWorkDays * 100) / 100,
      workHours: Math.round(sumWorkHours * 100) / 100,
      paidHours: Math.round(sumPaidHours * 100) / 100,
    },
    headerRow1: headerRow0 + 1,
    cols: {
      maNvCol1: colMaNv >= 0 ? baseRange.s.c + colMaNv + 1 : null,
      tongCongCol1: colTongCong >= 0 ? baseRange.s.c + colTongCong + 1 : null,
      tongGioCongCol1: colTongGioCong >= 0 ? baseRange.s.c + colTongGioCong + 1 : null,
      tinhLuongCol1: colTinhLuong >= 0 ? baseRange.s.c + colTinhLuong + 1 : null,
    },
  };
};

const extractTempTimesheetStats = (sheet: XLSX.WorkSheet) => {
  const ref = sheet['!ref'] || 'A1';
  const baseRange = XLSX.utils.decode_range(ref);
  const maxRowsToScan = Math.min(baseRange.e.r, baseRange.s.r + 200);
  const maxColsToScan = Math.min(baseRange.e.c, baseRange.s.c + 120);

  const rowToArray = (r: number, full = false) => {
    const row: any[] = [];
    const cEnd = full ? baseRange.e.c : maxColsToScan;
    for (let c = baseRange.s.c; c <= cEnd; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell: any = sheet[addr];
      let v: any = '';
      if (cell) v = cell.w ?? cell.v ?? '';
      if (v instanceof Date) v = v.toISOString().slice(0, 10);
      row.push(v);
    }
    return row;
  };

  const hasHeader = (t: string[]) =>
    (t.some(x => x.includes('id moi') || x.includes('ma nv') || (x === 'id') || x.includes('code')) &&
     (t.some(x => x === 'name' || x.includes('name') || x.includes('ten') || x.includes('hoten')))) ||
    t.some(x => x.includes('cong') || x.includes('gio') || x.includes('hour'));

  let headerRow0: number | null = null;
  let headers: any[] = [];
  for (let r = baseRange.s.r; r <= Math.min(maxRowsToScan, baseRange.s.r + 25); r++) {
    const row = rowToArray(r);
    const t = row.map(v => normalizeText(v));
    if (hasHeader(t)) {
      headerRow0 = r;
      headers = row;
      break;
    }
  }
  if (headerRow0 === null) {
    // Fallback: dùng dòng 0, tìm cột có số (giờ/công) và cột có text (id/name)
    headerRow0 = baseRange.s.r;
    headers = rowToArray(baseRange.s.r);
    const t = headers.map(v => normalizeText(v));
    if (!t.some(x => x.includes('id') || x.includes('ma') || x.includes('code') || x.includes('gio') || x.includes('hour') || x.includes('cong'))) {
      return null;
    }
  }

  const headerNorm = headers.map(v => normalizeText(v));
  const findColAny = (needlesList: string[][]): number => {
    for (const needles of needlesList) {
      const i = headerNorm.findIndex(h => needles.some(n => h.includes(n)));
      if (i >= 0) return i;
    }
    return -1;
  };

  const colId = findColAny([['id moi'], ['ma nv'], ['id'], ['code'], ['mã nv']]);
  const colCong = findColAny([['cong t6+7'], ['cong'], ['công'], ['work day']]);
  const colHours = findColAny([['total (so gio)', 't6+7'], ['tong gio'], ['so gio'], ['tổng giờ'], ['số giờ'], ['gio'], ['hour'], ['gio cong']]);
  const colLeaveP = findColAny([['nghi co phep'], ['nghỉ có phép']]);
  const colLeaveU = findColAny([['nghi ko phep'], ['nghỉ ko phép']]);

  let effectiveIdCol = colId >= 0 ? colId : headerNorm.findIndex(h => h.includes('id') || h.includes('ma') || h.includes('code') || h.includes('mã'));
  if (effectiveIdCol < 0) effectiveIdCol = 0;
  if (effectiveIdCol < 0) return null;

  const effectiveHoursCol = colHours >= 0 ? colHours : findColAny([['gio'], ['hour'], ['tong'], ['total']]);

  let employeesCount = 0;
  let sumWorkDays = 0;
  let sumWorkHours = 0;
  let sumLeaveWithPermit = 0;
  let sumLeaveWithoutPermit = 0;

  let emptyStreak = 0;
  for (let r = headerRow0 + 1; r <= baseRange.e.r; r++) {
    const row = rowToArray(r, true);
    const id = String(row[effectiveIdCol] ?? '').trim();
    if (!id) {
      emptyStreak++;
      if (emptyStreak >= 50) break;
      continue;
    }
    emptyStreak = 0;

    employeesCount++;
    if (colCong >= 0) sumWorkDays += toNumber(row[colCong]) ?? 0;
    if (effectiveHoursCol >= 0) sumWorkHours += toNumber(row[effectiveHoursCol]) ?? 0;
    if (colLeaveP >= 0) sumLeaveWithPermit += toNumber(row[colLeaveP]) ?? 0;
    if (colLeaveU >= 0) sumLeaveWithoutPermit += toNumber(row[colLeaveU]) ?? 0;
  }

  let hoursColForDisplay = effectiveHoursCol;
  if (effectiveHoursCol < 0 && sumWorkHours === 0 && employeesCount > 0) {
    const hoursColIdx = headerNorm.findIndex(h => h.includes('gio') || h.includes('hour') || h.includes('tong'));
    if (hoursColIdx >= 0) {
      hoursColForDisplay = hoursColIdx;
      let s = 0;
      for (let r = headerRow0 + 1; r <= Math.min(baseRange.e.r, headerRow0 + 500); r++) {
        s += toNumber(rowToArray(r, true)[hoursColIdx]) ?? 0;
      }
      sumWorkHours = Math.round(s * 100) / 100;
    }
  }

  return {
    employeesCount,
    sums: {
      workDays: Math.round(sumWorkDays * 100) / 100,
      workHours: Math.round(sumWorkHours * 100) / 100,
      leaveWithPermit: Math.round(sumLeaveWithPermit * 100) / 100,
      leaveWithoutPermit: Math.round(sumLeaveWithoutPermit * 100) / 100,
    },
    headerRow1: headerRow0 + 1,
    cols: {
      idCol1: baseRange.s.c + effectiveIdCol + 1,
      congCol1: colCong >= 0 ? baseRange.s.c + colCong + 1 : null,
      hoursCol1: hoursColForDisplay >= 0 ? baseRange.s.c + hoursColForDisplay + 1 : null,
    },
  };
};

const extractDailyWageStats = (sheet: XLSX.WorkSheet) => {
  const ref = sheet['!ref'] || 'A1';
  const baseRange = XLSX.utils.decode_range(ref);
  const maxRowsToScan = Math.min(baseRange.e.r, baseRange.s.r + 120);
  const maxColsToScan = Math.min(baseRange.e.c, baseRange.s.c + 80);

  const rowToArray = (r: number) => {
    const row: any[] = [];
    for (let c = baseRange.s.c; c <= maxColsToScan; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell: any = sheet[addr];
      let v: any = '';
      if (cell) v = cell.w ?? cell.v ?? '';
      if (v instanceof Date) v = v.toISOString().slice(0, 10);
      row.push(v);
    }
    return row;
  };

  // Find header row: "Ngày" (or "Ngay") and "Tổng" / "Tong" / "Tổng cộng" / cột có số
  let headerRow0 = -1;
  let labelCol = -1;
  let totalCol = -1;
  for (let r = baseRange.s.r; r <= Math.min(maxRowsToScan, baseRange.s.r + 25); r++) {
    const row = rowToArray(r);
    const rowText = row.map(v => normalizeText(v));
    const idxNgay = rowText.findIndex(t => t === 'ngay' || t.includes('ngay'));
    const idxTong = rowText.findIndex(t => t === 'tong' || t === 'tong cong' || t === 'tong ket' || t.includes('tong'));
    if (idxNgay >= 0 && idxTong >= 0) {
      headerRow0 = r;
      labelCol = idxNgay;
      totalCol = idxTong;
      break;
    }
    if (idxTong >= 0 && labelCol < 0) {
      labelCol = rowText.findIndex(t => t && t.length > 0);
      if (labelCol >= 0) {
        headerRow0 = r;
        totalCol = idxTong;
        break;
      }
    }
  }

  if (headerRow0 < 0 || totalCol < 0) {
    // Fallback: tìm bất kỳ dòng nào có ô chứa "tổng"/"total" và ô bên cạnh là số
    for (let r = baseRange.s.r; r <= Math.min(maxRowsToScan, baseRange.s.r + 80); r++) {
      const row = rowToArray(r);
      for (let c = baseRange.s.c; c < row.length - 1; c++) {
        const label = normalizeText(String(row[c] ?? ''));
        if (label.includes('tong') || label.includes('total')) {
          const n = toNumber(row[c + 1]);
          if (n !== null && n > 0) {
            return {
              grandTotal: n,
              totalsByLabel: [],
              cols: { labelCol1: baseRange.s.c + c + 1, totalCol1: baseRange.s.c + c + 2 },
            };
          }
        }
      }
    }
    return null;
  }
  if (labelCol < 0) labelCol = 0;

  const totalsByLabel: Array<{ label: string; value: number }> = [];
  let grandTotal: number | null = null;

  for (let r = headerRow0 + 1; r <= maxRowsToScan; r++) {
    const row = rowToArray(r);
    const labelRaw = String(row[labelCol] ?? '').trim();
    const labelNorm = normalizeText(labelRaw);
    const n = toNumber(row[totalCol]);
    if (n === null) continue;

    if (labelNorm === 'total' || labelNorm === 'tong' || labelNorm === 'tong cong' || labelNorm === 'tong ket' || labelNorm.includes('tong')) {
      grandTotal = n;
    }
    if (labelRaw) totalsByLabel.push({ label: labelRaw, value: n });
  }

  if (grandTotal === null && totalsByLabel.length > 0) {
    grandTotal = totalsByLabel.reduce((sum, x) => sum + x.value, 0);
  }

  return {
    grandTotal,
    totalsByLabel: totalsByLabel.slice(0, 15),
    cols: {
      labelCol1: baseRange.s.c + labelCol + 1,
      totalCol1: baseRange.s.c + totalCol + 1,
    },
  };
};

/** Quét sheet lấy số có thể là tiền: ưu tiên >= 1000, không có thì lấy mọi số > 0 */
const extractArrearsFallbackFromSheet = (sheet: XLSX.WorkSheet): number[] => {
  const ref = sheet['!ref'] || 'A1';
  const baseRange = XLSX.utils.decode_range(ref);
  const maxRows = Math.min(baseRange.e.r, baseRange.s.r + 500);
  const maxCols = Math.min(baseRange.e.c, baseRange.s.c + 100);
  const numsLarge: number[] = [];
  const numsAny: number[] = [];
  for (let r = baseRange.s.r; r <= maxRows; r++) {
    for (let c = baseRange.s.c; c <= maxCols; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell: any = sheet[addr];
      const v: any = cell ? (cell.w ?? cell.v ?? '') : '';
      const n = toNumber(v);
      if (n !== null && n > 0) {
        numsAny.push(n);
        if (n >= 1000) numsLarge.push(n);
      }
    }
  }
  return numsLarge.length > 0 ? numsLarge : numsAny;
};

const extractArrearsCollectionStats = (sheet: XLSX.WorkSheet) => {
  const totalRow = extractTotalRowValues(sheet);
  let nums: number[] = [];

  if (totalRow && (totalRow.values || []).length > 0) {
    nums = (totalRow.values || [])
      .map((x: any) => toNumber(x.value))
      .filter((n: number | null): n is number => n !== null);
  }

  if (nums.length === 0) {
    nums = extractArrearsFallbackFromSheet(sheet);
  }

  if (nums.length === 0) return null;

  return {
    amountMax: Math.max(...nums),
    amountSum: nums.reduce((a, b) => a + b, 0),
    numbersCount: nums.length,
  };
};

const extractInsuranceMasterStats = (workbook: XLSX.WorkBook) => {
  const names = workbook.SheetNames || [];
  const dataSheetName =
    names.find(n => normalizeText(n).includes('du lieu')) ||
    names.find(n => normalizeText(n).includes('du-lieu')) ||
    names.find(n => normalizeText(n).includes('danh sach')) ||
    names.find(n => normalizeText(n) === 'ds' || normalizeText(n).includes('data')) ||
    names[0] ||
    null;
  const familySheetName = names.find(n => normalizeText(n).includes('phu luc')) || null;

  const countDataRows = (sheetName: string | null) => {
    if (!sheetName) return null;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return null;

    const ref = sheet['!ref'] || 'A1';
    const baseRange = XLSX.utils.decode_range(ref);
    const maxRowsToScan = Math.min(baseRange.e.r, baseRange.s.r + 350);
    const maxColsToScan = Math.min(baseRange.e.c, baseRange.s.c + 120);

    const rowToArray = (r: number) => {
      const row: any[] = [];
      for (let c = baseRange.s.c; c <= maxColsToScan; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell: any = sheet[addr];
        let v: any = '';
        if (cell) v = cell.w ?? cell.v ?? '';
        if (v instanceof Date) v = v.toISOString().slice(0, 10);
        row.push(v);
      }
      return row;
    };

    const hasStt = (t: string[]) => t.some(x => x === 'stt' || x === 'tt' || x === 'no');
    const hasHoTen = (t: string[]) => t.some(x => x.includes('hoten') || x.includes('ho ten') || x.includes('ten'));
    const hasMaso = (t: string[]) => t.some(x => x.includes('masobhxh') || x.includes('maso bhxh') || x.includes('so bhxh') || x.includes('bhxh') || x.includes('cmt') || x.includes('cccd'));

    let headerRow0: number | null = null;
    let headers: any[] = [];
    for (let r = baseRange.s.r; r <= Math.min(maxRowsToScan, baseRange.s.r + 25); r++) {
      const row = rowToArray(r);
      const t = row.map(v => normalizeText(v));
      if ((hasStt(t) || t.some(x => x.length <= 4)) && (hasHoTen(t) || hasMaso(t))) {
        headerRow0 = r;
        headers = row;
        break;
      }
    }
    // Fallback: nếu không tìm thấy header chuẩn, dùng dòng 0 làm header và đếm dòng có ít nhất 2 ô không rỗng
    if (headerRow0 === null) {
      headerRow0 = baseRange.s.r;
      headers = rowToArray(baseRange.s.r);
    }

    const headerNorm = headers.map(v => normalizeText(v));
    const colHoTen = headerNorm.findIndex(h => h.includes('hoten') || h.includes('ho ten') || h.includes('ten'));
    const colMaso = headerNorm.findIndex(h => h.includes('masobhxh') || h.includes('maso') || h.includes('bhxh') || h.includes('cmt') || h.includes('cccd'));

    let count = 0;
    let emptyStreak = 0;
    for (let r = headerRow0 + 1; r <= maxRowsToScan; r++) {
      const row = rowToArray(r);
      const hoTen = colHoTen >= 0 ? String(row[colHoTen] ?? '').trim() : '';
      const maso = colMaso >= 0 ? String(row[colMaso] ?? '').trim() : '';
      const has = !!(hoTen && hoTen !== '#REF!') || !!(maso && maso !== '#REF!');
      if (!has) {
        const nonEmpty = row.filter(c => String(c ?? '').trim() !== '').length;
        if (nonEmpty >= 2) {
          emptyStreak = 0;
          count++;
        } else {
          emptyStreak++;
          if (emptyStreak >= 30) break;
        }
        continue;
      }
      emptyStreak = 0;
      count++;
    }

    return { sheetName, count };
  };

  const employees = countDataRows(dataSheetName);
  const family = countDataRows(familySheetName);

  return {
    employeesCount: employees?.count ?? null,
    familyMembersCount: family?.count ?? null,
    sheets: {
      employees: employees?.sheetName ?? null,
      family: family?.sheetName ?? null,
    },
  };
};

const extractMedicalRoomUsageStats = (workbook: XLSX.WorkBook) => {
  const names = workbook.SheetNames || [];
  const bcName =
    names.find(n => normalizeText(n) === 'bc') ||
    pickSheetByKeywords(names, ['bao cao', 'bc'], ['ds cnv', 'chart', 'data', 'sheet', 'z']) ||
    null;

  if (!bcName) return null;
  const sheet = workbook.Sheets[bcName];
  if (!sheet) return null;

  const ref = sheet['!ref'] || 'A1';
  const baseRange = XLSX.utils.decode_range(ref);
  const maxRowsToScan = Math.min(baseRange.e.r, baseRange.s.r + 200);
  const maxColsToScan = Math.min(baseRange.e.c, baseRange.s.c + 200);

  const rowToArray = (r: number) => {
    const row: any[] = [];
    for (let c = baseRange.s.c; c <= maxColsToScan; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell: any = sheet[addr];
      let v: any = '';
      if (cell) v = cell.w ?? cell.v ?? '';
      if (v instanceof Date) v = v.toISOString().slice(0, 10);
      row.push(v);
    }
    return row;
  };

  const sumRowNumbers = (row: any[]) => {
    const nums = row.map(toNumber).filter((n: number | null): n is number => n !== null);
    return {
      sum: nums.reduce((a, b) => a + b, 0),
      max: nums.length ? Math.max(...nums) : null,
      count: nums.length,
    };
  };

  const sumRowPercents = (row: any[]) => {
    const ps = row.map(toPercent).filter((n: number | null): n is number => n !== null);
    return {
      max: ps.length ? Math.max(...ps) : null,
      count: ps.length,
    };
  };

  let moneyRow0: number | null = null;
  let peopleRow0: number | null = null;
  let rateRow0: number | null = null;

  for (let r = baseRange.s.r; r <= maxRowsToScan; r++) {
    const row = rowToArray(r);
    const t = row.map(v => normalizeText(v));

    if (moneyRow0 === null && t.some(x => x.includes('so tien')) && t.some(x => x === 'total' || x === 'tong')) {
      moneyRow0 = r;
      continue;
    }
    if (peopleRow0 === null && t.some(x => x.includes('so nguoi'))) {
      peopleRow0 = r;
      continue;
    }
    if (rateRow0 === null && t.some(x => x.includes('ty le'))) {
      rateRow0 = r;
      continue;
    }
  }

  const money = moneyRow0 !== null ? sumRowNumbers(rowToArray(moneyRow0)) : null;
  const people = peopleRow0 !== null ? sumRowNumbers(rowToArray(peopleRow0)) : null;
  const rate = rateRow0 !== null ? sumRowPercents(rowToArray(rateRow0)) : null;

  return {
    sheetName: bcName,
    money,
    people,
    rate,
  };
};

const extractDrugInventoryStats = (sheet: XLSX.WorkSheet) => {
  const ref = sheet['!ref'] || 'A1';
  const baseRange = XLSX.utils.decode_range(ref);
  const maxRowsToScan = Math.min(baseRange.e.r, baseRange.s.r + 700);
  const maxColsToScan = Math.min(baseRange.e.c, baseRange.s.c + 400);

  const rowToArray = (r: number) => {
    const row: any[] = [];
    for (let c = baseRange.s.c; c <= maxColsToScan; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell: any = sheet[addr];
      let v: any = '';
      if (cell) v = cell.w ?? cell.v ?? '';
      if (v instanceof Date) v = v.toISOString().slice(0, 10);
      row.push(v);
    }
    return row;
  };

  let importQty = 0;
  let exportQty = 0;
  let importRows = 0;
  let exportRows = 0;

  for (let r = baseRange.s.r; r <= maxRowsToScan; r++) {
    const row = rowToArray(r);

    let kind: 'import' | 'export' | null = null;
    let labelCol = -1;

    for (let i = 0; i < Math.min(row.length, 40); i++) {
      const t = normalizeText(row[i]);
      if (!t) continue;
      if (t.startsWith('nhap')) {
        kind = 'import';
        labelCol = i;
        break;
      }
      if (t.startsWith('xuat')) {
        kind = 'export';
        labelCol = i;
        break;
      }
    }

    if (!kind || labelCol < 0) continue;

    let sum = 0;
    for (let i = labelCol + 1; i < row.length; i++) {
      const n = toNumber(row[i]);
      if (n !== null) sum += n;
    }

    if (kind === 'import') {
      importQty += sum;
      importRows++;
    } else {
      exportQty += sum;
      exportRows++;
    }
  }

  return {
    importQty,
    exportQty,
    importRows,
    exportRows,
  };
};

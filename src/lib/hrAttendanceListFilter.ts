import type { RowStyle } from '@/components/shared/ExcelGrid';
import { normalizeHrReportText } from '@/lib/hrReportInsights';

type GridRow = (string | number)[];

export type GridCellStyles = Record<string, RowStyle>;

const HEADER_SCAN_ROWS = 12;

function cellNorm(v: unknown): string {
  return normalizeHrReportText(v);
}

/** Dòng tiêu đề có cột Mã NV (sheet Attendance list / Data) */
export function findTimesheetHeaderRowIndex(rows: GridRow[]): number {
  for (let r = 0; r < Math.min(rows.length, HEADER_SCAN_ROWS); r++) {
    const row = rows[r] || [];
    const hit = row.some((c) => {
      const t = cellNorm(c);
      return t === 'ma nv' || (t.includes('ma') && t.includes('nv'));
    });
    if (hit) return r;
  }
  return -1;
}

/** Cột đầu tiên là ngày 1..31 trong header */
export function findDayStartColumn(headerRow: GridRow): number {
  let best = -1;
  for (let c = 0; c < headerRow.length; c++) {
    const s = String(headerRow[c] ?? '').trim();
    if (/^\d{1,2}$/.test(s)) {
      const n = parseInt(s, 10);
      if (n >= 1 && n <= 31 && (best < 0 || c < best)) best = c;
    }
  }
  return best;
}

function isCodeHeaderCell(h: unknown): boolean {
  const t = cellNorm(h);
  return t === 'ma nv' || t.includes('ma nv') || t === 'id moi' || t.includes('id moi');
}

function isNameHeaderCell(h: unknown): boolean {
  const t = cellNorm(h);
  return t.includes('ho ten');
}

function findSttColumnIndex(headerRow: GridRow): number {
  return headerRow.findIndex((c) => {
    const t = cellNorm(c);
    return t === 'stt' || t === 'no';
  });
}

/**
 * Giữ 3 dòng đầu (title, subtitle, header), lọc dữ liệu theo mã / họ tên; cập nhật lại STT.
 */
export function filterBuiltInTimesheetDetailRows(rows: GridRow[], codeQuery: string, nameQuery: string): GridRow[] {
  const cq = cellNorm(codeQuery);
  const nq = cellNorm(nameQuery);
  if (!cq && !nq) return rows;

  const headerIdx = findTimesheetHeaderRowIndex(rows);
  if (headerIdx < 0) return rows;

  const headerRow = rows[headerIdx] || [];
  const codeCols: number[] = [];
  const nameCols: number[] = [];
  for (let c = 0; c < headerRow.length; c++) {
    if (isCodeHeaderCell(headerRow[c])) codeCols.push(c);
    if (isNameHeaderCell(headerRow[c])) nameCols.push(c);
  }

  const head = rows.slice(0, headerIdx + 1);
  const body = rows.slice(headerIdx + 1);

  const filtered = body.filter((row) => {
    if (cq) {
      const hay =
        codeCols.length > 0
          ? codeCols.map((i) => cellNorm(row[i])).join('\0')
          : row.map((c) => cellNorm(c)).join('\0');
      if (!hay.includes(cq)) return false;
    }
    if (nq) {
      const hay =
        nameCols.length > 0
          ? nameCols.map((i) => cellNorm(row[i])).join('\0')
          : row.map((c) => cellNorm(c)).join('\0');
      if (!hay.includes(nq)) return false;
    }
    return true;
  });

  const sttCol = findSttColumnIndex(headerRow);
  if (sttCol >= 0) {
    return [
      ...head,
      ...filtered.map((row, i) => {
        const next = [...row];
        while (next.length <= sttCol) next.push('');
        next[sttCol] = i + 1;
        return next;
      }),
    ];
  }

  return [...head, ...filtered];
}

/** Xóa tô màu cũ ở dòng dữ liệu và tô lại cột Chủ nhật (7,14,21,28) giống backend */
export function adjustTimesheetWeekendCellStyles(
  rows: GridRow[],
  headerRowIndex: number,
  prev: GridCellStyles | undefined,
  dayStartCol: number,
): GridCellStyles {
  const next: GridCellStyles = { ...(prev || {}) };
  for (const key of Object.keys(next)) {
    const r = Number(key.split(',')[0]);
    if (!Number.isFinite(r)) continue;
    if (r > headerRowIndex) delete next[key];
  }
  if (dayStartCol < 0) return next;
  for (const day of [7, 14, 21, 28]) {
    const col = dayStartCol + day - 1;
    if (col < 0) continue;
    for (let r = headerRowIndex; r < rows.length; r++) {
      next[`${r},${col}`] = { backgroundColor: '#fdba74' };
    }
  }
  return next;
}

export function filterBuiltInTimesheetSheet(
  sheet: {
    name: string;
    rows: GridRow[];
    merges?: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
    rowStyles?: Record<number, unknown>;
    cellStyles?: GridCellStyles;
    colWidths?: Record<number, number>;
    rowHeights?: Record<number, number>;
    hiddenCols?: number[];
    hiddenRows?: number[];
  },
  codeQuery: string,
  nameQuery: string,
) {
  if (sheet.name !== 'Attendance list' && sheet.name !== 'Data') return sheet;
  const trimmedCode = codeQuery.trim();
  const trimmedName = nameQuery.trim();
  if (!trimmedCode && !trimmedName) return sheet;

  const nextRows = filterBuiltInTimesheetDetailRows(sheet.rows, trimmedCode, trimmedName);
  const hi = findTimesheetHeaderRowIndex(sheet.rows);
  const headerRow = hi >= 0 ? sheet.rows[hi] || [] : [];
  const dayStart = findDayStartColumn(headerRow);
  const cellStyles =
    hi >= 0 && dayStart >= 0
      ? adjustTimesheetWeekendCellStyles(nextRows, hi, sheet.cellStyles, dayStart)
      : { ...sheet.cellStyles };

  return { ...sheet, rows: nextRows, cellStyles };
}

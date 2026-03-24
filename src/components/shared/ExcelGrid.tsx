import { useMemo } from 'react';

export type ExcelMerge = {
  s: { r: number; c: number };
  e: { r: number; c: number };
};

export type RowStyle = {
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

export function ExcelGrid({
  rows,
  merges = [],
  rowStyles = {},
  cellStyles = {},
  colWidths = {},
  rowHeights = {},
  hiddenCols = [],
  hiddenRows = [],
}: {
  rows: Array<Array<string | number>>;
  merges?: ExcelMerge[];
  /** Row index -> style (nền xanh, chữ trắng, vàng, xanh nhạt...) */
  rowStyles?: Record<number, RowStyle>;
  /** Key "r,c" -> style (chữ đỏ...) */
  cellStyles?: Record<string, RowStyle>;
  colWidths?: Record<number, number>;
  rowHeights?: Record<number, number>;
  hiddenCols?: number[];
  hiddenRows?: number[];
}) {
  const { startSpanMap, skipSet, hiddenColsSet, hiddenRowsSet, maxCols } = useMemo(() => {
    const startSpanMap = new Map<string, { rowSpan: number; colSpan: number }>();
    const skipSet = new Set<string>();
    const hiddenColsSet = new Set(hiddenCols);
    const hiddenRowsSet = new Set(hiddenRows);
    const maxCols = rows.reduce((max, row) => Math.max(max, row.length), 0);

    for (const m of merges) {
      const rowSpan = m.e.r - m.s.r + 1;
      const colSpan = m.e.c - m.s.c + 1;
      const startKey = `${m.s.r},${m.s.c}`;
      startSpanMap.set(startKey, { rowSpan, colSpan });

      for (let r = m.s.r; r <= m.e.r; r++) {
        for (let c = m.s.c; c <= m.e.c; c++) {
          if (r === m.s.r && c === m.s.c) continue;
          skipSet.add(`${r},${c}`);
        }
      }
    }

    return { startSpanMap, skipSet, hiddenColsSet, hiddenRowsSet, maxCols };
  }, [hiddenCols, hiddenRows, merges, rows]);

  if (!rows.length) {
    return (
      <div className="border rounded-lg p-6 text-sm text-muted-foreground">
        Không có dữ liệu để hiển thị.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-auto max-h-[70vh] bg-background">
      <table className="min-w-max border-collapse text-[11px] border border-border">
        <colgroup>
          {Array.from({ length: maxCols }, (_, c) => {
            const width = colWidths[c];
            const hidden = hiddenColsSet.has(c);
            return (
              <col
                key={c}
                style={{
                  width: width ? `${width}px` : undefined,
                  minWidth: width ? `${width}px` : undefined,
                  maxWidth: hidden ? '0px' : undefined,
                  visibility: hidden ? 'collapse' : undefined,
                }}
              />
            );
          })}
        </colgroup>
        <tbody>
          {rows.map((row, r) => {
            const rowStyle = rowStyles[r] || {};
            return (
              <tr
                key={r}
                style={{
                  height: rowHeights[r] ? `${rowHeights[r]}px` : undefined,
                  display: hiddenRowsSet.has(r) ? 'none' : undefined,
                }}
              >
                {row.map((cell, c) => {
                  const key = `${r},${c}`;
                  if (skipSet.has(key)) return null;
                  const span = startSpanMap.get(key);
                  const cellStyle = cellStyles[key] || {};
                  const spanCols = Array.from({ length: span?.colSpan || 1 }, (_, idx) => c + idx);
                  const fullyHidden = spanCols.every((col) => hiddenColsSet.has(col));
                  const style = {
                    ...rowStyle,
                    ...cellStyle,
                  } as RowStyle;
                  return (
                    <td
                      key={key}
                      rowSpan={span?.rowSpan}
                      colSpan={span?.colSpan}
                      className="border border-border px-2 py-1 align-top"
                      style={{
                        backgroundColor: style.backgroundColor,
                        color: style.color,
                        fontWeight: style.fontWeight,
                        textAlign: style.textAlign,
                        borderTop: style.borderTop,
                        borderRight: style.borderRight,
                        borderBottom: style.borderBottom,
                        borderLeft: style.borderLeft,
                        verticalAlign: style.verticalAlign,
                        whiteSpace: style.whiteSpace || 'nowrap',
                        fontSize: style.fontSize || '11px',
                        fontFamily: style.fontFamily || '"Times New Roman", serif',
                        minWidth: colWidths[c] ? `${colWidths[c]}px` : '2rem',
                        width: colWidths[c] ? `${colWidths[c]}px` : undefined,
                        lineHeight: 1.25,
                        maxWidth: fullyHidden ? '0px' : undefined,
                        padding: fullyHidden ? '0' : undefined,
                        display: fullyHidden ? 'none' : undefined,
                        overflow: fullyHidden ? 'hidden' : undefined,
                      }}
                    >
                      {cell === null || cell === undefined ? '' : String(cell)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


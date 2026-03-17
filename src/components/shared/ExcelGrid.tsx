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
};

export function ExcelGrid({
  rows,
  merges = [],
  rowStyles = {},
  cellStyles = {},
}: {
  rows: Array<Array<string | number>>;
  merges?: ExcelMerge[];
  /** Row index -> style (nền xanh, chữ trắng, vàng, xanh nhạt...) */
  rowStyles?: Record<number, RowStyle>;
  /** Key "r,c" -> style (chữ đỏ...) */
  cellStyles?: Record<string, RowStyle>;
}) {
  const { startSpanMap, skipSet } = useMemo(() => {
    const startSpanMap = new Map<string, { rowSpan: number; colSpan: number }>();
    const skipSet = new Set<string>();

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

    return { startSpanMap, skipSet };
  }, [merges]);

  if (!rows.length) {
    return (
      <div className="border rounded-lg p-6 text-sm text-muted-foreground">
        Không có dữ liệu để hiển thị.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-auto max-h-[70vh] bg-background">
      <table className="min-w-max border-collapse text-xs border border-border">
        <tbody>
          {rows.map((row, r) => {
            const rowStyle = rowStyles[r] || {};
            return (
              <tr key={r}>
                {row.map((cell, c) => {
                  const key = `${r},${c}`;
                  if (skipSet.has(key)) return null;
                  const span = startSpanMap.get(key);
                  const cellStyle = cellStyles[key] || {};
                  const style = {
                    ...rowStyle,
                    ...cellStyle,
                  } as React.CSSProperties;
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
                        whiteSpace: 'pre-wrap',
                        minWidth: '2rem',
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


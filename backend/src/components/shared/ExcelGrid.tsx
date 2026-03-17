import { useMemo } from 'react';

export type ExcelMerge = {
  s: { r: number; c: number };
  e: { r: number; c: number };
};

export function ExcelGrid({
  rows,
  merges = [],
}: {
  rows: Array<Array<string | number>>;
  merges?: ExcelMerge[];
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
      <table className="min-w-max border-collapse text-xs">
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => {
                const key = `${r},${c}`;
                if (skipSet.has(key)) return null;
                const span = startSpanMap.get(key);
                return (
                  <td
                    key={key}
                    rowSpan={span?.rowSpan}
                    colSpan={span?.colSpan}
                    className="border px-2 py-1 whitespace-nowrap align-top"
                  >
                    {cell === null || cell === undefined ? '' : String(cell)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


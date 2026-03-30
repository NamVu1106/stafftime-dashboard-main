import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function timekeepingRowsWithIds(rows: Record<string, unknown>[], prefix: string) {
  return rows.map((row, i) => ({
    ...row,
    id: String(row.id ?? `${prefix}-${row.employee_code}-${row.date ?? 'd'}-${i}`),
  }));
}

/** Giữ layout ổn định khi refetch (phân trang): overlay spinner, không thu nhỏ vùng bảng. */
export function ReportTableFetchOverlay({
  show,
  children,
}: {
  show: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <div className={cn(show && 'opacity-60 pointer-events-none transition-opacity')}>{children}</div>
      {show && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/55"
          aria-busy="true"
          aria-live="polite"
        >
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

export function ReportServerPaginationBar({
  page,
  limit,
  total,
  onPageChange,
  t,
  isBusy = false,
}: {
  page: number;
  limit: number;
  total: number;
  onPageChange: (p: number) => void;
  t: (k: string) => string;
  /** Đang tải trang mới — tránh double-click và đồng bộ với overlay bảng */
  isBusy?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-1 border-t border-border text-sm">
      <p className="text-muted-foreground tabular-nums">
        {t('common.showing')} {from}–{to} {t('common.of')} {total} {t('common.rows')}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1 || isBusy}
        >
          {t('reports.previous')}
        </Button>
        <span className="text-muted-foreground tabular-nums min-w-[3.5rem] text-center">{page}/{totalPages}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || isBusy}
        >
          {t('reports.next')}
        </Button>
      </div>
    </div>
  );
}

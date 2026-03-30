import type { AttendanceCountProductionSnapshot, AttendanceCountShiftBlock } from '@/lib/hrBuiltInStats';
import { useI18n } from '@/hooks/useI18n';

function ShiftBlockTable({ title, block }: { title: string; block: AttendanceCountShiftBlock }) {
  return (
    <div className="rounded-md border border-border bg-background overflow-x-auto">
      <div className="px-3 py-2 text-sm font-semibold border-b border-border bg-muted/30">{title}</div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="p-2 w-[30%]">Hạng mục</th>
            <th className="p-2 text-right font-medium">Chính thức</th>
            <th className="p-2 text-right font-medium">Thời vụ</th>
            <th className="p-2 text-right font-medium">Người mới</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          <tr className="border-b border-border/60">
            <td className="p-2 font-medium text-foreground">Nhân lực</td>
            <td className="p-2 text-right">{block.headOfficial}</td>
            <td className="p-2 text-right">{block.headSeasonal}</td>
            <td className="p-2 text-right">{block.headNew}</td>
          </tr>
          <tr className="border-b border-border/60">
            <td className="p-2 font-medium text-foreground">Đi làm</td>
            <td className="p-2 text-right">{block.presentOfficial}</td>
            <td className="p-2 text-right">{block.presentSeasonal}</td>
            <td className="p-2 text-right">{block.presentNew}</td>
          </tr>
          <tr className="border-b border-border/60">
            <td className="p-2 font-medium text-foreground">Nghỉ vắng</td>
            <td className="p-2 text-right">{block.absentOfficial}</td>
            <td className="p-2 text-right">{block.absentSeasonal}</td>
            <td className="p-2 text-right text-muted-foreground">—</td>
          </tr>
          <tr>
            <td className="p-2 font-medium text-foreground">Tỉ lệ đi làm (%)</td>
            <td className="p-2 text-right">{block.rateOfficialPct}%</td>
            <td className="p-2 text-right">{block.rateSeasonalPct}%</td>
            <td className="p-2 text-right text-muted-foreground">—</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function AttendanceCountSnapshotPanel({ snapshot }: { snapshot: AttendanceCountProductionSnapshot }) {
  const { t } = useI18n();
  const days = snapshot.aggregationDays ?? 1;
  const rangeLabel =
    snapshot.aggregationStart && snapshot.aggregationEnd
      ? `${snapshot.aggregationStart} → ${snapshot.aggregationEnd}`
      : snapshot.snapshotDate;

  return (
    <div className="space-y-3">
      {days > 1 ? (
        <div
          className="rounded-md border border-amber-500/45 bg-amber-500/12 px-3 py-2 text-xs text-amber-950 dark:text-amber-50 leading-relaxed"
          role="status"
        >
          <p className="font-semibold text-foreground mb-1">{t('hrReport.attendanceCountMultiDayWarningTitle')}</p>
          <p>
            {t('hrReport.attendanceCountMultiDayWarningBody', {
              days: String(days),
              range: rangeLabel,
            })}
          </p>
        </div>
      ) : null}
      <div className="text-xs text-muted-foreground rounded-md border border-border bg-muted/15 px-3 py-2 leading-relaxed">
        <p className="mb-2 text-foreground font-medium">
          Kỳ gộp trong bộ lọc: <span className="font-mono">{rangeLabel}</span> — <span className="font-mono">{days}</span> ngày (không vượt quá
          hôm nay). <span className="underline underline-offset-2">Đi làm / Nghỉ vắng</span> là{' '}
          <span className="font-medium text-foreground">tổng lượt</span> qua các ngày đó;{' '}
          <span className="font-medium text-foreground">Tỉ lệ</span> = đi làm ÷ (nhân lực × số ngày). Hàng{' '}
          <span className="font-medium text-foreground">Nhân lực</span> vẫn là đầu người theo DS tại ngày{' '}
          <span className="font-mono">{snapshot.snapshotDate}</span>.
        </p>
        <span className="font-medium text-foreground">Báo cáo TT sản xuất trực tiếp</span> (cấu trúc như file Excel). Ca{' '}
        <span className="font-medium text-foreground">Main (D)</span> = ca ngày, <span className="font-medium text-foreground">Main (N)</span> = ca
        đêm. Cột <span className="font-medium text-foreground">Người mới</span> chỉ thống kê; đi làm CT/TV đã gộp NV mới.
        {snapshot.note ? (
          <span className="block mt-2 text-amber-800 dark:text-amber-300">{snapshot.note}</span>
        ) : null}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <ShiftBlockTable title="Ca ngày (Main D)" block={snapshot.day} />
        <ShiftBlockTable title="Ca đêm (Main N)" block={snapshot.night} />
      </div>
      <p className="text-[11px] text-muted-foreground px-1">
        Gợi ý đọc số: cùng một người đi làm 3 ngày được tính 3 lượt ở «Đi làm»; «Nghỉ» = (nhân lực × số ngày) − «Đi làm».
      </p>
    </div>
  );
}

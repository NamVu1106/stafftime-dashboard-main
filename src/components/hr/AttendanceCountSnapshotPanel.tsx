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
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {t('hrReport.attendanceCountTableCaption', {
          range: rangeLabel,
          days: String(days),
          anchor: snapshot.snapshotDate,
        })}
        {days > 1 ? <> {t('hrReport.attendanceCountMultiDayHintShort')}</> : null}
      </p>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <ShiftBlockTable title="Ca ngày (Main D)" block={snapshot.day} />
        <ShiftBlockTable title="Ca đêm (Main N)" block={snapshot.night} />
      </div>
    </div>
  );
}

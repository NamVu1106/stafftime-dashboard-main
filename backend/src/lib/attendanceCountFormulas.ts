/**
 * Công thức báo cáo «Số lượng đi làm» TT SX (kỳ nhiều ngày):
 * - Đi làm / Nghỉ = tổng lượt qua các ngày trong kỳ; mẫu = nhân lực × số ngày
 * - Nhân lực (một đầu người / ngày) × số ngày = Đi làm + Nghỉ
 * - Tỉ lệ (%) = Đi làm / (Nhân lực × số ngày) × 100
 */

export type AttendanceCountShiftBlockLike = {
  headOfficial: number;
  headSeasonal: number;
  headNew: number;
  presentOfficial: number;
  presentSeasonal: number;
  presentNew: number;
  absentOfficial: number;
  absentSeasonal: number;
  rateOfficialPct: number;
  rateSeasonalPct: number;
};

function rateMatches(expected: number, displayed: number, eps = 0.11): boolean {
  return Math.abs(expected - displayed) <= eps;
}

export function validateAttendanceShiftBlock(
  block: AttendanceCountShiftBlockLike,
  label: string,
  aggregationDays = 1
): string[] {
  const n = aggregationDays >= 1 ? aggregationDays : 1;
  const capO = block.headOfficial * n;
  const capS = block.headSeasonal * n;
  const err: string[] = [];
  if (capO !== block.presentOfficial + block.absentOfficial) {
    err.push(
      `${label}: CT — nhân lực×ngày (${capO}) ≠ đi làm (${block.presentOfficial}) + nghỉ (${block.absentOfficial})`
    );
  }
  if (capS !== block.presentSeasonal + block.absentSeasonal) {
    err.push(
      `${label}: TV — nhân lực×ngày (${capS}) ≠ đi làm (${block.presentSeasonal}) + nghỉ (${block.absentSeasonal})`
    );
  }
  const ro = capO > 0 ? Math.round((block.presentOfficial / capO) * 1000) / 10 : 0;
  const rs = capS > 0 ? Math.round((block.presentSeasonal / capS) * 1000) / 10 : 0;
  if (capO > 0 && !rateMatches(ro, block.rateOfficialPct)) {
    err.push(`${label}: CT — tỉ lệ hiển thị ${block.rateOfficialPct}% ≠ ${ro}% (đi làm / nhân lực×ngày)`);
  }
  if (capS > 0 && !rateMatches(rs, block.rateSeasonalPct)) {
    err.push(`${label}: TV — tỉ lệ hiển thị ${block.rateSeasonalPct}% ≠ ${rs}% (đi làm / nhân lực×ngày)`);
  }
  if (block.presentNew > block.presentOfficial + block.presentSeasonal) {
    err.push(
      `${label}: Đi làm «Người mới» (${block.presentNew}) > tổng đi làm CT+TV (${block.presentOfficial + block.presentSeasonal})`
    );
  }
  if (block.headNew > block.headOfficial + block.headSeasonal) {
    err.push(
      `${label}: Nhân lực «Người mới» (${block.headNew}) > tổng nhân lực CT+TV (${block.headOfficial + block.headSeasonal})`
    );
  }
  return err;
}

export function validateAttendanceProductionSnapshot(snap: {
  day: AttendanceCountShiftBlockLike;
  night: AttendanceCountShiftBlockLike;
  snapshotDate?: string;
  aggregationDays?: number;
}): { ok: boolean; errors: string[] } {
  const n =
    snap.aggregationDays !== undefined && snap.aggregationDays >= 1 ? snap.aggregationDays : 1;
  const errors = [
    ...validateAttendanceShiftBlock(snap.day, 'Ca ngày', n),
    ...validateAttendanceShiftBlock(snap.night, 'Ca đêm', n),
  ];
  return { ok: errors.length === 0, errors };
}

export function formatAuditReportText(snap: {
  snapshotDate: string;
  aggregationStart?: string;
  aggregationEnd?: string;
  aggregationDays?: number;
  monthYm?: string;
  note?: string;
  day: AttendanceCountShiftBlockLike;
  night: AttendanceCountShiftBlockLike;
}): string {
  const v = validateAttendanceProductionSnapshot(snap);
  const range =
    snap.aggregationStart && snap.aggregationEnd
      ? `${snap.aggregationStart} → ${snap.aggregationEnd} (${snap.aggregationDays ?? '?'} ngày)`
      : snap.snapshotDate;
  const lines: string[] = [
    `=== Attendance snapshot audit ===`,
    `Kỳ gộp: ${range}`,
    v.ok ? 'Công thức khối ca: OK' : 'Công thức khối ca: LỖI',
    ...v.errors.map((e) => `  - ${e}`),
    ``,
    `Tổng đi làm (CT+TV, cả hai ca): ${
      snap.day.presentOfficial +
      snap.day.presentSeasonal +
      snap.night.presentOfficial +
      snap.night.presentSeasonal
    }`,
    `NV mới đi làm (thống kê): ${snap.day.presentNew + snap.night.presentNew}`,
  ];
  if (snap.note) lines.push('', `Ghi chú API: ${snap.note}`);
  return lines.join('\n');
}

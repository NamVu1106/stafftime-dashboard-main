import { describe, expect, it } from 'vitest';
import { validateAttendanceProductionSnapshot, validateAttendanceShiftBlock } from './attendanceCountFormulas';

const okBlock = {
  headOfficial: 100,
  headSeasonal: 50,
  headNew: 5,
  presentOfficial: 92,
  presentSeasonal: 40,
  presentNew: 3,
  absentOfficial: 8,
  absentSeasonal: 10,
  rateOfficialPct: 92,
  rateSeasonalPct: 80,
};

describe('attendanceCountFormulas', () => {
  it('passes when nhân lực = đi làm + nghỉ and rates match', () => {
    expect(validateAttendanceShiftBlock(okBlock, 'Test')).toEqual([]);
    expect(validateAttendanceProductionSnapshot({ day: okBlock, night: okBlock }).ok).toBe(true);
  });

  it('fails when headcount identity breaks', () => {
    const bad = { ...okBlock, absentOfficial: 7 };
    expect(validateAttendanceShiftBlock(bad, 'X').length).toBeGreaterThan(0);
  });

  it('fails when rate display mismatches computed', () => {
    const bad = { ...okBlock, rateOfficialPct: 50 };
    expect(validateAttendanceShiftBlock(bad, 'X').some((e) => e.includes('tỉ lệ'))).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { hrMenuRoute, HR_REPORT_INLINE_IDS, hrMenu } from './departmentMenu';

describe('departmentMenu', () => {
  it('has Báo cáo tổng hợp route before dynamic /hr/:reportType', () => {
    expect(hrMenuRoute['hr-summary']).toBe('/hr/summary');
  });

  it('hr-summary is not inline (navigates to full page)', () => {
    expect(HR_REPORT_INLINE_IDS.has('hr-summary')).toBe(false);
  });

  it('every HR menu id that is not "all" has a route or is inline report', () => {
    const inlineOrRouted = new Set<string>([
      ...HR_REPORT_INLINE_IDS,
      ...Object.keys(hrMenuRoute),
      'all',
    ]);
    for (const item of hrMenu) {
      if (item.id === 'all') continue;
      expect(
        inlineOrRouted.has(item.id),
        `Menu id "${item.id}" missing route or HR_REPORT_INLINE_IDS`
      ).toBe(true);
    }
  });
});

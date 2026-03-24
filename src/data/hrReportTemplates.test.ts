import { describe, it, expect } from 'vitest';
import { hasBuiltInGrid, getTemplateByReportType, HR_REPORT_TEMPLATE_MAP } from './hrReportTemplates';

describe('hrReportTemplates', () => {
  it('attendance-rate has built-in grid', () => {
    expect(hasBuiltInGrid('attendance-rate')).toBe(true);
  });

  it('insurance reports stay upload-only', () => {
    expect(hasBuiltInGrid('bhxh-list')).toBe(false);
    expect(hasBuiltInGrid('insurance-master')).toBe(false);
  });

  it('unknown report has no built-in grid', () => {
    expect(hasBuiltInGrid('nonexistent-report-xyz')).toBe(false);
  });

  it('each map entry has matching reportType', () => {
    for (const m of HR_REPORT_TEMPLATE_MAP) {
      expect(getTemplateByReportType(m.reportType)?.reportType).toBe(m.reportType);
    }
  });
});

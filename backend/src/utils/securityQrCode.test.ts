import { describe, it, expect } from 'vitest';
import { generateQrCode } from './securityQrCode';

describe('generateQrCode', () => {
  it('prefixes with YS and department code', () => {
    const qr = generateQrCode('AN');
    expect(qr.startsWith('YS-AN-')).toBe(true);
    expect(qr.length).toBeGreaterThan(8);
  });

  it('sanitizes department code', () => {
    const qr = generateQrCode('PC/CN');
    expect(qr.startsWith('YS-PCCN-')).toBe(true);
  });
});

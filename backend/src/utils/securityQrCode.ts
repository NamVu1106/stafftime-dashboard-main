import crypto from 'crypto';

/** Mã QR theo quy tắc Yousung: YS-{MÃ_BP}-{SUFFIX} */
export function generateQrCode(deptCode: string): string {
  const code = deptCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'XX';
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `YS-${code}-${suffix}`;
}

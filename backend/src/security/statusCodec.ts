/** Mã trạng thái trên CSDL (KetQuaKiemTra.trang_thai) */
export type DbCheckStatus = 'OK' | 'NOT_OK' | 'NA';

/** Payload tablet / API (tương thích cũ) */
export type ApiCheckStatus = 'pass' | 'fail' | 'skip' | 'OK' | 'NOT_OK' | 'NA';

export function toDbStatus(status: string): DbCheckStatus {
  const s = status.toLowerCase().replace('-', '_');
  if (s === 'pass' || s === 'ok') return 'OK';
  if (s === 'fail' || s === 'not_ok') return 'NOT_OK';
  if (s === 'skip' || s === 'na') return 'NA';
  return 'OK';
}

export function fromDbStatus(status: string): 'pass' | 'fail' | 'skip' {
  if (status === 'NOT_OK') return 'fail';
  if (status === 'NA') return 'skip';
  return 'pass';
}

export function phienTrangThaiGui(): string {
  return 'da_gui';
}

export function phienTrangThaiNhap(): string {
  return 'nhap';
}

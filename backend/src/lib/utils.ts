import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format số có dấu chấm ngăn cách hàng nghìn (17.463, 127.347), phẩy cho thập phân */
export function formatNumberPlain(value: any): string {
  if (value === null || value === undefined) return '—';
  let n: number;
  if (typeof value === 'string') {
    const s = String(value).trim();
    if (/^\d{1,3}(\.\d{3})*(,\d*)?$/.test(s) || /^\d+\.\d{3}$/.test(s)) {
      n = parseFloat(s.replace(/\./g, '').replace(',', '.') || '0');
    } else {
      n = Number(value);
    }
  } else {
    n = Number(value);
  }
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? rounded.toLocaleString('vi-VN') : rounded.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

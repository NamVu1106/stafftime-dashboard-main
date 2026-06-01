const API_URL = import.meta.env.VITE_API_URL || '/api';

/** URL ảnh minh chứng (path /uploads/...) */
export function photoUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  const base = API_URL.replace(/\/api\/?$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

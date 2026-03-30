/** Thông báo từ API — dùng để suy ra route điều hướng */
export type NotificationNavLike = {
  type: string;
  metadata?: { link?: string; url?: string; path?: string } | null;
};

export type NotificationNavTarget = { href: string; external: boolean };

/**
 * Ưu tiên metadata.link | url | path; không có thì map theo type.
 * Trả null nếu không có đích (chỉ đánh dấu đã đọc khi bấm).
 */
export function resolveNotificationPath(notification: NotificationNavLike): NotificationNavTarget | null {
  const meta = notification.metadata;
  if (meta && typeof meta === 'object') {
    const raw = meta.link ?? meta.url ?? meta.path;
    if (typeof raw === 'string' && raw.trim()) {
      const s = raw.trim();
      if (/^https?:\/\//i.test(s)) return { href: s, external: true };
      return { href: s.startsWith('/') ? s : `/${s}`, external: false };
    }
  }
  switch (notification.type) {
    case 'upload_success':
      return { href: '/upload', external: false };
    case 'late_employees':
      return { href: '/reports/period?mode=day', external: false };
    case 'new_employees':
      return { href: '/employees', external: false };
    default:
      return null;
  }
}

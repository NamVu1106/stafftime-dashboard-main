import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SEC_PHOTOS_DIR = path.join(process.cwd(), 'uploads', 'security-inspection');

/** Lưu ảnh ra disk; SQL chỉ giữ URL. Hỗ trợ data URL hoặc URL đã lưu. */
export function persistInspectionPhoto(input?: string | null): string | null {
  if (!input || !String(input).trim()) return null;
  const s = String(input).trim();
  if (s.startsWith('/uploads/security-inspection/')) return s;
  if (s.startsWith('/uploads/')) return s;

  const match = s.match(/^data:image\/([\w+.-]+);base64,(.+)$/);
  if (!match) return null;

  let ext = match[1].toLowerCase();
  if (ext === 'jpeg') ext = 'jpg';
  if (!['jpg', 'png', 'webp', 'gif'].includes(ext)) ext = 'jpg';

  const buf = Buffer.from(match[2], 'base64');
  if (buf.length < 8) return null;

  if (!fs.existsSync(SEC_PHOTOS_DIR)) {
    fs.mkdirSync(SEC_PHOTOS_DIR, { recursive: true });
  }
  const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(SEC_PHOTOS_DIR, name), buf);
  return `/uploads/security-inspection/${name}`;
}

export type PhotoWatermarkMeta = {
  qrCode?: string;
  assetName?: string;
  lat?: number;
  lng?: number;
};

/** Nén JPEG + watermark timestamp/GPS (chống dùng ảnh cũ) */
export async function compressImageFile(
  file: File,
  maxWidth = 1280,
  quality = 0.72,
  meta?: PhotoWatermarkMeta
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const ts = new Date().toLocaleString('vi-VN');
  const lines = [ts];
  if (meta?.qrCode) lines.push(meta.qrCode);
  if (meta?.assetName) lines.push(meta.assetName.slice(0, 40));
  if (meta?.lat != null && meta?.lng != null) {
    lines.push(`GPS ${meta.lat.toFixed(5)}, ${meta.lng.toFixed(5)}`);
  }

  const pad = 8;
  const lineH = 16;
  const boxH = lines.length * lineH + pad * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, h - boxH, w, boxH);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, pad, h - boxH + pad + (i + 1) * lineH - 4);
  });

  return canvas.toDataURL('image/jpeg', quality);
}

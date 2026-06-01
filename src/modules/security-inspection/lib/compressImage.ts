export type PhotoWatermarkMeta = {
  qrCode?: string;
  assetName?: string;
  lat?: number;
  lng?: number;
};

/** Tối thiểu ~50KB — lọc ảnh đen/mờ sau nén */
export const MIN_EVIDENCE_PHOTO_BYTES = 50 * 1024;

export function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  return Math.floor((base64.length * 3) / 4);
}

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

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  if (estimateDataUrlBytes(dataUrl) < MIN_EVIDENCE_PHOTO_BYTES) {
    const err = new Error('PHOTO_TOO_SMALL');
    (err as Error & { code: string }).code = 'PHOTO_TOO_SMALL';
    throw err;
  }
  return dataUrl;
}

/** Chụp một khung từ camera sau (environment) */
export async function captureFromEnvironmentCamera(
  maxWidth = 1280,
  quality = 0.72,
  meta?: PhotoWatermarkMeta
): Promise<string> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('CAMERA_UNAVAILABLE');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
    audio: false,
  });
  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.playsInline = true;
    await video.play();
    await new Promise((r) => setTimeout(r, 400));
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const w = Math.max(1, Math.round(video.videoWidth * scale));
    const h = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.drawImage(video, 0, 0, w, h);
    video.pause();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    if (!blob) throw new Error('Capture failed');
    const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
    return compressImageFile(file, maxWidth, quality, meta);
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

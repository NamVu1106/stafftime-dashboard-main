import { useEffect, useRef } from 'react';
import { useI18n } from '@/hooks/useI18n';

export function SignaturePad({
  value,
  onChange,
}: {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
}) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(2, 2);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value;
    }
  }, [value]);

  const pos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.PointerEvent) => {
    drawing.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    const p = pos(e);
    ctx?.beginPath();
    ctx?.moveTo(p.x, p.y);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    const p = pos(e);
    ctx?.lineTo(p.x, p.y);
    ctx?.stroke();
  };

  const end = () => {
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const r = canvas.getBoundingClientRect();
    ctx?.clearRect(0, 0, r.width, r.height);
    onChange(undefined);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-slate-800">{t('securityInspection.signature')}</p>
      <canvas
        ref={canvasRef}
        className="h-36 w-full touch-none rounded-xl border-2 border-slate-300 bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <button
        type="button"
        className="sec-touch-btn min-h-12 rounded-xl border-2 border-slate-300 px-4 font-semibold"
        onClick={clear}
      >
        {t('securityInspection.signatureClear')}
      </button>
    </div>
  );
}

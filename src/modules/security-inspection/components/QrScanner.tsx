import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useI18n } from '@/hooks/useI18n';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const SCANNER_ID = 'ys-security-qr-reader';

/** Quét QR/Barcode — html5-qrcode (Chrome/Android tablet) + nhập tay */
export function QrScanner({ onScan }: { onScan: (code: string) => void }) {
  const { t } = useI18n();
  const [manual, setManual] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (!cameraOn) return;
    handledRef.current = false;
    const scanner = new Html5Qrcode(SCANNER_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 280, height: 280 }, aspectRatio: 1 },
        (decoded) => {
          if (handledRef.current) return;
          handledRef.current = true;
          const code = decoded.trim();
          scanner
            .stop()
            .then(() => scanner.clear())
            .finally(() => {
              scannerRef.current = null;
              setCameraOn(false);
              onScan(code);
            });
        },
        () => undefined
      )
      .catch(() => {
        setError(t('securityInspection.cameraError'));
        setCameraOn(false);
      });

    return () => {
      const s = scannerRef.current;
      if (s?.isScanning) {
        s.stop().catch(() => undefined);
      }
      scannerRef.current = null;
    };
  }, [cameraOn, onScan, t]);

  return (
    <div className="space-y-4">
      <p className="text-center text-sm font-medium text-slate-600">{t('securityInspection.scanHint')}</p>
      <div
        id={SCANNER_ID}
        className={
          cameraOn
            ? 'overflow-hidden rounded-2xl border-2 border-slate-300 bg-black [&_video]:rounded-2xl'
            : 'hidden'
        }
      />
      {!cameraOn && (
        <Button
          type="button"
          className="sec-touch-btn min-h-12 w-full text-base font-bold"
          onClick={() => {
            setError('');
            setCameraOn(true);
          }}
        >
          {t('securityInspection.startScan')}
        </Button>
      )}
      {error && <p className="text-center text-sm font-semibold text-red-600">{error}</p>}
      <div className="space-y-2">
        <label className="text-sm font-bold">{t('securityInspection.scanManual')}</label>
        <Input
          value={manual}
          onChange={(e) => setManual(e.target.value.toUpperCase())}
          className="min-h-12 text-lg font-semibold"
          placeholder="YS-AN-CAM-01"
        />
        <Button
          type="button"
          className="sec-touch-btn min-h-12 w-full text-base font-bold"
          disabled={!manual.trim()}
          onClick={() => onScan(manual.trim())}
        >
          {t('securityInspection.scanConfirm')}
        </Button>
      </div>
    </div>
  );
}

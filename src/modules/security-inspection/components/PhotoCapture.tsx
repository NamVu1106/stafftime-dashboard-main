import { useRef, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/useI18n';
import {
  captureFromEnvironmentCamera,
  compressImageFile,
  type PhotoWatermarkMeta,
} from '../lib/compressImage';

export function PhotoCapture({
  value,
  onChange,
  required,
  watermarkMeta,
}: {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  required?: boolean;
  watermarkMeta?: PhotoWatermarkMeta;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [capturing, setCapturing] = useState(false);

  const withGps = async (): Promise<PhotoWatermarkMeta> => {
    let meta = { ...watermarkMeta };
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 4000,
          maximumAge: 60_000,
        });
      });
      meta = { ...meta, lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      /* GPS optional */
    }
    return meta;
  };

  const applyPhoto = async (data: string) => {
    onChange(data);
  };

  const handlePhotoError = (e: unknown) => {
    const code = (e as Error & { code?: string }).code ?? (e as Error).message;
    if (code === 'PHOTO_TOO_SMALL') {
      toast.error(t('securityInspection.photoTooSmall'));
      return;
    }
    toast.error((e as Error).message || t('securityInspection.cameraError'));
  };

  const captureWithMeta = async (file: File) => {
    try {
      const meta = await withGps();
      const data = await compressImageFile(file, 1280, 0.72, meta);
      await applyPhoto(data);
    } catch (e) {
      handlePhotoError(e);
    }
  };

  const openEnvironmentCamera = async () => {
    setCapturing(true);
    try {
      const meta = await withGps();
      const data = await captureFromEnvironmentCamera(1280, 0.72, meta);
      await applyPhoto(data);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'CAMERA_UNAVAILABLE' || msg.includes('Permission')) {
        if (inputRef.current) {
          inputRef.current.setAttribute('capture', 'environment');
          inputRef.current.click();
        }
      } else {
        handlePhotoError(e);
      }
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border-2 border-red-200 bg-red-50/80 p-3">
      <p className="text-sm font-bold text-red-800">
        {t('securityInspection.photoProof')}
        {required ? ' *' : ''}
      </p>
      <p className="text-xs text-red-700">{t('securityInspection.photoQualityHint')}</p>
      {value ? (
        <div className="relative">
          <img src={value} alt="" className="max-h-40 w-full rounded-lg object-cover" />
          <button
            type="button"
            className="sec-touch-btn absolute right-2 top-2 rounded-full bg-black/60 p-2 text-white"
            onClick={() => onChange(undefined)}
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={capturing}
            className="sec-touch-btn flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 font-semibold text-white disabled:opacity-60"
            onClick={openEnvironmentCamera}
          >
            <Camera className="h-5 w-5" />
            {capturing ? '...' : t('securityInspection.openCamera')}
          </button>
          <button
            type="button"
            className="sec-touch-btn flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-red-300 bg-white font-semibold text-red-800"
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.removeAttribute('capture');
                inputRef.current.click();
              }
            }}
          >
            <ImagePlus className="h-5 w-5" />
            {t('securityInspection.useGallery')}
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) captureWithMeta(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

import { useRef } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { compressImageFile } from '../lib/compressImage';

export function PhotoCapture({
  value,
  onChange,
  required,
}: {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  required?: boolean;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const data = await compressImageFile(file);
    onChange(data);
  };

  return (
    <div className="space-y-2 rounded-xl border-2 border-red-200 bg-red-50/80 p-3">
      <p className="text-sm font-bold text-red-800">
        {t('securityInspection.photoProof')}
        {required ? ' *' : ''}
      </p>
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
            className="sec-touch-btn flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 font-semibold text-white"
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.accept = 'image/*';
                inputRef.current.capture = 'environment';
                inputRef.current.click();
              }
            }}
          >
            <Camera className="h-5 w-5" />
            {t('securityInspection.openCamera')}
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
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </div>
  );
}

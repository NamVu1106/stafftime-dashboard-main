import { AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/hooks/useI18n';
import { PhotoCapture } from './PhotoCapture';
import type { ChecklistItemDef, ItemResult } from '../types';
import {
  evaluateNumericStatus,
  formatThresholdHint,
  isWithinThreshold,
} from '../utils/numberThreshold';

export function NumberThresholdInput({
  item,
  result,
  onChange,
  photoMeta,
  readOnly,
}: {
  item: ChecklistItemDef;
  result?: ItemResult;
  onChange: (patch: Partial<ItemResult> & { itemId: number }) => void;
  photoMeta?: { qrCode: string; assetName: string };
  readOnly?: boolean;
}) {
  const { t } = useI18n();
  const value = result?.numericValue;
  const status = result?.status ?? 'unset';
  const outOfRange =
    value !== undefined &&
    !Number.isNaN(value) &&
    !isWithinThreshold(value, item.minValue, item.maxValue);
  const showFail = status === 'fail';
  const needPhoto = showFail && item.requiresPhotoOnFail && !result?.photoData;

  const applyValue = (raw: string) => {
    if (readOnly) return;
    const trimmed = raw.trim();
    if (trimmed === '') {
      onChange({
        itemId: item.id,
        status: 'unset',
        numericValue: undefined,
        note: undefined,
        photoData: undefined,
      });
      return;
    }
    const num = Number(trimmed);
    if (Number.isNaN(num)) return;
    const nextStatus = evaluateNumericStatus(num, item.minValue, item.maxValue);
    const unit = item.unit ? ` ${item.unit}` : '';
    onChange({
      itemId: item.id,
      numericValue: num,
      status: nextStatus,
      note: `${num}${unit}`,
      ...(nextStatus === 'pass' ? { photoData: undefined } : {}),
    });
  };

  if (readOnly) {
    return (
      <p className="text-sm font-medium text-slate-600">
        {value != null ? `${value}${item.unit ? ` ${item.unit}` : ''}` : '—'}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-600">
        {t('securityInspection.thresholdHint')}: {formatThresholdHint(item) || '—'}
      </p>
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          step="any"
          className={`min-h-14 text-center text-2xl font-bold tabular-nums ${
            outOfRange
              ? 'border-4 border-red-600 bg-red-50 text-red-900 focus-visible:ring-red-500'
              : value !== undefined
                ? 'border-2 border-emerald-600 bg-emerald-50'
                : 'border-2 border-slate-300'
          }`}
          placeholder={t('securityInspection.numericPlaceholder')}
          value={value !== undefined ? String(value) : ''}
          onChange={(e) => applyValue(e.target.value)}
        />
        {outOfRange && (
          <AlertTriangle
            className="absolute right-3 top-1/2 h-8 w-8 -translate-y-1/2 text-red-600"
            aria-hidden
          />
        )}
      </div>
      {outOfRange && (
        <p className="animate-pulse text-base font-bold text-red-600">
          {t('securityInspection.thresholdExceeded')}
        </p>
      )}
      {showFail && (
        <>
          <Input
            className="min-h-12 text-base"
            placeholder={t('securityInspection.notePlaceholder')}
            value={result?.note ?? ''}
            onChange={(e) => onChange({ itemId: item.id, note: e.target.value })}
          />
          <PhotoCapture
            required={item.requiresPhotoOnFail}
            value={result?.photoData}
            watermarkMeta={photoMeta}
            onChange={(photoData) => onChange({ itemId: item.id, photoData })}
          />
          {needPhoto && (
            <p className="text-sm font-bold text-red-600">
              {t('securityInspection.photoRequiredBlock')}
            </p>
          )}
        </>
      )}
    </div>
  );
}

import { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { PassFailButtons } from './PassFailButtons';
import { PhotoCapture } from './PhotoCapture';
import { NumberThresholdInput } from './NumberThresholdInput';
import type { ChecklistCategory, ItemResult, InspectionItemStatus } from '../types';
import { isNumberItem } from '../utils/numberThreshold';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/hooks/useI18n';
import { toast } from 'sonner';

export function ChecklistAccordion({
  categories,
  results,
  onChange,
  photoMeta,
  readOnly = false,
}: {
  categories: ChecklistCategory[];
  results: ItemResult[];
  onChange: (itemId: number, patch: Partial<ItemResult>) => void;
  photoMeta?: { qrCode: string; assetName: string };
  readOnly?: boolean;
}) {
  const { t } = useI18n();
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);

  const get = (itemId: number) => results.find((r) => r.itemId === itemId);

  const allItems = categories.flatMap((c) => c.items);

  const applyMarkAllPass = () => {
    for (const item of allItems) {
      if (isNumberItem(item)) continue;
      const id = item.id;
      const cur = get(id);
      if (cur?.status === 'fail' && cur.photoData) continue;
      onChange(id, { itemId: id, status: 'pass', note: undefined, photoData: undefined });
    }
    setConfirmAllOpen(false);
    toast.success(t('securityInspection.markAllPassDone'));
  };

  const handleStatusChange = (itemId: number, v: InspectionItemStatus, requiresPhoto: boolean) => {
    const cur = get(itemId);
    if (cur?.status === 'fail' && requiresPhoto && !cur.photoData && v !== 'fail') {
      toast.error(t('securityInspection.photoBeforeContinue'));
      return;
    }
    onChange(itemId, {
      itemId,
      status: v,
      ...(v !== 'fail' ? { note: undefined, photoData: undefined } : {}),
    });
  };

  return (
    <div className="space-y-3">
      {!readOnly && (
        <AlertDialog open={confirmAllOpen} onOpenChange={setConfirmAllOpen}>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="sec-touch-btn min-h-12 w-full border-2 border-emerald-600 text-base font-bold text-emerald-800"
            >
              {t('securityInspection.markAllPass')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('securityInspection.markAllPassConfirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('securityInspection.markAllPassConfirmDesc')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="min-h-11">{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction className="min-h-11 bg-emerald-600" onClick={applyMarkAllPass}>
                {t('common.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <Accordion
        type="multiple"
        className="w-full space-y-2"
        defaultValue={categories.map((c) => String(c.id))}
      >
        {categories.map((cat) => (
          <AccordionItem
            key={cat.id}
            value={String(cat.id)}
            className="rounded-xl border-2 border-slate-200 bg-white px-2"
          >
            <AccordionTrigger className="min-h-12 px-3 text-left text-lg font-bold hover:no-underline">
              {cat.name}
            </AccordionTrigger>
            <AccordionContent className="space-y-4 px-3 pb-4">
              {cat.items.map((item) => {
                const r = get(item.id);
                const status = r?.status ?? 'unset';
                const showFail = status === 'fail';
                const needPhoto = showFail && item.requiresPhotoOnFail && !r?.photoData;

                return (
                  <div
                    key={item.id}
                    className="space-y-3 border-t border-slate-100 pt-3 first:border-0 first:pt-0"
                  >
                    <p className="font-semibold text-slate-900">
                      {item.label}
                      {isNumberItem(item) && item.unit ? (
                        <span className="ml-1 text-sm font-normal text-slate-500">({item.unit})</span>
                      ) : null}
                    </p>
                    {!readOnly ? (
                      <>
                        {isNumberItem(item) ? (
                          <NumberThresholdInput
                            item={item}
                            result={r}
                            photoMeta={photoMeta}
                            onChange={(patch) => onChange(item.id, patch)}
                          />
                        ) : (
                          <PassFailButtons
                            value={status}
                            onChange={(v) =>
                              handleStatusChange(item.id, v, item.requiresPhotoOnFail)
                            }
                          />
                        )}
                        {!isNumberItem(item) && showFail && (
                          <>
                            <Input
                              className="min-h-12 text-base"
                              placeholder={t('securityInspection.notePlaceholder')}
                              value={r?.note ?? ''}
                              onChange={(e) => onChange(item.id, { note: e.target.value })}
                            />
                            <PhotoCapture
                              required={item.requiresPhotoOnFail}
                              value={r?.photoData}
                              watermarkMeta={photoMeta}
                              onChange={(photoData) => onChange(item.id, { photoData })}
                            />
                            {needPhoto && (
                              <p className="text-sm font-bold text-red-600">
                                {t('securityInspection.photoRequiredBlock')}
                              </p>
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      <p className="text-sm font-medium text-slate-500">
                        {t('securityInspection.viewOnly')}
                      </p>
                    )}
                  </div>
                );
              })}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

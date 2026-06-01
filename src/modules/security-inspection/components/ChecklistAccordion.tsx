import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { PassFailButtons } from './PassFailButtons';
import { PhotoCapture } from './PhotoCapture';
import type { ChecklistCategory, ItemResult } from '../types';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/hooks/useI18n';

export function ChecklistAccordion({
  categories,
  results,
  onChange,
}: {
  categories: ChecklistCategory[];
  results: ItemResult[];
  onChange: (itemId: number, patch: Partial<ItemResult>) => void;
}) {
  const { t } = useI18n();

  const get = (itemId: number) => results.find((r) => r.itemId === itemId);

  return (
    <Accordion type="multiple" className="w-full space-y-2" defaultValue={categories.map((c) => String(c.id))}>
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
              return (
                <div key={item.id} className="space-y-3 border-t border-slate-100 pt-3 first:border-0 first:pt-0">
                  <p className="font-semibold text-slate-900">{item.label}</p>
                  <PassFailButtons
                    value={status}
                    onChange={(v) => onChange(item.id, { itemId: item.id, status: v })}
                  />
                  {showFail && (
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
                        onChange={(photoData) => onChange(item.id, { photoData })}
                      />
                      {item.requiresPhotoOnFail && !r?.photoData && (
                        <p className="text-xs font-semibold text-red-600">
                          {t('securityInspection.photoRequired')}
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

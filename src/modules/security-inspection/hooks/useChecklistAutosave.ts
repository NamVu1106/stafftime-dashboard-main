import { useEffect, useRef } from 'react';
import { saveDraft } from '../offline/idb';
import type { InspectionDraft, ItemResult } from '../types';

/** Tự lưu IndexedDB sau mỗi thay đổi (offline-first) */
export function useChecklistAutosave(
  draft: Omit<InspectionDraft, 'updatedAt'> | null,
  enabled: boolean
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !draft) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveDraft({ ...draft, updatedAt: new Date().toISOString() }).catch(() => undefined);
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draft, enabled]);
}

export function mergeResults(
  base: ItemResult[],
  patch: Partial<ItemResult> & { itemId: number }
): ItemResult[] {
  const idx = base.findIndex((r) => r.itemId === patch.itemId);
  if (idx < 0) return [...base, { itemId: patch.itemId, status: 'unset', ...patch }];
  const next = [...base];
  next[idx] = { ...next[idx], ...patch };
  return next;
}

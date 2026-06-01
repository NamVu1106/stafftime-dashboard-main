import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/useI18n';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChecklistAccordion } from '../components/ChecklistAccordion';
import { ChecksheetWorkflowStepper } from '../components/ChecksheetWorkflowStepper';
import { SecurityFooter } from '../components/SecurityFooter';
import { SignaturePad } from '../components/SignaturePad';
import { SyncGateBanner } from '../components/SyncGateBanner';
import { securityInspectionAPI } from '../api';
import { getCachedTemplate, getDraftByAsset, saveDraft, enqueueSync, listSyncQueue } from '../offline/idb';
import { useSecuritySync } from '../hooks/useSecuritySync';
import { useChecklistAutosave } from '../hooks/useChecklistAutosave';
import type {
  DepartmentTemplate,
  ItemResult,
  InspectionItemStatus,
  LastInspectionSummary,
  ChecklistItemDef,
} from '../types';
import { isNumberItem } from '../utils/numberThreshold';
import { Loader2, History, PauseCircle } from 'lucide-react';

type LocState = {
  departmentId: number;
  assetId: number;
  assetName: string;
  qrCode: string;
  lastInspection?: LastInspectionSummary | null;
};

function buildInitialResults(template: DepartmentTemplate): ItemResult[] {
  const rows: ItemResult[] = [];
  for (const c of template.categories) {
    for (const i of c.items) {
      rows.push({ itemId: i.id, status: 'unset' as InspectionItemStatus });
    }
  }
  return rows;
}

export default function SecurityChecklistPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { online, pending, syncing, syncNow, refreshPending } = useSecuritySync();
  const state = location.state as LocState | null;

  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [shiftLabel, setShiftLabel] = useState('');
  const [results, setResults] = useState<ItemResult[]>([]);
  const [signature, setSignature] = useState<string>();
  const [paused, setPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [pauseOpen, setPauseOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!state) navigate('/security', { replace: true });
  }, [state, navigate]);

  const deptId = state?.departmentId ?? 0;

  const { data: template, isLoading } = useQuery({
    queryKey: ['security-template', deptId],
    queryFn: async () => {
      try {
        if (online) {
          return await securityInspectionAPI.getTemplate(deptId);
        }
      } catch {
        /* offline */
      }
      const cached = await getCachedTemplate(deptId);
      if (cached) return cached;
      throw new Error('No template');
    },
    enabled: deptId > 0,
  });

  useEffect(() => {
    if (!template || !state || restored) return;
    (async () => {
      const existing = await getDraftByAsset(state.assetId, state.qrCode);
      if (existing?.results?.length) {
        setClientId(existing.clientId);
        setShiftLabel(existing.shiftLabel);
        setResults(existing.results);
        setSignature(existing.signatureData);
        setPaused(!!existing.paused);
        setPauseReason(existing.pauseReason ?? '');
        toast.info(t('securityInspection.draftRestored'));
      } else {
        setResults(buildInitialResults(template));
      }
      setRestored(true);
    })();
  }, [template, state, restored, t]);

  const autosavePayload = useMemo(() => {
    if (!state || !restored) return null;
    return {
      clientId,
      departmentId: deptId,
      assetId: state.assetId,
      assetName: state.assetName,
      qrCode: state.qrCode,
      shiftLabel,
      results,
      signatureData: signature,
      paused,
      pauseReason,
    };
  }, [clientId, deptId, state, shiftLabel, results, signature, paused, pauseReason, restored]);

  useChecklistAutosave(autosavePayload, !!autosavePayload && !paused);

  const payloadResults = useMemo(
    () =>
      results
        .filter((r) => r.status !== 'unset')
        .map((r) => ({
          itemId: r.itemId,
          status: r.status as 'pass' | 'fail' | 'skip',
          note: r.note,
          numericValue: r.numericValue,
          photoData: r.photoData,
        })),
    [results]
  );

  const patchResult = (itemId: number, patch: Partial<ItemResult>) => {
    setResults((prev) => {
      const idx = prev.findIndex((r) => r.itemId === itemId);
      if (idx < 0) return [...prev, { itemId, status: 'unset', ...patch }];
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const allItems = useMemo(
    () => template?.categories.flatMap((c) => c.items) ?? [],
    [template]
  );

  const findItem = (itemId: number): ChecklistItemDef | undefined =>
    allItems.find((i) => i.id === itemId);

  const isItemComplete = (item: ChecklistItemDef, r?: ItemResult) => {
    if (!r || r.status === 'unset') return false;
    if (isNumberItem(item)) {
      return r.numericValue !== undefined && !Number.isNaN(r.numericValue);
    }
    return true;
  };

  const hasOpenFailWithoutPhoto = () => {
    if (!template) return false;
    for (const r of results) {
      if (r.status !== 'fail') continue;
      const item = findItem(r.itemId);
      if (item?.requiresPhotoOnFail && !r.photoData) return true;
    }
    return false;
  };

  const validateAll = () => {
    if (paused) {
      toast.error(t('securityInspection.pauseActive'));
      return false;
    }
    if (!template) return false;
    for (const item of allItems) {
      const r = results.find((x) => x.itemId === item.id);
      if (!isItemComplete(item, r)) {
        toast.error(t('securityInspection.allItemsRequired'));
        return false;
      }
    }
    if (hasOpenFailWithoutPhoto()) {
      toast.error(t('securityInspection.photoRequiredBlock'));
      return false;
    }
    for (const r of results) {
      if (r.status !== 'fail') continue;
      if (!r.note?.trim()) {
        toast.error(t('securityInspection.noteRequiredBlock'));
        return false;
      }
    }
    return true;
  };

  const buildPayload = (status: 'draft' | 'submitted') => ({
    clientId,
    departmentId: deptId,
    assetId: state!.assetId,
    shiftLabel: paused ? `[TẠM HOÃN] ${pauseReason}` : shiftLabel,
    status,
    signatureData: signature,
    notes: paused ? pauseReason : undefined,
    results: payloadResults,
  });

  const persistLocal = async (status: 'draft' | 'submitted') => {
    await saveDraft({
      clientId,
      departmentId: deptId,
      assetId: state!.assetId,
      assetName: state!.assetName,
      qrCode: state!.qrCode,
      shiftLabel,
      results,
      signatureData: signature,
      paused,
      pauseReason,
      updatedAt: new Date().toISOString(),
    });
    await enqueueSync({
      id: clientId,
      payload: buildPayload(status),
      createdAt: new Date().toISOString(),
    });
    await refreshPending();
  };

  const syncReady = online && pending === 0 && !syncing;

  const onSaveDraft = async () => {
    setSaving(true);
    try {
      await persistLocal('draft');
      if (online) await securityInspectionAPI.saveDraft(buildPayload('draft'));
      toast.success(t('securityInspection.savedDraft'));
    } catch {
      toast.info(t('securityInspection.savedDraft'));
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = async () => {
    if (!validateAll()) return;
    if (!signature) {
      toast.error(t('securityInspection.signatureRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await persistLocal('submitted');
      if (online) {
        await syncNow();
        const remaining = await listSyncQueue();
        if (remaining.length > 0) {
          toast.error(t('securityInspection.submitWaitSync'));
          return;
        }
        await securityInspectionAPI.submit(buildPayload('submitted'));
        toast.success(t('securityInspection.submittedOk'));
        navigate('/security');
      } else {
        toast.success(t('securityInspection.savedOfflineSubmit'));
      }
    } catch (e: unknown) {
      toast.error((e as Error).message || t('securityInspection.syncFail'));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmPause = async () => {
    if (!pauseReason.trim()) {
      toast.error(t('securityInspection.pauseReasonRequired'));
      return;
    }
    setPaused(true);
    setPauseOpen(false);
    await persistLocal('draft');
    toast.success(t('securityInspection.pausedOk'));
  };

  if (!state) return null;

  if (isLoading || !template || !restored) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  const photoMeta = { qrCode: state.qrCode, assetName: state.assetName };
  const last = state.lastInspection;

  return (
    <>
      <div className="space-y-5 pb-4">
        <ChecksheetWorkflowStepper current={signature ? 4 : 3} />
        <SyncGateBanner online={online} pending={pending} syncing={syncing} />

        <div>
          <h1 className="text-2xl font-bold">{t('securityInspection.checklistTitle')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('securityInspection.tickEvidenceHint')}</p>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {t('securityInspection.asset')}: {state.assetName} ({state.qrCode})
          </p>
          <p className="text-xs text-emerald-700">{t('securityInspection.autosaveHint')}</p>
        </div>

        {last && last.failItems.length > 0 && (
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
            <div className="mb-2 flex items-center gap-2 font-bold text-amber-950">
              <History className="h-5 w-5" />
              {t('securityInspection.lastInspection', { date: last.date })}
            </div>
            <ul className="list-inside list-disc text-sm text-amber-900">
              {last.failItems.map((f, i) => (
                <li key={i}>
                  {f.label}
                  {f.note ? ` — ${f.note}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {paused && (
          <div className="rounded-xl border-2 border-orange-400 bg-orange-50 p-3 text-sm font-bold text-orange-900">
            {t('securityInspection.pausedBanner')}: {pauseReason}
          </div>
        )}

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-sm font-bold">{t('securityInspection.shiftLabel')}</label>
            <Input
              className="mt-1 min-h-12 text-base"
              placeholder={t('securityInspection.shiftPlaceholder')}
              value={shiftLabel}
              disabled={paused}
              onChange={(e) => setShiftLabel(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="sec-touch-btn mt-6 min-h-12 gap-1 border-2 font-bold"
            onClick={() => setPauseOpen(true)}
          >
            <PauseCircle className="h-5 w-5" />
            {t('securityInspection.pause')}
          </Button>
        </div>

        <ChecklistAccordion
          categories={template.categories}
          results={results}
          onChange={patchResult}
          photoMeta={photoMeta}
          readOnly={paused}
        />
        <SignaturePad value={signature} onChange={setSignature} />
      </div>

      <SecurityFooter
        onSaveDraft={onSaveDraft}
        onSubmit={onSubmit}
        saving={saving}
        submitting={submitting}
        submitDisabled={online ? !syncReady && pending > 0 : false}
      />

      <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('securityInspection.pauseTitle')}</DialogTitle>
          </DialogHeader>
          <Input
            className="min-h-12 text-base"
            placeholder={t('securityInspection.pauseReasonPlaceholder')}
            value={pauseReason}
            onChange={(e) => setPauseReason(e.target.value)}
          />
          <DialogFooter>
            <Button type="button" className="min-h-11 w-full font-bold" onClick={confirmPause}>
              {t('securityInspection.pauseConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

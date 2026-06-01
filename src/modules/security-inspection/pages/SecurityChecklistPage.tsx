import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/useI18n';
import { Input } from '@/components/ui/input';
import { ChecklistAccordion } from '../components/ChecklistAccordion';
import { SecurityFooter } from '../components/SecurityFooter';
import { SignaturePad } from '../components/SignaturePad';
import { securityInspectionAPI } from '../api';
import { getCachedTemplate, saveDraft, enqueueSync } from '../offline/idb';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import type { DepartmentTemplate, ItemResult, InspectionItemStatus } from '../types';
import { Loader2 } from 'lucide-react';

type LocState = {
  departmentId: number;
  assetId: number;
  assetName: string;
  qrCode: string;
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
  const online = useOnlineStatus();
  const state = location.state as LocState | null;

  const [clientId] = useState(() => crypto.randomUUID());
  const [shiftLabel, setShiftLabel] = useState('');
  const [results, setResults] = useState<ItemResult[]>([]);
  const [signature, setSignature] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!state) navigate('/security', { replace: true });
  }, [state, navigate]);

  const deptId = state?.departmentId ?? 0;

  const { data: template, isLoading } = useQuery({
    queryKey: ['security-template', deptId],
    queryFn: async () => {
      try {
        if (online) {
          const tpl = await securityInspectionAPI.getTemplate(deptId);
          return tpl;
        }
      } catch {
        /* fall through */
      }
      const cached = await getCachedTemplate(deptId);
      if (cached) return cached;
      throw new Error('No template');
    },
    enabled: deptId > 0,
  });

  useEffect(() => {
    if (template) setResults(buildInitialResults(template));
  }, [template]);

  const payloadResults = useMemo(
    () =>
      results
        .filter((r) => r.status !== 'unset')
        .map((r) => ({
          itemId: r.itemId,
          status: r.status as 'pass' | 'fail' | 'skip',
          note: r.note,
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

  const validateAll = () => {
    if (!template) return false;
    const total = template.categories.reduce((n, c) => n + c.items.length, 0);
    const done = results.filter((r) => r.status !== 'unset').length;
    if (done < total) {
      toast.error(t('securityInspection.allItemsRequired'));
      return false;
    }
    for (const r of results) {
      if (r.status !== 'fail') continue;
      const item = template.categories.flatMap((c) => c.items).find((i) => i.id === r.itemId);
      if (item?.requiresPhotoOnFail && !r.photoData) {
        toast.error(t('securityInspection.photoRequired'));
        return false;
      }
    }
    return true;
  };

  const buildPayload = (status: 'draft' | 'submitted') => ({
    clientId,
    departmentId: deptId,
    assetId: state!.assetId,
    shiftLabel,
    status,
    signatureData: signature,
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
      updatedAt: new Date().toISOString(),
    });
    await enqueueSync({
      id: clientId,
      payload: buildPayload(status),
      createdAt: new Date().toISOString(),
    });
  };

  const onSaveDraft = async () => {
    setSaving(true);
    try {
      await persistLocal('draft');
      if (online) {
        await securityInspectionAPI.saveDraft(buildPayload('draft'));
      }
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
        await securityInspectionAPI.submit(buildPayload('submitted'));
        toast.success(t('securityInspection.submittedOk'));
      } else {
        toast.success(t('securityInspection.savedDraft'));
      }
      navigate('/security');
    } catch (e: unknown) {
      toast.error((e as Error).message || t('securityInspection.syncFail'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!state) return null;

  if (isLoading || !template) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5 pb-4">
        <div>
          <h1 className="text-2xl font-bold">{t('securityInspection.checklistTitle')}</h1>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {t('securityInspection.asset')}: {state.assetName} ({state.qrCode})
          </p>
        </div>
        <div>
          <label className="text-sm font-bold">{t('securityInspection.shiftLabel')}</label>
          <Input
            className="mt-1 min-h-12 text-base"
            placeholder={t('securityInspection.shiftPlaceholder')}
            value={shiftLabel}
            onChange={(e) => setShiftLabel(e.target.value)}
          />
        </div>
        <ChecklistAccordion categories={template.categories} results={results} onChange={patchResult} />
        <SignaturePad value={signature} onChange={setSignature} />
      </div>
      <SecurityFooter onSaveDraft={onSaveDraft} onSubmit={onSubmit} saving={saving} submitting={submitting} />
    </>
  );
}

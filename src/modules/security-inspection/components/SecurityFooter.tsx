import { Loader2 } from 'lucide-react';
import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';

export function SecurityFooter({
  onSaveDraft,
  onSubmit,
  saving,
  submitting,
}: {
  onSaveDraft: () => void;
  onSubmit: () => void;
  saving?: boolean;
  submitting?: boolean;
}) {
  const { t } = useI18n();
  return (
    <footer className="sec-footer fixed bottom-0 left-0 right-0 z-40 border-t-2 border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md safe-area-pb">
      <div className="mx-auto flex max-w-3xl gap-3">
        <button
          type="button"
          disabled={saving || submitting}
          onClick={onSaveDraft}
          className={cn(
            'sec-touch-btn min-h-[52px] flex-1 rounded-xl border-2 border-slate-400 bg-white text-base font-bold text-slate-800',
            saving && 'opacity-60'
          )}
        >
          {saving ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : t('securityInspection.saveDraft')}
        </button>
        <button
          type="button"
          disabled={saving || submitting}
          onClick={onSubmit}
          className={cn(
            'sec-touch-btn min-h-[52px] flex-[1.2] rounded-xl bg-emerald-600 text-base font-bold text-white shadow-lg',
            submitting && 'opacity-60'
          )}
        >
          {submitting ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          ) : (
            t('securityInspection.submitReport')
          )}
        </button>
      </div>
    </footer>
  );
}

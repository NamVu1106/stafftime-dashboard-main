import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/useI18n';
import { QrScanner } from '../components/QrScanner';
import { securityInspectionAPI } from '../api';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export default function SecurityScanPage() {
  const { deptId } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const online = useOnlineStatus();
  const departmentId = Number(deptId);

  const resolve = useMutation({
    mutationFn: (qr: string) => securityInspectionAPI.resolveQr(qr),
    onSuccess: (data) => {
      if (data.department.id !== departmentId) {
        toast.error(t('securityInspection.scanInvalid'));
        return;
      }
      navigate('/security/checklist', {
        state: {
          departmentId,
          assetId: data.asset.id,
          assetName: data.asset.name,
          qrCode: data.asset.qr_code,
          lastInspection: data.lastInspection ?? null,
        },
      });
    },
    onError: () => {
      if (!online) {
        navigate('/security/checklist', {
          state: {
            departmentId,
            assetId: 0,
            assetName: 'Offline asset',
            qrCode: 'OFFLINE',
          },
        });
        return;
      }
      toast.error(t('securityInspection.scanInvalid'));
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('securityInspection.scanTitle')}</h1>
      <QrScanner onScan={(code) => resolve.mutate(code)} />
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Printer, RefreshCw, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/useI18n';
import { useAuth } from '@/contexts/AuthContext';
import { securityInspectionAPI } from '../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function SecurityAssetsAdminPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filterDept, setFilterDept] = useState<string>('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState('');
  const [newType, setNewType] = useState('equipment');
  const [printing, setPrinting] = useState(false);

  const { data: deptData } = useQuery({
    queryKey: ['security-departments'],
    queryFn: () => securityInspectionAPI.getDepartments(),
  });

  const deptFilterId =
    filterDept === 'all' ? undefined : Number(filterDept);

  const { data, isLoading } = useQuery({
    queryKey: ['security-assets', deptFilterId],
    queryFn: () => securityInspectionAPI.listAssets(deptFilterId),
  });

  const assets = data?.data ?? [];

  const visibleDepts = useMemo(() => {
    const all = deptData?.data ?? [];
    if (user?.role === 'admin' || user?.securityScopeAll) return all;
    const ids = new Set(user?.departmentIds ?? []);
    return all.filter((d) => ids.has(d.id));
  }, [deptData, user]);

  useEffect(() => {
    if (user?.role !== 'admin' && visibleDepts.length > 0 && filterDept === 'all') {
      setFilterDept(String(visibleDepts[0].id));
    }
  }, [visibleDepts, user?.role, filterDept]);

  const createMut = useMutation({
    mutationFn: () =>
      securityInspectionAPI.createAsset({
        departmentId: Number(newDept),
        name: newName,
        assetType: newType,
      }),
    onSuccess: (res) => {
      toast.success(`${t('securityInspection.assetCreated')}: ${res.qrCode}`);
      setDialogOpen(false);
      setNewName('');
      qc.invalidateQueries({ queryKey: ['security-assets'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const regenMut = useMutation({
    mutationFn: (id: number) => securityInspectionAPI.regenerateAssetQr(id),
    onSuccess: (res) => {
      toast.success(
        `${t('securityInspection.qrRegenerated')}: ${res.previousQrCode} → ${res.qrCode}`
      );
      qc.invalidateQueries({ queryKey: ['security-assets'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(assets.map((a) => a.id)));
    else setSelected(new Set());
  };

  const toggleOne = (id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const onPrintLabels = async () => {
    const ids = [...selected].filter((id) => assets.find((a) => a.id === id)?.isActive);
    if (!ids.length) {
      toast.error(t('securityInspection.selectAssetsToPrint'));
      return;
    }
    setPrinting(true);
    try {
      await securityInspectionAPI.downloadLabelsPdf(ids);
      toast.success(t('securityInspection.printOk'));
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-slate-700">
            <QrCode className="h-6 w-6" />
            <span className="text-xs font-bold uppercase tracking-wider">
              {t('securityInspection.assetsAdmin')}
            </span>
          </div>
          <h1 className="text-2xl font-bold">{t('securityInspection.assetsTitle')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('securityInspection.assetsHint')}</p>
          <p className="mt-2 text-xs font-medium text-amber-800">
            {t('securityInspection.labelPrintTip')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="sec-touch-btn min-h-12 gap-2 font-bold"
            onClick={() => {
              if (visibleDepts.length === 1) setNewDept(String(visibleDepts[0].id));
              setDialogOpen(true);
            }}
          >
            <Plus className="h-5 w-5" />
            {t('securityInspection.addAsset')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="sec-touch-btn min-h-12 gap-2 font-bold"
            disabled={printing || selected.size === 0}
            onClick={onPrintLabels}
          >
            {printing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Printer className="h-5 w-5" />
            )}
            {t('securityInspection.printLabels')}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-bold">{t('securityInspection.filterDept')}</label>
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="min-h-11 w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {user?.role === 'admin' && (
              <SelectItem value="all">{t('securityInspection.allDepts')}</SelectItem>
            )}
            {visibleDepts.map((d) => (
              <SelectItem key={d.id} value={String(d.id)}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={assets.length > 0 && selected.size === assets.length}
                    onCheckedChange={(v) => toggleAll(!!v)}
                  />
                </TableHead>
                <TableHead>{t('securityInspection.colQr')}</TableHead>
                <TableHead>{t('securityInspection.colAssetName')}</TableHead>
                <TableHead>{t('securityInspection.colDept')}</TableHead>
                <TableHead>{t('securityInspection.colStatus')}</TableHead>
                <TableHead className="text-right">{t('securityInspection.colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((a) => (
                <TableRow key={a.id} className={cn(!a.isActive && 'opacity-50')}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(a.id)}
                      disabled={!a.isActive}
                      onCheckedChange={(v) => toggleOne(a.id, !!v)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold">{a.qrCode}</TableCell>
                  <TableCell className="font-semibold">{a.name}</TableCell>
                  <TableCell>{a.departmentName}</TableCell>
                  <TableCell>
                    <Badge variant={a.isActive ? 'default' : 'secondary'}>
                      {a.isActive
                        ? t('securityInspection.statusActive')
                        : t('securityInspection.statusInactive')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-10 gap-1 font-semibold"
                      disabled={regenMut.isPending}
                      onClick={() => regenMut.mutate(a.id)}
                    >
                      <RefreshCw className="h-4 w-4" />
                      {t('securityInspection.regenerateQr')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('securityInspection.addAsset')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-bold">{t('securityInspection.colDept')}</label>
              <Select value={newDept} onValueChange={setNewDept}>
                <SelectTrigger className="mt-1 min-h-11">
                  <SelectValue placeholder="..." />
                </SelectTrigger>
                <SelectContent>
                  {visibleDepts.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-bold">{t('securityInspection.colAssetName')}</label>
              <Input
                className="mt-1 min-h-11"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-bold">{t('securityInspection.assetType')}</label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="mt-1 min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equipment">{t('securityInspection.typeEquipment')}</SelectItem>
                  <SelectItem value="goods">{t('securityInspection.typeGoods')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              className="min-h-11 w-full font-bold"
              disabled={!newDept || !newName.trim() || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                t('securityInspection.createWithAutoQr')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

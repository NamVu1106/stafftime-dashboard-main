import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Trash2,
  ListChecks,
} from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/useI18n';
import { useAuth } from '@/contexts/AuthContext';
import { securityInspectionAPI } from '../api';
import type { ChecklistEditorCategory, ChecklistEditorTemplate } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

type ItemForm = {
  label: string;
  inputType: 'boolean' | 'number';
  requiresPhotoOnFail: boolean;
  minValue: string;
  maxValue: string;
  unit: string;
};

const emptyItemForm = (): ItemForm => ({
  label: '',
  inputType: 'boolean',
  requiresPhotoOnFail: true,
  minValue: '',
  maxValue: '',
  unit: '',
});

export default function SecurityChecklistEditorPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [deptId, setDeptId] = useState<string>('');
  const [local, setLocal] = useState<ChecklistEditorTemplate | null>(null);
  const [itemDialog, setItemDialog] = useState<{
    mode: 'create' | 'edit';
    categoryId: number;
    itemId?: number;
  } | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyItemForm());
  const [dragItemId, setDragItemId] = useState<number | null>(null);

  const { data: deptData } = useQuery({
    queryKey: ['security-departments'],
    queryFn: () => securityInspectionAPI.getDepartments(),
  });

  const visibleDepts = useMemo(() => {
    const all = deptData?.data ?? [];
    if (user?.role === 'admin') return all;
    const ids = new Set(user?.departmentIds ?? []);
    return all.filter((d) => ids.has(d.id));
  }, [deptData, user]);

  useEffect(() => {
    if (!deptId && visibleDepts.length > 0) {
      setDeptId(String(visibleDepts[0].id));
    }
  }, [visibleDepts, deptId]);

  const deptNum = Number(deptId);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['security-checklist-editor', deptNum],
    queryFn: () => securityInspectionAPI.getChecklistEditor(deptNum),
    enabled: deptNum > 0,
  });

  useEffect(() => {
    if (data) setLocal(JSON.parse(JSON.stringify(data)) as ChecklistEditorTemplate);
  }, [data]);

  const saveOrderMut = useMutation({
    mutationFn: () => {
      if (!local) throw new Error('No data');
      const categories = local.categories.map((c, i) => ({ id: c.id, sortOrder: i }));
      const items = local.categories.flatMap((c) =>
        c.items.map((item, i) => ({ id: item.id, categoryId: c.id, sortOrder: i }))
      );
      return securityInspectionAPI.reorderChecklist(local.department.id, { categories, items });
    },
    onSuccess: () => {
      toast.success(t('securityInspection.checklistOrderSaved'));
      refetch();
      qc.invalidateQueries({ queryKey: ['security-template'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addCatMut = useMutation({
    mutationFn: (name: string) => securityInspectionAPI.createChecklistCategory(deptNum, name),
    onSuccess: () => {
      toast.success(t('securityInspection.categoryAdded'));
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCatMut = useMutation({
    mutationFn: (id: number) => securityInspectionAPI.deleteChecklistCategory(id),
    onSuccess: () => {
      toast.success(t('securityInspection.deleted'));
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveItemMut = useMutation({
    mutationFn: async () => {
      if (!itemDialog || !form.label.trim()) throw new Error('label required');
      const body = {
        label: form.label.trim(),
        inputType: form.inputType,
        requiresPhotoOnFail: form.requiresPhotoOnFail,
        minValue: form.minValue === '' ? null : Number(form.minValue),
        maxValue: form.maxValue === '' ? null : Number(form.maxValue),
        unit: form.unit.trim() || null,
      };
      if (itemDialog.mode === 'create') {
        return securityInspectionAPI.createChecklistItem(itemDialog.categoryId, body);
      }
      return securityInspectionAPI.updateChecklistItem(itemDialog.itemId!, body);
    },
    onSuccess: () => {
      toast.success(t('securityInspection.itemSaved'));
      setItemDialog(null);
      refetch();
      qc.invalidateQueries({ queryKey: ['security-template'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteItemMut = useMutation({
    mutationFn: (id: number) => securityInspectionAPI.deleteChecklistItem(id),
    onSuccess: () => {
      toast.success(t('securityInspection.deleted'));
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveCategory = (catId: number, dir: -1 | 1) => {
    if (!local) return;
    const idx = local.categories.findIndex((c) => c.id === catId);
    const next = idx + dir;
    if (next < 0 || next >= local.categories.length) return;
    const cats = [...local.categories];
    [cats[idx], cats[next]] = [cats[next], cats[idx]];
    setLocal({ ...local, categories: cats.map((c, i) => ({ ...c, sortOrder: i })) });
  };

  const moveItem = (catId: number, itemId: number, dir: -1 | 1) => {
    if (!local) return;
    setLocal({
      ...local,
      categories: local.categories.map((c) => {
        if (c.id !== catId) return c;
        const idx = c.items.findIndex((i) => i.id === itemId);
        const next = idx + dir;
        if (next < 0 || next >= c.items.length) return c;
        const items = [...c.items];
        [items[idx], items[next]] = [items[next], items[idx]];
        return { ...c, items };
      }),
    });
  };

  const onItemDrop = (targetCatId: number, targetItemId: number) => {
    if (!local || dragItemId == null) return;
    let dragged: (typeof local.categories)[0]['items'][0] | null = null;
    let fromCatId = 0;
    for (const c of local.categories) {
      const found = c.items.find((i) => i.id === dragItemId);
      if (found) {
        dragged = found;
        fromCatId = c.id;
        break;
      }
    }
    if (!dragged) return;
    const categories = local.categories.map((c) => ({
      ...c,
      items: c.items.filter((i) => i.id !== dragItemId),
    }));
    const updated = categories.map((c) => {
      if (c.id !== targetCatId) return c;
      const items = [...c.items];
      const at = items.findIndex((i) => i.id === targetItemId);
      items.splice(at < 0 ? items.length : at, 0, dragged!);
      return { ...c, items };
    });
    if (fromCatId !== targetCatId) {
      setLocal({ ...local, categories: updated });
    } else {
      setLocal({ ...local, categories: updated });
    }
    setDragItemId(null);
  };

  const openCreateItem = (categoryId: number) => {
    setForm(emptyItemForm());
    setItemDialog({ mode: 'create', categoryId });
  };

  const openEditItem = (categoryId: number, item: ChecklistEditorCategory['items'][0]) => {
    setForm({
      label: item.label,
      inputType: item.inputType === 'number' ? 'number' : 'boolean',
      requiresPhotoOnFail: item.requiresPhotoOnFail,
      minValue: item.minValue != null ? String(item.minValue) : '',
      maxValue: item.maxValue != null ? String(item.maxValue) : '',
      unit: item.unit ?? '',
    });
    setItemDialog({ mode: 'edit', categoryId, itemId: item.id });
  };

  const exportJson = () => {
    if (!local) return;
    const blob = new Blob([JSON.stringify(local, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `checklist-${local.department.code}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-emerald-700">
            <ListChecks className="h-6 w-6" />
            <span className="text-xs font-bold uppercase">{t('securityInspection.checklistEditor')}</span>
          </div>
          <h1 className="text-2xl font-bold">{t('securityInspection.checklistEditorTitle')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('securityInspection.checklistEditorHint')}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={exportJson} disabled={!local}>
            JSON
          </Button>
          <Button
            type="button"
            className="min-h-11 gap-2 font-bold"
            disabled={!local || saveOrderMut.isPending}
            onClick={() => saveOrderMut.mutate()}
          >
            {saveOrderMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('securityInspection.saveOrder')}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border-2 border-slate-200 bg-white p-4">
        <div className="min-w-[200px] flex-1">
          <label className="text-xs font-bold">{t('securityInspection.filterDept')}</label>
          <Select value={deptId} onValueChange={setDeptId}>
            <SelectTrigger className="mt-1 min-h-11">
              <SelectValue />
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
        <Button
          type="button"
          className="min-h-11 gap-1 font-bold"
          onClick={() => {
            const name = window.prompt(t('securityInspection.newCategoryName'));
            if (name?.trim()) addCatMut.mutate(name.trim());
          }}
        >
          <Plus className="h-4 w-4" />
          {t('securityInspection.addCategory')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      ) : !local ? null : (
        <div className="space-y-4">
          {local.categories.map((cat, catIdx) => (
            <section
              key={cat.id}
              className="rounded-xl border-2 border-slate-200 bg-white shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
                <GripVertical className="h-5 w-5 text-slate-400" />
                <Input
                  className="min-h-10 flex-1 font-bold"
                  value={cat.name}
                  onChange={(e) =>
                    setLocal({
                      ...local,
                      categories: local.categories.map((c) =>
                        c.id === cat.id ? { ...c, name: e.target.value } : c
                      ),
                    })
                  }
                  onBlur={() => {
                    const c = local.categories.find((x) => x.id === cat.id);
                    if (c && c.name.trim()) {
                      securityInspectionAPI.updateChecklistCategory(cat.id, c.name.trim());
                    }
                  }}
                />
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="outline" onClick={() => moveCategory(cat.id, -1)}>
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="outline" onClick={() => moveCategory(cat.id, 1)}>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="text-red-600"
                    onClick={() => {
                      if (window.confirm(t('securityInspection.confirmDeleteCategory'))) {
                        deleteCatMut.mutate(cat.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <ul className="divide-y divide-slate-100 p-2">
                {cat.items.map((item) => (
                  <li
                    key={item.id}
                    draggable
                    onDragStart={() => setDragItemId(item.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onItemDrop(cat.id, item.id)}
                    className="flex flex-wrap items-center gap-2 rounded-lg p-2 hover:bg-slate-50"
                  >
                    <GripVertical className="h-5 w-5 shrink-0 cursor-grab text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{item.label}</p>
                      <p className="text-xs text-slate-500">
                        {item.inputType === 'number'
                          ? `${t('securityInspection.itemTypeNumber')}: ${item.minValue ?? '—'} – ${item.maxValue ?? '—'} ${item.unit ?? ''}`
                          : t('securityInspection.itemTypeBoolean')}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button type="button" size="icon" variant="ghost" onClick={() => moveItem(cat.id, item.id, -1)}>
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" onClick={() => moveItem(cat.id, item.id, 1)}>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => openEditItem(cat.id, item)}>
                        {t('securityInspection.editItem')}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() => {
                          if (window.confirm(t('securityInspection.confirmDeleteItem'))) {
                            deleteItemMut.mutate(item.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="border-t border-slate-100 p-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full min-h-11 font-bold"
                  onClick={() => openCreateItem(cat.id)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t('securityInspection.addItem')}
                </Button>
              </div>
              {catIdx === 0 && (
                <p className="px-3 pb-2 text-xs text-slate-400">{t('securityInspection.dragHint')}</p>
              )}
            </section>
          ))}
        </div>
      )}

      <Dialog open={!!itemDialog} onOpenChange={(o) => !o && setItemDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {itemDialog?.mode === 'create'
                ? t('securityInspection.addItem')
                : t('securityInspection.editItem')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('securityInspection.itemLabel')}</Label>
              <Input
                className="mt-1 min-h-11"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t('securityInspection.itemType')}</Label>
              <Select
                value={form.inputType}
                onValueChange={(v) => setForm((f) => ({ ...f, inputType: v as 'boolean' | 'number' }))}
              >
                <SelectTrigger className="mt-1 min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="boolean">{t('securityInspection.itemTypeBoolean')}</SelectItem>
                  <SelectItem value="number">{t('securityInspection.itemTypeNumber')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.inputType === 'number' && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Min</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={form.minValue}
                    onChange={(e) => setForm((f) => ({ ...f, minValue: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Max</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={form.maxValue}
                    onChange={(e) => setForm((f) => ({ ...f, maxValue: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>{t('securityInspection.unit')}</Label>
                  <Input
                    className="mt-1"
                    placeholder="°C"
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  />
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Checkbox
                id="photo-req"
                checked={form.requiresPhotoOnFail}
                onCheckedChange={(c) => setForm((f) => ({ ...f, requiresPhotoOnFail: !!c }))}
              />
              <Label htmlFor="photo-req">{t('securityInspection.photoRequiredOnNotOk')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" className="min-h-11 w-full font-bold" onClick={() => saveItemMut.mutate()}>
              {saveItemMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('securityInspection.itemSavedBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

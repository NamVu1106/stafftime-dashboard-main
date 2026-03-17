import { useState } from 'react';
import { FolderOpen, FileSpreadsheet, ListTree } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { useI18n } from '@/contexts/I18nContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { MenuTreeItem } from './DepartmentMenuTree';

interface SiteMapMenuTreeProps {
  title: string;
  items: MenuTreeItem[];
  onSelect: (id: string) => void;
  /** Chia items thành các cột - mỗi phần là 1 cột */
  columnGroups?: string[][];
  className?: string;
}

/**
 * Bảng chọn chức năng - multi-column + Download Excel + Menu Structure
 */
export const SiteMapMenuTree = ({
  title,
  items,
  onSelect,
  columnGroups,
  className,
}: SiteMapMenuTreeProps) => {
  const { t } = useI18n();
  const [menuStructureOpen, setMenuStructureOpen] = useState(false);

  const handleDownloadExcel = () => {
    const data = items.map((item) => ({
      [t('deptMenu.department')]: title.split(' —')[0],
      [t('deptMenu.function')]: item.labelKey ? t(item.labelKey) : item.label,
      'ID': item.id,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MenuTree');
    XLSX.writeFile(wb, `YS-Smart_MenuTree_${title.replace(/\s/g, '_')}.xlsx`);
  };

  const cols = columnGroups ?? (() => {
    if (items.length === 0) return [[]];
    const n = Math.min(4, Math.max(1, Math.ceil(items.length / 2)));
    const perCol = Math.ceil(items.length / n);
    const groups: string[][] = [];
    for (let i = 0; i < n; i++) {
      groups.push(items.slice(i * perCol, (i + 1) * perCol).map((x) => x.id));
    }
    return groups;
  })();

  const getColumnItems = (ids: string[]) =>
    items.filter((item) => ids.includes(item.id));

  return (
    <div className={cn('flex gap-0 rounded-lg border border-border bg-card overflow-hidden', className)}>
      {/* Multi-column layout */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="bg-[hsl(215,75%,32%)] -mx-4 -mt-4 px-4 py-3 mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <span className="text-xs text-white/80">{items.length} {t('deptMenu.functionsCount')}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {cols.map((ids, colIdx) => {
            const colItems = getColumnItems(ids);
            if (colItems.length === 0) return null;
            const groupLabel = title.split(' —')[0];
            return (
              <div key={colIdx} className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted px-3 py-2 text-sm font-semibold">
                  {groupLabel}
                </div>
                <ul className="divide-y divide-border">
                  {colItems.map((item) => {
                    const Icon = item.icon ?? FolderOpen;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(item.id)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-primary/5 text-left text-sm transition-colors"
                        >
                          <Icon className="w-4 h-4 text-primary shrink-0" />
                          {item.labelKey ? t(item.labelKey) : item.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right - 세부 설명 (Detailed Description) */}
      <div className="w-64 shrink-0 border-l border-border bg-muted/20 p-4">
        <h3 className="text-sm font-semibold mb-3 text-primary">
          {t('deptMenu.detailDescription')}
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          {t('deptMenu.selectFromTable')}
        </p>
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 h-8 text-xs"
              onClick={handleDownloadExcel}
            >
              <FileSpreadsheet className="w-4 h-4" />
              {t('dashboard.downloadExcel')}
            </Button>
          </li>
          <li>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 h-8 text-xs"
              onClick={() => setMenuStructureOpen(true)}
            >
              <ListTree className="w-4 h-4" />
              {t('dashboard.menuStructure')}
            </Button>
          </li>
        </ul>
      </div>

      {/* Menu Structure Dialog */}
      <Dialog open={menuStructureOpen} onOpenChange={setMenuStructureOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Menu Structure — {title.split(' —')[0]}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-4">
            {items.map((item, idx) => {
              const Icon = item.icon ?? FolderOpen;
              return (
                <div key={item.id} className="flex items-center gap-2 py-1.5 pl-4 border-l-2 border-primary/30">
                  <Icon className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-medium">{idx + 1}.</span>
                  <span>{item.labelKey ? t(item.labelKey) : item.label}</span>
                  <span className="text-xs text-muted-foreground">({item.id})</span>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

import { useState } from 'react';
import { ChevronDown, ChevronRight, FolderOpen, Plus, Minus, FileSpreadsheet, ListTree } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
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
 * Menu Tree kiểu MES 2.0 - Site Map + multi-column + Open All/Close All/Download
 */
export const SiteMapMenuTree = ({
  title,
  items,
  onSelect,
  columnGroups,
  className,
}: SiteMapMenuTreeProps) => {
  const [expanded, setExpanded] = useState(true);
  const [menuStructureOpen, setMenuStructureOpen] = useState(false);

  const handleOpenAll = () => setExpanded(true);
  const handleCloseAll = () => setExpanded(false);

  const handleDownloadExcel = () => {
    const data = items.map((item) => ({
      'Phòng ban': title.split(' —')[0],
      'Chức năng': item.label,
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
      {/* Left - Site Map sidebar */}
      <div className="w-56 shrink-0 border-r border-border bg-muted/30">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold">Site Map</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleOpenAll}
              title="+ Open All"
            >
              <Plus className="w-4 h-4 text-green-600" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleCloseAll}
              title="- Close All"
            >
              <Minus className="w-4 h-4 text-orange-600" />
            </Button>
          </div>
        </div>
        <div className="py-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-left text-sm font-medium"
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 shrink-0" />
            )}
            <span>{title.split(' —')[0]}</span>
          </button>
          {expanded && (
            <div className="pl-4 space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon ?? FolderOpen;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-primary/10 rounded-md text-left text-sm"
                  >
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Center - Multi-column layout */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="bg-[hsl(215,75%,32%)] -mx-4 -mt-4 px-4 py-3 mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <span className="text-xs text-white/80">{items.length} chức năng</span>
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
                          {item.label}
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
          세부 설명
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Menu Tree 화면을 통해 전체 UI Menu 확인 가능.
        </p>
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-green-600 shrink-0" />
            <span>+ Open All: Mở tất cả mục con</span>
          </li>
          <li className="flex items-center gap-2">
            <Minus className="w-4 h-4 text-orange-600 shrink-0" />
            <span>- Close All: Đóng tất cả mục con</span>
          </li>
          <li>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 h-8 text-xs"
              onClick={handleDownloadExcel}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Download Excel
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
              Menu Structure
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
                  <span>{item.label}</span>
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

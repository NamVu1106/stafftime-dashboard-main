import { LucideIcon } from 'lucide-react';
import { ChevronDown, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MenuTreeItem {
  id: string;
  label: string;
  icon?: LucideIcon;
}

interface DepartmentMenuTreeProps {
  title: string;
  items: MenuTreeItem[];
  onSelect: (id: string) => void;
  className?: string;
}

/**
 * Menu Tree kiểu MES 2.0 - compact multi-column grid.
 * Click vào chức năng → mở dashboard riêng.
 */
export const DepartmentMenuTree = ({ title, items, onSelect, className }: DepartmentMenuTreeProps) => {
  return (
    <div className={cn('rounded-lg border border-border bg-card overflow-hidden', className)}>
      <div className="bg-[hsl(215,75%,32%)] px-4 py-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <span className="text-xs text-white/80 flex items-center gap-1">
          <ChevronDown className="w-4 h-4" />
          {items.length} chức năng
        </span>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {items.map((item) => {
            const Icon = item.icon || FolderOpen;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-border',
                  'hover:border-primary hover:bg-primary/5 transition-all duration-200',
                  'text-left w-full group'
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <span className="text-sm font-medium text-center line-clamp-2">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

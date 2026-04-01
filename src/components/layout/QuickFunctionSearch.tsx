import { useMemo, useRef, useState, useEffect, useCallback, type ComponentType } from 'react';
import { Home, Search } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useI18n } from '@/hooks/useI18n';
import { useDashboardTab } from '@/contexts/DashboardTabContext';
import { toast as sonnerToast } from 'sonner';
import {
  administrationMenuRoute,
  hrMenuRoute,
  HR_REPORT_INLINE_IDS,
} from '@/data/departmentMenu';
import {
  getQuickSearchRegistry,
  normalizeQuickSearchText,
  type QuickSearchRegistryEntry,
} from '@/lib/quickSearchRegistry';

type Row = {
  entry: QuickSearchRegistryEntry;
  title: string;
  Icon: ComponentType<{ className?: string }>;
  group: string;
  key: string;
  haystack: string;
};

export function QuickFunctionSearch({ className }: { className?: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { setActiveDeptTab, setSelectedFunction } = useDashboardTab();
  const isDashboard = location.pathname === '/';

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const flat = useMemo(() => getQuickSearchRegistry(), []);

  const itemsWithLabels: Row[] = useMemo(() => {
    return flat.map((entry) => {
      let title: string;
      let Icon: ComponentType<{ className?: string }>;
      let group: string;
      let key: string;
      if (entry.kind === 'route') {
        title = t(entry.titleKey);
        Icon = entry.icon;
        group = t('common.quickSearchGroupPages');
        key = `route:${entry.path}`;
      } else {
        title = entry.item.labelKey ? t(entry.item.labelKey) : entry.item.label;
        Icon = entry.item.icon ?? Home;
        group = t(entry.deptLabelKey);
        key = `dept:${entry.dept}:${entry.fnId}`;
      }
      const deptName = entry.kind === 'route' ? '' : t(entry.deptLabelKey);
      const haystack = normalizeQuickSearchText([title, deptName].filter(Boolean).join(' '));
      return { entry, title, Icon, group, key, haystack };
    });
  }, [flat, t]);

  const filtered = useMemo(() => {
    const q = normalizeQuickSearchText(query);
    if (!q) return itemsWithLabels;
    return itemsWithLabels.filter((row) => row.haystack.includes(q));
  }, [itemsWithLabels, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of filtered) {
      const g = row.group;
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(row);
    }
    return map;
  }, [filtered]);

  const run = useCallback(
    (entry: QuickSearchRegistryEntry) => {
      setOpen(false);
      setQuery('');
      if (entry.kind === 'route') {
        navigate(entry.path);
        return;
      }
      const fnId = entry.fnId;
      const dept = entry.dept;
      if (dept === 'accounting') {
        setActiveDeptTab('accounting');
        setSelectedFunction(fnId);
        if (location.pathname !== '/') navigate('/');
        return;
      }
      if (dept === 'administration') {
        setActiveDeptTab('administration');
        if (administrationMenuRoute[fnId]) navigate(administrationMenuRoute[fnId]);
        else {
          setSelectedFunction(fnId);
          if (location.pathname !== '/') navigate('/');
        }
        return;
      }
      if (dept === 'hr') {
        setActiveDeptTab('hr');
        if (fnId === 'all') {
          setSelectedFunction('all');
          if (location.pathname !== '/') navigate('/');
          return;
        }
        if (HR_REPORT_INLINE_IDS.has(fnId) && isDashboard) {
          setSelectedFunction(fnId);
          return;
        }
        if (hrMenuRoute[fnId]) {
          navigate(hrMenuRoute[fnId]);
          return;
        }
        setSelectedFunction(fnId);
        if (location.pathname !== '/') navigate('/');
        return;
      }
      if (dept === 'congvu') {
        setActiveDeptTab('congvu');
        sonnerToast(t('deptMenu.comingSoon'));
        return;
      }
      if (dept === 'muahang') {
        setActiveDeptTab('muahang');
        sonnerToast(t('deptMenu.comingSoon'));
        return;
      }
      if (dept === 'ehs') {
        setActiveDeptTab('ehs');
        sonnerToast(t('deptMenu.comingSoonEhs'));
        return;
      }
    },
    [navigate, location.pathname, isDashboard, setActiveDeptTab, setSelectedFunction, t]
  );

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        wrapRef.current?.querySelector('input')?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div ref={wrapRef} className={cn('relative w-full', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
        <Input
          type="text"
          placeholder={t('common.searchPlaceholder')}
          title={t('common.quickSearchShortcutHint')}
          className="pl-9 h-9 bg-muted/50 border-0 focus-visible:ring-2"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filtered.length > 0) {
              e.preventDefault();
              run(filtered[0].entry);
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              setOpen(false);
            }
          }}
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
        />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover text-popover-foreground shadow-md outline-none overflow-hidden min-w-[min(100%,20rem)]">
          <Command shouldFilter={false} className="rounded-none border-0 shadow-none bg-transparent">
            <CommandList className="max-h-[min(60vh,320px)]">
              {filtered.length === 0 ? (
                <CommandEmpty className="py-6 text-sm text-muted-foreground">
                  {t('common.quickSearchEmpty')}
                </CommandEmpty>
              ) : (
                Array.from(grouped.entries()).map(([groupName, rows]) => (
                  <CommandGroup key={groupName} heading={groupName}>
                    {rows.map((row) => {
                      const ItemIcon = row.Icon;
                      return (
                        <CommandItem
                          key={row.key}
                          value={row.key}
                          onSelect={() => run(row.entry)}
                          className="flex items-center gap-2.5 cursor-pointer aria-selected:bg-accent"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            <ItemIcon className="h-4 w-4" />
                          </span>
                          <span className="truncate text-sm">{row.title}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))
              )}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/contexts/I18nContext';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T, index?: number) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  pageSize?: number;
}

export function DataTable<T extends { id: number | string }>({
  data,
  columns,
  searchPlaceholder,
  onSearch,
  pageSize: initialPageSize = 10,
}: DataTableProps<T>) {
  const { t } = useI18n();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  
  const defaultSearchPlaceholder = searchPlaceholder || t('common.search');

  // If onSearch callback is provided, use server-side search (don't filter client-side)
  // Otherwise, use client-side filtering
  const shouldUseServerSearch = !!onSearch;

  // Client-side filtering (only if no onSearch callback)
  const filteredData = shouldUseServerSearch 
    ? data  // Use data as-is when server-side search is enabled
    : data.filter((item) => {
        if (!searchQuery) return true;
        const searchLower = searchQuery.toLowerCase();
        return Object.values(item).some(value => 
          String(value).toLowerCase().includes(searchLower)
        );
      });

  // Sorting
  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig) return 0;
    const aValue = (a as Record<string, unknown>)[sortConfig.key];
    const bValue = (b as Record<string, unknown>)[sortConfig.key];
    
    if (aValue === bValue) return 0;
    
    const comparison = aValue! < bValue! ? -1 : 1;
    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return prev.direction === 'asc' 
          ? { key, direction: 'desc' } 
          : null;
      }
      return { key, direction: 'asc' };
    });
  };

  const handleSearch = (value: string) => {
    // Update local state immediately for UI responsiveness
    setSearchQuery(value);
    setCurrentPage(1);
    // If onSearch callback is provided, use it for server-side search
    // Call it immediately (no debounce) so user sees results as they type
    if (onSearch) {
      onSearch(value);
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm animate-fade-in-up transition-all duration-300 hover:shadow-md">
      {/* Header */}
      <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between">
        {searchPlaceholder && (
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={defaultSearchPlaceholder}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('common.display')}</span>
          <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{t('common.rows')}</span>
        </div>
      </div>

      {/* Table - không overflow-x ở đây để thanh kéo ngang nằm ở viewport (main), chỉ giới hạn chiều dọc */}
      <div className="overflow-y-auto max-h-[calc(100vh-300px)] relative w-max min-w-full">
        <table className="data-table w-max min-w-full">
          <thead className="sticky top-0 z-30 bg-muted">
            <tr>
              {columns.map((col, index) => {
                // Make first two columns (STT and Avatar) sticky when scrolling horizontally
                const isStickyColumn = index < 2;
                return (
                <th
                  key={col.key.toString()}
                  onClick={() => col.sortable && handleSort(col.key.toString())}
                    className={`${col.sortable ? 'cursor-pointer hover:bg-muted/80 select-none' : ''} ${
                      isStickyColumn ? 'sticky bg-muted border-r border-border' : 'bg-muted'
                    } ${index === 1 ? 'left-[60px] z-30' : index === 0 ? 'left-0 z-30' : ''}`}
                    style={isStickyColumn ? {
                      minWidth: index === 0 ? '60px' : '80px',
                      width: index === 0 ? '60px' : '80px',
                      position: 'sticky',
                      top: 0,
                    } : {
                      position: 'sticky',
                      top: 0,
                    }}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortConfig?.key === col.key && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length > 0 ? (
              paginatedData.map((item, rowIndex) => (
                <tr key={item.id} className="hover:bg-muted/50">
                  {columns.map((col, index) => {
                    // Make first two columns (STT and Avatar) sticky when scrolling horizontally
                    const isStickyColumn = index < 2;
                    return (
                      <td 
                        key={`${item.id}-${col.key.toString()}`}
                        className={`${isStickyColumn ? 'sticky bg-card border-r border-border' : ''} ${
                          index === 1 ? 'left-[60px] z-20' : index === 0 ? 'left-0 z-20' : ''
                        }`}
                        style={isStickyColumn ? {
                          minWidth: index === 0 ? '60px' : '80px',
                          width: index === 0 ? '60px' : '80px',
                          position: 'sticky',
                          left: index === 0 ? 0 : '60px',
                        } : {}}
                      >
                      {col.render 
                        ? col.render(item, startIndex + rowIndex) 
                        : String((item as Record<string, unknown>)[col.key.toString()] ?? '')}
                    </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                  {t('common.noData')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {t('common.showing')} {startIndex + 1} - {Math.min(startIndex + pageSize, sortedData.length)} {t('common.of')} {sortedData.length} {t('common.rows')}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            <ChevronsLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(p => p - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="px-4 text-sm">
            {t('common.page')} {currentPage} / {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(p => p + 1)}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            <ChevronsRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

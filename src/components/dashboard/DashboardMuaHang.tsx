import { ShoppingCart } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';

export interface DashboardMuaHangProps {
  filterMode?: 'day' | 'month' | 'year' | 'single' | 'range';
  selectedDate?: string | null;
  dateRange?: { start: string; end: string };
  baseDate?: string;
}

export const DashboardMuaHang = ({ filterMode, selectedDate, dateRange, baseDate }: DashboardMuaHangProps) => {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Báo cáo Mua hàng — Các chỉ số về đơn hàng, nhà cung cấp, tồn kho. Dữ liệu sẽ được tích hợp khi có nguồn.
      </p>
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <ShoppingCart className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">Chưa có dữ liệu Mua hàng</p>
        <p className="text-sm mt-2">Upload file hoặc kết nối nguồn dữ liệu để hiển thị báo cáo Mua hàng.</p>
      </div>
    </div>
  );
};

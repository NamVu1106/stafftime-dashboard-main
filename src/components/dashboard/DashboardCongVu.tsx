import { Briefcase } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';

export interface DashboardCongVuProps {
  filterMode?: 'day' | 'month' | 'year' | 'single' | 'range';
  selectedDate?: string | null;
  dateRange?: { start: string; end: string };
  baseDate?: string;
}

export const DashboardCongVu = ({ filterMode, selectedDate, dateRange, baseDate }: DashboardCongVuProps) => {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Báo cáo Công vụ — Các chỉ số liên quan đến hoạt động công vụ. Dữ liệu sẽ được tích hợp khi có nguồn.
      </p>
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <Briefcase className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">Chưa có dữ liệu Công vụ</p>
        <p className="text-sm mt-2">Upload file hoặc kết nối nguồn dữ liệu để hiển thị báo cáo Công vụ.</p>
      </div>
    </div>
  );
};

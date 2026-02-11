import { useQuery } from '@tanstack/react-query';
import { Wallet, Receipt } from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { hrExcelAPI } from '@/services/api';
import { useI18n } from '@/contexts/I18nContext';
import { formatNumberPlain } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export interface DashboardAccountingProps {
  filterMode?: 'day' | 'month' | 'year' | 'single' | 'range';
  selectedDate?: string | null;
  dateRange?: { start: string; end: string };
  baseDate?: string;
}

export const DashboardAccounting = ({ filterMode, selectedDate, dateRange, baseDate }: DashboardAccountingProps) => {
  const { t } = useI18n();

  const formatNum = (v: any) => (Number.isFinite(Number(v)) ? formatNumberPlain(v) : t('dashboard.na'));

  const { data: hrBhxhListStats } = useQuery({
    queryKey: ['hrExcel', 'stats', 'bhxh-list'],
    queryFn: () => hrExcelAPI.getStats('bhxh-list'),
  });

  const { data: hrPayrollStats } = useQuery({
    queryKey: ['hrExcel', 'stats', 'payroll'],
    queryFn: () => hrExcelAPI.getStats('payroll'),
  });

  const { data: hrDailyWageStats } = useQuery({
    queryKey: ['hrExcel', 'stats', 'daily-wage'],
    queryFn: () => hrExcelAPI.getStats('daily-wage'),
  });

  const { data: hrArrearsCollectionStats } = useQuery({
    queryKey: ['hrExcel', 'stats', 'arrears-collection'],
    queryFn: () => hrExcelAPI.getStats('arrears-collection'),
  });

  const hrBhxhPayable = (hrBhxhListStats as any)?.stats?.bhxhList?.soPhaiNop?.value;
  const hrBhxhPayableValue = hrBhxhPayable != null ? formatNum(hrBhxhPayable) : t('dashboard.na');

  const hrPayrollTaxSum = (hrPayrollStats as any)?.stats?.payroll?.tax?.totalSum;
  const hrPayrollTaxValue = formatNum(hrPayrollTaxSum);

  const hrDailyWageGrandTotal = (hrDailyWageStats as any)?.stats?.dailyWage?.grandTotal;
  const hrDailyWageValue = formatNum(hrDailyWageGrandTotal);

  const hrArrearsAmount = (hrArrearsCollectionStats as any)?.stats?.arrearsCollection?.amountMax;
  const hrArrearsValue = formatNum(hrArrearsAmount);

  // Dữ liệu mẫu cho biểu đồ (sẽ thay bằng API khi có)
  const MOCK_CHART = [
    { name: 'BHXH', value: Number(hrBhxhPayable) || 0 },
    { name: 'Thuế TNCN', value: Number(hrPayrollTaxSum) || 0 },
    { name: 'Tiền công ngày', value: Number(hrDailyWageGrandTotal) || 0 },
    { name: 'Truy thu', value: Number(hrArrearsAmount) || 0 },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Báo cáo Kế toán — BHXH, Thuế TNCN, Tiền công, Truy thu. Số liệu từ file Excel đã upload tại Nhân sự (HR).
      </p>

      {/* Thẻ chỉ số Kế toán */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="BHXH phải nộp (Excel)"
          value={hrBhxhPayableValue}
          icon={Wallet}
          variant="warning"
        />
        <StatCard
          title="Thuế TNCN (Excel)"
          value={hrPayrollTaxValue}
          icon={Receipt}
          variant="primary"
        />
        <StatCard
          title="Tiền công ngày (tổng)"
          value={hrDailyWageValue}
          icon={Wallet}
          variant="success"
          description={
            (hrDailyWageStats as any)?.error === 'FILE_NOT_FOUND'
              ? 'File đã upload nhưng không tìm thấy trên server.'
              : hrDailyWageValue === t('dashboard.na')
                ? 'Upload file Tiền công hàng ngày tại Nhân sự (HR)'
                : undefined
          }
        />
        <StatCard
          title="Truy thu (tổng)"
          value={hrArrearsValue}
          icon={Wallet}
          variant="destructive"
          description={
            (hrArrearsCollectionStats as any)?.error === 'FILE_NOT_FOUND'
              ? 'File đã upload nhưng không tìm thấy trên server.'
              : hrArrearsValue === t('dashboard.na')
                ? 'Upload file Truy thu tại Nhân sự (HR) để hiển thị'
                : undefined
          }
        />
      </div>

      {/* Biểu đồ so sánh (chỉ khi có dữ liệu) */}
      {MOCK_CHART.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Phân bổ chi phí / nghĩa vụ tài chính</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MOCK_CHART}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => formatNumberPlain(v)} />
                  <Tooltip
                    formatter={(v: number) => formatNumberPlain(v)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="value" name="Số tiền" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {MOCK_CHART.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Chưa có dữ liệu. Upload file BHXH, Lương/Thuế, Tiền công hàng ngày, Truy thu tại Nhân sự (HR) để hiển thị.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

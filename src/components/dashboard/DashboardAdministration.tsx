import { useQuery } from '@tanstack/react-query';
import { Package, Stethoscope } from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { hrExcelAPI } from '@/services/api';
import { useI18n } from '@/contexts/I18nContext';
import { formatNumberPlain } from '@/lib/utils';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export interface DashboardAdministrationProps {
  filterMode?: 'day' | 'month' | 'year' | 'single' | 'range';
  selectedDate?: string | null;
  dateRange?: { start: string; end: string };
  baseDate?: string;
}

export const DashboardAdministration = ({ filterMode, selectedDate, dateRange, baseDate }: DashboardAdministrationProps) => {
  const { t } = useI18n();

  const formatNum = (v: any) => (Number.isFinite(Number(v)) ? formatNumberPlain(v) : t('dashboard.na'));

  const { data: hrDrugInventoryStats } = useQuery({
    queryKey: ['hrExcel', 'stats', 'drug-inventory'],
    queryFn: () => hrExcelAPI.getStats('drug-inventory'),
  });

  const { data: hrMedicalRoomUsageStats } = useQuery({
    queryKey: ['hrExcel', 'stats', 'medical-room-usage'],
    queryFn: () => hrExcelAPI.getStats('medical-room-usage'),
  });

  const hrDrugExportQty = (hrDrugInventoryStats as any)?.stats?.drugInventory?.exportQty;
  const hrDrugExportQtyValue = formatNum(hrDrugExportQty);

  const hrMedicalMoneySum = (hrMedicalRoomUsageStats as any)?.stats?.medicalRoomUsage?.money?.sum;
  const hrMedicalMoneyValue = formatNum(hrMedicalMoneySum);

  const chartData = [
    { name: 'Thuốc (xuất qty)', value: Number(hrDrugExportQty) || 0, color: '#3B82F6' },
    { name: 'Phòng y tế (tổng tiền)', value: Number(hrMedicalMoneySum) || 0, color: '#10B981' },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Báo cáo Hành chính — Thuốc, Phòng y tế. Số liệu từ file Excel đã upload tại Nhân sự (HR).
      </p>

      {/* Thẻ chỉ số Hành chính */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
        <StatCard
          title="Thuốc (xuất qty)"
          value={hrDrugExportQtyValue}
          icon={Package}
          variant="warning"
        />
        <StatCard
          title="Phòng y tế (tổng tiền)"
          value={hrMedicalMoneyValue}
          icon={Stethoscope}
          variant="info"
        />
      </div>

      {/* Biểu đồ tròn (chỉ khi có dữ liệu) */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Phân bổ Hành chính</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${typeof value === 'number' ? formatNumberPlain(value) : value}`}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatNumberPlain(v)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {chartData.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Chưa có dữ liệu. Upload file Xuất nhập tồn thuốc, Phòng y tế tại Nhân sự (HR) để hiển thị.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

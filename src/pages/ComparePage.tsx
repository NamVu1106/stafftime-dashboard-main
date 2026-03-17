import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitCompare, Download, Building2, Calendar } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { statisticsAPI } from '@/services/api';
import { useI18n } from '@/contexts/I18nContext';
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

const ComparePage = () => {
  const { t } = useI18n();
  const [compareType, setCompareType] = useState<'department' | 'period'>('department');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [periods, setPeriods] = useState<Array<{ start: string; end: string }>>([
    { start: '', end: '' },
    { start: '', end: '' },
  ]);

  const handleAddDepartment = () => {
    // Logic to add department
  };

  const handleAddPeriod = () => {
    setPeriods([...periods, { start: '', end: '' }]);
  };

  const handleCompare = () => {
    // Trigger comparison
  };

  // Mock data for comparison
  const comparisonData = [
    { name: t('reports.attendanceRate'), value1: 95.6, value2: 92.3, diff: 3.3 },
    { name: t('reports.workingHours'), value1: 1200, value2: 1150, diff: 50 },
    { name: t('reports.workingDays'), value1: 22, value2: 20, diff: 2 },
  ];

  const chartData = comparisonData.map(item => ({
    name: item.name,
    [t('reports.object1')]: item.value1,
    [t('reports.object2')]: item.value2,
  }));

  return (
    <div>
      <PageHeader 
        title={t('reports.compareTitle')} 
        description={t('reports.compareDescription')}
      />

      {/* Chọn đối tượng so sánh */}
      <div className="mb-6 p-4 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-2 mb-4">
          <GitCompare className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">{t('reports.selectComparisonObject')}</h3>
        </div>
        <div className="space-y-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="compare-type"
                value="department"
                checked={compareType === 'department'}
                onChange={() => setCompareType('department')}
                className="w-4 h-4"
              />
              <span className="text-sm">{t('reports.department')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="compare-type"
                value="period"
                checked={compareType === 'period'}
                onChange={() => setCompareType('period')}
                className="w-4 h-4"
              />
              <span className="text-sm">{t('reports.period')}</span>
            </label>
          </div>

          {compareType === 'department' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('reports.selectDepartment1')}</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder={t('employees.selectDepartment')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hg">{t('sidebar.hg')}</SelectItem>
                      <SelectItem value="prod">{t('sidebar.prod')}</SelectItem>
                      <SelectItem value="qc">{t('sidebar.qc')}</SelectItem>
                      <SelectItem value="cs">{t('sidebar.cs')}</SelectItem>
                      <SelectItem value="eqm">{t('sidebar.eqm')}</SelectItem>
                      <SelectItem value="sm">{t('sidebar.sm')}</SelectItem>
                      <SelectItem value="mm">{t('sidebar.mm')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('reports.selectDepartment2')}</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder={t('employees.selectDepartment')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hg">{t('sidebar.hg')}</SelectItem>
                      <SelectItem value="prod">{t('sidebar.prod')}</SelectItem>
                      <SelectItem value="qc">{t('sidebar.qc')}</SelectItem>
                      <SelectItem value="cs">{t('sidebar.cs')}</SelectItem>
                      <SelectItem value="eqm">{t('sidebar.eqm')}</SelectItem>
                      <SelectItem value="sm">{t('sidebar.sm')}</SelectItem>
                      <SelectItem value="mm">{t('sidebar.mm')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button variant="outline" onClick={handleAddDepartment}>
                ➕ {t('reports.addDepartment')}
              </Button>
            </div>
          )}

          {compareType === 'period' && (
            <div className="space-y-4">
              {periods.map((period, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('reports.periodLabel')} {index + 1} - {t('reports.fromDate')}</Label>
                    <Input
                      type="date"
                      value={period.start}
                      onChange={(e) => {
                        const newPeriods = [...periods];
                        newPeriods[index].start = e.target.value;
                        setPeriods(newPeriods);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('reports.periodLabel')} {index + 1} - {t('reports.toDate')}</Label>
                    <Input
                      type="date"
                      value={period.end}
                      onChange={(e) => {
                        const newPeriods = [...periods];
                        newPeriods[index].end = e.target.value;
                        setPeriods(newPeriods);
                      }}
                    />
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={handleAddPeriod}>
                ➕ {t('reports.addPeriod')}
              </Button>
            </div>
          )}

          <Button onClick={handleCompare} className="w-full md:w-auto">
            {t('reports.compare')}
          </Button>
        </div>
      </div>

      {/* Kết quả so sánh */}
      <div className="mb-6 p-4 bg-card border border-border rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">{t('reports.comparisonResults')}</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Biểu đồ so sánh */}
        <div className="mb-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={t('reports.object1')} fill="#3b82f6" />
              <Bar dataKey={t('reports.object2')} fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Bảng so sánh chi tiết */}
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-400px)] relative">
          <table className="w-full data-table">
            <thead className="sticky top-0 z-30 bg-muted">
              <tr className="border-b">
                <th className="text-left p-2 bg-muted" style={{ position: 'sticky', top: 0 }}>{t('reports.index')}</th>
                <th className="text-left p-2 bg-muted" style={{ position: 'sticky', top: 0 }}>{t('reports.object1')}</th>
                <th className="text-left p-2 bg-muted" style={{ position: 'sticky', top: 0 }}>{t('reports.object2')}</th>
                <th className="text-left p-2 bg-muted" style={{ position: 'sticky', top: 0 }}>{t('reports.difference')}</th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((item, index) => (
                <tr key={index} className="border-b hover:bg-muted/50">
                  <td className="p-2 font-medium">{item.name}</td>
                  <td className="p-2">{item.value1}</td>
                  <td className="p-2">{item.value2}</td>
                  <td className={`p-2 ${item.diff > 0 ? 'text-success' : 'text-destructive'}`}>
                    {item.diff > 0 ? '+' : ''}{item.diff}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ComparePage;


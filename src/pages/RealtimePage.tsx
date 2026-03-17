import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Clock, Users, Coffee, AlertCircle, XCircle, RefreshCw, Play, Pause } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { statisticsAPI } from '@/services/api';
import { useI18n } from '@/contexts/I18nContext';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
} from 'recharts';

const RealtimePage = () => {
  const { t } = useI18n();
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Fetch real-time data
  const { data: realtimeData, isLoading, refetch } = useQuery({
    queryKey: ['realtime', startTime, endTime],
    queryFn: () => statisticsAPI.getRealtime({ start_time: startTime, end_time: endTime }),
    refetchInterval: autoRefresh ? refreshInterval * 1000 : false,
    onSuccess: () => {
      setLastUpdate(new Date());
    },
  });

  // Format time for display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Mock chart data (sẽ được thay bằng data thực từ API)
  const chartData = realtimeData ? [
    { time: '08:00', count: realtimeData.current || 0 },
    { time: '09:00', count: realtimeData.current || 0 },
    { time: '10:00', count: realtimeData.current || 0 },
    { time: '11:00', count: realtimeData.current || 0 },
    { time: '12:00', count: realtimeData.current || 0 },
    { time: '13:00', count: realtimeData.current || 0 },
    { time: '14:00', count: realtimeData.current || 0 },
    { time: '15:00', count: realtimeData.current || 0 },
    { time: '16:00', count: realtimeData.current || 0 },
    { time: '17:00', count: realtimeData.current || 0 },
  ] : [];

  return (
    <div>
      <PageHeader 
        title={t('realtime.title')} 
        description={t('realtime.description')}
      />

      {/* Bộ lọc thời gian */}
      <div className="mb-6 p-4 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">{t('realtime.timeFilter')}</h3>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="start-time">{t('realtime.fromTime')}</Label>
            <Input
              id="start-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-32"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-time">{t('realtime.toTime')}</Label>
            <Input
              id="end-time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-32"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh" className="cursor-pointer">
              {t('realtime.autoRefresh')}
            </Label>
          </div>
          {autoRefresh && (
            <div className="space-y-2">
              <Label>{t('realtime.interval')}: {refreshInterval}s</Label>
              <Input
                type="number"
                min="10"
                max="300"
                step="10"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="w-20"
              />
            </div>
          )}
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {t('realtime.refresh')}
          </Button>
        </div>
      </div>

      {/* Thống kê số người đang làm việc */}
      <div className="mb-6 p-4 bg-card border border-border rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">{t('realtime.peopleWorking')}</h3>
          </div>
          <div className="text-sm text-muted-foreground">
            ⏰ {t('realtime.updatedAt')}: {formatTime(lastUpdate)}
          </div>
        </div>
        <div className="h-64">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name={t('realtime.peopleCount')}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="mt-4 text-center">
          <span className="text-3xl font-bold text-primary">
            {realtimeData?.current || 0}
          </span>
          <span className="text-muted-foreground ml-2">{t('realtime.people')}</span>
        </div>
      </div>

      {/* Thống kê nhanh */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-success" />
            <span className="text-sm text-muted-foreground">{t('realtime.working')}</span>
          </div>
          <div className="text-2xl font-bold">{realtimeData?.current || 0}</div>
        </div>
        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Coffee className="w-5 h-5 text-warning" />
            <span className="text-sm text-muted-foreground">{t('realtime.onBreak')}</span>
          </div>
          <div className="text-2xl font-bold">{realtimeData?.onBreak || 0}</div>
        </div>
        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-warning" />
            <span className="text-sm text-muted-foreground">{t('realtime.late')}</span>
          </div>
          <div className="text-2xl font-bold">{realtimeData?.late || 0}</div>
        </div>
        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-destructive" />
            <span className="text-sm text-muted-foreground">{t('realtime.absent')}</span>
          </div>
          <div className="text-2xl font-bold">{realtimeData?.absent || 0}</div>
        </div>
      </div>

      {/* Danh sách nhân viên đang làm việc */}
      <div className="p-4 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">{t('realtime.employeeList')}</h3>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-400px)] relative">
            <table className="w-full data-table">
              <thead className="sticky top-0 z-30 bg-muted">
                <tr className="border-b">
                  <th className="text-left p-2 bg-muted" style={{ position: 'sticky', top: 0 }}>{t('dashboard.employeeCode')}</th>
                  <th className="text-left p-2 bg-muted" style={{ position: 'sticky', top: 0 }}>{t('realtime.name')}</th>
                  <th className="text-left p-2 bg-muted" style={{ position: 'sticky', top: 0 }}>{t('dashboard.department')}</th>
                  <th className="text-left p-2 bg-muted" style={{ position: 'sticky', top: 0 }}>{t('realtime.status')}</th>
                </tr>
              </thead>
              <tbody>
                {realtimeData?.employees && realtimeData.employees.length > 0 ? (
                  realtimeData.employees.map((emp: any, index: number) => (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      <td className="p-2">{emp.code || t('dashboard.na')}</td>
                      <td className="p-2">{emp.name || t('dashboard.na')}</td>
                      <td className="p-2">{emp.department || t('dashboard.na')}</td>
                      <td className="p-2">
                        <span className="px-2 py-1 rounded-full text-xs bg-success/10 text-success">
                          {t('realtime.workingStatus')}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center p-8 text-muted-foreground">
                      {t('realtime.noData')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RealtimePage;




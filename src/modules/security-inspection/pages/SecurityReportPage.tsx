import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2, BarChart3, FileSpreadsheet } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { useI18n } from '@/hooks/useI18n';
import { useAuth } from '@/contexts/AuthContext';
import { securityInspectionAPI } from '../api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ChecksheetObjectivesStrip } from '../components/ChecksheetObjectivesStrip';
import { ReportCriticalAlerts } from '../components/ReportCriticalAlerts';
import { ReportFailureHistory } from '../components/ReportFailureHistory';

const PIE_COLORS: Record<string, string> = {
  pass: '#16a34a',
  fail: '#dc2626',
  skip: '#94a3b8',
};

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function SecurityReportPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [range, setRange] = useState(defaultRange);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['security-report-dashboard', range.from, range.to],
    queryFn: () =>
      securityInspectionAPI.getManagementDashboard({
        from: range.from,
        to: range.to,
      }),
  });

  const onExport = async () => {
    setExporting(true);
    try {
      await securityInspectionAPI.exportReport(range.from, range.to);
      toast.success(t('securityInspection.exportOk'));
    } catch (e: unknown) {
      toast.error((e as Error).message || t('securityInspection.exportFail'));
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border-2 border-red-200 bg-red-50 p-6 text-center">
        <p className="font-semibold text-red-800">{t('securityInspection.reportError')}</p>
        <button
          type="button"
          className="sec-touch-btn mt-4 min-h-12 rounded-xl bg-slate-800 px-6 font-bold text-white"
          onClick={() => navigate('/security')}
        >
          {t('securityInspection.back')}
        </button>
      </div>
    );
  }

  const pieData = data.statusPie.map((s) => ({
    ...s,
    label:
      s.name === 'pass'
        ? t('securityInspection.pass')
        : s.name === 'fail'
          ? t('securityInspection.fail')
          : t('securityInspection.skip'),
  }));

  const isManagerScope = user?.role === 'manager' && data.scope === 'departments';

  const dateControls = (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border-2 border-slate-200 bg-white p-4">
      <div>
        <label className="text-xs font-bold text-slate-600">{t('securityInspection.dateFrom')}</label>
        <Input
          type="date"
          className="mt-1 min-h-11"
          value={range.from}
          onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
        />
      </div>
      <div>
        <label className="text-xs font-bold text-slate-600">{t('securityInspection.dateTo')}</label>
        <Input
          type="date"
          className="mt-1 min-h-11"
          value={range.to}
          onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
        />
      </div>
      <Button
        type="button"
        className="min-h-11 font-semibold"
        disabled={isFetching}
        onClick={() => refetch()}
      >
        {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : t('securityInspection.applyRange')}
      </Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-emerald-700">
            <BarChart3 className="h-6 w-6" />
            <span className="text-xs font-bold uppercase tracking-wider">
              {t('securityInspection.reportAdmin')}
            </span>
          </div>
          <h1 className="text-2xl font-bold">{t('securityInspection.reportTitle')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('securityInspection.reportSubtitle')}</p>
          {isManagerScope && (
            <p className="mt-1 text-sm font-semibold text-amber-800">
              {t('securityInspection.managerScopeHint')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="sec-touch-btn min-h-12 rounded-xl border-2 border-slate-300 px-4 font-semibold"
            onClick={() => navigate('/security')}
          >
            {t('securityInspection.backToField')}
          </button>
          <Button
            type="button"
            className="sec-touch-btn min-h-12 gap-2 font-bold"
            disabled={exporting}
            onClick={onExport}
          >
            {exporting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-5 w-5" />
            )}
            {t('securityInspection.exportExcel')}
          </Button>
        </div>
      </div>

      <ChecksheetObjectivesStrip />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 lg:col-span-1">
          <p className="text-xs font-bold uppercase text-emerald-800">
            {t('securityInspection.tabProgress')}
          </p>
          <p className="mt-1 text-4xl font-bold text-emerald-900">
            {data.totals.progressPercent}%
          </p>
          <p className="text-xs text-emerald-800">{t('securityInspection.progressKpiHint')}</p>
        </div>
        {[
          { label: t('securityInspection.totalMachines'), value: data.totals.machines },
          { label: t('securityInspection.checked'), value: data.totals.checked },
          { label: t('securityInspection.openAlertsKpi'), value: data.totals.openAlerts },
          { label: t('securityInspection.failuresFound'), value: data.totals.failures },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">{kpi.label}</p>
            <p
              className={cn(
                'mt-1 text-3xl font-bold tabular-nums',
                kpi.label === t('securityInspection.openAlertsKpi') && kpi.value > 0
                  ? 'text-red-600'
                  : ''
              )}
            >
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {dateControls}

      <Tabs defaultValue="progress" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-slate-200 p-1 lg:grid-cols-4">
          <TabsTrigger value="progress" className="min-h-11 font-bold">
            {t('securityInspection.tabProgress')}
          </TabsTrigger>
          <TabsTrigger value="alerts" className="min-h-11 font-bold">
            {t('securityInspection.tabAlerts')}
            {data.totals.openAlerts > 0 && (
              <span className="ml-1 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">
                {data.totals.openAlerts}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="min-h-11 font-bold">
            {t('securityInspection.tabHistory')}
          </TabsTrigger>
          <TabsTrigger value="summary" className="min-h-11 font-bold">
            {t('securityInspection.tabSummary')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="space-y-4">
          <p className="text-sm text-slate-600">{t('securityInspection.tabProgressDesc')}</p>
          <div className="overflow-x-auto rounded-xl border-2 border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b-2 border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-bold">{t('securityInspection.colDept')}</th>
                  <th className="px-4 py-3 font-bold text-right">{t('securityInspection.colProgress')}</th>
                  <th className="px-4 py-3 font-bold text-right">{t('securityInspection.colTotal')}</th>
                  <th className="px-4 py-3 font-bold text-right">{t('securityInspection.colChecked')}</th>
                  <th className="px-4 py-3 font-bold text-right">{t('securityInspection.colUnchecked')}</th>
                  <th className="px-4 py-3 font-bold text-right">{t('securityInspection.colFails')}</th>
                </tr>
              </thead>
              <tbody>
                {data.departments.map((row) => (
                  <tr key={row.department_id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-semibold">
                      <span
                        className="mr-2 inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: row.color }}
                      />
                      {row.department_name}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={cn(
                          'font-bold tabular-nums',
                          row.progress_percent < 50 ? 'text-amber-700' : 'text-emerald-700'
                        )}
                      >
                        {row.progress_percent}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.total_machines}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                      {row.checked_count}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-700">
                      {row.unchecked_count}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-3 text-right tabular-nums font-bold',
                        row.fail_count > 0 ? 'text-red-600' : 'text-slate-500'
                      )}
                    >
                      {row.fail_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="alerts">
          <p className="mb-3 text-sm text-slate-600">{t('securityInspection.tabAlertsDesc')}</p>
          <ReportCriticalAlerts from={range.from} to={range.to} />
        </TabsContent>

        <TabsContent value="history">
          <p className="mb-3 text-sm text-slate-600">{t('securityInspection.tabHistoryDesc')}</p>
          <ReportFailureHistory from={range.from} to={range.to} />
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <p className="text-sm text-slate-600">{t('securityInspection.tabSummaryDesc')}</p>
          <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">{t('securityInspection.pieTitle')}</h2>
            {pieData.length === 0 ? (
              <p className="py-12 text-center text-slate-500">{t('securityInspection.reportEmpty')}</p>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={PIE_COLORS[entry.name] ?? '#64748b'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

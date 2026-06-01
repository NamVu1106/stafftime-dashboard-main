import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2, BarChart3 } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { useI18n } from '@/hooks/useI18n';
import { securityInspectionAPI } from '../api';
import { cn } from '@/lib/utils';

const PIE_COLORS: Record<string, string> = {
  pass: '#16a34a',
  fail: '#dc2626',
  skip: '#94a3b8',
};

export default function SecurityReportPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['security-report-dashboard'],
    queryFn: () => securityInspectionAPI.getManagementDashboard(),
  });

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

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-emerald-700">
            <BarChart3 className="h-6 w-6" />
            <span className="text-xs font-bold uppercase tracking-wider">
              {t('securityInspection.reportAdmin')}
            </span>
          </div>
          <h1 className="text-2xl font-bold">{t('securityInspection.reportTitle')}</h1>
          <p className="text-sm font-medium text-slate-600">
            {t('securityInspection.reportDate')}: {data.date}
          </p>
        </div>
        <button
          type="button"
          className="sec-touch-btn min-h-12 rounded-xl border-2 border-slate-300 px-4 font-semibold"
          onClick={() => navigate('/security')}
        >
          {t('securityInspection.backToField')}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: t('securityInspection.totalMachines'), value: data.totals.machines },
          { label: t('securityInspection.checked'), value: data.totals.checked },
          { label: t('securityInspection.unchecked'), value: data.totals.unchecked },
          { label: t('securityInspection.failuresFound'), value: data.totals.failures },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">{kpi.label}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-xl border-2 border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b-2 border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-bold">{t('securityInspection.colDept')}</th>
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
                      <Cell
                        key={entry.name}
                        fill={PIE_COLORS[entry.name] ?? '#64748b'}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

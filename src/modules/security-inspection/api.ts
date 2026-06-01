const API_URL = import.meta.env.VITE_API_URL || '/api';

function authHeaders(): HeadersInit {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function secFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/security-inspection${path}`, {
    ...options,
    headers: { ...authHeaders(), ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

import type { DepartmentTemplate, ResolvedAsset, SecurityDepartment } from './types';

export const securityInspectionAPI = {
  getDepartments: () => secFetch<{ data: SecurityDepartment[] }>('/departments'),
  getTemplate: (deptId: number) =>
    secFetch<DepartmentTemplate>(`/departments/${deptId}/template`),
  resolveQr: (qr: string) =>
    secFetch<ResolvedAsset>(`/assets/resolve?qr=${encodeURIComponent(qr)}`),
  saveDraft: (body: unknown) =>
    secFetch<{ ok: boolean; id: number }>('/inspections', {
      method: 'POST',
      body: JSON.stringify({ ...(body as object), status: 'draft' }),
    }),
  submit: (body: unknown) =>
    secFetch<{ ok: boolean; id: number }>('/inspections/submit', {
      method: 'POST',
      body: JSON.stringify({ ...(body as object), status: 'submitted' }),
    }),
  syncBatch: (inspections: unknown[]) =>
    secFetch<{ ok: boolean; synced: number }>('/sync', {
      method: 'POST',
      body: JSON.stringify({ inspections }),
    }),
  getManagementDashboard: (params?: { from?: string; to?: string }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    const qs = q.toString();
    return secFetch<{
      from: string;
      to: string;
      scope: string;
      departmentIds: number[];
      departments: {
        department_id: number;
        department_name: string;
        color: string;
        total_machines: number;
        checked_count: number;
        unchecked_count: number;
        fail_count: number;
      }[];
      statusPie: { name: string; value: number }[];
      totals: { machines: number; checked: number; unchecked: number; failures: number };
    }>(`/reports/dashboard${qs ? `?${qs}` : ''}`);
  },
  exportReport: async (from: string, to: string) => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    const q = new URLSearchParams({ from, to });
    const res = await fetch(
      `${API_URL}/security-inspection/reports/export?${q}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || res.statusText);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao-an-ninh_${from}_${to}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

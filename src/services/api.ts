// Use environment variable if set, otherwise use relative path for production
// or localhost for development
const API_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === 'production' ? '/api' : 'http://localhost:3000/api');

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}

export const authAPI = {
  login: async (username: string, password: string) => {
    return request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
};

export const statisticsAPI = {
  getDashboard: async (params?: { date?: string; start_date?: string; end_date?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.date) queryParams.append('date', params.date);
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    return request(`/statistics/dashboard?${queryParams.toString()}`);
  },
  getGender: async () => {
    return request('/statistics/gender');
  },
  getAge: async () => {
    return request('/statistics/age');
  },
  getEmploymentType: async () => {
    return request('/statistics/employment-type');
  },
  getDepartment: async (params?: { date?: string; start_date?: string; end_date?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.date) queryParams.append('date', params.date);
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    return request(`/statistics/department?${queryParams.toString()}`);
  },
  getGenderByEmploymentType: async () => {
    return request('/statistics/gender-by-employment-type');
  },
  getAttendanceByDate: async (days: number = 7) => {
    return request(`/statistics/attendance-by-date?days=${days}`);
  },
  getRealtime: async (params: { start_time?: string; end_time?: string }) => {
    const queryParams = new URLSearchParams();
    if (params.start_time) queryParams.append('start_time', params.start_time);
    if (params.end_time) queryParams.append('end_time', params.end_time);
    return request(`/statistics/realtime?${queryParams.toString()}`);
  },
  getRange: async (params: { start_date: string; end_date: string; department?: string }) => {
    const queryParams = new URLSearchParams();
    queryParams.append('start_date', params.start_date);
    queryParams.append('end_date', params.end_date);
    if (params.department) queryParams.append('department', params.department);
    return request(`/statistics/range?${queryParams.toString()}`);
  },
  getCompare: async (params: { type: 'department' | 'period'; ids?: string; periods?: string }) => {
    const queryParams = new URLSearchParams();
    queryParams.append('type', params.type);
    if (params.ids) queryParams.append('ids', params.ids);
    if (params.periods) queryParams.append('periods', params.periods);
    return request(`/statistics/compare?${queryParams.toString()}`);
  },
  getDepartmentStats: async (dept: string, params?: { date?: string; start_date?: string; end_date?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.date) queryParams.append('date', params.date);
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    return request(`/departments/${dept}/stats?${queryParams.toString()}`);
  },
};

export const timekeepingAPI = {
  getAll: async (params?: { start_date?: string; end_date?: string; department?: string; search?: string; page?: number; limit?: number; archived?: boolean }) => {
    const queryParams = new URLSearchParams();
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    if (params?.department) queryParams.append('department', params.department);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.archived !== undefined) queryParams.append('archived', params.archived ? 'true' : 'false');
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    return request(`/timekeeping?${queryParams.toString()}`);
  },
};

export const employeesAPI = {
  getAll: async () => {
    return request('/employees');
  },
  getById: async (id: string) => {
    return request(`/employees/${id}`);
  },
  create: async (data: any) => {
    return request('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  update: async (id: string, data: any) => {
    return request(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  delete: async (id: string) => {
    return request(`/employees/${id}`, {
      method: 'DELETE',
    });
  },
};

export const notificationsAPI = {
  getAll: async (params?: { limit?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    return request(`/notifications?${queryParams.toString()}`);
  },
  getUnreadCount: async () => {
    return request('/notifications/unread-count');
  },
  markAsRead: async (id: number) => {
    return request(`/notifications/${id}/read`, {
      method: 'PUT',
    });
  },
  markAllAsRead: async () => {
    return request('/notifications/read-all', {
      method: 'PUT',
    });
  },
  delete: async (id: number) => {
    return request(`/notifications/${id}`, {
      method: 'DELETE',
    });
  },
  deleteAll: async () => {
    return request('/notifications', {
      method: 'DELETE',
    });
  },
};

export const uploadAPI = {
  uploadEmployees: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/upload/employees`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  },
  uploadTimekeeping: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/upload/timekeeping`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  },
};


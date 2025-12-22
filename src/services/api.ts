// Use relative path in production, absolute in development
const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api');

// Get auth token from sessionStorage (automatically clears when browser closes)
const getAuthToken = () => {
  return sessionStorage.getItem('token');
};

// API request helper
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }
  
  return response.json();
};

// Employees API
export const employeesAPI = {
  getAll: (params?: { search?: string; department?: string; employment_type?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.department) queryParams.append('department', params.department);
    if (params?.employment_type) queryParams.append('employment_type', params.employment_type);
    
    const query = queryParams.toString();
    return apiRequest(`/employees${query ? `?${query}` : ''}`);
  },
  
  getById: (id: number) => apiRequest(`/employees/${id}`),
  
  create: (data: any) => apiRequest('/employees', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  update: (id: number, data: any) => apiRequest(`/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  delete: (id: number) => apiRequest(`/employees/${id}`, {
    method: 'DELETE',
  }),

  // Delete all employees
  deleteAll: () => apiRequest('/employees', {
    method: 'DELETE',
  }),
};

// Timekeeping API
export const timekeepingAPI = {
  getAll: (params?: { date?: string; start_date?: string; end_date?: string; department?: string; employee_code?: string; archived?: boolean }) => {
    const queryParams = new URLSearchParams();
    if (params?.date) queryParams.append('date', params.date);
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    if (params?.department) queryParams.append('department', params.department);
    if (params?.employee_code) queryParams.append('employee_code', params.employee_code);
    if (params?.archived !== undefined) queryParams.append('archived', params.archived.toString());
    
    const query = queryParams.toString();
    return apiRequest(`/timekeeping${query ? `?${query}` : ''}`);
  },
  
  getById: (id: number) => apiRequest(`/timekeeping/${id}`),
  
  create: (data: any) => apiRequest('/timekeeping', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  update: (id: number, data: any) => apiRequest(`/timekeeping/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  delete: (id: number) => apiRequest(`/timekeeping/${id}`, {
    method: 'DELETE',
  }),
  deleteAll: () => apiRequest('/timekeeping', { method: 'DELETE' }), // Delete all records
  deleteAllArchived: () => apiRequest('/timekeeping/archived', { method: 'DELETE' }), // Delete all archived records
  fixArchiveStatus: () => apiRequest('/timekeeping/fix-archive', { method: 'POST' }), // Fix archive status for existing data
};

// Statistics API
export const statisticsAPI = {
  getDashboard: (params?: { date?: string; start_date?: string; end_date?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.date) queryParams.append('date', params.date);
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    const query = queryParams.toString();
    return apiRequest(`/statistics/dashboard${query ? `?${query}` : ''}`);
  },
  
  getGender: () => apiRequest('/statistics/gender'),
  
  getAge: () => apiRequest('/statistics/age'),
  
  getEmploymentType: () => apiRequest('/statistics/employment-type'),
  
  getDepartment: (params?: { date?: string; start_date?: string; end_date?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.date) queryParams.append('date', params.date);
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    const query = queryParams.toString();
    return apiRequest(`/statistics/department${query ? `?${query}` : ''}`);
  },
  
  getGenderByEmploymentType: () => apiRequest('/statistics/gender-by-employment-type'),
  
  getAttendanceByDate: (days?: number) => {
    const query = days ? `?days=${days}` : '';
    return apiRequest(`/statistics/attendance-by-date${query}`);
  },
};

// Upload API
export const uploadAPI = {
  uploadEmployees: async (file: File) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_URL}/upload/employees`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },
  
  uploadTimekeeping: async (file: File) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_URL}/upload/timekeeping`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },
  
  uploadAvatar: async (file: File) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('avatar', file);
    
    const response = await fetch(`${API_URL}/upload/avatar`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },
};

// Notifications API
export const notificationsAPI = {
  getAll: (params?: { unread_only?: boolean; limit?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.unread_only) queryParams.append('unread_only', 'true');
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const query = queryParams.toString();
    return apiRequest(`/notifications${query ? `?${query}` : ''}`);
  },
  
  getUnreadCount: () => apiRequest('/notifications/unread-count'),
  
  markAsRead: (id: number) => apiRequest(`/notifications/${id}/read`, {
    method: 'PUT',
  }),
  
  markAllAsRead: () => apiRequest('/notifications/read-all', {
    method: 'PUT',
  }),
  
  delete: (id: number) => apiRequest(`/notifications/${id}`, {
    method: 'DELETE',
  }),
  
  deleteAll: () => apiRequest('/notifications', {
    method: 'DELETE',
  }),
};


// Type definitions for backend

export interface EmployeeCreateInput {
  employee_code: string;
  name: string;
  gender: 'Nam' | 'Nữ';
  date_of_birth: string;
  department: string;
  employment_type: 'Chính thức' | 'Thời vụ';
  cccd?: string;
  hometown?: string;
  permanent_residence?: string;
  temporary_residence?: string;
  marital_status?: 'Độc thân' | 'Đã kết hôn' | 'Ly hôn' | 'Góa';
  phone?: string;
  avatar_url?: string;
  family_relations?: FamilyMemberInput[];
}

export interface FamilyMemberInput {
  relation: string;
  name: string;
  occupation: string;
}

export interface TimekeepingCreateInput {
  employee_code: string;
  employee_id?: number;
  employee_name: string;
  date: string;
  day_of_week: string;
  check_in: string;
  check_out: string;
  late_minutes?: number;
  early_minutes?: number;
  workday: number;
  total_hours: number;
  overtime_hours?: number;
  total_all_hours: number;
  shift: 'CA NGAY' | 'CA DEM' | '***';
  department: string;
}



export interface FamilyMember {
  relation: string; // Quan hệ: Vợ, Chồng, Con, Bố, Mẹ, etc.
  name: string;
  occupation: string; // Nghề nghiệp
}

export interface Employee {
  id: number;
  employee_code: string;
  name: string;
  gender: 'Nam' | 'Nữ';
  date_of_birth: string;
  age: number;
  department: string;
  employment_type: 'Chính thức' | 'Thời vụ';
  // Thông tin mở rộng
  cccd?: string; // Căn cước công dân
  hometown?: string; // Quê quán
  permanent_residence?: string; // HKTT - Hộ khẩu thường trú
  temporary_residence?: string; // ĐKTT - Đăng ký tạm trú
  marital_status?: 'Độc thân' | 'Đã kết hôn' | 'Ly hôn' | 'Góa';
  family_relations?: FamilyMember[]; // Quan hệ gia đình + nghề nghiệp
  phone?: string; // SĐT liên lạc
  avatar?: string; // URL ảnh chân dung
  created_at: string;
}

export interface TimekeepingRecord {
  id: number;
  employee_code: string;
  employee_name: string;
  date: string;
  day_of_week: string;
  check_in: string;
  check_out: string;
  late_minutes: number;
  early_minutes: number;
  workday: number;
  total_hours: number;
  overtime_hours: number;
  total_all_hours: number;
  shift: 'CA NGAY' | 'CA DEM' | '***';
  department: string;
}

// Types + empty placeholders; real data comes from API
export const mockEmployees: Employee[] = [];
export const mockTimekeeping: TimekeepingRecord[] = [];

// Departments will be fetched from API data
export const departments: string[] = []; // Empty - will be populated from API

// Calculate dashboard stats
export const calculateStats = (employees: Employee[], timekeeping: TimekeepingRecord[], targetDate?: string) => {
  const date = targetDate || new Date().toISOString().split('T')[0];
  const dayRecords = timekeeping.filter(r => r.date === date);
  
  const totalEmployees = employees.length;
  const attendanceToday = dayRecords.length;
  const attendanceRate = totalEmployees > 0 ? ((attendanceToday / totalEmployees) * 100).toFixed(1) : '0';
  const lateToday = dayRecords.filter(r => r.late_minutes > 0).length;
  const totalHoursToday = dayRecords.reduce((sum, r) => sum + r.total_hours, 0).toFixed(1);
  
  // Calculate attendance rate by employment type
  const chinhThucEmployees = employees.filter(e => e.employment_type === 'Chính thức');
  const thoiVuEmployees = employees.filter(e => e.employment_type === 'Thời vụ');
  
  const chinhThucCodes = new Set(chinhThucEmployees.map(e => e.employee_code));
  const thoiVuCodes = new Set(thoiVuEmployees.map(e => e.employee_code));
  
  const chinhThucAttendance = dayRecords.filter(r => chinhThucCodes.has(r.employee_code)).length;
  const thoiVuAttendance = dayRecords.filter(r => thoiVuCodes.has(r.employee_code)).length;
  
  const chinhThucRate = chinhThucEmployees.length > 0 
    ? ((chinhThucAttendance / chinhThucEmployees.length) * 100).toFixed(1) 
    : '0';
  const thoiVuRate = thoiVuEmployees.length > 0 
    ? ((thoiVuAttendance / thoiVuEmployees.length) * 100).toFixed(1) 
    : '0';
  
  return {
    totalEmployees,
    attendanceRate,
    lateToday,
    totalHoursToday,
    chinhThucRate,
    thoiVuRate,
  };
};

// Gender distribution
export const calculateGenderStats = (employees: Employee[]) => {
  const male = employees.filter(e => e.gender === 'Nam').length;
  const female = employees.filter(e => e.gender === 'Nữ').length;
  return [
    { name: 'Nam', value: male, color: '#3B82F6' },
    { name: 'Nữ', value: female, color: '#EC4899' },
  ];
};

// Age distribution - Updated theo yêu cầu: 18-30, 30-40, 40-50, 50+
export const calculateAgeStats = (employees: Employee[]) => {
  const groups = [
    { range: '18-30', min: 18, max: 30, count: 0, color: '#3B82F6' },
    { range: '30-40', min: 30, max: 40, count: 0, color: '#10B981' },
    { range: '40-50', min: 40, max: 50, count: 0, color: '#F59E0B' },
    { range: '50+', min: 50, max: 100, count: 0, color: '#EF4444' },
  ];
  
  employees.forEach(emp => {
    const group = groups.find(g => emp.age >= g.min && emp.age <= g.max);
    if (group) group.count++;
  });
  
  return groups.map(g => ({ name: g.range, value: g.count, color: g.color }));
};

// Attendance by date (last 7 days)
export const calculateAttendanceByDate = (employees: Employee[], timekeeping: TimekeepingRecord[]) => {
  const result: Array<{ date: string; dayShift: number; nightShift: number; rate: number }> = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayLabel = `${date.getDate()}/${date.getMonth() + 1}`;
    
    const dayRecords = timekeeping.filter(r => r.date === dateStr);
    const dayShift = dayRecords.filter(r => r.shift === 'CA NGAY').length;
    const nightShift = dayRecords.filter(r => r.shift === 'CA DEM').length;
    const rate = employees.length > 0 ? ((dayRecords.length / employees.length) * 100) : 0;
    
    result.push({
      date: dayLabel,
      dayShift,
      nightShift,
      rate: parseFloat(rate.toFixed(1)),
    });
  }
  
  return result;
};

// Attendance by department
export const calculateAttendanceByDepartment = (timekeeping: TimekeepingRecord[], targetDate?: string) => {
  const date = targetDate || new Date().toISOString().split('T')[0];
  const dayRecords = timekeeping.filter(r => r.date === date);
  
  return departments.map(dept => {
    const deptRecords = dayRecords.filter(r => r.department === dept);
    const dayShift = deptRecords.filter(r => r.shift === 'CA NGAY').length;
    const nightShift = deptRecords.filter(r => r.shift === 'CA DEM').length;
    
    return {
      department: dept,
      dayShift,
      nightShift,
      total: deptRecords.length,
    };
  });
};

// Employment type distribution (Chính thức - Thời vụ)
export const calculateEmploymentTypeStats = (employees: Employee[]) => {
  const chinhThuc = employees.filter(e => e.employment_type === 'Chính thức').length;
  const thoiVu = employees.filter(e => e.employment_type === 'Thời vụ').length;
  return [
    { name: 'Chính thức', value: chinhThuc, color: '#10B981' },
    { name: 'Thời vụ', value: thoiVu, color: '#F59E0B' },
  ];
};

// Attendance rate by department (tỷ lệ đi làm các bộ phận)
export const calculateAttendanceRateByDepartment = (employees: Employee[], timekeeping: TimekeepingRecord[], targetDate?: string) => {
  const date = targetDate || new Date().toISOString().split('T')[0];
  const dayRecords = timekeeping.filter(r => r.date === date);
  
  return departments.map(dept => {
    const deptEmployees = employees.filter(e => e.department === dept);
    const deptRecords = dayRecords.filter(r => r.department === dept);
    const attendanceRate = deptEmployees.length > 0 
      ? ((deptRecords.length / deptEmployees.length) * 100).toFixed(1)
      : '0';
    
    return {
      department: dept,
      totalEmployees: deptEmployees.length,
      attendance: deptRecords.length,
      attendanceRate: parseFloat(attendanceRate),
    };
  });
};

// Gender distribution by employment type (Tỷ lệ Nam/Nữ theo Chính thức/Thời vụ)
export const calculateGenderByEmploymentType = (employees: Employee[]) => {
  const chinhThuc = employees.filter(e => e.employment_type === 'Chính thức');
  const thoiVu = employees.filter(e => e.employment_type === 'Thời vụ');
  
  const chinhThucNam = chinhThuc.filter(e => e.gender === 'Nam').length;
  const chinhThucNu = chinhThuc.filter(e => e.gender === 'Nữ').length;
  const thoiVuNam = thoiVu.filter(e => e.gender === 'Nam').length;
  const thoiVuNu = thoiVu.filter(e => e.gender === 'Nữ').length;
  
  const chinhThucTotal = chinhThuc.length;
  const thoiVuTotal = thoiVu.length;
  
  return {
    chinhThucNam: {
      count: chinhThucNam,
      percent: chinhThucTotal > 0 ? ((chinhThucNam / chinhThucTotal) * 100).toFixed(1) : '0'
    },
    chinhThucNu: {
      count: chinhThucNu,
      percent: chinhThucTotal > 0 ? ((chinhThucNu / chinhThucTotal) * 100).toFixed(1) : '0'
    },
    thoiVuNam: {
      count: thoiVuNam,
      percent: thoiVuTotal > 0 ? ((thoiVuNam / thoiVuTotal) * 100).toFixed(1) : '0'
    },
    thoiVuNu: {
      count: thoiVuNu,
      percent: thoiVuTotal > 0 ? ((thoiVuNu / thoiVuTotal) * 100).toFixed(1) : '0'
    }
  };
};

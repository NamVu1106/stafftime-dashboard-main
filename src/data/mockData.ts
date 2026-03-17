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

// Mock data removed - using real API data now
// Keep this file only for type definitions
export const mockEmployees: Employee[] = []; // Empty - use API instead
  { 
    id: 1, employee_code: "23046559HG", name: "Phạm Mạnh Cường", gender: "Nam", date_of_birth: "1990-05-15", age: 34, 
    department: "VPQL", employment_type: "Chính thức", 
    cccd: "001199000123", hometown: "Hà Nội", permanent_residence: "123 Nguyễn Trãi, Thanh Xuân, Hà Nội",
    temporary_residence: "123 Nguyễn Trãi, Thanh Xuân, Hà Nội", marital_status: "Đã kết hôn",
    family_relations: [{ relation: "Vợ", name: "Nguyễn Thị Lan", occupation: "Giáo viên" }, { relation: "Con", name: "Phạm Minh Anh", occupation: "Học sinh" }],
    phone: "0912345678", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=PhamManhCuong",
    created_at: "2023-01-15" 
  },
  { 
    id: 2, employee_code: "17030560HG", name: "Phạm Thị Nhung", gender: "Nữ", date_of_birth: "1995-08-20", age: 29, 
    department: "VPQL", employment_type: "Chính thức",
    cccd: "001199500456", hometown: "Hải Phòng", permanent_residence: "456 Lê Lợi, Hồng Bàng, Hải Phòng",
    temporary_residence: "456 Lê Lợi, Hồng Bàng, Hải Phòng", marital_status: "Độc thân",
    family_relations: [{ relation: "Bố", name: "Phạm Văn A", occupation: "Công nhân" }, { relation: "Mẹ", name: "Trần Thị B", occupation: "Nội trợ" }],
    phone: "0923456789", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=PhamThiNhung",
    created_at: "2017-03-20" 
  },
  { 
    id: 3, employee_code: "19045123HG", name: "Nguyễn Văn Hùng", gender: "Nam", date_of_birth: "1988-03-10", age: 36, 
    department: "Sản xuất", employment_type: "Chính thức",
    cccd: "001198800789", hometown: "Nam Định", permanent_residence: "789 Trần Hưng Đạo, Nam Định",
    temporary_residence: "789 Trần Hưng Đạo, Nam Định", marital_status: "Đã kết hôn",
    family_relations: [{ relation: "Vợ", name: "Lê Thị Hoa", occupation: "Y tá" }],
    phone: "0934567890", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=NguyenVanHung",
    created_at: "2019-04-10" 
  },
  { 
    id: 4, employee_code: "20031245HG", name: "Trần Thị Mai", gender: "Nữ", date_of_birth: "1992-11-25", age: 32, 
    department: "Sản xuất", employment_type: "Thời vụ",
    cccd: "001199200234", hometown: "Thái Bình", permanent_residence: "234 Quang Trung, Thái Bình",
    temporary_residence: "234 Quang Trung, Thái Bình", marital_status: "Đã kết hôn",
    family_relations: [{ relation: "Chồng", name: "Hoàng Văn B", occupation: "Lái xe" }, { relation: "Con", name: "Hoàng Thị C", occupation: "Học sinh" }],
    phone: "0945678901", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=TranThiMai",
    created_at: "2020-03-25" 
  },
  { 
    id: 5, employee_code: "21056789HG", name: "Lê Hoàng Nam", gender: "Nam", date_of_birth: "1985-07-08", age: 39, 
    department: "Kinh doanh", employment_type: "Chính thức",
    cccd: "001198500567", hometown: "Hà Nội", permanent_residence: "567 Hoàng Hoa Thám, Ba Đình, Hà Nội",
    temporary_residence: "567 Hoàng Hoa Thám, Ba Đình, Hà Nội", marital_status: "Đã kết hôn",
    family_relations: [{ relation: "Vợ", name: "Võ Thị D", occupation: "Kế toán" }, { relation: "Con", name: "Lê Hoàng E", occupation: "Sinh viên" }],
    phone: "0956789012", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=LeHoangNam",
    created_at: "2021-05-08" 
  },
  { 
    id: 6, employee_code: "18042367HG", name: "Võ Thị Hoa", gender: "Nữ", date_of_birth: "1998-02-14", age: 26, 
    department: "Kinh doanh", employment_type: "Thời vụ",
    cccd: "001199800890", hometown: "Đà Nẵng", permanent_residence: "890 Nguyễn Văn Linh, Đà Nẵng",
    temporary_residence: "890 Nguyễn Văn Linh, Đà Nẵng", marital_status: "Độc thân",
    family_relations: [{ relation: "Bố", name: "Võ Văn F", occupation: "Nông dân" }, { relation: "Mẹ", name: "Phạm Thị G", occupation: "Nông dân" }],
    phone: "0967890123", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=VoThiHoa",
    created_at: "2018-04-14" 
  },
  { 
    id: 7, employee_code: "22034567HG", name: "Hoàng Văn Đức", gender: "Nam", date_of_birth: "1975-09-30", age: 49, 
    department: "VPQL", employment_type: "Chính thức",
    cccd: "001197500123", hometown: "Hà Nội", permanent_residence: "123 Phạm Văn Đồng, Cầu Giấy, Hà Nội",
    temporary_residence: "123 Phạm Văn Đồng, Cầu Giấy, Hà Nội", marital_status: "Đã kết hôn",
    family_relations: [{ relation: "Vợ", name: "Đặng Thị H", occupation: "Bác sĩ" }, { relation: "Con", name: "Hoàng Văn I", occupation: "Kỹ sư" }],
    phone: "0978901234", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=HoangVanDuc",
    created_at: "2022-03-30" 
  },
  { 
    id: 8, employee_code: "16025678HG", name: "Đặng Thị Lan", gender: "Nữ", date_of_birth: "2000-12-05", age: 24, 
    department: "Sản xuất", employment_type: "Thời vụ",
    cccd: "001200000456", hometown: "Hưng Yên", permanent_residence: "456 Nguyễn Du, Hưng Yên",
    temporary_residence: "456 Nguyễn Du, Hưng Yên", marital_status: "Độc thân",
    family_relations: [{ relation: "Bố", name: "Đặng Văn J", occupation: "Công nhân" }],
    phone: "0989012345", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=DangThiLan",
    created_at: "2016-02-05" 
  },
  { 
    id: 9, employee_code: "23012345HG", name: "Bùi Minh Tuấn", gender: "Nam", date_of_birth: "1993-04-18", age: 31, 
    department: "Sản xuất", employment_type: "Chính thức",
    cccd: "001199300789", hometown: "Bắc Ninh", permanent_residence: "789 Lý Thái Tổ, Bắc Ninh",
    temporary_residence: "789 Lý Thái Tổ, Bắc Ninh", marital_status: "Đã kết hôn",
    family_relations: [{ relation: "Vợ", name: "Ngô Thị K", occupation: "Nhân viên văn phòng" }],
    phone: "0990123456", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=BuiMinhTuan",
    created_at: "2023-01-18" 
  },
  { 
    id: 10, employee_code: "19078901HG", name: "Ngô Thị Thảo", gender: "Nữ", date_of_birth: "1997-06-22", age: 27, 
    department: "Kinh doanh", employment_type: "Chính thức",
    cccd: "001199700234", hometown: "Hải Dương", permanent_residence: "234 Trần Phú, Hải Dương",
    temporary_residence: "234 Trần Phú, Hải Dương", marital_status: "Độc thân",
    family_relations: [{ relation: "Mẹ", name: "Ngô Thị L", occupation: "Bán hàng" }],
    phone: "0901234567", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=NgoThiThao",
    created_at: "2019-07-22" 
  },
  { 
    id: 11, employee_code: "20089012HG", name: "Đinh Văn Long", gender: "Nam", date_of_birth: "1982-08-12", age: 42, 
    department: "VPQL", employment_type: "Chính thức",
    cccd: "001198200567", hometown: "Hà Nội", permanent_residence: "567 Đội Cấn, Ba Đình, Hà Nội",
    temporary_residence: "567 Đội Cấn, Ba Đình, Hà Nội", marital_status: "Đã kết hôn",
    family_relations: [{ relation: "Vợ", name: "Lý Thị M", occupation: "Giáo viên" }, { relation: "Con", name: "Đinh Văn N", occupation: "Học sinh" }],
    phone: "0912345679", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=DinhVanLong",
    created_at: "2020-08-12" 
  },
  { 
    id: 12, employee_code: "17056234HG", name: "Lý Thị Hằng", gender: "Nữ", date_of_birth: "1990-01-28", age: 34, 
    department: "Sản xuất", employment_type: "Thời vụ",
    cccd: "001199000890", hometown: "Nghệ An", permanent_residence: "890 Quang Trung, Vinh, Nghệ An",
    temporary_residence: "890 Quang Trung, Vinh, Nghệ An", marital_status: "Ly hôn",
    family_relations: [{ relation: "Con", name: "Lý Văn O", occupation: "Học sinh" }],
    phone: "0923456780", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=LyThiHang",
    created_at: "2017-05-28" 
  },
  { 
    id: 13, employee_code: "24011111HG", name: "Trương Quốc Việt", gender: "Nam", date_of_birth: "1970-10-15", age: 54, 
    department: "VPQL", employment_type: "Chính thức",
    cccd: "001197000123", hometown: "Hà Nội", permanent_residence: "123 Hoàng Diệu, Ba Đình, Hà Nội",
    temporary_residence: "123 Hoàng Diệu, Ba Đình, Hà Nội", marital_status: "Đã kết hôn",
    family_relations: [{ relation: "Vợ", name: "Phan Thị P", occupation: "Nội trợ" }, { relation: "Con", name: "Trương Quốc Q", occupation: "Bác sĩ" }],
    phone: "0934567891", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=TruongQuocViet",
    created_at: "2024-01-15" 
  },
  { 
    id: 14, employee_code: "22067890HG", name: "Phan Thị Yến", gender: "Nữ", date_of_birth: "2001-03-20", age: 23, 
    department: "Kinh doanh", employment_type: "Thời vụ",
    cccd: "001200100456", hometown: "Quảng Ninh", permanent_residence: "456 Bạch Đằng, Hạ Long, Quảng Ninh",
    temporary_residence: "456 Bạch Đằng, Hạ Long, Quảng Ninh", marital_status: "Độc thân",
    family_relations: [{ relation: "Bố", name: "Phan Văn R", occupation: "Thợ mỏ" }, { relation: "Mẹ", name: "Vũ Thị S", occupation: "Nội trợ" }],
    phone: "0945678902", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=PhanThiYen",
    created_at: "2022-06-20" 
  },
  { 
    id: 15, employee_code: "21023456HG", name: "Vũ Đình Khoa", gender: "Nam", date_of_birth: "1996-05-11", age: 28, 
    department: "Sản xuất", employment_type: "Chính thức",
    cccd: "001199600789", hometown: "Hà Nam", permanent_residence: "789 Lý Thường Kiệt, Phủ Lý, Hà Nam",
    temporary_residence: "789 Lý Thường Kiệt, Phủ Lý, Hà Nam", marital_status: "Độc thân",
    family_relations: [{ relation: "Bố", name: "Vũ Văn T", occupation: "Công nhân" }, { relation: "Mẹ", name: "Đinh Thị U", occupation: "Nông dân" }],
    phone: "0956789013", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=VuDinhKhoa",
    created_at: "2021-02-11" 
  },
];

const generateTimekeepingData = (): TimekeepingRecord[] => {
  const records: TimekeepingRecord[] = [];
  const shifts: Array<'CA NGAY' | 'CA DEM' | '***'> = ['CA NGAY', 'CA DEM', '***'];
  const daysOfWeek = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  
  let id = 1;
  
  // Generate data for last 14 days
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = daysOfWeek[date.getDay()];
    
    // Skip some employees randomly to simulate absences
    const employeesToInclude = mockEmployees.filter(() => Math.random() > 0.15);
    
    for (const emp of employeesToInclude) {
      const shift = shifts[Math.floor(Math.random() * 3)];
      const isNightShift = shift === 'CA DEM';
      
      let checkIn: string, checkOut: string;
      if (isNightShift) {
        const inHour = 18 + Math.floor(Math.random() * 2);
        const inMin = Math.floor(Math.random() * 60);
        checkIn = `${inHour.toString().padStart(2, '0')}:${inMin.toString().padStart(2, '0')}`;
        
        const outHour = 2 + Math.floor(Math.random() * 4);
        const outMin = Math.floor(Math.random() * 60);
        checkOut = `${outHour.toString().padStart(2, '0')}:${outMin.toString().padStart(2, '0')}`;
      } else {
        const inHour = 7 + Math.floor(Math.random() * 2);
        const inMin = Math.floor(Math.random() * 60);
        checkIn = `${inHour.toString().padStart(2, '0')}:${inMin.toString().padStart(2, '0')}`;
        
        const outHour = 16 + Math.floor(Math.random() * 3);
        const outMin = Math.floor(Math.random() * 60);
        checkOut = `${outHour.toString().padStart(2, '0')}:${outMin.toString().padStart(2, '0')}`;
      }
      
      const lateMinutes = Math.random() > 0.8 ? Math.floor(Math.random() * 30) : 0;
      const earlyMinutes = Math.random() > 0.9 ? Math.floor(Math.random() * 20) : 0;
      const totalHours = 7 + Math.random() * 2;
      const overtime = Math.random() > 0.7 ? Math.random() * 2 : 0;
      
      records.push({
        id: id++,
        employee_code: emp.employee_code,
        employee_name: emp.name,
        date: dateStr,
        day_of_week: dayOfWeek,
        check_in: checkIn,
        check_out: checkOut,
        late_minutes: lateMinutes,
        early_minutes: earlyMinutes,
        workday: lateMinutes > 0 || earlyMinutes > 0 ? 0.5 + Math.random() * 0.5 : 1,
        total_hours: parseFloat(totalHours.toFixed(2)),
        overtime_hours: parseFloat(overtime.toFixed(2)),
        total_all_hours: parseFloat((totalHours + overtime).toFixed(2)),
        shift,
        department: emp.department,
      });
    }
  }
  
  return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

// Mock data removed - using real API data now
export const mockTimekeeping: TimekeepingRecord[] = []; // Empty - use API instead

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

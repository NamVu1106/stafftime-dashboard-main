import { Request, Response } from 'express';
import { prisma } from '../server';

// Normalize employee codes to avoid mismatches due to casing/whitespace
const normalizeCode = (code: string | null | undefined) => (code || '').trim().toUpperCase();

// Heuristic: determine if a value looks like an employee code (digits, optional HG suffix, no spaces)
const looksLikeCode = (val: string | null | undefined) => {
  const v = (val || '').trim();
  if (!v) return false;
  if (/\s/.test(v)) return false;
  // Accept patterns like 12345, 12345HG, HG12345, NV123, etc.
  return /[0-9]/.test(v);
};

// Resolve the most reliable code from a timekeeping record (some uploads swapped code/name)
const resolveRecordCode = (record: { employee_code: string; employee_name?: string }) => {
  const code1 = normalizeCode(record.employee_code);
  const code2 = normalizeCode(record.employee_name);
  if (looksLikeCode(code1)) return code1;
  if (looksLikeCode(code2)) return code2;
  // Fallback to code1 then code2 even if they look like names
  return code1 || code2;
};

// Normalize department for matching (case + diacritics insensitive), keep display separately
const normalizeDept = (dept: string | null | undefined) => {
  const raw = (dept || '').trim();
  if (!raw) return '';
  // Remove Vietnamese diacritics to merge variants like "Sản xuất" vs "SANXUAT"
  const noAccent = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return noAccent.toLowerCase();
};

// GET /api/statistics/dashboard?date=2024-12-10
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const targetDate = req.query.date as string | undefined;
    const startDate = req.query.start_date as string | undefined;
    const endDate = req.query.end_date as string | undefined;
    
    // Get all employees
    const totalEmployees = await prisma.employee.count();
    
    // Determine date range
    let dateToUse = targetDate;
    let rangeFilter: any = undefined;
    if (startDate && endDate) {
      rangeFilter = { gte: startDate, lte: endDate };
    } else {
      if (!dateToUse) {
        const mostRecentRecord = await prisma.timekeepingRecord.findFirst({
          where: { is_archived: 0 }, // Chỉ lấy dữ liệu mới
          orderBy: { date: 'desc' },
          select: { date: true },
        });
        dateToUse = mostRecentRecord?.date || new Date().toISOString().split('T')[0];
      }
      rangeFilter = dateToUse;
    }
    
    console.log(`[Dashboard Stats] targetDate: ${targetDate || 'null'}, startDate: ${startDate || 'null'}, endDate: ${endDate || 'null'}, filter: ${JSON.stringify(rangeFilter)}`);
    
    // Get timekeeping records: CHỈ lấy dữ liệu mới (is_archived = 0) cho ngày/hoặc khoảng ngày được chọn
    const dayRecords = await prisma.timekeepingRecord.findMany({
      where: { 
        is_archived: 0, // CHỈ lấy dữ liệu mới
        date: rangeFilter
      },
      orderBy: { date: 'desc' },
    });
    
    console.log(`[Dashboard Stats] Records found for date ${dateToUse}: ${dayRecords.length}`);
    
    // Count unique employees who attended (not total records)
    const uniqueAttendees = new Set(dayRecords.map(resolveRecordCode)).size;
    const attendanceToday = uniqueAttendees;
    
    console.log(`[Dashboard Stats] uniqueAttendees: ${uniqueAttendees}, totalEmployees: ${totalEmployees}`);
    
    // Helper function to cap percentage at 100%
    const capPercentage = (value: number): string => {
      const capped = Math.min(value, 100);
      return capped.toFixed(1);
    };
    
    const attendanceRate = totalEmployees > 0 
      ? capPercentage((attendanceToday / totalEmployees) * 100)
      : '0';
    
    // Calculate late employees: check late_minutes > 0 OR check_in time after 8:00 AM
    // Count unique employees who are late (not total records)
    const lateEmployeeCodes = new Set<string>();
    dayRecords.forEach(r => {
      let isLate = false;
      
      // If late_minutes is already set and > 0, count as late
      if (r.late_minutes > 0) {
        isLate = true;
      }
      // Otherwise, calculate from check_in time
      // Standard work start time is 8:00 AM
      else if (r.check_in && r.check_in.trim()) {
        try {
          const [hours, minutes] = r.check_in.split(':').map(Number);
          if (!isNaN(hours) && !isNaN(minutes)) {
            // If check_in is after 8:00 AM, calculate late minutes
            const checkInMinutes = hours * 60 + minutes;
            const standardStartMinutes = 8 * 60; // 8:00 AM = 480 minutes
            if (checkInMinutes > standardStartMinutes) {
              isLate = true;
            }
          }
        } catch (e) {
          // If parsing fails, skip
        }
      }
      
      if (isLate) {
        lateEmployeeCodes.add(resolveRecordCode(r as any));
      }
    });
    const lateToday = lateEmployeeCodes.size;
    
    // Calculate total hours: simply sum all total_hours from records (like Reports page)
    // This is simpler and more reliable than trying to calculate from check_in/check_out
    const totalHoursToday = dayRecords.reduce((sum, r) => {
      // Use total_hours if available, otherwise 0
      return sum + (r.total_hours || 0);
    }, 0).toFixed(1);
    
    // Calculate by employment type
    const chinhThucEmployees = await prisma.employee.count({
      where: { employment_type: 'Chính thức' },
    });
    const thoiVuEmployees = await prisma.employee.count({
      where: { employment_type: 'Thời vụ' },
    });
    
    const chinhThucCodes = await prisma.employee.findMany({
      where: { employment_type: 'Chính thức' },
      select: { employee_code: true },
    });
    const chinhThucCodesSet = new Set(chinhThucCodes.map(e => normalizeCode(e.employee_code)));
    
    const thoiVuCodes = await prisma.employee.findMany({
      where: { employment_type: 'Thời vụ' },
      select: { employee_code: true },
    });
    const thoiVuCodesSet = new Set(thoiVuCodes.map(e => normalizeCode(e.employee_code)));
    
    // Count unique employees who attended for each type
    const chinhThucAttendees = new Set(
      dayRecords
        .map(resolveRecordCode)
        .filter(code => chinhThucCodesSet.has(code))
    ).size;
    const thoiVuAttendees = new Set(
      dayRecords
        .map(resolveRecordCode)
        .filter(code => thoiVuCodesSet.has(code))
    ).size;
    
    console.log(`[Dashboard Stats] Chính thức: ${chinhThucAttendees}/${chinhThucEmployees}, Thời vụ: ${thoiVuAttendees}/${thoiVuEmployees}`);
    
    const chinhThucRate = chinhThucEmployees > 0 
      ? capPercentage((chinhThucAttendees / chinhThucEmployees) * 100)
      : '0';
    const thoiVuRate = thoiVuEmployees > 0 
      ? capPercentage((thoiVuAttendees / thoiVuEmployees) * 100)
      : '0';
    
    console.log(`[Dashboard Stats] Chính thức rate: ${chinhThucRate}%, Thời vụ rate: ${thoiVuRate}%`);
    
    res.json({
      totalEmployees,
      attendanceRate,
      lateToday,
      totalHoursToday,
      chinhThucRate,
      thoiVuRate,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/statistics/gender
export const getGenderStats = async (req: Request, res: Response) => {
  try {
    const employees = await prisma.employee.findMany();
    const male = employees.filter(e => e.gender === 'Nam').length;
    const female = employees.filter(e => e.gender === 'Nữ').length;
    
    res.json([
      { name: 'Nam', value: male, color: '#3B82F6' },
      { name: 'Nữ', value: female, color: '#EC4899' },
    ]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/statistics/age
export const getAgeStats = async (req: Request, res: Response) => {
  try {
    const employees = await prisma.employee.findMany();
    
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
    
    res.json(groups.map(g => ({ name: g.range, value: g.count, color: g.color })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/statistics/employment-type
export const getEmploymentTypeStats = async (req: Request, res: Response) => {
  try {
    const employees = await prisma.employee.findMany();
    const chinhThuc = employees.filter(e => e.employment_type === 'Chính thức').length;
    const thoiVu = employees.filter(e => e.employment_type === 'Thời vụ').length;
    
    res.json([
      { name: 'Chính thức', value: chinhThuc, color: '#10B981' },
      { name: 'Thời vụ', value: thoiVu, color: '#F59E0B' },
    ]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/statistics/department?date=2024-12-10
export const getAttendanceRateByDepartment = async (req: Request, res: Response) => {
  try {
    const targetDate = req.query.date as string | undefined;
    const startDate = req.query.start_date as string | undefined;
    const endDate = req.query.end_date as string | undefined;
    
    // Determine date filter
    let dateToUse = targetDate;
    let rangeFilter: any = undefined;
    if (startDate && endDate) {
      rangeFilter = { gte: startDate, lte: endDate };
    } else {
      if (!dateToUse) {
        const mostRecentRecord = await prisma.timekeepingRecord.findFirst({
          where: { is_archived: 0 }, // CHỈ lấy dữ liệu mới
          orderBy: { date: 'desc' },
          select: { date: true },
        });
        dateToUse = mostRecentRecord?.date || new Date().toISOString().split('T')[0];
      }
      rangeFilter = dateToUse;
    }
    
    // Get departments from employees (authoritative) + from today's/month's records (fallback)
    const allEmployees = await prisma.employee.findMany({
      select: { department: true },
    });
    const dayRecords = await prisma.timekeepingRecord.findMany({
      where: { 
        is_archived: 0, // CHỈ lấy dữ liệu mới
        date: rangeFilter
      },
    });

    // Map normalized dept -> display name (prefer employee table, fallback record)
    const deptDisplayMap = new Map<string, string>();
    allEmployees.forEach(e => {
      const norm = normalizeDept(e.department);
      if (!norm) return;
      if (!deptDisplayMap.has(norm)) {
        deptDisplayMap.set(norm, (e.department || '').trim());
      }
    });
    dayRecords.forEach(r => {
      const norm = normalizeDept(r.department);
      if (!norm) return;
      if (!deptDisplayMap.has(norm)) {
        deptDisplayMap.set(norm, (r.department || '').trim());
      }
    });

    const departments = [...new Set([
      ...allEmployees.map(e => normalizeDept(e.department)),
      ...dayRecords.map(r => normalizeDept(r.department))
    ].filter(Boolean))].filter(d => {
      // Loại bỏ các phòng ban không mong muốn: test/ko/thoi vu/kg
      const blacklist = new Set(['test', 'ko', 'thoi vu', 'thoi_vu', 'thoivu', 'kg']);
      return !blacklist.has(d);
    });
    
    // Get all employees with their codes and departments for accurate matching
    const allEmployeesList = await prisma.employee.findMany({
      select: { employee_code: true, department: true },
    });
    
    // Create a map: normalized employee_code -> normalized department
    const employeeDeptMap = new Map<string, string>();
    allEmployeesList.forEach(emp => {
      employeeDeptMap.set(normalizeCode(emp.employee_code), normalizeDept(emp.department));
    });
    
    // Create a map: normalized department -> Set of normalized employee codes
    const deptEmployeeMap = new Map<string, Set<string>>();
    allEmployeesList.forEach(emp => {
      const normDept = normalizeDept(emp.department);
      if (!deptEmployeeMap.has(normDept)) {
        deptEmployeeMap.set(normDept, new Set());
      }
      deptEmployeeMap.get(normDept)!.add(normalizeCode(emp.employee_code));
    });
    
    const result = await Promise.all(
      departments.map(async (dept) => {
        const normDept = dept;
        // Get total employees in this department from the map
        const deptEmployeeCodes = deptEmployeeMap.get(normDept) || new Set<string>();
        let deptEmployees = deptEmployeeCodes.size;

        // Collect fallback codes from records that match dept by record.department when employee mapping is missing
        const fallbackCodes = new Set<string>();

        // Filter records: prefer employee table mapping; if missing, use record.department match
        const deptRecords = dayRecords.filter(r => {
          const code = resolveRecordCode(r as any);
          const actualDept = employeeDeptMap.get(code);
          if (actualDept === normDept) return true;
          const recordDept = normalizeDept(r.department);
          if (!actualDept && recordDept === normDept) {
            fallbackCodes.add(code);
            return true;
          }
          return false;
        });

        // Merge fallback codes into employee count (avoid double count)
        fallbackCodes.forEach(c => deptEmployeeCodes.add(c));
        deptEmployees = deptEmployeeCodes.size;
        
        // Count unique employees who attended (not total records)
        const uniqueAttendees = new Set(deptRecords.map(r => resolveRecordCode(r as any))).size;
        
        // If employee table has 0 for this dept but we still have records, use attendees count to avoid dividing by 0
        if (deptEmployees === 0 && uniqueAttendees > 0) {
          deptEmployees = uniqueAttendees;
        }
        
        // Calculate attendance rate (cap at 100%)
        const rawRate = deptEmployees > 0 
          ? (uniqueAttendees / deptEmployees) * 100
          : 0;
        const attendanceRate = Math.min(rawRate, 100);
        
        // Log for debugging
        console.log(`[Department Stats] ${dept}:`, {
          totalEmployees: deptEmployees,
          totalRecords: deptRecords.length,
          uniqueAttendees,
          rawRate: rawRate.toFixed(1),
          cappedRate: attendanceRate.toFixed(1)
        });
        
        return {
          department: deptDisplayMap.get(normDept) || dept,
          totalEmployees: deptEmployees,
          attendance: uniqueAttendees, // Number of unique employees who attended
          attendanceRate: parseFloat(attendanceRate.toFixed(1)),
        };
      })
    );
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/statistics/gender-by-employment-type
export const getGenderByEmploymentType = async (req: Request, res: Response) => {
  try {
    const employees = await prisma.employee.findMany();
    
    const chinhThuc = employees.filter(e => e.employment_type === 'Chính thức');
    const thoiVu = employees.filter(e => e.employment_type === 'Thời vụ');
    
    const chinhThucNam = chinhThuc.filter(e => e.gender === 'Nam').length;
    const chinhThucNu = chinhThuc.filter(e => e.gender === 'Nữ').length;
    const thoiVuNam = thoiVu.filter(e => e.gender === 'Nam').length;
    const thoiVuNu = thoiVu.filter(e => e.gender === 'Nữ').length;
    
    const chinhThucTotal = chinhThuc.length;
    const thoiVuTotal = thoiVu.length;
    
    // Helper function to cap percentage at 100%
    const capPercent = (value: number, total: number): string => {
      if (total <= 0) return '0';
      const percent = (value / total) * 100;
      return Math.min(percent, 100).toFixed(1);
    };
    
    res.json({
      chinhThucNam: {
        count: chinhThucNam,
        percent: capPercent(chinhThucNam, chinhThucTotal)
      },
      chinhThucNu: {
        count: chinhThucNu,
        percent: capPercent(chinhThucNu, chinhThucTotal)
      },
      thoiVuNam: {
        count: thoiVuNam,
        percent: capPercent(thoiVuNam, thoiVuTotal)
      },
      thoiVuNu: {
        count: thoiVuNu,
        percent: capPercent(thoiVuNu, thoiVuTotal)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/statistics/attendance-by-date?days=7
export const getAttendanceByDate = async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const today = new Date();
    const dates: string[] = [];

    // Build YYYY-MM-DD using local date to avoid timezone shift
    const toLocalYmd = (dt: Date) => {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(toLocalYmd(date));
    }
    
    // CHỈ lấy dữ liệu mới (is_archived = 0) - dữ liệu hiện tại, không phải lịch sử
    const records = await prisma.timekeepingRecord.findMany({
      where: {
        is_archived: 0, // CHỈ lấy dữ liệu mới
        date: {
          in: dates,
        },
      },
    });
    
    const result = dates.map(date => {
      const dayRecords = records.filter(r => r.date === date);
      // Count unique employees who attended (not total records)
      const uniqueAttendees = new Set(dayRecords.map(r => resolveRecordCode(r as any))).size;
      return {
        date,
        attendance: uniqueAttendees, // Number of unique employees, not total records
      };
    });
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};



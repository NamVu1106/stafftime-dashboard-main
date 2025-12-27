import { Request, Response } from 'express';
import { prisma } from '../server';

// Normalize employee codes
const normalizeCode = (code: string | null | undefined) => (code || '').trim().toUpperCase();

// Resolve employee code from record
const resolveRecordCode = (record: { employee_code: string; employee_name?: string }) => {
  const code1 = normalizeCode(record.employee_code);
  const code2 = normalizeCode(record.employee_name);
  if (/[0-9]/.test(code1)) return code1;
  if (/[0-9]/.test(code2)) return code2;
  return code1 || code2;
};

// Normalize department
const normalizeDept = (dept: string | null | undefined) => {
  const raw = (dept || '').trim();
  if (!raw) return '';
  const noAccent = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return noAccent.toLowerCase();
};

// Department name mapping
const departmentNameMap: Record<string, string> = {
  'hg': 'Phòng HG',
  'prod': 'Phòng Prod',
  'qc': 'Phòng QC',
  'cs': 'Phòng CS',
  'eqm': 'Phòng EQM',
  'sm': 'Phòng SM',
  'mm': 'Phòng MM',
};

// GET /api/departments/:dept/stats?date=2024-12-10
export const getDepartmentStats = async (req: Request, res: Response) => {
  try {
    const dept = req.params.dept;
    const targetDate = req.query.date as string | undefined;
    const startDate = req.query.start_date as string | undefined;
    const endDate = req.query.end_date as string | undefined;
    
    // Get department name
    const deptName = departmentNameMap[dept] || dept;
    const normDept = normalizeDept(deptName);
    
    // Determine date filter
    let dateFilter: any = undefined;
    if (startDate && endDate) {
      dateFilter = { gte: startDate, lte: endDate };
    } else if (targetDate) {
      dateFilter = targetDate;
    } else {
      // Default to today
      dateFilter = new Date().toISOString().split('T')[0];
    }
    
    // Get all employees in this department
    // SQLite doesn't support case-insensitive search, so we filter after fetching
    const allEmployeesList = await prisma.employee.findMany();
    const allEmployees = allEmployeesList.filter(emp => {
      const empDept = normalizeDept(emp.department);
      return empDept === normDept || emp.department.toLowerCase().includes(deptName.toLowerCase());
    });
    
    // Get employee code map
    const employeeDeptMap = new Map<string, string>();
    allEmployees.forEach(emp => {
      employeeDeptMap.set(normalizeCode(emp.employee_code), normalizeDept(emp.department));
    });
    
    // Get records
    const where: any = {
      is_archived: 0,
      date: dateFilter,
    };
    
    const allRecords = await prisma.timekeepingRecord.findMany({ where });
    
    // Filter records for this department
    const deptRecords = allRecords.filter(r => {
      const code = resolveRecordCode(r as any);
      const empDept = employeeDeptMap.get(code);
      return empDept === normDept || normalizeDept(r.department) === normDept;
    });
    
    // Calculate stats
    const totalEmployees = allEmployees.length;
    const uniqueAttendees = new Set(deptRecords.map(r => resolveRecordCode(r as any))).size;
    const attendanceRate = totalEmployees > 0
      ? ((uniqueAttendees / totalEmployees) * 100).toFixed(1)
      : '0';
    
    // Count by employment type
    const chinhThucCount = allEmployees.filter(e => e.employment_type === 'Chính thức').length;
    const thoiVuCount = allEmployees.filter(e => e.employment_type === 'Thời vụ').length;
    
    // Get employee list with stats
    const employeesList = await Promise.all(
      allEmployees.map(async (emp) => {
        const empCode = normalizeCode(emp.employee_code);
        const empRecords = deptRecords.filter(r => resolveRecordCode(r as any) === empCode);
        const daysWorked = empRecords.length;
        const totalHours = empRecords.reduce((sum, r) => sum + (r.total_hours || 0), 0);
        const empAttendanceRate = daysWorked > 0 ? ((daysWorked / (startDate && endDate ? 
          Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1 : 1)) * 100).toFixed(1) : '0';
        
        return {
          code: emp.employee_code,
          name: emp.name,
          daysWorked,
          totalHours: parseFloat(totalHours.toFixed(1)),
          attendanceRate: parseFloat(empAttendanceRate),
        };
      })
    );
    
    res.json({
      department: deptName,
      totalEmployees,
      attendanceRate: parseFloat(attendanceRate),
      chinhThucCount,
      thoiVuCount,
      employees: employeesList,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};


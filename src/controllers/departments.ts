import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
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

// Normalize department (bỏ dấu, lowercase, giữ khoảng trắng — dùng khi so khớp DB)
const normalizeDept = (dept: string | null | undefined) => {
  const raw = (dept || '').trim();
  if (!raw) return '';
  const noAccent = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return noAccent.toLowerCase();
};

// Chuẩn hóa rút gọn (bỏ khoảng trắng) — dùng làm id thống nhất cho API / frontend
const normDeptCompact = (dept: string | null | undefined) =>
  (normalizeDept(dept) || '').replace(/\s+/g, '');

// Ánh xạ tên hiển thị theo norm rút gọn (để danh sách phòng ban thống nhất)
const departmentNameMap: Record<string, string> = {
  'hg': 'Phòng HG',
  'prod': 'Phòng Prod',
  'qc': 'Phòng QC',
  'phongqc': 'Phòng QC',
  'cs': 'Phòng CS',
  'phongcs': 'Phòng CS',
  'customerservice': 'Phòng CS',
  'chamsoc': 'Phòng CS',
  'cskh': 'Phòng CS',
  'eqm': 'Phòng EQM',
  'phongeqm': 'Phòng EQM',
  'sm': 'Phòng SM',
  'phongsm': 'Phòng SM',
  'mm': 'Phòng MM',
  'phongmm': 'Phòng MM',
  'vpql': 'VPQL',
  'sanxuat': 'SAN XUAT',
  'sanxuất': 'SAN XUAT',
  'sx': 'SX',
  'p': 'P (Sản xuất)',
  'thoivu': 'THOI VU',
  'kg': 'KG',
  'test': 'TEST',
};

// GET /api/departments/from-excel - Danh sách phòng ban từ file 02-03.02.xlsx (đã extract ra depts-from-02-03.json)
export const getDepartmentsFromExcel = async (_req: Request, res: Response) => {
  try {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const jsonPath = path.join(projectRoot, 'depts-from-02-03.json');
    if (!fs.existsSync(jsonPath)) {
      return res.json({ departments: [] });
    }
    const raw = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(raw);
    const departments = Array.isArray(data.departments) ? data.departments : [];
    res.json({ departments });
  } catch (e: any) {
    res.json({ departments: [] });
  }
};

// GET /api/departments - Danh sách phòng ban từ dữ liệu thực (Employee + TimekeepingRecord)
export const getDepartmentsList = async (_req: Request, res: Response) => {
  try {
    const [employees, records] = await Promise.all([
      prisma.employee.findMany({ select: { department: true } }),
      prisma.timekeepingRecord.findMany({
        where: { is_archived: 0 },
        select: { department: true },
      }),
    ]);
    const set = new Set<string>();
    employees.forEach(e => {
      const d = (e.department || '').trim();
      if (d) set.add(d);
    });
    records.forEach(r => {
      const d = (r.department || '').trim();
      if (d) set.add(d);
    });
    const list = [...set].filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi'));
    res.json(list.map(raw => {
      const compact = normDeptCompact(raw);
      const name = departmentNameMap[compact] || raw;
      return { id: compact || raw, name };
    }));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// So khớp phòng ban theo id compact (client gửi id dạng "phongqc", DB có "Phòng QC")
const deptMatch = (a: string, b: string) => normDeptCompact(a) === normDeptCompact(b);

// Bộ phận (nhóm): MM, VPQL, EQM, SM, QC, CS, PROD gộp nhiều mã phòng (P, Phòng Prod, SAN XUAT -> PROD)
const DEPARTMENT_GROUP_IDS: Record<string, string[]> = {
  MM: ['mm', 'phongmm', 'm'],
  VPQL: ['vpql'],
  EQM: ['eqm', 'phongeqm', 'e'],
  SM: ['sm', 'phongsm', 's'],
  QC: ['qc', 'phongqc', 'q'],
  // CS: Phòng CS, CS, Customer Service, Chăm sóc, Chăm sóc KH, C.S, c/s...
  CS: ['cs', 'phongcs', 'customerservice', 'chamsoc', 'chamsockhachhang', 'cskh', 'c.s', 'c/s'],
  PROD: ['sanxuat', 'sanxuất', 'sx', 'prod', 'p', 'p2', 'phongprod', 'production'],
};
const GROUP_DISPLAY_NAMES: Record<string, string> = {
  MM: 'MM', VPQL: 'VPQL', EQM: 'EQM', SM: 'SM', QC: 'QC', CS: 'CS', PROD: 'PROD (Sản xuất)', OTHER: 'Khác',
};
const allGroupCompactSet = new Set<string>();
Object.values(DEPARTMENT_GROUP_IDS).forEach(ids => ids.forEach(id => allGroupCompactSet.add(id)));

const isGroupKey = (d: string) => ['MM', 'VPQL', 'EQM', 'SM', 'QC', 'CS', 'PROD', 'OTHER'].includes((d || '').toUpperCase());

const getCompactSetForDept = (dept: string): Set<string> | null => {
  const key = (dept || '').toUpperCase();
  if (DEPARTMENT_GROUP_IDS[key]) return new Set(DEPARTMENT_GROUP_IDS[key]);
  if (key === 'OTHER') return null;
  return new Set([normDeptCompact(dept)].filter(Boolean));
};

// GET /api/departments/:dept/stats?date=2024-12-10
export const getDepartmentStats = async (req: Request, res: Response) => {
  try {
    const dept = Array.isArray(req.params.dept) ? req.params.dept[0] : req.params.dept;
    const targetDate = req.query.date as string | undefined;
    const startDate = req.query.start_date as string | undefined;
    const endDate = req.query.end_date as string | undefined;
    
    const isGroup = isGroupKey(dept);
    const compactSet = getCompactSetForDept(dept);
    const deptName = isGroup ? (GROUP_DISPLAY_NAMES[dept.toUpperCase()] || dept) : (departmentNameMap[normDeptCompact(dept)] || dept);
    
    let dateFilter: any;
    if (startDate && endDate) {
      dateFilter = { gte: startDate, lte: endDate };
    } else if (targetDate) {
      dateFilter = targetDate;
    } else {
      dateFilter = new Date().toISOString().split('T')[0];
    }
    
    let whereRecords: any = { is_archived: 0, date: dateFilter };
    let allRecords = await prisma.timekeepingRecord.findMany({ where: whereRecords });
    let dateRangeUsed: { start_date: string; end_date: string } | undefined;
    let dateUsed: string | undefined;

    // Fallback: nếu khoảng ngày đã chọn không có bản ghi nào → dùng tháng gần nhất có dữ liệu
    if (allRecords.length === 0 && (startDate && endDate)) {
      const mostRecent = await prisma.timekeepingRecord.findFirst({
        where: { is_archived: 0 },
        orderBy: { date: 'desc' },
        select: { date: true },
      });
      if (mostRecent?.date) {
        const d = new Date(mostRecent.date);
        const y = d.getFullYear();
        const m = d.getMonth();
        const fallbackStart = new Date(y, m, 1).toISOString().split('T')[0];
        const fallbackEnd = new Date(y, m + 1, 0).toISOString().split('T')[0];
        whereRecords = { is_archived: 0, date: { gte: fallbackStart, lte: fallbackEnd } };
        allRecords = await prisma.timekeepingRecord.findMany({ where: whereRecords });
        dateRangeUsed = { start_date: fallbackStart, end_date: fallbackEnd };
      }
    }
    // Fallback cho lọc "Hôm nay": nếu ngày đã chọn không có bản ghi → dùng ngày gần nhất có dữ liệu
    if (allRecords.length === 0 && targetDate && !startDate && !endDate) {
      const mostRecent = await prisma.timekeepingRecord.findFirst({
        where: { is_archived: 0 },
        orderBy: { date: 'desc' },
        select: { date: true },
      });
      if (mostRecent?.date) {
        dateUsed = mostRecent.date;
        whereRecords = { is_archived: 0, date: dateUsed };
        allRecords = await prisma.timekeepingRecord.findMany({ where: whereRecords });
      }
    }

    const allEmployeesList = await prisma.employee.findMany();
    const employeeDeptMap = new Map<string, string>();
    allEmployeesList.forEach(emp => {
      employeeDeptMap.set(normalizeCode(emp.employee_code), normDeptCompact(emp.department));
    });
    
    let allEmployees: typeof allEmployeesList;
    let deptRecords: typeof allRecords;
    
    if (isGroup && dept.toUpperCase() === 'OTHER') {
      allEmployees = allEmployeesList.filter(emp => {
        const c = normDeptCompact(emp.department);
        return c && !allGroupCompactSet.has(c);
      });
      deptRecords = allRecords.filter(r => {
        const code = resolveRecordCode(r as any);
        const empCompact = employeeDeptMap.get(code);
        const recordCompact = normDeptCompact(r.department);
        return (empCompact && !allGroupCompactSet.has(empCompact)) || (recordCompact && !allGroupCompactSet.has(recordCompact));
      });
    } else if (compactSet && compactSet.size > 0) {
      allEmployees = allEmployeesList.filter(emp => compactSet.has(normDeptCompact(emp.department)));
      deptRecords = allRecords.filter(r => {
        const code = resolveRecordCode(r as any);
        const empCompact = employeeDeptMap.get(code);
        const recordCompact = normDeptCompact(r.department);
        return (empCompact && compactSet.has(empCompact)) || (recordCompact && compactSet.has(recordCompact));
      });
    } else {
      const effectiveNorm = normDeptCompact(dept) || normDeptCompact(deptName);
      allEmployees = allEmployeesList.filter(emp => deptMatch(emp.department, dept));
      deptRecords = allRecords.filter(r => {
        const code = resolveRecordCode(r as any);
        const empCompact = employeeDeptMap.get(code);
        const recordCompact = normDeptCompact(r.department);
        return empCompact === effectiveNorm || recordCompact === effectiveNorm;
      });
    }
    
    const uniqueCodes = new Set(deptRecords.map(r => resolveRecordCode(r as any)));
    let totalEmployees = allEmployees.length;
    if (totalEmployees === 0 && uniqueCodes.size > 0) {
      totalEmployees = uniqueCodes.size;
    }
    const uniqueAttendees = uniqueCodes.size;
    const rawRate = totalEmployees > 0 ? (uniqueAttendees / totalEmployees) * 100 : 0;
    const attendanceRate = Math.min(rawRate, 100).toFixed(1);
    
    const chinhThucCount = allEmployees.filter(e => e.employment_type === 'Chính thức').length;
    const thoiVuCount = allEmployees.filter(e => e.employment_type === 'Thời vụ').length;
    
    const daysInRange = startDate && endDate
      ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
      : 1;
    
    let employeesList: { code: string; name: string; daysWorked: number; totalHours: number; attendanceRate: number }[];
    if (allEmployees.length > 0) {
      employeesList = allEmployees.map(emp => {
        const empCode = normalizeCode(emp.employee_code);
        const empRecords = deptRecords.filter(r => resolveRecordCode(r as any) === empCode);
        const daysWorked = empRecords.length;
        const totalHours = empRecords.reduce((sum, r) => sum + (r.total_hours || 0), 0);
        const empRawRate = daysInRange > 0 ? (daysWorked / daysInRange) * 100 : 0;
        const empAttendanceRate = parseFloat(Math.min(empRawRate, 100).toFixed(1));
        return {
          code: emp.employee_code,
          name: emp.name,
          daysWorked,
          totalHours: parseFloat(totalHours.toFixed(1)),
          attendanceRate: empAttendanceRate,
        };
      });
    } else {
      const byCode = new Map<string, { name: string; daysWorked: number; totalHours: number }>();
      deptRecords.forEach(r => {
        const code = resolveRecordCode(r as any);
        const name = (r as any).employee_name || (r as any).employee_code || code;
        const cur = byCode.get(code);
        const hours = (r.total_hours || 0);
        if (!cur) {
          byCode.set(code, { name, daysWorked: 1, totalHours: hours });
        } else {
          cur.daysWorked += 1;
          cur.totalHours += hours;
        }
      });
      employeesList = [...byCode.entries()].map(([code, v]) => {
        const rawRate = daysInRange > 0 ? (v.daysWorked / daysInRange) * 100 : 0;
        return {
          code,
          name: v.name,
          daysWorked: v.daysWorked,
          totalHours: parseFloat(v.totalHours.toFixed(1)),
          attendanceRate: parseFloat(Math.min(rawRate, 100).toFixed(1)),
        };
      });
    }
    
    res.json({
      department: deptName,
      totalEmployees,
      attendance: uniqueAttendees,
      attendanceRate: parseFloat(attendanceRate),
      chinhThucCount,
      thoiVuCount,
      employees: employeesList,
      dateRangeUsed: dateRangeUsed ?? undefined,
      dateUsed: dateUsed ?? undefined,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};


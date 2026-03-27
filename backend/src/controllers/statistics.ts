import { Request, Response } from 'express';
import { query as q, queryOne as q1 } from '../db/sqlServer';

const empCount = async (cond = '', params: Record<string, unknown> = {}) => {
  const sql = cond
    ? `SELECT COUNT(*) AS n FROM employees WHERE ${cond}`
    : 'SELECT COUNT(*) AS n FROM employees';
  const r = await q1<{ n: number }>(sql, params);
  return Number(r?.n ?? 0);
};

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

const normalizeTextValue = (value: string | null | undefined) =>
  (value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const isOfficialEmployeeText = (employmentType: string | null | undefined) => {
  const normalized = normalizeTextValue(employmentType);
  return normalized.includes('chinh thuc') || normalized.includes('정규');
};

const isSeasonalDepartment = (department: string | null | undefined) => {
  const normalized = normalizeTextValue(department);
  return (
    normalized.includes('thoi vu') ||
    normalized.includes('thoivu') ||
    normalized.includes('seasonal') ||
    normalized.includes('temp')
  );
};

const isSeasonalEmployeeText = (employmentType: string | null | undefined) => {
  const normalized = normalizeTextValue(employmentType);
  return (
    normalized.includes('thoi vu') ||
    normalized.includes('seasonal') ||
    normalized.includes('temp') ||
    normalized.includes('계약') ||
    normalized.includes('비정규')
  );
};

const resolveEmploymentCategory = (employmentType: string | null | undefined, department?: string | null | undefined) => {
  if (isSeasonalEmployeeText(employmentType) || isSeasonalDepartment(department)) return 'Thời vụ';
  if (isOfficialEmployeeText(employmentType)) return 'Chính thức';
  return (employmentType || '').trim();
};

// Get hours for a record: use total_hours if > 0, else compute from check_in/check_out
type RecordWithHours = { total_hours?: number | null; check_in?: string | null; check_out?: string | null };
const getRecordHours = (r: RecordWithHours): number => {
  const h = r.total_hours;
  if (h != null && h > 0) return h;
  const ci = (r.check_in || '').trim();
  const co = (r.check_out || '').trim();
  if (!ci || !co) return 0;
  const parseTime = (s: string): number => {
    const parts = s.split(/[:\s]/).map(Number).filter(n => !isNaN(n));
    if (parts.length >= 2) return parts[0] + parts[1] / 60;
    if (parts.length === 1) return parts[0];
    return 0;
  };
  const inM = parseTime(ci);
  const outM = parseTime(co);
  if (outM <= inM) return 0;
  return Math.round((outM - inM) * 10) / 10; // 1 decimal
};

type AttendanceSignalRecord = RecordWithHours & {
  workday?: number | null;
  total_all_hours?: number | null;
  overtime_hours?: number | null;
  late_minutes?: number | null;
  early_minutes?: number | null;
};

const hasAttendanceSignal = (record: AttendanceSignalRecord): boolean => {
  const hasText = (value: unknown) => String(value ?? '').trim() !== '';
  return (
    hasText(record.check_in) ||
    hasText(record.check_out) ||
    Number(record.workday) > 0 ||
    Number(record.total_hours) > 0 ||
    Number(record.total_all_hours) > 0 ||
    Number(record.overtime_hours) > 0 ||
    Number(record.late_minutes) > 0 ||
    Number(record.early_minutes) > 0
  );
};

const filterAttendanceRecords = <T extends AttendanceSignalRecord>(records: T[]): T[] =>
  records.filter(hasAttendanceSignal);

/** Khớp logic đếm lateToday trên dashboard: late_minutes > 0 hoặc giờ vào sau 8:00 */
const computeLateInfo = (
  r: AttendanceSignalRecord
): { isLate: boolean; effectiveMinutes: number; reason: 'late_minutes' | 'check_in_after_8' | null } => {
  const dbLate = Number(r.late_minutes) || 0;
  if (dbLate > 0) {
    return { isLate: true, effectiveMinutes: dbLate, reason: 'late_minutes' };
  }
  const ci = String(r.check_in || '').trim();
  if (ci) {
    try {
      const [hours, minutes] = ci.split(':').map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        const checkInMinutes = hours * 60 + minutes;
        const standardStartMinutes = 8 * 60;
        if (checkInMinutes > standardStartMinutes) {
          return {
            isLate: true,
            effectiveMinutes: checkInMinutes - standardStartMinutes,
            reason: 'check_in_after_8',
          };
        }
      }
    } catch {
      /* ignore */
    }
  }
  return { isLate: false, effectiveMinutes: 0, reason: null };
};

type VersionedTimekeepingRecord = AttendanceSignalRecord & {
  id?: number | null;
  employee_code?: string | null;
  employee_name?: string | null;
  date?: string | null;
  created_at?: string | null;
  is_archived?: number | null;
  department?: string | null;
};

const compareTimekeepingVersion = (a: VersionedTimekeepingRecord, b: VersionedTimekeepingRecord) => {
  const activeA = Number(a.is_archived || 0) === 0 ? 1 : 0;
  const activeB = Number(b.is_archived || 0) === 0 ? 1 : 0;
  if (activeA !== activeB) return activeA - activeB;
  const createdA = String(a.created_at || '');
  const createdB = String(b.created_at || '');
  if (createdA !== createdB) return createdA.localeCompare(createdB, 'vi');
  return Number(a.id || 0) - Number(b.id || 0);
};

const dedupeLatestTimekeepingRecords = <T extends VersionedTimekeepingRecord>(records: T[]): T[] => {
  const latest = new Map<string, T>();
  records.forEach((record) => {
    const code = resolveRecordCode(record as any);
    const date = String(record.date || '').slice(0, 10);
    if (!code || !date) return;
    const key = `${code}\t${date}`;
    const prev = latest.get(key);
    if (!prev || compareTimekeepingVersion(record, prev) > 0) {
      latest.set(key, record);
    }
  });
  return [...latest.values()];
};

type EmployeeTypeRow = { employee_code: string; employment_type?: string | null; department?: string | null };

const buildEmploymentTypeByCode = async (
  fallbackRecords: Array<{ employee_code?: string; employee_name?: string; department?: string | null }> = []
) => {
  const employees = await q<EmployeeTypeRow>(
    'SELECT employee_code, employment_type, department FROM employees',
    {}
  );
  const typeByCode = new Map<string, string>();
  employees.forEach((emp) => {
    const code = normalizeCode(emp.employee_code);
    if (!code) return;
    typeByCode.set(code, resolveEmploymentCategory(emp.employment_type ?? '', emp.department ?? ''));
  });

  fallbackRecords.forEach((record) => {
    const code = resolveRecordCode(record as any);
    if (!code) return;
    const fallbackType = resolveEmploymentCategory('', record.department ?? '');
    if (fallbackType === 'Thời vụ') {
      typeByCode.set(code, fallbackType);
    } else if (!typeByCode.has(code)) {
      typeByCode.set(code, fallbackType || 'Chính thức');
    }
  });

  return typeByCode;
};

// GET /api/statistics/dashboard?date=2024-12-10
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const targetDate = req.query.date as string | undefined;
    const startDate = req.query.start_date as string | undefined;
    const endDate = req.query.end_date as string | undefined;
    
    let dateToUse = targetDate;
    let dateUsed: string | undefined;
    let startDateUsed: string | undefined;
    let endDateUsed: string | undefined;
    if (startDate && endDate) {
      startDateUsed = startDate;
      endDateUsed = endDate;
    } else {
      if (!dateToUse) {
        const mostRecentRecord = await q1<{ date: string }>(
          'SELECT TOP 1 date FROM timekeeping_records WHERE is_archived = 0 ORDER BY date DESC',
          {}
        );
        dateToUse = mostRecentRecord?.date || new Date().toISOString().split('T')[0];
      }
      dateUsed = dateToUse;
    }

    const monthRangeForDate = (dateStr: string) => {
      const [year, month] = String(dateStr).slice(0, 7).split('-').map(Number);
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const end = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
      return { start, end };
    };

    const useArchiveForRange = !!(startDate && endDate);
    let dayRecords: any[];
    if (useArchiveForRange) {
      dayRecords = await q(
        'SELECT * FROM timekeeping_records WHERE date >= @s AND date <= @e ORDER BY date DESC',
        { s: startDate!, e: endDate! }
      );
    } else {
      dayRecords = await q(
        'SELECT * FROM timekeeping_records WHERE date = @d ORDER BY date DESC',
        { d: dateToUse! }
      );
    }
    dayRecords = dedupeLatestTimekeepingRecords(dayRecords);
    const attendedRecords = filterAttendanceRecords(dayRecords);

    let scopeRecords = dayRecords;
    if (!useArchiveForRange && dateToUse) {
      const { start, end } = monthRangeForDate(dateToUse);
      const monthRecords = await q(
        'SELECT * FROM timekeeping_records WHERE date >= @s AND date <= @e ORDER BY date DESC',
        { s: start, e: end }
      );
      scopeRecords = dedupeLatestTimekeepingRecords(monthRecords);
    }

    const scopedEmployeeCodes = new Set(
      scopeRecords
        .map((record) => resolveRecordCode(record as any))
        .filter((code) => !!code)
    );

    const employmentTypeByCode = await buildEmploymentTypeByCode(scopeRecords.length > 0 ? scopeRecords : dayRecords);
    const totalEmployees =
      scopedEmployeeCodes.size > 0
        ? scopedEmployeeCodes.size
        : Math.max(await empCount(), employmentTypeByCode.size);
    
    console.log(`[Dashboard Stats] Records found for date ${dateToUse}: ${dayRecords.length}`);
    
    // Count unique employees who attended (not total records)
    const uniqueAttendees = new Set(attendedRecords.map(resolveRecordCode)).size;
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
    const lateEmployeeCodes = new Set<string>();
    attendedRecords.forEach((r) => {
      if (computeLateInfo(r as AttendanceSignalRecord).isLate) {
        lateEmployeeCodes.add(resolveRecordCode(r as any));
      }
    });
    const lateToday = lateEmployeeCodes.size;
    
    // Calculate total hours: sum total_hours; fallback to check_in/check_out when total_hours is 0 or null
    const totalHoursToday = attendedRecords.reduce((sum, r) => sum + getRecordHours(r as RecordWithHours), 0).toFixed(1);
    
    // Calculate by employment type
    let chinhThucEmployees = 0;
    let thoiVuEmployees = 0;
    if (scopedEmployeeCodes.size > 0) {
      scopedEmployeeCodes.forEach((code) => {
        const type = employmentTypeByCode.get(code) || 'Chính thức';
        if (type === 'Thời vụ') thoiVuEmployees += 1;
        else chinhThucEmployees += 1;
      });
    } else {
      employmentTypeByCode.forEach((type) => {
        if (type === 'Thời vụ') thoiVuEmployees += 1;
        else chinhThucEmployees += 1;
      });
    }
    
    // Count unique employees who attended for each type
    const chinhThucAttendees = new Set(
      attendedRecords
        .map((record) => ({
          code: resolveRecordCode(record as any),
          type: employmentTypeByCode.get(resolveRecordCode(record as any)) || resolveEmploymentCategory('', record.department),
        }))
        .filter(({ code, type }) => !!code && type === 'Chính thức')
        .map(({ code }) => code)
    ).size;
    const thoiVuAttendees = new Set(
      attendedRecords
        .map((record) => ({
          code: resolveRecordCode(record as any),
          type: employmentTypeByCode.get(resolveRecordCode(record as any)) || resolveEmploymentCategory('', record.department),
        }))
        .filter(({ code, type }) => !!code && type === 'Thời vụ')
        .map(({ code }) => code)
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
      attendance: attendanceToday,
      attendanceRate,
      lateToday,
      totalHoursToday,
      chinhThucRate,
      thoiVuRate,
      dateUsed,
      startDateUsed,
      endDateUsed,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/statistics/late-employees?date=YYYY-MM-DD | ?start_date=&end_date=
// Danh sách bản ghi đi trễ (cùng tiêu chí lateToday trên dashboard)
export const getLateEmployees = async (req: Request, res: Response) => {
  try {
    const targetDate = req.query.date as string | undefined;
    const startDate = req.query.start_date as string | undefined;
    const endDate = req.query.end_date as string | undefined;

    let dateToUse = targetDate;
    let dateUsed: string | undefined;
    let startDateUsed: string | undefined;
    let endDateUsed: string | undefined;
    if (startDate && endDate) {
      startDateUsed = startDate;
      endDateUsed = endDate;
    } else {
      if (!dateToUse) {
        const mostRecentRecord = await q1<{ date: string }>(
          'SELECT TOP 1 date FROM timekeeping_records WHERE is_archived = 0 ORDER BY date DESC',
          {}
        );
        dateToUse = mostRecentRecord?.date || new Date().toISOString().split('T')[0];
      }
      dateUsed = dateToUse;
    }

    const useArchiveForRange = !!(startDate && endDate);
    let dayRecords: any[];
    if (useArchiveForRange) {
      dayRecords = await q(
        'SELECT * FROM timekeeping_records WHERE date >= @s AND date <= @e ORDER BY date DESC',
        { s: startDate!, e: endDate! }
      );
    } else {
      dayRecords = await q(
        'SELECT * FROM timekeeping_records WHERE date = @d ORDER BY date DESC',
        { d: dateToUse! }
      );
    }
    dayRecords = dedupeLatestTimekeepingRecords(dayRecords);
    const attendedRecords = filterAttendanceRecords(dayRecords);

    type LateRow = {
      employee_code: string;
      employee_name: string;
      department: string;
      date: string;
      check_in: string;
      check_out: string;
      late_minutes: number;
      effective_late_minutes: number;
      late_reason: 'late_minutes' | 'check_in_after_8';
    };

    const items: LateRow[] = [];
    for (const r of attendedRecords) {
      const info = computeLateInfo(r as AttendanceSignalRecord);
      if (!info.isLate || !info.reason) continue;
      const code = resolveRecordCode(r as any);
      if (!code) continue;
      items.push({
        employee_code: code,
        employee_name: String((r as any).employee_name || ''),
        department: String((r as any).department || ''),
        date: String((r as any).date || '').slice(0, 10),
        check_in: String((r as any).check_in || ''),
        check_out: String((r as any).check_out || ''),
        late_minutes: Number((r as any).late_minutes) || 0,
        effective_late_minutes: info.effectiveMinutes,
        late_reason: info.reason,
      });
    }

    items.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      if (b.effective_late_minutes !== a.effective_late_minutes) {
        return b.effective_late_minutes - a.effective_late_minutes;
      }
      return a.employee_name.localeCompare(b.employee_name, 'vi');
    });

    res.json({
      total: items.length,
      items,
      dateUsed,
      startDateUsed,
      endDateUsed,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/statistics/gender
export const getGenderStats = async (req: Request, res: Response) => {
  try {
    const employees = await q('SELECT * FROM employees', {});
    const male = employees.filter((e: any) => e.gender === 'Nam').length;
    const female = employees.filter((e: any) => e.gender === 'Nữ').length;
    
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
    const employees = await q('SELECT * FROM employees', {});
    const groups = [
      { range: '18-30', min: 18, max: 30, count: 0, color: '#3B82F6' },
      { range: '30-40', min: 30, max: 40, count: 0, color: '#10B981' },
      { range: '40-50', min: 40, max: 50, count: 0, color: '#F59E0B' },
      { range: '50+', min: 50, max: 100, count: 0, color: '#EF4444' },
    ];
    
    employees.forEach((emp: any) => {
      const group = groups.find((g) => emp.age >= g.min && emp.age <= g.max);
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
    const activeRecords = await q(
      'SELECT employee_code, employee_name, department FROM timekeeping_records WHERE is_archived = 0',
      {}
    );
    const typeByCode = await buildEmploymentTypeByCode(activeRecords as any[]);
    let chinhThuc = 0;
    let thoiVu = 0;
    typeByCode.forEach((type) => {
      if (type === 'Thời vụ') thoiVu += 1;
      else chinhThuc += 1;
    });
    
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
        const mostRecentRecord = await q1<{ date: string }>(
          'SELECT TOP 1 date FROM timekeeping_records WHERE is_archived = 0 ORDER BY date DESC',
          {}
        );
        dateToUse = mostRecentRecord?.date || new Date().toISOString().split('T')[0];
      }
      rangeFilter = dateToUse;
    }

    const monthRangeForDate = (dateStr: string) => {
      const [year, month] = String(dateStr).slice(0, 7).split('-').map(Number);
      return {
        start: `${year}-${String(month).padStart(2, '0')}-01`,
        end: `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`,
      };
    };
    
    // Get departments from employees (authoritative) + from today's/month's records (fallback)
    const allEmployees = await q<{ department: string }>('SELECT department FROM employees', {});
    const dayRecords =
      typeof rangeFilter === 'string'
        ? await q(
            'SELECT * FROM timekeeping_records WHERE date = @d',
            { d: rangeFilter }
          )
        : await q(
            'SELECT * FROM timekeeping_records WHERE date >= @s AND date <= @e',
            { s: (rangeFilter as any).gte, e: (rangeFilter as any).lte }
          );
    const attendedRecords = filterAttendanceRecords(dedupeLatestTimekeepingRecords(dayRecords));

    const scopeRecordsRaw =
      typeof rangeFilter === 'string'
        ? await q(
            'SELECT * FROM timekeeping_records WHERE date >= @s AND date <= @e',
            (() => {
              const { start, end } = monthRangeForDate(rangeFilter);
              return { s: start, e: end };
            })()
          )
        : dayRecords;
    const scopeRecords = dedupeLatestTimekeepingRecords(scopeRecordsRaw);

    // Map normalized dept -> display name (prefer employee table, fallback record)
    const deptDisplayMap = new Map<string, string>();
    allEmployees.forEach(e => {
      const norm = normalizeDept(e.department);
      if (!norm) return;
      if (!deptDisplayMap.has(norm)) {
        deptDisplayMap.set(norm, (e.department || '').trim());
      }
    });
    attendedRecords.forEach(r => {
      const norm = normalizeDept(r.department);
      if (!norm) return;
      if (!deptDisplayMap.has(norm)) {
        deptDisplayMap.set(norm, (r.department || '').trim());
      }
    });

    const blacklist = new Set(['test', 'ko', 'thoi vu', 'thoi_vu', 'thoivu', 'kg']);
    
    // Get all employees with their codes and departments for accurate matching
    const allEmployeesList = await q<{ employee_code: string; department: string }>(
      'SELECT employee_code, department FROM employees',
      {}
    );
    
    // Create a map: normalized employee_code -> normalized department
    const employeeDeptMap = new Map<string, string>();
    allEmployeesList.forEach(emp => {
      employeeDeptMap.set(normalizeCode(emp.employee_code), normalizeDept(emp.department));
    });
    
    // Create scoped department headcount based on codes that appear in current timekeeping scope.
    const deptEmployeeMap = new Map<string, Set<string>>();
    scopeRecords.forEach((record: any) => {
      const code = resolveRecordCode(record as any);
      if (!code) return;
      const actualDept = employeeDeptMap.get(code) || normalizeDept(record.department);
      if (!actualDept || blacklist.has(actualDept)) return;
      if (!deptEmployeeMap.has(actualDept)) {
        deptEmployeeMap.set(actualDept, new Set());
      }
      deptEmployeeMap.get(actualDept)!.add(code);
    });

    const departments = [...new Set([
      ...deptEmployeeMap.keys(),
      ...attendedRecords.map(r => normalizeDept(r.department))
    ].filter(Boolean))].filter(d => !blacklist.has(d));
    
    const result = await Promise.all(
      departments.map(async (dept) => {
        const normDept = dept;
        const deptEmployeeCodes = new Set(deptEmployeeMap.get(normDept) || []);
        let deptEmployees = deptEmployeeCodes.size;

        // Filter records: prefer employee table mapping; if missing, use record.department match
        const deptRecords = attendedRecords.filter(r => {
          const code = resolveRecordCode(r as any);
          const actualDept = employeeDeptMap.get(code);
          if (actualDept === normDept) return true;
          const recordDept = normalizeDept(r.department);
          if (!actualDept && recordDept === normDept) {
            deptEmployeeCodes.add(code);
            return true;
          }
          return false;
        });

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
    const employees = await q('SELECT * FROM employees', {});
    const chinhThuc = employees.filter((e: any) => e.employment_type === 'Chính thức');
    const thoiVu = employees.filter((e: any) => e.employment_type === 'Thời vụ');
    const chinhThucNam = chinhThuc.filter((e: any) => e.gender === 'Nam').length;
    const chinhThucNu = chinhThuc.filter((e: any) => e.gender === 'Nữ').length;
    const thoiVuNam = thoiVu.filter((e: any) => e.gender === 'Nam').length;
    const thoiVuNu = thoiVu.filter((e: any) => e.gender === 'Nữ').length;
    
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
// Lấy số lượng đi làm theo từng ngày trong 7 ngày gần nhất — dùng CẢ dữ liệu mới và đã archive
// để biểu đồ luôn hiển thị đủ 7 ngày (khi user upload theo đợt, ngày trước nằm ở lịch sử vẫn hiện).
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
    
    // Lấy CẢ dữ liệu mới (0) và đã archive (1) cho 7 ngày — để mỗi ngày có bản ghi đều hiện trên biểu đồ
    const inList = dates.map((d) => `'${String(d).replace(/'/g, "''")}'`).join(',');
    const records = await q(`SELECT * FROM timekeeping_records WHERE date IN (${inList})`, {});
    const attendedRecords = filterAttendanceRecords(dedupeLatestTimekeepingRecords(records));
    
    const result = dates.map(date => {
      const dayRecords = attendedRecords.filter(r => r.date === date);
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

// GET /api/statistics/realtime?start_time=08:00&end_time=17:00
export const getRealtimeStats = async (req: Request, res: Response) => {
  try {
    const startTime = req.query.start_time as string || '08:00';
    const endTime = req.query.end_time as string || '17:00';
    
    // Get current date
    const today = new Date().toISOString().split('T')[0];
    
    // Parse time strings to minutes for comparison
    const parseTime = (timeStr: string): number => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return (hours || 0) * 60 + (minutes || 0);
    };
    
    const startMinutes = parseTime(startTime);
    const endMinutes = parseTime(endTime);
    
    // Get today's records
    const todayRecords = await q(
      'SELECT * FROM timekeeping_records WHERE date = @d',
      { d: today }
    );
    const attendedTodayRecords = filterAttendanceRecords(dedupeLatestTimekeepingRecords(todayRecords));
    
    // Filter records within time range
    const inRangeRecords = attendedTodayRecords.filter(r => {
      if (!r.check_in) return false;
      const [hours, minutes] = r.check_in.split(':').map(Number);
      const checkInMinutes = (hours || 0) * 60 + (minutes || 0);
      return checkInMinutes >= startMinutes && checkInMinutes <= endMinutes;
    });
    
    // Count unique employees currently working
    const currentEmployees = new Set(
      inRangeRecords.map(r => resolveRecordCode(r as any))
    ).size;
    
    // Count employees on break (checked in but checked out)
    const onBreakEmployees = new Set(
      inRangeRecords
        .filter(r => r.check_in && r.check_out)
        .map(r => resolveRecordCode(r as any))
    ).size;
    
    // Count late employees
    const lateEmployees = new Set(
      inRangeRecords
        .filter(r => {
          if (r.late_minutes > 0) return true;
          if (!r.check_in) return false;
          const [hours, minutes] = r.check_in.split(':').map(Number);
          const checkInMinutes = (hours || 0) * 60 + (minutes || 0);
          return checkInMinutes > 8 * 60; // After 8:00 AM
        })
        .map(r => resolveRecordCode(r as any))
    ).size;
    
    // Count absent employees (total employees - those who checked in)
    const totalEmployees = await empCount();
    const checkedInEmployees = new Set(
      attendedTodayRecords
        .filter(r => r.check_in && String(r.check_in).trim() !== '')
        .map(r => resolveRecordCode(r as any))
    ).size;
    const absentEmployees = Math.max(0, totalEmployees - checkedInEmployees);
    
    // Get list of employees currently working
    const employeesList = inRangeRecords
      .filter(r => r.check_in && !r.check_out) // Currently working (not checked out)
      .map(r => ({
        code: resolveRecordCode(r as any),
        name: r.employee_name || 'N/A',
        department: r.department || 'N/A',
      }))
      .filter((emp, index, self) => 
        index === self.findIndex(e => e.code === emp.code)
      ); // Remove duplicates
    
    res.json({
      current: currentEmployees - onBreakEmployees, // Working (not on break)
      onBreak: onBreakEmployees,
      late: lateEmployees,
      absent: absentEmployees,
      employees: employeesList,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/statistics/range?start_date=2024-12-01&end_date=2024-12-31&department=...
export const getRangeStats = async (req: Request, res: Response) => {
  try {
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;
    const department = req.query.department as string | undefined;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }
    
    if (department && department !== 'all') {
      const normDept = normalizeDept(department);
      const allEmployees = await q<{ employee_code: string; department: string }>(
        'SELECT employee_code, department FROM employees',
        {}
      );
      const employeeDeptMap = new Map<string, string>();
      allEmployees.forEach((emp) => {
        employeeDeptMap.set(normalizeCode(emp.employee_code), normalizeDept(emp.department));
      });
      const allRecords = await q(
        'SELECT * FROM timekeeping_records WHERE date >= @sd AND date <= @ed',
        { sd: startDate, ed: endDate }
      );
      const filteredRecords = filterAttendanceRecords(dedupeLatestTimekeepingRecords(allRecords).filter(r => {
        const code = resolveRecordCode(r as any);
        const empDept = employeeDeptMap.get(code);
        return empDept === normDept || normalizeDept(r.department) === normDept;
      }));
      
      // Calculate stats
      const uniqueEmployees = new Set(filteredRecords.map(r => resolveRecordCode(r as any))).size;
      const totalDays = filteredRecords.length;
      const totalHours = filteredRecords.reduce((sum, r) => sum + getRecordHours(r as RecordWithHours), 0);
      const totalOvertime = filteredRecords.reduce((sum, r) => sum + (r.overtime_hours || 0), 0);
      
      return res.json({
        totalEmployees: uniqueEmployees,
        totalDays,
        totalHours: parseFloat(totalHours.toFixed(1)),
        totalOvertime: parseFloat(totalOvertime.toFixed(1)),
      });
    }
    
    const records = await q(
      'SELECT * FROM timekeeping_records WHERE date >= @sd AND date <= @ed',
      { sd: startDate, ed: endDate }
    );
    const attendedRecords = filterAttendanceRecords(dedupeLatestTimekeepingRecords(records));
    const uniqueEmployees = new Set(attendedRecords.map(r => resolveRecordCode(r as any))).size;
    const totalDays = attendedRecords.length;
    const totalHours = attendedRecords.reduce((sum, r) => sum + getRecordHours(r as RecordWithHours), 0);
    const totalOvertime = attendedRecords.reduce((sum, r) => sum + (r.overtime_hours || 0), 0);
    
    res.json({
      totalEmployees: uniqueEmployees,
      totalDays,
      totalHours: parseFloat(totalHours.toFixed(1)),
      totalOvertime: parseFloat(totalOvertime.toFixed(1)),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/statistics/compare?type=department&ids=dept1,dept2
// GET /api/statistics/compare?type=period&periods=2024-12-01:2024-12-15,2024-11-01:2024-11-15
export const getCompareStats = async (req: Request, res: Response) => {
  try {
    const type = req.query.type as 'department' | 'period';
    const ids = req.query.ids as string | undefined;
    const periods = req.query.periods as string | undefined;
    
    if (type === 'department' && ids) {
      // Compare departments
      const deptIds = ids.split(',').map(d => d.trim());
      const allEmployees = await q<{ employee_code: string; department: string }>(
        'SELECT employee_code, department FROM employees',
        {}
      );
      const employeeDeptMap = new Map<string, string>();
      allEmployees.forEach((emp) => {
        employeeDeptMap.set(normalizeCode(emp.employee_code), normalizeDept(emp.department));
      });
      const today = new Date().toISOString().split('T')[0];
      const records = await q(
        'SELECT * FROM timekeeping_records WHERE date = @d',
        { d: today }
      );
      const attendedRecords = filterAttendanceRecords(dedupeLatestTimekeepingRecords(records));
      
      const results = await Promise.all(
        deptIds.map(async (deptId) => {
          const normDept = normalizeDept(deptId);
          const deptRecords = attendedRecords.filter(r => {
            const code = resolveRecordCode(r as any);
            const empDept = employeeDeptMap.get(code);
            return empDept === normDept || normalizeDept(r.department) === normDept;
          });
          
          const uniqueEmployees = new Set(deptRecords.map(r => resolveRecordCode(r as any))).size;
          const totalHours = deptRecords.reduce((sum, r) => sum + getRecordHours(r as RecordWithHours), 0);
          const totalDays = deptRecords.length;
          
          // Get total employees in department
          const deptEmployeeCount = allEmployees.filter(emp => 
            normalizeDept(emp.department) === normDept
          ).length;
          
          const attendanceRate = deptEmployeeCount > 0
            ? ((uniqueEmployees / deptEmployeeCount) * 100).toFixed(1)
            : '0';
          
          return {
            id: deptId,
            attendanceRate: parseFloat(attendanceRate),
            totalHours: parseFloat(totalHours.toFixed(1)),
            totalDays,
            uniqueEmployees,
          };
        })
      );
      
      return res.json(results);
    }
    
    if (type === 'period' && periods) {
      // Compare periods
      const periodList = periods.split(',').map(p => {
        const [start, end] = p.split(':').map(s => s.trim());
        return { start, end };
      });
      
      const results = await Promise.all(
        periodList.map(async (period) => {
          const records = await q(
            'SELECT * FROM timekeeping_records WHERE date >= @s AND date <= @e',
            { s: period.start, e: period.end }
          );
          const attendedRecords = filterAttendanceRecords(dedupeLatestTimekeepingRecords(records));
          
          const uniqueEmployees = new Set(attendedRecords.map(r => resolveRecordCode(r as any))).size;
          const totalHours = attendedRecords.reduce((sum, r) => sum + getRecordHours(r as RecordWithHours), 0);
          const totalDays = attendedRecords.length;
          
          const totalEmployees = await empCount();
          const rawRate = totalEmployees > 0
            ? (uniqueEmployees / totalEmployees) * 100
            : 0;
          const attendanceRate = Math.min(rawRate, 100);
          
          return {
            period: `${period.start} to ${period.end}`,
            attendanceRate: parseFloat(attendanceRate.toFixed(1)),
            totalHours: parseFloat(totalHours.toFixed(1)),
            totalDays,
            uniqueEmployees,
          };
        })
      );
      
      return res.json(results);
    }
    
    res.status(400).json({ error: 'Invalid parameters' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/statistics/weekly-temporary-workers?start_date=2024-01-01&end_date=2024-01-07
// Lấy thống kê công nhân thời vụ đi làm 1 ngày trong tuần
export const getWeeklyTemporaryWorkers = async (req: Request, res: Response) => {
  try {
    const startDate = (req.query.start_date as string)?.trim();
    const endDate = (req.query.end_date as string)?.trim();
    
    let weekStart: string;
    let weekEnd: string;
    
    if (startDate && endDate) {
      weekStart = startDate;
      weekEnd = endDate;
    } else {
      // Mặc định: lấy tuần có bản ghi chấm công mới nhất (cả archive) để trang có số liệu khi mở
      const latestRecord = await q1<{ date: string }>(
        'SELECT TOP 1 date FROM timekeeping_records ORDER BY date DESC',
        {}
      );
      const refDate = latestRecord?.date
        ? new Date(latestRecord.date + 'T12:00:00')
        : new Date();
      const dayOfWeek = refDate.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(refDate);
      monday.setDate(refDate.getDate() + diff);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      weekStart = monday.toISOString().split('T')[0];
      weekEnd = sunday.toISOString().split('T')[0];
    }
    
    console.log(`[Weekly Temporary Workers] Week: ${weekStart} to ${weekEnd}`);
    
    // Lấy tất cả công nhân thời vụ
    const temporaryWorkers = await q(
      "SELECT id, employee_code, name, department FROM employees WHERE employment_type = @et",
      { et: 'Thời vụ' }
    );
    
    console.log(`[Weekly Temporary Workers] Total temporary workers: ${temporaryWorkers.length}`);
    
    // Tạo map employee_code -> employee info
    const workerMap = new Map<string, typeof temporaryWorkers[0]>();
    temporaryWorkers.forEach(worker => {
      workerMap.set(normalizeCode(worker.employee_code), worker);
    });
    
    // Lấy tất cả records chấm công trong tuần (cả dữ liệu mới + archive) để báo cáo đủ khi user chọn tuần đã có data ở lịch sử
    const weekRecords = await q(
      'SELECT * FROM timekeeping_records WHERE date >= @s AND date <= @e',
      { s: weekStart, e: weekEnd }
    );
    const attendedWeekRecords = filterAttendanceRecords(dedupeLatestTimekeepingRecords(weekRecords));
    
    console.log(`[Weekly Temporary Workers] Total records in week: ${weekRecords.length} (attended: ${attendedWeekRecords.length})`);
    
    // Đếm số ngày đi làm của MỌI nhân viên (từ chấm công) để có danh sách "đi làm 1 ngày"
    const workerDayCountAll = new Map<string, Set<string>>();
    attendedWeekRecords.forEach(record => {
      const code = resolveRecordCode(record as any);
      const normalizedCode = normalizeCode(code);
      if (!normalizedCode) return;
      if (!workerDayCountAll.has(normalizedCode)) {
        workerDayCountAll.set(normalizedCode, new Set());
      }
      workerDayCountAll.get(normalizedCode)!.add(record.date);
    });
    
    // Map tất cả nhân viên (để lấy tên, phòng ban, loại hình) — dùng cho danh sách
    const allEmployees = await q(
      'SELECT employee_code, name, department, employment_type FROM employees',
      {}
    );
    const allEmployeeMap = new Map<string, (typeof allEmployees)[0]>();
    allEmployees.forEach(emp => allEmployeeMap.set(normalizeCode(emp.employee_code), emp));
    
    // Danh sách TẤT CẢ nhân viên đi làm đúng 1 ngày trong tuần (từ chấm công)
    const workersWithOneDayAll: Array<{
      employee_code: string;
      name: string;
      department: string;
      work_date: string;
      check_in?: string;
      check_out?: string;
      employment_type?: string;
    }> = [];
    
    workerDayCountAll.forEach((dates, normalizedCode) => {
      if (dates.size !== 1) return;
      const workDate = Array.from(dates)[0];
      const record = attendedWeekRecords.find(r => {
        const code = resolveRecordCode(r as any);
        return normalizeCode(code) === normalizedCode && r.date === workDate;
      });
      if (!record) return;
      const emp = allEmployeeMap.get(normalizedCode);
      workersWithOneDayAll.push({
        employee_code: emp?.employee_code ?? (record as any).employee_code ?? normalizedCode,
        name: emp?.name ?? (record as any).employee_name ?? '—',
        department: emp?.department ?? (record as any).department ?? '—',
        work_date: workDate,
        check_in: record.check_in,
        check_out: record.check_out,
        employment_type: emp?.employment_type,
      });
    });
    
    workersWithOneDayAll.sort((a, b) => a.work_date.localeCompare(b.work_date));
    const workersWithOneDayThoiVu = workersWithOneDayAll.filter(w => w.employment_type === 'Thời vụ');
    console.log(`[Weekly Temporary Workers] Workers with 1 day (all): ${workersWithOneDayAll.length}, thời vụ: ${workersWithOneDayThoiVu.length}`);

    // Chỉ trả về danh sách công nhân THỜI VỤ đi làm đúng 1 ngày (không lẫn VPQL hay bộ phận khác)
    res.json({
      week_start: weekStart,
      week_end: weekEnd,
      total_temporary_workers: temporaryWorkers.length,
      workers_with_one_day: workersWithOneDayThoiVu.length,
      workers: workersWithOneDayThoiVu,
      summary: {
        by_date: (() => {
          const byDate: Record<string, number> = {};
          workersWithOneDayThoiVu.forEach(worker => {
            byDate[worker.work_date] = (byDate[worker.work_date] || 0) + 1;
          });
          return byDate;
        })(),
        by_department: (() => {
          const byDept: Record<string, number> = {};
          workersWithOneDayThoiVu.forEach(worker => {
            byDept[worker.department] = (byDept[worker.department] || 0) + 1;
          });
          return byDept;
        })(),
      },
      debug: {
        total_records_in_week: attendedWeekRecords.length,
        unique_workers_in_week: workerDayCountAll.size,
        workers_with_one_day_any: workersWithOneDayAll.length,
      },
    });
  } catch (error: any) {
    console.error('[Weekly Temporary Workers] Error:', error);
    res.status(500).json({ error: error.message });
  }
};


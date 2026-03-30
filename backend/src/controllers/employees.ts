import { Request, Response } from 'express';
import { query, queryOne, exec, transaction } from '../db/sqlServer';
import { createNotification } from './notifications';

type EmpRow = Record<string, unknown>;
const FAMILY_MEMBER_BATCH_SIZE = 1000;

const decodeQueryText = (value: unknown) => {
  const raw = String(value ?? '').replace(/\+/g, ' ').trim();
  if (!raw) return '';
  const maybeRepairMojibake = (input: string) => {
    if (!/(Ã.|Â.|Ä.|áº.|á».|Æ.|Ä‘)/.test(input)) {
      return input;
    }
    try {
      return Buffer.from(input, 'latin1').toString('utf8');
    } catch {
      return input;
    }
  };
  try {
    return maybeRepairMojibake(decodeURIComponent(raw));
  } catch {
    return maybeRepairMojibake(raw);
  }
};

const normalizeTextValue = (value: unknown) =>
  decodeQueryText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const isOfficialEmploymentType = (employmentType: unknown) => {
  const normalized = normalizeTextValue(employmentType);
  return normalized.includes('chinh thuc') || normalized.includes('official') || normalized.includes('정규');
};

const isSeasonalEmploymentType = (employmentType: unknown) => {
  const normalized = normalizeTextValue(employmentType);
  return (
    normalized.includes('thoi vu') ||
    normalized.includes('thoivu') ||
    normalized.includes('seasonal') ||
    normalized.includes('temp') ||
    normalized.includes('계약') ||
    normalized.includes('비정규')
  );
};

const matchesEmploymentType = (actualEmploymentType: unknown, requestedEmploymentType: unknown) => {
  const requested = normalizeTextValue(requestedEmploymentType);
  if (!requested) return true;
  if (isSeasonalEmploymentType(requestedEmploymentType)) return isSeasonalEmploymentType(actualEmploymentType);
  if (isOfficialEmploymentType(requestedEmploymentType)) return isOfficialEmploymentType(actualEmploymentType);
  return normalizeTextValue(actualEmploymentType) === requested;
};

async function loadFamilyMap(employeeIds: number[]): Promise<Map<number, EmpRow[]>> {
  const m = new Map<number, EmpRow[]>();
  if (!employeeIds.length) return m;
  for (let start = 0; start < employeeIds.length; start += FAMILY_MEMBER_BATCH_SIZE) {
    const batch = employeeIds.slice(start, start + FAMILY_MEMBER_BATCH_SIZE);
    const placeholders = batch.map((_, i) => `@id${i}`).join(',');
    const params: Record<string, unknown> = {};

    batch.forEach((id, i) => {
      params[`id${i}`] = id;
    });

    const rows = await query<EmpRow>(
      `SELECT * FROM family_members WHERE employee_id IN (${placeholders})`,
      params
    );

    for (const r of rows) {
      const eid = r.employee_id as number;
      if (!m.has(eid)) m.set(eid, []);
      m.get(eid)!.push(r);
    }
  }
  return m;
}

function attachFamily(emp: EmpRow, famMap: Map<number, EmpRow[]>) {
  const id = emp.id as number;
  return { ...emp, family_members: famMap.get(id) || [] };
}

export const getEmployees = async (req: Request, res: Response) => {
  try {
    const { search, department, employment_type, employee_code, name } = req.query;
    let sql = 'SELECT * FROM employees WHERE 1=1';
    const params: Record<string, unknown> = {};
    if (department && department !== 'all') {
      sql += ' AND department = @dept';
      params.dept = department;
    }
    sql += ' ORDER BY updated_at DESC, created_at DESC';
    let employees = await query<EmpRow>(sql, params);
    if (employment_type) {
      employees = employees.filter((emp) => matchesEmploymentType(emp.employment_type, employment_type));
    }
    const employeeCodeTerm = normalizeTextValue(employee_code);
    if (employeeCodeTerm) {
      employees = employees.filter((emp: any) =>
        normalizeTextValue(emp.employee_code).includes(employeeCodeTerm)
      );
    }
    const employeeNameTerm = normalizeTextValue(name);
    if (employeeNameTerm) {
      employees = employees.filter((emp: any) =>
        normalizeTextValue(emp.name).includes(employeeNameTerm)
      );
    }
    if (search) {
      const term = normalizeTextValue(search);
      if (term) {
        employees = employees.filter(
          (emp: any) =>
            normalizeTextValue(emp.employee_code).includes(term) ||
            normalizeTextValue(emp.name).includes(term)
        );
      }
    }
    const ids = employees.map((e) => e.id as number);
    const famMap = await loadFamilyMap(ids);
    employees = employees.map((e) => attachFamily(e, famMap) as any);
    res.json(employees);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getEmployeesOfficial = async (_req: Request, res: Response) => {
  try {
    const store = await queryOne<{ headers: string; rows: string }>(
      "SELECT headers, rows FROM employee_excel_store WHERE type = 'official'",
      {}
    );
    if (!store) return res.json({ headers: [], rows: [] });
    res.json({
      headers: JSON.parse(store.headers || '[]'),
      rows: JSON.parse(store.rows || '[]'),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getEmployeesSeasonal = async (_req: Request, res: Response) => {
  try {
    const store = await queryOne<{ headers: string; rows: string }>(
      "SELECT headers, rows FROM employee_excel_store WHERE type = 'seasonal'",
      {}
    );
    if (!store) return res.json({ headers: [], rows: [] });
    res.json({
      headers: JSON.parse(store.headers || '[]'),
      rows: JSON.parse(store.rows || '[]'),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getEmployeeById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    const employee = await queryOne<EmpRow>('SELECT * FROM employees WHERE id = @id', { id });
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    const fam = await query('SELECT * FROM family_members WHERE employee_id = @id', { id });
    res.json({ ...employee, family_members: fam });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createEmployee = async (req: Request, res: Response) => {
  try {
    const {
      employee_code,
      name,
      gender,
      date_of_birth,
      department,
      employment_type,
      cccd,
      hometown,
      permanent_residence,
      temporary_residence,
      marital_status,
      phone,
      avatar_url,
      family_relations,
    } = req.body;
    const birthDate = new Date(date_of_birth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    const now = new Date().toISOString();
    const rows = await query<EmpRow>(
      `INSERT INTO employees (
        employee_code, name, gender, date_of_birth, age, department, employment_type,
        cccd, hometown, permanent_residence, temporary_residence, marital_status, phone, avatar_url,
        created_at, updated_at
      ) OUTPUT INSERTED.*
      VALUES (
        @employee_code, @name, @gender, @date_of_birth, @age, @department, @employment_type,
        @cccd, @hometown, @permanent_residence, @temporary_residence, @marital_status, @phone, @avatar_url,
        @created_at, @updated_at
      )`,
      {
        employee_code,
        name,
        gender,
        date_of_birth,
        age,
        department,
        employment_type,
        cccd: cccd || null,
        hometown: hometown || null,
        permanent_residence: permanent_residence || null,
        temporary_residence: temporary_residence || null,
        marital_status: marital_status || null,
        phone: phone || null,
        avatar_url: avatar_url || null,
        created_at: now,
        updated_at: now,
      }
    );
    const employee = rows[0];
    const eid = employee.id as number;
    for (const member of family_relations || []) {
      await exec(
        `INSERT INTO family_members (employee_id, relation, name, occupation) VALUES (@eid, @r, @n, @o)`,
        {
          eid,
          r: member.relation,
          n: member.name,
          o: member.occupation || '',
        }
      );
    }
    const fam = await query('SELECT * FROM family_members WHERE employee_id = @id', { id: eid });
    await createNotification(
      'new_employees',
      'Có 1 nhân viên mới được thêm',
      `Nhân viên ${name} (${employee_code}) đã được thêm vào hệ thống`,
      { count: 1, employee_code, employee_name: name, link: '/employees' }
    );
    res.status(201).json({ ...employee, family_members: fam });
  } catch (error: any) {
    if (error.number === 2627 || error.code === 'EREQUEST') {
      return res.status(400).json({ error: 'Employee code already exists' });
    }
    res.status(500).json({ error: error.message });
  }
};

export const updateEmployee = async (req: Request, res: Response) => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid employee ID' });
    const {
      employee_code,
      name,
      gender,
      date_of_birth,
      department,
      employment_type,
      cccd,
      hometown,
      permanent_residence,
      temporary_residence,
      marital_status,
      phone,
      avatar_url,
      family_relations,
    } = req.body;
    let age: number | undefined;
    if (date_of_birth) {
      const birthDate = new Date(date_of_birth);
      if (!isNaN(birthDate.getTime())) {
        const today = new Date();
        age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
      }
    }
    const cur = await queryOne<EmpRow>('SELECT * FROM employees WHERE id = @id', { id });
    if (!cur) return res.status(404).json({ error: 'Employee not found' });
    const now = new Date().toISOString();
    await exec(
      `UPDATE employees SET
        employee_code = COALESCE(@employee_code, employee_code),
        name = COALESCE(@name, name),
        gender = COALESCE(@gender, gender),
        date_of_birth = COALESCE(@date_of_birth, date_of_birth),
        age = COALESCE(@age, age),
        department = COALESCE(@department, department),
        employment_type = COALESCE(@employment_type, employment_type),
        cccd = @cccd,
        hometown = @hometown,
        permanent_residence = @permanent_residence,
        temporary_residence = @temporary_residence,
        marital_status = @marital_status,
        phone = @phone,
        avatar_url = @avatar_url,
        updated_at = @updated_at
      WHERE id = @id`,
      {
        id,
        employee_code: employee_code ?? cur.employee_code,
        name: name ?? cur.name,
        gender: gender ?? cur.gender,
        date_of_birth: date_of_birth ?? cur.date_of_birth,
        age: age ?? cur.age,
        department: department ?? cur.department,
        employment_type: employment_type ?? cur.employment_type,
        cccd: cccd !== undefined ? cccd || null : cur.cccd,
        hometown: hometown !== undefined ? hometown || null : cur.hometown,
        permanent_residence:
          permanent_residence !== undefined ? permanent_residence || null : cur.permanent_residence,
        temporary_residence:
          temporary_residence !== undefined ? temporary_residence || null : cur.temporary_residence,
        marital_status: marital_status !== undefined ? marital_status || null : cur.marital_status,
        phone: phone !== undefined ? phone || null : cur.phone,
        avatar_url: avatar_url !== undefined ? avatar_url || null : cur.avatar_url,
        updated_at: now,
      }
    );
    if (family_relations !== undefined) {
      await exec('DELETE FROM family_members WHERE employee_id = @id', { id });
      for (const member of family_relations || []) {
        await exec(
          `INSERT INTO family_members (employee_id, relation, name, occupation) VALUES (@id, @r, @n, @o)`,
          { id, r: member.relation, n: member.name, o: member.occupation || '' }
        );
      }
    }
    const employee = await queryOne<EmpRow>('SELECT * FROM employees WHERE id = @id', { id });
    const fam = await query('SELECT * FROM family_members WHERE employee_id = @id', { id });
    res.json({ ...employee, family_members: fam });
  } catch (error: any) {
    if (error.number === 2627) {
      return res.status(400).json({ error: 'Employee code already exists' });
    }
    res.status(500).json({ error: error.message });
  }
};

export const deleteEmployee = async (req: Request, res: Response) => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    const n = await exec('DELETE FROM employees WHERE id = @id', { id });
    if (!n) return res.status(404).json({ error: 'Employee not found' });
    res.json({ message: 'Employee deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteAllEmployees = async (_req: Request, res: Response) => {
  try {
    await transaction(async (run) => {
      await run('DELETE FROM family_members', {});
      await run('DELETE FROM employees', {});
    });
    res.json({ message: 'All employees deleted successfully', count: 'all' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

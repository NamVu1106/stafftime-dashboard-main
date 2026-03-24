import { Request, Response } from 'express';
import { query, queryOne, exec, transaction } from '../db/sqlServer';

type TkRow = Record<string, unknown>;

function mapTkRow(r: TkRow) {
  return { ...r, employee: null };
}

export const getTimekeeping = async (req: Request, res: Response) => {
  try {
    const { date, start_date, end_date, department, employee_code, search, archived, page, limit } =
      req.query;
    const parts: string[] = [];
    const params: Record<string, unknown> = {};
    if (archived === 'true') {
      parts.push('is_archived = 1');
    } else {
      parts.push('is_archived = 0');
    }
    if (date) {
      parts.push('date = @d');
      params.d = date;
    } else if (start_date && end_date) {
      parts.push('date >= @sd AND date <= @ed');
      params.sd = start_date;
      params.ed = end_date;
    }
    if (department && department !== 'all') {
      parts.push('department = @dept');
      params.dept = department;
    }
    const where = parts.length ? 'WHERE ' + parts.join(' AND ') : '';
    let allRecords = await query<TkRow>(
      `SELECT * FROM timekeeping_records ${where} ORDER BY created_at DESC, date DESC, employee_code ASC`,
      params
    );
    allRecords = allRecords.map(mapTkRow);
    const searchTerm = (search || employee_code) as string;
    if (searchTerm) {
      const term = searchTerm.trim().toLowerCase();
      if (term) {
        allRecords = allRecords.filter(
          (r) =>
            String(r.employee_code).toLowerCase().includes(term) ||
            String(r.employee_name).toLowerCase().includes(term)
        );
      }
    }
    const pageNum = page ? parseInt(page as string, 10) : 1;
    const limitNum = limit ? parseInt(limit as string, 10) : 20;
    const skip = (pageNum - 1) * limitNum;
    const total = allRecords.length;
    const data = allRecords.slice(skip, skip + limitNum);
    res.json({
      data,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTimekeepingById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    const record = await queryOne<TkRow>('SELECT * FROM timekeeping_records WHERE id = @id', { id });
    if (!record) {
      return res.status(404).json({ error: 'Timekeeping record not found' });
    }
    res.json(mapTkRow(record));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createTimekeeping = async (req: Request, res: Response) => {
  try {
    const b = req.body;
    let finalEmployeeId: number | null = b.employee_id || null;
    if (!finalEmployeeId && b.employee_code) {
      const e = await queryOne<{ id: number }>(
        'SELECT id FROM employees WHERE employee_code = @c',
        { c: b.employee_code }
      );
      if (e) finalEmployeeId = e.id;
    }
    const now = new Date().toISOString();
    const rows = await query<TkRow>(
      `INSERT INTO timekeeping_records (
        employee_code, employee_id, employee_name, date, day_of_week, check_in, check_out,
        late_minutes, early_minutes, workday, total_hours, overtime_hours, total_all_hours,
        shift, department, created_at, is_archived
      ) OUTPUT INSERTED.*
      VALUES (
        @employee_code, @employee_id, @employee_name, @date, @day_of_week, @check_in, @check_out,
        @late_minutes, @early_minutes, @workday, @total_hours, @overtime_hours, @total_all_hours,
        @shift, @department, @created_at, 0
      )`,
      {
        employee_code: b.employee_code,
        employee_id: finalEmployeeId,
        employee_name: b.employee_name,
        date: b.date,
        day_of_week: b.day_of_week,
        check_in: b.check_in,
        check_out: b.check_out,
        late_minutes: b.late_minutes ?? 0,
        early_minutes: b.early_minutes ?? 0,
        workday: b.workday,
        total_hours: b.total_hours,
        overtime_hours: b.overtime_hours ?? 0,
        total_all_hours: b.total_all_hours,
        shift: b.shift,
        department: b.department,
        created_at: now,
      }
    );
    res.status(201).json(mapTkRow(rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateTimekeeping = async (req: Request, res: Response) => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    const u = req.body;
    const cur = await queryOne<TkRow>('SELECT * FROM timekeeping_records WHERE id = @id', { id });
    if (!cur) return res.status(404).json({ error: 'Timekeeping record not found' });
    const merged = { ...cur, ...u, id };
    await exec(
      `UPDATE timekeeping_records SET
        employee_code=@employee_code, employee_id=@employee_id, employee_name=@employee_name,
        date=@date, day_of_week=@day_of_week, check_in=@check_in, check_out=@check_out,
        late_minutes=@late_minutes, early_minutes=@early_minutes, workday=@workday,
        total_hours=@total_hours, overtime_hours=@overtime_hours, total_all_hours=@total_all_hours,
        shift=@shift, department=@department, is_archived=@is_archived
      WHERE id=@id`,
      merged as any
    );
    const record = await queryOne<TkRow>('SELECT * FROM timekeeping_records WHERE id = @id', { id });
    res.json(mapTkRow(record!));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteTimekeeping = async (req: Request, res: Response) => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    const n = await exec('DELETE FROM timekeeping_records WHERE id = @id', { id });
    if (!n) return res.status(404).json({ error: 'Timekeeping record not found' });
    res.json({ message: 'Timekeeping record deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteAllTimekeeping = async (_req: Request, res: Response) => {
  try {
    await exec('DELETE FROM timekeeping_records', {});
    res.json({ message: 'All timekeeping records deleted successfully', count: 'all' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteAllArchivedTimekeeping = async (_req: Request, res: Response) => {
  try {
    const n = await exec('DELETE FROM timekeeping_records WHERE is_archived = 1', {});
    res.json({ message: 'All archived timekeeping records deleted successfully', count: n });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const fixArchiveStatus = async (_req: Request, res: Response) => {
  try {
    const latestRecord = await queryOne<{ created_at: string }>(
      `SELECT TOP 1 created_at FROM timekeeping_records
       WHERE created_at IS NOT NULL AND created_at <> '' ORDER BY created_at DESC`,
      {}
    );
    if (!latestRecord?.created_at) {
      const allRecords = await query<TkRow>(
        'SELECT TOP 1000 * FROM timekeeping_records ORDER BY id DESC',
        {}
      );
      if (allRecords.length === 0) {
        return res.json({ message: 'No records to fix', archived: 0, kept: 0 });
      }
      const latestId = allRecords[0].id as number;
      const oldestIdInBatch = allRecords[allRecords.length - 1].id as number;
      const ar = await exec(
        'UPDATE timekeeping_records SET is_archived = 1 WHERE id < @oid',
        { oid: oldestIdInBatch }
      );
      await exec(
        'UPDATE timekeeping_records SET is_archived = 0 WHERE id >= @a AND id <= @b',
        { a: oldestIdInBatch, b: latestId }
      );
      return res.json({
        message: 'Archive status fixed successfully',
        archived: ar,
        kept: allRecords.length,
      });
    }
    const latestCreatedAt = latestRecord.created_at;
    await exec(
      `UPDATE timekeeping_records SET is_archived = 1
       WHERE created_at < @lc OR created_at = '' OR (is_archived = 0 AND created_at <> @lc2)`,
      { lc: latestCreatedAt, lc2: latestCreatedAt }
    );
    const kept = await exec(
      'UPDATE timekeeping_records SET is_archived = 0 WHERE created_at = @lc',
      { lc: latestCreatedAt }
    );
    res.json({
      message: 'Archive status fixed successfully',
      archived: 'batch',
      kept,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

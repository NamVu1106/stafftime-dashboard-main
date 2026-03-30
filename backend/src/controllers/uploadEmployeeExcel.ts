import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { transaction, query, exec } from '../db/sqlServer';
import path from 'path';
import fs from 'fs';
import { createNotification } from './notifications';

/** Bắt reject từ async handler → gọi next(err) để Express error middleware log và trả 500. */
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, 'emp-' + Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') },
  fileFilter: (req, file, cb) => {
    if (['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

function excelDateToStr(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string') {
    const t = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    const d = new Date(t);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return t;
  }
  if (typeof v === 'number' && v >= 1) {
    const epoch = new Date(1899, 11, 30);
    const d = new Date(epoch.getTime() + v * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  }
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  return String(v);
}

function normalizeHeaderToken(v: unknown): string {
  return String(v ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
}

function pickByHeaderAliases(rowObj: Record<string, any>, aliases: string[]): string {
  if (!rowObj || !aliases.length) return '';
  const normalizedAliases = aliases.map((a) => normalizeHeaderToken(a));
  for (const [k, v] of Object.entries(rowObj)) {
    const nk = normalizeHeaderToken(k);
    if (normalizedAliases.includes(nk)) {
      return String(v ?? '').trim();
    }
  }
  return '';
}

// POST /api/upload/employees/official - File mẫu THÔNG TIN CNV TỔNG VINA (sheet "Thông tin công nhân", header row 2, data from row 3)
export const uploadEmployeesOfficial = [
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const workbook = XLSX.readFile(req.file.path, { cellDates: true, sheetStubs: true });
      const sheetName = workbook.SheetNames.find(s => s.includes('Thông tin công nhân')) || workbook.SheetNames[0];
      const ws = workbook.Sheets[sheetName];
      if (!ws || !ws['!ref']) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Sheet empty' });
      }
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
      const headerRowIndex = 1; // row 2 in Excel
      const headerRow = (rawData[headerRowIndex] || []).map((c: any) => (c != null ? String(c).trim() : ''));
      const rawRows: Record<string, any>[] = [];
      const toUpsert: Array<{
        empCode: string;
        name: string;
        gender: string;
        date_of_birth: string;
        age: number;
        department: string;
        cccd: string | null;
        phone: string | null;
        hometown: string | null;
        permanent_residence: string | null;
        marital_status: string | null;
      }> = [];
      const now = new Date().toISOString();
      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i] as any[];
        if (!row || !row.some((c: any) => c != null && c !== '')) continue;
        const rowObj: Record<string, any> = {};
        headerRow.forEach((h, idx) => {
          if (h) rowObj[h] = row[idx] != null ? row[idx] : '';
        });
        rawRows.push(rowObj);
        const empCode = String(rowObj['Mã nhân viên mới'] ?? '').trim();
        const name = String(rowObj['Họ và tên (*)'] ?? '').trim();
        if (!empCode || !name) continue;
        const gender = String(rowObj['Giới tính'] ?? 'Nam').trim();
        const dobRaw = rowObj['Ngày sinh'];
        const date_of_birth = excelDateToStr(dobRaw);
        let age = parseInt(String(rowObj['Tuổi'] ?? '0'), 10) || 0;
        if (!age && date_of_birth) {
          const b = new Date(date_of_birth);
          if (!isNaN(b.getTime())) age = Math.floor((Date.now() - b.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        }
        const department = String(rowObj['Mã đơn vị công tác (*)'] ?? '').trim() || 'Chưa xác định';
        const cccd = String(rowObj['Số CCCD'] ?? '').trim() || null;
        const phone = String(rowObj['ĐT di động'] ?? rowObj['ĐT nhà riêng'] ?? '').trim() || null;
        const hometown = String(rowObj['Nguyên quán'] ?? '').trim() || null;
        const permanent_residence = String(rowObj['Hộ khẩu thường trú'] ?? '').trim() || null;
        const marital_status = String(rowObj['Tình trạng hôn nhân'] ?? '').trim() || null;
        toUpsert.push({
          empCode,
          name,
          gender,
          date_of_birth: date_of_birth || '1900-01-01',
          age,
          department,
          cccd: cccd || null,
          phone: phone || null,
          hometown: hometown || null,
          permanent_residence: permanent_residence || null,
          marital_status: marital_status || null,
        });
      }
      // Một transaction duy nhất → 1 lần commit, upload nhanh hơn rất nhiều
      let upserted = 0;
      const h = JSON.stringify(headerRow);
      const rw = JSON.stringify(rawRows);
      await transaction(async (run, runExec) => {
        for (const e of toUpsert) {
          try {
            const ex = await run<{ id: number }>(
              'SELECT id FROM employees WHERE employee_code = @c',
              { c: e.empCode }
            );
            if (ex[0]) {
              await runExec(
                `UPDATE employees SET name=@n, gender=@g, date_of_birth=@dob, age=@age, department=@dept,
                 employment_type=@et, cccd=@cccd, phone=@ph, hometown=@ht, permanent_residence=@pr,
                 marital_status=@ms, updated_at=@u WHERE id=@id`,
                {
                  n: e.name,
                  g: e.gender,
                  dob: e.date_of_birth,
                  age: e.age,
                  dept: e.department,
                  et: 'Chính thức',
                  cccd: e.cccd,
                  ph: e.phone,
                  ht: e.hometown,
                  pr: e.permanent_residence,
                  ms: e.marital_status,
                  u: now,
                  id: ex[0].id,
                }
              );
            } else {
              await runExec(
                `INSERT INTO employees (employee_code, name, gender, date_of_birth, age, department, employment_type,
                  cccd, phone, hometown, permanent_residence, temporary_residence, marital_status, created_at, updated_at)
                 VALUES (@ec, @n, @g, @dob, @age, @dept, @et, @cccd, @ph, @ht, @pr, NULL, @ms, @c, @u)`,
                {
                  ec: e.empCode,
                  n: e.name,
                  g: e.gender,
                  dob: e.date_of_birth,
                  age: e.age,
                  dept: e.department,
                  et: 'Chính thức',
                  cccd: e.cccd,
                  ph: e.phone,
                  ht: e.hometown,
                  pr: e.permanent_residence,
                  ms: e.marital_status,
                  c: now,
                  u: now,
                }
              );
            }
            upserted++;
          } catch (err: any) {
            console.error('Employee upsert error:', e.empCode, err.message);
          }
        }
        const st = await run<{ id: number }>(
          "SELECT id FROM employee_excel_store WHERE type = 'official'",
          {}
        );
        if (st[0]) {
          await runExec(
            'UPDATE employee_excel_store SET headers=@h, rows=@rw, updated_at=@u WHERE type=@typ',
            { h, rw, u: now, typ: 'official' }
          );
        } else {
          await runExec(
            `INSERT INTO employee_excel_store (type, headers, rows, created_at, updated_at) VALUES (@typ, @h, @rw, @c, @u)`,
            { typ: 'official', h, rw, c: now, u: now }
          );
        }
      });
      fs.unlinkSync(req.file.path);
      if (upserted > 0) {
        await createNotification('new_employees', `Đã đồng bộ ${upserted} nhân viên chính thức`, `Upload file chính thức: ${upserted} bản ghi`, { count: upserted, link: '/employees' });
      }
      res.json({ message: 'OK', count: rawRows.length, upserted, headers: headerRow.length });
    } catch (error: any) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(500).json({ error: error.message });
    }
  },
];

// POST /api/upload/employees/seasonal - File mẫu Thời vụ (sheet TT hoặc sheet đầu, tìm dòng có "Mã NV")
export const uploadEmployeesSeasonal = [
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const workbook = XLSX.readFile(req.file.path, { cellDates: true, sheetStubs: true });
      let ws: XLSX.WorkSheet | undefined;
      let sheetName = '';
      let sheetRows: any[][] = [];
      let bestScore = -1;
      for (const name of workbook.SheetNames) {
        const s = workbook.Sheets[name];
        if (!s || !s['!ref']) continue;
        const rows = XLSX.utils.sheet_to_json(s, { header: 1, defval: '' }) as any[][];
        const scan = rows.slice(0, 40);
        let score = 0;
        for (const r of scan) {
          const cells = (r || []).map((c: any) => normalizeHeaderToken(c));
          const hasCode = cells.some((c: string) => /\b(ma nv|ma nhan vien|employee code)\b/.test(c));
          const hasName = cells.some((c: string) => /\b(ho ten|ho va ten|ten nhan vien|name)\b/.test(c));
          if (hasCode) score += 2;
          if (hasName) score += 2;
          if (hasCode && hasName) score += 3;
        }
        if (score > bestScore) {
          bestScore = score;
          ws = s;
          sheetName = name;
          sheetRows = rows;
        }
      }
      if (!ws || !sheetName) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Không tìm thấy sheet có dữ liệu. Thử sheet TT hoặc Sheet1.' });
      }
      const rawData = sheetRows.length
        ? sheetRows
        : (XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][]);
      let headerRowIndex = 2;
      for (let r = 0; r < Math.min(40, rawData.length); r++) {
        const row = rawData[r] || [];
        const normalized = row.map((c: any) => normalizeHeaderToken(c));
        const hasCode = normalized.some((c: string) => /\b(ma nv|ma nhan vien|employee code)\b/.test(c));
        const hasName = normalized.some((c: string) => /\b(ho ten|ho va ten|ten nhan vien|name)\b/.test(c));
        if (hasCode && hasName) {
          headerRowIndex = r;
          break;
        }
      }
      const dataStartIndex = headerRowIndex + 1;
      const headerRow = (rawData[headerRowIndex] || []).map((c: any) => (c != null ? String(c).trim() : ''));
      const rawRows: Record<string, any>[] = [];
      const toUpsert: Array<{
        empCode: string;
        name: string;
        gender: string;
        date_of_birth: string;
        age: number;
        department: string;
        cccd: string | null;
        phone: string | null;
        permanent_residence: string | null;
      }> = [];
      const now = new Date().toISOString();
      for (let i = dataStartIndex; i < rawData.length; i++) {
        const row = rawData[i] as any[];
        if (!row || !row.some((c: any) => c != null && c !== '')) continue;
        const rowObj: Record<string, any> = {};
        headerRow.forEach((h, idx) => {
          if (h) rowObj[h] = row[idx] != null ? row[idx] : '';
        });
        rawRows.push(rowObj);
        const empCode = pickByHeaderAliases(rowObj, [
          'Mã NV',
          'Ma NV',
          'MÃ NV',
          'Mã nhân viên',
          'MÃ NHÂN VIÊN',
          'MANV',
          'Employee code',
        ]);
        const name = pickByHeaderAliases(rowObj, [
          'HỌ VÀ TÊN',
          'Họ và tên',
          'Họ tên',
          'Tên nhân viên',
          'Ho va ten',
          'HOTEN',
          'Name',
        ]);
        if (!empCode || !name) continue;
        const gender = pickByHeaderAliases(rowObj, ['Giới tính', 'Gioi tinh']) || 'Nam';
        const dobRaw =
          pickByHeaderAliases(rowObj, ['NGÀY SINH', 'Ngày sinh', 'Ngay sinh', 'DOB']) || '';
        const date_of_birth = excelDateToStr(dobRaw);
        let age = 0;
        if (date_of_birth) {
          const b = new Date(date_of_birth);
          if (!isNaN(b.getTime())) age = Math.floor((Date.now() - b.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        }
        const department =
          pickByHeaderAliases(rowObj, ['BP', 'Bộ phận', 'Bo phan', 'Phòng ban', 'Phong ban']) ||
          'Chưa xác định';
        const cccd =
          pickByHeaderAliases(rowObj, ['SỐ CMT', 'Số CMT', 'CCCD', 'CMND', 'Số CCCD']) || null;
        const phone =
          pickByHeaderAliases(rowObj, ['SỐ ĐT', 'SỐ ĐT ', 'Số ĐT', 'Điện thoại', 'Phone']) || null;
        const permanent_residence =
          pickByHeaderAliases(rowObj, ['ĐỊA CHỈ', 'Địa chỉ', 'Dia chi', 'Thường trú']) || null;
        toUpsert.push({
          empCode,
          name,
          gender,
          date_of_birth: date_of_birth || '1900-01-01',
          age,
          department,
          cccd: cccd || null,
          phone: phone || null,
          permanent_residence: permanent_residence || null,
        });
      }
      const byCode = new Map<string, (typeof toUpsert)[0]>();
      for (const e of toUpsert) byCode.set(String(e.empCode).trim(), e);
      const unique = [...byCode.values()];
      if (unique.length === 0) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          error:
            'Không đọc được dòng nào (cần cột Mã NV + Họ tên). Kiểm tra sheet có dòng tiêu đề «Mã NV».',
        });
      }

      let upserted = 0;
      const MERGE_BATCH = 25;

      async function upsertSequential(e: (typeof unique)[0]) {
        const rows = await query<{ id: number }>('SELECT id FROM dbo.employees WHERE employee_code = @c', {
          c: e.empCode,
        });
        if (rows[0]) {
          await exec(
            `UPDATE dbo.employees SET name=@n, gender=@g, date_of_birth=@dob, age=@age, department=@dept,
             employment_type=@et, cccd=@cccd, phone=@ph, permanent_residence=@pr, updated_at=@u WHERE id=@id`,
            {
              n: e.name,
              g: e.gender,
              dob: e.date_of_birth,
              age: e.age,
              dept: e.department,
              et: 'Thời vụ',
              cccd: e.cccd,
              ph: e.phone,
              pr: e.permanent_residence,
              u: now,
              id: rows[0].id,
            }
          );
        } else {
          await exec(
            `INSERT INTO dbo.employees (employee_code, name, gender, date_of_birth, age, department, employment_type,
              cccd, phone, permanent_residence, created_at, updated_at)
             VALUES (@ec, @n, @g, @dob, @age, @dept, @et, @cccd, @ph, @pr, @c, @u)`,
            {
              ec: e.empCode,
              n: e.name,
              g: e.gender,
              dob: e.date_of_birth,
              age: e.age,
              dept: e.department,
              et: 'Thời vụ',
              cccd: e.cccd,
              ph: e.phone,
              pr: e.permanent_residence,
              c: now,
              u: now,
            }
          );
        }
        upserted++;
      }

      try {
        for (let b = 0; b < unique.length; b += MERGE_BATCH) {
          const batch = unique.slice(b, b + MERGE_BATCH);
          const vals: string[] = [];
          const params: Record<string, unknown> = { u: now, et: 'Thời vụ' };
          batch.forEach((e, i) => {
            vals.push(`(@ec${i},@n${i},@g${i},@dob${i},@age${i},@dept${i},@cc${i},@ph${i},@pr${i})`);
            params[`ec${i}`] = String(e.empCode).slice(0, 400);
            params[`n${i}`] = String(e.name).slice(0, 400);
            params[`g${i}`] = String(e.gender).slice(0, 200);
            params[`dob${i}`] = e.date_of_birth;
            params[`age${i}`] = e.age;
            params[`dept${i}`] = String(e.department).slice(0, 400);
            params[`cc${i}`] = e.cccd;
            params[`ph${i}`] = e.phone;
            params[`pr${i}`] = e.permanent_residence;
          });
          const mergeSql = `MERGE dbo.employees AS T
USING (VALUES ${vals.join(',')}) AS S(ec,n,g,dob,age,dept,cc,ph,pr)
ON T.employee_code COLLATE DATABASE_DEFAULT = S.ec COLLATE DATABASE_DEFAULT
WHEN MATCHED THEN UPDATE SET
  name=S.n, gender=S.g, date_of_birth=S.dob, age=S.age, department=S.dept,
  employment_type=@et, cccd=S.cc, phone=S.ph, permanent_residence=S.pr, updated_at=@u
WHEN NOT MATCHED THEN INSERT (employee_code,name,gender,date_of_birth,age,department,employment_type,cccd,phone,permanent_residence,created_at,updated_at)
VALUES (S.ec,S.n,S.g,S.dob,S.age,S.dept,@et,S.cc,S.ph,S.pr,@u,@u)`;
          await exec(mergeSql, params);
          upserted += batch.length;
        }
      } catch (mergeErr: any) {
        console.warn('[Upload seasonal] MERGE batch lỗi, chuyển sang từng dòng:', mergeErr?.message);
        upserted = 0;
        for (const e of unique) {
          try {
            await upsertSequential(e);
          } catch (one: any) {
            console.error('[Upload seasonal]', e.empCode, one?.message);
          }
        }
      }

      const keepSet = new Set(unique.map((e) => String(e.empCode).trim()));
      const seasonalDb = await query<{ employee_code: string }>(
        `SELECT employee_code FROM dbo.employees WHERE employment_type = N'Thời vụ'`
      );
      const toRemove = seasonalDb.filter((r) => !keepSet.has(String(r.employee_code).trim()));
      const DEL_CHUNK = 200;
      for (let i = 0; i < toRemove.length; i += DEL_CHUNK) {
        const chunk = toRemove.slice(i, i + DEL_CHUNK);
        const inList = chunk.map((r) => `'${String(r.employee_code).replace(/'/g, "''")}'`).join(',');
        await exec(`DELETE FROM dbo.employees WHERE employee_code IN (${inList})`);
      }

      const storeRows = rawRows.length > 3000 ? rawRows.slice(0, 3000) : rawRows;
      const h2 = JSON.stringify(headerRow);
      const rw2 = JSON.stringify(storeRows);
      const h2Trunc = h2.length > 3500000 ? h2.slice(0, 3500000) : h2;
      const rw2Trunc = rw2.length > 3500000 ? rw2.slice(0, 3500000) : rw2;
      const st = await query<{ id: number }>("SELECT id FROM dbo.employee_excel_store WHERE type = N'seasonal'", {});
      if (st[0]) {
        await exec(
          'UPDATE dbo.employee_excel_store SET headers=@h, rows=@rw, updated_at=@u WHERE type=@typ',
          { h: h2Trunc, rw: rw2Trunc, u: now, typ: 'seasonal' }
        );
      } else {
        await exec(
          `INSERT INTO dbo.employee_excel_store (type, headers, rows, created_at, updated_at) VALUES (@typ, @h, @rw, @c, @u)`,
          { typ: 'seasonal', h: h2Trunc, rw: rw2Trunc, c: now, u: now }
        );
      }

      fs.unlinkSync(req.file.path);
      try {
        if (upserted > 0) {
          await createNotification(
            'new_employees',
            `Đã đồng bộ ${upserted} nhân viên thời vụ`,
            `Upload file thời vụ: ${upserted} bản ghi`,
            { count: upserted, link: '/employees' }
          );
        }
      } catch (_) {
        /* ignore */
      }
      res.json({
        message: 'OK',
        count: rawRows.length,
        upserted,
        removed: toRemove.length,
        headers: headerRow.length,
      });
    } catch (error: any) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      const msg = error?.message ?? String(error);
      const stack = error?.stack;
      console.error('[Upload seasonal] LỖI:', msg);
      if (stack) console.error('[Upload seasonal] Stack:', stack);
      try {
        if (!res.headersSent) {
          res.status(500).json({
            error: msg || 'Lỗi khi xử lý file thời vụ',
            detail: process.env.NODE_ENV !== 'production' ? stack : undefined,
          });
        }
      } catch (e2: any) {
        console.error('[Upload seasonal] Gửi 500 thất bại:', e2?.message ?? e2);
      }
    }
  }),
];

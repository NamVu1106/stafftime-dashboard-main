import { Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { query, exec } from '../db/sqlServer';

const tempDir = path.join(process.cwd(), 'uploads', 'temp');
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      cb(null, tempDir);
    },
    filename: (_req, file, cb) => {
      cb(null, `va-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) cb(null, true);
    else cb(new Error('Chỉ chấp nhận .xlsx, .xls'));
  },
});

export const listVendorAssignments = async (_req: Request, res: Response) => {
  try {
    const rows = await query<{ employee_code: string; vendor_name: string; updated_at: string }>(
      'SELECT employee_code, vendor_name, updated_at FROM employee_vendor_map ORDER BY vendor_name, employee_code',
      {}
    );
    res.json({ items: rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const saveVendorAssignments = async (req: Request, res: Response) => {
  try {
    const items = (req.body?.items || []) as { employee_code?: string; vendor_name?: string }[];
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items phải là mảng { employee_code, vendor_name }' });
    }
    const now = new Date().toISOString();
    let n = 0;
    for (const it of items) {
      const code = String(it.employee_code ?? '')
        .trim()
        .toUpperCase();
      const vendor = String(it.vendor_name ?? '').trim();
      if (!code || !vendor) continue;
      const ex = await query<{ n: number }>(
        'SELECT COUNT(*) AS n FROM employee_vendor_map WHERE employee_code = @c',
        { c: code }
      );
      if (Number(ex[0]?.n) > 0) {
        await exec(
          'UPDATE employee_vendor_map SET vendor_name = @v, updated_at = @u WHERE employee_code = @c',
          { c: code, v: vendor, u: now }
        );
      } else {
        await exec(
          'INSERT INTO employee_vendor_map (employee_code, vendor_name, updated_at) VALUES (@c, @v, @u)',
          { c: code, v: vendor, u: now }
        );
      }
      n++;
    }
    res.json({ ok: true, upserted: n });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

/** Đồng bộ nhiều dòng: có tên NCC thì lưu, để trống thì xóa gán */
export const syncVendorAssignments = async (req: Request, res: Response) => {
  try {
    const rows = (req.body?.rows || []) as { employee_code?: string; vendor_name?: string }[];
    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: 'rows phải là mảng' });
    }
    const now = new Date().toISOString();
    let saved = 0;
    let removed = 0;
    for (const row of rows) {
      const code = String(row.employee_code ?? '')
        .trim()
        .toUpperCase();
      if (!code) continue;
      const v = String(row.vendor_name ?? '').trim();
      if (v) {
        const ex = await query<{ n: number }>(
          'SELECT COUNT(*) AS n FROM employee_vendor_map WHERE employee_code = @c',
          { c: code }
        );
        if (Number(ex[0]?.n) > 0) {
          await exec(
            'UPDATE employee_vendor_map SET vendor_name = @v, updated_at = @u WHERE employee_code = @c',
            { c: code, v, u: now }
          );
        } else {
          await exec(
            'INSERT INTO employee_vendor_map (employee_code, vendor_name, updated_at) VALUES (@c, @v, @u)',
            { c: code, v, u: now }
          );
        }
        saved++;
      } else {
        await exec('DELETE FROM employee_vendor_map WHERE employee_code = @c', { c: code });
        removed++;
      }
    }
    res.json({ ok: true, saved, removed });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const deleteVendorAssignment = async (req: Request, res: Response) => {
  try {
    const code = String(req.params.code || '')
      .trim()
      .toUpperCase();
    if (!code) return res.status(400).json({ error: 'Thiếu mã NV' });
    await exec('DELETE FROM employee_vendor_map WHERE employee_code = @c', { c: code });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

function findCol(headers: string[], patterns: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    for (const p of patterns) {
      if (p.test(h)) return i;
    }
  }
  return -1;
}

export const uploadVendorExcel = [
  upload.single('file'),
  async (req: Request, res: Response) => {
    const f = req.file;
    if (!f?.path) {
      return res.status(400).json({ error: 'Thiếu file' });
    }
    try {
      const wb = XLSX.readFile(f.path, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, defval: '' }) as (
        | string
        | number
      )[][];
      if (!data.length) {
        fs.unlinkSync(f.path);
        return res.status(400).json({ error: 'Sheet trống' });
      }
      const headerRow = (data[0] || []).map((x) => String(x ?? ''));
      const iCode = findCol(headerRow, [/ma\s*nv/, /mã\s*nv/, /employee/, /code/, /^id$/i, /so\s*the/]);
      const iVendor = findCol(headerRow, [
        /vendor/,
        /nha\s*cung\s*cap/,
        /nhà\s*cung\s*cấp/,
        /ncc/,
        /ten\s*ncc/,
        /tên\s*ncc/,
        /supplier/,
      ]);
      let codeIdx = iCode >= 0 ? iCode : 0;
      let vendIdx = iVendor >= 0 ? iVendor : 1;
      if (iCode < 0 && iVendor < 0 && headerRow.length >= 2) {
        codeIdx = 0;
        vendIdx = 1;
      }
      const now = new Date().toISOString();
      let n = 0;
      for (let r = 1; r < data.length; r++) {
        const row = data[r] || [];
        const code = String(row[codeIdx] ?? '')
          .trim()
          .toUpperCase();
        const vendor = String(row[vendIdx] ?? '').trim();
        if (!code || !vendor) continue;
        const ex = await query<{ n: number }>(
          'SELECT COUNT(*) AS n FROM employee_vendor_map WHERE employee_code = @c',
          { c: code }
        );
        if (Number(ex[0]?.n) > 0) {
          await exec(
            'UPDATE employee_vendor_map SET vendor_name = @v, updated_at = @u WHERE employee_code = @c',
            { c: code, v: vendor, u: now }
          );
        } else {
          await exec(
            'INSERT INTO employee_vendor_map (employee_code, vendor_name, updated_at) VALUES (@c, @v, @u)',
            { c: code, v: vendor, u: now }
          );
        }
        n++;
      }
      fs.unlinkSync(f.path);
      res.json({ ok: true, upserted: n, message: `Đã nhập / cập nhật ${n} dòng (Mã NV → Vendor).` });
    } catch (e: any) {
      try {
        fs.unlinkSync(f.path);
      } catch {
        /* ignore */
      }
      res.status(500).json({ error: e.message });
    }
  },
];

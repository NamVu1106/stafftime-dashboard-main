import { Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { prisma } from '../server';
import path from 'path';
import fs from 'fs';
import { createNotification } from './notifications';

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
      const TX_TIMEOUT = 10 * 60 * 1000; // 10 phút cho file lớn
      let upserted = 0;
      await prisma.$transaction(async (tx) => {
        for (const e of toUpsert) {
          try {
            await tx.employee.upsert({
              where: { employee_code: e.empCode },
              update: {
                name: e.name,
                gender: e.gender,
                date_of_birth: e.date_of_birth,
                age: e.age,
                department: e.department,
                employment_type: 'Chính thức',
                cccd: e.cccd,
                phone: e.phone,
                hometown: e.hometown,
                permanent_residence: e.permanent_residence,
                marital_status: e.marital_status,
                updated_at: now,
              },
              create: {
                employee_code: e.empCode,
                name: e.name,
                gender: e.gender,
                date_of_birth: e.date_of_birth,
                age: e.age,
                department: e.department,
                employment_type: 'Chính thức',
                cccd: e.cccd,
                phone: e.phone,
                hometown: e.hometown,
                permanent_residence: e.permanent_residence,
                marital_status: e.marital_status,
                created_at: now,
                updated_at: now,
              },
            });
            upserted++;
          } catch (err: any) {
            console.error('Employee upsert error:', e.empCode, err.message);
          }
        }
        await tx.employeeExcelStore.upsert({
          where: { type: 'official' },
          update: { headers: JSON.stringify(headerRow), rows: JSON.stringify(rawRows), updated_at: now },
          create: { type: 'official', headers: JSON.stringify(headerRow), rows: JSON.stringify(rawRows), created_at: now, updated_at: now },
        });
      }, { timeout: TX_TIMEOUT });
      fs.unlinkSync(req.file.path);
      if (upserted > 0) {
        await createNotification('new_employees', `Đã đồng bộ ${upserted} nhân viên chính thức`, `Upload file chính thức: ${upserted} bản ghi`, { count: upserted });
      }
      res.json({ message: 'OK', count: rawRows.length, upserted, headers: headerRow.length });
    } catch (error: any) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(500).json({ error: error.message });
    }
  },
];

// POST /api/upload/employees/seasonal - File mẫu Thời vụ tổng 2024 (sheet TT, header row 3, data from row 5)
export const uploadEmployeesSeasonal = [
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const workbook = XLSX.readFile(req.file.path, { cellDates: true, sheetStubs: true });
      const sheetName = workbook.SheetNames[0];
      const ws = workbook.Sheets[sheetName];
      if (!ws || !ws['!ref']) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Sheet empty' });
      }
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
      const headerRowIndex = 2; // row 3 in Excel
      const dataStartIndex = 4; // row 5 (skip row 4 sub-header)
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
        const empCode = String(rowObj['Mã NV'] ?? '').trim();
        const name = String(rowObj['HỌ VÀ TÊN'] ?? rowObj['Họ và tên'] ?? '').trim();
        if (!empCode || !name) continue;
        const gender = String(rowObj['Giới tính'] ?? 'Nam').trim();
        const dobRaw = rowObj['NGÀY SINH'] ?? rowObj['Ngày sinh'];
        const date_of_birth = excelDateToStr(dobRaw);
        let age = 0;
        if (date_of_birth) {
          const b = new Date(date_of_birth);
          if (!isNaN(b.getTime())) age = Math.floor((Date.now() - b.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        }
        const department = String(rowObj['BP'] ?? '').trim() || 'Chưa xác định';
        const cccd = String(rowObj['SỐ CMT'] ?? rowObj['Số CMT'] ?? '').trim() || null;
        const phone = String(rowObj['SỐ ĐT '] ?? rowObj['Số ĐT'] ?? '').trim() || null;
        const permanent_residence = String(rowObj['ĐỊA CHỈ'] ?? rowObj['Địa chỉ'] ?? '').trim() || null;
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
      const TX_TIMEOUT = 10 * 60 * 1000; // 10 phút
      let upserted = 0;
      await prisma.$transaction(async (tx) => {
        for (const e of toUpsert) {
          try {
            await tx.employee.upsert({
              where: { employee_code: e.empCode },
              update: {
                name: e.name,
                gender: e.gender,
                date_of_birth: e.date_of_birth,
                age: e.age,
                department: e.department,
                employment_type: 'Thời vụ',
                cccd: e.cccd,
                phone: e.phone,
                permanent_residence: e.permanent_residence,
                updated_at: now,
              },
              create: {
                employee_code: e.empCode,
                name: e.name,
                gender: e.gender,
                date_of_birth: e.date_of_birth,
                age: e.age,
                department: e.department,
                employment_type: 'Thời vụ',
                cccd: e.cccd,
                phone: e.phone,
                permanent_residence: e.permanent_residence,
                created_at: now,
                updated_at: now,
              },
            });
            upserted++;
          } catch (err: any) {
            console.error('Employee upsert error:', e.empCode, err.message);
          }
        }
        // Sau khi upload danh sách thời vụ: xóa khỏi DB những NV thời vụ không còn trong file (để Tổng nhân viên giảm đúng khi cắt giảm)
        if (toUpsert.length > 0) {
          const seasonalCodes = toUpsert.map((e) => e.empCode);
          const deleted = await tx.employee.deleteMany({
            where: {
              employment_type: 'Thời vụ',
              employee_code: { notIn: seasonalCodes },
            },
          });
          if (deleted.count > 0) {
            console.log(`[Upload seasonal] Removed ${deleted.count} seasonal employees no longer in file`);
          }
        }
        await tx.employeeExcelStore.upsert({
          where: { type: 'seasonal' },
          update: { headers: JSON.stringify(headerRow), rows: JSON.stringify(rawRows), updated_at: now },
          create: { type: 'seasonal', headers: JSON.stringify(headerRow), rows: JSON.stringify(rawRows), created_at: now, updated_at: now },
        });
      }, { timeout: TX_TIMEOUT });
      fs.unlinkSync(req.file.path);
      if (upserted > 0) {
        await createNotification('new_employees', `Đã đồng bộ ${upserted} nhân viên thời vụ`, `Upload file thời vụ: ${upserted} bản ghi`, { count: upserted });
      }
      res.json({ message: 'OK', count: rawRows.length, upserted, headers: headerRow.length });
    } catch (error: any) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(500).json({ error: error.message });
    }
  },
];

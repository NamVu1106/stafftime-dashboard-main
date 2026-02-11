import { Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { prisma } from '../server';
import path from 'path';
import fs from 'fs';
import { createNotification } from './notifications';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.mimetype === 'image/jpeg' ||
        file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// POST /api/upload/employees - Upload Excel file for employees
export const uploadEmployees = [
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const workbook = XLSX.readFile(req.file.path, { 
        cellDates: true,
        cellNF: false,
        cellText: false,
        sheetStubs: true,
      });
      console.log(`\n=== Excel File Info ===`);
      console.log(`Available sheets: ${workbook.SheetNames.join(', ')}`);
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Get worksheet range
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      console.log(`\n=== Worksheet Range ===`);
      console.log(`Range: ${worksheet['!ref']}`);
      console.log(`Rows: ${range.e.r + 1} (0-indexed: ${range.e.r})`);
      console.log(`Columns: ${range.e.c + 1} (0-indexed: ${range.e.c})`);
      
      // Read raw data first to see actual structure - read ALL rows including empty ones
      const rawData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, 
        defval: null,
        blankrows: true, // Include blank rows
      });
      console.log(`\n=== Raw Excel Data ===`);
      console.log(`Total raw rows: ${rawData.length}`);
      console.log(`Expected rows from range: ${range.e.r + 1}`);
      console.log(`First 10 rows:`, rawData.slice(0, 10));
      
      // Also try reading the worksheet directly to see all cells
      console.log(`\n=== Worksheet Cells (first 20 rows) ===`);
      for (let row = 0; row < Math.min(20, range.e.r + 1); row++) {
        const rowData: any[] = [];
        for (let col = 0; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];
          rowData.push(cell ? cell.v : null);
        }
        if (rowData.some(cell => cell !== null && cell !== undefined && cell !== '')) {
          console.log(`Row ${row + 1}:`, rowData);
        }
      }
      
      // Find header row (row with "Mã NV" or similar)
      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(10, rawData.length); i++) {
        const row = rawData[i] as any[];
        if (row && Array.isArray(row)) {
          const rowStr = row.map(cell => String(cell || '').toLowerCase()).join(' ');
          if (rowStr.includes('mã') || rowStr.includes('mã nv') || rowStr.includes('code')) {
            headerRowIndex = i;
            console.log(`\n✓ Found header at row ${i + 1}:`, row);
            break;
          }
        }
      }
      
      if (headerRowIndex === -1) {
        // Try to use first row as header
        headerRowIndex = 0;
        console.log(`\n⚠️ No header found, using first row as header`);
      }
      
      // Read data starting from header row
      let data: any[] = [];
      if (rawData.length > headerRowIndex + 1) {
        // Use header row to create column mapping
        const headerRow = rawData[headerRowIndex] as any[];
        console.log(`\nHeader row:`, headerRow);
        
        // Read data rows (skip header row)
        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
          const row = rawData[i] as any[];
          if (row && row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
            // Convert array row to object using header
            const rowObj: Record<string, any> = {};
            headerRow.forEach((header, idx) => {
              if (header) {
                rowObj[String(header)] = row[idx] || null;
              }
            });
            data.push(rowObj);
          }
        }
        
        console.log(`\n=== Data Rows Found ===`);
        console.log(`Total data rows: ${data.length}`);
        if (data.length > 0) {
          console.log(`First data row:`, data[0]);
        }
      } else {
        console.log(`\n⚠️ No data rows found after header!`);
      }
      
      // Log first row to see column names
      let columnMapping: Record<string, string> = {};
      if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
        const firstRow = data[0] as Record<string, any>;
        const allColumns = Object.keys(firstRow);
        console.log('\n=== Excel File Columns ===');
        console.log('All columns found:', allColumns);
        console.log('First row sample:', JSON.stringify(firstRow, null, 2));
        console.log('Total rows:', data.length);
        
        // Auto-detect column mapping
        for (const col of allColumns) {
          const colLower = col.toLowerCase().trim();
          // Map employee code
          if (!columnMapping['employee_code'] && (
            colLower.includes('mã') || colLower.includes('ma') || 
            colLower.includes('code') || colLower.includes('id')
          )) {
            columnMapping['employee_code'] = col;
          }
          // Map name
          if (!columnMapping['name'] && (
            colLower.includes('tên') || colLower.includes('ten') || 
            colLower.includes('name') || colLower.includes('họ tên') || colLower.includes('hoten')
          )) {
            columnMapping['name'] = col;
          }
          // Map date of birth
          if (!columnMapping['date_of_birth'] && (
            colLower.includes('ngày sinh') || colLower.includes('ngaysinh') || 
            colLower.includes('dob') || colLower.includes('date of birth') ||
            colLower.includes('sinh') || colLower.includes('birthday')
          )) {
            columnMapping['date_of_birth'] = col;
          }
          // Map gender
          if (!columnMapping['gender'] && (
            colLower.includes('giới tính') || colLower.includes('gioitinh') || 
            colLower.includes('gender') || colLower.includes('sex')
          )) {
            columnMapping['gender'] = col;
          }
          // Map department
          if (!columnMapping['department'] && (
            colLower.includes('phòng ban') || colLower.includes('phongban') || 
            colLower.includes('department') || colLower.includes('bộ phận') || colLower.includes('bophan')
          )) {
            columnMapping['department'] = col;
          }
          // Map employment type
          if (!columnMapping['employment_type'] && (
            colLower.includes('loại hợp đồng') || colLower.includes('loaihopdong') || 
            colLower.includes('employment') || colLower.includes('hợp đồng') || colLower.includes('hopdong')
          )) {
            columnMapping['employment_type'] = col;
          }
          // Map CCCD
          if (!columnMapping['cccd'] && (
            colLower.includes('cccd') || colLower.includes('cmnd') || colLower.includes('căn cước')
          )) {
            columnMapping['cccd'] = col;
          }
          // Map phone
          if (!columnMapping['phone'] && (
            colLower.includes('sđt') || colLower.includes('sdt') || colLower.includes('phone') || 
            colLower.includes('điện thoại') || colLower.includes('dienthoai') || colLower.includes('tel')
          )) {
            columnMapping['phone'] = col;
          }
          // Map hometown
          if (!columnMapping['hometown'] && (
            colLower.includes('quê quán') || colLower.includes('quequan') || colLower.includes('hometown') ||
            colLower.includes('quê') || colLower.includes('que')
          )) {
            columnMapping['hometown'] = col;
          }
          // Map permanent residence
          if (!columnMapping['permanent_residence'] && (
            colLower.includes('thường trú') || colLower.includes('thuongtru') || colLower.includes('permanent') ||
            colLower.includes('hộ khẩu') || colLower.includes('hokhau')
          )) {
            columnMapping['permanent_residence'] = col;
          }
          // Map temporary residence
          if (!columnMapping['temporary_residence'] && (
            colLower.includes('tạm trú') || colLower.includes('tamtru') || colLower.includes('temporary')
          )) {
            columnMapping['temporary_residence'] = col;
          }
          // Map marital status
          if (!columnMapping['marital_status'] && (
            colLower.includes('tình trạng hôn nhân') || colLower.includes('tinhtranghonnhan') || 
            colLower.includes('marital') || colLower.includes('hôn nhân') || colLower.includes('honnhan')
          )) {
            columnMapping['marital_status'] = col;
          }
          // Map family relations
          if (!columnMapping['family_relations'] && (
            colLower.includes('quan hệ gia đình') || colLower.includes('quanhegiadinh') || 
            colLower.includes('family') || colLower.includes('gia đình') || colLower.includes('giadinh')
          )) {
            columnMapping['family_relations'] = col;
          }
        }
        
        console.log('\n=== Auto-detected Column Mapping ===');
        console.log(columnMapping);
        
        // If no mapping found, log warning
        if (Object.keys(columnMapping).length === 0) {
          console.log('\n⚠️ WARNING: No column mapping detected!');
          console.log('Please check if the Excel file has proper headers.');
          console.log('Expected columns: Mã NV, Tên, Giới tính, Ngày sinh, Phòng ban');
        }
      } else {
        console.log('\n⚠️ WARNING: No data rows found in Excel file!');
        console.log('Sheet name:', sheetName);
        console.log('Worksheet range:', worksheet['!ref']);
      }
      
      const employees = [];
      let processedRows = 0;
      let skippedRows = 0;
      const skippedReasons: string[] = [];
      const replaceAll = req.query.replace_all === '1' || req.query.replace_all === 'true' || (req.body && (req.body.replace_all === '1' || req.body.replace_all === true));
      const uploadedCodes = new Set<string>();

      // If no data, return early
      if (data.length === 0) {
        fs.unlinkSync(req.file.path);
        return res.json({
          message: 'No data found in Excel file',
          count: 0,
          totalRows: 0,
          processedRows: 0,
          skippedRows: 0,
          skippedReasons: ['Excel file appears to be empty or has no readable data'],
        });
      }
      
      for (const row of data as any[]) {
        processedRows++;
        // Use auto-detected mapping or fallback to manual mapping
        // Try all possible column names
        const employee_code = columnMapping['employee_code'] ? (row[columnMapping['employee_code']] || '') : 
          (row['Mã NV'] || row['Mã nhân viên'] || row['Mã'] || row['employee_code'] || row['Employee Code'] || 
           row['Mã NV'] || row['MÃ NV'] || row['MÃ NHÂN VIÊN'] || row['MA NV'] || 
           Object.values(row).find((v: any) => v && String(v).match(/^[A-Z0-9]+HG$/)) || '');
        
        const name = columnMapping['name'] ? (row[columnMapping['name']] || '') : 
          (row['Tên'] || row['Tên nhân viên'] || row['Họ tên'] || row['HỌ TÊN'] || row['HOTEN'] ||
           row['name'] || row['Name'] || row['TÊN'] || row['TEN'] || '');
        
        const gender = columnMapping['gender'] ? (row[columnMapping['gender']] || 'Nam') : 
          (row['Giới tính'] || row['GIỚI TÍNH'] || row['GIOI TINH'] || row['gender'] || row['Gender'] || 'Nam');
        
        const date_of_birth = columnMapping['date_of_birth'] ? (row[columnMapping['date_of_birth']] || '') : 
          (row['Ngày sinh'] || row['NGÀY SINH'] || row['NGAY SINH'] || row['date_of_birth'] || 
           row['Date of Birth'] || row['DOB'] || row['Ngày sinh'] || row['Sinh'] || '');
        
        const department = columnMapping['department'] ? (row[columnMapping['department']] || '') : 
          (row['Phòng ban'] || row['PHÒNG BAN'] || row['PHONG BAN'] || row['department'] || 
           row['Department'] || row['Bộ phận'] || row['BỘ PHẬN'] || row['BOPHAN'] || '');
        
        const employment_type = columnMapping['employment_type'] ? (row[columnMapping['employment_type']] || 'Chính thức') : 
          (row['Loại hợp đồng'] || row['LOẠI HỢP ĐỒNG'] || row['LOAI HOP DONG'] || row['employment_type'] || 
           row['Employment Type'] || row['Hợp đồng'] || row['HOP DONG'] || 'Chính thức');
        
        // Additional fields
        const cccd = columnMapping['cccd'] ? (row[columnMapping['cccd']] || '') : 
          (row['CCCD'] || row['cccd'] || row['CMND'] || row['cmnd'] || '');
        
        const phone = columnMapping['phone'] ? (row[columnMapping['phone']] || '') : 
          (row['SĐT'] || row['SDT'] || row['sđt'] || row['sdt'] || row['Phone'] || row['phone'] || '');
        
        const hometown = columnMapping['hometown'] ? (row[columnMapping['hometown']] || '') : 
          (row['Quê quán'] || row['QUÊ QUÁN'] || row['QUE QUAN'] || row['Hometown'] || row['hometown'] || '');
        
        const permanent_residence = columnMapping['permanent_residence'] ? (row[columnMapping['permanent_residence']] || '') : 
          (row['Thường trú'] || row['THƯỜNG TRÚ'] || row['THUONG TRU'] || row['Permanent'] || row['permanent'] || '');
        
        const temporary_residence = columnMapping['temporary_residence'] ? (row[columnMapping['temporary_residence']] || '') : 
          (row['Tạm trú'] || row['TẠM TRÚ'] || row['TAM TRU'] || row['Temporary'] || row['temporary'] || '');
        
        const marital_status = columnMapping['marital_status'] ? (row[columnMapping['marital_status']] || '') : 
          (row['Tình trạng hôn nhân'] || row['TÌNH TRẠNG HÔN NHÂN'] || row['TINH TRANG HON NHAN'] || 
           row['Marital Status'] || row['marital_status'] || '');
        
        const family_relations = columnMapping['family_relations'] ? (row[columnMapping['family_relations']] || '') : 
          (row['Quan hệ gia đình'] || row['QUAN HỆ GIA ĐÌNH'] || row['QUAN HE GIA DINH'] || 
           row['Family Relations'] || row['family_relations'] || '');
        
        // Convert values to string and trim
        const empCode = String(employee_code || '').trim();
        const empName = String(name || '').trim();
        const empDob = String(date_of_birth || '').trim();
        const empDept = String(department || '').trim();
        
        // Log first few rows for debugging
        if (processedRows <= 3) {
          console.log(`\nRow ${processedRows} parsed:`, {
            employee_code: empCode || '(empty)',
            name: empName || '(empty)',
            date_of_birth: empDob || '(empty)',
            department: empDept || '(empty)',
            cccd: String(cccd || '').trim() || '(empty)',
            phone: String(phone || '').trim() || '(empty)',
            hometown: String(hometown || '').trim() || '(empty)',
            permanent_residence: String(permanent_residence || '').trim() || '(empty)',
            marital_status: String(marital_status || '').trim() || '(empty)',
            rawRow: row,
          });
        }
        
        // Only require employee_code and name, date_of_birth will be handled separately
        if (!empCode || !empName) {
          skippedRows++;
          if (skippedRows <= 5) {
            skippedReasons.push(`Row ${processedRows}: Missing required fields (code: ${empCode ? '✓' : '✗'}, name: ${empName ? '✓' : '✗'})`);
          }
          continue;
        }
        
        if (empCode && empName) {
          // Handle date_of_birth - might be Excel serial number or date string
          let finalDob = empDob;
          let age = 0;
          
          if (empDob) {
            // Try to parse as Excel date serial number
            if (typeof date_of_birth === 'number' && date_of_birth >= 1) {
              // Excel date serial number (days since 1900-01-01)
              const excelEpoch = new Date(1899, 11, 30); // Excel epoch is 1899-12-30
              const dateObj = new Date(excelEpoch.getTime() + date_of_birth * 24 * 60 * 60 * 1000);
              // Create new date at midnight local time to avoid timezone issues
              const year = dateObj.getFullYear();
              const month = dateObj.getMonth() + 1;
              const day = dateObj.getDate();
              const localDate = new Date(year, month - 1, day, 0, 0, 0, 0);
              finalDob = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
            } else if (typeof date_of_birth === 'string') {
              // Try to parse as DD/MM/YYYY format first (common in Vietnamese Excel)
              const ddmmyyyyMatch = empDob.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
              if (ddmmyyyyMatch) {
                const [, day, month, year] = ddmmyyyyMatch;
                // Parse directly from string components - NO Date object conversion
                const yearNum = parseInt(year);
                const monthNum = parseInt(month);
                const dayNum = parseInt(day);
                if (yearNum >= 1900 && yearNum <= 2100 && 
                    monthNum >= 1 && monthNum <= 12 && 
                    dayNum >= 1 && dayNum <= 31) {
                  finalDob = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                } else {
                  // Fallback to Date object if validation fails
                  const parsedDate = new Date(yearNum, monthNum - 1, dayNum);
                  if (!isNaN(parsedDate.getTime())) {
                    const localDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 0, 0, 0, 0);
                    finalDob = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
                  }
                }
              } else {
                // Try to parse as standard date string
                const parsedDate = new Date(date_of_birth);
                if (!isNaN(parsedDate.getTime())) {
                  // Create new date at midnight local time
                  const year = parsedDate.getFullYear();
                  const month = parsedDate.getMonth() + 1;
                  const day = parsedDate.getDate();
                  const localDate = new Date(year, month - 1, day, 0, 0, 0, 0);
                  finalDob = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
                }
              }
            }
            
            // Calculate age
            if (finalDob) {
              const birthDate = new Date(finalDob);
              if (!isNaN(birthDate.getTime())) {
                const today = new Date();
                age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                  age--;
                }
              }
            }
          }
          
          // If no date_of_birth, use a default date (1900-01-01) or calculate from age if available
          // But we'll allow null for now to see if that's the issue
          if (!finalDob) {
            // Try to use a default date instead of skipping
            finalDob = '1900-01-01';
            age = 0;
            console.log(`Row ${processedRows}: No date_of_birth found, using default: ${finalDob}`);
          }
          
          // Parse additional fields
          const empCccd = String(cccd || '').trim() || null;
          const empPhone = String(phone || '').trim() || null;
          const empHometown = String(hometown || '').trim() || null;
          const empPermanentResidence = String(permanent_residence || '').trim() || null;
          const empTemporaryResidence = String(temporary_residence || '').trim() || null;
          const empMaritalStatus = String(marital_status || '').trim() || null;
          
          // Parse family relations if provided (format: "Vợ: Nguyễn Thị A, Con: Nguyễn Văn B")
          const familyMembers: Array<{ relation: string; name: string; occupation: string }> = [];
          if (family_relations && String(family_relations).trim()) {
            const relationsStr = String(family_relations).trim();
            // Try to parse format like "Vợ: Nguyễn Thị A, Con: Nguyễn Văn B"
            const relations = relationsStr.split(',').map(r => r.trim());
            for (const rel of relations) {
              if (rel.includes(':')) {
                const [relation, ...nameParts] = rel.split(':');
                const name = nameParts.join(':').trim();
                if (relation && name) {
                  familyMembers.push({
                    relation: relation.trim(),
                    name: name.trim(),
                    occupation: '', // Default empty, can be filled later
                  });
                }
              } else if (rel) {
                // If no colon, treat entire string as relation
                familyMembers.push({
                  relation: rel.trim(),
                  name: '',
                  occupation: '',
                });
              }
            }
          }
          uploadedCodes.add(empCode);
          try {
            // Use upsert to create or update employee
            const employee = await prisma.employee.upsert({
              where: { employee_code: empCode },
              update: {
                name: empName,
                gender: String(gender || 'Nam').trim(),
                date_of_birth: finalDob,
                age: age || 0,
                department: empDept || 'Chưa xác định',
                employment_type: String(employment_type || 'Chính thức').trim(),
                cccd: empCccd,
                phone: empPhone,
                hometown: empHometown,
                permanent_residence: empPermanentResidence,
                temporary_residence: empTemporaryResidence,
                marital_status: empMaritalStatus,
                updated_at: new Date().toISOString(),
                // Update family members: delete old ones and create new ones
                family_members: {
                  deleteMany: {},
                  create: familyMembers,
                },
              },
              create: {
                employee_code: empCode,
                name: empName,
                gender: String(gender || 'Nam').trim(),
                date_of_birth: finalDob,
                age: age || 0,
                department: empDept || 'Chưa xác định',
                employment_type: String(employment_type || 'Chính thức').trim(),
                cccd: empCccd,
                phone: empPhone,
                hometown: empHometown,
                permanent_residence: empPermanentResidence,
                temporary_residence: empTemporaryResidence,
                marital_status: empMaritalStatus,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                family_members: familyMembers.length > 0 ? {
                  create: familyMembers,
                } : undefined,
              },
              include: {
                family_members: true,
              },
            });
            employees.push(employee);
            if (employees.length <= 3) {
              console.log(`✓ Created/Updated employee: ${empCode} - ${empName}`, {
                cccd: empCccd || '(empty)',
                phone: empPhone || '(empty)',
                hometown: empHometown || '(empty)',
                permanent_residence: empPermanentResidence || '(empty)',
                marital_status: empMaritalStatus || '(empty)',
              });
            }
          } catch (error: any) {
            console.error(`✗ Error creating/updating employee ${empCode}:`, error.message || error);
            skippedRows++;
            if (skippedRows <= 5) {
              skippedReasons.push(`Row ${processedRows}: ${error.message || 'Unknown error'}`);
            }
          }
        }
      }
      
      // Delete uploaded file
      fs.unlinkSync(req.file.path);
      if (replaceAll && uploadedCodes.size > 0) {
        const codes = Array.from(uploadedCodes);
        const deleted = await prisma.employee.deleteMany({ where: { employee_code: { notIn: codes } } });
        if (deleted.count > 0) {
          console.log(`[Upload employees] replace_all: removed ${deleted.count} employees not in file`);
        }
      }
      
      console.log(`\n=== Upload Summary ===`);
      console.log(`Total rows in Excel file: ${data.length}`);
      console.log(`Total rows processed: ${processedRows}`);
      console.log(`Successfully created: ${employees.length}`);
      console.log(`Skipped: ${skippedRows}`);
      if (skippedReasons.length > 0) {
        console.log(`\nFirst few skipped reasons:`);
        skippedReasons.forEach(reason => console.log(`  - ${reason}`));
      }
      
      // If no employees were created and we had data, log warning
      if (employees.length === 0 && data.length > 0) {
        console.log(`\n⚠️ WARNING: No employees were created despite having ${data.length} rows in Excel!`);
        console.log(`Please check the Excel file format and column names.`);
      }
      
      // Track new employees: check which ones were just created (not updated)
      // We'll check if employee existed before by querying existing codes
      const existingCodes = new Set(
        (await prisma.employee.findMany({
          select: { employee_code: true },
        })).map(e => e.employee_code)
      );
      
      // Get employee codes from the uploaded data (successfully upserted)
      const successfulUploadCodes = new Set(employees.map(e => e.employee_code));
      
      // Count how many were actually new (this is approximate since upsert creates or updates)
      // A better approach: check created_at vs updated_at, but for simplicity, we'll use the count
      // Actually, we can't reliably determine new vs updated with upsert, so we'll just notify about processed employees
      if (employees.length > 0) {
        // Check which employees have the same created_at and updated_at (likely new)
        const newEmployees = employees.filter(emp => {
          // If created_at equals updated_at (within 1 second), it's likely a new employee
          const created = new Date(emp.created_at).getTime();
          const updated = new Date(emp.updated_at).getTime();
          return Math.abs(created - updated) < 2000; // Within 2 seconds
        });
        
        const newCount = newEmployees.length;
        if (newCount > 0) {
          await createNotification(
            'new_employees',
            `Có ${newCount} nhân viên mới được thêm`,
            `Đã thêm ${newCount} nhân viên mới vào hệ thống`,
            {
              count: newCount,
            }
          );
        }
      }
      
      res.json({
        message: 'Employees uploaded successfully',
        count: employees.length,
        totalRows: data.length,
        processedRows,
        skippedRows,
        skippedReasons: skippedReasons.slice(0, 10), // Return first 10 reasons
        employees: employees.slice(0, 10), // Return first 10 employees
      });
    } catch (error: any) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: error.message });
    }
  },
];

// Helper function to convert Excel date serial number to date string
const excelDateToDateString = (excelDate: any): string => {
  if (!excelDate && excelDate !== 0) return '';
  
  // If it's already a string date, try to parse it
  if (typeof excelDate === 'string') {
    const trimmed = excelDate.trim();
    
    // Try MM/DD/YYYY format (common in Vietnamese Excel like "12/16/2025")
    const mmddyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mmddyyyyMatch) {
      const [, month, day, year] = mmddyyyyMatch;
      // Parse directly from string - NO Date object to avoid timezone issues
      const yearNum = parseInt(year);
      const monthNum = parseInt(month);
      const dayNum = parseInt(day);
      
      if (yearNum >= 1900 && yearNum <= 2100 && 
          monthNum >= 1 && monthNum <= 12 && 
          dayNum >= 1 && dayNum <= 31) {
        return `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      }
    }
    
    // Try DD/MM/YYYY format
    const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyyMatch && !mmddyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch;
      const yearNum = parseInt(year);
      const monthNum = parseInt(month);
      const dayNum = parseInt(day);
      
      if (yearNum >= 1900 && yearNum <= 2100 && 
          monthNum >= 1 && monthNum <= 12 && 
          dayNum >= 1 && dayNum <= 31) {
        return `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      }
    }
    
    // Try YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    
    // Try to parse as standard date string (fallback)
    const parsedDate = new Date(trimmed);
    if (!isNaN(parsedDate.getTime())) {
      // Create new date at midnight to avoid timezone issues
      const year = parsedDate.getFullYear();
      const month = parsedDate.getMonth() + 1;
      const day = parsedDate.getDate();
      const localDate = new Date(year, month - 1, day, 0, 0, 0, 0);
      const y = String(localDate.getFullYear());
      const m = String(localDate.getMonth() + 1).padStart(2, '0');
      const d = String(localDate.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    
    return trimmed; // Return as is if can't parse
  }
  
  // If it's a number (Excel serial date), convert it
  if (typeof excelDate === 'number') {
    // Excel date serial number (days since 1900-01-01)
    // Excel epoch is 1899-12-30 (not 1900-01-01 due to Excel bug)
    const excelEpoch = new Date(1899, 11, 30); // Month is 0-indexed, so 11 = December
    const milliseconds = Math.floor(excelDate) * 24 * 60 * 60 * 1000;
    const dateObj = new Date(excelEpoch.getTime() + milliseconds);
    
    // Get components and create new date at midnight local time
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    const localDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    
    // Use verified local date components
    const y = String(localDate.getFullYear());
    const m = String(localDate.getMonth() + 1).padStart(2, '0');
    const d = String(localDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  
  return '';
};

// Helper function to convert Excel time serial number to time string (HH:mm)
const excelTimeToTimeString = (excelTime: any): string => {
  if (!excelTime && excelTime !== 0) return '';
  
  // Handle Date object first (Excel often returns Date objects for datetime fields)
  if (excelTime instanceof Date && !isNaN(excelTime.getTime())) {
    const hours = String(excelTime.getHours()).padStart(2, '0');
    const minutes = String(excelTime.getMinutes()).padStart(2, '0');
    const seconds = String(excelTime.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
  
  // If it's already a string time, try to parse it
  if (typeof excelTime === 'string') {
    // Check if it's already in HH:mm format
    if (/^\d{1,2}:\d{2}$/.test(excelTime.trim())) {
      return excelTime.trim();
    }
    // Try to parse other formats
    const timeMatch = excelTime.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      return `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
    }
    return excelTime; // Return as is if can't parse
  }
  
  // If it's a number (Excel serial time or datetime), convert it
  if (typeof excelTime === 'number') {
    // If number is very large (> 100000), it might be Excel datetime (date + time)
    // Excel datetime = days since 1900-01-01 + time as fraction
    // If > 1, it contains date component, extract only time part
    let timeFraction = excelTime;
    if (excelTime >= 1) {
      // Extract only the decimal part (time)
      timeFraction = excelTime % 1;
    }
    
    // Excel time is fraction of a day (0.5 = 12:00)
    const totalSeconds = Math.round(timeFraction * 24 * 60 * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    // Validate hours (0-23)
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    
    // If invalid, try alternative: might be Excel datetime
    // Excel epoch is 1899-12-30
    try {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + excelTime * 24 * 60 * 60 * 1000);
      const hours2 = date.getHours();
      const minutes2 = date.getMinutes();
      return `${String(hours2).padStart(2, '0')}:${String(minutes2).padStart(2, '0')}`;
    } catch (e) {
      return '';
    }
  }
  
  return '';
};

// POST /api/upload/timekeeping - Upload Excel file for timekeeping
export const uploadTimekeeping = [
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      // Read Excel file - CRITICAL FIX for date parsing
      // Strategy: Read with both raw and formatted values to get the best of both worlds
      // If cell is formatted as date, we'll get the formatted string (e.g., "12/16/2025")
      // This avoids ALL timezone issues because we parse directly from the string
      const workbook = XLSX.readFile(req.file.path, { 
        cellDates: false, // Don't let XLSX parse dates to Date objects (causes timezone issues)
        cellNF: true, // Get number format info
        cellText: true, // Get formatted text values (this gives us date as string!)
        sheetStubs: true,
        raw: false, // Get formatted values - this is KEY! Formatted dates become strings like "12/16/2025"
      });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Read raw data first to find header row
      // CRITICAL: Use raw: true to get cell objects with both v (value) and w (formatted text)
      // This allows us to get the exact formatted date string from Excel
      const rawData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, 
        defval: null,
        blankrows: false,
        raw: false, // Get formatted values - dates become strings!
      });
      
      console.log(`\n=== Timekeeping Upload - Initial Read ===`);
      console.log(`Sheet name: ${sheetName}`);
      console.log(`Total raw rows: ${rawData.length}`);
      console.log(`First 5 rows:`, rawData.slice(0, 5));
      
      // Find header row (row with "Mã nhân viên" or "TT" or "STT")
      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(10, rawData.length); i++) {
        const row = rawData[i] as any[];
        if (row && Array.isArray(row)) {
          const rowStr = row.map(cell => String(cell || '').toLowerCase()).join(' ');
          if (rowStr.includes('mã nhân viên') || rowStr.includes('mã nv') || 
              rowStr.includes('tt') || rowStr.includes('stt') ||
              rowStr.includes('tên nhân viên')) {
            headerRowIndex = i;
            console.log(`✓ Found header at row ${i + 1}:`, row);
            break;
          }
        }
      }
      
      if (headerRowIndex === -1) {
        headerRowIndex = 0;
        console.log(`⚠️ No header found, using first row as header`);
      }
      
      // Read data with proper headers
      // CRITICAL: Also read formatted text from cells to get exact date strings
      let data: any[] = [];
      if (rawData.length > headerRowIndex + 1) {
        const headerRow = rawData[headerRowIndex] as any[];
        console.log(`\nHeader row:`, headerRow);
        
        // Find the column index for "Ngày" (Date column)
        let dateColumnIndex = -1;
        headerRow.forEach((header, idx) => {
          if (header && String(header).toLowerCase().includes('ngày')) {
            dateColumnIndex = idx;
          }
        });
        
        // Read data rows (skip header row)
        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
          const row = rawData[i] as any[];
          if (row && row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
            // Convert array row to object using header
            const rowObj: Record<string, any> = {};
            headerRow.forEach((header, idx) => {
              if (header) {
                const cellValue = row[idx];
                
                // CRITICAL FIX: If this is the date column, try to get formatted text from cell
                if (idx === dateColumnIndex && cellValue !== null && cellValue !== undefined) {
                  // Try to get formatted text from worksheet cell directly
                  // Excel row index is 0-based in XLSX, but Excel uses 1-based
                  // sheet_to_json with header: 1 returns data starting from row 0
                  // So row i in rawData corresponds to Excel row i+1
                  // But we need to account for header row offset
                  const excelRowIndex = i; // This is the row index in the parsed data
                  const cellAddress = XLSX.utils.encode_cell({ r: excelRowIndex, c: idx });
                  const cell = worksheet[cellAddress];
                  
                  // If cell has formatted text (w property), use it - this is the EXACT string from Excel!
                  if (cell && cell.w && typeof cell.w === 'string') {
                    rowObj[String(header)] = cell.w; // Use formatted text (e.g., "12/16/2025")
                    if (i <= headerRowIndex + 3) {
                      console.log(`📅 Date cell ${cellAddress} (row ${i}): raw=${cell.v}, formatted="${cell.w}"`);
                    }
                  } else if (cell && cell.v !== undefined) {
                    // If no formatted text, use raw value but log it
                    rowObj[String(header)] = cell.v;
                    if (i <= headerRowIndex + 3) {
                      console.log(`📅 Date cell ${cellAddress} (row ${i}): raw=${cell.v}, type=${typeof cell.v}, no formatted text`);
                    }
                  } else {
                    rowObj[String(header)] = cellValue; // Fallback
                  }
                } else {
                  rowObj[String(header)] = cellValue || null;
                }
              }
            });
            data.push(rowObj);
          }
        }
        
        console.log(`\n=== Data Rows Found ===`);
        console.log(`Total data rows: ${data.length}`);
        if (data.length > 0) {
          console.log(`First data row:`, data[0]);
          console.log(`All columns in first row:`, Object.keys(data[0]));
        }
      } else {
        console.log(`\n⚠️ No data rows found after header!`);
      }
      
      // If no data found with header method, try standard method
      if (data.length === 0) {
        console.log(`\n⚠️ Trying standard sheet_to_json method...`);
        data = XLSX.utils.sheet_to_json(worksheet, { defval: null });
        console.log(`Standard method found ${data.length} rows`);
        if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
          const firstRow = data[0] as Record<string, any>;
          console.log('Columns found:', Object.keys(firstRow));
          console.log('First row sample:', JSON.stringify(firstRow, null, 2));
        }
      }
      
      const records: any[] = [];
      let processedRows = 0;
      let skippedRows = 0;
      
      for (const row of data as any[]) {
        processedRows++;
        
        // Check if this is header row (skip it) - check multiple conditions
        const rowKeys = Object.keys(row);
        const rowValues = Object.values(row).map(v => String(v || '').toLowerCase());
        
        // More precise header detection: header row typically has "STT" as first column value
        // and all values are strings (column names), not data
        const firstValue = String(row[rowKeys[0]] || '').trim();
        const secondValue = String(row[rowKeys[1]] || '').trim();
        const isHeaderRow = 
          row['CHI TIẾT CHẤM CÔNG'] === 'STT' || 
          row['__EMPTY'] === 'Mã nhân viên' ||
          row['TT'] === 'STT' ||
          row['STT'] === 'TT' ||
          firstValue === 'STT' || // First column is "STT"
          (firstValue === 'TT' && secondValue.toLowerCase().includes('mã')) || // First is "TT", second is "Mã..."
          (row['Mã nhân viên'] && !row['Tên nhân viên'] && !row['Ngày'] && !row['Phòng Ban']) || // Header có Mã nhân viên nhưng không có dữ liệu
          String(row['CHI TIẾT CHẤM CÔNG'] || '').toLowerCase().includes('chi tiết') ||
          (rowValues.includes('stt') && rowValues.includes('mã nhân viên') && rowValues.includes('tên nhân viên') && rowValues.length <= 3); // Only header has these 3 values
        
        if (isHeaderRow) {
          if (processedRows <= 3) {
            console.log(`⚠️ Skipping header row ${processedRows}:`, {
              firstValue,
              secondValue,
              keys: Object.keys(row).slice(0, 10),
            });
          }
          continue;
        }
        
        // Handle format with __EMPTY columns (merged cells or special format)
        let employee_code = '';
        let employee_name = '';
        let date = '';
        let check_in = '';
        let check_out = '';
        let department = '';
        let shift = 'CA NGAY';
        let late_minutes = 0;
        let early_minutes = 0;
        let workday = 0;
        let total_hours = 0;
        let overtime_hours = 0;
        let total_all_hours = 0;
        
        // Try to parse with standard column names first (most common format)
        // Support multiple column name variations - try exact match first, then case-insensitive
        // Normalize keys by trimming whitespace
        const normalizedRow: Record<string, any> = {};
        Object.keys(row).forEach(key => {
          const normalizedKey = key.trim();
          normalizedRow[normalizedKey] = row[key];
        });
        
        // Try exact matches first (most common)
        employee_code = String(
          normalizedRow['Mã nhân viên'] || 
          normalizedRow['Mã NV'] || 
          normalizedRow['Mã'] || 
          row['Mã nhân viên'] || // Fallback to original
          row['Mã NV'] || 
          row['Mã'] || 
          row['employee_code'] || 
          row['Employee Code'] || 
          row['MÃ NV'] || 
          row['MÃ NHÂN VIÊN'] || 
          row['MA NV'] || 
          ''
        ).trim();
        
        employee_name = String(
          normalizedRow['Tên nhân viên'] || 
          normalizedRow['Tên'] || 
          normalizedRow['Họ tên'] || 
          row['Tên nhân viên'] || // Fallback to original
          row['Tên'] || 
          row['Họ tên'] || 
          row['employee_name'] || 
          row['Name'] || 
          row['TÊN NHÂN VIÊN'] || 
          row['TÊN'] || 
          row['HOTEN'] || 
          ''
        ).trim();
        
        // Fix swapped columns: some Excel (e.g. 27-28.01) have Tên in col B and Mã in col C
        const looksLikeCode = (s: string) => s && /[0-9]/.test(s) && !/\s{2,}/.test(s) && s.length <= 20;
        const looksLikeName = (s: string) => s && (/\s/.test(s) || s.length > 20 || !/[0-9]/.test(s));
        if (looksLikeName(employee_code) && looksLikeCode(employee_name)) {
          [employee_code, employee_name] = [employee_name, employee_code];
        }
        
        // Log first few rows to debug parsing
        if (processedRows <= 5) {
          const dateValueForLog = normalizedRow['Ngày'] || row['Ngày'];
          console.log(`\n🔍 Debug row ${processedRows}:`, {
            employee_code: employee_code || '(NOT FOUND)',
            employee_name: employee_name || '(NOT FOUND)',
            dateValue_type: dateValueForLog ? typeof dateValueForLog : 'null',
            dateValue_isDate: dateValueForLog instanceof Date,
            dateValue_raw: dateValueForLog ? (dateValueForLog instanceof Date ? dateValueForLog.toISOString() : dateValueForLog.toString()) : 'null',
            dateValue_local: dateValueForLog instanceof Date ? `${dateValueForLog.getFullYear()}-${String(dateValueForLog.getMonth() + 1).padStart(2, '0')}-${String(dateValueForLog.getDate()).padStart(2, '0')}` : 'N/A',
            availableKeys: Object.keys(row).slice(0, 10),
            normalizedKeys: Object.keys(normalizedRow).slice(0, 10),
            sampleValues: Object.entries(row).slice(0, 10).map(([k, v]) => `${k}: ${v}`),
          });
        }
        
        // Parse date - handle multiple formats (use normalized row)
        let dateValue = normalizedRow['Ngày'] || 
                        row['Ngày'] || 
                        normalizedRow['Ngày chấm công'] ||
                        row['date'] || 
                        row['Date'] || 
                        row['Ngày chấm công'] || 
                        row['NGÀY'] || 
                        row['NGAY'] || 
                        row['__EMPTY_3'];
        
        // CRITICAL DEBUG: Log what Excel is actually returning
        if (processedRows <= 3 && dateValue) {
          console.log(`\n🔍 RAW DATE VALUE from Excel (row ${processedRows}):`, {
            type: typeof dateValue,
            isDate: dateValue instanceof Date,
            value: dateValue,
            stringValue: String(dateValue),
            ifDate: dateValue instanceof Date ? {
              toString: dateValue.toString(),
              toISOString: dateValue.toISOString(),
              getFullYear: dateValue.getFullYear(),
              getMonth: dateValue.getMonth() + 1,
              getDate: dateValue.getDate(),
              getHours: dateValue.getHours(),
              getUTCFullYear: dateValue.getUTCFullYear(),
              getUTCMonth: dateValue.getUTCMonth() + 1,
              getUTCDate: dateValue.getUTCDate(),
            } : null,
          });
        }
        if (dateValue) {
          // PRIORITY 1: Handle string first (most reliable - no timezone issues)
          // Excel may return date as string if cell is formatted as text
          if (typeof dateValue === 'string') {
            const trimmed = String(dateValue).trim();
            
            // Try MM/DD/YYYY format first (common in Vietnamese Excel like "12/16/2025")
            const mmddyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (mmddyyyyMatch) {
              const [, month, day, year] = mmddyyyyMatch;
              const yearNum = parseInt(year);
              const monthNum = parseInt(month);
              const dayNum = parseInt(day);
              
              // Validate basic ranges
              if (yearNum >= 1900 && yearNum <= 2100 && 
                  monthNum >= 1 && monthNum <= 12 && 
                  dayNum >= 1 && dayNum <= 31) {
                // Validate date is actually valid (handles leap years, month boundaries)
                const testDate = new Date(yearNum, monthNum - 1, dayNum);
                
                // Verify the date is valid and matches what we parsed
                if (!isNaN(testDate.getTime()) && 
                    testDate.getFullYear() === yearNum && 
                    testDate.getMonth() + 1 === monthNum && 
                    testDate.getDate() === dayNum) {
                  // Date is valid - format directly from parsed components
                  // This is the MOST RELIABLE way - no timezone conversion at all!
                  date = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                } else {
                  // Date was auto-adjusted (invalid date like 31/02), use the adjusted date
                  const localDate = new Date(testDate.getFullYear(), testDate.getMonth(), testDate.getDate(), 0, 0, 0, 0);
                  const y = String(localDate.getFullYear());
                  const m = String(localDate.getMonth() + 1).padStart(2, '0');
                  const d = String(localDate.getDate()).padStart(2, '0');
                  date = `${y}-${m}-${d}`;
                  if (processedRows <= 5) {
                    console.warn(`⚠️ Invalid date auto-adjusted: ${trimmed} -> ${date}`);
                  }
                }
              } else {
                date = excelDateToDateString(dateValue);
              }
            } else {
              // Try DD/MM/YYYY format
              const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
              if (ddmmyyyyMatch) {
                const [, day, month, year] = ddmmyyyyMatch;
                const yearNum = parseInt(year);
                const monthNum = parseInt(month);
                const dayNum = parseInt(day);
                
                if (yearNum >= 1900 && yearNum <= 2100 && 
                    monthNum >= 1 && monthNum <= 12 && 
                    dayNum >= 1 && dayNum <= 31) {
                  // Validate date is actually valid
                  const testDate = new Date(yearNum, monthNum - 1, dayNum);
                  if (!isNaN(testDate.getTime()) && 
                      testDate.getFullYear() === yearNum && 
                      testDate.getMonth() + 1 === monthNum && 
                      testDate.getDate() === dayNum) {
                    date = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  } else {
                    const localDate = new Date(testDate.getFullYear(), testDate.getMonth(), testDate.getDate(), 0, 0, 0, 0);
                    const y = String(localDate.getFullYear());
                    const m = String(localDate.getMonth() + 1).padStart(2, '0');
                    const d = String(localDate.getDate()).padStart(2, '0');
                    date = `${y}-${m}-${d}`;
                    if (processedRows <= 5) {
                      console.warn(`⚠️ Invalid date auto-adjusted: ${trimmed} -> ${date}`);
                    }
                  }
                } else {
                  date = excelDateToDateString(dateValue);
                }
              } else if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                // Already in YYYY-MM-DD format
                date = trimmed;
              } else {
                // Try 2-digit year: M/D/YY or D/M/YY (e.g. 1/27/26 -> 2026-01-27)
                const twoDigitMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
                if (twoDigitMatch) {
                  const [, part1, part2, yy] = twoDigitMatch;
                  const yyNum = parseInt(yy);
                  const yearNum = yyNum <= 29 ? 2000 + yyNum : 1900 + yyNum;
                  // Assume M/D/YY (US style like 1/27/26 = Jan 27, 2026)
                  const monthNum = parseInt(part1);
                  const dayNum = parseInt(part2);
                  if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31 && yearNum >= 1900 && yearNum <= 2100) {
                    const testDate = new Date(yearNum, monthNum - 1, dayNum);
                    if (!isNaN(testDate.getTime()) && testDate.getFullYear() === yearNum && testDate.getMonth() + 1 === monthNum && testDate.getDate() === dayNum) {
                      date = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    } else {
                      const localDate = new Date(testDate.getFullYear(), testDate.getMonth(), testDate.getDate(), 0, 0, 0, 0);
                      date = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
                    }
                  } else {
                    date = excelDateToDateString(dateValue);
                  }
                } else {
                  date = excelDateToDateString(dateValue);
                }
              }
            }
          } 
          // PRIORITY 2: Handle number (Excel serial date)
          else if (typeof dateValue === 'number' && dateValue >= 1) {
            // Excel datetime serial number (days since 1900-01-01)
            // Excel epoch is 1899-12-30 (not 1900-01-01 due to Excel bug)
            // CRITICAL: Excel stores dates as LOCAL dates, not UTC!
            // When we convert serial to Date, we must use LOCAL timezone, not UTC
            
            const excelEpoch = new Date(1899, 11, 30); // Month is 0-indexed, so 11 = December
            const daysSinceEpoch = Math.floor(dateValue);
            const milliseconds = daysSinceEpoch * 24 * 60 * 60 * 1000;
            
            // Create date object - this will be in LOCAL timezone
            const dateObj = new Date(excelEpoch.getTime() + milliseconds);
            
            // CRITICAL FIX: Get LOCAL date components (not UTC!)
            // Excel date 12/16/2025 should give us year=2025, month=12, day=16 in LOCAL time
            const year = dateObj.getFullYear();
            const month = dateObj.getMonth() + 1;
            const day = dateObj.getDate();
            
            // Create a NEW date at midnight LOCAL time to ensure no timezone conversion
            const localDate = new Date(year, month - 1, day, 0, 0, 0, 0);
            
            // Use the verified local date components
            const finalYear = localDate.getFullYear();
            const finalMonth = String(localDate.getMonth() + 1).padStart(2, '0');
            const finalDay = String(localDate.getDate()).padStart(2, '0');
            date = `${finalYear}-${finalMonth}-${finalDay}`;
            
            // Log for debugging
            if (processedRows <= 5) {
              console.log(`📅 Parsed date from Excel serial number:`, {
                serial: dateValue,
                daysSinceEpoch,
                dateObj: dateObj.toString(),
                dateObjISO: dateObj.toISOString(),
                localComponents: { year, month, day },
                utcComponents: { 
                  year: dateObj.getUTCFullYear(), 
                  month: dateObj.getUTCMonth() + 1, 
                  day: dateObj.getUTCDate() 
                },
                parsed: date,
              });
            }
          } else if (typeof dateValue === 'string') {
            const trimmed = String(dateValue).trim();
            
            // Try MM/DD/YYYY format first (common in Vietnamese Excel like "12/16/2025")
            const mmddyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (mmddyyyyMatch) {
              const [, month, day, year] = mmddyyyyMatch;
              // Parse directly from string components - NO Date object conversion
              // This avoids any timezone issues
              const yearNum = parseInt(year);
              const monthNum = parseInt(month);
              const dayNum = parseInt(day);
              
              // Validate the date components
              if (yearNum >= 1900 && yearNum <= 2100 && 
                  monthNum >= 1 && monthNum <= 12 && 
                  dayNum >= 1 && dayNum <= 31) {
                // Validate date is actually valid (handles leap years, month boundaries)
                // Create a test Date to verify the date is valid
                const testDate = new Date(yearNum, monthNum - 1, dayNum);
                // If date is valid and matches what we parsed, use it directly
                // This ensures we get the exact date from Excel, not affected by timezone
                if (!isNaN(testDate.getTime()) && 
                    testDate.getFullYear() === yearNum && 
                    testDate.getMonth() + 1 === monthNum && 
                    testDate.getDate() === dayNum) {
                  // Date is valid - format directly from parsed components
                  // This works for ALL valid dates: 01/01/2025, 31/12/2025, 29/02/2024 (leap year), etc.
                  date = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                } else {
                  // Date was auto-adjusted (invalid like 31/02), use adjusted date
                  const localDate = new Date(testDate.getFullYear(), testDate.getMonth(), testDate.getDate(), 0, 0, 0, 0);
                  const y = String(localDate.getFullYear());
                  const m = String(localDate.getMonth() + 1).padStart(2, '0');
                  const d = String(localDate.getDate()).padStart(2, '0');
                  date = `${y}-${m}-${d}`;
                  if (processedRows <= 5) {
                    console.warn(`⚠️ Invalid date auto-adjusted: ${trimmed} -> ${date}`);
                  }
                }
              } else {
                // If validation fails, try Date object as fallback
                const parsedDate = new Date(yearNum, monthNum - 1, dayNum);
                if (!isNaN(parsedDate.getTime())) {
                  const y = String(parsedDate.getFullYear());
                  const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
                  const d = String(parsedDate.getDate()).padStart(2, '0');
                  date = `${y}-${m}-${d}`;
                } else {
                  date = excelDateToDateString(dateValue);
                }
              }
            } else {
              // Try DD/MM/YYYY format
              const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
              if (ddmmyyyyMatch) {
                const [, day, month, year] = ddmmyyyyMatch;
                const yearNum = parseInt(year);
                const monthNum = parseInt(month);
                const dayNum = parseInt(day);
                
                if (yearNum >= 1900 && yearNum <= 2100 && 
                    monthNum >= 1 && monthNum <= 12 && 
                    dayNum >= 1 && dayNum <= 31) {
                  // Validate date is actually valid (handles leap years, month boundaries)
                  const testDate = new Date(yearNum, monthNum - 1, dayNum);
                  if (!isNaN(testDate.getTime()) && 
                      testDate.getFullYear() === yearNum && 
                      testDate.getMonth() + 1 === monthNum && 
                      testDate.getDate() === dayNum) {
                    // Date is valid - format directly from parsed components
                    date = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  } else {
                    // Date was auto-adjusted, use adjusted date
                    const localDate = new Date(testDate.getFullYear(), testDate.getMonth(), testDate.getDate(), 0, 0, 0, 0);
                    const y = String(localDate.getFullYear());
                    const m = String(localDate.getMonth() + 1).padStart(2, '0');
                    const d = String(localDate.getDate()).padStart(2, '0');
                    date = `${y}-${m}-${d}`;
                    if (processedRows <= 5) {
                      console.warn(`⚠️ Invalid date auto-adjusted: ${trimmed} -> ${date}`);
                    }
                  }
                } else {
                  const parsedDate = new Date(yearNum, monthNum - 1, dayNum);
                  if (!isNaN(parsedDate.getTime())) {
                    const y = String(parsedDate.getFullYear());
                    const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
                    const d = String(parsedDate.getDate()).padStart(2, '0');
                    date = `${y}-${m}-${d}`;
                  } else {
                    date = excelDateToDateString(dateValue);
                  }
                }
              } else if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                date = trimmed;
              } else {
                const twoDigitMatch2 = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
                if (twoDigitMatch2) {
                  const [, part1, part2, yy] = twoDigitMatch2;
                  const yyNum = parseInt(yy);
                  const yearNum = yyNum <= 29 ? 2000 + yyNum : 1900 + yyNum;
                  const monthNum = parseInt(part1);
                  const dayNum = parseInt(part2);
                  if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31 && yearNum >= 1900 && yearNum <= 2100) {
                    const testDate = new Date(yearNum, monthNum - 1, dayNum);
                    if (!isNaN(testDate.getTime()) && testDate.getFullYear() === yearNum && testDate.getMonth() + 1 === monthNum && testDate.getDate() === dayNum) {
                      date = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    } else {
                      const localDate = new Date(testDate.getFullYear(), testDate.getMonth(), testDate.getDate(), 0, 0, 0, 0);
                      date = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
                    }
                  } else {
                    date = excelDateToDateString(dateValue);
                  }
                } else {
                  date = excelDateToDateString(dateValue);
                }
              }
            }
          } else {
            date = excelDateToDateString(dateValue);
          }
        }
        
        // Parse time fields (use normalized row)
        const checkInValue = normalizedRow['Giờ vào'] || 
                             row['Giờ vào'] || 
                             row['check_in'] || 
                             row['Check In'] || 
                             row['Vào'] || 
                             row['In'] || 
                             row['GIỜ VÀO'] || 
                             row['GIO VAO'] || 
                             row['__EMPTY_5'];
        check_in = excelTimeToTimeString(checkInValue);
        
        const checkOutValue = normalizedRow['Giờ ra'] || 
                              row['Giờ ra'] || 
                              row['check_out'] || 
                              row['Check Out'] || 
                              row['Ra'] || 
                              row['Out'] || 
                              row['GIỜ RA'] || 
                              row['GIO RA'] || 
                              row['__EMPTY_6'];
        check_out = excelTimeToTimeString(checkOutValue);
        
        department = String(
          normalizedRow['Phòng Ban'] ||
          normalizedRow['Phòng ban'] ||
          row['Phòng Ban'] ||
          row['Phòng ban'] ||
          row['department'] ||
          row['Department'] ||
          row['Bộ phận'] ||
          row['PHÒNG BAN'] ||
          row['PHONG BAN'] ||
          row['__EMPTY_2'] ||
          ''
        ).trim();

        shift = normalizedRow['Ca'] || 
                row['Ca'] || 
                row['shift'] || 
                row['Shift'] || 
                row['Ca làm việc'] || 
                row['CA'] || 
                row['__EMPTY_13'] || 
                'CA NGAY';
        
        late_minutes = parseInt(String(
          normalizedRow['Trễ'] || 
          row['Trễ'] || 
          row['Trễ (phút)'] || 
          row['late_minutes'] || 
          row['TRỄ'] || 
          row['TRE'] || 
          row['__EMPTY_7'] || 
          '0'
        )) || 0;
        
        early_minutes = parseInt(String(
          normalizedRow['Sớm'] || 
          row['Sớm'] || 
          row['Sớm (phút)'] || 
          row['early_minutes'] || 
          row['SỚM'] || 
          row['SOM'] || 
          row['__EMPTY_8'] || 
          '0'
        )) || 0;
        
        workday = parseFloat(String(
          normalizedRow['Công'] || 
          row['Công'] || 
          row['workday'] || 
          row['CONG'] || 
          row['__EMPTY_9'] || 
          '0'
        )) || 0;
        
        total_hours = parseFloat(String(
          normalizedRow['Tổng giờ'] || 
          row['Tổng giờ'] || 
          row['total_hours'] || 
          row['TỔNG GIỜ'] || 
          row['TONG GIO'] || 
          row['__EMPTY_10'] || 
          '0'
        )) || 0;
        
        overtime_hours = parseFloat(String(
          normalizedRow['Tăng ca'] || 
          row['Tăng ca'] || 
          row['overtime_hours'] || 
          row['TĂNG CA'] || 
          row['TANG CA'] || 
          row['__EMPTY_11'] || 
          '0'
        )) || 0;
        
        total_all_hours = parseFloat(String(
          normalizedRow['Tổng toàn bộ'] || 
          row['Tổng toàn bộ'] || 
          row['total_all_hours'] || 
          row['TỔNG TOÀN BỘ'] || 
          row['TONG TOAN BO'] || 
          row['__EMPTY_12'] || 
          '0'
        )) || 0;
        
        // If still using __EMPTY format (fallback)
        if (!employee_code && row['__EMPTY_1']) {
          employee_name = String(row['__EMPTY'] || '').trim();
          employee_code = String(row['__EMPTY_1'] || '').trim();
          if (!department) department = String(row['__EMPTY_2'] || '').trim();
          if (!date) {
            const dateValue = row['__EMPTY_3'];
            if (typeof dateValue === 'number' && dateValue >= 1) {
              // Excel date serial number - create new date at midnight local time
              const excelEpoch = new Date(1899, 11, 30);
              const dateObj = new Date(excelEpoch.getTime() + Math.floor(dateValue) * 24 * 60 * 60 * 1000);
              // Get components and create new date at midnight
              const year = dateObj.getFullYear();
              const month = dateObj.getMonth() + 1;
              const day = dateObj.getDate();
              const localDate = new Date(year, month - 1, day, 0, 0, 0, 0);
              // Use verified components
              const y = String(localDate.getFullYear());
              const m = String(localDate.getMonth() + 1).padStart(2, '0');
              const d = String(localDate.getDate()).padStart(2, '0');
              date = `${y}-${m}-${d}`;
            } else {
              date = excelDateToDateString(dateValue);
            }
          }
          if (!check_in) check_in = excelTimeToTimeString(row['__EMPTY_5']);
          if (!check_out) check_out = excelTimeToTimeString(row['__EMPTY_6']);
          if (late_minutes === 0) late_minutes = parseInt(String(row['__EMPTY_7'] || '0')) || 0;
          if (early_minutes === 0) early_minutes = parseInt(String(row['__EMPTY_8'] || '0')) || 0;
          if (workday === 0) workday = parseFloat(String(row['__EMPTY_9'] || '0')) || 0;
          if (total_hours === 0) total_hours = parseFloat(String(row['__EMPTY_10'] || '0')) || 0;
          if (overtime_hours === 0) overtime_hours = parseFloat(String(row['__EMPTY_11'] || '0')) || 0;
          if (total_all_hours === 0) total_all_hours = parseFloat(String(row['__EMPTY_12'] || '0')) || 0;
          if (!shift || shift === 'CA NGAY') shift = String(row['__EMPTY_13'] || 'CA NGAY').trim();
        }
        
        // Skip if missing required fields
        if (!employee_code || !date) {
          skippedRows++;
          if (skippedRows <= 30) { // Log first 30 skipped rows for debugging
            const missingFields = [];
            if (!employee_code) missingFields.push('employee_code');
            if (!date) missingFields.push('date');
            
            console.log(`⚠️ Skipping row ${processedRows} (missing: ${missingFields.join(', ')}):`, {
              employee_code: employee_code || '(empty)',
              date: date || '(empty)',
              employee_name: employee_name || '(empty)',
              allKeys: Object.keys(row), // Log ALL keys to see what's available
              first10Values: Object.entries(row).slice(0, 10).map(([k, v]) => `${k}: ${v}`),
            });
          }
          continue;
        }
        
        // Log first few parsed records for debugging
        if (records.length < 5) {
          console.log(`\n✓ Parsed record ${records.length + 1}:`, {
            employee_code,
            employee_name,
            date,
            check_in: check_in || '(empty)',
            check_out: check_out || '(empty)',
            department,
            total_hours,
            overtime_hours,
            total_all_hours,
            shift,
          });
        }
        
        // Determine day of week
        // ƯU TIÊN 1: Lấy trực tiếp từ file Excel (cột "Thứ") để khớp 100% với file gốc
        let dayOfWeekRaw =
          normalizedRow['Thứ'] ||
          row['Thứ'] ||
          row['Thu'] ||
          row['THỨ'] ||
          row['THU'] ||
          row['Thứ trong tuần'] ||
          row['THỨ TRONG TUẦN'] ||
          row['__EMPTY_4'];

        let dayOfWeek = '';

        if (dayOfWeekRaw && String(dayOfWeekRaw).trim() !== '') {
          // Dùng nguyên giá trị từ Excel (ví dụ: "Sáu", "Bảy") để tránh sai khác
          dayOfWeek = String(dayOfWeekRaw).trim();
        } else {
          // ƯU TIÊN 2: Tự tính từ trường date (fallback)
          try {
            const dateObj = new Date(date);
            if (!isNaN(dateObj.getTime())) {
              const dayIndex = dateObj.getDay(); // 0 = Chủ nhật, 1 = Thứ hai, ...
              const dayNames = [
                'Chủ nhật',
                'Thứ hai',
                'Thứ ba',
                'Thứ tư',
                'Thứ năm',
                'Thứ sáu',
                'Thứ bảy',
              ];
              dayOfWeek = dayNames[dayIndex] || '';
            }
          } catch (e) {
            // Giữ dayOfWeek rỗng, sẽ xử lý phía dưới
          }
        }

        // Nếu vẫn không xác định được, gán rỗng để frontend hiển thị trống
        if (!dayOfWeek) {
          dayOfWeek = '';
        }
        
        // Calculate total hours if not provided
        let finalTotalHours = total_hours;
        if (!finalTotalHours && check_in && check_out) {
          try {
            const [inHour, inMin] = check_in.split(':').map(Number);
            const [outHour, outMin] = check_out.split(':').map(Number);
            if (!isNaN(inHour) && !isNaN(outHour)) {
              const totalMinutes = (outHour * 60 + outMin) - (inHour * 60 + inMin);
              finalTotalHours = totalMinutes / 60;
            }
          } catch (e) {
            // Use default
          }
        }
        
        if (!finalTotalHours) finalTotalHours = 0;
        if (!total_all_hours) total_all_hours = finalTotalHours;
        
        // Prepare record data
        const recordData = {
          employee_code,
          employee_name: employee_name || employee_code,
          date,
          day_of_week: dayOfWeek,
          check_in: check_in || '',
          check_out: check_out || '',
          late_minutes,
          early_minutes,
          workday: workday || (finalTotalHours > 0 ? 1 : 0),
          total_hours: finalTotalHours,
          overtime_hours,
          total_all_hours,
          shift: shift || 'CA NGAY',
          department: department || 'Chưa xác định',
          created_at: new Date().toISOString(), // Đánh dấu thời gian upload để sắp xếp dữ liệu mới trước
          is_archived: 0, // Dữ liệu mới upload = 0 (hiển thị ở Báo cáo)
        };
        
        records.push(recordData);
      }
      
      // Batch process: Get all employee IDs first (in one query)
      const employeeCodes = [...new Set(records.map(r => r.employee_code).filter(Boolean))];
      const employeeMap = new Map<string, number>();
      if (employeeCodes.length > 0) {
        const employees = await prisma.employee.findMany({
          where: { employee_code: { in: employeeCodes } },
          select: { id: true, employee_code: true },
        });
        employees.forEach(emp => employeeMap.set(emp.employee_code, emp.id));
      }

      // Một transaction duy nhất: archive + insert tất cả → 1 lần commit, nhanh như upload nhân viên
      const TX_TIMEOUT = 10 * 60 * 1000; // 10 phút cho file lớn
      let insertedCount = 0;
      const insertedRecords: any[] = [];
      console.log(`\n📦 Archive + insert ${records.length} bản ghi trong 1 transaction...`);

      await prisma.$transaction(async (tx) => {
        const archiveResult = await tx.timekeepingRecord.updateMany({
          where: { is_archived: 0 },
          data: { is_archived: 1 },
        });
        console.log(`✓ Đã chuyển ${archiveResult.count} bản ghi cũ sang Lịch sử`);

        for (let i = 0; i < records.length; i++) {
          const recordData = records[i];
          try {
            const record = await tx.timekeepingRecord.create({
              data: {
                ...recordData,
                employee_id: employeeMap.get(recordData.employee_code) || null,
              },
            });
            insertedRecords.push(record);
            insertedCount++;
          } catch (error: any) {
            skippedRows++;
            if (error.code === 'P2002' && skippedRows <= 5) {
              console.log(`⚠️ Duplicate skipped: ${recordData.employee_code} - ${recordData.date}`);
            } else if (error.code !== 'P2002' && skippedRows <= 20) {
              console.error(`❌ Error record ${i + 1}:`, error.message);
            }
          }
          if ((i + 1) % 500 === 0 || i + 1 === records.length) {
            console.log(`Processed ${i + 1}/${records.length} (Inserted: ${insertedCount})`);
          }
        }
      }, { timeout: TX_TIMEOUT });
      
      // Delete uploaded file
      fs.unlinkSync(req.file.path);
      
      // Log summary with date range info
      console.log(`\n=== Timekeeping Upload Summary ===`);
      console.log(`Total rows in Excel: ${data.length}`);
      console.log(`Total rows processed: ${processedRows}`);
      console.log(`Records parsed successfully: ${records.length}`);
      console.log(`Successfully created: ${insertedCount}`);
      console.log(`Skipped: ${skippedRows}`);
      
      if (records.length > 0) {
        const datesInRecords = records.map(r => r.date).filter(Boolean);
        const minDate = datesInRecords.length > 0 ? datesInRecords.reduce((a, b) => a < b ? a : b) : 'N/A';
        const maxDate = datesInRecords.length > 0 ? datesInRecords.reduce((a, b) => a > b ? a : b) : 'N/A';
        console.log(`Date range in uploaded data: ${minDate} to ${maxDate}`);
        console.log(`Unique dates: ${new Set(datesInRecords).size}`);
        console.log(`Unique employees: ${new Set(records.map(r => r.employee_code)).size}`);
      } else {
        console.log(`⚠️ WARNING: No records were parsed from ${data.length} rows!`);
        console.log(`This might indicate a parsing issue. Check the logs above for skipped rows.`);
        console.log(`Sample row keys:`, data.length > 0 ? Object.keys(data[0] || {}) : 'No data');
      }
      
      // Log final archive status
      const finalArchived = await prisma.timekeepingRecord.count({ where: { is_archived: 1 } });
      const finalNew = await prisma.timekeepingRecord.count({ where: { is_archived: 0 } });
      console.log(`📊 Sau khi upload: Đã archive: ${finalArchived}, Dữ liệu mới: ${finalNew}`);
      
      // Calculate date range for response
      let dateRangeResponse = { min: 'N/A', max: 'N/A' };
      if (records.length > 0) {
        const datesInRecords = records.map(r => r.date).filter(Boolean);
        if (datesInRecords.length > 0) {
          const minDate = datesInRecords.reduce((a, b) => a < b ? a : b);
          const maxDate = datesInRecords.reduce((a, b) => a > b ? a : b);
          dateRangeResponse = { min: minDate, max: maxDate };
        }
      }
      
      // Create notification for successful upload
      if (insertedCount > 0) {
        await createNotification(
          'upload_success',
          'Upload dữ liệu thành công',
          `Đã upload ${insertedCount} bản ghi chấm công thành công`,
          {
            count: insertedCount,
            dateRange: dateRangeResponse,
          }
        );
        
        // Check for late employees in today's data
        const today = new Date().toISOString().split('T')[0];
        const todayRecords = await prisma.timekeepingRecord.findMany({
          where: {
            is_archived: 0,
            date: today,
          },
        });
        
        // Count unique late employees
        const lateEmployeeCodes = new Set<string>();
        todayRecords.forEach(r => {
          let isLate = false;
          
          // If late_minutes > 0, count as late
          if (r.late_minutes > 0) {
            isLate = true;
          } else if (r.check_in) {
            // Check if check_in time is after 8:00 AM (08:00)
            const checkInTime = r.check_in.trim();
            if (checkInTime) {
              const timeMatch = checkInTime.match(/(\d{1,2}):(\d{2})/);
              if (timeMatch) {
                const hours = parseInt(timeMatch[1]);
                const minutes = parseInt(timeMatch[2]);
                // Consider late if check-in is after 8:00 AM
                if (hours > 8 || (hours === 8 && minutes > 0)) {
                  isLate = true;
                }
              }
            }
          }
          
          if (isLate) {
            // Use resolveRecordCode logic to get the correct employee code
            const code1 = (r.employee_code || '').trim().toUpperCase();
            const code2 = (r.employee_name || '').trim().toUpperCase();
            const looksLikeCode = (val: string) => {
              if (!val || /\s/.test(val)) return false;
              return /[0-9]/.test(val);
            };
            if (looksLikeCode(code1)) {
              lateEmployeeCodes.add(code1);
            } else if (looksLikeCode(code2)) {
              lateEmployeeCodes.add(code2);
            } else {
              lateEmployeeCodes.add(code1 || code2);
            }
          }
        });
        
        const lateCount = lateEmployeeCodes.size;
        if (lateCount > 0) {
          await createNotification(
            'late_employees',
            `${lateCount} nhân viên đi trễ hôm nay`,
            `Có ${lateCount} nhân viên đi trễ trong dữ liệu hôm nay`,
            {
              count: lateCount,
              date: today,
            }
          );
        }
      }
      
      res.json({
        message: insertedCount > 0 
          ? 'Timekeeping records uploaded successfully' 
          : `Upload completed but no records were added. ${skippedRows} rows were skipped. Check console logs for details.`,
        count: insertedCount,
        totalRows: data.length,
        processedRows,
        skippedRows,
        parsedRecords: records.length, // Số records đã parse được
        dateRange: dateRangeResponse,
        records: insertedRecords.slice(0, 10), // Return first 10 records
      });
    } catch (error: any) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: error.message });
    }
  },
];

// POST /api/upload/avatar - Upload avatar image
export const uploadAvatar = [
  upload.single('avatar'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      // In production, upload to cloud storage (S3, Cloudinary, etc.)
      // For now, return the file path
      const avatarUrl = `/uploads/${req.file.filename}`;
      
      res.json({
        message: 'Avatar uploaded successfully',
        avatar_url: avatarUrl,
      });
    } catch (error: any) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: error.message });
    }
  },
];



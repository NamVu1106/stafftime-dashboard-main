/**
 * Đọc cấu trúc TẤT CẢ file Excel trong "New folder" và xuất ra JSON
 * Chạy: node scripts/read-new-folder-excels.js
 */
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const newFolder = path.join(root, 'New folder');
const docsDir = path.join(root, 'docs');

if (!fs.existsSync(newFolder)) {
  console.log('Không tìm thấy thư mục "New folder".');
  process.exit(1);
}
if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

const MAX_ROWS_PER_SHEET = 35; // số dòng tối đa lấy mỗi sheet để xem cấu trúc
const MAX_COLS = 50;

const files = fs.readdirSync(newFolder).filter(f => f.toLowerCase().endsWith('.xlsx'));
console.log('Tìm thấy', files.length, 'file .xlsx trong New folder.\n');

const all = { generatedAt: new Date().toISOString(), folder: 'New folder', files: [] };

for (const fileName of files) {
  const filePath = path.join(newFolder, fileName);
  try {
    const wb = XLSX.readFile(filePath, { cellDates: true });
    const fileInfo = {
      fileName,
      sheetNames: wb.SheetNames,
      sheets: {},
    };
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const rowCount = range.e.r - range.s.r + 1;
      const colCount = range.e.c - range.s.c + 1;
      const rows = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: '',
        raw: false,
        range: 0,
      });
      const limited = rows.slice(0, MAX_ROWS_PER_SHEET).map(row => {
        const arr = Array.isArray(row) ? row : Object.values(row);
        return arr.slice(0, MAX_COLS);
      });
      fileInfo.sheets[sheetName] = {
        range: ws['!ref'] || null,
        rowCount,
        colCount,
        previewRows: limited,
      };
    }
    all.files.push(fileInfo);
    console.log('OK:', fileName, '→', wb.SheetNames.length, 'sheet(s)');
  } catch (err) {
    console.log('LỖI:', fileName, err.message);
    all.files.push({ fileName, error: err.message });
  }
}

const outFile = path.join(docsDir, 'new-folder-excel-structure.json');
fs.writeFileSync(outFile, JSON.stringify(all, null, 2), 'utf8');
console.log('\nĐã lưu cấu trúc tất cả file vào:', outFile);

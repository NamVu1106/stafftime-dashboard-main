/**
 * Đọc cấu trúc file Excel mẫu và xuất ra JSON
 * Chạy: node scripts/read-excel-template.js
 */
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const docsDir = path.join(root, 'docs');
if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

// Tìm file xlsx trong root
const files = fs.readdirSync(root).filter(f => f.endsWith('.xlsx'));
const templateFile = files.find(f => f.includes('260227') || f.includes('업무') || f.includes('계획')) || files[0];

if (!templateFile) {
  console.log('Không tìm thấy file Excel mẫu trong thư mục gốc.');
  process.exit(1);
}

const filePath = path.join(root, templateFile);
console.log('Đang đọc:', templateFile);

const wb = XLSX.readFile(filePath);
const result = { sheetNames: wb.SheetNames, sheets: {} };
wb.SheetNames.forEach(name => {
  const ws = wb.Sheets[name];
  result.sheets[name] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
});

const outFile = path.join(docsDir, 'excel-template-structure.json');
fs.writeFileSync(outFile, JSON.stringify(result, null, 2), 'utf8');
console.log('Đã lưu cấu trúc vào:', outFile);

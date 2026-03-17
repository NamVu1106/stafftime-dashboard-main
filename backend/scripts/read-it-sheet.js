/**
 * Đọc sheet "IT lap trinh" từ file Excel
 */
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const files = fs.readdirSync(root).filter(f => f.endsWith('.xlsx') && f.includes('260227'));
console.log('Files:', files);

for (const f of files) {
  const fp = path.join(root, f);
  try {
    const wb = XLSX.readFile(fp);
    console.log('\nSheet names:', wb.SheetNames);
    const itSheet = wb.SheetNames.find(n => n.toLowerCase().includes('it') && n.toLowerCase().includes('lap'));
    const sheetName = itSheet || wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    console.log('\nSheet:', sheetName, '- Rows:', data.length);
    data.slice(0, 35).forEach((row, i) => console.log(i + 1, JSON.stringify(row.slice(0, 10))));
    fs.writeFileSync(path.join(root, 'docs', 'it-sheet-data.json'), JSON.stringify(data, null, 2), 'utf8');
    console.log('\nSaved to docs/it-sheet-data.json');
    break;
  } catch (e) {
    console.error(f, e.message);
  }
}

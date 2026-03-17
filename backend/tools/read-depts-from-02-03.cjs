/* Read 02-03.02.xlsx and extract unique department names (Phòng ban / Bộ phận) */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const filePath = path.join(__dirname, '..', '02-03.02.xlsx');
if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

const wb = XLSX.readFile(filePath, { sheetRows: 10000, cellDates: true });
const out = { sheets: wb.SheetNames, departments: [], sample: [] };

for (const sheetName of wb.SheetNames.slice(0, 3)) {
  const sh = wb.Sheets[sheetName];
  if (!sh || !sh['!ref']) continue;
  const range = XLSX.utils.decode_range(sh['!ref']);
  const rows = Math.min(range.e.r - range.s.r + 1, 10000);
  const cols = Math.min(range.e.c - range.s.c + 1, 30);
  let deptCol = -1;
  const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  for (let headerRow = 0; headerRow < Math.min(3, rows); headerRow++) {
    for (let c = 0; c < cols; c++) {
      const cell = sh[XLSX.utils.encode_cell({ r: range.s.r + headerRow, c: range.s.c + c })];
      const v = cell ? String(cell.w ?? cell.v ?? '').trim() : '';
      const n = norm(v);
      if (n === 'phong ban' || n.includes('phong ban') || n === 'department' || n.includes('bophan') || (n.includes('phong') && n.includes('ban'))) {
        deptCol = c;
        break;
      }
    }
    if (deptCol >= 0) break;
  }
  if (deptCol < 0 && cols >= 4) deptCol = 3;
  const set = new Set();
  const dataStartRow = 2;
  for (let r = dataStartRow; r < rows; r++) {
    const colIdx = deptCol >= 0 ? deptCol : 0;
    const cell = sh[XLSX.utils.encode_cell({ r: range.s.r + r, c: range.s.c + colIdx })];
    const v = cell ? String(cell.w ?? cell.v ?? '').trim() : '';
    if (v && v.length < 100 && !/^\d+$/.test(v)) set.add(v);
  }
  set.forEach(d => out.departments.push(d));
  for (let r = 0; r < Math.min(5, rows); r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const cell = sh[XLSX.utils.encode_cell({ r: range.s.r + r, c: range.s.c + c })];
      row.push(cell ? (cell.w ?? cell.v ?? '') : '');
    }
    out.sample.push({ sheet: sheetName, row: r + 1, data: row });
  }
}

out.departments = [...new Set(out.departments)].filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi'));
fs.writeFileSync(path.join(__dirname, '..', 'depts-from-02-03.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('Departments found:', out.departments.length);
console.log(out.departments.join('\n'));
